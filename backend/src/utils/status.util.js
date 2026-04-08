function calcularStatusInteligente(processo, diasParaArquivar = 30) {
  if (
    ['Cancelado', 'Indeferido', 'Arquivado'].includes(processo.status) ||
    processo.arquivado === true
  ) {
    return processo.arquivado ? 'Arquivado' : processo.status;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let diferencaDias = null;

  if (processo.prazo) {
    const dataPrazo = new Date(processo.prazo);
    dataPrazo.setHours(0, 0, 0, 0);

    diferencaDias = Math.ceil(
      (dataPrazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  if (processo.status === 'Concluído') {
    if (diferencaDias !== null && diferencaDias <= -diasParaArquivar) {
      return 'Arquivado';
    }

    return 'Concluído';
  }

  if (diferencaDias !== null) {
    if (diferencaDias < 0) return 'Atrasado';
    if (diferencaDias <= 7) return 'Urgente';
    return 'Em Andamento';
  }

  return processo.status || 'Em Andamento';
}

module.exports = {
  calcularStatusInteligente
};