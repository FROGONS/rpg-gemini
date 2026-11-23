'use strict';
// CICLO DE JOGO. Cada acao de um jogador passa por:
//   1. validacao  2. arbitragem (IA decide se ha teste)  3. dados e dano (SERVIDOR)
//   4. narracao do desfecho (IA)  5. aplicacao dos efeitos pelas regras  6. broadcast
const config = require('../config/env');
const { withTransaction } = require('../config/database');
const salaModel = require('../models/salaModel');
const mapaModel = require('../models/mapaModel');
const npcModel = require('../models/npcModel');
const itemModel = require('../models/itemModel');
const mensagemModel = require('../models/mensagemModel');
const regras = require('./regrasService');
const mestre = require('./mestreService');
const campanha = require('./campanhaService');
const { AppError } = require('../utils/errors');
const { limpar } = require('../utils/texto');

const { nomeSala } = campanha;
const MAX_ITENS_POR_PERSONAGEM = 12;
const MAX_NPCS_POR_MAPA = 6;

// ---------------------------------------------------------------- fila por sala (acoes sao processadas em ordem)
const filas = new Map();
function enfileirar(salaId, tarefa) {
  const anterior = filas.get(salaId) || Promise.resolve();
  const proxima = anterior.catch(() => {}).then(tarefa);
  filas.set(salaId, proxima);
  proxima.catch(() => {}).finally(() => { if (filas.get(salaId) === proxima) filas.delete(salaId); });
  return proxima;
}

// Quantas acoes de jogadores ja aconteceram no mapa atual (regra de ritmo: nao da para "pular" mapas).
const contadorAcoes = new Map();
async function acoesNoMapa(sala, mapa) {
  if (!contadorAcoes.has(sala.id)) {
    contadorAcoes.set(sala.id, mapa.visitado_em ? await mensagemModel.contarAcoesDesde(sala.id, mapa.visitado_em) : 0);
  }
  return contadorAcoes.get(sala.id);
}

// Acoes que falharam na IA (429, formato...) ficam pendentes: "tentar novamente" reaproveita o dado ja rolado.
const pendentes = new Map();

// ---------------------------------------------------------------- formatadores
function formatarParticipante(p, itens) {
  return {
    participacao_id: p.participacao_id, personagem_id: p.personagem_id, usuario_id: p.usuario_id,
    nome: p.nome, classe: p.classe, avatar_url: p.avatar_url, status_avatar: p.status_avatar,
    vida_atual: p.vida_atual, vida_maxima: p.vida_maxima, status: p.status,
    atributos: Object.fromEntries(regras.ATRIBUTOS.map((a) => [a, p[a]])),
    inventario: itens.filter((i) => i.participacao_id === p.participacao_id)
      .map((i) => ({ id: i.id, nome: i.nome, descricao: i.descricao, quantidade: i.quantidade })),
  };
}

function salaPublica(sala, usuarioId) {
  return {
    id: sala.id, codigo: sala.codigo, nome: sala.nome, tema: sala.tema, tom: sala.tom,
    preludio: sala.preludio, objetivo: sala.objetivo, status: sala.status,
    max_jogadores: sala.max_jogadores, eu_sou_host: sala.host_id === usuarioId,
  };
}

async function listarParticipantesComItens(salaId) {
  const lista = await salaModel.listarParticipantes(salaId);
  const itens = await itemModel.listarPorParticipacoes(lista.map((p) => p.participacao_id));
  return lista.map((p) => formatarParticipante(p, itens));
}

// Estado completo enviado ao entrar/reconectar na sala.
async function montarEstado(sala, usuarioId) {
  const mapa = sala.mapa_atual_id ? await mapaModel.buscarPorId(sala.mapa_atual_id) : null;
  return {
    sala: salaPublica(sala, usuarioId),
    mapa: mapaModel.publico(mapa),
    participantes: await listarParticipantesComItens(sala.id),
    npcs: mapa ? (await npcModel.listarPorMapa(mapa.id)).map(npcModel.publico) : [],
    mensagens: await mensagemModel.listarRecentes(sala.id, config.jogo.mensagensNoEstado),
  };
}

// Contexto que o Mestre recebe (cena + fichas + historico + NPCs).
async function montarContexto(sala) {
  const mapa = await mapaModel.buscarPorId(sala.mapa_atual_id);
  const filhos = await mapaModel.listarFilhos(mapa.id);
  const participantes = await listarParticipantesComItens(sala.id);
  const npcs = await npcModel.listarPorMapa(mapa.id);
  const recentes = await mensagemModel.listarRecentes(sala.id, config.jogo.historicoNoPrompt);
  const acoes = await acoesNoMapa(sala, mapa);
  return {
    sala: { nome: sala.nome, tema: sala.tema, tom: sala.tom, preludio: sala.preludio, objetivo: sala.objetivo },
    mapa: {
      id: mapa.id, ordem: mapa.ordem, nome: mapa.nome, resumo: mapa.resumo, descricao: mapa.descricao,
      saidas: filhos.map((f) => ({ id: f.id, ordem: f.ordem, nome: f.nome, resumo: f.resumo })),
      eh_final: filhos.length === 0,
      acoes_no_mapa: acoes, minimo_acoes: config.jogo.minAcoesPorMapa,
    },
    personagens: participantes.map((p) => ({ ...p, inventario: p.inventario.map((i) => i.nome) })),
    npcs,
    historico: recentes.map((m) => ({
      autor: m.autor?.nome || (m.tipo === 'narracao' ? 'Mestre' : 'Sistema'),
      tipo: m.tipo, texto: limpar(m.conteudo, 400),
    })),
  };
}

// ---------------------------------------------------------------- emissao
async function emitirMensagens(io, salaId, ids) {
  for (const id of ids) {
    const m = await mensagemModel.buscarFormatada(id);
    if (m) io.to(nomeSala(salaId)).emit('mensagem', m);
  }
}
async function emitirParticipantes(io, salaId) {
  io.to(nomeSala(salaId)).emit('participantes', await listarParticipantesComItens(salaId));
}
async function emitirNpcs(io, mapaId, salaId) {
  io.to(nomeSala(salaId)).emit('npcs', (await npcModel.listarPorMapa(mapaId)).map(npcModel.publico));
}

// ---------------------------------------------------------------- inicio da aventura (somente o host)
function iniciarAventura(io, salaId, usuarioId) {
  return enfileirar(salaId, async () => {
    const sala = await salaModel.buscarPorId(salaId);
    if (!sala) throw new AppError(404, 'Sala não encontrada.', 'SALA_NAO_ENCONTRADA');
    if (sala.host_id !== usuarioId) throw new AppError(403, 'Só o anfitrião pode iniciar a aventura.', 'APENAS_HOST');
    if (sala.status !== 'aguardando') throw new AppError(409, 'A aventura já foi iniciada ou encerrada.', 'STATUS_INVALIDO');
    const mapa = await mapaModel.buscarPorId(sala.mapa_atual_id);
    await salaModel.atualizar(sala.id, { status: 'em_jogo' });
    await mapaModel.marcarVisitado(mapa.id);
    contadorAcoes.set(sala.id, 0);
    const ids = [];
    ids.push(await mensagemModel.criar({ sala_id: sala.id, tipo: 'narracao', conteudo: sala.preludio }));
    ids.push(await mensagemModel.criar({ sala_id: sala.id, tipo: 'sistema', conteudo: `Objetivo: ${sala.objetivo}` }));
    ids.push(await mensagemModel.criar({ sala_id: sala.id, tipo: 'narracao', conteudo: `${mapa.nome}. ${mapa.descricao || mapa.resumo || ''}` }));
    io.to(nomeSala(sala.id)).emit('sala:status', { status: 'em_jogo' });
    await emitirMensagens(io, sala.id, ids);
  });
}

async function encerrar(io, sala, motivo) {
  await salaModel.atualizar(sala.id, { status: 'encerrada' });
  const texto = motivo === 'vitoria'
    ? 'Vitória! A campanha foi concluída. Obrigado por jogar.'
    : 'Todos os aventureiros caíram. A campanha termina aqui.';
  const id = await mensagemModel.criar({ sala_id: sala.id, tipo: 'sistema', conteudo: texto });
  io.to(nomeSala(sala.id)).emit('sala:status', { status: 'encerrada', desfecho: motivo });
  await emitirMensagens(io, sala.id, [id]);
}

// ---------------------------------------------------------------- troca de mapa
async function avancarMapa(io, sala, destinoId) {
  const destino = await mapaModel.buscarPorId(destinoId);
  await salaModel.atualizar(sala.id, { mapa_atual_id: destino.id });
  await mapaModel.marcarVisitado(destino.id);
  contadorAcoes.set(sala.id, 0);

  // descanso entre mapas (regra do servidor)
  const participantes = await salaModel.listarParticipantes(sala.id);
  await withTransaction(async (conn) => {
    for (const p of participantes) {
      const vida = regras.recuperarAoAvancar(p.vida_atual, p.vida_maxima, p.status);
      await salaModel.atualizarParticipacao(p.participacao_id, { vida_atual: vida, status: 'ativo' }, conn);
    }
  });

  let mapa = destino;
  if (!mapa.descricao) {
    let desc;
    try {
      desc = await mestre.descreverMapa({ sala, mapa });
    } catch {
      desc = { descricao: mapa.resumo || mapa.nome, prompt_imagem: null }; // falha de IA nao trava a historia
    }
    await mapaModel.atualizar(mapa.id, { descricao: desc.descricao, prompt_imagem: desc.prompt_imagem });
    mapa = await mapaModel.buscarPorId(mapa.id);
  }

  const ids = [
    await mensagemModel.criar({ sala_id: sala.id, tipo: 'sistema', conteudo: `O grupo avança para: ${mapa.nome}. Todos descansam um pouco (vida recuperada).` }),
    await mensagemModel.criar({ sala_id: sala.id, tipo: 'narracao', conteudo: `${mapa.nome}. ${mapa.descricao}` }),
  ];
  io.to(nomeSala(sala.id)).emit('mapa:atualizado', { mapa: mapaModel.publico(mapa), npcs: [] });
  await emitirMensagens(io, sala.id, ids);
  await emitirParticipantes(io, sala.id);
  campanha.gerarImagemMapa(io, sala, mapa); // em segundo plano
}

// ---------------------------------------------------------------- acao do jogador
function processarAcao(io, { salaId, usuarioId, tipo, texto }) {
  return enfileirar(salaId, async () => {
    const sala = await salaModel.buscarPorId(salaId);
    if (!sala || sala.status !== 'em_jogo') throw new AppError(409, 'A aventura não está em andamento.', 'SALA_FORA_DE_JOGO');
    const part = await salaModel.buscarParticipacaoDoUsuario(salaId, usuarioId);
    if (!part || part.status === 'saiu') throw new AppError(403, 'Você não participa desta sala.', 'SEM_PARTICIPACAO');
    if (part.status !== 'ativo') throw new AppError(409, 'Seu personagem está caído e não pode agir agora.', 'PERSONAGEM_CAIDO');

    const conteudo = limpar(texto, config.jogo.maxTextoJogador);
    if (!conteudo) throw new AppError(400, 'Escreva o que o seu personagem faz ou diz.', 'TEXTO_VAZIO');
    const tipoFinal = tipo === 'fala' ? 'fala' : 'acao';

    const msgId = await mensagemModel.criar({ sala_id: salaId, personagem_id: part.personagem_id, tipo: tipoFinal, conteudo });
    if (contadorAcoes.has(salaId)) contadorAcoes.set(salaId, contadorAcoes.get(salaId) + 1);
    await emitirMensagens(io, salaId, [msgId]);

    const pend = { msgId, salaId, usuarioId, participacaoId: part.participacao_id, tipo: tipoFinal, texto: conteudo, arbitro: null, fatos: null };
    return resolver(io, pend);
  });
}

function reenviarAcao(io, { salaId, usuarioId, mensagemId }) {
  return enfileirar(salaId, async () => {
    const pend = pendentes.get(Number(mensagemId));
    if (!pend || pend.salaId !== salaId || pend.usuarioId !== usuarioId) {
      throw new AppError(404, 'Não há ação pendente para reenviar. Envie a ação novamente.', 'SEM_PENDENCIA');
    }
    const sala = await salaModel.buscarPorId(salaId);
    if (!sala || sala.status !== 'em_jogo') throw new AppError(409, 'A aventura não está em andamento.', 'SALA_FORA_DE_JOGO');
    return resolver(io, pend);
  });
}

async function resolver(io, pend) {
  const canal = nomeSala(pend.salaId);
  io.to(canal).emit('mestre:digitando', { ativo: true });
  try {
    if (pend.aplicado) { pendentes.delete(pend.msgId); return { ok: true }; }
    let sala = await salaModel.buscarPorId(pend.salaId);
    let ctx = await montarContexto(sala);
    const ator = ctx.personagens.find((p) => p.participacao_id === pend.participacaoId);
    if (!ator) throw new AppError(403, 'Você não participa desta sala.', 'SEM_PARTICIPACAO');

    // etapa 2: arbitragem
    if (!pend.arbitro) pend.arbitro = await mestre.arbitrar({ contexto: ctx, ator, tipo: pend.tipo, texto: pend.texto });
    // etapa 3: dados e dano, decididos pelo servidor (uma unica vez por acao)
    if (!pend.fatos) pend.fatos = await aplicarRegras(io, pend, ctx, ator);
    // etapa 4: narracao
    sala = await salaModel.buscarPorId(pend.salaId);
    ctx = await montarContexto(sala);
    const narr = await mestre.narrar({ contexto: ctx, ator: ctx.personagens.find((p) => p.participacao_id === pend.participacaoId), tipo: pend.tipo, texto: pend.texto, fatos: pend.fatos });
    // etapas 5 e 6: efeitos e broadcast
    await aplicarDesfecho(io, sala, pend, ctx, narr);
    pendentes.delete(pend.msgId);
    return { ok: true };
  } catch (err) {
    if (!pend.aplicado) pendentes.set(pend.msgId, pend);
    if (err instanceof AppError) err.detalhes = { ...(err.detalhes || {}), mensagem_id: pend.msgId };
    throw err;
  } finally {
    io.to(canal).emit('mestre:digitando', { ativo: false });
  }
}

// Rola o d20 e calcula dano. Tudo aqui e deterministico em relacao as regras; a IA nao participa.
async function aplicarRegras(io, pend, ctx, ator) {
  const a = pend.arbitro;
  const fatos = { teste: null, dano_jogador: 0, vida_jogador_depois: ator.vida_atual, dano_npc: 0, npc_alvo: null };
  if (!a.exige_teste) return fatos;

  const t = regras.rolarTeste(ator.atributos[a.atributo], a.dificuldade);
  fatos.teste = { ...t, atributo: a.atributo, pericia: a.pericia };

  if (!t.sucesso && a.risco !== 'nenhum') {
    fatos.dano_jogador = regras.danoDeRisco(a.risco, t.falha_critica ? 2 : 1);
    fatos.vida_jogador_depois = regras.aplicarDano(ator.vida_atual, fatos.dano_jogador).vida;
  }
  if (t.sucesso && a.e_ataque) {
    const npc = ctx.npcs.find((n) => n.id === a.alvo_npc_id);
    if (npc) {
      const vidaAntes = npc.vida_atual ?? regras.VIDA_INICIAL_NPC[npc.atitude] ?? 8;
      fatos.dano_npc = regras.danoDeAtaque(t.modificador, t.critico);
      const { vida, caiu } = regras.aplicarDano(vidaAntes, fatos.dano_npc);
      fatos.npc_alvo = { id: npc.id, nome: npc.nome, vida_antes: vidaAntes, vida_depois: vida, derrotado: caiu };
    }
  }

  const rolagemId = await mensagemModel.registrarRolagem({
    mensagem_id: pend.msgId, atributo: a.atributo, pericia: a.pericia, faces: 20,
    resultado: t.dado, modificador: t.modificador, dificuldade: a.dificuldade,
  });
  io.to(nomeSala(pend.salaId)).emit('rolagem', {
    mensagem_id: pend.msgId,
    rolagem: mensagemModel.formatarRolagem({ id: rolagemId, atributo: a.atributo, pericia: a.pericia, faces: 20, resultado: t.dado, modificador: t.modificador, dificuldade: a.dificuldade }),
  });
  return fatos;
}

async function aplicarDesfecho(io, sala, pend, ctx, narr) {
  const fatos = pend.fatos;
  const ator = ctx.personagens.find((p) => p.participacao_id === pend.participacaoId);
  const bemSucedido = !fatos.teste || fatos.teste.sucesso;
  const ids = [];
  let npcsMudaram = false;

  await withTransaction(async (conn) => {
    // dano ao jogador
    if (fatos.dano_jogador > 0) {
      const { vida, caiu } = regras.aplicarDano(ator.vida_atual, fatos.dano_jogador);
      await salaModel.atualizarParticipacao(ator.participacao_id, { vida_atual: vida, status: caiu ? 'caido' : 'ativo' }, conn);
    }
    // dano ao NPC
    if (fatos.npc_alvo) {
      await npcModel.atualizarVida(fatos.npc_alvo.id, fatos.npc_alvo.vida_depois, conn);
      npcsMudaram = true;
    }

    // narracao do Mestre
    ids.push(await mensagemModel.criar({ sala_id: sala.id, tipo: 'narracao', conteudo: narr.narracao }, conn));

    // NPCs novos e falas de NPC
    const conhecidos = ctx.npcs.filter((n) => !(fatos.npc_alvo && fatos.npc_alvo.derrotado && fatos.npc_alvo.id === n.id));
    let total = await npcModel.contarPorMapa(ctx.mapa.id, conn);
    const criarNpc = async (n) => {
      if (total >= MAX_NPCS_POR_MAPA) return null;
      const atitude = n.atitude || 'neutro';
      const id = await npcModel.criar({
        sala_id: sala.id, mapa_id: ctx.mapa.id, nome: n.nome, descricao: n.descricao || null,
        personalidade: n.personalidade || null, atitude, vida_atual: regras.VIDA_INICIAL_NPC[atitude] ?? 8,
      }, conn);
      total += 1;
      npcsMudaram = true;
      const novo = { id, nome: n.nome, atitude };
      conhecidos.push(novo);
      ids.push(await mensagemModel.criar({ sala_id: sala.id, tipo: 'sistema', conteudo: `${n.nome} aparece na cena (${atitude}).` }, conn));
      return novo;
    };
    const mesmoNome = (a, b) => limpar(a, 80).toLowerCase() === limpar(b, 80).toLowerCase();
    for (const n of narr.novos_npcs) {
      if (!conhecidos.some((c) => mesmoNome(c.nome, n.nome))) await criarNpc(n);
    }
    for (const f of narr.falas_npc) {
      let npc = conhecidos.find((c) => (f.npc_id && c.id === f.npc_id)) || conhecidos.find((c) => f.nome && mesmoNome(c.nome, f.nome));
      if (!npc && f.nome) npc = await criarNpc({ nome: f.nome, atitude: 'neutro' });
      if (npc) ids.push(await mensagemModel.criar({ sala_id: sala.id, npc_id: npc.id, tipo: 'npc', conteudo: f.fala }, conn));
    }

    // efeitos mostrados como mensagens de sistema
    if (fatos.dano_jogador > 0) {
      const { vida, caiu } = regras.aplicarDano(ator.vida_atual, fatos.dano_jogador);
      ids.push(await mensagemModel.criar({ sala_id: sala.id, tipo: 'sistema', conteudo: `${ator.nome} sofre ${fatos.dano_jogador} de dano (vida ${vida}/${ator.vida_maxima}).${caiu ? ` ${ator.nome} caiu!` : ''}` }, conn));
    }
    if (fatos.npc_alvo) {
      const n = fatos.npc_alvo;
      ids.push(await mensagemModel.criar({ sala_id: sala.id, tipo: 'sistema', conteudo: `${n.nome} sofre ${fatos.dano_npc} de dano.${n.derrotado ? ` ${n.nome} foi derrotado!` : ''}` }, conn));
    }
    // item encontrado (so em acao bem-sucedida, limite de inventario)
    if (narr.item_encontrado && bemSucedido && ator.inventario.length < MAX_ITENS_POR_PERSONAGEM) {
      await itemModel.adicionar({ participacao_id: ator.participacao_id, nome: narr.item_encontrado.nome, descricao: narr.item_encontrado.descricao }, conn);
      ids.push(await mensagemModel.criar({ sala_id: sala.id, tipo: 'sistema', conteudo: `${ator.nome} obteve: ${narr.item_encontrado.nome}.` }, conn));
    }
  });

  pend.aplicado = true; // a partir daqui os efeitos estao gravados: uma nova tentativa nao pode duplicar a narracao
  try {
    await emitirMensagens(io, sala.id, ids);
    await emitirParticipantes(io, sala.id);
    if (npcsMudaram) await emitirNpcs(io, ctx.mapa.id, sala.id);

    // fim de jogo e troca de mapa: decisoes do servidor, com a IA apenas sugerindo
    const lista = await salaModel.listarParticipantes(sala.id);
    if (lista.length && lista.every((p) => p.status === 'caido')) return await encerrar(io, sala, 'derrota');
    const ritmoOk = ctx.mapa.acoes_no_mapa >= ctx.mapa.minimo_acoes;
    if (narr.campanha_concluida && ctx.mapa.eh_final && bemSucedido && ritmoOk) return await encerrar(io, sala, 'vitoria');
    if (narr.mudar_mapa && bemSucedido && ritmoOk && ctx.mapa.saidas.length) {
      const destino = ctx.mapa.saidas.find((s) => s.ordem === narr.destino_ordem) || ctx.mapa.saidas[0];
      return await avancarMapa(io, sala, destino.id);
    }
  } catch (err) {
    console.error('[jogo] falha apos gravar o desfecho:', err);
  }
  return null;
}

async function regerarImagemMapa(io, salaId, usuarioId) {
  const sala = await salaModel.buscarPorId(salaId);
  if (!sala || sala.host_id !== usuarioId) throw new AppError(403, 'Só o anfitrião pode refazer a ilustração.', 'APENAS_HOST');
  const mapa = await mapaModel.buscarPorId(sala.mapa_atual_id);
  if (mapa.status_imagem === 'gerando') throw new AppError(409, 'A ilustração já está sendo gerada.', 'JA_GERANDO');
  campanha.gerarImagemMapa(io, sala, mapa);
}

module.exports = {
  montarEstado, iniciarAventura, processarAcao, reenviarAcao, regerarImagemMapa,
  emitirParticipantes, listarParticipantesComItens,
};
