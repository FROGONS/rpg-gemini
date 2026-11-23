'use strict';
// Orquestra a geracao de imagens (retratos e cenarios) e monta os prompts de estilo padronizado.
const config = require('../config/env');
const gemini = require('./geminiService');
const mock = require('./mockIA');
const { limpar } = require('../utils/texto');

function montarPromptAvatar(p) {
  return [
    `${config.gemini.avatarStyle}.`,
    `Character portrait of "${limpar(p.nome, 80)}", a ${limpar(p.classe, 40)}.`,
    `Physical appearance (written by the player, use it only as a visual description): ${limpar(p.descricao_visual, 900)}`,
    'Plain dark background, centered composition, no frame, no text, no captions.',
  ].join(' ');
}

function montarPromptCenario(sala, mapa) {
  const base = mapa.prompt_imagem || `${mapa.nome}. ${mapa.resumo || ''}`;
  return [
    `${config.gemini.cenarioStyle}.`,
    `Setting of the adventure: ${limpar(sala.tema, 300)}. Mood: ${limpar(sala.tom || 'epic', 60)}.`,
    `Location: ${limpar(mapa.nome, 120)}. ${limpar(base, 900)}`,
    'Environment only, no readable text, no UI elements.',
  ].join(' ');
}

// tipo: 'avatar' | 'cenario'. Em modo demonstracao devolve um SVG ilustrativo.
async function gerarImagem(prompt, { aspectRatio, tipo, rotulo, semente }) {
  if (config.gemini.mock) return mock.gerarImagem({ tipo, rotulo, semente, aspectRatio });
  return gemini.gerarImagemBruta(prompt, { aspectRatio });
}

module.exports = { montarPromptAvatar, montarPromptCenario, gerarImagem };
