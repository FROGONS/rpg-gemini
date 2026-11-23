'use strict';
const { query } = require('../config/database');

const ATRIBUTOS = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];

async function criar(p) {
  const r = await query(
    `INSERT INTO personagens
      (usuario_id, nome, classe, descricao_visual, status_avatar,
       forca, destreza, constituicao, inteligencia, sabedoria, carisma, vida_maxima)
     VALUES (?, ?, ?, ?, 'gerando', ?, ?, ?, ?, ?, ?, ?)`,
    [p.usuario_id, p.nome, p.classe, p.descricao_visual,
      p.atributos.forca, p.atributos.destreza, p.atributos.constituicao,
      p.atributos.inteligencia, p.atributos.sabedoria, p.atributos.carisma, p.vida_maxima]
  );
  return r.insertId;
}

async function buscarPorId(id) {
  const rows = await query('SELECT * FROM personagens WHERE id = ?', [id]);
  return rows[0] || null;
}

async function listarPorUsuario(usuarioId) {
  return query('SELECT * FROM personagens WHERE usuario_id = ? ORDER BY id DESC', [usuarioId]);
}

async function atualizarAvatar(id, { url, status }) {
  if (url !== undefined) {
    await query('UPDATE personagens SET avatar_url = ?, status_avatar = ? WHERE id = ?', [url, status, id]);
  } else {
    await query('UPDATE personagens SET status_avatar = ? WHERE id = ?', [status, id]);
  }
}

// Ao reiniciar o servidor, geracoes interrompidas ficam como "erro" (o jogador pode tentar de novo).
async function marcarGerandoComoErro() {
  await query("UPDATE personagens SET status_avatar = 'erro' WHERE status_avatar = 'gerando'");
}

module.exports = { ATRIBUTOS, criar, buscarPorId, listarPorUsuario, atualizarAvatar, marcarGerandoComoErro };
