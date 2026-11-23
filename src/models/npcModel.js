'use strict';
const { query } = require('../config/database');

async function criar({ sala_id, mapa_id, nome, descricao, personalidade, atitude, vida_atual }, conn = null) {
  const r = await query(
    'INSERT INTO npcs (sala_id, mapa_id, nome, descricao, personalidade, atitude, vida_atual) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [sala_id, mapa_id, nome, descricao, personalidade, atitude, vida_atual], conn
  );
  return r.insertId;
}

async function buscarPorId(id) {
  const rows = await query('SELECT * FROM npcs WHERE id = ?', [id]);
  return rows[0] || null;
}

// NPCs presentes (vivos) em um mapa.
async function listarPorMapa(mapaId) {
  return query('SELECT * FROM npcs WHERE mapa_id = ? AND (vida_atual IS NULL OR vida_atual > 0) ORDER BY id', [mapaId]);
}

async function atualizarVida(id, vida, conn = null) {
  await query('UPDATE npcs SET vida_atual = ? WHERE id = ?', [vida, id], conn);
}

async function contarPorMapa(mapaId, conn = null) {
  const rows = await query('SELECT COUNT(*) AS total FROM npcs WHERE mapa_id = ?', [mapaId], conn);
  return rows[0].total;
}

function publico(n) {
  return { id: n.id, nome: n.nome, descricao: n.descricao, atitude: n.atitude, vida_atual: n.vida_atual };
}

module.exports = { criar, buscarPorId, listarPorMapa, atualizarVida, contarPorMapa, publico };
