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

  return res.status(500).json({
    mensagem: 'Erro interno do servidor'
  });
}

module.exports = {
  notFoundMiddleware,
  errorMiddleware
};