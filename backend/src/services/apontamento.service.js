const { db } = require('../config/firebase');
const processoRepository = require('../repositories/processo.repository');
const auditoriaService = require('./auditoria.service');

const COLLECTION = 'apontamentos_horas';

function dataValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function dinheiro(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0 || numero > 100000) throw new Error('VALIDACAO_APONTAMENTO');
  return Math.round(numero * 100) / 100;
}

function visivelPara(item, user) {
  return user.role === 'ADMIN' || item.advogadoId === user.uid;
}

async function listar(query, user) {
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((item) => !item.deletado && visivelPara(item, user))
    .filter((item) => !query.processoId || item.processoId === query.processoId)
    .sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm));
}

async function criar(dados, user) {
  const processoId = String(dados.processoId || '').trim();
  const descricao = String(dados.descricao || '').trim();
  const minutos = Number(dados.minutos);
  if (!processoId || !descricao || descricao.length > 240 || !dataValida(dados.data) ||
      !Number.isInteger(minutos) || minutos < 1 || minutos > 1440) {
    throw new Error('VALIDACAO_APONTAMENTO');
  }

  const processo = await processoRepository.buscarPorId(processoId);
  if (!processo || processo.deletado) throw new Error('PROCESSO_NAO_ENCONTRADO');

  const agora = new Date().toISOString();
  const item = {
    processoId,
    processoTitulo: processo.titulo || processo.tipo || 'Processo',
    clienteNome: processo.clienteNome || null,
    descricao,
    data: dados.data,
    minutos,
    valorHora: dinheiro(dados.valorHora ?? 0),
    custoHora: dinheiro(dados.custoHora ?? 0),
    advogadoId: user.uid,
    advogadoNome: user.displayName || user.email || 'Equipe',
    criadoEm: agora,
    atualizadoEm: agora,
    deletado: false
  };
  const ref = await db.collection(COLLECTION).add(item);
  await auditoriaService.registrarEvento({ acao: 'CRIAR', entidade: 'APONTAMENTO_HORAS', entidadeId: ref.id, usuario: user, detalhes: { processoId, minutos } });
  return { id: ref.id, ...item };
}

async function excluir(id, user) {
  const ref = db.collection(COLLECTION).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data().deletado) throw new Error('APONTAMENTO_NAO_ENCONTRADO');
  if (!visivelPara(snapshot.data(), user)) throw new Error('ACESSO_NEGADO');
  await ref.update({ deletado: true, deletadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString() });
  await auditoriaService.registrarEvento({ acao: 'DELETAR_SOFT', entidade: 'APONTAMENTO_HORAS', entidadeId: id, usuario: user, detalhes: { processoId: snapshot.data().processoId } });
}

module.exports = { listar, criar, excluir, dataValida };
