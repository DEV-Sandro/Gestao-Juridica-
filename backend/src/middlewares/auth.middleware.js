const { admin, db } = require('../config/firebase');

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
      role: userData.role || 'CLIENT'
    };

    next();
  } catch (error) {
    return res.status(401).json({
      mensagem: 'Token inválido ou expirado'
    });
  }
}

module.exports = {
  authMiddleware
};
