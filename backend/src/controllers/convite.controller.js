const conviteService = require('../services/convite.service');

async function verificarConvite(req, res, next) {
  try {
    const convite = await conviteService.verificarConvitePorToken(req.params.token);
    res.json(convite);
  } catch (err) {
    next(err);
  }
}

async function verificarConvitePorEmail(req, res, next) {
  try {
    const convite = await conviteService.verificarConvitePorEmail(req.body.email || '');
    res.json(convite);
  } catch (err) {
    next(err);
  }
}

async function aceitarConvite(req, res, next) {
  try {
    const resultado = await conviteService.aceitarConvite(req.body);
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  verificarConvite,
  verificarConvitePorEmail,
  aceitarConvite
};
