const { z } = require('zod');
const clienteRepository = require('../repositories/cliente.repository');
const processoRepository = require('../repositories/processo.repository');
const auditoriaService = require('./auditoria.service');
const { pertenceAoEscritorio, exigirMesmoEscritorio } = require('./escritorio.service');

const textoObrigatorio = (max, mensagem) =>
  z.string({ message: mensagem }).trim().min(1, mensagem).max(max, mensagem);

const textoOpcional = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((valor) => (typeof valor === 'string' ? valor.trim() || null : null));

const cpfRegex = /^\d{11}$/;
const cnpjRegex = /^[A-Z0-9]{12}\d{2}$/;

const schemaCliente = z.object({
  nome: textoObrigatorio(140, 'Informe o nome do cliente.'),
  cpf: textoOpcional(14).refine((valor) => !valor || cpfRegex.test(valor.replace(/\D/g, '')), {
    message: 'CPF invalido. Use 11 digitos.'
  }),
  cnpj: textoOpcional(18).refine((valor) => !valor || cnpjRegex.test(valor.toUpperCase().replace(/[^A-Z0-9]/g, '')), {
    message: 'CNPJ invalido. Use 12 caracteres e 2 digitos verificadores.'
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

function formatarCnpj(valor) {
  if (!valor) return null;
  const caracteres = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cnpjRegex.test(caracteres)
    ? caracteres.replace(/(.{2})(.{3})(.{3})(.{4})(.{2})/, '$1.$2.$3/$4-$5')
    : caracteres;
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
    cnpj: formatarCnpj(cliente.cnpj || (String(cliente.documentoSecundario || '').replace(/[^A-Za-z0-9]/g, '').length === 14 ? cliente.documentoSecundario : null)),
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

  if (resultado.data.cpf && resultado.data.cnpj) {
    const erro = new Error('VALIDACAO_CLIENTE');
    erro.details = ['Informe CPF ou CNPJ, não os dois.'];
    throw erro;
  }

  return {
    ...resultado.data,
    cpf: resultado.data.cpf ? resultado.data.cpf.replace(/\D/g, '') : null,
    cnpj: resultado.data.cnpj ? resultado.data.cnpj.toUpperCase().replace(/[^A-Z0-9]/g, '') : null,
    estado: resultado.data.estado ? resultado.data.estado.toUpperCase() : null
  };
}

async function listarClientes(user) {
  const clientes = await clienteRepository.listarTodos();
  const permitidos = await Promise.all(clientes.map(async (cliente) =>
    (await pertenceAoEscritorio(cliente, user)) ? cliente : null));
  return permitidos.filter(Boolean)
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
    escritorioId: user.escritorioId,
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
  await exigirMesmoEscritorio(existente, user);

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

async function contarProcessosVinculados(clienteId, user) {
  const processos = await processoRepository.buscarTodos();
  const vinculados = processos.filter((processo) => processo.clienteId === clienteId && processo.deletado !== true);
  const permitidos = await Promise.all(vinculados.map((processo) => pertenceAoEscritorio(processo, user)));
  return permitidos.filter(Boolean).length;
}

async function arquivarCliente(id, user) {
  const existente = await clienteRepository.buscarPorId(id);
  if (!existente || existente.ativo === false) {
    throw new Error('CLIENTE_NAO_ENCONTRADO');
  }
  await exigirMesmoEscritorio(existente, user);

  const totalProcessosVinculados = await contarProcessosVinculados(id, user);
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
