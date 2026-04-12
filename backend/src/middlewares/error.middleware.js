function notFoundMiddleware(req, res, next) {
  return res.status(404).json({
    mensagem: 'Rota não encontrada'
  });
}

function errorMiddleware(error, req, res, next) {
  console.error('Erro interno:', error);

  if (error.message === 'TOKEN_OBRIGATORIO') {
    return res.status(401).json({
      mensagem: 'Token obrigatório'
    });
  }

  if (error.code === 'auth/id-token-expired') {
    return res.status(401).json({
      mensagem: 'Token expirado'
    });
  }

  if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
    return res.status(403).json({
      mensagem: 'Token inválido'
    });
  }

  if (error.message === 'PROCESSO_NAO_ENCONTRADO') {
    return res.status(404).json({
      mensagem: 'Processo não encontrado'
    });
  }

  if (error.message === 'ACESSO_NEGADO') {
    return res.status(403).json({
      mensagem: 'Acesso negado'
    });
  }

  if (error.message === 'VALIDACAO_FALHOU') {
    return res.status(400).json({
      mensagem: 'Dados inválidos'
    });
  }

  if (error.message === 'EMAIL_JA_EXISTE') {
    return res.status(409).json({
      mensagem: 'Já existe um usuário com esse e-mail'
    });
  }

  if (error.message === 'NAO_PODE_REMOVER_A_SI_MESMO') {
    return res.status(400).json({
      mensagem: 'Você não pode remover seu próprio usuário'
    });
  }

  if (error.message === 'VALIDACAO_PERFIL') {
    return res.status(400).json({
      mensagem:
        Array.isArray(error.details) && error.details.length > 0
          ? error.details[0]
          : 'Dados de perfil invalidos'
    });
  }

  if (error.message === 'VALIDACAO_CLIENTE') {
    return res.status(400).json({
      mensagem:
        Array.isArray(error.details) && error.details.length > 0
          ? error.details[0]
          : 'Dados do cliente invalidos.'
    });
  }

  if (error.message === 'CLIENTE_NAO_ENCONTRADO') {
    return res.status(404).json({
      mensagem: 'Cliente nao encontrado.'
    });
  }

  if (error.message === 'ORCAMENTO_NAO_ENCONTRADO') {
    return res.status(404).json({
      mensagem: 'Nenhum orcamento foi encontrado para este processo.'
    });
  }

  if (error.message === 'ORCAMENTO_NAO_ACEITO') {
    return res.status(409).json({
      mensagem: 'O orcamento precisa estar aceito antes da conversao em contrato.'
    });
  }

  if (error.message === 'VALIDACAO_CONVITE') {
    return res.status(400).json({
      mensagem:
        Array.isArray(error.details) && error.details.length > 0
          ? error.details[0]
          : 'Dados do convite invalidos.'
    });
  }

  if (error.message === 'CONVITE_INVALIDO') {
    return res.status(404).json({
      mensagem: 'Este convite nao e valido.'
    });
  }

  if (error.message === 'CONVITE_EXPIRADO') {
    return res.status(410).json({
      mensagem: 'Este convite expirou. Solicite um novo link ao administrador.'
    });
  }

  if (error.message === 'CONVITE_JA_UTILIZADO') {
    return res.status(409).json({
      mensagem: 'Este convite ja foi utilizado.'
    });
  }

  if (error.message === 'AVATAR_VAZIO') {
    return res.status(400).json({
      mensagem: 'Nenhuma imagem foi recebida. Selecione um arquivo JPG, PNG ou WEBP.'
    });
  }

  if (error.message === 'AVATAR_MUITO_GRANDE') {
    return res.status(413).json({
      mensagem: 'A imagem excede o limite de 5MB.'
    });
  }

  if (error.message === 'AVATAR_FORMATO_INVALIDO') {
    return res.status(415).json({
      mensagem: 'Formato invalido. Use JPG, PNG ou WEBP.'
    });
  }

  if (error.message === 'FIREBASE_STORAGE_BUCKET_INVALIDO') {
    return res.status(502).json({
      mensagem:
        'O bucket do Firebase Storage configurado para o backend nao existe. Confirme no console se o bucket padrao do projeto usa o formato PROJECT_ID.firebasestorage.app ou PROJECT_ID.appspot.com e replique esse valor em FIREBASE_STORAGE_BUCKET.'
    });
  }

  return res.status(500).json({
    mensagem: 'Erro interno do servidor'
  });
}

module.exports = {
  notFoundMiddleware,
  errorMiddleware
};
