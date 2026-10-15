const express = require('express');
const { z } = require('zod');
const crypto = require('crypto');
const { db, bucket } = require('../config/firebase');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { roleMiddleware } = require('../middlewares/role.middleware');

const router = express.Router();
const chamados = db.collection('chamadosSuporte');
const MAX_ANEXO = 2.5 * 1024 * 1024;
const formatos = {
  'application/pdf': { extensao: 'pdf', assinatura: (b) => b.subarray(0, 5).toString() === '%PDF-' },
  'image/png': { extensao: 'png', assinatura: (b) => b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) },
  'image/jpeg': { extensao: 'jpg', assinatura: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/webp': { extensao: 'webp', assinatura: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' }
};
const schema = z.object({
  assunto: z.string().trim().min(5).max(120),
  descricao: z.string().trim().min(20).max(4000),
  tipo: z.enum(['BUG', 'DUVIDA', 'SUGESTAO']),
  pagina: z.string().trim().max(300).optional(),
  anexo: z.object({
    nome: z.string().trim().min(1).max(180),
    mime: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']),
    dadosBase64: z.string().min(1).max(Math.ceil(MAX_ANEXO * 4 / 3) + 8)
  }).optional()
}).strict();

function erro(status, mensagem) {
  const e = new Error(mensagem);
  e.status = status;
  return e;
}

function validarAnexo(anexo) {
  if (!anexo) return null;
  const formato = formatos[anexo.mime];
  const base64 = anexo.dadosBase64;
  if (!formato || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    throw erro(400, 'Anexo inválido. Use PDF, PNG, JPG ou WEBP.');
  }
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length || buffer.length > MAX_ANEXO || !formato.assinatura(buffer) || buffer.toString('base64') !== base64) {
    throw erro(400, 'Anexo inválido ou maior que 2,5 MB.');
  }
  return { buffer, mime: anexo.mime, extensao: formato.extensao, nome: anexo.nome.replace(/[\r\n\\/]/g, ' ').trim() };
}

function ehResponsavelPlataforma(user) {
  const uids = (process.env.PLATFORM_SUPPORT_UIDS || '').split(',').map((uid) => uid.trim()).filter(Boolean);
  return uids.includes(user.uid);
}

function sanitizar(doc) {
  const dados = doc.data();
  return {
    id: doc.id,
    assunto: dados.assunto,
    descricao: dados.descricao,
    tipo: dados.tipo,
    pagina: dados.pagina || null,
    status: dados.status,
    criadoEm: dados.criadoEm,
    atualizadoEm: dados.atualizadoEm,
    anexo: dados.anexo ? { nome: dados.anexo.nome, mime: dados.anexo.mime } : null
  };
}

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'ADVOGADO'));

router.get('/chamados', async (req, res, next) => {
  try {
    const snapshot = await chamados.where('criadoPor', '==', req.user.uid).get();
    res.json(snapshot.docs.map(sanitizar).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 50));
  } catch (e) { next(e); }
});

router.post('/chamados', async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw erro(400, 'Confira assunto, descrição e anexo do chamado.');
    const { anexo, ...dados } = parsed.data;
    const arquivo = validarAnexo(anexo);
    const ref = chamados.doc();
    const agora = new Date().toISOString();
    const storagePath = arquivo ? `suporte/${req.user.uid}/${ref.id}/${crypto.randomUUID()}.${arquivo.extensao}` : null;
    if (arquivo) {
      await bucket.file(storagePath).save(arquivo.buffer, {
        resumable: false,
        metadata: { contentType: arquivo.mime, cacheControl: 'private, no-store', metadata: { criadoPor: req.user.uid } }
      });
    }
    try {
      await ref.set({
        ...dados,
        assunto: dados.assunto.trim(),
        descricao: dados.descricao.trim(),
        criadoPor: req.user.uid,
        criadoPorNome: req.user.displayName || null,
        criadoPorEmail: req.user.email || null,
        status: 'ABERTO',
        criadoEm: agora,
        atualizadoEm: agora,
        anexo: arquivo ? { nome: arquivo.nome, mime: arquivo.mime, storagePath } : null
      });
    } catch (e) {
      if (storagePath) await bucket.file(storagePath).delete({ ignoreNotFound: true }).catch(() => {});
      throw e;
    }
    res.status(201).json(sanitizar(await ref.get()));
  } catch (e) { next(e); }
});

router.get('/chamados/:id/anexo', async (req, res, next) => {
  try {
    const doc = await chamados.doc(req.params.id).get();
    if (!doc.exists || !doc.data().anexo) throw erro(404, 'Anexo não encontrado.');
    if (doc.data().criadoPor !== req.user.uid && !ehResponsavelPlataforma(req.user)) throw erro(403, 'Acesso negado.');
    const anexo = doc.data().anexo;
    const [buffer] = await bucket.file(anexo.storagePath).download();
    res.set({
      'Content-Type': anexo.mime,
      'Content-Disposition': `attachment; filename="anexo.${formatos[anexo.mime].extensao}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.send(buffer);
  } catch (e) { next(e); }
});

// Esta caixa de entrada só funciona após cadastrar UIDs dos responsáveis pela plataforma.
router.get('/chamados-plataforma', async (req, res, next) => {
  try {
    if (!ehResponsavelPlataforma(req.user)) throw erro(403, 'Acesso negado.');
    const snapshot = await chamados.orderBy('criadoEm', 'desc').limit(100).get();
    res.json(snapshot.docs.map((doc) => ({ ...sanitizar(doc), criadoPorEmail: doc.data().criadoPorEmail, criadoPorNome: doc.data().criadoPorNome })));
  } catch (e) { next(e); }
});

router.use((e, req, res, next) => {
  if (e.status && e.status < 500) return res.status(e.status).json({ mensagem: e.message });
  next(e);
});

module.exports = router;
