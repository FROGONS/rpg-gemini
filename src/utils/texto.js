'use strict';
// Utilitarios de texto: o conteudo vindo do usuario ou da IA sempre passa por aqui antes do banco.
function limpar(valor, max) {
  if (valor === undefined || valor === null) return '';
  return String(valor).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/\s+\n/g, '\n').trim().slice(0, max);
}

function limparOuNulo(valor, max) {
  const t = limpar(valor, max);
  return t.length ? t : null;
}

function inteiro(valor, min, max, padrao) {
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, n));
}

// Extrai JSON de uma resposta de IA, mesmo se vier dentro de ```json ... ```.
function extrairJSON(texto) {
  if (!texto) throw new Error('Resposta vazia');
  let t = String(texto).trim();
  const cerca = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (cerca) t = cerca[1].trim();
  const ini = t.indexOf('{');
  const fim = t.lastIndexOf('}');
  if (ini === -1 || fim === -1) throw new Error('JSON nao encontrado');
  return JSON.parse(t.slice(ini, fim + 1));
}

module.exports = { limpar, limparOuNulo, inteiro, extrairJSON };
