const { db } = require('../config/firebase');

const TENANT_ID_REGEX = /^[a-zA-Z0-9_-]{3,120}$/;

function validarTenantId(tenantId) {
  const valor = String(tenantId || '').trim();
  if (!TENANT_ID_REGEX.test(valor)) {
    throw new Error('TENANT_ID_INVALIDO');
  }
  return valor;
}

function tenantRef(tenantId) {
  return db.collection('tenants').doc(validarTenantId(tenantId));
}

function colecaoDoTenant(tenantId, collectionName) {
  const nome = String(collectionName || '').trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{1,80}$/.test(nome)) {
    throw new Error('TENANT_COLLECTION_INVALIDA');
  }

  return tenantRef(tenantId).collection(nome);
}

module.exports = { validarTenantId, tenantRef, colecaoDoTenant };
