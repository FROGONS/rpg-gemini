'use strict';
// REGRAS DO JOGO. O servidor decide todos os numeros (dados, dano, vida);
// a IA apenas narra o resultado, nunca o contrario.
const { AppError } = require('../utils/errors');

const ATRIBUTOS = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];
const ROTULOS = { forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição', inteligencia: 'Inteligência', sabedoria: 'Sabedoria', carisma: 'Carisma' };

const ATRIBUTO_BASE = 10;
const PONTOS_EXTRAS = 12;
const ATRIBUTO_MIN = 8;
const ATRIBUTO_MAX = 16;

const RISCOS = ['nenhum', 'baixo', 'medio', 'alto'];
const DANO_POR_RISCO = { nenhum: null, baixo: { qtd: 1, faces: 4 }, medio: { qtd: 1, faces: 6 }, alto: { qtd: 2, faces: 6 } };

const modificador = (valor) => Math.floor((Number(valor) - 10) / 2);

function rolarDado(faces = 20, rng = Math.random) {
  return Math.floor(rng() * faces) + 1;
}

function rolarDados(qtd, faces, rng = Math.random) {
  let soma = 0;
  for (let i = 0; i < qtd; i++) soma += rolarDado(faces, rng);
  return soma;
}

// Distribuicao de pontos: cada atributo parte de 10, vai de 8 a 16, com no maximo 12 pontos extras no total.
function validarAtributos(entrada) {
  const atributos = {};
  for (const nome of ATRIBUTOS) {
    const valor = Number(entrada?.[nome]);
    if (!Number.isInteger(valor)) throw new AppError(400, `Atributo inválido: ${ROTULOS[nome]}.`, 'ATRIBUTOS_INVALIDOS');
    if (valor < ATRIBUTO_MIN || valor > ATRIBUTO_MAX) {
      throw new AppError(400, `${ROTULOS[nome]} deve ficar entre ${ATRIBUTO_MIN} e ${ATRIBUTO_MAX}.`, 'ATRIBUTOS_INVALIDOS');
    }
    atributos[nome] = valor;
  }
  const gastos = ATRIBUTOS.reduce((s, n) => s + (atributos[n] - ATRIBUTO_BASE), 0);
  if (gastos > PONTOS_EXTRAS) {
    throw new AppError(400, `Você distribuiu pontos demais (máximo de ${PONTOS_EXTRAS} acima da base).`, 'ATRIBUTOS_INVALIDOS');
  }
  return atributos;
}

const calcularVidaMaxima = (constituicao) => Math.max(6, 10 + modificador(constituicao) * 2);

// Teste de atributo: d20 + modificador contra a dificuldade (CD). 20 natural sempre passa; 1 natural sempre falha.
function rolarTeste(valorAtributo, dificuldade, rng = Math.random) {
  const dado = rolarDado(20, rng);
  const mod = modificador(valorAtributo);
  const total = dado + mod;
  const critico = dado === 20;
  const falhaCritica = dado === 1;
  const sucesso = critico ? true : falhaCritica ? false : total >= dificuldade;
  return { dado, modificador: mod, total, dificuldade, sucesso, critico, falha_critica: falhaCritica };
}

// Dano que o jogador sofre ao falhar em uma acao arriscada.
function danoDeRisco(risco, multiplicador = 1, rng = Math.random) {
  const regra = DANO_POR_RISCO[risco];
  if (!regra) return 0;
  return rolarDados(regra.qtd, regra.faces, rng) * multiplicador;
}

// Dano causado a um NPC por um ataque bem-sucedido: 1d6 + modificador do atributo usado (dobra no critico).
function danoDeAtaque(modAtributo, critico = false, rng = Math.random) {
  const base = rolarDado(6, rng) + Math.max(0, modAtributo);
  return critico ? base * 2 : base;
}

function aplicarDano(vidaAtual, dano) {
  const vida = Math.max(0, vidaAtual - Math.max(0, dano));
  return { vida, caiu: vida === 0 };
}

// Ao chegar a um novo mapa: quem estava caido acorda com metade da vida; os demais recuperam 25%.
function recuperarAoAvancar(vidaAtual, vidaMaxima, status) {
  if (status === 'caido') return Math.max(1, Math.ceil(vidaMaxima / 2));
  return Math.min(vidaMaxima, vidaAtual + Math.ceil(vidaMaxima * 0.25));
}

const limitarDificuldade = (cd) => Math.min(25, Math.max(5, Math.round(Number(cd)) || 12));

const VIDA_INICIAL_NPC = { hostil: 12, neutro: 8, aliado: 10 };

module.exports = {
  ATRIBUTOS, ROTULOS, RISCOS, PONTOS_EXTRAS, ATRIBUTO_BASE, ATRIBUTO_MIN, ATRIBUTO_MAX, VIDA_INICIAL_NPC,
  modificador, rolarDado, rolarDados, validarAtributos, calcularVidaMaxima, rolarTeste,
  danoDeRisco, danoDeAtaque, aplicarDano, recuperarAoAvancar, limitarDificuldade,
};
