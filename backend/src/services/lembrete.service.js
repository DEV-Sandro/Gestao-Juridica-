const compromissoRepository = require('../repositories/compromisso.repository');
const usuarioRepository = require('../repositories/usuario.repository');

function configuracaoIntegracoes() {
  return {
    email: Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_FROM_EMAIL),
    whatsapp: Boolean(process.env.WHATSAPP_WEBHOOK_URL),
    googleCalendar: Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET),
    outlookCalendar: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
    processamentoAutomatico: Boolean(process.env.REMINDER_CRON_SECRET)
  };
}

function chaveLembrete(lembrete) {
  return `${lembrete.canal}:${lembrete.minutosAntes}`;
}

function limparTelefone(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  if (!digitos) return null;
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  return digitos;
}

function formatarDataHora(valor) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo'
  }).format(new Date(valor));
}

function construirMensagem(compromisso) {
  return {
    assunto: `Lembrete JustaPro: ${compromisso.titulo}`,
    texto: `Você tem ${compromisso.titulo} em ${formatarDataHora(compromisso.dataInicio)}.${
      compromisso.local ? ` Local: ${compromisso.local}.` : ''
    }`
  };
}

async function enviarEmail(destinatario, mensagem) {
  if (!process.env.RESEND_API_KEY || !process.env.REMINDER_FROM_EMAIL || !destinatario.email) {
    return { enviado: false, motivo: 'EMAIL_NAO_CONFIGURADO' };
  }

  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.REMINDER_FROM_EMAIL,
      to: [destinatario.email],
      subject: mensagem.assunto,
      text: mensagem.texto
    })
  });

  if (!resposta.ok) {
    throw new Error(`FALHA_EMAIL_${resposta.status}`);
  }
  return { enviado: true };
}

async function enviarWhatsApp(destinatario, compromisso, lembrete, mensagem) {
  const telefone = limparTelefone(destinatario.telefone);
  if (!process.env.WHATSAPP_WEBHOOK_URL || !telefone) {
    return { enviado: false, motivo: 'WHATSAPP_NAO_CONFIGURADO' };
  }

  // O webhook permite ligar o escritório ao provedor já escolhido (WhatsApp Cloud,
  // Z-API, Twilio ou outro) sem guardar credenciais de terceiros no front-end.
  const resposta = await fetch(process.env.WHATSAPP_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.WHATSAPP_WEBHOOK_TOKEN
        ? { Authorization: `Bearer ${process.env.WHATSAPP_WEBHOOK_TOKEN}` }
        : {})
    },
    body: JSON.stringify({
      tipo: 'LEMBRETE_AGENDA',
      destinatario: { nome: destinatario.displayName || null, telefone },
      compromisso: {
        id: compromisso.id,
        titulo: compromisso.titulo,
        dataInicio: compromisso.dataInicio,
        local: compromisso.local || null
      },
      lembrete,
      mensagem: mensagem.texto
    })
  });

  if (!resposta.ok) {
    throw new Error(`FALHA_WHATSAPP_${resposta.status}`);
  }
  return { enviado: true };
}

async function destinatariosDoCompromisso(compromisso) {
  const ids = [...new Set([compromisso.advogadoId, ...(compromisso.participantesIds || [])].filter(Boolean))];
  const usuarios = await Promise.all(ids.map((id) => usuarioRepository.buscarPorId(id)));
  return usuarios.filter(Boolean);
}

async function processarLembretesPendentes() {
  const agora = Date.now();
  const compromissos = await compromissoRepository.buscarTodos();
  const resumo = { analisados: 0, enviados: 0, pendentes: 0, ignorados: 0, falhas: 0 };

  for (const compromisso of compromissos) {
    if (compromisso.deletado || compromisso.status !== 'PENDENTE' || !compromisso.dataInicio) continue;
    const inicio = new Date(compromisso.dataInicio).getTime();
    if (!Number.isFinite(inicio) || inicio <= agora) continue;

    resumo.analisados += 1;
    const enviados = new Set(compromisso.lembretesEnviados || []);
    const lembretes = Array.isArray(compromisso.lembretes) ? compromisso.lembretes : [];
    const destinatarios = await destinatariosDoCompromisso(compromisso);

    for (const lembrete of lembretes) {
      const chave = chaveLembrete(lembrete);
      const momentoEnvio = inicio - Number(lembrete.minutosAntes || 0) * 60 * 1000;
      if (enviados.has(chave) || momentoEnvio > agora) continue;

      resumo.pendentes += 1;
      const mensagem = construirMensagem(compromisso);
      try {
        const resultados = await Promise.all(
          destinatarios.map((destinatario) =>
            lembrete.canal === 'EMAIL'
              ? enviarEmail(destinatario, mensagem)
              : enviarWhatsApp(destinatario, compromisso, lembrete, mensagem)
          )
        );
        if (!resultados.length || resultados.some((resultado) => !resultado.enviado)) {
          resumo.ignorados += 1;
          continue;
        }

        enviados.add(chave);
        resumo.enviados += resultados.length;
      } catch (error) {
        console.error('[lembrete] falha no envio', compromisso.id, chave, error.message);
        resumo.falhas += 1;
      }
    }

    if (enviados.size !== (compromisso.lembretesEnviados || []).length) {
      await compromissoRepository.atualizar(compromisso.id, {
        lembretesEnviados: [...enviados],
        atualizadoEm: new Date().toISOString()
      });
    }
  }

  return resumo;
}

module.exports = {
  configuracaoIntegracoes,
  processarLembretesPendentes
};
