'use strict';
const personagemModel = require('../models/personagemModel');
const regras = require('./regrasService');
const imageService = require('./imageService');
const { salvarImagem } = require('../utils/storage');
const { AppError } = require('../utils/errors');
const { limpar } = require('../utils/texto');

const emAndamento = new Set();
const ultimosErros = new Map(); // personagem_id -> { codigo, mensagem } (somente em memoria)

function formatar(p) {
  const erro = p.status_avatar === 'erro'
    ? ultimosErros.get(p.id) || { codigo: 'IA_ERRO', mensagem: 'Não foi possível gerar o retrato. Tente novamente.' }
    : null;
  return {
    id: p.id, nome: p.nome, classe: p.classe, descricao_visual: p.descricao_visual,
    avatar_url: p.avatar_url, status_avatar: p.status_avatar, vida_maxima: p.vida_maxima,
    atributos: Object.fromEntries(regras.ATRIBUTOS.map((a) => [a, p[a]])),
    erro,
  };
}

async function criar(usuarioId, dados) {
  const nome = limpar(dados.nome, 80);
  const classe = limpar(dados.classe, 40);
  const descricao = limpar(dados.descricao_visual, 900);
  if (nome.length < 2) throw new AppError(400, 'Informe o nome do personagem.', 'DADOS_INVALIDOS');
  if (classe.length < 2) throw new AppError(400, 'Informe a classe do personagem.', 'DADOS_INVALIDOS');
  if (descricao.length < 10) throw new AppError(400, 'Descreva a aparência do personagem com um pouco mais de detalhe (mínimo de 10 caracteres).', 'DADOS_INVALIDOS');
  const atributos = regras.validarAtributos(dados.atributos);
  const id = await personagemModel.criar({
    usuario_id: usuarioId, nome, classe, descricao_visual: descricao, atributos,
    vida_maxima: regras.calcularVidaMaxima(atributos.constituicao),
  });
  gerarAvatar(id); // em segundo plano: o jogador ve o status "gerando" e acompanha por polling
  return formatar(await personagemModel.buscarPorId(id));
}

// Gera o retrato e grava avatar_url / status_avatar. Nunca lanca: falhas viram status "erro".
async function gerarAvatar(id) {
  if (emAndamento.has(id)) return;
  emAndamento.add(id);
  try {
    const p = await personagemModel.buscarPorId(id);
    if (!p) return;
    await personagemModel.atualizarAvatar(id, { status: 'gerando' });
    ultimosErros.delete(id);
    const prompt = imageService.montarPromptAvatar(p);
    const { buffer, mime } = await imageService.gerarImagem(prompt, { aspectRatio: '1:1', tipo: 'avatar', rotulo: p.nome, semente: `${p.nome}${p.classe}` });
    const url = await salvarImagem('avatars', `p${id}-${Date.now()}`, buffer, mime);
    await personagemModel.atualizarAvatar(id, { url, status: 'pronto' });
  } catch (err) {
    ultimosErros.set(id, { codigo: err.codigo || 'IA_ERRO', mensagem: err.status && err.status < 500 ? err.message : 'Não foi possível gerar o retrato. Tente novamente.' });
    await personagemModel.atualizarAvatar(id, { status: 'erro' }).catch(() => {});
  } finally {
    emAndamento.delete(id);
  }
}

async function obterDoUsuario(id, usuarioId) {
  const p = await personagemModel.buscarPorId(id);
  if (!p || p.usuario_id !== usuarioId) throw new AppError(404, 'Personagem não encontrado.', 'NAO_ENCONTRADO');
  return p;
}

async function listar(usuarioId) {
  return (await personagemModel.listarPorUsuario(usuarioId)).map(formatar);
}

async function obter(id, usuarioId) {
  return formatar(await obterDoUsuario(id, usuarioId));
}

async function regerarAvatar(id, usuarioId) {
  await obterDoUsuario(id, usuarioId);
  if (emAndamento.has(id)) {
    throw new AppError(409, 'O retrato já está sendo gerado.', 'JA_GERANDO');
  }
  await personagemModel.atualizarAvatar(id, { status: 'gerando' });
  gerarAvatar(id);
  return formatar(await personagemModel.buscarPorId(id));
}

module.exports = { criar, listar, obter, regerarAvatar, formatar };
