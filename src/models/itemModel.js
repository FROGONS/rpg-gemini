'use strict';
const { query } = require('../config/database');

async function listarPorParticipacoes(ids) {
  if (!ids.length) return [];
  return query('SELECT id, participacao_id, nome, descricao, quantidade FROM itens_inventario WHERE participacao_id IN (?) ORDER BY id', [ids]);
}

// Soma na quantidade se o item ja existe (mesmo nome); senao cria.
async function adicionar({ participacao_id, nome, descricao }, conn = null) {
  const existente = await query(
    'SELECT id FROM itens_inventario WHERE participacao_id = ? AND LOWER(nome) = LOWER(?) LIMIT 1',
    [participacao_id, nome], conn
  );
  if (existente[0]) {
    await query('UPDATE itens_inventario SET quantidade = LEAST(quantidade + 1, 999) WHERE id = ?', [existente[0].id], conn);
    return existente[0].id;
  }
  const r = await query(
    'INSERT INTO itens_inventario (participacao_id, nome, descricao, quantidade) VALUES (?, ?, ?, 1)',
    [participacao_id, nome, descricao], conn
  );
  return r.insertId;
}

module.exports = { listarPorParticipacoes, adicionar };
