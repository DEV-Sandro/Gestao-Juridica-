const crypto = require('crypto');
const { z } = require('zod');
const { admin } = require('../config/firebase');
const conviteRepository = require('../repositories/convite.repository');
const usuarioRepository = require('../repositories/usuario.repository');

const ROLES_VALIDOS = ['ADMIN', 'ADVOGADO', 'CLIENT'];
const STATUS_CONVITE = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED'
};
const EXPIRACAO_PADRAO_MS = 7 * 24 * 60 * 60 * 1000;

const schemaConvite = z.object({
  email: z.string().trim().email('Informe um e-mail valido.'),
  displayName: z.string().trim().min(2, 'Informe o nome do membro.').max(120),
  role: z.string().trim().optional(),
  cargo: z.string().trim().max(80).optional().nullable(),
  oab: z.string().trim().max(40).optional().nullable()
});

const schemaAceite = z.object({
  token: z.string().trim().min(20, 'Convite invalido.'),
  password: z
    .string()
    .min(8, 'A senha deve ter pelo menos 8 caracteres.')
    .regex(/[A-Z]/, 'A senha deve ter uma letra maiuscula.')
    .regex(/[a-z]/, 'A senha deve ter uma letra minuscula.')
    .regex(/\d/, 'A senha deve ter um numero.')
    .regex(/[^A-Za-z0-9]/, 'A senha deve ter um caractere especial.'),
  displayName: z.string().trim().min(2, 'Informe seu nome.').max(120),
  telefone: z.string().trim().max(32).optional().nullable(),
  cargo: z.string().trim().max(80).optional().nullable(),
  oab: z.string().trim().max(40).optional().nullable()
});

function normalizarEmail(email) {
  return email.trim().toLowerCase();
}

function gerarTokenSeguro() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

function calcularStatusConvite(convite) {
  if (!convite) {
    return 'INVALID';
  }

  if (convite.status === STATUS_CONVITE.ACCEPTED) {
    return STATUS_CONVITE.ACCEPTED;
  }

  if (convite.status === STATUS_CONVITE.REVOKED) {
    return STATUS_CONVITE.REVOKED;
  }

  if (new Date(convite.expiresAt).getTime() < Date.now()) {
    return STATUS_CONVITE.EXPIRED;
  }

  return STATUS_CONVITE.PENDING;
}

function montarResumoConvite(convite) {
  const status = calcularStatusConvite(convite);
  return {
    status,
    email: convite.email,
    displayName: convite.displayName,
    role: convite.role,
    cargo: convite.cargo || null,
    oab: convite.oab || null,
    expiresAt: convite.expiresAt,
    canAccept: status === STATUS_CONVITE.PENDING
  };
}

async function marcarConvitesAntigosComoRevogados(email) {
  const existentes = await conviteRepository.listarPorEmail(email);
  const atualizacoes = existentes
    .filter((convite) => calcularStatusConvite(convite) === STATUS_CONVITE.PENDING)
    .map((convite) =>
      conviteRepository.atualizar(convite.id, {
        status: STATUS_CONVITE.REVOKED,
        atualizadoEm: new Date().toISOString()
      })
    );

  if (atualizacoes.length > 0) {
    await Promise.all(atualizacoes);
  }
}

async function convidarMembro(adminUser, payload) {
  const validado = schemaConvite.safeParse(payload);
  if (!validado.success) {
    const erro = new Error('VALIDACAO_CONVITE');
    erro.details = validado.error.issues.map((issue) => issue.message);
    throw erro;
  }

  const email = normalizarEmail(validado.data.email);
  const role = ROLES_VALIDOS.includes(validado.data.role || '') ? validado.data.role : 'ADVOGADO';

  try {
    const usuarioExistente = await admin.auth().getUserByEmail(email);
    if (usuarioExistente && !usuarioExistente.disabled) {
      throw new Error('EMAIL_JA_EXISTE');
    }
  } catch (err) {
    if (err.message === 'EMAIL_JA_EXISTE') {
      throw err;
    }

    if (err.code !== 'auth/user-not-found') {
      throw err;
    }
  }

  await marcarConvitesAntigosComoRevogados(email);

  const { token, tokenHash } = gerarTokenSeguro();
  const agora = new Date();
  const expiresAt = new Date(agora.getTime() + EXPIRACAO_PADRAO_MS).toISOString();
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

  await conviteRepository.criar(tokenHash, {
    email,
    displayName: validado.data.displayName.trim(),
    role,
    cargo: validado.data.cargo?.trim() || null,
    oab: validado.data.oab?.trim() || null,
    status: STATUS_CONVITE.PENDING,
    criadoEm: agora.toISOString(),
    atualizadoEm: agora.toISOString(),
    expiresAt,
    convidadoPor: adminUser.uid
  });

  return {
    mensagem: 'Convite criado com sucesso.',
    email,
    acceptUrl: `${baseUrl}/convite/aceitar?token=${token}`,
    expiresAt
  };
}

async function verificarConvitePorToken(token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const convite = await conviteRepository.buscarPorTokenHash(tokenHash);

  if (!convite) {
    throw new Error('CONVITE_INVALIDO');
  }

  const status = calcularStatusConvite(convite);

  if (status === STATUS_CONVITE.EXPIRED && convite.status !== STATUS_CONVITE.EXPIRED) {
    await conviteRepository.atualizar(tokenHash, {
      status: STATUS_CONVITE.EXPIRED,
      atualizadoEm: new Date().toISOString()
    });
  }

  return montarResumoConvite({
    ...convite,
    status
  });
}

async function verificarConvitePorEmail(email) {
  const convites = await conviteRepository.listarPorEmail(normalizarEmail(email));
  const conviteAtivo =
    convites.find((convite) => calcularStatusConvite(convite) === STATUS_CONVITE.PENDING) ||
    convites.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())[0];

  if (!conviteAtivo) {
    return { status: 'NOT_FOUND', hasInvite: false };
  }

  return {
    ...montarResumoConvite(conviteAtivo),
    hasInvite: true
  };
}

async function aceitarConvite(payload) {
  const validado = schemaAceite.safeParse(payload);
  if (!validado.success) {
    const erro = new Error('VALIDACAO_CONVITE');
    erro.details = validado.error.issues.map((issue) => issue.message);
    throw erro;
  }

  const tokenHash = crypto.createHash('sha256').update(validado.data.token).digest('hex');
  const convite = await conviteRepository.buscarPorTokenHash(tokenHash);

  if (!convite) {
    throw new Error('CONVITE_INVALIDO');
  }

  const status = calcularStatusConvite(convite);
  if (status === STATUS_CONVITE.EXPIRED) {
    await conviteRepository.atualizar(tokenHash, {
      status: STATUS_CONVITE.EXPIRED,
      atualizadoEm: new Date().toISOString()
    });
    throw new Error('CONVITE_EXPIRADO');
  }

  if (status === STATUS_CONVITE.ACCEPTED) {
    throw new Error('CONVITE_JA_UTILIZADO');
  }

  if (status === STATUS_CONVITE.REVOKED) {
    throw new Error('CONVITE_INVALIDO');
  }

  const email = convite.email;
  const displayName = validado.data.displayName.trim();
  const telefone = validado.data.telefone?.trim() || null;
  const cargo = validado.data.cargo?.trim() || convite.cargo || null;
  const oab = validado.data.oab?.trim() || convite.oab || null;

  let authUser = null;

  try {
    authUser = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(authUser.uid, {
      password: validado.data.password,
      displayName,
      disabled: false
    });
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      authUser = await admin.auth().createUser({
        email,
        password: validado.data.password,
        displayName,
        emailVerified: true,
        disabled: false
      });
    } else {
      throw err;
    }
  }

  const perfilExistente = await usuarioRepository.buscarPorId(authUser.uid);
  const agora = new Date().toISOString();

  await usuarioRepository.criarOuAtualizar(authUser.uid, {
    email,
    displayName,
    role: convite.role || 'ADVOGADO',
    telefone,
    cargo,
    oab,
    ativo: true,
    criadoEm: perfilExistente?.criadoEm || agora,
    atualizadoEm: agora,
    conviteAceitoEm: agora
  });

  await conviteRepository.atualizar(tokenHash, {
    status: STATUS_CONVITE.ACCEPTED,
    atualizadoEm: agora,
    usedAt: agora,
    usedByUid: authUser.uid
  });

  return {
    mensagem: 'Convite aceito com sucesso.',
    email,
    displayName
  };
}

module.exports = {
  convidarMembro,
  verificarConvitePorToken,
  verificarConvitePorEmail,
  aceitarConvite
};
