const { admin, bucket, defaultBucketName, projectId, sanitizeBucketName } = require('../config/firebase');

// Reaproveita a mesma logica de fallback de bucket ja usada para avatares
// (usuario.service.js): o bucket padrao do projeto pode estar como
// *.firebasestorage.app ou *.appspot.com dependendo de quando foi criado, entao
// tentamos os candidatos ate um funcionar.

function ehErroBucketInexistente(error) {
  const mensagem = String(error?.message || '').toLowerCase();
  return (
    mensagem.includes('specified bucket does not exist') ||
    mensagem.includes('no such bucket') ||
    mensagem.includes('bucket not found')
  );
}

function listarBucketsPossiveis(bucketBase = defaultBucketName) {
  const candidatos = new Set();
  const bucketNormalizado = sanitizeBucketName(bucketBase);

  if (bucketNormalizado) {
    candidatos.add(bucketNormalizado);

    if (bucketNormalizado.endsWith('.appspot.com')) {
      candidatos.add(bucketNormalizado.replace(/\.appspot\.com$/i, '.firebasestorage.app'));
    }

    if (bucketNormalizado.endsWith('.firebasestorage.app')) {
      candidatos.add(bucketNormalizado.replace(/\.firebasestorage\.app$/i, '.appspot.com'));
    }
  }

  if (projectId) {
    candidatos.add(`${projectId}.firebasestorage.app`);
    candidatos.add(`${projectId}.appspot.com`);
  }

  return Array.from(candidatos).filter(Boolean);
}

async function salvarArquivo(storagePath, buffer, metadata = {}) {
  const candidatos = listarBucketsPossiveis(bucket.name);
  let ultimoErro = null;

  for (const bucketName of candidatos) {
    const bucketAtual = admin.storage().bucket(bucketName);
    const arquivo = bucketAtual.file(storagePath);

    try {
      await arquivo.save(buffer, { resumable: false, metadata });
      return { bucketName: bucketAtual.name, storagePath };
    } catch (error) {
      if (ehErroBucketInexistente(error)) {
        ultimoErro = error;
        continue;
      }
      throw error;
    }
  }

  const erro = new Error('FIREBASE_STORAGE_BUCKET_INVALIDO');
  erro.details = { configurado: bucket.name, tentativas: candidatos, causa: ultimoErro?.message || null };
  throw erro;
}

async function lerArquivo(bucketName, storagePath) {
  const bucketAtual = bucketName ? admin.storage().bucket(bucketName) : bucket;
  const [conteudo] = await bucketAtual.file(storagePath).download();
  return conteudo;
}

async function apagarArquivo(bucketName, storagePath) {
  try {
    const bucketAtual = bucketName ? admin.storage().bucket(bucketName) : bucket;
    await bucketAtual.file(storagePath).delete();
  } catch (error) {
    console.error('[storage.util] falha ao apagar arquivo', storagePath, error.message);
  }
}

module.exports = {
  salvarArquivo,
  lerArquivo,
  apagarArquivo
};
