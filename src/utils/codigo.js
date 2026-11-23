'use strict';
const crypto = require('crypto');
// Alfabeto sem caracteres ambiguos (0/O, 1/I).
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function gerarCodigoSala(tamanho = 6) {
  const bytes = crypto.randomBytes(tamanho);
  let codigo = '';
  for (let i = 0; i < tamanho; i++) codigo += ALFABETO[bytes[i] % ALFABETO.length];
  return codigo;
}

module.exports = { gerarCodigoSala };
