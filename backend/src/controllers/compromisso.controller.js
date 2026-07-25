const compromissoService = require('../services/compromisso.service');

async function criar(req, res, next) {
  try {
    const resultado = await compromissoService.criarCompromisso(req.body, req.user);
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

async function buscarPorId(req, res, next) {
  try {
    const compromisso = await compromissoService.obterComAcesso(req.params.id, req.user);
    res.json(compromisso);
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const resultado = await compromissoService.atualizarCompromisso(req.params.id, req.body, req.user);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function deletar(req, res, next) {
  try {
    await compromissoService.deletarCompromisso(req.params.id, req.user);
    res.json({ mensagem: 'Compromisso removido com sucesso' });
  } catch (err) {
    next(err);
  }
}

async function listarAgenda(req, res, next) {
  try {
    const registros = await compromissoService.listarAgenda(
      {
        modo: req.query.modo,
        advogadoId: req.query.advogadoId,
        de: req.query.de,
        ate: req.query.ate
      },
      req.user
    );
    res.json(registros);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  criar,
  buscarPorId,
  atualizar,
  deletar,
  listarAgenda
};
