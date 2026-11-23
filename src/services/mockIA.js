'use strict';
// MODO DEMONSTRACAO: simula o Mestre do Jogo e a geracao de imagens, sem chamar o Gemini.
// E usado automaticamente quando GEMINI_API_KEY esta vazia (ou GEMINI_MOCK=true).
// A interface mock e a mesma do mestreService real, entao o resto do sistema nao muda.
const config = require('../config/env');
const { AppError } = require('../utils/errors');
const { ATRIBUTOS } = require('./regrasService');

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const sem = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const hash = (t) => { let h = 5381; for (const c of String(t)) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h; };
const escolher = (lista, semente) => lista[hash(semente) % lista.length];
const xml = (t) => String(t).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
const curto = (t, n) => (String(t).length > n ? `${String(t).slice(0, n - 1).trim()}…` : String(t));

// Para demonstrar o tratamento de erro 429 sem gastar cota: MOCK_SIMULAR_429=0.3 faz 30% das chamadas falharem.
function talvez429() {
  const p = Number(process.env.MOCK_SIMULAR_429);
  if (Number.isFinite(p) && p > 0 && Math.random() < p) {
    throw new AppError(429, 'A IA recebeu muitas requisições agora (limite atingido). Aguarde alguns segundos e tente novamente.', 'RATE_LIMIT');
  }
}

// ---------------------------------------------------------------- campanha e mapas
async function campanha({ nome, tema, tom }) {
  await dormir(500);
  talvez429();
  const base = [
    { ordem: 1, pai_ordem: null, nome: 'Portal de Entrada', resumo: 'O limiar do mundo, onde o grupo desperta entre sinais estranhos.' },
    { ordem: 2, pai_ordem: 1, nome: 'Passagens Esquecidas', resumo: 'Corredores antigos cheios de ecos e armadilhas.' },
    { ordem: 3, pai_ordem: 2, nome: 'Salão dos Ecos', resumo: 'Uma câmara ampla onde vozes do passado ainda ressoam.' },
    { ordem: 4, pai_ordem: 2, nome: 'Galeria Submersa', resumo: 'Um caminho alternativo, alagado e silencioso.' },
    { ordem: 5, pai_ordem: 3, nome: 'Coração do Mistério', resumo: 'O local do confronto final e da verdade escondida.' },
  ];
  return {
    preludio: `Em "${nome}", ${curto(tema, 160)} molda cada sombra e cada rumor. O tom é ${tom || 'sombrio e misterioso'}, e ninguém no grupo sabe ao certo por que foi chamado a este lugar.`,
    objetivo: `Atravessem os locais de "${nome}" e descubram o segredo que sustenta tudo isso, antes que ele consuma o grupo.`,
    mapas: base.slice(0, config.jogo.maxMapas),
  };
}

async function descreverMapa({ sala, mapa }) {
  await dormir(400);
  talvez429();
  return {
    descricao: `${mapa.resumo || 'Um lugar carregado de mistério.'} O ar tem um cheiro metálico e antigo, a luz chega tremida e cada passo do grupo ecoa mais alto do que deveria. Ao redor, ${curto(sala.tema, 90)} deixa marcas em paredes, chão e silêncio.`,
    prompt_imagem: `${mapa.nome}, ${mapa.resumo || ''} Setting: ${curto(sala.tema, 140)}. Atmospheric, moody lighting, no characters.`,
  };
}

// ---------------------------------------------------------------- arbitragem (decide se ha teste)
async function arbitrar({ contexto, tipo, texto }) {
  await dormir(250);
  talvez429();
  const t = sem(texto);
  const npcs = contexto.npcs || [];
  const alvoNpc = npcs.find((n) => n.atitude === 'hostil') || npcs[0] || null;
  const r = { exige_teste: false, atributo: null, pericia: null, dificuldade: 12, risco: 'nenhum', alvo_npc_id: null, e_ataque: false };

  if (/\b(atac|golp|lut|bat|espad|dispar|atir|chut|esfaq|ferir|mat)\w*/.test(t) && alvoNpc) {
    Object.assign(r, { exige_teste: true, atributo: /atir|dispar|arco|flech/.test(t) ? 'destreza' : 'forca', pericia: 'Combate', dificuldade: 12, risco: 'medio', alvo_npc_id: alvoNpc.id, e_ataque: true });
  } else if (/furtiv|esgueir|sorrate|escond|silenc/.test(t)) {
    Object.assign(r, { exige_teste: true, atributo: 'destreza', pericia: 'Furtividade', dificuldade: 13, risco: 'baixo' });
  } else if (/escal|pul|salt|corr|equilibr|desvi/.test(t)) {
    Object.assign(r, { exige_teste: true, atributo: 'destreza', pericia: 'Atletismo', dificuldade: 12, risco: 'baixo' });
  } else if (/persuad|convenc|negoci|barganh|blef|engan|intimid|implor/.test(t)) {
    Object.assign(r, { exige_teste: true, atributo: 'carisma', pericia: 'Persuasão', dificuldade: 13 });
  } else if (/forc|arromb|empurr|levant|quebr|derrub/.test(t)) {
    Object.assign(r, { exige_teste: true, atributo: 'forca', pericia: 'Força bruta', dificuldade: 13, risco: 'baixo' });
  } else if (/resist|aguent|suport/.test(t)) {
    Object.assign(r, { exige_teste: true, atributo: 'constituicao', pericia: 'Resistência', dificuldade: 12, risco: 'baixo' });
  } else if (/investig|examin|procur|revist|inspecion|vasculh|explor|analis|decifr|\bler\b|leio/.test(t)) {
    Object.assign(r, { exige_teste: true, atributo: 'inteligencia', pericia: 'Investigação', dificuldade: 12 });
  } else if (/observ|escut|ouv|olho|percebo|vigi/.test(t)) {
    Object.assign(r, { exige_teste: true, atributo: 'sabedoria', pericia: 'Percepção', dificuldade: 11 });
  } else if (tipo === 'acao' && /abr|ativ|toc|puxo|giro|aperto/.test(t)) {
    Object.assign(r, { exige_teste: true, atributo: 'inteligencia', pericia: 'Mecanismos', dificuldade: 12, risco: 'baixo' });
  }
  return r;
}

// ---------------------------------------------------------------- narracao do desfecho
const ABERTURAS_OK = [
  '{n} age com precisão e o plano funciona melhor do que o esperado.',
  'O esforço de {n} dá resultado: por um instante, o ambiente parece ceder.',
  '{n} encontra o ritmo certo e a situação se resolve a seu favor.',
];
const ABERTURAS_FALHA = [
  '{n} tenta, mas o mundo não colabora desta vez.',
  'O movimento de {n} sai torto e a situação se complica.',
  '{n} hesita por um segundo, e esse segundo custa caro.',
];
const ABERTURAS_NEUTRAS = [
  '{n} age e o Mestre acompanha cada detalhe da cena.',
  'A ação de {n} ecoa pelo ambiente sem despertar perigo imediato.',
  'O grupo observa {n} enquanto o lugar parece responder devagar.',
];
const ITENS = [
  { nome: 'Amuleto Rachado', descricao: 'Um amuleto antigo que vibra perto de segredos.' },
  { nome: 'Frasco de Poção Turva', descricao: 'Um líquido espesso de cheiro duvidoso.' },
  { nome: 'Chave Enferrujada', descricao: 'Abre algo que ninguém lembra mais onde está.' },
  { nome: 'Mapa Rasgado', descricao: 'Metade de um mapa com anotações apressadas.' },
  { nome: 'Adaga Cerimonial', descricao: 'Lâmina curta com símbolos gravados no cabo.' },
];
const NPCS = [
  { nome: 'Guardião Errante', descricao: 'Figura alta e cansada, com armadura remendada.', personalidade: 'Desconfiado, fala pouco e mede cada palavra.', atitude: 'neutro' },
  { nome: 'Sentinela Corrompida', descricao: 'Uma sentinela tomada por uma energia estranha.', personalidade: 'Agressiva, repete ordens que ninguém mais entende.', atitude: 'hostil' },
  { nome: 'Eco da Memória', descricao: 'Silhueta translúcida que lembra alguém conhecido.', personalidade: 'Gentil e melancólico, quer ser lembrado.', atitude: 'aliado' },
];
const FALAS = {
  aliado: ['Fiquem por perto. Eu conheço este lugar melhor do que gostaria.', 'Se eu puder ajudar, ajudo. Só não me peçam para voltar atrás.'],
  neutro: ['Não sei se posso confiar em vocês, mas também não vou atrapalhar.', 'Cada um aqui tem seus motivos. Quais são os de vocês?'],
  hostil: ['Vocês não deveriam ter vindo!', 'Voltem enquanto ainda podem andar.'],
};

async function narrar({ contexto, ator, tipo, texto, fatos }) {
  await dormir(500);
  talvez429();
  const t = sem(texto);
  const nome = ator.nome;
  const teste = fatos.teste;
  const bemSucedido = !teste || teste.sucesso;
  const semente = `${texto}|${contexto.mapa.ordem}|${ator.vida_atual}`;
  const partes = [];

  const molde = !teste ? ABERTURAS_NEUTRAS : teste.sucesso ? ABERTURAS_OK : ABERTURAS_FALHA;
  partes.push(escolher(molde, semente).replace('{n}', nome));
  if (teste?.critico) partes.push('Foi um êxito extraordinário, daqueles que o grupo vai lembrar.');
  if (teste?.falha_critica) partes.push('Foi um desastre completo, desses que o grupo vai querer esquecer.');
  if (fatos.npc_alvo) {
    partes.push(fatos.npc_alvo.derrotado
      ? `${fatos.npc_alvo.nome} cambaleia, tenta reagir e tomba, derrotado.`
      : `${fatos.npc_alvo.nome} recua com o golpe, ferido, mas ainda de pé.`);
  } else if (fatos.dano_jogador > 0) {
    partes.push(`${nome} sente o impacto na pele: o lugar cobra seu preço.`);
  }

  const resp = {
    narracao: partes.join(' '),
    falas_npc: [], novos_npcs: [], item_encontrado: null,
    mudar_mapa: false, destino_ordem: null, campanha_concluida: false,
  };

  // NPC fala quando o jogador conversa com ele (ou fala em voz alta com NPCs presentes).
  const npcVivos = (contexto.npcs || []).filter((n) => !fatos.npc_alvo || n.id !== fatos.npc_alvo.id || !fatos.npc_alvo.derrotado);
  const mencionado = npcVivos.find((n) => t.includes(sem(n.nome).split(' ')[0]));
  const falante = mencionado || (tipo === 'fala' ? npcVivos[0] : null);
  if (falante) {
    resp.falas_npc.push({ npc_id: falante.id, nome: falante.nome, fala: escolher(FALAS[falante.atitude] || FALAS.neutro, semente + falante.nome) });
  }

  // Itens e NPCs novos so aparecem quando a acao deu certo.
  const jaTem = new Set((contexto.personagens || []).flatMap((p) => p.inventario.map((i) => sem(i))));
  if (bemSucedido && /procur|revist|vasculh|explor|investig|exam|inspecion/.test(t) && hash(semente) % 3 !== 0) {
    const disponiveis = ITENS.filter((i) => !jaTem.has(sem(i.nome)));
    if (disponiveis.length) resp.item_encontrado = disponiveis[hash(semente) % disponiveis.length];
  }
  if (bemSucedido && !(contexto.npcs || []).length && /observ|explor|procur|olho|chamo|grit|aproxim|conversar|falar|pergunt|ola|oi\b/.test(t)) {
    resp.novos_npcs.push(NPCS[hash(`${contexto.mapa.nome}`) % NPCS.length]);
  }

  // Mudanca de mapa e fim de campanha: o servidor valida tudo isso.
  const saidas = contexto.mapa.saidas || [];
  const ritmoOk = contexto.mapa.acoes_no_mapa >= contexto.mapa.minimo_acoes;
  if (bemSucedido && ritmoOk && saidas.length && /avanc|segu|entr|desc|sub|port|atravess|cruz|prossig|continu|sair|proxim|caminh|vou para|vamos/.test(t)) {
    resp.mudar_mapa = true;
    resp.destino_ordem = saidas[0].ordem;
    resp.narracao += ` O grupo reúne coragem e segue adiante, deixando ${contexto.mapa.nome} para trás.`;
  }
  if (bemSucedido && ritmoOk && contexto.mapa.eh_final && /final|ativ|sel|destru|conclu|encerr|libert|derrot|termin|abr/.test(t)) {
    resp.campanha_concluida = true;
    resp.narracao += ' Com um último esforço conjunto, o segredo que sustentava este lugar finalmente se desfaz. A aventura chega ao fim.';
  }
  return resp;
}

// ---------------------------------------------------------------- imagens (SVG ilustrativo)
function svgAvatar(rotulo, semente) {
  const h = hash(semente || rotulo) % 360;
  const ini = xml(String(rotulo || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase());
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},45%,28%)"/><stop offset="1" stop-color="hsl(${(h + 50) % 360},50%,10%)"/></linearGradient>
<radialGradient id="l" cx="0.5" cy="0.35" r="0.6"><stop offset="0" stop-color="hsl(${h},70%,60%)" stop-opacity="0.35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
<rect width="512" height="512" fill="url(#g)"/><rect width="512" height="512" fill="url(#l)"/>
<path d="M96 512 C96 390 170 340 256 340 C342 340 416 390 416 512 Z" fill="hsl(${h},30%,14%)"/>
<circle cx="256" cy="236" r="86" fill="hsl(${h},25%,20%)" stroke="hsl(${h},60%,65%)" stroke-opacity="0.6" stroke-width="3"/>
<text x="256" y="262" text-anchor="middle" font-family="Georgia,serif" font-size="72" fill="hsl(${h},70%,82%)">${ini}</text>
<text x="256" y="494" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#fff" fill-opacity="0.45">retrato ilustrativo (modo demonstração)</text></svg>`;
}

function svgCenario(rotulo, semente) {
  const h = hash(semente || rotulo) % 360;
  const pontos = (base, alt, passo, seed) => {
    let d = `M0 720 L0 ${base}`;
    for (let x = 0; x <= 1280; x += passo) d += ` L${x} ${base - ((hash(`${seed}${x}`) % alt))}`;
    return `${d} L1280 720 Z`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${h},55%,16%)"/><stop offset="0.65" stop-color="hsl(${(h + 30) % 360},60%,34%)"/><stop offset="1" stop-color="hsl(${(h + 60) % 360},40%,12%)"/></linearGradient></defs>
<rect width="1280" height="720" fill="url(#c)"/>
<circle cx="${200 + (hash(rotulo) % 800)}" cy="170" r="62" fill="hsl(${h},80%,85%)" fill-opacity="0.85"/>
<path d="${pontos(520, 130, 80, 'a' + h)}" fill="hsl(${h},35%,18%)" fill-opacity="0.8"/>
<path d="${pontos(600, 110, 60, 'b' + h)}" fill="hsl(${h},30%,11%)"/>
<path d="${pontos(680, 60, 40, 'c' + h)}" fill="#07070b"/>
<text x="24" y="40" font-family="sans-serif" font-size="20" fill="#fff" fill-opacity="0.45">cenário ilustrativo (modo demonstração)</text></svg>`;
}

async function gerarImagem({ tipo, rotulo, semente }) {
  await dormir(tipo === 'cenario' ? 2200 : 1500);
  talvez429();
  const svg = tipo === 'cenario' ? svgCenario(rotulo, semente) : svgAvatar(rotulo, semente);
  return { buffer: Buffer.from(svg, 'utf8'), mime: 'image/svg+xml' };
}

module.exports = { campanha, descreverMapa, arbitrar, narrar, gerarImagem, ATRIBUTOS };
