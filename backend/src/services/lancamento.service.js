const lancamentoRepository = require('../repositories/lancamento.repository');
const processoRepository = require('../repositories/processo.repository');
const auditoriaService = require('./auditoria.service');

const TIPOS_PERMITIDOS = new Set(['HONORARIO', 'DESPESA', 'REEMBOLSO']);
const STATUS_PERMITIDOS = new Set(['PENDENTE', 'PAGO', 'CANCELADO']);
const MAX_PARCELAS = 60;

function normalizarTexto(valor, tamanhoMaximo, obrigatorio = false) {
  if (valor === undefined) return undefined;

  if (valor === null) {
    if (obrigatorio) throw new Error('VALIDACAO_LANCAMENTO');
    return null;
  }

  if (typeof valor !== 'string') throw new Error('VALIDACAO_LANCAMENTO');

  const texto = valor.trim();
  if (!texto) {
    if (obrigatorio) throw new Error('VALIDACAO_LANCAMENTO');
    return null;
  }

  return texto.slice(0, tamanhoMaximo);
}

// Aceita numero ou string em formato brasileiro ("4.500,00"), igual ao que ja e
// usado no orcamento do processo — mantem a entrada consistente no sistema todo.
function normalizarValor(valor) {
  if (valor === undefined) return undefined;
  if (valor === null || valor === '') return null;

  if (typeof valor === 'number' && Number.isFinite(valor)) {
    if (valor < 0) throw new Error('VALIDACAO_LANCAMENTO');
    return Number(valor.toFixed(2));
  }

  if (typeof valor === 'string') {
    const normalizado = valor
      .trim()
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^0-9.-]/g, '');

    const numero = Number(normalizado);
    if (Number.isNaN(numero) || numero < 0) throw new Error('VALIDACAO_LANCAMENTO');
    return Number(numero.toFixed(2));
  }

  throw new Error('VALIDACAO_LANCAMENTO');
}

function normalizarData(valor) {
  if (valor === undefined) return undefined;
  if (valor === null || valor === '') return null;

  if (typeof valor === 'string') {
    const match = valor.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) throw new Error('VALIDACAO_LANCAMENTO');
  return data.toISOString().slice(0, 10);
}

function hojeISO() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = `${agora.getMonth() + 1}`.padStart(2, '0');
  const dia = `${agora.getDate()}`.padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// "ATRASADO" nao e um status gravado: e derivado do vencimento a cada leitura,
// exatamente como a Data Fatal dos prazos. Assim nunca fica desatualizado e nao
// depende de nenhuma rotina agendada.
function calcularStatusEfetivo(lancamento) {
  if (lancamento.status === 'PAGO' || lancamento.status === 'CANCELADO') {
    return lancamento.status;
  }

  if (lancamento.vencimento && lancamento.vencimento < hojeISO()) {
    return 'ATRASADO';
  }

  return 'PENDENTE';
}

function montarResposta(lancamento) {
  return {
    ...lancamento,
    statusEfetivo: calcularStatusEfetivo(lancamento)
  };
}

function adicionarMeses(dataISO, meses) {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  // Dia 0 do mes seguinte = ultimo dia do mes alvo; evita "31/01 + 1 mes = 03/03".
  const ultimoDiaDoMesAlvo = new Date(ano, mes - 1 + meses + 1, 0).getDate();
  const data = new Date(ano, mes - 1 + meses, Math.min(dia, ultimoDiaDoMesAlvo));

  const a = data.getFullYear();
  const m = `${data.getMonth() + 1}`.padStart(2, '0');
  const d = `${data.getDate()}`.padStart(2, '0');
  return `${a}-${m}-${d}`;
}

function montarPayload(dados, atual = null) {
  const payload = {};

  const descricao = normalizarTexto(dados.descricao, 200);
  if (descricao !== undefined) payload.descricao = descricao;

  if (dados.tipo !== undefined) {
    const tipo = String(dados.tipo || '').trim().toUpperCase();
    payload.tipo = TIPOS_PERMITIDOS.has(tipo) ? tipo : 'HONORARIO';
  }

  const valor = normalizarValor(dados.valor);
  if (valor !== undefined) payload.valor = valor;

  const vencimento = normalizarData(dados.vencimento);
  if (vencimento !== undefined) payload.vencimento = vencimento;

  if (dados.status !== undefined) {
    const status = String(dados.status || '').trim().toUpperCase();
    if (!STATUS_PERMITIDOS.has(status)) throw new Error('VALIDACAO_LANCAMENTO');
    payload.status = status;
  }

  const observacao = normalizarTexto(dados.observacao, 1000);
  if (observacao !== undefined) payload.observacao = observacao;

  const formaPagamento = normalizarTexto(dados.formaPagamento, 60);
  if (formaPagamento !== undefined) payload.formaPagamento = formaPagamento;

  const processoId = normalizarTexto(dados.processoId, 120);
  if (processoId !== undefined) payload.processoId = processoId;

  if (!atual) {
    if (!payload.descricao) throw new Error('VALIDACAO_LANCAMENTO');
    if (payload.valor === undefined || payload.valor === null) throw new Error('VALIDACAO_LANCAMENTO');
    if (!payload.vencimento) throw new Error('VALIDACAO_LANCAMENTO');
    if (!payload.tipo) payload.tipo = 'HONORARIO';
    if (!payload.status) payload.status = 'PENDENTE';
  }

  return payload;
}

function podeAcessar(lancamento, user) {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'CLIENT') return lancamento.clienteId === user.uid;
  // ADVOGADO: mesma regra dos processos — ve o que e seu; lancamento sem dono
  // definido (legado) permanece visivel para nao sumir da operacao.
  return !lancamento.advogadoId || lancamento.advogadoId === user.uid;
}

async function obterComAcesso(id, user) {
  const lancamento = await lancamentoRepository.buscarPorId(id);
  if (!lancamento || lancamento.deletado) throw new Error('LANCAMENTO_NAO_ENCONTRADO');
  if (!podeAcessar(lancamento, user)) throw new Error('ACESSO_NEGADO');
  return lancamento;
}

// Herda cliente/advogado do processo vinculado, mantendo o padrao de
// desnormalizacao ja usado no projeto (clienteNome dentro do processo).
async function resolverVinculoProcesso(processoId) {
  if (!processoId) return {};

  const processo = await processoRepository.buscarPorId(processoId);
  if (!processo || processo.deletado) return {};

  return {
    clienteId: processo.clienteId || null,
    clienteNome: processo.clienteNome || null,
    advogadoId: processo.advogadoId || null,
    processoTitulo: processo.titulo || null
  };
}

async function listarLancamentos(query, user) {
  const filtros = {
    processoId: query.processoId || undefined,
    status: query.status || undefined
  };

  if (user.role === 'CLIENT') {
    filtros.clienteId = user.uid;
  }

  const lancamentos = await lancamentoRepository.buscar(filtros);

  return lancamentos
    .filter((lancamento) => {
      if (lancamento.deletado) return false;
      if (!podeAcessar(lancamento, user)) return false;
      if (query.de && lancamento.vencimento && lancamento.vencimento < query.de) return false;
      if (query.ate && lancamento.vencimento && lancamento.vencimento > query.ate) return false;
      return true;
    })
    .map(montarResposta)
    .filter((lancamento) => !query.statusEfetivo || lancamento.statusEfetivo === query.statusEfetivo)
    .sort((a, b) => String(a.vencimento || '').localeCompare(String(b.vencimento || '')));
}

async function criarLancamento(dados, user) {
  if (user.role === 'CLIENT') throw new Error('ACESSO_NEGADO');

  const payload = montarPayload(dados);
  const vinculo = await resolverVinculoProcesso(payload.processoId);

  const totalParcelas = Math.min(Math.max(Number(dados.parcelas) || 1, 1), MAX_PARCELAS);
  const agora = new Date().toISOString();

  const base = {
    ...payload,
    ...vinculo,
    advogadoId: vinculo.advogadoId || user.uid,
    deletado: false,
    criadoEm: agora,
    criadoPor: user.uid,
    atualizadoEm: agora,
    atualizadoPor: user.uid
  };

  if (totalParcelas === 1) {
    const id = await lancamentoRepository.criar({ ...base, parcela: 1, totalParcelas: 1 });

    await auditoriaService.registrarEvento({
      acao: 'CRIAR',
      entidade: 'LANCAMENTO',
      entidadeId: id,
      usuario: user,
      detalhes: { descricao: base.descricao, valor: base.valor, processoId: base.processoId || null }
    });

    const criado = await lancamentoRepository.buscarPorId(id);
    return [montarResposta(criado)];
  }

  // Parcelamento: divide o total e joga a diferenca de centavos na 1a parcela,
  // garantindo que a soma das parcelas bata exatamente com o valor contratado.
  const valorParcela = Number((base.valor / totalParcelas).toFixed(2));
  const ajuste = Number((base.valor - valorParcela * totalParcelas).toFixed(2));

  const documentos = Array.from({ length: totalParcelas }, (_, indice) => ({
    ...base,
    descricao: `${base.descricao} (${indice + 1}/${totalParcelas})`,
    valor: indice === 0 ? Number((valorParcela + ajuste).toFixed(2)) : valorParcela,
    vencimento: adicionarMeses(base.vencimento, indice),
    parcela: indice + 1,
    totalParcelas
  }));

  const ids = await lancamentoRepository.criarEmLote(documentos);

  await auditoriaService.registrarEvento({
    acao: 'CRIAR',
    entidade: 'LANCAMENTO',
    entidadeId: ids[0],
    usuario: user,
    detalhes: {
      descricao: base.descricao,
      valorTotal: base.valor,
      parcelas: totalParcelas,
      processoId: base.processoId || null
    }
  });

  return documentos.map((documento, indice) => montarResposta({ id: ids[indice], ...documento }));
}

async function atualizarLancamento(id, dados, user) {
  if (user.role === 'CLIENT') throw new Error('ACESSO_NEGADO');

  const atual = await obterComAcesso(id, user);
  const payload = montarPayload(dados, atual);

  if (!Object.keys(payload).length && dados.pago === undefined) {
    throw new Error('VALIDACAO_LANCAMENTO');
  }

  // Baixa de pagamento: registra data e valor efetivamente recebido.
  if (dados.pago === true) {
    payload.status = 'PAGO';
    payload.pagoEm = normalizarData(dados.pagoEm) || hojeISO();
    payload.valorPago = normalizarValor(dados.valorPago) ?? (payload.valor ?? atual.valor);
  } else if (dados.pago === false) {
    payload.status = 'PENDENTE';
    payload.pagoEm = null;
    payload.valorPago = null;
  }

  await lancamentoRepository.atualizar(id, {
    ...payload,
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: user.uid
  });

  await auditoriaService.registrarEvento({
    acao: dados.pago === true ? 'BAIXA_PAGAMENTO' : 'ATUALIZAR',
    entidade: 'LANCAMENTO',
    entidadeId: id,
    usuario: user,
    detalhes: { campos: Object.keys(payload) }
  });

  const atualizado = await lancamentoRepository.buscarPorId(id);
  return montarResposta(atualizado);
}

async function deletarLancamento(id, user) {
  if (user.role === 'CLIENT') throw new Error('ACESSO_NEGADO');

  const atual = await obterComAcesso(id, user);

  await lancamentoRepository.deletarSoft(id, {
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: user.uid
  });

  await auditoriaService.registrarEvento({
    acao: 'DELETAR_SOFT',
    entidade: 'LANCAMENTO',
    entidadeId: id,
    usuario: user,
    detalhes: { descricao: atual.descricao }
  });
}

// Resumo consumido pelo dashboard e pela tela financeira.
async function resumoFinanceiro(user, referencia = hojeISO()) {
  const lancamentos = await listarLancamentos({}, user);
  const mesReferencia = referencia.slice(0, 7);

  const resumo = {
    recebidoNoMes: 0,
    aReceber: 0,
    atrasado: 0,
    previstoNoMes: 0,
    totalAtrasados: 0,
    totalPendentes: 0,
    despesasNoMes: 0
  };

  for (const lancamento of lancamentos) {
    const ehDespesa = lancamento.tipo === 'DESPESA';
    const valor = Number(lancamento.valor) || 0;

    if (lancamento.statusEfetivo === 'PAGO') {
      const pagoNoMes = String(lancamento.pagoEm || '').slice(0, 7) === mesReferencia;
      if (pagoNoMes) {
        if (ehDespesa) resumo.despesasNoMes += Number(lancamento.valorPago) || valor;
        else resumo.recebidoNoMes += Number(lancamento.valorPago) || valor;
      }
      continue;
    }

    if (lancamento.statusEfetivo === 'CANCELADO' || ehDespesa) continue;

    resumo.aReceber += valor;
    resumo.totalPendentes += 1;

    if (lancamento.statusEfetivo === 'ATRASADO') {
      resumo.atrasado += valor;
      resumo.totalAtrasados += 1;
    }

    if (String(lancamento.vencimento || '').slice(0, 7) === mesReferencia) {
      resumo.previstoNoMes += valor;
    }
  }

  return {
    recebidoNoMes: Number(resumo.recebidoNoMes.toFixed(2)),
    aReceber: Number(resumo.aReceber.toFixed(2)),
    atrasado: Number(resumo.atrasado.toFixed(2)),
    previstoNoMes: Number(resumo.previstoNoMes.toFixed(2)),
    despesasNoMes: Number(resumo.despesasNoMes.toFixed(2)),
    totalAtrasados: resumo.totalAtrasados,
    totalPendentes: resumo.totalPendentes
  };
}

module.exports = {
  listarLancamentos,
  criarLancamento,
  atualizarLancamento,
  deletarLancamento,
  resumoFinanceiro,
  calcularStatusEfetivo
};
