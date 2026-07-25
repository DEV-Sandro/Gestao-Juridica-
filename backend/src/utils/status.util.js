const CATEGORIAS_COMPROMISSO = new Set(['PRAZO', 'AUDIENCIA', 'EVENTO', 'DOCUMENTO']);

function normalizarCategoriaCompromisso(valor) {
  if (typeof valor !== 'string') {
    return 'PRAZO';
  }

  const normalizado = valor.trim().toUpperCase();
  return CATEGORIAS_COMPROMISSO.has(normalizado) ? normalizado : 'PRAZO';
}

function calcularDiferencaDias(dataIso) {
  if (!dataIso) {
    return null;
  }

  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) {
    return null;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  data.setHours(0, 0, 0, 0);

  return Math.ceil((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

// Limiar (em dias) a partir do qual um prazo passa a ser tratado como Data Fatal:
// vencido, vence hoje ou falta 1 dia. Isso acontece automaticamente, sem
// necessidade de qualquer acao manual do usuario.
const LIMIAR_DATA_FATAL = 1;

function ehDataFatal(diferencaDias) {
  return diferencaDias !== null && diferencaDias <= LIMIAR_DATA_FATAL;
}

function calcularStatusInteligente(processo, diasParaArquivar = 30) {
  const statusBase = processo.status || 'Em Andamento';

  if (
    ['Cancelado', 'Indeferido', 'Arquivado'].includes(statusBase) ||
    processo.arquivado === true
  ) {
    return processo.arquivado ? 'Arquivado' : statusBase;
  }

  const diferencaDias = calcularDiferencaDias(processo.prazo);

  if (statusBase === 'Concluído') {
    if (diferencaDias !== null && diferencaDias <= -diasParaArquivar) {
      return 'Arquivado';
    }

    return 'Concluído';
  }

  if (ehDataFatal(diferencaDias)) {
    return 'Data Fatal';
  }

  if (processo.urgenteManual === true) {
    return 'Urgente';
  }

  if (diferencaDias !== null && diferencaDias <= 7) {
    return 'Urgente';
  }

  return statusBase;
}

module.exports = {
  calcularDiferencaDias,
  calcularStatusInteligente,
  normalizarCategoriaCompromisso,
  ehDataFatal,
  LIMIAR_DATA_FATAL
};
