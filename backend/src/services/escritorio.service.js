const { db } = require('../config/firebase');

// Registros antigos nao tinham escritorioId. O autor do registro e a unica
// atribuicao segura: registros sem autor identificavel ficam indisponiveis.
async function escritorioDoUsuario(uid, vistos = new Set()) {
  if (!uid || vistos.has(uid)) return null;
  vistos.add(uid);
  const perfil = await db.collection('usuarios').doc(uid).get();
  const dados = perfil.exists ? perfil.data() : {};
  if (dados.escritorioId) return dados.escritorioId;

  const convites = await db.collection('convitesEquipe').where('usedByUid', '==', uid).get();
  const aceito = convites.docs.find((doc) => doc.data().status === 'ACCEPTED');
  if (aceito) return escritorioDoUsuario(aceito.data().convidadoPor, vistos);
  return uid;
}

async function pertenceAoEscritorio(registro, user) {
  if (!registro || !user?.escritorioId) return false;
  if (registro.escritorioId) return registro.escritorioId === user.escritorioId;
  const autor = registro.criadoPor || registro.advogadoId;
  if (!autor) return false;
  if (!user._escritoriosAutores) {
    Object.defineProperty(user, '_escritoriosAutores', { value: new Map() });
  }
  if (!user._escritoriosAutores.has(autor)) {
    user._escritoriosAutores.set(autor, escritorioDoUsuario(autor));
  }
  return (await user._escritoriosAutores.get(autor)) === user.escritorioId;
}

async function exigirMesmoEscritorio(registro, user) {
  if (!(await pertenceAoEscritorio(registro, user))) throw new Error('ACESSO_NEGADO');
}

module.exports = { escritorioDoUsuario, pertenceAoEscritorio, exigirMesmoEscritorio };
