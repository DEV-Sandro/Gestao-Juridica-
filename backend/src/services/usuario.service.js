const crypto = require('crypto');
const { z } = require('zod');

const { admin, bucket, defaultBucketName, projectId, sanitizeBucketName } = require('../config/firebase');
const usuarioRepository = require('../repositories/usuario.repository');
const conviteService = require('./convite.service');

const ROLES_VALIDOS = ['ADMIN', 'ADVOGADO', 'CLIENT'];
const urlFotoPermitida = /^(https:\/\/|http:\/\/).+/i;
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_MIME_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AVATAR_EXT_POR_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

const textoOpcional = (max) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .transform((valor) => (typeof valor === 'string' ? valor.trim() || null : valor));

const schemaAtualizacaoPerfil = z
  .object({
    displayName: textoOpcional(120),
    photoURL: z
      .union([z.string().trim().url().max(2048), z.null()])
      .refine((valor) => valor === null || urlFotoPermitida.test(valor), {
        message: 'A URL da foto de perfil e invalida.'
      }),
    telefone: textoOpcional(32),
    cargo: textoOpcional(80),
    oab: textoOpcional(40)
  })
  .partial()
  .strict();

function validarAtualizacaoPerfil(dados = {}) {
  const permitidos = ['displayName', 'photoURL', 'telefone', 'cargo', 'oab'];
  const entrada = {};

  for (const key of permitidos) {
    if (dados[key] !== undefined) {
      entrada[key] = dados[key];
    }
  }

  if (Object.keys(entrada).length === 0) {
    const erro = new Error('VALIDACAO_PERFIL');
    erro.details = ['Nenhum campo valido foi enviado para atualizacao.'];
    throw erro;
  }

  const parse = schemaAtualizacaoPerfil.safeParse(entrada);
  if (!parse.success) {
    const erro = new Error('VALIDACAO_PERFIL');
    erro.details = parse.error.issues.map((issue) => issue.message);
    throw erro;
  }

  return parse.data;
}

function sanitizarMembro(doc, authUser = null) {
  return {
    uid: doc.uid,
    email: doc.email ?? authUser?.email ?? null,
    displayName: doc.displayName ?? authUser?.displayName ?? null,
    photoURL: doc.photoURL ?? authUser?.photoURL ?? null,
    avatarStoragePath: doc.avatarStoragePath ?? null,
    role: doc.role ?? 'CLIENT',
    telefone: doc.telefone ?? null,
    cargo: doc.cargo ?? null,
    oab: doc.oab ?? null,
    criadoEm: doc.criadoEm ?? null,
    ativo: doc.ativo !== false
  };
}

async function obterPerfil(user) {
  const doc = (await usuarioRepository.buscarPorId(user.uid)) || { uid: user.uid };
  let authUser = null;

  try {
    authUser = await admin.auth().getUser(user.uid);
  } catch (err) {
    console.error('[usuario.service] getUser falhou', err.message);
  }

  return sanitizarMembro(doc, authUser);
}

async function atualizarMeuPerfil(user, dados) {
  const payload = validarAtualizacaoPerfil(dados);
  payload.atualizadoEm = new Date().toISOString();

  await usuarioRepository.criarOuAtualizar(user.uid, payload);

  const authPayload = {};
  if (payload.displayName !== undefined) {
    authPayload.displayName = payload.displayName;
  }
  if (payload.photoURL !== undefined) {
    authPayload.photoURL = payload.photoURL;
  }

  if (Object.keys(authPayload).length > 0) {
    try {
      await admin.auth().updateUser(user.uid, authPayload);
    } catch (err) {
      console.error('[usuario.service] updateUser falhou', err.message);
    }
  }

  return obterPerfil(user);
}

function validarArquivoAvatar(arquivo) {
  const buffer = Buffer.isBuffer(arquivo?.buffer) ? arquivo.buffer : null;
  const contentType =
    typeof arquivo?.contentType === 'string' ? arquivo.contentType.trim().toLowerCase() : '';

  if (!buffer || buffer.length === 0) {
    throw new Error('AVATAR_VAZIO');
  }

  if (buffer.length > AVATAR_MAX_BYTES) {
    throw new Error('AVATAR_MUITO_GRANDE');
  }

  if (!AVATAR_MIME_PERMITIDOS.has(contentType)) {
    throw new Error('AVATAR_FORMATO_INVALIDO');
  }

  return {
    buffer,
    contentType,
    extension: AVATAR_EXT_POR_MIME[contentType] || 'jpg'
  };
}

function ehErroBucketInexistente(error) {
  const mensagem = String(error?.message || '').toLowerCase();
  return (
    mensagem.includes('specified bucket does not exist') ||
    mensagem.includes('no such bucket') ||
    mensagem.includes('bucket not found')
  );
}

function listarBucketsPossiveis(bucketBase = defaultBucketName) {
  const candidatos = new Set();
  const bucketNormalizado = sanitizeBucketName(bucketBase);

  if (bucketNormalizado) {
    candidatos.add(bucketNormalizado);

    if (bucketNormalizado.endsWith('.appspot.com')) {
      candidatos.add(bucketNormalizado.replace(/\.appspot\.com$/i, '.firebasestorage.app'));
    }

    if (bucketNormalizado.endsWith('.firebasestorage.app')) {
      candidatos.add(bucketNormalizado.replace(/\.firebasestorage\.app$/i, '.appspot.com'));
    }
  }

  if (projectId) {
    candidatos.add(`${projectId}.firebasestorage.app`);
    candidatos.add(`${projectId}.appspot.com`);
  }

  return Array.from(candidatos).filter(Boolean);
}

async function apagarAvatarAnterior(uid, avatarStoragePath, avatarBucketName = defaultBucketName) {
  if (
    !avatarStoragePath ||
    typeof avatarStoragePath !== 'string' ||
    !avatarStoragePath.startsWith(`avatars/${uid}/`)
  ) {
    return;
  }

  try {
    await admin
      .storage()
      .bucket(sanitizeBucketName(avatarBucketName) || defaultBucketName)
      .file(avatarStoragePath)
      .delete({ ignoreNotFound: true });
  } catch (err) {
    console.error('[usuario.service] delete avatar falhou', err.message);
  }
}

function montarAvatarPublicUrl(storagePath, downloadToken, bucketName) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
}

async function salvarAvatarNoBucketValido(storagePath, buffer, metadata) {
  const candidatos = listarBucketsPossiveis(bucket.name);
  let ultimoErro = null;

  for (const bucketName of candidatos) {
    const bucketAtual = admin.storage().bucket(bucketName);
    const arquivo = bucketAtual.file(storagePath);

    try {
      await arquivo.save(buffer, {
        resumable: false,
        metadata
      });

      return {
        bucketAtual,
        arquivo
      };
    } catch (error) {
      if (ehErroBucketInexistente(error)) {
        ultimoErro = error;
        continue;
      }

      throw error;
    }
  }

  const erro = new Error('FIREBASE_STORAGE_BUCKET_INVALIDO');
  erro.details = {
    configurado: bucket.name,
    tentativas: candidatos,
    causa: ultimoErro?.message || null
  };
  throw erro;
}

async function uploadMeuAvatar(user, arquivo) {
  const perfilAtual = (await usuarioRepository.buscarPorId(user.uid)) || { uid: user.uid };
  const { buffer, contentType, extension } = validarArquivoAvatar(arquivo);
  const fileName = `${Date.now()}-avatar.${extension}`;
  const storagePath = `avatars/${user.uid}/${fileName}`;
  const downloadToken = crypto.randomUUID();

  const { bucketAtual } = await salvarAvatarNoBucketValido(storagePath, buffer, {
    contentType,
    cacheControl: 'public,max-age=31536000,immutable',
    metadata: {
      firebaseStorageDownloadTokens: downloadToken,
      ownerUid: user.uid
    }
  });

  const photoURL = montarAvatarPublicUrl(storagePath, downloadToken, bucketAtual.name);

  await usuarioRepository.criarOuAtualizar(user.uid, {
    photoURL,
    avatarStoragePath: storagePath,
    avatarBucket: bucketAtual.name,
    avatarUpdatedEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  });

  try {
    await admin.auth().updateUser(user.uid, { photoURL });
  } catch (err) {
    console.error('[usuario.service] updateUser avatar falhou', err.message);
  }

  await apagarAvatarAnterior(
    user.uid,
    perfilAtual.avatarStoragePath,
    perfilAtual.avatarBucket || bucketAtual.name
  );

  return obterPerfil(user);
}

async function removerMeuAvatar(user) {
  const perfilAtual = (await usuarioRepository.buscarPorId(user.uid)) || { uid: user.uid };

  await apagarAvatarAnterior(user.uid, perfilAtual.avatarStoragePath, perfilAtual.avatarBucket);

  await usuarioRepository.criarOuAtualizar(user.uid, {
    photoURL: null,
    avatarStoragePath: null,
    avatarBucket: null,
    avatarUpdatedEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  });

  try {
    await admin.auth().updateUser(user.uid, { photoURL: null });
  } catch (err) {
    console.error('[usuario.service] remove avatar updateUser falhou', err.message);
  }

  return obterPerfil(user);
}

async function listarEquipe() {
  const membros = await usuarioRepository.listarTodos();
  return membros.map((membro) => sanitizarMembro(membro));
}

async function convidarMembro(adminUser, payload) {
  return conviteService.convidarMembro(adminUser, payload);
}

async function atualizarRole(uid, novoRole) {
  if (!ROLES_VALIDOS.includes(novoRole)) {
    throw new Error('VALIDACAO_FALHOU');
  }

  await usuarioRepository.atualizar(uid, {
    role: novoRole,
    atualizadoEm: new Date().toISOString()
  });

  const doc = await usuarioRepository.buscarPorId(uid);
  return sanitizarMembro(doc || { uid });
}

async function removerMembro(uid, adminUser) {
  if (uid === adminUser.uid) {
    throw new Error('NAO_PODE_REMOVER_A_SI_MESMO');
  }

  await usuarioRepository.desativar(uid);

  try {
    await admin.auth().updateUser(uid, { disabled: true });
  } catch (err) {
    console.error('[usuario.service] disabled=true falhou', err.message);
  }
}

module.exports = {
  obterPerfil,
  atualizarMeuPerfil,
  uploadMeuAvatar,
  removerMeuAvatar,
  listarEquipe,
  convidarMembro,
  atualizarRole,
  removerMembro
};
