'use strict';
const { query } = require('../config/database');

const CAMPOS_EDITAVEIS = ['mapa_atual_id', 'preludio', 'objetivo', 'status'];

const SELECT_PARTICIPANTE = `
  SELECT pa.id AS participacao_id, pa.sala_id, pa.vida_atual, pa.status,
         pe.id AS personagem_id, pe.usuario_id, pe.nome, pe.classe, pe.descricao_visual,
         pe.avatar_url, pe.status_avatar, pe.vida_maxima,
         pe.forca, pe.destreza, pe.constituicao, pe.inteligencia, pe.sabedoria, pe.carisma
  FROM participacoes pa
  JOIN personagens pe ON pe.id = pa.personagem_id`;

// ---------- salas ----------
async function criar({ host_id, codigo, nome, tema, tom, max_jogadores }, conn = null) {
  const r = await query(
    "INSERT INTO salas (host_id, codigo, nome, tema, tom, max_jogadores, status) VALUES (?, ?, ?, ?, ?, ?, 'preparando')",
    [host_id, codigo, nome, tema, tom, max_jogadores], conn
  );
  return r.insertId;
}

async function buscarPorId(id) {
  const rows = await query('SELECT * FROM salas WHERE id = ?', [id]);
  return rows[0] || null;
}

async function buscarPorCodigo(codigo) {
  const rows = await query('SELECT * FROM salas WHERE codigo = ?', [codigo]);
  return rows[0] || null;
}

async function atualizar(id, campos, conn = null) {
  const chaves = Object.keys(campos).filter((k) => CAMPOS_EDITAVEIS.includes(k));
  if (!chaves.length) return;
  const set = chaves.map((k) => `${k} = ?`).join(', ');
  await query(`UPDATE salas SET ${set} WHERE id = ?`, [...chaves.map((k) => campos[k]), id], conn);
}

async function excluir(id) {
  await query('DELETE FROM salas WHERE id = ?', [id]);
}

async function listarDoUsuario(usuarioId) {
  return query(
    `SELECT s.id, s.codigo, s.nome, s.tema, s.status, s.max_jogadores, s.host_id,
            pe.nome AS personagem_nome, pa.status AS participacao_status
     FROM participacoes pa
     JOIN personagens pe ON pe.id = pa.personagem_id
     JOIN salas s ON s.id = pa.sala_id
     WHERE pe.usuario_id = ? AND pa.status <> 'saiu'
     ORDER BY s.id DESC`,
    [usuarioId]
  );
}

// ---------- participacoes ----------
async function criarParticipacao({ sala_id, personagem_id, vida_atual }, conn = null) {
  const r = await query(
    'INSERT INTO participacoes (sala_id, personagem_id, vida_atual) VALUES (?, ?, ?)',
    [sala_id, personagem_id, vida_atual], conn
  );
  return r.insertId;
}

async function buscarParticipacaoDoUsuario(salaId, usuarioId) {
  const rows = await query(`${SELECT_PARTICIPANTE} WHERE pa.sala_id = ? AND pe.usuario_id = ?`, [salaId, usuarioId]);
  return rows[0] || null;
}

async function listarParticipantes(salaId) {
  return query(`${SELECT_PARTICIPANTE} WHERE pa.sala_id = ? AND pa.status <> 'saiu' ORDER BY pa.id`, [salaId]);
}

async function contarOcupadas(salaId) {
  const rows = await query("SELECT COUNT(*) AS total FROM participacoes WHERE sala_id = ? AND status <> 'saiu'", [salaId]);
  return rows[0].total;
}

async function atualizarParticipacao(id, { vida_atual, status }, conn = null) {
  const sets = [];
  const params = [];
  if (vida_atual !== undefined) { sets.push('vida_atual = ?'); params.push(vida_atual); }
  if (status !== undefined) { sets.push('status = ?'); params.push(status); }
  if (!sets.length) return;
  await query(`UPDATE participacoes SET ${sets.join(', ')} WHERE id = ?`, [...params, id], conn);
}

module.exports = {
  criar, buscarPorId, buscarPorCodigo, atualizar, excluir, listarDoUsuario,
  criarParticipacao, buscarParticipacaoDoUsuario, listarParticipantes, contarOcupadas, atualizarParticipacao,
};
