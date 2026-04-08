const { db } = require('../config/firebase');

async function registrar(log) {
  await db.collection('auditoria').add({
    ...log,
    criadoEm: new Date().toISOString()
  });
}

module.exports = {
  registrar
};