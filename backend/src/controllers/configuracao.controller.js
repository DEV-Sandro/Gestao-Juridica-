const configuracaoService = require('../services/configuracao.service');

async function listar(req, res, next) {
  try {
    const configuracoes = await configuracaoService.listarConfiguracoes();
    res.json(configuracoes);
  } catch (err) {
    next(err);
  }
}

async function obter(req, res, next) {
  try {
    const configuracao = await configuracaoService.obterConfiguracao(req.params.id);
    res.json(configuracao);
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const configuracao = await configuracaoService.atualizarConfiguracao(
      req.params.id,
      req.body,
      req.user
    );
    res.json(configuracao);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar,
  obter,
  atualizar
};
