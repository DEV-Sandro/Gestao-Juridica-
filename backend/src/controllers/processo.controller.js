const service = require('../services/processo.service');

async function listar(req, res, next) {
  try {
    const data = await service.listarProcessos(req.query, req.user);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function buscarPorId(req, res, next) {
  try {
    const data = await service.buscarPorId(req.params.id, req.user);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const id = await service.criarProcesso(req.body, req.user);

    res.status(201).json({
      mensagem: 'Processo criado com sucesso',
      id
    });
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    await service.atualizarProcesso(req.params.id, req.body, req.user);

    res.json({
      mensagem: 'Processo atualizado com sucesso'
    });
  } catch (err) {
    next(err);
  }
}

async function deletar(req, res, next) {
  try {
    await service.deletarProcesso(req.params.id, req.user);

    res.json({
      mensagem: 'Processo removido com sucesso'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar,
  buscarPorId,
  criar,
  atualizar,
  deletar
};