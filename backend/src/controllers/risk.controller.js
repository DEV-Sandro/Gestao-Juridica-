const { atualizarNiveisRisco } = require('../jobs/deadline-risk.job');

function segredoValido(req) {
  const esperado = process.env.RISK_CRON_SECRET;
  return Boolean(esperado && req.get('x-risk-cron-secret') === esperado);
}

async function recalcularRisco(req, res, next) {
  if (!segredoValido(req)) {
    return res.status(401).json({ mensagem: 'Nao autorizado.' });
  }

  try {
    const resumo = await atualizarNiveisRisco();
    return res.json({ ok: true, ...resumo });
  } catch (error) {
    return next(error);
  }
}

module.exports = { recalcularRisco };
