'use strict';
// Uso: npm run migrate
const { migrate, fechar } = require('../src/config/database');
const config = require('../src/config/env');

migrate()
  .then(() => console.log(`Schema "${config.db.name}" aplicado com sucesso.`))
  .catch((err) => {
    console.error('Falha ao aplicar o schema:', err.message);
    process.exitCode = 1;
  })
  .finally(fechar);
