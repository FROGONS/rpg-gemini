'use strict';
const { query } = require('../config/database');

async function criar({ nome, email, senhaHash }) {
  const r = await query('INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)', [nome, email, senhaHash]);
  return r.insertId;
}

async function buscarPorEmail(email) {
  const rows = await query('SELECT * FROM usuarios WHERE email = ?', [email]);
  return rows[0] || null;
}

async function buscarPorId(id) {
  const rows = await query('SELECT id, nome, email, criado_em FROM usuarios WHERE id = ?', [id]);
  return rows[0] || null;
}

module.exports = { criar, buscarPorEmail, buscarPorId };
