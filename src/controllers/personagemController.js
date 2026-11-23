'use strict';
const personagemService = require('../services/personagemService');

async function listar(req, res) {
  res.json({ personagens: await personagemService.listar(req.usuario.id) });
}

async function criar(req, res) {
  res.status(201).json({ personagem: await personagemService.criar(req.usuario.id, req.body) });
}

// Usado pelo front para acompanhar a geracao do retrato (polling).
async function obter(req, res) {
  res.json({ personagem: await personagemService.obter(Number(req.params.id), req.usuario.id) });
}

async function regerarAvatar(req, res) {
  res.json({ personagem: await personagemService.regerarAvatar(Number(req.params.id), req.usuario.id) });
}

module.exports = { listar, criar, obter, regerarAvatar };
