'use strict';
(() => {
  if (!Auth.exigir()) return;
  const codigo = (new URLSearchParams(location.search).get('codigo') || '').toUpperCase();
  if (!codigo) { location.replace('/painel.html'); return; }

  const eu = Auth.usuario();
  const $ = (id) => document.getElementById(id);
  const estado = { sala: null, mapa: null, participantes: [], npcs: [], online: new Set(), pendente: null };
  const exibidas = new Set();
  const STATUS_SALA = { preparando: 'preparando', aguardando: 'aguardando início', em_jogo: 'em jogo', encerrada: 'encerrada' };

  const socket = io({ auth: { token: Auth.token() } });
  api('GET', '/config').then((c) => { $('selo-demo').hidden = !c.modo_demo; }).catch(() => {});

  const meu = () => estado.participantes.find((p) => p.usuario_id === eu.id) || null;

  // ------------------------------------------------------------ render: topo e cenario
  function renderTopo() {
    const s = estado.sala;
    if (!s) return;
    $('sala-nome').textContent = s.nome;
    $('sala-tema').textContent = s.tom ? `${s.tema} · tom ${s.tom}` : s.tema;
    $('sala-codigo').textContent = s.codigo;
    const selo = $('sala-status');
    selo.textContent = STATUS_SALA[s.status] || s.status;
    selo.className = `selo ${s.status === 'em_jogo' ? 'selo-ok' : s.status === 'encerrada' ? 'selo-erro' : 'selo-alerta'}`;
    document.title = `${s.nome} — RPG com Mestre IA`;
    $('aventura-preludio').textContent = s.preludio || '';
    $('aventura-objetivo').textContent = s.objetivo ? `Objetivo: ${s.objetivo}` : '';
  }

  function renderCenario() {
    const m = estado.mapa;
    const img = $('cenario-img');
    const fundo = $('cenario-fundo');
    $('btn-regerar').hidden = true;
    if (!m) { $('cenario-titulo').textContent = '—'; return; }
    $('cenario-titulo').textContent = m.nome;
    $('cenario-resumo').textContent = m.resumo || '';
    if (m.status_imagem === 'pronta' && m.imagem_url) {
      if (img.getAttribute('src') !== m.imagem_url) img.src = m.imagem_url;
      img.alt = `Ilustração do cenário: ${m.nome}`;
      img.hidden = false;
      fundo.hidden = true;
    } else {
      img.hidden = true;
      fundo.hidden = false;
      const falhou = m.status_imagem === 'erro';
      fundo.classList.toggle('gerando', !falhou);
      $('cenario-msg').textContent = falhou ? 'Não foi possível gerar a ilustração deste cenário.' : 'O Mestre está pintando o cenário…';
      $('btn-regerar').hidden = !(falhou && estado.sala?.eu_sou_host);
    }
  }

  function renderNpcs() {
    const raiz = $('npcs');
    raiz.replaceChildren();
    estado.npcs.forEach((n) => raiz.append(el('span', { class: `npc ${n.atitude}`, title: n.descricao || '', text: `${n.nome}${n.vida_atual != null ? ` · vida ${n.vida_atual}` : ''}` })));
  }

  // ------------------------------------------------------------ render: ficha e grupo
  function classeBarra(v, max) { const r = v / max; return r <= 0.25 ? 'critica' : r <= 0.5 ? 'baixa' : ''; }
  function avatarEl(p, classe) {
    return p.avatar_url
      ? el('img', { class: classe, src: p.avatar_url, alt: `Retrato de ${p.nome}` })
      : el('div', { class: `${classe} avatar-vazio`, text: p.nome.slice(0, 1).toUpperCase() });
  }

  function renderFicha() {
    const p = meu();
    if (!p) return;
    $('ficha-avatar').replaceWith(Object.assign(avatarEl(p, 'avatar'), { id: 'ficha-avatar' }));
    $('ficha-titulo').textContent = p.nome;
    $('ficha-classe').textContent = p.classe;
    $('ficha-vida').textContent = `${p.vida_atual} / ${p.vida_maxima}${p.status === 'caido' ? ' · caído' : ''}`;
    const barra = $('ficha-barra');
    barra.className = `barra ${classeBarra(p.vida_atual, p.vida_maxima)}`;
    barra.setAttribute('aria-valuenow', String(p.vida_atual));
    barra.setAttribute('aria-valuemax', String(p.vida_maxima));
    barra.firstElementChild.style.width = `${Math.round((p.vida_atual / p.vida_maxima) * 100)}%`;
    const attrs = $('ficha-atributos');
    attrs.replaceChildren(...ATRIBUTOS.map((a) => el('div', { title: ROTULOS[a] }, el('b', { text: `${p.atributos[a]} (${comSinal(modificador(p.atributos[a]))})` }), el('span', { text: SIGLAS[a] }))));
    const inv = $('ficha-inventario');
    inv.replaceChildren();
    if (!p.inventario.length) inv.append(el('li', { class: 'suave', text: 'Vazio por enquanto.' }));
    p.inventario.forEach((i) => inv.append(el('li', { title: i.descricao || '', text: i.quantidade > 1 ? `${i.nome} ×${i.quantidade}` : i.nome })));
  }

  function renderGrupo() {
    const raiz = $('grupo');
    raiz.replaceChildren();
    const outros = estado.participantes.filter((p) => p.usuario_id !== eu.id);
    if (!outros.length) raiz.append(el('p', { class: 'suave pequeno', text: 'Ninguém além de você, por enquanto. Compartilhe o código da sala.' }));
    outros.forEach((p) => {
      const on = estado.online.has(p.usuario_id);
      raiz.append(el('div', { class: `membro ${p.status === 'caido' ? 'caido' : ''}` },
        avatarEl(p, 'avatar'),
        el('div', {},
          el('div', { class: 'nome' }, el('span', {}, el('span', { class: `ponto ${on ? 'on' : ''}`, title: on ? 'online' : 'offline' }), p.nome), el('span', { class: 'suave pequeno', text: p.status === 'caido' ? 'caído' : `${p.vida_atual}/${p.vida_maxima}` })),
          el('div', { class: `barra ${classeBarra(p.vida_atual, p.vida_maxima)}`, style: 'height:.4rem' }, el('i', { style: `width:${Math.round((p.vida_atual / p.vida_maxima) * 100)}%` }))
        )));
    });
  }

  function renderControles() {
    const s = estado.sala;
    const p = meu();
    if (!s) return;
    const podeAgir = s.status === 'em_jogo' && p && p.status === 'ativo';
    $('texto').disabled = !podeAgir;
    $('btn-enviar').disabled = !podeAgir;
    $('texto').placeholder = s.status === 'aguardando' ? 'A aventura começa quando o anfitrião iniciar.'
      : s.status === 'encerrada' ? 'Esta aventura terminou.'
        : p && p.status === 'caido' ? 'Seu personagem caiu. Aguarde o grupo avançar de cenário.'
          : 'O que o seu personagem faz ou diz? (Enter envia, Shift+Enter quebra a linha)';
    const aguardando = s.status === 'aguardando';
    $('faixa-inicio').hidden = !aguardando;
    $('btn-iniciar').hidden = !(aguardando && s.eu_sou_host);
    $('texto-inicio').textContent = s.eu_sou_host
      ? 'Compartilhe o código da sala com o grupo e comece quando todos entrarem.'
      : 'Aguardando o anfitrião iniciar a aventura…';
  }

  function renderTudo() { renderTopo(); renderCenario(); renderNpcs(); renderFicha(); renderGrupo(); renderControles(); }

  // ------------------------------------------------------------ mural
  function chipRolagem(r) {
    const critico = r.resultado === 20 ? ' (crítico)' : r.resultado === 1 ? ' (falha crítica)' : '';
    return el('div', { class: `dado ${r.sucesso ? 'ok' : 'falha'}` },
      el('span', { class: 'cubo', 'aria-hidden': 'true', text: String(r.resultado) }),
      el('span', {}, `${ROTULOS[r.atributo]}${r.pericia ? ` · ${r.pericia}` : ''}: d20 ${r.resultado} ${comSinal(r.modificador)} = ${r.total} contra CD ${r.dificuldade} · `,
        el('span', { class: 'res', text: `${r.sucesso ? 'Sucesso' : 'Falha'}${critico}` })));
  }

  function elementoMensagem(m) {
    const div = el('div', { class: `msg ${m.tipo}`, 'data-id': m.id });
    if (m.tipo === 'narracao') div.append(el('div', { class: 'quem', text: 'Mestre' }));
    else if (m.tipo === 'acao' || m.tipo === 'fala') {
      div.append(el('div', { class: 'quem' }, m.autor?.avatar_url ? el('img', { src: m.autor.avatar_url, alt: '' }) : null, `${m.autor?.nome || 'Jogador'} ${m.tipo === 'acao' ? 'age' : 'diz'}`));
    } else if (m.tipo === 'npc') div.append(el('div', { class: 'quem', text: m.autor?.nome || 'NPC' }));
    div.append(el('div', { class: 'texto', text: m.conteudo }));
    if (m.rolagem) div.append(chipRolagem(m.rolagem));
    return div;
  }

  function rolarFim(forcar) {
    const log = $('log');
    if (forcar || log.scrollHeight - log.scrollTop - log.clientHeight < 160) log.scrollTop = log.scrollHeight;
  }

  function adicionarMensagem(m) {
    if (exibidas.has(m.id)) return;
    exibidas.add(m.id);
    $('log').append(elementoMensagem(m));
    rolarFim(false);
  }

  function aplicarRolagem(mensagemId, r) {
    const alvo = $('log').querySelector(`.msg[data-id="${mensagemId}"]`);
    if (alvo && !alvo.querySelector('.dado')) { alvo.append(chipRolagem(r)); rolarFim(false); }
  }

  // ------------------------------------------------------------ alertas (inclui erro 429)
  function mostrarAlerta(erro) {
    $('alerta').hidden = false;
    const limite = erro.codigo === 'RATE_LIMIT';
    $('alerta-caixa').className = `aviso ${limite ? 'aviso-alerta' : 'aviso-erro'}`;
    $('alerta-texto').textContent = limite
      ? 'O Mestre precisa de um respiro: a IA recebeu requisições demais. Espere alguns segundos e tente de novo. Sua ação continua registrada.'
      : erro.mensagem;
    estado.pendente = erro.detalhes?.mensagem_id || null;
    $('btn-tentar').hidden = !estado.pendente;
  }
  const esconderAlerta = () => { $('alerta').hidden = true; estado.pendente = null; };

  // ------------------------------------------------------------ envio
  function enviarAcao() {
    const campo = $('texto');
    const texto = campo.value.trim();
    if (!texto || campo.disabled) return;
    const tipo = document.querySelector('input[name=tipo]:checked').value;
    campo.value = '';
    esconderAlerta();
    socket.emit('acao:enviar', { tipo, texto }, (resp) => {
      if (resp.ok) return;
      if (!resp.erro.detalhes?.mensagem_id && !campo.value) campo.value = texto; // nada foi registrado: devolve o texto
      mostrarAlerta(resp.erro);
    });
  }
  $('form-acao').addEventListener('submit', (e) => { e.preventDefault(); enviarAcao(); });
  $('texto').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarAcao(); } });

  $('btn-tentar').addEventListener('click', () => {
    const id = estado.pendente;
    if (!id) return;
    esconderAlerta();
    socket.emit('acao:reenviar', { mensagem_id: id }, (resp) => { if (!resp.ok) mostrarAlerta(resp.erro); });
  });

  $('btn-iniciar').addEventListener('click', () => {
    $('btn-iniciar').disabled = true;
    socket.emit('sala:iniciar', {}, (resp) => { $('btn-iniciar').disabled = false; if (!resp.ok) toast(resp.erro.mensagem, 'erro'); });
  });

  $('btn-regerar').addEventListener('click', () => {
    socket.emit('mapa:regerar-imagem', {}, (resp) => { if (!resp.ok) toast(resp.erro.mensagem, 'erro'); });
  });

  $('btn-codigo').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(codigo); toast('Código copiado!'); } catch { toast(`Código da sala: ${codigo}`); }
  });

  $('btn-sair-sala').addEventListener('click', async () => {
    if (!confirm('Sair desta sala? Você poderá voltar depois usando o código.')) return;
    try { await api('POST', `/salas/${codigo}/sair`); } catch { /* segue para o painel */ }
    location.href = '/painel.html';
  });

  // ------------------------------------------------------------ socket
  function setConexao(on, texto) {
    $('conexao').className = `ponto ${on ? 'on' : 'off'}`;
    $('conexao-texto').textContent = texto;
  }

  socket.on('connect', () => {
    setConexao(true, 'conectado');
    socket.emit('sala:conectar', { codigo }, (resp) => {
      if (!resp.ok) {
        $('erro-fatal').textContent = resp.erro.mensagem;
        $('erro-fatal').hidden = false;
        $('mesa').hidden = true;
        return;
      }
      const e = resp.estado;
      estado.sala = e.sala; estado.mapa = e.mapa; estado.participantes = e.participantes; estado.npcs = e.npcs;
      e.mensagens.forEach(adicionarMensagem);
      renderTudo();
      rolarFim(true);
    });
  });
  socket.on('connect_error', (err) => {
    setConexao(false, 'sem conexão');
    if (/Sessão/.test(err.message)) Auth.sair();
  });
  socket.on('disconnect', () => setConexao(false, 'reconectando…'));

  socket.on('mensagem', adicionarMensagem);
  socket.on('rolagem', (d) => aplicarRolagem(d.mensagem_id, d.rolagem));
  socket.on('participantes', (lista) => { estado.participantes = lista; renderFicha(); renderGrupo(); renderControles(); });
  socket.on('npcs', (lista) => { estado.npcs = lista; renderNpcs(); });
  socket.on('presenca', (d) => { estado.online = new Set(d.usuarios); renderGrupo(); });
  socket.on('sala:status', (d) => {
    estado.sala.status = d.status;
    renderTopo(); renderControles();
    if (d.desfecho === 'vitoria') toast('Vitória! A campanha foi concluída.');
    if (d.desfecho === 'derrota') toast('Todos caíram. Fim da campanha.', 'erro');
  });
  socket.on('mapa:atualizado', (d) => { estado.mapa = d.mapa; estado.npcs = d.npcs; renderCenario(); renderNpcs(); });
  socket.on('mapa:imagem', (d) => {
    if (!estado.mapa || estado.mapa.id !== d.mapa_id) return;
    estado.mapa.status_imagem = d.status;
    if (d.imagem_url) estado.mapa.imagem_url = d.imagem_url;
    renderCenario();
    if (d.status === 'erro' && d.mensagem) toast(d.mensagem, 'alerta');
  });
  socket.on('mestre:digitando', (d) => { $('indicador').hidden = !d.ativo; });
  socket.on('aviso', (d) => mostrarAlerta(d));
})();
