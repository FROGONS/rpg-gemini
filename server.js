'use strict';
const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');

const config = require('./src/config/env');
const db = require('./src/config/database');
const routes = require('./src/routes');
const { naoEncontrado, tratarErros } = require('./src/middlewares/errorHandler');
const { registrar } = require('./src/sockets/gameSocket');
const personagemModel = require('./src/models/personagemModel');
const mapaModel = require('./src/models/mapaModel');

async function iniciar() {
  try {
    if (config.autoMigrate) await db.migrate();
    await db.query('SELECT 1');
  } catch (err) {
    console.error(`\nNão foi possível conectar ao MySQL (${config.db.host}:${config.db.port}, usuário "${config.db.user}").`);
    console.error('Confira DB_HOST, DB_USER e DB_PASSWORD no arquivo .env e se o MySQL 8 está rodando.');
    console.error(`Detalhe: ${err.message}\n`);
    process.exit(1);
  }

  // Geracoes de imagem interrompidas por um reinicio nao ficam presas em "gerando".
  await personagemModel.marcarGerandoComoErro();
  await mapaModel.marcarGerandoComoErro();

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/api', routes);
  app.use('/api', naoEncontrado);
  app.use(tratarErros);

  const server = http.createServer(app);
  const io = new Server(server);
  app.set('io', io);
  registrar(io);

  server.listen(config.port, () => {
    console.log(`\nRPG Multiplayer com Gemini rodando em http://localhost:${config.port}`);
    console.log(config.gemini.mock
      ? 'IA: MODO DEMONSTRAÇÃO (Mestre e imagens simulados). Defina GEMINI_API_KEY no .env para usar o Gemini.'
      : `IA: Gemini ativo (texto: ${config.gemini.textModel} | imagem: ${config.gemini.imageModel})`);
  });

  const encerrar = () => { server.close(() => db.fechar().finally(() => process.exit(0))); };
  process.on('SIGINT', encerrar);
  process.on('SIGTERM', encerrar);
}

iniciar();
