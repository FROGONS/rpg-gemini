'use strict';
const fs = require('fs/promises');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..', 'public', 'uploads');
const EXTENSOES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

const extensaoDoMime = (mime) => EXTENSOES[mime] || 'png';

// Salva a imagem em public/uploads/<pasta>/ e devolve a URL publica relativa.
async function salvarImagem(pasta, nomeBase, buffer, mime) {
  const dir = path.join(RAIZ, pasta);
  await fs.mkdir(dir, { recursive: true });
  const arquivo = `${nomeBase}.${extensaoDoMime(mime)}`;
  await fs.writeFile(path.join(dir, arquivo), buffer);
  return `/uploads/${pasta}/${arquivo}`;
}

module.exports = { salvarImagem, extensaoDoMime };
