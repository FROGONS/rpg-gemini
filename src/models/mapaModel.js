'use strict';
const { query } = require('../config/database');

const CAMPOS_EDITAVEIS = ['descricao', 'prompt_imagem', 'imagem_url', 'status_imagem'];

// Insere a arvore de mapas respeitando a hierarquia (mapa_pai_id). Devolve { ordem: id }.
async function criarArvore(salaId, mapas, conn) {
  const ids = {};
  const ordenados = [...mapas].sort((a, b) => a.ordem - b.ordem);
  for (const m of ordenados) {
    const paiId = m.pai_ordem ? ids[m.pai_ordem] || null : null;
    const r = await query(
      'INSERT INTO mapas_cenarios (sala_id, mapa_pai_id, ordem, nome, resumo) VALUES (?, ?, ?, ?, ?)',
      [salaId, paiId, m.ordem, m.nome, m.resumo], conn
    );
    ids[m.ordem] = r.insertId;
  }
  return ids;
}

async function buscarPorId(id) {
  const rows = await query('SELECT * FROM mapas_cenarios WHERE id = ?', [id]);
  return rows[0] || null;
}

async function listarPorSala(salaId) {
  return query('SELECT * FROM mapas_cenarios WHERE sala_id = ? ORDER BY ordem', [salaId]);
}

async function listarFilhos(mapaId) {
  return query('SELECT * FROM mapas_cenarios WHERE mapa_pai_id = ? ORDER BY ordem', [mapaId]);
}

async function atualizar(id, campos) {
  const chaves = Object.keys(campos).filter((k) => CAMPOS_EDITAVEIS.includes(k));
  if (!chaves.length) return;
  const set = chaves.map((k) => `${k} = ?`).join(', ');
  await query(`UPDATE mapas_cenarios SET ${set} WHERE id = ?`, [...chaves.map((k) => campos[k]), id]);
}

async function marcarVisitado(id) {
  await query('UPDATE mapas_cenarios SET visitado_em = NOW() WHERE id = ?', [id]);
}

async function marcarGerandoComoErro() {
  await query("UPDATE mapas_cenarios SET status_imagem = 'erro' WHERE status_imagem = 'gerando'");
}

// Versao enviada aos navegadores (sem o prompt interno da imagem).
function publico(m) {
  if (!m) return null;
  return {
    id: m.id, ordem: m.ordem, nome: m.nome, resumo: m.resumo, descricao: m.descricao,
    imagem_url: m.imagem_url, status_imagem: m.status_imagem,
  };
}

module.exports = { criarArvore, buscarPorId, listarPorSala, listarFilhos, atualizar, marcarVisitado, marcarGerandoComoErro, publico };
