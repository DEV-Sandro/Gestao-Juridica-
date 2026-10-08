const crypto = require('crypto');
const compromissoRepository = require('../repositories/compromisso.repository');
const auditoriaService = require('./auditoria.service');
const permissaoService = require('./permissao.service');
const deadlineOrchestrationService = require('./deadline-orchestration.service');
const { mesmoTenant } = require('../config/tenant');
const { tenantAtual } = require('../config/tenant-context');

const TIPOS_PERMITIDOS = new Set(['AUDIENCIA', 'PRAZO', 'REUNIAO', 'EVENTO', 'OUTRO']);
const STATUS_PERMITIDOS = new Set(['PENDENTE', 'CONCLUIDO', 'CANCELADO']);
const VISIBILIDADE_PERMITIDA = new Set(['PUBLICO', 'RESTRITO']);
const FREQUENCIAS_RECURRENCIA = new Set(['SEMANAL', 'QUINZENAL', 'MENSAL']);
const CANAIS_LEMBRETE = new Set(['EMAIL', 'WHATSAPP']);
const MAX_OCORRENCIAS_RECURRENCIA = 52;

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

function normalizarRecorrencia(valor) {
  if (valor === undefined) return undefined;
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;

  const frequencia = String(valor.frequencia || '').trim().toUpperCase();
  if (!FREQUENCIAS_RECURRENCIA.has(frequencia)) return null;

  const totalInformado = Number(valor.total);
  const total = Number.isInteger(totalInformado)
    ? Math.min(Math.max(totalInformado, 2), MAX_OCORRENCIAS_RECURRENCIA)
    : 4;
  const ate = typeof valor.ate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor.ate)
    ? valor.ate
    : null;

  return { frequencia, total, ate };
}

function normalizarLembretes(valor) {
  if (valor === undefined) return undefined;
  if (!Array.isArray(valor)) return [];

  const vistos = new Set();
  const lembretes = [];
  for (const item of valor) {
    if (!item || typeof item !== 'object') continue;
    const canal = String(item.canal || '').trim().toUpperCase();
    const minutosAntes = Number(item.minutosAntes);
    if (!CANAIS_LEMBRETE.has(canal) || !Number.isInteger(minutosAntes) || minutosAntes < 5 || minutosAntes > 43200) {
      continue;
    }

    const chave = `${canal}:${minutosAntes}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    lembretes.push({ canal, minutosAntes });
  }

  return lembretes.slice(0, 6);
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

  const recorrencia = normalizarRecorrencia(dados.recorrencia);
  if (recorrencia !== undefined) payload.recorrencia = recorrencia;

  const lembretes = normalizarLembretes(dados.lembretes);
  if (lembretes !== undefined) payload.lembretes = lembretes;

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
    if (payload.recorrencia === undefined) payload.recorrencia = null;
    if (!payload.lembretes) payload.lembretes = [];
    if (!payload.dataFim) payload.dataFim = payload.dataInicio;
  }

  const inicioFinal = payload.dataInicio ?? atual?.dataInicio;
  const fimFinal = payload.dataFim ?? atual?.dataFim ?? inicioFinal;
  if (inicioFinal && fimFinal && new Date(fimFinal).getTime() < new Date(inicioFinal).getTime()) {
    throw new Error('VALIDACAO_FALHOU');
  }

  return payload;
}

function adicionarRecorrencia(data, frequencia, indice) {
  const proxima = new Date(data);
  if (frequencia === 'MENSAL') {
    proxima.setUTCMonth(proxima.getUTCMonth() + indice);
  } else {
    proxima.setUTCDate(proxima.getUTCDate() + (frequencia === 'QUINZENAL' ? 14 : 7) * indice);
  }
  return proxima;
}

function gerarOcorrencias(payload) {
  const recorrencia = payload.recorrencia;
  if (!recorrencia?.frequencia) {
    return [{ ...payload, recorrencia: null, serieId: null }];
  }

  const inicioBase = new Date(payload.dataInicio);
  const fimBase = new Date(payload.dataFim);
  const duracao = fimBase.getTime() - inicioBase.getTime();
  const limite = recorrencia.ate ? new Date(`${recorrencia.ate}T23:59:59.999Z`).getTime() : null;
  const serieId = crypto.randomUUID();
  const ocorrencias = [];

  for (let indice = 0; indice < recorrencia.total; indice += 1) {
    const inicio = adicionarRecorrencia(inicioBase, recorrencia.frequencia, indice);
    if (limite && inicio.getTime() > limite) break;
    const fim = new Date(inicio.getTime() + duracao);
    ocorrencias.push({
      ...payload,
      dataInicio: inicio.toISOString(),
      dataFim: fim.toISOString(),
      diaISO: inicio.toISOString().slice(0, 10),
      serieId,
      recorrencia: {
        frequencia: recorrencia.frequencia,
        total: recorrencia.total,
        ate: recorrencia.ate,
        indice: indice + 1
      }
    });
  }

  return ocorrencias;
}

function sobrepoe(inicioA, fimA, inicioB, fimB) {
  return new Date(inicioA).getTime() < new Date(fimB).getTime() &&
    new Date(inicioB).getTime() < new Date(fimA).getTime();
}

async function detectarConflitos(envolvidos, dataInicio, dataFim, ignorarId = null) {
  const ids = [...new Set((Array.isArray(envolvidos) ? envolvidos : [envolvidos]).filter(Boolean))];
  if (!ids.length) return [];
  const existentes = await compromissoRepository.buscarTodos();

  return existentes.filter(
    (compromisso) =>
      compromisso.id !== ignorarId &&
      !compromisso.deletado &&
      compromisso.status !== 'CANCELADO' &&
      (ids.includes(compromisso.advogadoId) || compromisso.participantesIds?.some((id) => ids.includes(id))) &&
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

function mesmoConjunto(a = [], b = []) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

function precisaRenovarCiencia(atual, proximo) {
  return (
    atual.dataInicio !== proximo.dataInicio ||
    atual.advogadoId !== proximo.advogadoId ||
    !mesmoConjunto(atual.participantesIds || [], proximo.participantesIds || []) ||
    atual.status !== proximo.status ||
    atual.tipo !== proximo.tipo
  );
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

  if (!mesmoTenant(compromisso, user.tenantId)) {
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
  payload.participantesIds = (payload.participantesIds || []).filter((id) => id !== payload.advogadoId);

  const ocorrencias = gerarOcorrencias(payload);
  const envolvidos = [payload.advogadoId, ...payload.participantesIds];
  const conflitosPorId = new Map();
  for (const ocorrencia of ocorrencias) {
    const conflitosOcorrencia = await detectarConflitos(envolvidos, ocorrencia.dataInicio, ocorrencia.dataFim);
    conflitosOcorrencia.forEach((conflito) => conflitosPorId.set(conflito.id, conflito));
  }
  const conflitos = [...conflitosPorId.values()];

  const agora = new Date().toISOString();
  const novos = ocorrencias.map((ocorrencia) => {
    const novo = {
      ...ocorrencia,
      deletado: false,
      tenantId: user.tenantId,
      criadoEm: agora,
      criadoPor: user.uid,
      atualizadoEm: agora,
      atualizadoPor: user.uid,
      lembretesEnviados: [],
      deadlineAcknowledgedAt: null,
      deadlineAcknowledgedBy: null,
      deadlineAcknowledgedByName: null
    };

    return {
      ...novo,
      deadlineRiskLevel: deadlineOrchestrationService.riscoDoPrazo(novo)
    };
  });

  const ids = await compromissoRepository.criarVarios(novos);

  const resultadosOrquestracao = await Promise.allSettled(
    novos.map((compromisso, indice) =>
      deadlineOrchestrationService.orquestrarPrazo({ ...compromisso, id: ids[indice] })
    )
  );
  resultadosOrquestracao
    .filter((resultado) => resultado.status === 'rejected')
    .forEach((resultado) => console.error('[compromisso] falha na orquestracao de prazo', resultado.reason?.message));

  await auditoriaService.registrarEvento({
    acao: 'CRIAR',
    entidade: 'COMPROMISSO',
    entidadeId: ids[0],
    usuario: user,
    detalhes: {
      titulo: payload.titulo,
      advogadoId: payload.advogadoId,
      participantes: payload.participantesIds.length,
      ocorrenciasCriadas: ids.length,
      recorrencia: payload.recorrencia?.frequencia || null,
      conflitos: conflitos.length
    }
  });

  return { id: ids[0], ids, ocorrenciasCriadas: ids.length, conflitos: resumirConflitos(conflitos) };
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
  const participantesFinais = payload.participantesIds ?? atual.participantesIds ?? [];
  const conflitos = await detectarConflitos(
    [atual.advogadoId, ...participantesFinais],
    dataInicioFinal,
    dataFimFinal,
    id
  );

  const payloadPersistencia = {
    ...payload,
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: user.uid
  };

  const proximo = { ...atual, ...payloadPersistencia };
  if (proximo.tipo === 'PRAZO' && proximo.status === 'PENDENTE') {
    payloadPersistencia.deadlineRiskLevel = deadlineOrchestrationService.riscoDoPrazo(proximo);
    if (precisaRenovarCiencia(atual, proximo)) {
      payloadPersistencia.deadlineAcknowledgedAt = null;
      payloadPersistencia.deadlineAcknowledgedBy = null;
      payloadPersistencia.deadlineAcknowledgedByName = null;
      payloadPersistencia.deadlineActions = {};
    }
  } else {
    payloadPersistencia.deadlineRiskLevel = 'normal';
  }

  await compromissoRepository.atualizar(id, payloadPersistencia);
  try {
    await deadlineOrchestrationService.orquestrarPrazo({ ...atual, ...payloadPersistencia, id });
  } catch (error) {
    console.error('[compromisso] falha na reorquestracao de prazo', id, error.message);
  }

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

async function confirmarCienciaPrazo(id, dados, user) {
  const atual = await obterComAcesso(id, user);
  if (!deadlineOrchestrationService.prazoEstaAberto(atual)) {
    throw new Error('PRAZO_NAO_DISPONIVEL_PARA_CIENCIA');
  }

  const ciente = dados?.ciente !== false;
  const agora = new Date().toISOString();
  const atualizacao = ciente
    ? {
        deadlineAcknowledgedAt: agora,
        deadlineAcknowledgedBy: user.uid,
        deadlineAcknowledgedByName: user.displayName || user.email || 'Membro da equipe'
      }
    : {
        deadlineAcknowledgedAt: null,
        deadlineAcknowledgedBy: null,
        deadlineAcknowledgedByName: null
      };

  await compromissoRepository.atualizar(id, { ...atualizacao, atualizadoEm: agora, atualizadoPor: user.uid });
  await auditoriaService.registrarEvento({
    acao: ciente ? 'CONFIRMAR_CIENCIA_PRAZO' : 'REVOGAR_CIENCIA_PRAZO',
    entidade: 'COMPROMISSO',
    entidadeId: id,
    usuario: user,
    detalhes: { titulo: atual.titulo, dataInicio: atual.dataInicio }
  });

  return { id, ciente, ...atualizacao };
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
      if (!mesmoTenant(compromisso, user.tenantId)) return false;
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
  confirmarCienciaPrazo,
  obterComAcesso,
  listarAgenda,
  detectarConflitos
};
