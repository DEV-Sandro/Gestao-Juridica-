const { admin, db } = require('../config/firebase');

async function validarTokenFirebase(token) {
  if (!token) {
    throw new Error('TOKEN_OBRIGATORIO');
  }

  const decodedToken = await admin.auth().verifyIdToken(token);
  const uid = decodedToken.uid;

  const userDoc = await db.collection('usuarios').doc(uid).get();

  let role = 'CLIENT';

  if (userDoc.exists) {
    role = userDoc.data().role || 'CLIENT';
  }

  return {
    mensagem: 'Acesso liberado',
    usuario: decodedToken.email || null,
    uid,
    role
  };
}

module.exports = {
  validarTokenFirebase
};