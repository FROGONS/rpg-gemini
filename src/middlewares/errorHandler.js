'use strict';
const { AppError, serializar } = require('../utils/errors');

function naoEncontrado(_req, _res, next) {
  next(new AppError(404, 'Rota não encontrada.', 'NAO_ENCONTRADO'));
}

// eslint-disable-next-line no-unused-vars
function tratarErros(err, _req, res, _next) {
  let erro = err;
  if (err.type === 'entity.parse.failed') erro = new AppError(400, 'JSON inválido.', 'JSON_INVALIDO');
  else if (err.type === 'entity.too.large') erro = new AppError(413, 'Requisição grande demais.', 'REQUISICAO_GRANDE');
  const status = erro instanceof AppError ? erro.status : 500;
  if (status >= 500) console.error('[erro]', err);
  res.status(status).json({ erro: serializar(erro) });
}

module.exports = { naoEncontrado, tratarErros };
