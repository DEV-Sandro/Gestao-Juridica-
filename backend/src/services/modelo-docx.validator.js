const MAX_DOCX_BYTES = 2 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 12 * 1024 * 1024;

function validarDocx(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 50 || buffer.length > MAX_DOCX_BYTES || buffer.readUInt32LE(0) !== 0x04034b50) return false;

  const inicioBusca = Math.max(0, buffer.length - 65557);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= inicioBusca; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0 || eocd + 22 > buffer.length) return false;

  const total = buffer.readUInt16LE(eocd + 10);
  const tamanho = buffer.readUInt32LE(eocd + 12);
  const inicio = buffer.readUInt32LE(eocd + 16);
  if (!total || total > 3000 || inicio + tamanho > eocd) return false;

  let offset = inicio;
  let expandido = 0;
  const nomes = new Set();
  for (let i = 0; i < total; i++) {
    if (offset + 46 > eocd || buffer.readUInt32LE(offset) !== 0x02014b50) return false;
    const nomeLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const comentarioLen = buffer.readUInt16LE(offset + 32);
    const proximo = offset + 46 + nomeLen + extraLen + comentarioLen;
    if (proximo > eocd) return false;
    const nome = buffer.subarray(offset + 46, offset + 46 + nomeLen).toString('utf8');
    if (!nome || nome.includes('..') || nome.startsWith('/') || nome.includes('\\') || nomes.has(nome)) return false;
    if (/vbaProject\.bin|(^|\/)activeX\/|(^|\/)embeddings\//i.test(nome)) return false;
    nomes.add(nome);
    expandido += buffer.readUInt32LE(offset + 24);
    if (expandido > MAX_UNCOMPRESSED_BYTES) return false;
    offset = proximo;
  }
  return offset === inicio + tamanho && nomes.has('[Content_Types].xml') && nomes.has('word/document.xml');
}

module.exports = { validarDocx, MAX_DOCX_BYTES };
