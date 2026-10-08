const rentabilidadeService = require('../services/rentabilidade.service');
const apontamentoTempoService = require('../services/apontamento-tempo.service');

async function obter(req, res, next) {
  try {
    const resultado = await rentabilidadeService.montarRentabilidade(req.user);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function criarApontamento(req, res, next) {
  try {
    const apontamento = await apontamentoTempoService.criarApontamento(
      req.params.processoId,
      req.body,
      req.user
    );
    res.status(201).json(apontamento);
  } catch (err) {
    next(err);
  }
}

async function deletarApontamento(req, res, next) {
  try {
    await apontamentoTempoService.deletarApontamento(req.params.id, req.user);
    res.json({ mensagem: 'Apontamento de tempo removido com sucesso' });
  } catch (err) {
    next(err);
  }
}

async function atualizarApontamento(req, res, next) {
  try {
    const apontamento = await apontamentoTempoService.atualizarApontamento(req.params.id, req.body, req.user);
    res.json(apontamento);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  obter,
  criarApontamento,
  atualizarApontamento,
  deletarApontamento
};
