const lembreteService = require('../services/lembrete.service');

function segredoValido(req) {
  const esperado = process.env.REMINDER_CRON_SECRET;
  return Boolean(esperado && req.get('x-reminder-secret') === esperado);
}

async function status(req, res, next) {
  try {
    res.json(lembreteService.configuracaoIntegracoes());
  } catch (error) {
    next(error);
  }
}

async function processar(req, res, next) {
  if (!segredoValido(req)) {
    return res.status(401).json({ mensagem: 'Não autorizado.' });
  }

  try {
    const resumo = await lembreteService.processarLembretesPendentes();
    res.json({ ok: true, ...resumo });
  } catch (error) {
    next(error);
  }
}

module.exports = { status, processar };
