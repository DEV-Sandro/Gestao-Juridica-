const test = require('node:test');
const assert = require('node:assert/strict');

const usuarios = new Map([
  ['admin-a', { role: 'ADMIN' }],
  ['membro-a', { role: 'ADVOGADO' }],
  ['admin-b', { role: 'ADMIN', escritorioId: 'admin-b' }]
]);
const convites = [{ status: 'ACCEPTED', usedByUid: 'membro-a', convidadoPor: 'admin-a' }];
const firebasePath = require.resolve('../src/config/firebase');
require.cache[firebasePath] = {
  id: firebasePath,
  filename: firebasePath,
  loaded: true,
  exports: {
    db: {
      collection(nome) {
        if (nome === 'usuarios') return {
          doc(uid) { return { async get() { return { exists: usuarios.has(uid), data: () => usuarios.get(uid) }; } }; }
        };
        if (nome === 'convitesEquipe') return {
          where(campo, operador, uid) {
            assert.equal(campo, 'usedByUid');
            assert.equal(operador, '==');
            return { async get() { return { docs: convites.filter((convite) => convite.usedByUid === uid).map((convite) => ({ data: () => convite })) }; } };
          }
        };
        if (nome === 'configuracoes') return { doc() { return { async get() { return { exists: false }; } }; } };
        throw new Error(`Colecao inesperada: ${nome}`);
      }
    }
  }
};

const { escritorioDoUsuario, pertenceAoEscritorio, exigirMesmoEscritorio } =
  require('../src/services/escritorio.service');

function mockModule(relativePath, exports) {
  const filename = require.resolve(relativePath);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

mockModule('../src/repositories/cliente.repository', {
  async listarTodos() { return [
    { id: 'cliente-a', nome: 'Cliente A', criadoPor: 'membro-a' },
    { id: 'cliente-b', nome: 'Cliente B', escritorioId: 'admin-b' },
    { id: 'sem-autor', nome: 'Sem autor' }
  ]; }
});
mockModule('../src/repositories/lancamento.repository', {
  async buscar() { return [
    { id: 'receita-a', descricao: 'A', valor: 100, status: 'PENDENTE', criadoPor: 'admin-a' },
    { id: 'receita-b', descricao: 'B', valor: 200, status: 'PENDENTE', escritorioId: 'admin-b' },
    { id: 'receita-sem-autor', descricao: 'C', valor: 300, status: 'PENDENTE' }
  ]; }
});
const clienteService = require('../src/services/cliente.service');
const lancamentoService = require('../src/services/lancamento.service');

test('convite aceito associa o membro ao escritorio do administrador', async () => {
  assert.equal(await escritorioDoUsuario('membro-a'), 'admin-a');
  assert.equal(await escritorioDoUsuario('admin-b'), 'admin-b');
});

test('equipe le registros novos e antigos do mesmo escritorio', async () => {
  const user = { uid: 'membro-a', escritorioId: 'admin-a' };
  assert.equal(await pertenceAoEscritorio({ escritorioId: 'admin-a' }, user), true);
  assert.equal(await pertenceAoEscritorio({ criadoPor: 'admin-a' }, user), true);
  assert.equal(await pertenceAoEscritorio({ criadoPor: 'membro-a' }, user), true);
});

test('nega outro escritorio e registro antigo sem autor', async () => {
  const user = { uid: 'admin-b', escritorioId: 'admin-b' };
  assert.equal(await pertenceAoEscritorio({ escritorioId: 'admin-a' }, user), false);
  assert.equal(await pertenceAoEscritorio({ criadoPor: 'membro-a' }, user), false);
  assert.equal(await pertenceAoEscritorio({ nome: 'Sem autor' }, user), false);
  await assert.rejects(exigirMesmoEscritorio({ criadoPor: 'admin-a' }, user), /ACESSO_NEGADO/);
});

test('listagens de clientes e financeiro respeitam o escritorio', async () => {
  const a = { uid: 'membro-a', role: 'ADVOGADO', escritorioId: 'admin-a' };
  const b = { uid: 'admin-b', role: 'ADMIN', escritorioId: 'admin-b' };
  assert.deepEqual((await clienteService.listarClientes(a)).map((item) => item.id), ['cliente-a']);
  assert.deepEqual((await clienteService.listarClientes(b)).map((item) => item.id), ['cliente-b']);
  assert.deepEqual((await lancamentoService.listarLancamentos({}, a)).map((item) => item.id), ['receita-a']);
  assert.deepEqual((await lancamentoService.listarLancamentos({}, b)).map((item) => item.id), ['receita-b']);
});
