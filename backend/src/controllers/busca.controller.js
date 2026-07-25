const buscaService = require('../services/busca.service');

async function buscar(req, res, next) {
  try {
    const resultado = await buscaService.buscar(req.query.q, req.user);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  buscar
};
