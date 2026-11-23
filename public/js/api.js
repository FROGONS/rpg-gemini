'use strict';
// Utilitarios compartilhados: sessao (JWT), chamadas AJAX e avisos na tela.
const Auth = {
  token() { return localStorage.getItem('rpg_token'); },
  usuario() { try { return JSON.parse(localStorage.getItem('rpg_usuario')); } catch { return null; } },
  salvar(token, usuario) { localStorage.setItem('rpg_token', token); localStorage.setItem('rpg_usuario', JSON.stringify(usuario)); },
  sair() { localStorage.removeItem('rpg_token'); localStorage.removeItem('rpg_usuario'); location.href = '/'; },
  exigir() { if (!this.token()) { location.href = '/'; return false; } return true; },
};

async function api(metodo, rota, corpo) {
  const cabecalhos = { 'Content-Type': 'application/json' };
  if (Auth.token()) cabecalhos.Authorization = `Bearer ${Auth.token()}`;
  let resposta;
  try {
    resposta = await fetch(`/api${rota}`, { method: metodo, headers: cabecalhos, body: corpo ? JSON.stringify(corpo) : undefined });
  } catch {
    throw Object.assign(new Error('Sem conexão com o servidor. Verifique sua internet.'), { codigo: 'SEM_REDE' });
  }
  let dados = {};
  try { dados = await resposta.json(); } catch { /* resposta sem corpo */ }
  if (resposta.status === 401 && !rota.startsWith('/auth/')) Auth.sair();
  if (!resposta.ok) {
    throw Object.assign(new Error(dados.erro?.mensagem || 'Algo deu errado. Tente novamente.'), {
      codigo: dados.erro?.codigo, status: resposta.status,
    });
  }
  return dados;
}

function toast(mensagem, tipo = 'info', ms = 5000) {
  let area = document.querySelector('.toasts');
  if (!area) { area = document.createElement('div'); area.className = 'toasts'; area.setAttribute('role', 'status'); document.body.appendChild(area); }
  const t = document.createElement('div');
  t.className = `toast ${tipo === 'info' ? '' : tipo}`;
  t.textContent = mensagem;
  area.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// Cria elementos com seguranca (sempre textContent, nunca innerHTML com dados externos).
function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) if (f !== null && f !== undefined && f !== false) e.append(f);
  return e;
}

const ROTULOS = { forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição', inteligencia: 'Inteligência', sabedoria: 'Sabedoria', carisma: 'Carisma' };
const SIGLAS = { forca: 'FOR', destreza: 'DES', constituicao: 'CON', inteligencia: 'INT', sabedoria: 'SAB', carisma: 'CAR' };
const ATRIBUTOS = Object.keys(ROTULOS);
const modificador = (v) => Math.floor((v - 10) / 2);
const comSinal = (n) => (n >= 0 ? `+${n}` : `${n}`);
