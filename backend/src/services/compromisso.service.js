const compromissoRepository = require('../repositories/compromisso.repository');
const auditoriaService = require('./auditoria.service');
const permissaoService = require('./permissao.service');

const TIPOS_PERMITIDOS = new Set(['AUDIENCIA', 'PRAZO', 'REUNIAO', 'EVENTO', 'OUTRO']);
const STATUS_PERMITIDOS = new Set(['PENDENTE', 'CONCLUIDO', 'CANCELADO']);
const VISIBILIDADE_PERMITIDA = new Set(['PUBLICO', 'RESTRITO']);

function normalizarTexto(valor, tamanhoMaximo, obrigatorio = false) {
  if (valor === undefined) return undefined;

  if (valor === null) {
    if (obrigatorio) throw new Error('VALIDACAO_FALHOU');
    return null;
  }

  if (typeof valor !== 'string') {
    throw new Error('VALIDACAO_FALHOU');
  }

  const texto = valor.trim();
  if (!texto) {
    if (obrigatorio) throw new Error('VALIDACAO_FALHOU');
    return null;
  }

  return texto.slice(0, tamanhoMaximo);
}

function normalizarEnum(valor, permitidos, fallback) {
  if (valor === undefined) return undefined;
  const normalizado = String(valor || '').trim().toUpperCase();
  return permitidos.has(normalizado) ? normalizado : fallback;
}

function normalizarDataHora(valor) {
  if (valor === undefined) return undefined;
  if (valor === null) return null;

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) {
    throw new Error('VALIDACAO_FALHOU');
  }

  return data.toISOString();
}

function montarPayload(dados, atual = null) {
  const payload = {};

  const titulo = normalizarTexto(dados.titulo, 160);
  if (titulo !== undefined) payload.titulo = titulo;

  const tipo = normalizarEnum(dados.tipo, TIPOS_PERMITIDOS, 'EVENTO');
  if (tipo !== undefined) payload.tipo = tipo;

  if (dados.processoId !== undefined) {
    payload.processoId = normalizarTexto(dados.processoId, 120);
  }

  const advogadoId = normalizarTexto(dados.advogadoId, 120);
  if (advogadoId !== undefined) payload.advogadoId = advogadoId;

  if (dados.participantesIds !== undefined) {
    payload.participantesIds = Array.isArray(dados.participantesIds)
      ? [...new Set(dados.participantesIds.filter((id) => typeof id === 'string' && id.trim()))].slice(0, 20)
      : [];
  }

  if (dados.dataInicio !== undefined) {
    payload.dataInicio = normalizarDataHora(dados.dataInicio);
    if (payload.dataInicio) payload.diaISO = payload.dataInicio.slice(0, 10);
  }

  if (dados.dataFim !== undefined) {
    payload.dataFim = normalizarDataHora(dados.dataFim);
  }

  if (dados.diaTodo !== undefined) payload.diaTodo = dados.diaTodo === true;

  const local = normalizarTexto(dados.local, 160);
  if (local !== undefined) payload.local = local;

  const observacao = normalizarTexto(dados.observacao, 2000);
  if (observacao !== undefined) payload.observacao = observacao;

  const status = normalizarEnum(dados.status, STATUS_PERMITIDOS, 'PENDENTE');
  if (status !== undefined) payload.status = status;

  const visibilidade = normalizarEnum(dados.visibilidade, VISIBILIDADE_PERMITIDA, 'PUBLICO');
  if (visibilidade !== undefined) payload.visibilidade = visibilidade;

  if (!atual) {
    if (!payload.titulo) throw new Error('VALIDACAO_FALHOU');
    if (!payload.dataInicio) throw new Error('VALIDACAO_FALHOU');
    if (!payload.tipo) payload.tipo = 'EVENTO';
    if (!payload.status) payload.status = 'PENDENTE';
    if (!payload.visibilidade) payload.visibilidade = 'PUBLICO';
    if (payload.diaTodo === undefined) payload.diaTodo = false;
    if (!payload.participantesIds) payload.participantesIds = [];
    if (!payload.dataFim) payload.dataFim = payload.dataInicio;
  }

  const inicioFinal = payload.dataInicio ?? atual?.dataInicio;
  const fimFinal = payload.dataFim ?? atual?.dataFim ?? inicioFinal;
  if (inicioFinal && fimFinal && new Date(fimFinal).getTime() < new Date(inicioFinal).getTime()) {
    throw new Error('VALIDACAO_FALHOU');
  }

  return payload;
}

function sobrepoe(inicioA, fimA, inicioB, fimB) {
  return new Date(inicioA).getTime() < new Date(fimB).getTime() &&
    new Date(inicioB).getTime() < new Date(fimA).getTime();
}

async function detectarConflitos(advogadoId, dataInicio, dataFim, ignorarId = null) {
  const existentes = await compromissoRepository.buscarPorAdvogados([advogadoId]);

  return existentes.filter(
    (compromisso) =>
      compromisso.id !== ignorarId &&
      !compromisso.deletado &&
      compromisso.status !== 'CANCELADO' &&
      sobrepoe(dataInicio, dataFim, compromisso.dataInicio, compromisso.dataFim)
  );
}

function resumirConflitos(conflitos) {
  return conflitos.map((conflito) => ({
    id: conflito.id,
    titulo: conflito.titulo,
    dataInicio: conflito.dataInicio,
    dataFim: conflito.dataFim
  }));
}

function podeAcessar(compromisso, user) {
  if (user.role === 'ADMIN') return true;
  if (compromisso.advogadoId === user.uid) return true;
  if (compromisso.participantesIds?.includes(user.uid)) return true;
  return (
    permissaoService.possuiPermissao(user, 'agendaVerColegas') && compromisso.visibilidade !== 'RESTRITO'
  );
}

async function obterComAcesso(id, user) {
  const compromisso = await compromissoRepository.buscarPorId(id);
  if (!compromisso || compromisso.deletado) {
    throw new Error('COMPROMISSO_NAO_ENCONTRADO');
  }

  if (!podeAcessar(compromisso, user)) {
    throw new Error('ACESSO_NEGADO');
  }

  return compromisso;
}

async function criarCompromisso(dados, user) {
  const payload = montarPayload(dados);
  if (!payload.advogadoId) payload.advogadoId = user.uid;

  const conflitos = await detectarConflitos(payload.advogadoId, payload.dataInicio, payload.dataFim);

  const agora = new Date().toISOString();
  const novo = {
    ...payload,
    deletado: false,
    criadoEm: agora,
    criadoPor: user.uid,
    atualizadoEm: agora,
    atualizadoPor: user.uid
  };

  const id = await compromissoRepository.criar(novo);

  await auditoriaService.registrarEvento({
    acao: 'CRIAR',
    entidade: 'COMPROMISSO',
    entidadeId: id,
    usuario: user,
    detalhes: {
      titulo: novo.titulo,
      advogadoId: novo.advogadoId,
      conflitos: conflitos.length
    }
  });

  return { id, conflitos: resumirConflitos(conflitos) };
}

async function atualizarCompromisso(id, dados, user) {
  const atual = await obterComAcesso(id, user);
  if (user.role !== 'ADMIN' && atual.advogadoId !== user.uid) {
    throw new Error('ACESSO_NEGADO');
  }

  const payload = montarPayload(dados, atual);
  const camposAtualizados = Object.keys(payload);

  if (!camposAtualizados.length) {
    throw new Error('VALIDACAO_FALHOU');
  }

  const dataInicioFinal = payload.dataInicio ?? atual.dataInicio;
  const dataFimFinal = payload.dataFim ?? atual.dataFim;
  const conflitos = await detectarConflitos(atual.advogadoId, dataInicioFinal, dataFimFinal, id);

  const payloadPersistencia = {
    ...payload,
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: user.uid
  };

  await compromissoRepository.atualizar(id, payloadPersistencia);

  await auditoriaService.registrarEvento({
    acao: 'ATUALIZAR',
    entidade: 'COMPROMISSO',
    entidadeId: id,
    usuario: user,
    detalhes: {
      camposAtualizados,
      conflitos: conflitos.length
    }
  });

  return { conflitos: resumirConflitos(conflitos) };
}

async function deletarCompromisso(id, user) {
  const atual = await obterComAcesso(id, user);
  if (user.role !== 'ADMIN' && atual.advogadoId !== user.uid) {
    throw new Error('ACESSO_NEGADO');
  }

  await compromissoRepository.deletarSoft(id, {
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: user.uid
  });

  await auditoriaService.registrarEvento({
    acao: 'DELETAR_SOFT',
    entidade: 'COMPROMISSO',
    entidadeId: id,
    usuario: user,
    detalhes: { titulo: atual.titulo }
  });
}

function redigirCompromisso(compromisso, user) {
  const ehDono = compromisso.advogadoId === user.uid || user.role === 'ADMIN';
  const podeVerDetalhes =
    ehDono ||
    (permissaoService.possuiPermissao(user, 'agendaVerDetalhesColegas') && compromisso.visibilidade !== 'RESTRITO');

  if (podeVerDetalhes) {
    return compromisso;
  }

  // Bloco "ocupado" sem detalhes — a redacao acontece aqui no backend (nunca no
  // front, que so recebe o que ja deveria poder ver), mesmo padrao usado em
  // sanitizarMembro() para o perfil de usuario.
  return {
    id: compromisso.id,
    advogadoId: compromisso.advogadoId,
    dataInicio: compromisso.dataInicio,
    dataFim: compromisso.dataFim,
    diaTodo: compromisso.diaTodo,
    tipo: compromisso.tipo,
    status: compromisso.status,
    titulo: 'Ocupado',
    local: null,
    observacao: null,
    processoId: null,
    participantesIds: [],
    restrito: true
  };
}

// GET /api/agenda — 'individual' mostra a agenda de um unico advogado (o
// proprio por padrao, ou outro se o requisitante tiver permissao/for ADMIN);
// 'todas'/'consolidada' agregam todo o escritorio (ADMIN, ou advogado com
// agendaVerColegas). Datas (de/ate) sao filtradas em memoria — ver nota em
// compromisso.repository.js#buscarPorAdvogados sobre indices compostos.
async function listarAgenda({ modo = 'individual', advogadoId, de, ate } = {}, user) {
  const podeVerColegas = user.role === 'ADMIN' || permissaoService.possuiPermissao(user, 'agendaVerColegas');

  let compromissos;

  if (modo === 'todas' || modo === 'consolidada') {
    if (!podeVerColegas) {
      throw new Error('ACESSO_NEGADO');
    }

    compromissos = advogadoId
      ? await compromissoRepository.buscarPorAdvogados([advogadoId])
      : await compromissoRepository.buscarTodos();
  } else {
    const alvo = advogadoId || user.uid;
    if (alvo !== user.uid && !podeVerColegas) {
      throw new Error('ACESSO_NEGADO');
    }

    compromissos = await compromissoRepository.buscarPorAdvogados([alvo]);
  }

  return compromissos
    .filter((compromisso) => {
      if (compromisso.deletado) return false;
      if (de && compromisso.dataFim && compromisso.dataFim < de) return false;
      if (ate && compromisso.dataInicio && compromisso.dataInicio > ate) return false;
      return true;
    })
    .map((compromisso) => redigirCompromisso(compromisso, user))
    .sort((a, b) => String(a.dataInicio || '').localeCompare(String(b.dataInicio || '')));
}

module.exports = {
  criarCompromisso,
  atualizarCompromisso,
  deletarCompromisso,
  obterComAcesso,
  listarAgenda,
  detectarConflitos
};
