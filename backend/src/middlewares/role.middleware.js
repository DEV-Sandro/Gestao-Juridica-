function roleMiddleware(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        mensagem: 'Não autenticado'
      });
    }

    if (!rolesPermitidos.includes(req.user.role)) {
      return res.status(403).json({
        mensagem: 'Acesso negado'
      });
    }

    next();
  };
}

module.exports = {
  roleMiddleware
};