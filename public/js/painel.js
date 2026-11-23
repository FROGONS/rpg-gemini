'use strict';
(() => {
  if (!Auth.exigir()) return;

  const BASE = 10, MIN = 8, MAX = 16, PONTOS = 12;
  const valores = Object.fromEntries(ATRIBUTOS.map((a) => [a, BASE]));
  let personagens = [];
  let timerPolling = null;

  const $ = (id) => document.getElementById(id);
  $('usuario-nome').textContent = Auth.usuario()?.nome || '';
  $('btn-sair').addEventListener('click', () => Auth.sair());
  api('GET', '/config').then((c) => { $('selo-demo').hidden = !c.modo_demo; }).catch(() => {});

  function mostrarErro(id, msg) { const e = $(id); e.textContent = msg; e.hidden = !msg; }

  // ---------------------------------------------------------------- atributos (distribuicao de pontos)
  const gastos = () => ATRIBUTOS.reduce((s, a) => s + (valores[a] - BASE), 0);
  function desenharAtributos() {
    const raiz = $('atributos');
    raiz.replaceChildren();
    for (const a of ATRIBUTOS) {
      const saida = el('output', { id: `v-${a}`, 'aria-live': 'polite', text: String(valores[a]) });
      const mod = el('small', { text: `(${comSinal(modificador(valores[a]))})` });
      const menos = el('button', { type: 'button', class: 'btn passo', 'aria-label': `Diminuir ${ROTULOS[a]}`, text: '−', onclick: () => mudar(a, -1) });
      const mais = el('button', { type: 'button', class: 'btn passo', 'aria-label': `Aumentar ${ROTULOS[a]}`, text: '+', onclick: () => mudar(a, 1) });
      menos.disabled = valores[a] <= MIN;
      mais.disabled = valores[a] >= MAX || gastos() >= PONTOS;
      raiz.append(el('div', { class: 'atributo-linha' }, el('span', { text: ROTULOS[a] }), menos, el('span', {}, saida, mod), mais));
    }
    $('pontos-restantes').textContent = String(PONTOS - gastos());
  }
  function mudar(a, delta) {
    const novo = valores[a] + delta;
    if (novo < MIN || novo > MAX) return;
    if (delta > 0 && gastos() >= PONTOS) return;
    valores[a] = novo;
    desenharAtributos();
  }

  // ---------------------------------------------------------------- personagens
  function cartaoPersonagem(p) {
    let imagem;
    if (p.status_avatar === 'pronto' && p.avatar_url) imagem = el('img', { class: 'avatar', src: p.avatar_url, alt: `Retrato de ${p.nome}` });
    else if (p.status_avatar === 'erro') imagem = el('div', { class: 'avatar avatar-vazio', text: 'sem retrato' });
    else imagem = el('div', { class: 'avatar avatar-vazio gerando', role: 'img', 'aria-label': 'Gerando retrato', text: 'gerando…' });

    const attrs = el('div', { class: 'mini-atributos' }, ATRIBUTOS.map((a) => el('span', {}, `${SIGLAS[a]} `, el('b', { text: String(p.atributos[a]) }))));
    const corpo = el('div', {},
      el('h3', { text: p.nome }),
      el('div', { class: 'suave pequeno', text: `${p.classe} · vida ${p.vida_maxima}` }),
      attrs
    );
    if (p.status_avatar === 'gerando') corpo.append(el('p', { class: 'dica', text: 'A IA está pintando o retrato. Você já pode usar o personagem.' }));
    if (p.status_avatar === 'erro') {
      corpo.append(
        el('p', { class: 'aviso aviso-alerta pequeno', style: 'margin:.5rem 0', text: p.erro?.mensagem || 'Não foi possível gerar o retrato.' }),
        el('button', { class: 'btn btn-pequeno', type: 'button', text: 'Gerar retrato de novo', onclick: () => regerar(p.id) })
      );
    }
    return el('article', { class: 'personagem' }, imagem, corpo);
  }

  function desenharPersonagens() {
    const lista = $('lista-personagens');
    lista.replaceChildren();
    if (!personagens.length) lista.append(el('p', { class: 'vazio', text: 'Você ainda não tem personagens. Crie o primeiro no formulário abaixo.' }));
    personagens.forEach((p) => lista.append(cartaoPersonagem(p)));

    const sel = $('sel-personagem');
    const atual = sel.value;
    sel.replaceChildren();
    if (!personagens.length) sel.append(el('option', { value: '', text: 'Crie um personagem primeiro' }));
    personagens.forEach((p) => sel.append(el('option', { value: p.id, text: `${p.nome} (${p.classe})` })));
    if (atual) sel.value = atual;
  }

  async function carregarPersonagens() {
    try {
      personagens = (await api('GET', '/personagens')).personagens;
      desenharPersonagens();
      clearTimeout(timerPolling);
      // enquanto houver retrato sendo gerado, consulta o servidor (polling)
      if (personagens.some((p) => p.status_avatar === 'gerando')) timerPolling = setTimeout(carregarPersonagens, 2000);
    } catch (e) { toast(e.message, 'erro'); }
  }

  async function regerar(id) {
    try { await api('POST', `/personagens/${id}/avatar`); toast('Gerando um novo retrato…'); carregarPersonagens(); }
    catch (e) { toast(e.message, 'erro'); }
  }

  $('form-personagem').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    mostrarErro('erro-personagem', '');
    const botao = $('btn-criar-personagem');
    botao.disabled = true;
    try {
      await api('POST', '/personagens', {
        nome: $('p-nome').value, classe: $('p-classe').value, descricao_visual: $('p-visual').value, atributos: { ...valores },
      });
      ev.target.reset();
      ATRIBUTOS.forEach((a) => { valores[a] = BASE; });
      desenharAtributos();
      toast('Personagem criado! O retrato está sendo gerado.');
      await carregarPersonagens();
    } catch (e) { mostrarErro('erro-personagem', e.message); }
    botao.disabled = false;
  });

  // ---------------------------------------------------------------- salas
  const STATUS = { preparando: 'preparando', aguardando: 'aguardando início', em_jogo: 'em jogo', encerrada: 'encerrada' };

  async function carregarSalas() {
    const lista = $('lista-salas');
    try {
      const { salas } = await api('GET', '/salas/minhas');
      lista.replaceChildren();
      if (!salas.length) lista.append(el('p', { class: 'vazio', text: 'Nenhuma sala ainda. Crie uma ou entre com o código de um amigo.' }));
      salas.forEach((s) => lista.append(el('div', { class: 'sala-item' },
        el('div', {}, el('strong', { text: s.nome }), el('span', { class: 'suave pequeno', text: `${s.personagem} · código ${s.codigo}${s.sou_host ? ' · anfitrião' : ''}` })),
        el('div', { class: 'linha', style: 'flex:0 0 auto;flex-wrap:nowrap;align-items:center' },
          el('span', { class: `selo ${s.status === 'em_jogo' ? 'selo-ok' : ''}`, text: STATUS[s.status] || s.status }),
          s.status !== 'encerrada' ? el('a', { class: 'btn btn-pequeno', style: 'text-decoration:none;display:inline-grid;place-items:center', href: `/sala.html?codigo=${s.codigo}`, text: 'Abrir' }) : null
        )
      )));
    } catch (e) { toast(e.message, 'erro'); }
  }

  $('form-criar-sala').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    mostrarErro('erro-sala', '');
    const personagemId = $('sel-personagem').value;
    if (!personagemId) return mostrarErro('erro-sala', 'Crie um personagem antes de criar a sala.');
    const botao = $('btn-criar-sala');
    botao.disabled = true;
    $('criando-sala').hidden = false;
    try {
      const { sala } = await api('POST', '/salas', {
        nome: $('s-nome').value, tema: $('s-tema').value, tom: $('s-tom').value,
        max_jogadores: Number($('s-max').value), personagem_id: Number(personagemId),
      });
      location.href = `/sala.html?codigo=${sala.codigo}`;
    } catch (e) {
      $('criando-sala').hidden = true;
      mostrarErro('erro-sala', e.codigo === 'RATE_LIMIT' ? `${e.message} Clique em "Criar sala" para tentar de novo.` : e.message);
      botao.disabled = false;
    }
  });

  $('e-codigo').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  $('form-entrar').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    mostrarErro('erro-entrar', '');
    try {
      const { sala } = await api('POST', '/salas/entrar', { codigo: $('e-codigo').value, personagem_id: Number($('sel-personagem').value) || undefined });
      location.href = `/sala.html?codigo=${sala.codigo}`;
    } catch (e) { mostrarErro('erro-entrar', e.message); }
  });

  desenharAtributos();
  carregarPersonagens();
  carregarSalas();
})();
