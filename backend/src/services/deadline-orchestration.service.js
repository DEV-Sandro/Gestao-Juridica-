const crypto = require('crypto');

const { admin, db, projectId } = require('../config/firebase');
const compromissoRepository = require('../repositories/compromisso.repository');
const usuarioRepository = require('../repositories/usuario.repository');
const { mesmoTenant } = require('../config/tenant');

const HORAS_ALERTA = 48;
const HORAS_ESCALONAMENTO = 12;
const ACOES = new Set(['ALERT', 'ESCALATE']);

function configuracao() {
  const project = process.env.DEADLINE_TASKS_PROJECT || projectId;
  const location = process.env.DEADLINE_TASKS_LOCATION || 'southamerica-east1';
  const queue = process.env.DEADLINE_TASKS_QUEUE || '';
  const webhookUrl = process.env.DEADLINE_TASKS_WEBHOOK_URL || '';
  const taskSecret = process.env.DEADLINE_TASK_SECRET || '';
  const serviceAccountEmail = process.env.DEADLINE_TASKS_SERVICE_ACCOUNT || '';

  return {
    project,
    location,
    queue,
    webhookUrl,
    taskSecret,
    serviceAccountEmail,
    enabled: Boolean(project && location && queue && webhookUrl && taskSecret)
  };
}

function dataValida(valor) {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function prazoEstaAberto(prazo) {
  return (
    prazo &&
    !prazo.deletado &&
    prazo.tipo === 'PRAZO' &&
    String(prazo.status || '').toUpperCase() === 'PENDENTE' &&
    Boolean(dataValida(prazo.dataInicio))
  );
}

function riscoDoPrazo(prazo, agora = new Date()) {
  if (!prazoEstaAberto(prazo)) return 'normal';

  const horasRestantes = (dataValida(prazo.dataInicio).getTime() - agora.getTime()) / 3600000;
  if (horasRestantes <= HORAS_ESCALONAMENTO) return 'critical';
  if (horasRestantes <= HORAS_ALERTA) return 'warning';
  return 'normal';
}

function versaoDoPrazo(prazo) {
  const fonte = [
    prazo.id,
    prazo.tenantId,
    prazo.tipo,
    prazo.status,
    prazo.dataInicio,
    prazo.advogadoId,
    ...(prazo.participantesIds || [])
  ].join('|');

  return crypto.createHash('sha256').update(fonte).digest('hex').slice(0, 20);
}

function tarefaId(prazo, acao, versao) {
  const id = String(prazo.id || '').replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 120);
  return `deadline-${id}-${versao}-${acao.toLowerCase()}`.toLowerCase();
}

function horarioDaAcao(prazo, acao, agora = new Date()) {
  const vencimento = dataValida(prazo.dataInicio);
  if (!vencimento || vencimento.getTime() <= agora.getTime()) return null;

  const horasAntes = acao === 'ALERT' ? HORAS_ALERTA : HORAS_ESCALONAMENTO;
  const ideal = new Date(vencimento.getTime() - horasAntes * 3600000);
  // Prazo criado já dentro da janela: em vez de perder o aviso, a tarefa é
  // disparada logo após a persistência e ainda valida a situação no webhook.
  return ideal.getTime() > agora.getTime() ? ideal : new Date(agora.getTime() + 5000);
}

async function tokenDeAcessoGoogle() {
  const credencial = admin.app().options.credential;
  if (!credencial || typeof credencial.getAccessToken !== 'function') {
    throw new Error('CREDENCIAL_GOOGLE_INDISPONIVEL');
  }

  const resposta = await credencial.getAccessToken();
  if (!resposta?.access_token) throw new Error('TOKEN_GOOGLE_INDISPONIVEL');
  return resposta.access_token;
}

async function criarTarefa(prazo, acao, versao, agendarPara) {
  const config = configuracao();
  if (!config.enabled) return { scheduled: false, reason: 'CLOUD_TASKS_NAO_CONFIGURADO' };

  const parent = `projects/${config.project}/locations/${config.location}/queues/${config.queue}`;
  const payload = {
    action: acao,
    tenantId: prazo.tenantId,
    deadlineId: prazo.id,
    dueAt: prazo.dataInicio,
    version: versao
  };
  const httpRequest = {
    httpMethod: 'POST',
    url: config.webhookUrl,
    headers: {
      'Content-Type': 'application/json',
      'X-Deadline-Task-Secret': config.taskSecret
    },
    body: Buffer.from(JSON.stringify(payload)).toString('base64')
  };

  if (config.serviceAccountEmail) {
    httpRequest.oidcToken = { serviceAccountEmail: config.serviceAccountEmail };
  }

  const token = await tokenDeAcessoGoogle();
  const resposta = await fetch(`https://cloudtasks.googleapis.com/v2/${parent}/tasks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: {
        name: `${parent}/tasks/${tarefaId(prazo, acao, versao)}`,
        httpRequest,
        scheduleTime: agendarPara.toISOString()
      }
    })
  });

  if (resposta.status === 409) {
    return { scheduled: true, duplicate: true, scheduledFor: agendarPara.toISOString() };
  }
  if (!resposta.ok) {
    throw new Error(`CLOUD_TASKS_${resposta.status}`);
  }

  return { scheduled: true, scheduledFor: agendarPara.toISOString() };
}

async function orquestrarPrazo(prazo) {
  if (!prazoEstaAberto(prazo)) {
    return { active: false, reason: 'PRAZO_NAO_ELEGIVEL' };
  }

  const versao = versaoDoPrazo(prazo);
  const agora = new Date();
  const agendamentos = {};
  let erro = null;

  for (const acao of ACOES) {
    const horario = horarioDaAcao(prazo, acao, agora);
    if (!horario) {
      agendamentos[acao] = { scheduled: false, reason: 'PRAZO_VENCIDO' };
      continue;
    }

    try {
      agendamentos[acao] = await criarTarefa(prazo, acao, versao, horario);
    } catch (error) {
      erro = error.message;
      agendamentos[acao] = { scheduled: false, reason: error.message };
      console.error('[deadline-orchestrator] falha ao agendar', prazo.id, acao, error.message);
    }
  }

  // Agendamento é uma integração opcional: nunca desfaz a gravação do prazo.
  // O estado deixa diagnóstico verificável para o gestor e para o suporte.
  await compromissoRepository.atualizar(prazo.id, {
    deadlineRiskLevel: riscoDoPrazo(prazo, agora),
    deadlineOrchestration: {
      version: versao,
      dueAt: prazo.dataInicio,
      scheduledAt: agora.toISOString(),
      cloudTasksEnabled: configuracao().enabled,
      schedules: agendamentos,
      lastError: erro
    }
  });

  return { active: true, version: versao, schedules: agendamentos, error: erro };
}

function tarefaAutorizada(req) {
  const esperado = configuracao().taskSecret;
  return Boolean(esperado && req.get('x-deadline-task-secret') === esperado);
}

function mensagemDoPrazo(prazo, acao) {
  const vencimento = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo'
  }).format(dataValida(prazo.dataInicio));

  if (acao === 'ESCALATE') {
    return {
      assunto: `ESCALONAMENTO JustaPro: ${prazo.titulo}`,
      texto: `Prazo crítico sem confirmação de ciência: ${prazo.titulo}. Vencimento: ${vencimento}. Responsável: ${prazo.advogadoId || 'não informado'}.`
    };
  }

  return {
    assunto: `Alerta de prazo JustaPro: ${prazo.titulo}`,
    texto: `O prazo ${prazo.titulo} vence em até ${HORAS_ALERTA} horas. Vencimento: ${vencimento}. Confirme ciência ou conclua a atividade no JustaPro.`
  };
}

async function enviarEmail(destinatario, mensagem) {
  if (!process.env.RESEND_API_KEY || !process.env.REMINDER_FROM_EMAIL || !destinatario?.email) {
    return { sent: false, reason: 'EMAIL_NAO_CONFIGURADO' };
  }

  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.REMINDER_FROM_EMAIL,
      to: [destinatario.email],
      subject: mensagem.assunto,
      text: mensagem.texto
    })
  });
  if (!resposta.ok) throw new Error(`FALHA_EMAIL_${resposta.status}`);
  return { sent: true, channel: 'email' };
}

function telefoneComDdi(telefone) {
  const digitos = String(telefone || '').replace(/\D/g, '');
  if (!digitos) return null;
  return digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;
}

async function enviarWhatsApp(destinatario, mensagem, prazo, acao) {
  const telefone = telefoneComDdi(destinatario?.telefone);
  if (!process.env.WHATSAPP_WEBHOOK_URL || !telefone) {
    return { sent: false, reason: 'WHATSAPP_NAO_CONFIGURADO' };
  }

  const resposta = await fetch(process.env.WHATSAPP_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.WHATSAPP_WEBHOOK_TOKEN
        ? { Authorization: `Bearer ${process.env.WHATSAPP_WEBHOOK_TOKEN}` }
        : {})
    },
    body: JSON.stringify({
      tipo: acao === 'ESCALATE' ? 'ESCALONAMENTO_PRAZO' : 'ALERTA_PRAZO',
      destinatario: { nome: destinatario.displayName || null, telefone },
      prazo: { id: prazo.id, titulo: prazo.titulo, dataInicio: prazo.dataInicio },
      mensagem: mensagem.texto
    })
  });
  if (!resposta.ok) throw new Error(`FALHA_WHATSAPP_${resposta.status}`);
  return { sent: true, channel: 'whatsapp' };
}

async function destinatariosDaAcao(prazo, acao) {
  if (acao === 'ALERT') {
    const ids = [...new Set([prazo.advogadoId, ...(prazo.participantesIds || [])].filter(Boolean))];
    const usuarios = await Promise.all(ids.map((id) => usuarioRepository.buscarPorId(id)));
    return usuarios.filter((usuario) => usuario && mesmoTenant(usuario, prazo.tenantId) && usuario.ativo !== false);
  }

  const usuarios = await usuarioRepository.listarTodos();
  return usuarios.filter(
    (usuario) =>
      usuario &&
      usuario.ativo !== false &&
      mesmoTenant(usuario, prazo.tenantId) &&
      String(usuario.role || '').toUpperCase() === 'ADMIN'
  );
}

async function notificar(prazo, acao) {
  const mensagem = mensagemDoPrazo(prazo, acao);
  const destinatarios = await destinatariosDaAcao(prazo, acao);
  const entregas = [];

  for (const destinatario of destinatarios) {
    const resultados = await Promise.allSettled([
      enviarEmail(destinatario, mensagem),
      enviarWhatsApp(destinatario, mensagem, prazo, acao)
    ]);
    entregas.push({
      uid: destinatario.uid,
      canais: resultados.map((resultado) =>
        resultado.status === 'fulfilled' ? resultado.value : { sent: false, reason: resultado.reason?.message || 'FALHA' }
      )
    });
  }

  return { destinatarios: entregas };
}

async function executarAcaoAgendada({ action, tenantId, deadlineId, dueAt, version }) {
  if (!ACOES.has(action) || !tenantId || !deadlineId || !dueAt || !version) {
    throw new Error('TAREFA_DE_PRAZO_INVALIDA');
  }

  const prazo = await compromissoRepository.buscarPorId(deadlineId);
  if (!prazo || prazo.deletado || !mesmoTenant(prazo, tenantId)) {
    return { ignored: true, reason: 'PRAZO_REMOVIDO' };
  }
  if (!prazoEstaAberto(prazo) || prazo.dataInicio !== dueAt || versaoDoPrazo(prazo) !== version) {
    return { ignored: true, reason: 'PRAZO_ALTERADO_OU_FINALIZADO' };
  }
  if (prazo.deadlineAcknowledgedAt) {
    return { ignored: true, reason: 'CIENCIA_CONFIRMADA' };
  }

  const campoAcao = action === 'ALERT' ? 'alert' : 'escalation';
  if (prazo.deadlineActions?.[campoAcao]?.version === version) {
    return { ignored: true, reason: 'ACAO_JA_EXECUTADA' };
  }

  const entrega = await notificar(prazo, action);
  const agora = new Date().toISOString();
  const riscoAtual = riscoDoPrazo(prazo);
  await compromissoRepository.atualizar(deadlineId, {
    deadlineRiskLevel: action === 'ESCALATE' ? 'critical' : riscoAtual === 'critical' ? 'critical' : 'warning',
    [`deadlineActions.${campoAcao}`]: {
      version,
      executedAt: agora,
      delivery: entrega
    }
  });

  return { executed: true, action, delivery: entrega };
}

module.exports = {
  configuracao,
  executarAcaoAgendada,
  orquestrarPrazo,
  prazoEstaAberto,
  riscoDoPrazo,
  tarefaAutorizada,
  versaoDoPrazo
};
