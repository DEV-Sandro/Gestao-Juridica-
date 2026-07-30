const PizZip = require('pizzip');

const templateRepository = require('../repositories/template.repository');
const storageUtil = require('../utils/storage.util');
const auditoriaService = require('./auditoria.service');
const { mesmoTenant } = require('../config/tenant');
const { tenantAtual } = require('../config/tenant-context');

const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5MB — mesmo teto do parser JSON do app.

function normalizarTexto(valor, tamanhoMaximo, obrigatorio = false) {
  if (typeof valor !== 'string') {
    if (obrigatorio) throw new Error('VALIDACAO_TEMPLATE');
    return null;
  }
  const texto = valor.trim();
  if (!texto) {
    if (obrigatorio) throw new Error('VALIDACAO_TEMPLATE');
    return null;
  }
  return texto.slice(0, tamanhoMaximo);
}

function decodificarBase64(arquivoBase64) {
  if (typeof arquivoBase64 !== 'string' || !arquivoBase64.trim()) {
    throw new Error('VALIDACAO_TEMPLATE');
  }
  // Aceita tanto data URI (data:...;base64,XXXX) quanto base64 puro.
  const base64 = arquivoBase64.includes(',') ? arquivoBase64.split(',').pop() : arquivoBase64;
  const buffer = Buffer.from(base64, 'base64');

  if (!buffer.length || buffer.length > TAMANHO_MAXIMO) {
    throw new Error('TEMPLATE_ARQUIVO_INVALIDO');
  }

  // .docx e um zip — os dois primeiros bytes sao 'PK'. Valida cedo para dar erro
  // amigavel em vez de estourar no PizZip.
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error('TEMPLATE_ARQUIVO_INVALIDO');
  }

  return buffer;
}

// Extrai os placeholders {variavel} do corpo do .docx. O Word costuma fragmentar
// um placeholder em varios "runs" XML (ex.: {cli}<tag>ente_nome}), entao removemos
// as tags XML antes de casar os tokens — testado com os modelos reais do escritorio.
function extrairVariaveis(buffer) {
  const zip = new PizZip(buffer);
  const doc = zip.file('word/document.xml');
  if (!doc) return [];

  const textoPuro = doc.asText().replace(/<[^>]+>/g, '');
  const encontrados = textoPuro.match(/\{[^{}]+\}/g) || [];

  return [...new Set(encontrados.map((token) => token.slice(1, -1).trim()).filter(Boolean))];
}

function sanitizarTemplate(template) {
  return {
    id: template.id,
    nome: template.nome,
    descricao: template.descricao || null,
    categoria: template.categoria || null,
    tipo: template.tipo || null,
    versaoAtual: template.versaoAtual || 1,
    variaveis: template.variaveis || [],
    ativo: template.ativo !== false,
    criadoEm: template.criadoEm || null,
    atualizadoEm: template.atualizadoEm || null
  };
}

async function listarTemplates() {
  const tenantId = tenantAtual();
  const templates = await templateRepository.listarAtivos();
  return templates
    .filter((template) => mesmoTenant(template, tenantId))
    .map(sanitizarTemplate)
    .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
}

async function obterTemplate(id) {
  const template = await templateRepository.buscarPorId(id);
  if (!template || template.ativo === false) {
    throw new Error('TEMPLATE_NAO_ENCONTRADO');
  }
  if (!mesmoTenant(template, tenantAtual())) {
    throw new Error('TEMPLATE_NAO_ENCONTRADO');
  }
  return template;
}

async function listarVersoes(id) {
  await obterTemplate(id);
  const versoes = await templateRepository.listarVersoes(id);
  return versoes.map((versao) => ({
    id: versao.id,
    numero: versao.numero,
    variaveis: versao.variaveis || [],
    criadoEm: versao.criadoEm || null,
    criadoPor: versao.criadoPor || null,
    notas: versao.notas || null
  }));
}

async function criarTemplate(dados, user) {
  const nome = normalizarTexto(dados.nome, 140, true);
  const descricao = normalizarTexto(dados.descricao, 500);
  const categoria = normalizarTexto(dados.categoria, 80);
  const tipo = normalizarTexto(dados.tipo, 80);

  const buffer = decodificarBase64(dados.arquivoBase64);
  const variaveis = extrairVariaveis(buffer);

  const agora = new Date().toISOString();
  const id = await templateRepository.criar({
    nome,
    descricao,
    categoria,
    tipo,
    versaoAtual: 1,
    variaveis,
    ativo: true,
    tenantId: user.tenantId,
    criadoEm: agora,
    criadoPor: user.uid,
    atualizadoEm: agora,
    atualizadoPor: user.uid
  });

  const storagePath = `templates/${id}/v1.docx`;
  const { bucketName } = await storageUtil.salvarArquivo(storagePath, buffer, { contentType: MIME_DOCX });

  await templateRepository.adicionarVersao(id, {
    numero: 1,
    storagePath,
    bucketName,
    variaveis,
    criadoEm: agora,
    criadoPor: user.uid,
    notas: normalizarTexto(dados.notas, 300)
  });

  await templateRepository.atualizar(id, { storagePath, bucketName });

  await auditoriaService.registrarEvento({
    acao: 'CRIAR',
    entidade: 'TEMPLATE',
    entidadeId: id,
    usuario: user,
    detalhes: { nome, variaveis: variaveis.length }
  });

  const criado = await templateRepository.buscarPorId(id);
  return sanitizarTemplate(criado);
}

async function adicionarVersaoTemplate(id, dados, user) {
  const template = await obterTemplate(id);

  const buffer = decodificarBase64(dados.arquivoBase64);
  const variaveis = extrairVariaveis(buffer);
  const proximoNumero = (template.versaoAtual || 1) + 1;

  const agora = new Date().toISOString();
  const storagePath = `templates/${id}/v${proximoNumero}.docx`;
  const { bucketName } = await storageUtil.salvarArquivo(storagePath, buffer, { contentType: MIME_DOCX });

  await templateRepository.adicionarVersao(id, {
    numero: proximoNumero,
    storagePath,
    bucketName,
    variaveis,
    criadoEm: agora,
    criadoPor: user.uid,
    notas: normalizarTexto(dados.notas, 300)
  });

  await templateRepository.atualizar(id, {
    versaoAtual: proximoNumero,
    variaveis,
    storagePath,
    bucketName,
    atualizadoEm: agora,
    atualizadoPor: user.uid
  });

  await auditoriaService.registrarEvento({
    acao: 'ATUALIZAR',
    entidade: 'TEMPLATE',
    entidadeId: id,
    usuario: user,
    detalhes: { nome: template.nome, versao: proximoNumero, variaveis: variaveis.length }
  });

  const atualizado = await templateRepository.buscarPorId(id);
  return sanitizarTemplate(atualizado);
}

async function baixarTemplate(id) {
  const template = await obterTemplate(id);
  if (!template.storagePath) {
    throw new Error('TEMPLATE_NAO_ENCONTRADO');
  }
  const buffer = await storageUtil.lerArquivo(template.bucketName, template.storagePath);
  return { buffer, nome: template.nome };
}

// Edição de metadados (nome/descrição/categoria) — não altera o arquivo .docx.
// Atende tanto "Renomear" (só nome) quanto "Editar" (demais campos).
async function atualizarMetadados(id, dados, user) {
  const template = await obterTemplate(id);

  const patch = {};
  if (dados.nome !== undefined) patch.nome = normalizarTexto(dados.nome, 140, true);
  if (dados.descricao !== undefined) patch.descricao = normalizarTexto(dados.descricao, 500);
  if (dados.categoria !== undefined) patch.categoria = normalizarTexto(dados.categoria, 80);

  if (Object.keys(patch).length === 0) {
    return sanitizarTemplate(template);
  }

  patch.atualizadoEm = new Date().toISOString();
  patch.atualizadoPor = user.uid;
  await templateRepository.atualizar(id, patch);

  await auditoriaService.registrarEvento({
    acao: 'ATUALIZAR',
    entidade: 'TEMPLATE',
    entidadeId: id,
    usuario: user,
    detalhes: { nome: patch.nome || template.nome, campos: Object.keys(patch) }
  });

  const atualizado = await templateRepository.buscarPorId(id);
  return sanitizarTemplate(atualizado);
}

// Cria um novo modelo a partir de um existente, copiando o arquivo da versão atual.
async function duplicarTemplate(id, user) {
  const original = await obterTemplate(id);
  if (!original.storagePath) {
    throw new Error('TEMPLATE_NAO_ENCONTRADO');
  }

  const buffer = await storageUtil.lerArquivo(original.bucketName, original.storagePath);
  const variaveis = original.variaveis && original.variaveis.length ? original.variaveis : extrairVariaveis(buffer);
  const agora = new Date().toISOString();
  const nome = `${original.nome} (cópia)`.slice(0, 140);

  const novoId = await templateRepository.criar({
    nome,
    descricao: original.descricao || null,
    categoria: original.categoria || null,
    tipo: original.tipo || null,
    versaoAtual: 1,
    variaveis,
    ativo: true,
    tenantId: user.tenantId,
    criadoEm: agora,
    criadoPor: user.uid,
    atualizadoEm: agora,
    atualizadoPor: user.uid
  });

  const storagePath = `templates/${novoId}/v1.docx`;
  const { bucketName } = await storageUtil.salvarArquivo(storagePath, buffer, { contentType: MIME_DOCX });

  await templateRepository.adicionarVersao(novoId, {
    numero: 1,
    storagePath,
    bucketName,
    variaveis,
    criadoEm: agora,
    criadoPor: user.uid,
    notas: `Duplicado de "${original.nome}"`
  });

  await templateRepository.atualizar(novoId, { storagePath, bucketName });

  await auditoriaService.registrarEvento({
    acao: 'CRIAR',
    entidade: 'TEMPLATE',
    entidadeId: novoId,
    usuario: user,
    detalhes: { nome, duplicadoDe: id }
  });

  const criado = await templateRepository.buscarPorId(novoId);
  return sanitizarTemplate(criado);
}

async function inativarTemplate(id, user) {
  const template = await obterTemplate(id);

  await templateRepository.atualizar(id, {
    ativo: false,
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: user.uid
  });

  await auditoriaService.registrarEvento({
    acao: 'DELETAR_SOFT',
    entidade: 'TEMPLATE',
    entidadeId: id,
    usuario: user,
    detalhes: { nome: template.nome }
  });
}

module.exports = {
  listarTemplates,
  listarVersoes,
  criarTemplate,
  adicionarVersaoTemplate,
  atualizarMetadados,
  duplicarTemplate,
  baixarTemplate,
  inativarTemplate,
  extrairVariaveis
};
