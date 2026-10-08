const apontamentoRepository = require('../repositories/apontamento-tempo.repository');
const processoService = require('./processo.service');
const auditoriaService = require('./auditoria.service');
const rentabilidadeProjecaoService = require('./rentabilidade-projecao.service');
const { mesmoTenant } = require('../config/tenant');

const MINUTOS_MAXIMOS = 24 * 60;

function normalizarTexto(valor, tamanhoMaximo, obrigatorio = false) {
  if (valor === undefined || valor === null) {
    if (obrigatorio) throw new Error('VALIDACAO_APONTAMENTO_TEMPO');
    return null;
  }

  if (typeof valor !== 'string') throw new Error('VALIDACAO_APONTAMENTO_TEMPO');
  const texto = valor.trim();
  if (!texto && obrigatorio) throw new Error('VALIDACAO_APONTAMENTO_TEMPO');
  return texto ? texto.slice(0, tamanhoMaximo) : null;
}

function normalizarMinutos(valor) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1 || numero > MINUTOS_MAXIMOS) {
    throw new Error('VALIDACAO_APONTAMENTO_TEMPO');
  }
  return numero;
}

function normalizarData(valor) {
  if (!valor) return new Date().toISOString().slice(0, 10);
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new Error('VALIDACAO_APONTAMENTO_TEMPO');
  }
  const data = new Date(`${valor}T12:00:00`);
  if (Number.isNaN(data.getTime())) throw new Error('VALIDACAO_APONTAMENTO_TEMPO');
  return valor;
}

async function listarPorProcessos(processoIds, user) {
  if (!Array.isArray(processoIds) || processoIds.length === 0) return [];
  const idsPermitidos = new Set(processoIds);
  const apontamentos = await apontamentoRepository.listarTodos();

  return apontamentos
    .filter(
      (apontamento) =>
        !apontamento.deletado &&
        idsPermitidos.has(apontamento.processoId) &&
        mesmoTenant(apontamento, user.tenantId)
    )
    .sort((a, b) => String(b.data || b.criadoEm || '').localeCompare(String(a.data || a.criadoEm || '')));
}

async function listarRecentesPorProcessos(processoIds, user, limite = 20) {
  if (!Array.isArray(processoIds) || processoIds.length === 0) return [];
  const idsPermitidos = new Set(processoIds);
  const apontamentos = await apontamentoRepository.listarRecentesDoTenant(user.tenantId, limite);

  return apontamentos.filter(
    (apontamento) =>
      !apontamento.deletado &&
      idsPermitidos.has(apontamento.processoId) &&
      mesmoTenant(apontamento, user.tenantId)
  );
}

async function criarApontamento(processoId, dados, user) {
  if (user.role === 'CLIENT') throw new Error('ACESSO_NEGADO');

  const processo = await processoService.buscarPorId(processoId, user);
  const agora = new Date().toISOString();
  const apontamento = {
    processoId,
    processoTitulo: processo.titulo || 'Processo sem titulo',
    clienteId: processo.clienteId || null,
    clienteNome: processo.clienteNome || null,
    descricao: normalizarTexto(dados.descricao, 300) || 'Ajuste manual de tempo',
    minutos: normalizarMinutos(dados.minutos),
    data: normalizarData(dados.data),
    origem: 'MANUAL',
    durationSeconds: 0,
    costRateSnapshot: 0,
    deletado: false,
    tenantId: user.tenantId,
    criadoEm: agora,
    criadoPor: user.uid
  };

  apontamento.durationSeconds = apontamento.minutos * 60;
  apontamento.costRateSnapshot = rentabilidadeProjecaoService.resolverCustoHoraSnapshot(dados, processo);

  const id = await rentabilidadeProjecaoService.criarApontamentoComProjecao(apontamento);

  await auditoriaService.registrarEvento({
    acao: 'ADICIONAR_TEMPO_MANUAL',
    entidade: 'PROCESSO',
    entidadeId: processoId,
    usuario: user,
    detalhes: { apontamentoId: id, minutos: apontamento.minutos, descricao: apontamento.descricao }
  });

  return { id, ...apontamento };
}

async function deletarApontamento(id, user) {
  if (user.role === 'CLIENT') throw new Error('ACESSO_NEGADO');

  const apontamento = await apontamentoRepository.buscarPorId(id);
  if (!apontamento || apontamento.deletado || !mesmoTenant(apontamento, user.tenantId)) {
    throw new Error('APONTAMENTO_TEMPO_NAO_ENCONTRADO');
  }

  await processoService.buscarPorId(apontamento.processoId, user);
  await rentabilidadeProjecaoService.deletarApontamentoComProjecao(id, user.tenantId);

  await auditoriaService.registrarEvento({
    acao: 'REMOVER_TEMPO_MANUAL',
    entidade: 'PROCESSO',
    entidadeId: apontamento.processoId,
    usuario: user,
    detalhes: { apontamentoId: id, minutos: apontamento.minutos }
  });
}

async function atualizarApontamento(id, dados, user) {
  if (user.role === 'CLIENT') throw new Error('ACESSO_NEGADO');

  const apontamento = await apontamentoRepository.buscarPorId(id);
  if (!apontamento || apontamento.deletado || !mesmoTenant(apontamento, user.tenantId)) {
    throw new Error('APONTAMENTO_TEMPO_NAO_ENCONTRADO');
  }

  const processo = await processoService.buscarPorId(apontamento.processoId, user);
  const alteracoes = {};

  if (Object.prototype.hasOwnProperty.call(dados, 'minutos')) {
    alteracoes.minutos = normalizarMinutos(dados.minutos);
    alteracoes.durationSeconds = alteracoes.minutos * 60;
  }
  if (Object.prototype.hasOwnProperty.call(dados, 'data')) {
    alteracoes.data = normalizarData(dados.data);
  }
  if (Object.prototype.hasOwnProperty.call(dados, 'descricao')) {
    alteracoes.descricao = normalizarTexto(dados.descricao, 300) || 'Ajuste manual de tempo';
  }
  if (Object.prototype.hasOwnProperty.call(dados, 'custoHora')) {
    alteracoes.costRateSnapshot = rentabilidadeProjecaoService.resolverCustoHoraSnapshot(dados, processo);
  }

  if (!Object.keys(alteracoes).length) throw new Error('VALIDACAO_APONTAMENTO_TEMPO');

  const atualizado = await rentabilidadeProjecaoService.atualizarApontamentoComProjecao(
    id,
    user.tenantId,
    alteracoes
  );

  await auditoriaService.registrarEvento({
    acao: 'ATUALIZAR_TEMPO_MANUAL',
    entidade: 'PROCESSO',
    entidadeId: apontamento.processoId,
    usuario: user,
    detalhes: {
      apontamentoId: id,
      campos: Object.keys(alteracoes),
      minutosAnterior: apontamento.minutos,
      minutosNovo: atualizado.minutos
    }
  });

  return atualizado;
}

module.exports = {
  listarPorProcessos,
  listarRecentesPorProcessos,
  criarApontamento,
  atualizarApontamento,
  deletarApontamento
};
