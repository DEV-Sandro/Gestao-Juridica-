const configuracaoService = require('./configuracao.service');

function normalizarLinksHonorarios(dados = {}) {
  return Object.keys(dados)
    .sort((primeiro, segundo) => primeiro.localeCompare(segundo, 'pt-BR'))
    .reduce((acc, chave) => {
      const estado = String(chave || '').trim().toUpperCase();
      const link = typeof dados[chave] === 'string' ? dados[chave].trim() : '';

      if (!estado || estado.length !== 2 || !link) {
        return acc;
      }

      acc[estado] = link;
      return acc;
    }, {});
}

async function listarLinksHonorarios() {
  const dados = await configuracaoService.obterConfiguracao('honorarios');
  const origemLinks =
    dados.linksOAB && typeof dados.linksOAB === 'object' && !Array.isArray(dados.linksOAB)
      ? dados.linksOAB
      : dados;

  return normalizarLinksHonorarios(origemLinks);
}

module.exports = {
  listarLinksHonorarios
};
