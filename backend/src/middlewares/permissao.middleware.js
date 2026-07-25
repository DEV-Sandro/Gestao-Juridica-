const permissaoService = require('../services/permissao.service');

function permissaoMiddleware(chave) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        mensagem: 'Não autenticado'
      });
    }

    if (!permissaoService.possuiPermissao(req.user, chave)) {
      return res.status(403).json({
        mensagem: 'Acesso negado'
      });
    }

    next();
  };
}

module.exports = {
  permissaoMiddleware
};
