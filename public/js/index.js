'use strict';
(() => {
  if (Auth.token()) { location.replace('/painel.html'); return; }

  const abaLogin = document.getElementById('aba-login');
  const abaCad = document.getElementById('aba-cadastro');
  const formLogin = document.getElementById('painel-login');
  const formCad = document.getElementById('painel-cadastro');
  const erro = document.getElementById('erro');

  function mostrar(qual) {
    const login = qual === 'login';
    abaLogin.setAttribute('aria-selected', String(login));
    abaCad.setAttribute('aria-selected', String(!login));
    formLogin.hidden = !login;
    formCad.hidden = login;
    erro.hidden = true;
  }
  abaLogin.addEventListener('click', () => mostrar('login'));
  abaCad.addEventListener('click', () => mostrar('cadastro'));

  async function enviar(evento, rota, corpo) {
    evento.preventDefault();
    erro.hidden = true;
    const botao = evento.target.querySelector('button[type=submit]');
    botao.disabled = true;
    try {
      const { token, usuario } = await api('POST', rota, corpo());
      Auth.salvar(token, usuario);
      location.href = '/painel.html';
    } catch (e) {
      erro.textContent = e.message;
      erro.hidden = false;
      botao.disabled = false;
    }
  }

  formLogin.addEventListener('submit', (e) => enviar(e, '/auth/login', () => ({
    email: document.getElementById('login-email').value,
    senha: document.getElementById('login-senha').value,
  })));
  formCad.addEventListener('submit', (e) => enviar(e, '/auth/cadastro', () => ({
    nome: document.getElementById('cad-nome').value,
    email: document.getElementById('cad-email').value,
    senha: document.getElementById('cad-senha').value,
  })));
})();
