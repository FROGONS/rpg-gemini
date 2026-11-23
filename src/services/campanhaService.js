'use strict';
// Criacao e entrada em salas + geracao da campanha (prelúdio, objetivo, arvore de mapas).
const { withTransaction } = require('../config/database');
const salaModel = require('../models/salaModel');
const mapaModel = require('../models/mapaModel');
const personagemModel = require('../models/personagemModel');
const mestre = require('./mestreService');
const imageService = require('./imageService');
const { salvarImagem } = require('../utils/storage');
const { gerarCodigoSala } = require('../utils/codigo');
const { AppError } = require('../utils/errors');
const { limpar, limparOuNulo, inteiro } = require('../utils/texto');

const nomeSala = (salaId) => `sala:${salaId}`;

async function personagemDoUsuario(personagemId, usuarioId) {
  const p = await personagemModel.buscarPorId(Number(personagemId));
  if (!p || p.usuario_id !== usuarioId) throw new AppError(400, 'Escolha um dos seus personagens.', 'PERSONAGEM_INVALIDO');
  return p;
}

async function gerarCodigoUnico() {
  for (let i = 0; i < 8; i++) {
    const codigo = gerarCodigoSala();
    if (!(await salaModel.buscarPorCodigo(codigo))) return codigo;
  }
  throw new AppError(500, 'Não foi possível gerar um código de sala. Tente de novo.', 'CODIGO_INDISPONIVEL');
}

// Gera a ilustracao do mapa em segundo plano e avisa a sala por WebSocket (latencia de imagem nao trava o jogo).
async function gerarImagemMapa(io, sala, mapa) {
  const emitir = (dados) => io && io.to(nomeSala(sala.id)).emit('mapa:imagem', { mapa_id: mapa.id, ...dados });
  try {
    await mapaModel.atualizar(mapa.id, { status_imagem: 'gerando' });
    emitir({ status: 'gerando' });
    const atual = await mapaModel.buscarPorId(mapa.id);
    const prompt = imageService.montarPromptCenario(sala, atual);
    const { buffer, mime } = await imageService.gerarImagem(prompt, { aspectRatio: '16:9', tipo: 'cenario', rotulo: atual.nome, semente: `${sala.codigo}${atual.ordem}` });
    const url = await salvarImagem('mapas', `m${mapa.id}-${Date.now()}`, buffer, mime);
    await mapaModel.atualizar(mapa.id, { imagem_url: url, status_imagem: 'pronta' });
    emitir({ status: 'pronta', imagem_url: url });
  } catch (err) {
    await mapaModel.atualizar(mapa.id, { status_imagem: 'erro' }).catch(() => {});
    emitir({
      status: 'erro', codigo: err.codigo || 'IA_ERRO',
      mensagem: err.status && err.status < 500 ? err.message : 'Não foi possível gerar a ilustração do cenário.',
    });
  }
}

// Fluxo: INSERT sala + participacao do host -> Mestre cria a campanha -> salva mapas -> descreve o 1o mapa -> imagem.
async function criarSala(io, usuarioId, dados) {
  const nome = limpar(dados.nome, 100);
  const tema = limpar(dados.tema, 600);
  const tom = limparOuNulo(dados.tom, 60);
  const maxJogadores = inteiro(dados.max_jogadores, 1, 8, 4);
  if (nome.length < 3) throw new AppError(400, 'Dê um nome para a aventura (mínimo de 3 caracteres).', 'DADOS_INVALIDOS');
  if (tema.length < 10) throw new AppError(400, 'Descreva o tema ou cenário da aventura (mínimo de 10 caracteres).', 'DADOS_INVALIDOS');
  const personagem = await personagemDoUsuario(dados.personagem_id, usuarioId);

  const codigo = await gerarCodigoUnico();
  const salaId = await withTransaction(async (conn) => {
    const id = await salaModel.criar({ host_id: usuarioId, codigo, nome, tema, tom, max_jogadores: maxJogadores }, conn);
    await salaModel.criarParticipacao({ sala_id: id, personagem_id: personagem.id, vida_atual: personagem.vida_maxima }, conn);
    return id;
  });

  try {
    const camp = await mestre.gerarCampanha({ nome, tema, tom, jogadores: maxJogadores });
    const ids = await withTransaction(async (conn) => {
      await salaModel.atualizar(salaId, { preludio: camp.preludio, objetivo: camp.objetivo }, conn);
      return mapaModel.criarArvore(salaId, camp.mapas, conn);
    });
    const primeiro = await mapaModel.buscarPorId(ids[1]);
    const salaBase = await salaModel.buscarPorId(salaId);
    const desc = await mestre.descreverMapa({ sala: salaBase, mapa: primeiro });
    await mapaModel.atualizar(primeiro.id, { descricao: desc.descricao, prompt_imagem: desc.prompt_imagem });
    await salaModel.atualizar(salaId, { mapa_atual_id: primeiro.id, status: 'aguardando' });
    const sala = await salaModel.buscarPorId(salaId);
    gerarImagemMapa(io, sala, primeiro); // sem await: a imagem chega depois pelo socket
    return { codigo: sala.codigo, nome: sala.nome, status: sala.status };
  } catch (err) {
    await salaModel.excluir(salaId).catch(() => {}); // sem campanha, nao deixa sala "fantasma"
    throw err;
  }
}

async function entrarSala(usuarioId, dados) {
  const codigo = limpar(dados.codigo, 6).toUpperCase();
  if (codigo.length !== 6) throw new AppError(400, 'O código da sala tem 6 caracteres.', 'CODIGO_INVALIDO');
  const sala = await salaModel.buscarPorCodigo(codigo);
  if (!sala) throw new AppError(404, 'Código de sala inválido.', 'SALA_NAO_ENCONTRADA');
  if (sala.status === 'encerrada') throw new AppError(410, 'Esta aventura já foi encerrada.', 'SALA_ENCERRADA');
  if (sala.status === 'preparando') throw new AppError(409, 'O Mestre ainda está preparando esta sala. Tente novamente em instantes.', 'SALA_PREPARANDO');

  const existente = await salaModel.buscarParticipacaoDoUsuario(sala.id, usuarioId);
  if (existente && existente.status !== 'saiu') return { codigo: sala.codigo };

  if ((await salaModel.contarOcupadas(sala.id)) >= sala.max_jogadores) {
    throw new AppError(409, 'A sala está cheia.', 'SALA_CHEIA');
  }
  if (existente) {
    await salaModel.atualizarParticipacao(existente.participacao_id, { status: existente.vida_atual > 0 ? 'ativo' : 'caido' });
    return { codigo: sala.codigo };
  }
  const personagem = await personagemDoUsuario(dados.personagem_id, usuarioId);
  await salaModel.criarParticipacao({ sala_id: sala.id, personagem_id: personagem.id, vida_atual: personagem.vida_maxima });
  return { codigo: sala.codigo };
}

async function sair(usuarioId, codigo) {
  const sala = await salaModel.buscarPorCodigo(limpar(codigo, 6).toUpperCase());
  if (!sala) throw new AppError(404, 'Sala não encontrada.', 'SALA_NAO_ENCONTRADA');
  const part = await salaModel.buscarParticipacaoDoUsuario(sala.id, usuarioId);
  if (!part) throw new AppError(404, 'Você não participa desta sala.', 'SEM_PARTICIPACAO');
  await salaModel.atualizarParticipacao(part.participacao_id, { status: 'saiu' });
}

async function listarMinhas(usuarioId) {
  const linhas = await salaModel.listarDoUsuario(usuarioId);
  return linhas.map((s) => ({
    codigo: s.codigo, nome: s.nome, tema: s.tema, status: s.status, max_jogadores: s.max_jogadores,
    sou_host: s.host_id === usuarioId, personagem: s.personagem_nome,
  }));
}

module.exports = { criarSala, entrarSala, sair, listarMinhas, gerarImagemMapa, nomeSala };
