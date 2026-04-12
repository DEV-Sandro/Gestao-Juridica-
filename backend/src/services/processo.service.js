const { db } = require('../config/firebase');
const processoRepository = require('../repositories/processo.repository');
const etapaRepository = require('../repositories/etapa.repository');
const auditoriaRepository = require('../repositories/auditoria.repository');
const auditoriaService = require('./auditoria.service');
const clienteRepository = require('../repositories/cliente.repository');
const {
  calcularStatusInteligente,
  normalizarCategoriaCompromisso
} = require('../utils/status.util');

const STATUS_PERMITIDOS = new Set([
  'Aguardando Analise',
  'Aguardando Análise',
  'Em Andamento',
  'Urgente',
  'Concluido',
  'Concluído',
  'Cancelado',
  'Indeferido',
  'Arquivado'
]);

const STATUS_ETAPA_PERMITIDOS = new Set(['PENDENTE', 'CONCLUIDO']);
const STATUS_ORCAMENTO_PERMITIDOS = new Set([
  'RASCUNHO',
  'ENVIADO_CLIENTE',
  'AGUARDANDO_RESPOSTA_CLIENTE',
  'ACEITO',
  'RECUSADO',
  'CONVERTIDO_CONTRATO'
]);

async function obterDiasArquivamento() {
  const doc = await db.collection('configuracoes').doc('arquivamento').get();

  if (!doc.exists) return 30;

  return Number(doc.data().dias) || 30;
}

function normalizarBoolean(valor) {
  if (valor === undefined) return undefined;
  if (typeof valor === 'boolean') return valor;
  if (valor === null || valor === '') return false;
  if (typeof valor === 'string') {
    return ['true', '1', 'sim'].includes(valor.trim().toLowerCase());
  }

  return Boolean(valor);
}

function normalizarTexto(valor, tamanhoMaximo, obrigatorio = false) {
  if (valor === undefined) {
    return undefined;
  }

  if (valor === null) {
    if (obrigatorio) throw new Error('VALIDACAO_FALHOU');
    return null;
  }

  if (typeof valor !== 'string') {
    throw new Error('VALIDACAO_FALHOU');
  }

  const texto = valor.trim();

  if (!texto) {
    if (obrigatorio) throw new Error('VALIDACAO_FALHOU');
    return null;
  }

  return texto.slice(0, tamanhoMaximo);
}

function normalizarPrazo(valor) {
  if (valor === undefined) return undefined;
  if (valor === null || valor === '') return null;

  if (typeof valor === 'string') {
    const match = valor.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];

    const data = new Date(valor);
    if (!Number.isNaN(data.getTime())) {
      return data.toISOString().slice(0, 10);
    }
  }

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor.toISOString().slice(0, 10);
  }

  throw new Error('VALIDACAO_FALHOU');
}

function normalizarStatus(valor, fallback = 'Aguardando Analise') {
  if (valor === undefined) {
    return undefined;
  }

  if (valor === null || valor === '') {
    return fallback;
  }

  if (typeof valor !== 'string') {
    throw new Error('VALIDACAO_FALHOU');
  }

  const status = valor.trim();
  if (!STATUS_PERMITIDOS.has(status)) {
    throw new Error('VALIDACAO_FALHOU');
  }

  if (status === 'Aguardando Analise') return 'Aguardando Análise';
  if (status === 'Concluido') return 'Concluído';
  return status;
}

function normalizarStatusEtapa(valor) {
  if (typeof valor !== 'string') {
    throw new Error('VALIDACAO_FALHOU');
  }

  const status = valor.trim().toUpperCase();
  if (!STATUS_ETAPA_PERMITIDOS.has(status)) {
    throw new Error('VALIDACAO_FALHOU');
  }

  return status;
}

function rotuloCategoriaCompromisso(tipo) {
  switch (normalizarCategoriaCompromisso(tipo)) {
    case 'AUDIENCIA':
      return 'audiencia';
    case 'EVENTO':
      return 'evento';
    case 'DOCUMENTO':
      return 'documento';
    default:
      return 'prazo';
  }
}

function normalizarDocumento(valor) {
  if (!valor) return null;
  const digitos = String(valor).replace(/\D/g, '');
  return digitos || null;
}

function normalizarEmail(valor) {
  if (!valor) return null;
  return String(valor).trim().toLowerCase() || null;
}

function normalizarBooleanoOpcional(valor) {
  if (valor === undefined) {
    return undefined;
  }

  if (typeof valor === 'boolean') {
    return valor;
  }

  if (typeof valor === 'string') {
    const normalizado = valor.trim().toLowerCase();
    if (['true', '1', 'sim', 'yes'].includes(normalizado)) return true;
    if (['false', '0', 'nao', 'não', 'no'].includes(normalizado)) return false;
  }

  throw new Error('VALIDACAO_FALHOU');
}

function normalizarNomeComparavel(valor) {
  if (!valor) return '';
  return String(valor).trim().toLowerCase();
}

function formatarDataHoraCurta(iso) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(iso));
}

function normalizarValorMonetario(valor) {
  if (valor === undefined) return undefined;
  if (valor === null || valor === '') return null;

  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return Number(valor.toFixed(2));
  }

  if (typeof valor === 'string') {
    const texto = valor.trim();
    if (!texto) return null;

    const normalizado = texto
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^0-9.-]/g, '');

    const numero = Number(normalizado);
    if (Number.isNaN(numero) || numero < 0) {
      throw new Error('VALIDACAO_FALHOU');
    }

    return Number(numero.toFixed(2));
  }

  throw new Error('VALIDACAO_FALHOU');
}

function formatarMoedaBr(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return 'valor nao informado';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

function normalizarStatusOrcamento(valor, fallback = 'RASCUNHO') {
  if (valor === undefined) {
    return undefined;
  }

  if (valor === null || valor === '') {
    return fallback;
  }

  if (typeof valor !== 'string') {
    throw new Error('VALIDACAO_FALHOU');
  }

  const status = valor.trim().toUpperCase();
  if (!STATUS_ORCAMENTO_PERMITIDOS.has(status)) {
    throw new Error('VALIDACAO_FALHOU');
  }

  return status;
}

function resolverStatusOrcamento(acao, statusInformado, statusAtual = 'RASCUNHO') {
  const acaoNormalizada = String(acao || 'SALVAR').trim().toUpperCase();

  switch (acaoNormalizada) {
    case 'REGISTRAR_ENVIO':
    case 'AGUARDAR_RESPOSTA':
      return 'AGUARDANDO_RESPOSTA_CLIENTE';
    case 'MARCAR_ACEITO':
      return 'ACEITO';
    case 'MARCAR_RECUSADO':
      return 'RECUSADO';
    case 'ENVIAR_CLIENTE':
      return 'ENVIADO_CLIENTE';
    case 'SALVAR_RASCUNHO':
      return 'RASCUNHO';
    default:
      return statusInformado || statusAtual || 'RASCUNHO';
  }
}

function montarPayloadOrcamento(dados, orcamentoAtual = null) {
  const payload = {};

  const valor = normalizarValorMonetario(
    dados.valorHonorarios ?? dados.valor ?? dados.honorariosValor
  );
  if (valor !== undefined) payload.valor = valor;

  const descricaoServico = normalizarTexto(
    dados.descricaoServico ?? dados.escopoServico ?? dados.descricao,
    3000
  );
  if (descricaoServico !== undefined) payload.descricaoServico = descricaoServico;

  const observacoes = normalizarTexto(dados.observacoes ?? dados.observacoesOrcamento, 3000);
  if (observacoes !== undefined) payload.observacoes = observacoes;

  const estadoOab = normalizarTexto(dados.estadoOab ?? dados.ufOab, 2);
  if (estadoOab !== undefined) payload.estadoOab = estadoOab ? estadoOab.toUpperCase() : null;

  const status = normalizarStatusOrcamento(
    dados.status,
    orcamentoAtual?.status || 'RASCUNHO'
  );
  if (status !== undefined) payload.status = status;

  return payload;
}

function descreverMudancasOrcamento(orcamentoAtual, proximoOrcamento) {
  const campos = [
    ['valor', 'Valor'],
    ['descricaoServico', 'Escopo'],
    ['observacoes', 'Observacoes'],
    ['estadoOab', 'Tabela OAB'],
    ['status', 'Status']
  ];

  return campos
    .map(([campo, label]) => {
      const anterior = orcamentoAtual?.[campo] ?? null;
      const proximo = proximoOrcamento?.[campo] ?? null;

      if (String(anterior ?? '') === String(proximo ?? '')) {
        return null;
      }

      const valorAnterior =
        campo === 'valor' ? formatarMoedaBr(anterior) : formatarValorAuditoria(campo, anterior);
      const valorProximo =
        campo === 'valor' ? formatarMoedaBr(proximo) : formatarValorAuditoria(campo, proximo);

      return `${label}: ${valorAnterior} -> ${valorProximo}`;
    })
    .filter(Boolean)
    .join(' | ');
}

function montarOrcamentoResposta(orcamento) {
  if (!orcamento || typeof orcamento !== 'object') {
    return null;
  }

  let valor = null;
  try {
    valor = normalizarValorMonetario(orcamento.valor) ?? null;
  } catch (error) {
    valor = null;
  }

  return {
    ...orcamento,
    valor,
    status: normalizarStatusOrcamento(orcamento.status, 'RASCUNHO') || 'RASCUNHO',
    estadoOab: normalizarTexto(orcamento.estadoOab, 2) || null
  };
}

const CAMPOS_AUDITORIA_LABEL = {
  titulo: 'Titulo do processo',
  descricao: 'Descricao',
  prazo: 'Prazo principal',
  status: 'Status',
  clienteNome: 'Cliente vinculado',
  categoriaCompromisso: 'Tipo de compromisso',
  localCompromisso: 'Local ou referencia',
  urgenteManual: 'Prioridade manual'
};

function formatarValorAuditoria(campo, valor) {
  if (valor === null || valor === undefined || valor === '') {
    return 'nao informado';
  }

  if (campo === 'prazo') {
    return valor;
  }

  if (campo === 'urgenteManual') {
    return valor ? 'ativada' : 'desativada';
  }

  return String(valor);
}

function extrairMudancasProcesso(payload, processoAtual) {
  return Object.keys(payload)
    .filter((campo) => campo !== 'atualizadoEm' && campo !== 'atualizadoPor')
    .map((campo) => ({
      campo,
      de: processoAtual?.[campo] ?? null,
      para: payload[campo] ?? null
    }))
    .filter((mudanca) => String(mudanca.de ?? '') !== String(mudanca.para ?? ''));
}

function resumirMudancasProcesso(mudancas) {
  if (!mudancas.length) {
    return 'Ajustes internos registrados no processo.';
  }

  return mudancas
    .map((mudanca) => {
      const label = CAMPOS_AUDITORIA_LABEL[mudanca.campo] || mudanca.campo;
      const anterior = formatarValorAuditoria(mudanca.campo, mudanca.de);
      const proximo = formatarValorAuditoria(mudanca.campo, mudanca.para);
      return `${label}: ${anterior} -> ${proximo}`;
    })
    .join(' | ');
}

function montarProcessoResposta(processo, diasParaArquivar) {
  return {
    ...processo,
    orcamento: montarOrcamentoResposta(processo.orcamento),
    urgenteManual: processo.urgenteManual === true,
    categoriaCompromisso: normalizarCategoriaCompromisso(processo.categoriaCompromisso),
    statusCalculado: calcularStatusInteligente(processo, diasParaArquivar)
  };
}

async function registrarAcessoNegado(processoId, user, motivo) {
  try {
    await auditoriaService.registrarEvento({
      acao: 'ACESSO_NEGADO',
      entidade: 'PROCESSO',
      entidadeId: processoId,
      usuario: user,
      detalhes: { motivo }
    });
  } catch (error) {
    console.error('ERRO AO SALVAR AUDITORIA DE ACESSO_NEGADO:', error);
  }
}

async function obterProcessoComAcesso(processoId, user, motivoAcessoNegado) {
  const processo = await processoRepository.buscarPorId(processoId);

  if (!processo || processo.deletado) {
    throw new Error('PROCESSO_NAO_ENCONTRADO');
  }

  if (user.role === 'CLIENT' && processo.clienteId !== user.uid) {
    await registrarAcessoNegado(processoId, user, motivoAcessoNegado);
    throw new Error('ACESSO_NEGADO');
  }

  return processo;
}

function montarPayloadProcesso(dados, processoAtual = null) {
  const payload = {};

  const titulo =
    normalizarTexto(dados.titulo, 160) ??
    normalizarTexto(dados.tipo, 160) ??
    normalizarTexto(dados.assunto, 160);
  if (titulo !== undefined) payload.titulo = titulo || 'Processo sem titulo';

  const descricao =
    normalizarTexto(dados.descricao, 5000) ??
    normalizarTexto(dados.observacao, 5000);
  if (descricao !== undefined) payload.descricao = descricao || '';

  const advogadoId = normalizarTexto(dados.advogadoId, 120);
  if (advogadoId !== undefined) payload.advogadoId = advogadoId;

  const prazo = normalizarPrazo(dados.prazo);
  if (prazo !== undefined) payload.prazo = prazo;

  const status = normalizarStatus(dados.status);
  if (status !== undefined) payload.status = status;

  const urgenteManual = normalizarBoolean(dados.urgenteManual);
  if (urgenteManual !== undefined) payload.urgenteManual = urgenteManual;

  if (dados.categoriaCompromisso !== undefined) {
    payload.categoriaCompromisso = normalizarCategoriaCompromisso(dados.categoriaCompromisso);
  }

  const localCompromisso = normalizarTexto(dados.localCompromisso, 160);
  if (localCompromisso !== undefined) payload.localCompromisso = localCompromisso;

  if (!processoAtual) {
    if (!payload.titulo) payload.titulo = 'Processo sem titulo';
    if (!payload.descricao) payload.descricao = '';
    if (!payload.status) payload.status = 'Aguardando Análise';
    if (payload.urgenteManual === undefined) payload.urgenteManual = false;
    if (!payload.categoriaCompromisso) payload.categoriaCompromisso = 'PRAZO';
  }

  const statusFinal = payload.status ?? processoAtual?.status;
  if (statusFinal && ['Concluído', 'Cancelado', 'Indeferido', 'Arquivado'].includes(statusFinal)) {
    payload.urgenteManual = false;
  }

  if (payload.status === 'Urgente' && payload.urgenteManual === undefined) {
    payload.urgenteManual = true;
  }

  return payload;
}

function montarPayloadEtapa(dados, user) {
  const titulo = normalizarTexto(dados.titulo, 120, true);
  const dataLimite = normalizarPrazo(dados.dataLimite);
  const status = dados.status ? normalizarStatusEtapa(dados.status) : 'PENDENTE';

  if (!dataLimite) {
    throw new Error('VALIDACAO_FALHOU');
  }

  return {
    titulo,
    dataLimite,
    tipo: normalizarCategoriaCompromisso(dados.tipo),
    local: normalizarTexto(dados.local, 160) || null,
    observacao: normalizarTexto(dados.observacao, 520) || null,
    urgenteManual:
      status === 'CONCLUIDO' ? false : normalizarBooleanoOpcional(dados.urgenteManual) || false,
    status,
    criadoEm: new Date().toISOString(),
    criadoPor: user.uid
  };
}

function montarPayloadAtualizacaoEtapa(dados) {
  const payload = {};

  const titulo = normalizarTexto(dados.titulo, 120);
  if (titulo !== undefined) payload.titulo = titulo || 'Etapa sem titulo';

  const dataLimite = normalizarPrazo(dados.dataLimite);
  if (dataLimite !== undefined) payload.dataLimite = dataLimite;

  if (dados.tipo !== undefined) {
    payload.tipo = normalizarCategoriaCompromisso(dados.tipo);
  }

  const local = normalizarTexto(dados.local, 160);
  if (local !== undefined) payload.local = local;

  const observacao = normalizarTexto(dados.observacao, 520);
  if (observacao !== undefined) payload.observacao = observacao;

  const urgenteManual = normalizarBooleanoOpcional(dados.urgenteManual);
  if (urgenteManual !== undefined) payload.urgenteManual = urgenteManual;

  if (dados.status !== undefined) {
    payload.status = normalizarStatusEtapa(dados.status);
  }

  if (payload.status === 'CONCLUIDO') {
    payload.urgenteManual = false;
  }

  return payload;
}

function resumirCriacaoEtapa(payload) {
  const partes = [
    `${payload.titulo} registrada como ${rotuloCategoriaCompromisso(payload.tipo)} para ${payload.dataLimite}.`
  ];

  if (payload.local) {
    partes.push(`Referencia: ${payload.local}.`);
  }

  if (payload.urgenteManual) {
    partes.push('Urgencia manual ativada.');
  }

  if (payload.observacao) {
    partes.push(`Observacao: ${payload.observacao}.`);
  }

  if (payload.status === 'CONCLUIDO') {
    partes.push('A etapa ja foi criada como concluida.');
  }

  return partes.join(' ');
}

function resumirAtualizacaoEtapa(etapaAtual, payload) {
  const partes = [];

  if (payload.titulo && payload.titulo !== etapaAtual.titulo) {
    partes.push(`Titulo ajustado para ${payload.titulo}.`);
  }

  if (payload.tipo && payload.tipo !== etapaAtual.tipo) {
    partes.push(`Tipo alterado para ${rotuloCategoriaCompromisso(payload.tipo)}.`);
  }

  if (payload.dataLimite && payload.dataLimite !== etapaAtual.dataLimite) {
    partes.push(`Data redefinida para ${payload.dataLimite}.`);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'local')) {
    partes.push(payload.local ? `Referencia atualizada para ${payload.local}.` : 'Referencia removida.');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'observacao')) {
    partes.push(payload.observacao ? 'Observacao atualizada.' : 'Observacao removida.');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'urgenteManual')) {
    partes.push(payload.urgenteManual ? 'Urgencia manual ativada.' : 'Urgencia manual removida.');
  }

  if (payload.status === 'CONCLUIDO' && etapaAtual.status !== 'CONCLUIDO') {
    partes.push('Etapa marcada como concluida.');
  } else if (payload.status === 'PENDENTE' && etapaAtual.status === 'CONCLUIDO') {
    partes.push('Etapa reaberta para a fila pendente.');
  }

  return partes.join(' ') || 'Dados da etapa atualizados.';
}

function extrairClientePayload(dados = {}) {
  const clienteObj =
    dados.cliente && typeof dados.cliente === 'object' && !Array.isArray(dados.cliente)
      ? dados.cliente
      : {};

  const clienteId = normalizarTexto(clienteObj.id ?? dados.clienteId, 120);
  const nome =
    normalizarTexto(clienteObj.nome ?? dados.clienteNome ?? dados.cliente, 140) ?? null;
  const cpfCnpj =
    normalizarDocumento(
      clienteObj.cpfCnpj ??
        clienteObj.cpf ??
        dados.clienteCpfCnpj ??
        dados.clienteCpf ??
        dados.clienteDocumento
    ) ?? null;
  const email = normalizarEmail(clienteObj.email ?? dados.clienteEmail);
  const telefone = normalizarTexto(clienteObj.telefone ?? dados.clienteTelefone, 32) ?? null;
  const endereco = normalizarTexto(clienteObj.endereco ?? dados.clienteEndereco, 180) ?? null;
  const numero = normalizarTexto(clienteObj.numero ?? dados.clienteNumero, 20) ?? null;
  const complemento =
    normalizarTexto(clienteObj.complemento ?? dados.clienteComplemento, 80) ?? null;
  const bairro = normalizarTexto(clienteObj.bairro ?? dados.clienteBairro, 80) ?? null;
  const cidade = normalizarTexto(clienteObj.cidade ?? dados.clienteCidade, 80) ?? null;
  const estado = normalizarTexto(clienteObj.estado ?? clienteObj.uf ?? dados.clienteEstado, 2) ?? null;
  const cep = normalizarTexto(clienteObj.cep ?? dados.clienteCep, 12) ?? null;

  if (
    !clienteId &&
    !nome &&
    !cpfCnpj &&
    !email &&
    !telefone &&
    !endereco &&
    !cidade &&
    !cep
  ) {
    return null;
  }

  return {
    id: clienteId || null,
    nome,
    cpfCnpj,
    email,
    telefone,
    endereco,
    numero,
    complemento,
    bairro,
    cidade,
    estado: estado ? estado.toUpperCase() : null,
    cep
  };
}

function montarPayloadClientePersistencia(cliente) {
  const documento = cliente.cpfCnpj || null;

  return {
    nome: cliente.nome,
    cpf: documento && documento.length === 11 ? documento : null,
    documentoSecundario: documento && documento.length !== 11 ? documento : null,
    email: cliente.email || null,
    telefone: cliente.telefone || null,
    endereco: cliente.endereco || null,
    numero: cliente.numero || null,
    complemento: cliente.complemento || null,
    bairro: cliente.bairro || null,
    cidade: cliente.cidade || null,
    estado: cliente.estado || null,
    cep: cliente.cep || null
  };
}

async function carregarClientesMap() {
  const clientes = await clienteRepository.listarTodos();
  return new Map(clientes.map((cliente) => [cliente.id, cliente]));
}

async function encontrarClienteExistente(clienteInformado) {
  if (clienteInformado.id) {
    const encontrado = await clienteRepository.buscarPorId(clienteInformado.id);
    if (!encontrado || encontrado.ativo === false) {
      throw new Error('CLIENTE_NAO_ENCONTRADO');
    }

    return encontrado;
  }

  const clientes = await clienteRepository.listarTodos();
  const documento = clienteInformado.cpfCnpj || null;
  const email = clienteInformado.email || null;
  const nomeNormalizado = normalizarNomeComparavel(clienteInformado.nome);

  return (
    clientes.find((cliente) => {
      const docCliente = normalizarDocumento(cliente.cpf || cliente.documentoSecundario);
      const emailCliente = normalizarEmail(cliente.email);
      const nomeCliente = normalizarNomeComparavel(cliente.nome);

      if (documento && docCliente && documento === docCliente) return true;
      if (email && emailCliente && email === emailCliente) return true;
      if (nomeNormalizado && nomeCliente === nomeNormalizado) return true;

      return false;
    }) || null
  );
}

async function resolverClienteDoProcesso(dados, user, processoAtual = null) {
  const clienteInformado = extrairClientePayload(dados);

  if (!clienteInformado) {
    if (processoAtual) {
      return null;
    }

    throw new Error('VALIDACAO_FALHOU');
  }

  if (
    clienteInformado.id &&
    !clienteInformado.nome &&
    !clienteInformado.cpfCnpj &&
    !clienteInformado.email
  ) {
    try {
      const clientePorId = await clienteRepository.buscarPorId(clienteInformado.id);
      if (clientePorId && clientePorId.ativo !== false) {
        clienteInformado.nome = clientePorId.nome || null;
      } else {
        clienteInformado.nome = clienteInformado.id;
        clienteInformado.id = null;
      }
    } catch (error) {
      clienteInformado.nome = clienteInformado.id;
      clienteInformado.id = null;
    }
  }

  let clienteExistente = await encontrarClienteExistente(clienteInformado);

  if (clienteExistente) {
    const atualizacao = {};
    const nomeAtualizado = clienteInformado.nome || clienteExistente.nome || null;

    if (nomeAtualizado && nomeAtualizado !== clienteExistente.nome) {
      atualizacao.nome = nomeAtualizado;
    }

    const payloadCliente = montarPayloadClientePersistencia({
      ...clienteExistente,
      ...clienteInformado,
      nome: nomeAtualizado
    });

    for (const campo of [
      'cpf',
      'documentoSecundario',
      'email',
      'telefone',
      'endereco',
      'numero',
      'complemento',
      'bairro',
      'cidade',
      'estado',
      'cep'
    ]) {
      const proximoValor = payloadCliente[campo] || null;
      const atual = clienteExistente[campo] || null;

      if (proximoValor && proximoValor !== atual) {
        atualizacao[campo] = proximoValor;
      }
    }

    if (Object.keys(atualizacao).length > 0) {
      atualizacao.atualizadoEm = new Date().toISOString();
      atualizacao.atualizadoPor = user.uid;
      atualizacao.nomeBusca = normalizarNomeComparavel(nomeAtualizado);
      await clienteRepository.atualizar(clienteExistente.id, atualizacao);
      clienteExistente = {
        ...clienteExistente,
        ...atualizacao
      };
    }

    return {
      clienteId: clienteExistente.id,
      clienteNome: clienteExistente.nome
    };
  }

  if (!clienteInformado.nome) {
    throw new Error('VALIDACAO_FALHOU');
  }

  const agora = new Date().toISOString();
  const novoClientePayload = montarPayloadClientePersistencia(clienteInformado);
  const clienteId = await clienteRepository.criar({
    ...novoClientePayload,
    nomeBusca: normalizarNomeComparavel(clienteInformado.nome),
    ativo: true,
    criadoEm: agora,
    criadoPor: user.uid,
    atualizadoEm: agora,
    atualizadoPor: user.uid
  });

  return {
    clienteId,
    clienteNome: clienteInformado.nome
  };
}

async function enriquecerProcessoComCliente(processo, clientesMap = null) {
  if (processo.clienteNome) {
    return processo;
  }

  const cliente =
    clientesMap?.get(processo.clienteId) ||
    (processo.clienteId ? await clienteRepository.buscarPorId(processo.clienteId) : null);

  if (cliente?.nome) {
    return {
      ...processo,
      clienteNome: cliente.nome
    };
  }

  return processo;
}

function determinarAcaoPrincipal(camposAtualizados, payload, processoAtual) {
  if (camposAtualizados.includes('urgenteManual')) {
    return payload.urgenteManual ? 'MARCAR_URGENTE' : 'REMOVER_URGENTE';
  }

  if (payload.status === 'Concluído' && processoAtual.status !== 'Concluído') {
    return 'CONCLUIR';
  }

  if (camposAtualizados.includes('status') && payload.status !== processoAtual.status) {
    return 'ALTERAR_STATUS';
  }

  return 'ATUALIZAR';
}

async function listarProcessos(query, user) {
  const processos = await processoRepository.buscarTodos();
  const dias = await obterDiasArquivamento();
  const clientesMap = await carregarClientesMap();

  const lista = [];
  const updates = [];
  const isHistorico = query.historico === 'true';

  for (const processo of processos) {
    if (processo.deletado) continue;
    if (user.role === 'CLIENT' && processo.clienteId !== user.uid) continue;

    const processoComCliente = await enriquecerProcessoComCliente(processo, clientesMap);
    const processoResposta = montarProcessoResposta(processoComCliente, dias);

    if (
      processoResposta.statusCalculado === 'Arquivado' &&
      processo.status === 'Concluído' &&
      !processo.arquivado
    ) {
      updates.push(
        processoRepository.atualizar(processo.id, {
          arquivado: true,
          status: 'Arquivado',
          urgenteManual: false,
          atualizadoEm: new Date().toISOString(),
          atualizadoPor: user.uid
        })
      );
    }

    if (isHistorico) {
      if (['Arquivado', 'Cancelado', 'Indeferido'].includes(processoResposta.statusCalculado)) {
        lista.push(processoResposta);
      }
      continue;
    }

    if (['Arquivado', 'Cancelado', 'Indeferido'].includes(processoResposta.statusCalculado)) {
      continue;
    }

    if (!query.status || query.status === processoResposta.statusCalculado) {
      lista.push(processoResposta);
    }
  }

  if (updates.length) {
    await Promise.all(updates);
  }

  lista.sort((a, b) => {
    if (!a.prazo) return 1;
    if (!b.prazo) return -1;
    return new Date(a.prazo).getTime() - new Date(b.prazo).getTime();
  });

  return lista;
}

async function buscarPorId(id, user) {
  const processo = await obterProcessoComAcesso(
    id,
    user,
    'Cliente tentou acessar processo de outro usuario'
  );
  const dias = await obterDiasArquivamento();
  const processoComCliente = await enriquecerProcessoComCliente(processo);

  return montarProcessoResposta(processoComCliente, dias);
}

async function criarProcesso(dados, user) {
  const agora = new Date().toISOString();
  const payload = montarPayloadProcesso(dados);
  const cliente = await resolverClienteDoProcesso(dados, user);

  const novo = {
    ...payload,
    ...cliente,
    tituloBusca: normalizarNomeComparavel(payload.titulo),
    clienteNomeBusca: normalizarNomeComparavel(cliente.clienteNome),
    arquivado: false,
    deletado: false,
    criadoEm: agora,
    criadoPor: user.uid,
    atualizadoEm: agora,
    atualizadoPor: user.uid
  };

  if (!novo.advogadoId) {
    novo.advogadoId = user.uid;
  }

  const id = await processoRepository.criar(novo);

  await auditoriaService.registrarEvento({
    acao: 'CRIAR',
    entidade: 'PROCESSO',
    entidadeId: id,
    usuario: user,
    detalhes: {
      titulo: novo.titulo,
      clienteId: novo.clienteId,
      clienteNome: novo.clienteNome,
      status: novo.status,
      urgenteManual: novo.urgenteManual === true,
      categoriaCompromisso: novo.categoriaCompromisso
    }
  });

  if (novo.clienteId || novo.clienteNome) {
    await auditoriaService.registrarEvento({
      acao: 'CLIENTE_VINCULADO',
      entidade: 'PROCESSO',
      entidadeId: id,
      usuario: user,
      detalhes: {
        clienteId: novo.clienteId || null,
        clienteNome: novo.clienteNome || null
      }
    });
  }

  return id;
}

async function atualizarProcesso(id, dados, user) {
  const processoAtual = await obterProcessoComAcesso(id, user, 'Cliente tentou atualizar processo');

  if (user.role === 'CLIENT') {
    throw new Error('ACESSO_NEGADO');
  }

  const payload = montarPayloadProcesso(dados, processoAtual);
  const clienteVinculado = await resolverClienteDoProcesso(dados, user, processoAtual);
  if (clienteVinculado) {
    Object.assign(payload, clienteVinculado);
  }

  const novaObservacao = normalizarTexto(dados.novaObservacao, 2000);
  const possuiObservacao = typeof novaObservacao === 'string' && novaObservacao.length > 0;
  const camposAtualizados = Object.keys(payload);

  if (!camposAtualizados.length && !possuiObservacao) {
    throw new Error('VALIDACAO_FALHOU');
  }

  const agora = new Date().toISOString();
  const payloadPersistencia = {
    ...payload,
    tituloBusca: normalizarNomeComparavel(payload.titulo ?? processoAtual.titulo),
    clienteNomeBusca: normalizarNomeComparavel(
      (payload.clienteNome ?? processoAtual.clienteNome ?? processoAtual.clienteId) || ''
    ),
    atualizadoEm: agora,
    atualizadoPor: user.uid
  };
  const mudancas = extrairMudancasProcesso(payloadPersistencia, processoAtual);

  if (possuiObservacao) {
    payloadPersistencia.ultimaObservacao = novaObservacao;
    payloadPersistencia.ultimaObservacaoEm = agora;
  }

  await processoRepository.atualizar(id, payloadPersistencia);

  if (camposAtualizados.length > 0) {
    await auditoriaService.registrarEvento({
      acao: determinarAcaoPrincipal(camposAtualizados, payloadPersistencia, processoAtual),
      entidade: 'PROCESSO',
      entidadeId: id,
      usuario: user,
      detalhes: {
        camposAtualizados: mudancas.map(
          (mudanca) => CAMPOS_AUDITORIA_LABEL[mudanca.campo] || mudanca.campo
        ),
        mudancas,
        resumo: resumirMudancasProcesso(mudancas),
        status: payloadPersistencia.status || processoAtual.status,
        statusAnterior: processoAtual.status || null,
        statusNovo: payloadPersistencia.status || processoAtual.status || null,
        urgenteManual:
          payloadPersistencia.urgenteManual ?? processoAtual.urgenteManual ?? false,
        clienteNome: payloadPersistencia.clienteNome || processoAtual.clienteNome || null
      }
    });
  }

  const clienteAlterado =
    (payloadPersistencia.clienteId || processoAtual.clienteId) &&
    (payloadPersistencia.clienteId !== processoAtual.clienteId ||
      payloadPersistencia.clienteNome !== processoAtual.clienteNome);

  if (clienteAlterado) {
    await auditoriaService.registrarEvento({
      acao: 'CLIENTE_VINCULADO',
      entidade: 'PROCESSO',
      entidadeId: id,
      usuario: user,
      detalhes: {
        clienteId: payloadPersistencia.clienteId || processoAtual.clienteId || null,
        clienteNome: payloadPersistencia.clienteNome || processoAtual.clienteNome || null
      }
    });
  }

  if (possuiObservacao) {
    const autor = user.displayName || user.email || 'Equipe JustaPro';
    await auditoriaService.registrarEvento({
      acao: 'ADICIONAR_OBSERVACAO',
      entidade: 'PROCESSO',
      entidadeId: id,
      usuario: user,
      detalhes: {
        observacao: novaObservacao,
        autor,
        rotulo: `Observacao adicionada por ${autor} em ${formatarDataHoraCurta(agora)}\nConteudo: "${novaObservacao}"`
      }
    });
  }
}

async function atualizarOrcamento(id, dados, user) {
  const processoAtual = await obterProcessoComAcesso(id, user, 'Cliente tentou atualizar orcamento');

  if (user.role === 'CLIENT') {
    throw new Error('ACESSO_NEGADO');
  }

  const orcamentoAtual = montarOrcamentoResposta(processoAtual.orcamento) || null;
  const payload = montarPayloadOrcamento(dados, orcamentoAtual);
  const statusFinal = resolverStatusOrcamento(
    dados.acao,
    payload.status,
    orcamentoAtual?.status || 'RASCUNHO'
  );
  const agora = new Date().toISOString();

  const proximoOrcamento = {
    ...(orcamentoAtual || {}),
    ...payload,
    status: statusFinal,
    criadoEm: orcamentoAtual?.criadoEm || agora,
    criadoPor: orcamentoAtual?.criadoPor || user.uid,
    atualizadoEm: agora,
    atualizadoPor: user.uid
  };

  if (statusFinal === 'AGUARDANDO_RESPOSTA_CLIENTE') {
    proximoOrcamento.enviadoEm = orcamentoAtual?.enviadoEm || agora;
  }

  if (statusFinal === 'ENVIADO_CLIENTE') {
    proximoOrcamento.enviadoEm = orcamentoAtual?.enviadoEm || agora;
  }

  if (statusFinal === 'ACEITO' || statusFinal === 'RECUSADO') {
    proximoOrcamento.respostaClienteEm = agora;
  }

  const resumoMudancas = descreverMudancasOrcamento(orcamentoAtual, proximoOrcamento);
  if (!resumoMudancas && !!orcamentoAtual) {
    throw new Error('VALIDACAO_FALHOU');
  }

  await processoRepository.atualizar(id, {
    orcamento: proximoOrcamento,
    atualizadoEm: agora,
    atualizadoPor: user.uid
  });

  const statusAlterado = (orcamentoAtual?.status || 'RASCUNHO') !== proximoOrcamento.status;
  const acaoAuditoria = !orcamentoAtual
    ? 'CRIAR_ORCAMENTO'
    : statusAlterado
      ? 'ALTERAR_STATUS_ORCAMENTO'
      : 'ATUALIZAR_ORCAMENTO';

  await auditoriaService.registrarEvento({
    acao: acaoAuditoria,
    entidade: 'PROCESSO',
    entidadeId: id,
    usuario: user,
    detalhes: {
      statusAnterior: orcamentoAtual?.status || null,
      statusNovo: proximoOrcamento.status,
      valor: proximoOrcamento.valor ?? null,
      descricaoServico: proximoOrcamento.descricaoServico || null,
      resumo:
        resumoMudancas ||
        `Orcamento registrado com status ${String(proximoOrcamento.status || 'RASCUNHO')}.`
    }
  });

  return montarOrcamentoResposta(proximoOrcamento);
}

async function converterOrcamentoEmContrato(id, dados, user) {
  const processoAtual = await obterProcessoComAcesso(
    id,
    user,
    'Cliente tentou converter orcamento em contrato'
  );

  if (user.role === 'CLIENT') {
    throw new Error('ACESSO_NEGADO');
  }

  const orcamentoAtual = montarOrcamentoResposta(processoAtual.orcamento);
  if (!orcamentoAtual) {
    throw new Error('ORCAMENTO_NAO_ENCONTRADO');
  }

  if (!['ACEITO', 'CONVERTIDO_CONTRATO'].includes(orcamentoAtual.status || '')) {
    throw new Error('ORCAMENTO_NAO_ACEITO');
  }

  const agora = new Date().toISOString();
  const templateNome = normalizarTexto(dados.templateNome, 140) || 'Contrato de honorarios';

  const proximoOrcamento = {
    ...orcamentoAtual,
    status: 'CONVERTIDO_CONTRATO',
    convertidoContratoEm: orcamentoAtual.convertidoContratoEm || agora,
    atualizadoEm: agora,
    atualizadoPor: user.uid
  };

  await processoRepository.atualizar(id, {
    orcamento: proximoOrcamento,
    atualizadoEm: agora,
    atualizadoPor: user.uid
  });

  await auditoriaService.registrarEvento({
    acao: 'CONVERTER_ORCAMENTO_CONTRATO',
    entidade: 'PROCESSO',
    entidadeId: id,
    usuario: user,
    detalhes: {
      valor: proximoOrcamento.valor ?? null,
      descricaoServico: proximoOrcamento.descricaoServico || null,
      templateNome
    }
  });

  await auditoriaService.registrarEvento({
    acao: 'DOCUMENTO_GERADO',
    entidade: 'PROCESSO',
    entidadeId: id,
    usuario: user,
    detalhes: {
      templateId: normalizarTexto(dados.templateId, 80) || 'honorarios',
      templateNome
    }
  });

  return montarOrcamentoResposta(proximoOrcamento);
}

async function registrarDocumentoGerado(id, dados, user) {
  await obterProcessoComAcesso(id, user, 'Cliente tentou registrar documento de outro processo');

  if (user.role === 'CLIENT') {
    throw new Error('ACESSO_NEGADO');
  }

  const templateId = normalizarTexto(dados.templateId, 80, true);
  const templateNome = normalizarTexto(dados.templateNome, 140) || templateId;

  await auditoriaService.registrarEvento({
    acao: 'DOCUMENTO_GERADO',
    entidade: 'PROCESSO',
    entidadeId: id,
    usuario: user,
    detalhes: {
      templateId,
      templateNome
    }
  });

  return {
    ok: true
  };
}

async function deletarProcesso(id, user) {
  const processoAtual = await obterProcessoComAcesso(id, user, 'Cliente tentou excluir processo');

  if (user.role === 'CLIENT') {
    throw new Error('ACESSO_NEGADO');
  }

  await processoRepository.deletarSoft(id, {
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: user.uid
  });

  await auditoriaService.registrarEvento({
    acao: 'DELETAR_SOFT',
    entidade: 'PROCESSO',
    entidadeId: id,
    usuario: user,
    detalhes: {
      titulo: processoAtual.titulo || null
    }
  });
}

async function listarEtapas(procId, user) {
  await obterProcessoComAcesso(procId, user, 'Cliente tentou visualizar etapas de outro processo');

  const etapas = await etapaRepository.listar(procId);
  return etapas.map((etapa) => ({
    ...etapa,
    tipo: normalizarCategoriaCompromisso(etapa.tipo),
    status: etapa.status || 'PENDENTE',
    urgenteManual: etapa.urgenteManual === true,
    observacao: etapa.observacao || null
  }));
}

async function criarEtapa(procId, dados, user) {
  await obterProcessoComAcesso(procId, user, 'Cliente tentou criar etapa');

  if (user.role === 'CLIENT') {
    throw new Error('ACESSO_NEGADO');
  }

  const payload = montarPayloadEtapa(dados, user);
  const etapaId = await etapaRepository.criar(procId, payload);

  await auditoriaService.registrarEvento({
    acao: 'CRIAR_ETAPA',
    entidade: 'PROCESSO',
    entidadeId: procId,
    usuario: user,
    detalhes: {
      etapaId,
      titulo: payload.titulo,
      tipo: payload.tipo,
      dataLimite: payload.dataLimite,
      local: payload.local || null,
      urgenteManual: payload.urgenteManual === true,
      observacao: payload.observacao || null,
      status: payload.status,
      resumo: resumirCriacaoEtapa(payload)
    }
  });

  return {
    id: etapaId,
    ...payload
  };
}

async function atualizarEtapa(procId, etapaId, dados, user) {
  await obterProcessoComAcesso(procId, user, 'Cliente tentou alterar etapa');

  if (user.role === 'CLIENT') {
    throw new Error('ACESSO_NEGADO');
  }

  const etapaAtual = await etapaRepository.buscarPorId(procId, etapaId);
  if (!etapaAtual) {
    throw new Error('PROCESSO_NAO_ENCONTRADO');
  }

  const payload = montarPayloadAtualizacaoEtapa(dados);
  const camposAtualizados = Object.keys(payload);

  if (!camposAtualizados.length) {
    throw new Error('VALIDACAO_FALHOU');
  }

  payload.atualizadoEm = new Date().toISOString();
  payload.atualizadoPor = user.uid;

  await etapaRepository.atualizar(procId, etapaId, payload);

  let acaoAuditoria = 'ATUALIZAR_ETAPA';
  if (payload.status === 'CONCLUIDO' && etapaAtual.status !== 'CONCLUIDO') {
    acaoAuditoria = 'CONCLUIR_ETAPA';
  } else if (payload.status === 'PENDENTE' && etapaAtual.status === 'CONCLUIDO') {
    acaoAuditoria = 'REABRIR_ETAPA';
  }

  await auditoriaService.registrarEvento({
    acao: acaoAuditoria,
    entidade: 'PROCESSO',
    entidadeId: procId,
    usuario: user,
    detalhes: {
      etapaId,
      titulo: payload.titulo || etapaAtual.titulo,
      status: payload.status || etapaAtual.status || 'PENDENTE',
      camposAtualizados,
      resumo: resumirAtualizacaoEtapa(etapaAtual, payload),
      tipo: payload.tipo || etapaAtual.tipo || 'PRAZO',
      dataLimite: payload.dataLimite || etapaAtual.dataLimite || null,
      local:
        Object.prototype.hasOwnProperty.call(payload, 'local') ? payload.local : etapaAtual.local || null,
      urgenteManual:
        Object.prototype.hasOwnProperty.call(payload, 'urgenteManual')
          ? payload.urgenteManual === true
          : etapaAtual.urgenteManual === true,
      observacao:
        Object.prototype.hasOwnProperty.call(payload, 'observacao')
          ? payload.observacao || null
          : etapaAtual.observacao || null
    }
  });

  return {
    ...etapaAtual,
    ...payload
  };
}

async function deletarEtapa(procId, etapaId, user) {
  await obterProcessoComAcesso(procId, user, 'Cliente tentou excluir etapa');

  if (user.role === 'CLIENT') {
    throw new Error('ACESSO_NEGADO');
  }

  const etapaAtual = await etapaRepository.buscarPorId(procId, etapaId);
  if (!etapaAtual) {
    throw new Error('PROCESSO_NAO_ENCONTRADO');
  }

  await etapaRepository.deletar(procId, etapaId);

  await auditoriaService.registrarEvento({
    acao: 'REMOVER_ETAPA',
    entidade: 'PROCESSO',
    entidadeId: procId,
    usuario: user,
    detalhes: {
      etapaId,
      titulo: etapaAtual.titulo,
      dataLimite: etapaAtual.dataLimite || null,
      resumo: `${etapaAtual.titulo} removida da linha de execucao.`
    }
  });
}

async function listarHistorico(id, user) {
  await obterProcessoComAcesso(id, user, 'Cliente tentou visualizar historico de outro processo');

  const registros = await auditoriaRepository.listarPorEntidade('PROCESSO', id, 80);
  return registros;
}

module.exports = {
  listarProcessos,
  buscarPorId,
  criarProcesso,
  atualizarProcesso,
  atualizarOrcamento,
  converterOrcamentoEmContrato,
  registrarDocumentoGerado,
  deletarProcesso,
  listarEtapas,
  criarEtapa,
  atualizarEtapa,
  deletarEtapa,
  listarHistorico
};
