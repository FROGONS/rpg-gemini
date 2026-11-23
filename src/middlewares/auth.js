'use strict';
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { AppError } = require('../utils/errors');

function assinarToken(usuario) {
  return jwt.sign({ sub: usuario.id, nome: usuario.nome }, config.jwt.secret, { expiresIn: config.jwt.expiraEm });
}

function verificarToken(token) {
  try {
    const dados = jwt.verify(token, config.jwt.secret);
    return { id: dados.sub, nome: dados.nome };
  } catch {
    throw new AppError(401, 'Sessão inválida ou expirada. Faça login novamente.', 'NAO_AUTENTICADO');
  }
}

// Protege rotas privadas: exige "Authorization: Bearer <jwt>".
function autenticar(req, _res, next) {
  const cabecalho = req.headers.authorization || '';
  const [tipo, token] = cabecalho.split(' ');
  if (tipo !== 'Bearer' || !token) return next(new AppError(401, 'Faça login para continuar.', 'NAO_AUTENTICADO'));
  try {
    req.usuario = verificarToken(token);
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { assinarToken, verificarToken, autenticar };
