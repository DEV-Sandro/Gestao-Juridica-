const { admin, db } = require('../config/firebase');
const { TENANT_PADRAO } = require('../config/tenant');
const { runComTenant } = require('../config/tenant-context');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        mensagem: 'Não autorizado'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(token);

    const userDoc = await db.collection('usuarios').doc(decoded.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      displayName: userData.displayName || decoded.name || null,
      photoURL: userData.photoURL || decoded.picture || null,
      role: userData.role || 'CLIENT',
      // Tenant (escritório) do usuário. Fail-safe para o tenant padrão durante a
      // transição, para nenhuma requisição ficar sem escopo de escritório.
      tenantId: userData.tenantId || TENANT_PADRAO,
      permissoes: userData.permissoes || null,
      // Capturados aqui (unico lugar com acesso ao req cru) e carregados junto do
      // usuario em toda a aplicacao — auditoriaService.registrarEvento le esses
      // campos de "usuario" sem que cada chamador precise repassar o req.
      ip: req.ip || null,
      userAgent: req.get('user-agent') || null
    };

    // Executa todo o restante da requisição dentro do contexto do tenant, para
    // que qualquer leitura seja automaticamente escopada ao escritório do usuário.
    return runComTenant(req.user.tenantId, () => next());
  } catch (error) {
    return res.status(401).json({
      mensagem: 'Token inválido ou expirado'
    });
  }
}

module.exports = {
  authMiddleware
};
