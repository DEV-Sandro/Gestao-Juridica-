const { z } = require('zod');
const clienteRepository = require('../repositories/cliente.repository');
const processoRepository = require('../repositories/processo.repository');
const auditoriaService = require('./auditoria.service');

const textoObrigatorio = (max, mensagem) =>
  z.string({ message: mensagem }).trim().min(1, mensagem).max(max, mensagem);

const textoOpcional = (max) =>
  z
    .union([z.string().trim().max(max), z.null(), z.undefined()])
    .transform((valor) => (typeof valor === 'string' ? valor.trim() || null : null));

const cpfRegex = /^\d{11}$/;

const schemaCliente = z.object({
  nome: textoObrigatorio(140, 'Informe o nome do cliente.'),
  cpf: textoOpcional(14).refine((valor) => !valor || cpfRegex.test(valor.replace(/\D/g, '')), {
    message: 'CPF invalido. Use 11 digitos.'
  }),
  email: textoOpcional(160).refine(
    (valor) => !valor || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor),
    { message: 'E-mail invalido.' }
  ),
  telefone: textoOpcional(32),
  documentoSecundario: textoOpcional(32),
  endereco: textoOpcional(180),
  numero: textoOpcional(20),
  complemento: textoOpcional(80),
  bairro: textoOpcional(80),
  cidade: textoOpcional(80),
  estado: textoOpcional(2),
  cep: textoOpcional(12),
  observacoes: textoOpcional(500)
});

function formatarCpf(valor) {
  if (!valor) {
    return null;
  }

  const digitos = valor.replace(/\D/g, '');
  if (digitos.length !== 11) {
    return digitos;
  }

  return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function normalizarNomeBusca(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function sanitizarCliente(cliente) {
  return {
    id: cliente.id,
    nome: cliente.nome || '',
    cpf: formatarCpf(cliente.cpf || null),
    email: cliente.email || null,
    telefone: cliente.telefone || null,
    documentoSecundario: cliente.documentoSecundario || null,
    endereco: cliente.endereco || null,
    numero: cliente.numero || null,
    complemento: cliente.complemento || null,
    bairro: cliente.bairro || null,
    cidade: cliente.cidade || null,
    estado: cliente.estado || null,
    cep: cliente.cep || null,
    observacoes: cliente.observacoes || null,
    ativo: cliente.ativo !== false,
    criadoEm: cliente.criadoEm || null,
    atualizadoEm: cliente.atualizadoEm || null
  };
}

function validarCliente(dados) {
  const resultado = schemaCliente.safeParse(dados);
  if (!resultado.success) {
    const erro = new Error('VALIDACAO_CLIENTE');
    erro.details = resultado.error.issues.map((issue) => issue.message);
    throw erro;
  }

  return {
    ...resultado.data,
    cpf: resultado.data.cpf ? resultado.data.cpf.replace(/\D/g, '') : null,
    estado: resultado.data.estado ? resultado.data.estado.toUpperCase() : null
  };
}

async function listarClientes() {
  const clientes = await clienteRepository.listarTodos();
  return clientes
    .map(sanitizarCliente)
    .sort((primeiro, segundo) => primeiro.nome.localeCompare(segundo.nome, 'pt-BR'));
}

async function criarCliente(dados, user) {
  const payload = validarCliente(dados);
  const agora = new Date().toISOString();
  const id = await clienteRepository.criar({
    ...payload,
    nomeBusca: normalizarNomeBusca(payload.nome),
    ativo: true,
    criadoEm: agora,
    criadoPor: user.uid,
    atualizadoEm: agora,
    atualizadoPor: user.uid
  });

  const criado = await clienteRepository.buscarPorId(id);
  return sanitizarCliente(criado || { id, ...payload });
}

async function atualizarCliente(id, dados, user) {
  const existente = await clienteRepository.buscarPorId(id);
  if (!existente || existente.ativo === false) {
    throw new Error('CLIENTE_NAO_ENCONTRADO');
  }

  const payload = validarCliente({
    ...existente,
    ...dados
  });

  await clienteRepository.atualizar(id, {
    ...payload,
    nomeBusca: normalizarNomeBusca(payload.nome),
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: user.uid
  });

  const atualizado = await clienteRepository.buscarPorId(id);
  return sanitizarCliente(atualizado || { id, ...payload });
}

async function contarProcessosVinculados(clienteId) {
  const processos = await processoRepository.buscarTodos();
  return processos.filter((processo) => processo.clienteId === clienteId && processo.deletado !== true)
    .length;
}

async function arquivarCliente(id, user) {
  const existente = await clienteRepository.buscarPorId(id);
  if (!existente || existente.ativo === false) {
    throw new Error('CLIENTE_NAO_ENCONTRADO');
  }

  const totalProcessosVinculados = await contarProcessosVinculados(id);
  const agora = new Date().toISOString();

  await clienteRepository.atualizar(id, {
    ativo: false,
    nomeBusca: normalizarNomeBusca(existente.nome),
    inativadoEm: agora,
    inativadoPor: user.uid,
    atualizadoEm: agora,
    atualizadoPor: user.uid
  });

  await auditoriaService.registrarEvento({
    acao: 'ARQUIVAR',
    entidade: 'CLIENTE',
    entidadeId: id,
    usuario: user,
    detalhes: {
      clienteNome: existente.nome || null,
      totalProcessosVinculados
    }
  });

  const atualizado = await clienteRepository.buscarPorId(id);

  return {
    cliente: sanitizarCliente(atualizado || { ...existente, id, ativo: false }),
    modo: 'inativado',
    possuiProcessosVinculados: totalProcessosVinculados > 0,
    totalProcessosVinculados
  };
}

module.exports = {
  listarClientes,
  criarCliente,
  atualizarCliente,
  arquivarCliente
};
