'use strict';
// Camada de tempo real (Socket.io). Autentica pelo JWT e sincroniza narracao, mapa e fichas da sala.
const { verificarToken } = require('../middlewares/auth');
const salaModel = require('../models/salaModel');
const jogoService = require('../services/jogoService');
const { nomeSala } = require('../services/campanhaService');
const { AppError } = require('../utils/errors');

function responder(ack, payload) {
  if (typeof ack === 'function') ack(payload);
}

function erroParaCliente(err) {
  if (err instanceof AppError) return { codigo: err.codigo, mensagem: err.message, detalhes: err.detalhes || undefined };
  console.error('[socket] erro inesperado:', err);
  return { codigo: 'ERRO_INTERNO', mensagem: 'Algo deu errado no servidor. Tente novamente.' };
}

async function emitirPresenca(io, salaId) {
  const sockets = await io.in(nomeSala(salaId)).fetchSockets();
  const usuarios = [...new Set(sockets.map((s) => s.data.usuarioId))];
  io.to(nomeSala(salaId)).emit('presenca', { usuarios });
}

function registrar(io) {
  io.use((socket, next) => {
    try {
      const usuario = verificarToken(socket.handshake.auth?.token);
      socket.data.usuarioId = usuario.id;
      socket.data.nome = usuario.nome;
      next();
    } catch (err) {
      next(err);
    }
  });

  io.on('connection', (socket) => {
    // executa o handler e converte erros em resposta amigavel (inclui o aviso de rate limit)
    const seguro = (handler) => async (dados, ack) => {
      try {
        const resultado = await handler(dados || {});
        responder(ack, { ok: true, ...(resultado || {}) });
      } catch (err) {
        const erro = erroParaCliente(err);
        if (erro.codigo === 'RATE_LIMIT') socket.emit('aviso', { tipo: 'rate_limit', ...erro });
        responder(ack, { ok: false, erro });
      }
    };

    const salaAtual = () => {
      if (!socket.data.salaId) throw new AppError(409, 'Entre em uma sala primeiro.', 'SEM_SALA');
      return socket.data.salaId;
    };

    socket.on('sala:conectar', seguro(async ({ codigo }) => {
      const sala = await salaModel.buscarPorCodigo(String(codigo || '').toUpperCase());
      if (!sala) throw new AppError(404, 'Sala não encontrada.', 'SALA_NAO_ENCONTRADA');
      const part = await salaModel.buscarParticipacaoDoUsuario(sala.id, socket.data.usuarioId);
      if (!part || part.status === 'saiu') throw new AppError(403, 'Você ainda não entrou nesta sala. Volte ao painel e use o código.', 'SEM_PARTICIPACAO');
      if (socket.data.salaId && socket.data.salaId !== sala.id) socket.leave(nomeSala(socket.data.salaId));
      socket.data.salaId = sala.id;
      socket.join(nomeSala(sala.id));
      const estado = await jogoService.montarEstado(sala, socket.data.usuarioId);
      await jogoService.emitirParticipantes(io, sala.id);
      await emitirPresenca(io, sala.id);
      return { estado };
    }));

    socket.on('sala:iniciar', seguro(async () => {
      await jogoService.iniciarAventura(io, salaAtual(), socket.data.usuarioId);
    }));

    socket.on('acao:enviar', seguro(async ({ tipo, texto }) => {
      await jogoService.processarAcao(io, { salaId: salaAtual(), usuarioId: socket.data.usuarioId, tipo, texto });
    }));

    socket.on('acao:reenviar', seguro(async ({ mensagem_id: mensagemId }) => {
      await jogoService.reenviarAcao(io, { salaId: salaAtual(), usuarioId: socket.data.usuarioId, mensagemId });
    }));

    socket.on('mapa:regerar-imagem', seguro(async () => {
      await jogoService.regerarImagemMapa(io, salaAtual(), socket.data.usuarioId);
    }));

    socket.on('disconnect', () => {
      if (socket.data.salaId) emitirPresenca(io, socket.data.salaId).catch(() => {});
    });
  });
}

module.exports = { registrar };
