'use strict';
const campanhaService = require('../services/campanhaService');

async function criar(req, res) {
  const sala = await campanhaService.criarSala(req.app.get('io'), req.usuario.id, req.body);
  res.status(201).json({ sala });
}

async function entrar(req, res) {
  res.json({ sala: await campanhaService.entrarSala(req.usuario.id, req.body) });
}

async function sair(req, res) {
  await campanhaService.sair(req.usuario.id, req.params.codigo);
  res.json({ ok: true });
}

async function minhas(req, res) {
  res.json({ salas: await campanhaService.listarMinhas(req.usuario.id) });
}

module.exports = { criar, entrar, sair, minhas };
