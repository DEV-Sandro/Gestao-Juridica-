const { admin, db } = require('../config/firebase');
const { mesmoTenant } = require('../config/tenant');

// A projeção é uma visão materializada do custo e do tempo do processo. Ela
// elimina a necessidade de somar todos os apontamentos a cada abertura da tela.
const VERSAO_PROJECAO = 1;
const LIMITE_CUSTO_HORA = 1000000;

function numeroNaoNegativo(valor, fallback = 0) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? numero : fallback;
}

function inteiroNaoNegativo(valor, fallback = 0) {
  return Math.max(0, Math.round(numeroNaoNegativo(valor, fallback)));
}

function arredondarMoeda(valor) {
  return Number(numeroNaoNegativo(valor).toFixed(2));
}

function normalizarCustoHora(valor) {
  if (valor === undefined || valor === null || valor === '') return undefined;

  const texto = typeof valor === 'string' ? valor.trim() : null;
  const numero = texto && texto.includes(',')
    ? Number(texto.replace(/\./g, '').replace(',', '.'))
    : Number(valor);
  if (!Number.isFinite(numero) || numero < 0 || numero > LIMITE_CUSTO_HORA) {
    throw new Error('VALIDACAO_APONTAMENTO_TEMPO');
  }

  return arredondarMoeda(numero);
}

function segundosDoApontamento(apontamento) {
  const segundos = Number(apontamento?.durationSeconds);
  if (Number.isFinite(segundos) && segundos >= 0) return Math.round(segundos);

  return inteiroNaoNegativo(Number(apontamento?.minutos) * 60);
}

function custoHoraDoApontamento(apontamento) {
  return numeroNaoNegativo(apontamento?.costRateSnapshot ?? apontamento?.custoHora);
}

function custoDoApontamento(apontamento) {
  return arredondarMoeda((segundosDoApontamento(apontamento) / 3600) * custoHoraDoApontamento(apontamento));
}

function custoHoraPadraoDoProcesso(processo) {
  const candidatos = [
    processo?.custoHora,
    processo?.valorHora,
    processo?.configuracaoRentabilidade?.custoHora
  ];

  for (const candidato of candidatos) {
    try {
      const normalizado = normalizarCustoHora(candidato);
      if (normalizado !== undefined) return normalizado;
    } catch (error) {
      // Um dado legado inválido não pode bloquear o apontamento de tempo.
    }
  }

  return 0;
}

function resolverCustoHoraSnapshot(dados, processo) {
  const informado = normalizarCustoHora(dados?.custoHora);
  return informado === undefined ? custoHoraPadraoDoProcesso(processo) : informado;
}

function receitaPrevistaDoProcesso(processo) {
  const candidatos = [
    processo?.orcamento?.valor,
    processo?.valorHonorarios,
    processo?.honorariosValor,
    processo?.valor,
    processo?.expectedRevenue
  ];

  for (const candidato of candidatos) {
    const numero = Number(candidato);
    if (Number.isFinite(numero) && numero >= 0) return arredondarMoeda(numero);
  }

  return 0;
}

function statusDaRentabilidade(receitaPrevista, custoTotal) {
  if (receitaPrevista <= 0) return 'pending';

  const margem = ((receitaPrevista - custoTotal) / receitaPrevista) * 100;
  if (margem <= 0) return 'red';
  if (margem < 20) return 'yellow';
  return 'green';
}

function projecaoEstaPronta(processo) {
  return Number(processo?.rentabilidadeProjection?.version) === VERSAO_PROJECAO;
}

function montarProjecao(processo, totais = {}) {
  const anterior = processo?.rentabilidadeProjection || {};
  const totalSeconds = inteiroNaoNegativo(
    totais.totalSeconds,
    inteiroNaoNegativo(anterior.totalSeconds, inteiroNaoNegativo(processo?.totalSeconds))
  );
  const totalTimeCost = arredondarMoeda(
    totais.totalTimeCost ?? anterior.totalTimeCost ?? processo?.totalTimeCost
  );
  const totalExpenseCost = arredondarMoeda(
    totais.totalExpenseCost ?? anterior.totalExpenseCost ?? processo?.totalExpenseCost
  );
  const timeEntryCount = inteiroNaoNegativo(
    totais.timeEntryCount,
    inteiroNaoNegativo(anterior.timeEntryCount, inteiroNaoNegativo(processo?.timeEntryCount))
  );
  const expectedRevenue = receitaPrevistaDoProcesso(processo);
  const totalCost = arredondarMoeda(totalTimeCost + totalExpenseCost);
  const profit = arredondarMoeda(Math.max(0, expectedRevenue - totalCost));
  const lucroComSinal = arredondarMoeda(Math.abs(expectedRevenue - totalCost));
  const profitabilityMargin = expectedRevenue > 0
    ? Number((((expectedRevenue - totalCost) / expectedRevenue) * 100).toFixed(2))
    : null;

  return {
    version: VERSAO_PROJECAO,
    expectedRevenue,
    totalSeconds,
    totalTimeCost,
    totalExpenseCost,
    totalCost,
    timeEntryCount,
    // Mantém ambos os valores para a tela e futuras automações: "profit" é
    // sempre numérico para consultas simples, enquanto lucro pode ser negativo.
    profit: expectedRevenue >= totalCost ? profit : -lucroComSinal,
    profitabilityMargin,
    profitabilityStatus: statusDaRentabilidade(expectedRevenue, totalCost),
    updatedAt: new Date().toISOString()
  };
}

function camposDaProjecao(projecao) {
  return {
    expectedRevenue: projecao.expectedRevenue,
    totalSeconds: projecao.totalSeconds,
    totalTimeCost: projecao.totalTimeCost,
    totalExpenseCost: projecao.totalExpenseCost,
    totalCost: projecao.totalCost,
    timeEntryCount: projecao.timeEntryCount,
    profitabilityMargin: projecao.profitabilityMargin,
    profitabilityStatus: projecao.profitabilityStatus,
    profitabilityProfit: projecao.profit,
    rentabilidadeProjection: projecao,
    rentabilidadeProjectionPending: false,
    rentabilidadeAtualizadaEm: admin.firestore.FieldValue.serverTimestamp()
  };
}

function camposIniciaisDeProjecao(processo) {
  return camposDaProjecao(
    montarProjecao(processo, {
      totalSeconds: 0,
      totalTimeCost: 0,
      totalExpenseCost: 0,
      timeEntryCount: 0
    })
  );
}

function camposIncrementais(processo, delta) {
  if (!projecaoEstaPronta(processo)) {
    // Processos legados ainda podem ter apontamentos anteriores sem projeção.
    // Não iniciamos um acumulador parcial: a tela conserva o cálculo compatível
    // até o backfill validar todos os totais históricos.
    return {
      rentabilidadeProjectionPending: true,
      rentabilidadeAtualizadaEm: admin.firestore.FieldValue.serverTimestamp()
    };
  }

  const atual = processo.rentabilidadeProjection;
  const proxima = montarProjecao(processo, {
    totalSeconds: inteiroNaoNegativo(atual.totalSeconds) + Math.round(delta.seconds || 0),
    totalTimeCost: arredondarMoeda(numeroNaoNegativo(atual.totalTimeCost) + Number(delta.cost || 0)),
    totalExpenseCost: atual.totalExpenseCost,
    timeEntryCount: inteiroNaoNegativo(atual.timeEntryCount) + Math.round(delta.entries || 0)
  });

  return {
    ...camposDaProjecao(proxima),
    // O incremento é atômico; dentro da transação o cálculo da margem também
    // é refeito a partir do snapshot mais recente do processo.
    totalSeconds: admin.firestore.FieldValue.increment(Math.round(delta.seconds || 0)),
    totalTimeCost: admin.firestore.FieldValue.increment(Number(delta.cost || 0)),
    totalCost: admin.firestore.FieldValue.increment(Number(delta.cost || 0)),
    timeEntryCount: admin.firestore.FieldValue.increment(Math.round(delta.entries || 0))
  };
}

async function criarApontamentoComProjecao(apontamento) {
  const apontamentoRef = db.collection('apontamentosTempo').doc();
  const processoRef = db.collection('processos').doc(apontamento.processoId);

  await db.runTransaction(async (transaction) => {
    const processoSnap = await transaction.get(processoRef);
    if (!processoSnap.exists || !mesmoTenant(processoSnap.data(), apontamento.tenantId)) {
      throw new Error('PROCESSO_NAO_ENCONTRADO');
    }

    transaction.create(apontamentoRef, apontamento);
    transaction.update(
      processoRef,
      camposIncrementais(processoSnap.data(), {
        seconds: segundosDoApontamento(apontamento),
        cost: custoDoApontamento(apontamento),
        entries: 1
      })
    );
  });

  return apontamentoRef.id;
}

async function deletarApontamentoComProjecao(id, tenantId) {
  const apontamentoRef = db.collection('apontamentosTempo').doc(id);

  await db.runTransaction(async (transaction) => {
    const apontamentoSnap = await transaction.get(apontamentoRef);
    if (!apontamentoSnap.exists) throw new Error('APONTAMENTO_TEMPO_NAO_ENCONTRADO');

    const apontamento = apontamentoSnap.data();
    if (apontamento.deletado || !mesmoTenant(apontamento, tenantId)) {
      throw new Error('APONTAMENTO_TEMPO_NAO_ENCONTRADO');
    }

    const processoRef = db.collection('processos').doc(apontamento.processoId);
    const processoSnap = await transaction.get(processoRef);
    if (!processoSnap.exists || !mesmoTenant(processoSnap.data(), tenantId)) {
      throw new Error('PROCESSO_NAO_ENCONTRADO');
    }

    transaction.delete(apontamentoRef);
    transaction.update(
      processoRef,
      camposIncrementais(processoSnap.data(), {
        seconds: -segundosDoApontamento(apontamento),
        cost: -custoDoApontamento(apontamento),
        entries: -1
      })
    );
  });
}

async function atualizarApontamentoComProjecao(id, tenantId, alteracoes) {
  const apontamentoRef = db.collection('apontamentosTempo').doc(id);
  let atualizado = null;

  await db.runTransaction(async (transaction) => {
    const apontamentoSnap = await transaction.get(apontamentoRef);
    if (!apontamentoSnap.exists) throw new Error('APONTAMENTO_TEMPO_NAO_ENCONTRADO');

    const anterior = { id: apontamentoSnap.id, ...apontamentoSnap.data() };
    if (anterior.deletado || !mesmoTenant(anterior, tenantId)) {
      throw new Error('APONTAMENTO_TEMPO_NAO_ENCONTRADO');
    }

    const processoRef = db.collection('processos').doc(anterior.processoId);
    const processoSnap = await transaction.get(processoRef);
    if (!processoSnap.exists || !mesmoTenant(processoSnap.data(), tenantId)) {
      throw new Error('PROCESSO_NAO_ENCONTRADO');
    }

    atualizado = {
      ...anterior,
      ...alteracoes,
      atualizadoEm: new Date().toISOString()
    };
    const deltaSeconds = segundosDoApontamento(atualizado) - segundosDoApontamento(anterior);
    const deltaCost = custoDoApontamento(atualizado) - custoDoApontamento(anterior);

    transaction.update(apontamentoRef, {
      ...alteracoes,
      atualizadoEm: atualizado.atualizadoEm
    });

    if (deltaSeconds !== 0 || deltaCost !== 0) {
      transaction.update(
        processoRef,
        camposIncrementais(processoSnap.data(), {
          seconds: deltaSeconds,
          cost: deltaCost,
          entries: 0
        })
      );
    }
  });

  return atualizado;
}

async function sincronizarReceitaPrevista(processoId) {
  const processoRef = db.collection('processos').doc(processoId);

  return db.runTransaction(async (transaction) => {
    const processoSnap = await transaction.get(processoRef);
    if (!processoSnap.exists || !projecaoEstaPronta(processoSnap.data())) return false;

    const atual = processoSnap.data().rentabilidadeProjection;
    transaction.update(
      processoRef,
      camposDaProjecao(
        montarProjecao(processoSnap.data(), {
          totalSeconds: atual.totalSeconds,
          totalTimeCost: atual.totalTimeCost,
          totalExpenseCost: atual.totalExpenseCost,
          timeEntryCount: atual.timeEntryCount
        })
      )
    );
    return true;
  });
}

module.exports = {
  VERSAO_PROJECAO,
  camposIniciaisDeProjecao,
  criarApontamentoComProjecao,
  custoDoApontamento,
  deletarApontamentoComProjecao,
  atualizarApontamentoComProjecao,
  montarProjecao,
  normalizarCustoHora,
  projecaoEstaPronta,
  resolverCustoHoraSnapshot,
  segundosDoApontamento,
  sincronizarReceitaPrevista
};
