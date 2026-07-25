const lancamentoService = require('../services/lancamento.service');

async function listar(req, res, next) {
  try {
    const lancamentos = await lancamentoService.listarLancamentos(req.query, req.user);
    res.json(lancamentos);
  } catch (err) {
    next(err);
  }
}

async function resumo(req, res, next) {
  try {
    const resultado = await lancamentoService.resumoFinanceiro(req.user, req.query.referencia);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const lancamentos = await lancamentoService.criarLancamento(req.body, req.user);
    res.status(201).json(lancamentos);
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const lancamento = await lancamentoService.atualizarLancamento(req.params.id, req.body, req.user);
    res.json(lancamento);
  } catch (err) {
    next(err);
  }
}

async function deletar(req, res, next) {
  try {
    await lancamentoService.deletarLancamento(req.params.id, req.user);
    res.json({ mensagem: 'Lancamento removido com sucesso' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar,
  resumo,
  criar,
  atualizar,
  deletar
};
