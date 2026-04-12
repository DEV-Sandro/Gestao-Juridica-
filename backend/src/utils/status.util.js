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

  if (processo.urgenteManual === true) {
    return diferencaDias !== null && diferencaDias < 0 ? 'Atrasado' : 'Urgente';
  }

  if (diferencaDias !== null) {
    if (diferencaDias < 0) return 'Atrasado';
    if (diferencaDias <= 7) return 'Urgente';
  }

  return statusBase;
}

module.exports = {
  calcularDiferencaDias,
  calcularStatusInteligente,
  normalizarCategoriaCompromisso
};
