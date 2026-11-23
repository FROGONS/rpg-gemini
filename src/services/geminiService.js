'use strict';
// Cliente do Google GenAI (@google/genai). A chave fica somente aqui, no back-end (.env).
// Todo o resto do sistema chama estas funcoes e recebe AppError ja traduzido (429 incluso).
const { GoogleGenAI } = require('@google/genai');
const config = require('../config/env');
const { AppError } = require('../utils/errors');
const { extrairJSON } = require('../utils/texto');

let cliente = null;
function getClient() {
  if (!config.gemini.apiKey) {
    throw new AppError(503, 'A chave da IA (GEMINI_API_KEY) não está configurada no servidor.', 'IA_NAO_CONFIGURADA');
  }
  if (!cliente) cliente = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  return cliente;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const statusDe = (err) => Number(err?.status ?? err?.code ?? err?.error?.code) || 0;

const ehRateLimit = (err) => statusDe(err) === 429 || /RESOURCE_EXHAUSTED|\b429\b|quota/i.test(String(err?.message || ''));
const ehTransitorio = (err) => [500, 502, 503, 504].includes(statusDe(err)) || /UNAVAILABLE|overloaded|fetch failed|ECONNRESET|ETIMEDOUT/i.test(String(err?.message || ''));

// Traduz erros do SDK para mensagens amigaveis exibidas na interface.
// A causa real (status e mensagem da API) vai para o terminal do servidor.
function traduzirErro(err) {
  if (err instanceof AppError) return err;
  const status = statusDe(err);
  console.error(`[gemini] falha (status ${status || 'sem status'}): ${String(err?.message || err).slice(0, 400)}`);
  if (ehRateLimit(err)) {
    return new AppError(429, 'A IA recebeu muitas requisições agora (limite atingido). Aguarde alguns segundos e tente novamente.', 'RATE_LIMIT');
  }
  if (status === 404 || /NOT_FOUND|is not found/i.test(String(err?.message || ''))) {
    return new AppError(502, 'Modelo do Gemini não encontrado. Confira GEMINI_TEXT_MODEL e GEMINI_IMAGE_MODEL no .env (rode: node scripts/listar-modelos.js).', 'MODELO_INVALIDO');
  }
  if ([400, 401, 403].includes(status)) {
    return new AppError(502, 'A IA recusou a requisição. Confira a chave e os modelos configurados no servidor.', 'IA_ERRO');
  }
  return new AppError(502, 'Não foi possível falar com a IA agora. Tente novamente em instantes.', 'IA_ERRO');
}

// Repete em caso de 429/5xx com espera exponencial (2 retentativas); depois devolve o erro traduzido.
async function comRetry(fn, { tentativas = 3, baseMs = 1500 } = {}) {
  let ultimo;
  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn();
    } catch (err) {
      ultimo = err;
      if (err instanceof AppError) throw err;
      const repetir = ehRateLimit(err) || ehTransitorio(err);
      if (!repetir || i === tentativas - 1) break;
      await dormir(baseMs * 2 ** i + Math.floor(Math.random() * 400));
    }
  }
  throw traduzirErro(ultimo);
}

async function gerarTexto({ sistema, prompt, json = true, temperatura = 0.9 }) {
  const ai = getClient();
  return comRetry(async () => {
    const resposta = await ai.models.generateContent({
      model: config.gemini.textModel,
      contents: prompt,
      config: {
        systemInstruction: sistema,
        temperature: temperatura,
        responseMimeType: json ? 'application/json' : 'text/plain',
      },
    });
    const texto = resposta.text;
    if (!texto) throw new AppError(422, 'A IA não devolveu texto (possível bloqueio de segurança). Reformule a ação.', 'RESPOSTA_VAZIA');
    return texto;
  });
}

// Pede JSON ao modelo; se vier malformado, tenta mais uma vez.
async function gerarJSON(opcoes) {
  let ultimoErro;
  for (let i = 0; i < 2; i++) {
    const texto = await gerarTexto({ ...opcoes, json: true });
    try {
      return extrairJSON(texto);
    } catch (err) {
      ultimoErro = err;
    }
  }
  throw new AppError(502, 'A IA devolveu uma resposta em formato inesperado. Tente novamente.', 'IA_FORMATO_INVALIDO', { causa: ultimoErro?.message });
}

// Gera uma imagem (Nano Banana via generateContent, ou Imagen via generateImages).
async function gerarImagemBruta(prompt, { aspectRatio = '1:1' } = {}) {
  const ai = getClient();
  const modelo = config.gemini.imageModel;
  return comRetry(async () => {
    if (/^imagen/i.test(modelo)) {
      const r = await ai.models.generateImages({ model: modelo, prompt, config: { numberOfImages: 1, aspectRatio } });
      const bytes = r.generatedImages?.[0]?.image?.imageBytes;
      if (!bytes) throw new AppError(422, 'A IA não devolveu imagem (possível bloqueio de segurança). Ajuste a descrição.', 'IMAGEM_BLOQUEADA');
      return { buffer: Buffer.from(bytes, 'base64'), mime: 'image/png' };
    }
    const r = await ai.models.generateContent({
      model: modelo,
      contents: prompt,
      config: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio } },
    });
    const partes = r.candidates?.[0]?.content?.parts || [];
    const parte = partes.find((p) => p.inlineData?.data);
    if (!parte) throw new AppError(422, 'A IA não devolveu imagem (possível bloqueio de segurança). Ajuste a descrição.', 'IMAGEM_BLOQUEADA');
    return { buffer: Buffer.from(parte.inlineData.data, 'base64'), mime: parte.inlineData.mimeType || 'image/png' };
  });
}

module.exports = { gerarTexto, gerarJSON, gerarImagemBruta, traduzirErro, ehRateLimit };