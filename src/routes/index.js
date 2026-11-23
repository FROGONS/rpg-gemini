'use strict';
const express = require('express');
const config = require('../config/env');
const { autenticar } = require('../middlewares/auth');
const { limitar } = require('../middlewares/rateLimit');
const auth = require('../controllers/authController');
const personagens = require('../controllers/personagemController');
const salas = require('../controllers/salaController');

// Envolve handlers async para que erros cheguem ao middleware de erro.
const rota = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const router = express.Router();

// Publica: informa ao front se o Mestre esta em modo demonstracao (nunca expoe chaves).
router.get('/config', (_req, res) => res.json({
  modo_demo: config.gemini.mock,
  max_pontos_extras: 12,
  atributo_min: 8,
  atributo_max: 16,
}));

router.post('/auth/cadastro', limitar({ maximo: 20 }), rota(auth.cadastro));
router.post('/auth/login', limitar({ maximo: 30 }), rota(auth.login));
router.get('/auth/me', autenticar, rota(auth.eu));

router.get('/personagens', autenticar, rota(personagens.listar));
router.post('/personagens', autenticar, rota(personagens.criar));
router.get('/personagens/:id', autenticar, rota(personagens.obter));
router.post('/personagens/:id/avatar', autenticar, rota(personagens.regerarAvatar));

router.get('/salas/minhas', autenticar, rota(salas.minhas));
router.post('/salas', autenticar, rota(salas.criar));
router.post('/salas/entrar', autenticar, rota(salas.entrar));
router.post('/salas/:codigo/sair', autenticar, rota(salas.sair));

module.exports = router;
