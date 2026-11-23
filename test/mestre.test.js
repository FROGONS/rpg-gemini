'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mestre = require('../src/services/mestreService');
const gemini = require('../src/services/geminiService');
const { extrairJSON } = require('../src/utils/texto');

const ctx = { npcs: [{ id: 7, nome: 'Guarda', atitude: 'hostil' }] };

test('arbitragem: valores inválidos da IA são reduzidos ao que as regras permitem', () => {
  const r = mestre.normalizarArbitro({ exige_teste: true, atributo: 'poder', dificuldade: 99, risco: 'mortal', alvo_npc_id: 123, e_ataque: true }, ctx);
  assert.equal(r.atributo, 'sabedoria');
  assert.equal(r.dificuldade, 25);
  assert.equal(r.risco, 'nenhum');
  assert.equal(r.alvo_npc_id, null);
  assert.equal(r.e_ataque, false); // sem alvo valido nao ha ataque
});

test('arbitragem: ataque a um NPC presente sempre exige teste', () => {
  const r = mestre.normalizarArbitro({ exige_teste: false, e_ataque: true, alvo_npc_id: 7 }, ctx);
  assert.equal(r.exige_teste, true);
  assert.equal(r.atributo, 'forca');
  assert.equal(r.alvo_npc_id, 7);
});

test('narração: texto vazio é rejeitado e listas são limitadas', () => {
  assert.throws(() => mestre.normalizarNarracao({ narracao: '   ' }), /vazia/);
  const n = mestre.normalizarNarracao({
    narracao: 'x'.repeat(5000),
    falas_npc: Array.from({ length: 9 }, (_, i) => ({ npc_id: i + 1, nome: 'N', fala: 'oi' })),
    novos_npcs: Array.from({ length: 5 }, (_, i) => ({ nome: `N${i}`, atitude: 'qualquer' })),
    item_encontrado: { nome: 'Espada', descricao: 'afiada' },
    mudar_mapa: 'sim',
  });
  assert.equal(n.narracao.length, 1800);
  assert.equal(n.falas_npc.length, 3);
  assert.equal(n.novos_npcs.length, 2);
  assert.equal(n.novos_npcs[0].atitude, 'neutro');
  assert.equal(n.item_encontrado.nome, 'Espada');
  assert.equal(n.mudar_mapa, true);
});

test('campanha: hierarquia de mapas é corrigida e campanhas incompletas são recusadas', () => {
  const c = mestre.normalizarCampanha({
    preludio: 'Prelúdio', objetivo: 'Objetivo',
    mapas: [{ nome: 'A', pai_ordem: 5 }, { nome: 'B', pai_ordem: 9 }, { nome: 'C', pai_ordem: 1 }],
  });
  assert.deepEqual(c.mapas.map((m) => [m.ordem, m.pai_ordem]), [[1, null], [2, 1], [3, 1]]);
  assert.throws(() => mestre.normalizarCampanha({ preludio: 'a', objetivo: 'b', mapas: [{ nome: 'so um' }] }), /incompleta/);
});

test('extrairJSON entende respostas com cerca de markdown', () => {
  assert.deepEqual(extrairJSON('```json\n{"a": 1}\n```'), { a: 1 });
  assert.deepEqual(extrairJSON('Claro! {"b": [1,2]} fim'), { b: [1, 2] });
  assert.throws(() => extrairJSON('sem json'));
});

test('erro 429 do Gemini vira RATE_LIMIT com mensagem amigável', () => {
  const e = gemini.traduzirErro({ status: 429, message: 'RESOURCE_EXHAUSTED' });
  assert.equal(e.codigo, 'RATE_LIMIT');
  assert.equal(e.status, 429);
  assert.match(e.message, /muitas requisições/);
  assert.equal(gemini.traduzirErro(new Error('boom')).codigo, 'IA_ERRO');
});
