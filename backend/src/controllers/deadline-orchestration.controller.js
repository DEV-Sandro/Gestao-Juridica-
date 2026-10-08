const deadlineOrchestrationService = require('../services/deadline-orchestration.service');

async function status(req, res, next) {
  try {
    const config = deadlineOrchestrationService.configuracao();
    res.json({
      cloudTasks: config.enabled,
      project: config.project || null,
      location: config.location || null,
      queue: config.queue || null,
      webhookConfigured: Boolean(config.webhookUrl),
      oidcConfigured: Boolean(config.serviceAccountEmail),
      alertHours: 48,
      escalationHours: 12
    });
  } catch (error) {
    next(error);
  }
}

async function executarTarefa(req, res, next) {
  if (!deadlineOrchestrationService.tarefaAutorizada(req)) {
    return res.status(401).json({ mensagem: 'Nao autorizado.' });
  }

  try {
    const resultado = await deadlineOrchestrationService.executarAcaoAgendada(req.body || {});
    return res.json({ ok: true, ...resultado });
  } catch (error) {
    return next(error);
  }
}

module.exports = { status, executarTarefa };
