// Reconstrói, de forma segura e incremental, a visão materializada de tempo e
// custo dos processos já existentes.
//
// Uso:
//   node scripts/rebuild-profitability-projections.js
//   node scripts/rebuild-profitability-projections.js --tenant=escritorio-principal
//   node scripts/rebuild-profitability-projections.js --apply
//
// Sem --apply o comando é somente diagnóstico: não altera documentos.

const { db } = require('../src/config/firebase');
const { TENANT_PADRAO } = require('../src/config/tenant');
const {
  camposIniciaisDeProjecao,
  custoDoApontamento,
  montarProjecao,
  segundosDoApontamento
} = require('../src/services/rentabilidade-projecao.service');

const APLICAR = process.argv.includes('--apply');
const argumentoTenant = process.argv.find((arg) => arg.startsWith('--tenant='));
const TENANT_FILTRADO = argumentoTenant ? argumentoTenant.slice('--tenant='.length).trim() : null;
const TAMANHO_LOTE = 400;

function tenantDo(dados) {
  return dados?.tenantId || TENANT_PADRAO;
}

function apontamentoValido(apontamento) {
  return !apontamento.deletado && Boolean(apontamento.processoId);
}

async function carregarDados() {
  const [processosSnapshot, apontamentosSnapshot] = await Promise.all([
    db.collection('processos').get(),
    db.collection('apontamentosTempo').get()
  ]);

  const apontamentosPorProcesso = new Map();
  for (const doc of apontamentosSnapshot.docs) {
    const apontamento = { id: doc.id, ...doc.data() };
    if (!apontamentoValido(apontamento)) continue;
    if (TENANT_FILTRADO && tenantDo(apontamento) !== TENANT_FILTRADO) continue;

    const chave = `${tenantDo(apontamento)}:${apontamento.processoId}`;
    const lista = apontamentosPorProcesso.get(chave) || [];
    lista.push(apontamento);
    apontamentosPorProcesso.set(chave, lista);
  }

  return {
    processos: processosSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    apontamentosPorProcesso
  };
}

async function reconstruir() {
  const { processos, apontamentosPorProcesso } = await carregarDados();
  const elegiveis = processos.filter(
    (processo) =>
      !processo.deletado && (!TENANT_FILTRADO || tenantDo(processo) === TENANT_FILTRADO)
  );

  let processados = 0;
  let apontamentosSomados = 0;
  let lote = db.batch();
  let pendentes = 0;
  let commits = 0;

  for (const processo of elegiveis) {
    const chave = `${tenantDo(processo)}:${processo.id}`;
    const apontamentos = apontamentosPorProcesso.get(chave) || [];
    const totalSeconds = apontamentos.reduce((total, apontamento) => total + segundosDoApontamento(apontamento), 0);
    const totalTimeCost = apontamentos.reduce((total, apontamento) => total + custoDoApontamento(apontamento), 0);
    const projecao = montarProjecao(processo, {
      totalSeconds,
      totalTimeCost,
      // Despesas continuam no módulo financeiro; se uma projeção parcial já
      // existir, preservamos esse campo para uma futura etapa de deltas financeiros.
      totalExpenseCost: processo.rentabilidadeProjection?.totalExpenseCost || processo.totalExpenseCost || 0,
      timeEntryCount: apontamentos.length
    });

    processados += 1;
    apontamentosSomados += apontamentos.length;

    if (!APLICAR) continue;

    lote.set(
      db.collection('processos').doc(processo.id),
      {
        ...camposIniciaisDeProjecao(processo),
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
        rentabilidadeProjectionPending: false
      },
      { merge: true }
    );
    pendentes += 1;

    if (pendentes >= TAMANHO_LOTE) {
      await lote.commit();
      commits += 1;
      lote = db.batch();
      pendentes = 0;
    }
  }

  if (APLICAR && pendentes) {
    await lote.commit();
    commits += 1;
  }

  return { processados, apontamentosSomados, commits };
}

reconstruir()
  .then((resultado) => {
    console.log(
      `Rentabilidade: ${resultado.processados} processo(s), ${resultado.apontamentosSomados} apontamento(s)` +
        (APLICAR ? `, ${resultado.commits} lote(s) gravado(s).` : ' (dry-run; nenhuma alteração gravada).')
    );
  })
  .catch((error) => {
    console.error('Falha ao reconstruir projeções de rentabilidade:', error.message);
    process.exitCode = 1;
  });
