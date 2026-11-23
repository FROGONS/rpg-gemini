'use strict';
// Limitador simples em memoria (por IP) para frear forca bruta nas rotas de autenticacao.
const { AppError } = require('../utils/errors');

function limitar({ janelaMs = 15 * 60 * 1000, maximo = 30 } = {}) {
  const hits = new Map();
  setInterval(() => {
    const agora = Date.now();
    for (const [chave, v] of hits) if (v.expira <= agora) hits.delete(chave);
  }, janelaMs).unref();

  return (req, _res, next) => {
    const agora = Date.now();
    const chave = req.ip;
    const atual = hits.get(chave);
    if (!atual || atual.expira <= agora) {
      hits.set(chave, { total: 1, expira: agora + janelaMs });
      return next();
    }
    atual.total += 1;
    if (atual.total > maximo) return next(new AppError(429, 'Muitas tentativas. Aguarde alguns minutos.', 'MUITAS_TENTATIVAS'));
    return next();
  };
}

module.exports = { limitar };
