const honorarioService = require('../services/honorario.service');

async function listar(req, res, next) {
  try {
    const links = await honorarioService.listarLinksHonorarios();
    res.json(links);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar
};
