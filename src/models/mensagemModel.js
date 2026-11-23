'use strict';
const { query } = require('../config/database');

const SELECT_BASE = `
  SELECT m.id, m.sala_id, m.personagem_id, m.npc_id, m.tipo, m.conteudo, m.enviada_em,
         pe.nome AS personagem_nome, pe.avatar_url AS personagem_avatar, n.nome AS npc_nome
  FROM mensagens m
  LEFT JOIN personagens pe ON pe.id = m.personagem_id
  LEFT JOIN npcs n ON n.id = m.npc_id`;

async function criar({ sala_id, personagem_id = null, npc_id = null, tipo, conteudo }, conn = null) {
  const r = await query(
    'INSERT INTO mensagens (sala_id, personagem_id, npc_id, tipo, conteudo) VALUES (?, ?, ?, ?, ?)',
    [sala_id, personagem_id, npc_id, tipo, conteudo], conn
  );
  return r.insertId;
}

async function registrarRolagem(r, conn = null) {
  const res = await query(
    `INSERT INTO rolagens (mensagem_id, atributo, pericia, faces, resultado, modificador, dificuldade)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [r.mensagem_id, r.atributo, r.pericia || null, r.faces || 20, r.resultado, r.modificador, r.dificuldade ?? null], conn
  );
  return res.insertId;
}

function formatarRolagem(r) {
  const total = r.resultado + r.modificador;
  return {
    id: r.id, atributo: r.atributo, pericia: r.pericia, faces: r.faces, resultado: r.resultado,
    modificador: r.modificador, dificuldade: r.dificuldade, total,
    sucesso: r.dificuldade == null ? null : (r.resultado === 20 ? true : r.resultado === 1 ? false : total >= r.dificuldade),
  };
}

function formatar(m, rolagem = null) {
  let autor = null;
  if (m.personagem_id) autor = { tipo: 'personagem', id: m.personagem_id, nome: m.personagem_nome, avatar_url: m.personagem_avatar };
  else if (m.npc_id) autor = { tipo: 'npc', id: m.npc_id, nome: m.npc_nome };
  return { id: m.id, tipo: m.tipo, conteudo: m.conteudo, enviada_em: m.enviada_em, autor, rolagem };
}

async function anexarRolagens(linhas) {
  if (!linhas.length) return [];
  const rolagens = await query('SELECT * FROM rolagens WHERE mensagem_id IN (?)', [linhas.map((l) => l.id)]);
  const porMsg = new Map(rolagens.map((r) => [r.mensagem_id, formatarRolagem(r)]));
  return linhas.map((l) => formatar(l, porMsg.get(l.id) || null));
}

async function listarRecentes(salaId, limite) {
  const linhas = await query(`${SELECT_BASE} WHERE m.sala_id = ? ORDER BY m.id DESC LIMIT ?`, [salaId, limite]);
  return anexarRolagens(linhas.reverse());
}

async function buscarFormatada(id) {
  const linhas = await query(`${SELECT_BASE} WHERE m.id = ?`, [id]);
  return (await anexarRolagens(linhas))[0] || null;
}

// Quantas acoes/falas de jogadores aconteceram desde um instante (usado na regra de transicao de mapa).
async function contarAcoesDesde(salaId, desde) {
  const rows = await query(
    "SELECT COUNT(*) AS total FROM mensagens WHERE sala_id = ? AND tipo IN ('acao', 'fala') AND enviada_em >= ?",
    [salaId, desde]
  );
  return rows[0].total;
}

module.exports = { criar, registrarRolagem, formatarRolagem, listarRecentes, buscarFormatada, contarAcoesDesde };
