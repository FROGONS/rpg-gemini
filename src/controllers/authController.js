'use strict';
const bcrypt = require('bcryptjs');
const usuarioModel = require('../models/usuarioModel');
const { assinarToken } = require('../middlewares/auth');
const { AppError } = require('../utils/errors');
const { limpar } = require('../utils/texto');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const publico = (u) => ({ id: u.id, nome: u.nome, email: u.email });

async function cadastro(req, res) {
  const nome = limpar(req.body.nome, 80);
  const email = limpar(req.body.email, 120).toLowerCase();
  const senha = String(req.body.senha || '');
  if (nome.length < 2) throw new AppError(400, 'Informe seu nome.', 'DADOS_INVALIDOS');
  if (!EMAIL.test(email)) throw new AppError(400, 'Informe um e-mail válido.', 'DADOS_INVALIDOS');
  if (senha.length < 6 || senha.length > 72) throw new AppError(400, 'A senha deve ter entre 6 e 72 caracteres.', 'DADOS_INVALIDOS');

  const senhaHash = await bcrypt.hash(senha, 10); // CHAR(60) no banco
  let id;
  try {
    id = await usuarioModel.criar({ nome, email, senhaHash });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new AppError(409, 'Este e-mail já está cadastrado.', 'EMAIL_EM_USO');
    throw err;
  }
  const usuario = { id, nome, email };
  res.status(201).json({ token: assinarToken(usuario), usuario: publico(usuario) });
}

async function login(req, res) {
  const email = limpar(req.body.email, 120).toLowerCase();
  const senha = String(req.body.senha || '');
  const usuario = await usuarioModel.buscarPorEmail(email);
  // mesma mensagem para e-mail inexistente e senha errada (nao revela quais e-mails existem)
  const confere = usuario ? await bcrypt.compare(senha, usuario.senha_hash) : false;
  if (!confere) throw new AppError(401, 'E-mail ou senha incorretos.', 'CREDENCIAIS_INVALIDAS');
  res.json({ token: assinarToken(usuario), usuario: publico(usuario) });
}

async function eu(req, res) {
  const usuario = await usuarioModel.buscarPorId(req.usuario.id);
  if (!usuario) throw new AppError(401, 'Sessão inválida. Faça login novamente.', 'NAO_AUTENTICADO');
  res.json({ usuario: publico(usuario) });
}

module.exports = { cadastro, login, eu };
