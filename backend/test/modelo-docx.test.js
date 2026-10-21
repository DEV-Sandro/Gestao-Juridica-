const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { validarDocx, MAX_DOCX_BYTES } = require('../src/services/modelo-docx.validator');

const modelo = fs.readFileSync(path.resolve(__dirname, '../../front/src/assets/document-templates/declaracao-hipossuficiencia-template.docx'));

test('aceita um DOCX real com partes obrigatórias', () => {
  assert.equal(validarDocx(modelo), true);
});

test('recusa conteúdo renomeado, arquivo truncado e tamanho excessivo', () => {
  assert.equal(validarDocx(Buffer.from('%PDF-1.7')), false);
  assert.equal(validarDocx(modelo.subarray(0, 80)), false);
  assert.equal(validarDocx(Buffer.alloc(MAX_DOCX_BYTES + 1)), false);
});

test('recusa estrutura ZIP com nome de entrada alterado', () => {
  const corrompido = Buffer.from(modelo);
  const marcador = Buffer.from('word/document.xml');
  const posicao = corrompido.lastIndexOf(marcador);
  assert.ok(posicao > 0);
  corrompido.write('word/document.zzz', posicao, 'utf8');
  assert.equal(validarDocx(corrompido), false);
});
