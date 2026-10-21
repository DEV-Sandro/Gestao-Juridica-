const express = require('express');
const { z } = require('zod');
const { db, bucket } = require('../config/firebase');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { roleMiddleware } = require('../middlewares/role.middleware');
const { validarDocx, MAX_DOCX_BYTES } = require('../services/modelo-docx.validator');

const router = express.Router();
const modelos = db.collection('modelosDocumento');
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const schema = z.object({
  titulo: z.string().trim().min(3).max(100),
  descricao: z.string().trim().max(240).optional(),
  dadosBase64: z.string().min(1).max(Math.ceil(MAX_DOCX_BYTES * 4 / 3) + 8)
}).strict();

function erro(status, mensagem) { const e = new Error(mensagem); e.status = status; return e; }
function validarId(id) { if (!/^[A-Za-z0-9]{20}$/.test(id)) throw erro(404, 'Modelo não encontrado.'); }
function resumo(doc) {
  const item = doc.data();
  return { id: doc.id, titulo: item.titulo, descricao: item.descricao || '', criadoPor: item.criadoPor, criadoEm: item.criadoEm };
}
function pertence(doc, user) { return doc.exists && doc.data().escritorioId === user.escritorioId; }

router.use(authMiddleware, roleMiddleware('ADMIN', 'ADVOGADO'));

router.get('/', async (req, res, next) => {
  try {
    const snap = await modelos.where('escritorioId', '==', req.user.escritorioId).get();
    res.json(snap.docs.map(resumo).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 50));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw erro(400, 'Informe um título e um arquivo DOCX de até 2 MB.');
    const base64 = parsed.data.dadosBase64;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) throw erro(400, 'Arquivo inválido.');
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.toString('base64') !== base64 || !validarDocx(buffer)) throw erro(400, 'Use um arquivo DOCX válido, sem macros ou conteúdo incorporado, de até 2 MB.');

    const existentes = await modelos.where('escritorioId', '==', req.user.escritorioId).get();
    if (existentes.size >= 40) throw erro(409, 'O escritório atingiu o limite de 40 modelos.');
    const ref = modelos.doc();
    const caminho = `templates/${encodeURIComponent(req.user.escritorioId)}/${ref.id}.docx`;
    await bucket.file(caminho).save(buffer, { resumable: false, metadata: { contentType: MIME_DOCX, cacheControl: 'private, no-store' } });
    try {
      await ref.set({
        escritorioId: req.user.escritorioId,
        criadoPor: req.user.uid,
        titulo: parsed.data.titulo,
        descricao: parsed.data.descricao || '',
        storagePath: caminho,
        criadoEm: new Date().toISOString()
      });
    } catch (e) {
      await bucket.file(caminho).delete({ ignoreNotFound: true }).catch(() => {});
      throw e;
    }
    res.status(201).json(resumo(await ref.get()));
  } catch (e) { next(e); }
});

router.get('/:id/arquivo', async (req, res, next) => {
  try {
    validarId(req.params.id);
    const doc = await modelos.doc(req.params.id).get();
    if (!pertence(doc, req.user)) throw erro(404, 'Modelo não encontrado.');
    const [buffer] = await bucket.file(doc.data().storagePath).download();
    res.set({ 'Content-Type': MIME_DOCX, 'Content-Disposition': 'attachment; filename="modelo.docx"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.send(buffer);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    validarId(req.params.id);
    const ref = modelos.doc(req.params.id);
    const doc = await ref.get();
    if (!pertence(doc, req.user)) throw erro(404, 'Modelo não encontrado.');
    if (req.user.role !== 'ADMIN' && doc.data().criadoPor !== req.user.uid) throw erro(403, 'Apenas quem criou o modelo ou o administrador pode removê-lo.');
    await bucket.file(doc.data().storagePath).delete({ ignoreNotFound: true });
    await ref.delete();
    res.status(204).end();
  } catch (e) { next(e); }
});

router.use((e, req, res, next) => { if (e.status && e.status < 500) return res.status(e.status).json({ mensagem: e.message }); next(e); });
module.exports = router;
