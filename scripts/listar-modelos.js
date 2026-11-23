'use strict';
// Lista os modelos do Gemini disponiveis para a SUA chave, para voce copiar os nomes certos no .env.
// Uso: node scripts/listar-modelos.js
const { GoogleGenAI } = require('@google/genai');
const config = require('../src/config/env');

const NAO_TEXTO = /tts|audio|live|embedding|aqa|robotics|computer-use|learnlm|gemma/i;

async function main() {
  if (!config.gemini.apiKey) {
    console.log('Preencha GEMINI_API_KEY no arquivo .env e rode de novo.');
    process.exitCode = 1;
    return;
  }
  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  const texto = [];
  const imagem = [];
  try {
    const pager = await ai.models.list({ config: { pageSize: 100 } });
    for await (const modelo of pager) {
      const nome = String(modelo.name || '').replace(/^models\//, '');
      const acoes = modelo.supportedActions || [];
      if (/imagen/i.test(nome) && acoes.includes('predict')) imagem.push(nome);
      else if (/image/i.test(nome) && acoes.includes('generateContent')) imagem.push(nome);
      else if (/^gemini/i.test(nome) && acoes.includes('generateContent') && !NAO_TEXTO.test(nome)) texto.push(nome);
    }
  } catch (err) {
    console.log(`Erro ${err.status || ''}: ${String(err.message || err).slice(0, 300)}`);
    console.log('Confira se a chave está certa (começa com AIza) e se o computador tem internet.');
    process.exitCode = 1;
    return;
  }

  const mostrar = (titulo, lista, atual) => {
    console.log(`\\n${titulo}`);
    lista.sort().forEach((n) => console.log(`  ${n}${n === atual ? '   <- é o que está no seu .env' : ''}`));
    if (!lista.length) console.log('  (nenhum encontrado para esta chave)');
    if (atual && !lista.includes(atual)) console.log(`  ATENÇÃO: "${atual}" (do seu .env) NÃO está nesta lista. Troque por um da lista.`);
  };
  mostrar('Modelos de TEXTO (copie um para GEMINI_TEXT_MODEL):', texto, config.gemini.textModel);
  mostrar('Modelos de IMAGEM (copie um para GEMINI_IMAGE_MODEL):', imagem, config.gemini.imageModel);
  console.log('\\nDepois de editar o .env, pare o servidor (Ctrl+C) e rode npm start de novo.\\n');
}

main();