const processoService = require('./processo.service');
const lancamentoService = require('./lancamento.service');
const compromissoService = require('./compromisso.service');
const { calcularDiferencaDias } = require('../utils/status.util');

function hojeISO() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = `${agora.getMonth() + 1}`.padStart(2, '0');
  const dia = `${agora.getDate()}`.padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function somarDias(dataISO, dias) {
  const data = new Date(`${dataISO}T12:00:00`);
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

const STATUS_ENCERRADOS = ['Arquivado', 'Cancelado', 'Indeferido', 'Concluído'];

function montarIndicadoresProcessos(processos) {
  const indicadores = {
    ativos: 0,
    dataFatal: 0,
    urgentes: 0,
    concluidos: 0,
    vencendoHoje: 0,
    porArea: {},
    porSituacao: {}
  };

  for (const processo of processos) {
    const status = processo.statusCalculado;

    if (status === 'Concluído') indicadores.concluidos += 1;
    if (!STATUS_ENCERRADOS.includes(status)) indicadores.ativos += 1;
    if (status === 'Data Fatal' || status === 'Atrasado') indicadores.dataFatal += 1;
    if (status === 'Urgente') indicadores.urgentes += 1;

    if (calcularDiferencaDias(processo.prazo) === 0 && !STATUS_ENCERRADOS.includes(status)) {
      indicadores.vencendoHoje += 1;
    }

    if (!STATUS_ENCERRADOS.includes(status)) {
      const area = processo.categoria || 'NAO_INFORMADO';
      indicadores.porArea[area] = (indicadores.porArea[area] || 0) + 1;

      const situacao = processo.situacao || 'NAO_INFORMADO';
      indicadores.porSituacao[situacao] = (indicadores.porSituacao[situacao] || 0) + 1;
    }
  }

  return indicadores;
}

// Prazos mais criticos primeiro (Data Fatal antes de tudo), para a lista de acao
// rapida do dashboard.
function montarPrazosCriticos(processos, limite = 6) {
  const prioridade = { 'Data Fatal': 0, Atrasado: 0, Urgente: 1 };

  return processos
    .filter(
      (processo) =>
        processo.prazo &&
        !STATUS_ENCERRADOS.includes(processo.statusCalculado) &&
        prioridade[processo.statusCalculado] !== undefined
    )
    .sort(
      (a, b) =>
        (prioridade[a.statusCalculado] ?? 9) - (prioridade[b.statusCalculado] ?? 9) ||
        String(a.prazo).localeCompare(String(b.prazo))
    )
    .slice(0, limite)
    .map((processo) => ({
      id: processo.id,
      titulo: processo.titulo,
      cliente: processo.clienteNome || null,
      prazo: processo.prazo,
      status: processo.statusCalculado,
      diasParaPrazo: calcularDiferencaDias(processo.prazo)
    }));
}

async function montarAgendaResumo(user) {
  const hoje = hojeISO();
  const fimSemana = somarDias(hoje, 7);

  try {
    const compromissos = await compromissoService.listarAgenda(
      { modo: 'individual', de: `${hoje}T00:00:00.000Z`, ate: `${fimSemana}T23:59:59.999Z` },
      user
    );

    const doDia = compromissos.filter(
      (compromisso) => String(compromisso.dataInicio || '').slice(0, 10) === hoje
    );

    return {
      hoje: doDia.length,
      proximosSete: compromissos.length,
      itensDoDia: doDia.slice(0, 5).map((compromisso) => ({
        id: compromisso.id,
        titulo: compromisso.titulo,
        dataInicio: compromisso.dataInicio,
        tipo: compromisso.tipo,
        local: compromisso.local || null
      }))
    };
  } catch (error) {
    // Agenda nao deve derrubar o dashboard inteiro.
    console.error('[dashboard.service] falha ao montar agenda', error.message);
    return { hoje: 0, proximosSete: 0, itensDoDia: [] };
  }
}

async function montarDashboard(user) {
  const processos = await processoService.listarProcessos({}, user);

  const [financeiro, agenda] = await Promise.all([
    user.role === 'CLIENT'
      ? Promise.resolve(null)
      : lancamentoService.resumoFinanceiro(user).catch((error) => {
          console.error('[dashboard.service] falha no resumo financeiro', error.message);
          return null;
        }),
    montarAgendaResumo(user)
  ]);

  return {
    geradoEm: new Date().toISOString(),
    processos: montarIndicadoresProcessos(processos),
    prazosCriticos: montarPrazosCriticos(processos),
    agenda,
    financeiro
  };
}

module.exports = {
  montarDashboard
};
