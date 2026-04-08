const authService = require('../services/auth.service');

async function loginSeguro(req, res, next) {
  try {
    const { token } = req.body;

    const resultado = await authService.validarTokenFirebase(token);

    res.json(resultado);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  loginSeguro
};