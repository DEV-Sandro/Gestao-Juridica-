const auditoriaService = require('../services/auditoria.service');

async function listar(req, res, next) {
  try {
    const registros = await auditoriaService.listarAuditoria({
      entidade: req.query.entidade || undefined,
      usuarioId: req.query.usuarioId || undefined,
      de: req.query.de || undefined,
      ate: req.query.ate || undefined,
      limite: req.query.limite
    });
    res.json(registros);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar
};
