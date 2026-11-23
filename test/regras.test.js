'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const regras = require('../src/services/regrasService');

const base = { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10 };

test('modificador de atributo segue a tabela do d20', () => {
  assert.equal(regras.modificador(10), 0);
  assert.equal(regras.modificador(11), 0);
  assert.equal(regras.modificador(12), 1);
  assert.equal(regras.modificador(16), 3);
  assert.equal(regras.modificador(8), -1);
});

test('validarAtributos aceita até 12 pontos extras e limites de 8 a 16', () => {
  assert.deepEqual(regras.validarAtributos({ ...base, forca: 16, destreza: 16 }), { ...base, forca: 16, destreza: 16 });
  assert.throws(() => regras.validarAtributos({ ...base, forca: 16, destreza: 16, carisma: 14 }), /pontos demais/);
  assert.throws(() => regras.validarAtributos({ ...base, forca: 17 }), /entre 8 e 16/);
  assert.throws(() => regras.validarAtributos({ ...base, forca: 7 }), /entre 8 e 16/);
  assert.throws(() => regras.validarAtributos({ ...base, carisma: 'abc' }), /inválido/);
  // quem reduz um atributo ganha pontos para gastar em outro
  assert.doesNotThrow(() => regras.validarAtributos({ ...base, forca: 16, destreza: 16, carisma: 8, sabedoria: 8, inteligencia: 12 }));
});

test('vida máxima depende da constituição', () => {
  assert.equal(regras.calcularVidaMaxima(10), 10);
  assert.equal(regras.calcularVidaMaxima(14), 14);
  assert.equal(regras.calcularVidaMaxima(8), 8);
});

test('teste de atributo: 20 natural sempre passa e 1 natural sempre falha', () => {
  const sempre = (v) => () => v;
  const critico = regras.rolarTeste(8, 25, sempre(0.999));
  assert.equal(critico.dado, 20);
  assert.equal(critico.sucesso, true);
  assert.equal(critico.critico, true);
  const falha = regras.rolarTeste(16, 5, sempre(0));
  assert.equal(falha.dado, 1);
  assert.equal(falha.sucesso, false);
  assert.equal(falha.falha_critica, true);
  const medio = regras.rolarTeste(14, 13, sempre(0.5)); // d20 = 11, mod +2 = 13
  assert.equal(medio.total, 13);
  assert.equal(medio.sucesso, true);
});

test('dano de risco respeita os dados de cada nível', () => {
  assert.equal(regras.danoDeRisco('nenhum'), 0);
  for (let i = 0; i < 200; i++) {
    const baixo = regras.danoDeRisco('baixo');
    const alto = regras.danoDeRisco('alto');
    assert.ok(baixo >= 1 && baixo <= 4);
    assert.ok(alto >= 2 && alto <= 12);
  }
  assert.equal(regras.danoDeRisco('medio', 2, () => 0.999), 12);
});

test('dano nunca deixa a vida negativa e avisa quando o personagem cai', () => {
  assert.deepEqual(regras.aplicarDano(5, 3), { vida: 2, caiu: false });
  assert.deepEqual(regras.aplicarDano(5, 99), { vida: 0, caiu: true });
  assert.deepEqual(regras.aplicarDano(5, -4), { vida: 5, caiu: false });
});

test('recuperação ao avançar de mapa', () => {
  assert.equal(regras.recuperarAoAvancar(0, 12, 'caido'), 6);
  assert.equal(regras.recuperarAoAvancar(4, 12, 'ativo'), 7);
  assert.equal(regras.recuperarAoAvancar(11, 12, 'ativo'), 12);
});

test('dificuldade é limitada entre 5 e 25', () => {
  assert.equal(regras.limitarDificuldade(1), 5);
  assert.equal(regras.limitarDificuldade(99), 25);
  assert.equal(regras.limitarDificuldade('abc'), 12);
});
