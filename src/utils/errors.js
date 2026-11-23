'use strict';
// Erro de negocio com status HTTP e codigo estavel para o front-end tratar.
class AppError extends Error {
  constructor(status, mensagem, codigo = 'ERRO', detalhes = null) {
    super(mensagem);
    this.name = 'AppError';
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

// Formato enviado ao cliente. Erros inesperados nunca vazam detalhes internos.
const serializar = (err) => ({
  codigo: err instanceof AppError ? err.codigo : 'ERRO_INTERNO',
  mensagem: err instanceof AppError ? err.message : 'Erro interno do servidor.',
  detalhes: err instanceof AppError ? err.detalhes || undefined : undefined,
});

module.exports = { AppError, serializar };
