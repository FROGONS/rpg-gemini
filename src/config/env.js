'use strict';
// Carrega e valida as variaveis de ambiente. Nenhuma chave vai para o front-end.
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const env = process.env;
const numero = (valor, padrao) => {
  const n = Number(valor);
  return valor !== undefined && valor !== '' && Number.isFinite(n) ? n : padrao;
};

const apiKey = (env.GEMINI_API_KEY || '').trim();
const chaveParecePlaceholder = /^(sua|your|cole|troque|xxx)/i.test(apiKey);
const forcarMock = String(env.GEMINI_MOCK || '').toLowerCase() === 'true';

let jwtSecret = (env.JWT_SECRET || '').trim();
if (!jwtSecret || /^troque/i.test(jwtSecret)) {
  jwtSecret = crypto.randomBytes(32).toString('hex');
  console.warn('[config] JWT_SECRET nao definido: gerado um segredo temporario (as sessoes caem ao reiniciar).');
}

module.exports = {
  port: numero(env.PORT, 3000),
  jwt: { secret: jwtSecret, expiraEm: env.JWT_EXPIRA_EM || '7d' },
  db: {
    host: env.DB_HOST || '127.0.0.1',
    port: numero(env.DB_PORT, 3306),
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    name: env.DB_NAME || 'rpg_gemini',
  },
  autoMigrate: String(env.AUTO_MIGRATE || 'true').toLowerCase() !== 'false',
  gemini: {
    apiKey,
    textModel: env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash',
    imageModel: env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image',
    // Sem chave valida (ou com GEMINI_MOCK=true) o jogo roda em modo demonstracao.
    mock: forcarMock || !apiKey || chaveParecePlaceholder,
    avatarStyle: env.AVATAR_STYLE ||
      'concept art, digital painting, dramatic lighting, fantasy RPG character portrait, head and shoulders, highly detailed, no text, no watermark',
    cenarioStyle: env.CENARIO_STYLE ||
      'concept art, digital painting, cinematic wide establishing shot, atmospheric lighting, highly detailed environment, no text, no watermark',
  },
  jogo: {
    maxMapas: Math.min(8, Math.max(3, numero(env.MAX_MAPAS, 5))),
    minAcoesPorMapa: Math.max(0, numero(env.MIN_ACOES_POR_MAPA, 2)),
    historicoNoPrompt: 14,
    mensagensNoEstado: 60,
    maxTextoJogador: 600,
  },
};
