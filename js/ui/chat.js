// Chat de la mesa: emojis rápidos, frases porteñas y texto libre.

import { $, esc } from './dom.js';

export const EMOJIS = ['🧉', '🔥', '😂', '🤥', '😎', '👏', '😡', '🙏', '🤡', '⚽', '🃏', '🍕', '🐐', '💀'];

export const FRASES = [
  '¡Quiero retruco, papá!',
  'Andá a cantarle a Gardel',
  'Tenés menos envido que un perro',
  '¿Querés que te preste mis cartas?',
  'Esta mano es mía, mirá y aprendé',
  '¡Qué mentiroso que sos!',
  'Mirá que tengo el macho, eh...',
  '¿Qué mirás, bobo? Andá pa\' allá',
  'Cebame uno que me seco',
  'Vamos, que se viene la remontada',
  'Ni con la mano de Dios ganás esa',
  'Uy, se me escapó la tortuga',
  'Paso, paso... ¿o no paso?',
  'Bien jugado, maestro 👏',
];

let sendFn = null;
let unread = 0;

export function initChat({ onSend }) {
  sendFn = onSend;
  const box = $('#chat');
  box.innerHTML = `
    <div class="chat-head"><b>💬 La mesa</b><button class="icon-btn only-mobile" data-chat-close>✖</button></div>
    <div class="chat-log" id="chat-log"></div>
    <div class="emoji-bar">${EMOJIS.map((e) => `<button class="emoji-btn" data-emoji="${e}">${e}</button>`).join('')}</div>
    <select id="frases" class="frases"><option value="">🗯️ Tirá una frase porteña…</option>${FRASES.map((f, i) => `<option value="${i}">${esc(f)}</option>`).join('')}</select>
    <form class="chat-form" id="chat-form"><input id="chat-input" maxlength="140" placeholder="Escribí algo…" autocomplete="off" /><button class="btn btn-small">➤</button></form>`;
  box.querySelectorAll('[data-emoji]').forEach((b) => (b.onclick = () => sendFn(b.dataset.emoji, 'emoji')));
  $('#frases').onchange = (e) => {
    const f = FRASES[Number(e.target.value)];
    if (f) sendFn(f, 'phrase');
    e.target.value = '';
  };
  $('#chat-form').onsubmit = (e) => {
    e.preventDefault();
    const input = $('#chat-input');
    if (input.value.trim()) sendFn(input.value.trim(), 'text');
    input.value = '';
  };
  box.querySelector('[data-chat-close]').onclick = () => box.classList.remove('open');
}

export function addChat(msg) {
  const log = $('#chat-log');
  if (!log) return;
  const line = document.createElement('div');
  line.className = `chat-line chat-${msg.kind}`;
  line.innerHTML = msg.kind === 'system' ? `<i>${esc(msg.text)}</i>` : `<b>${esc(msg.name)}:</b> <span>${esc(msg.text)}</span>`;
  log.appendChild(line);
  while (log.children.length > 120) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
  const box = $('#chat');
  if (!box.classList.contains('open')) {
    unread++;
    document.body.dataset.unread = String(unread);
  }
}

export function clearChat() {
  const log = $('#chat-log');
  if (log) log.innerHTML = '';
}

export function toggleChatMobile() {
  const box = $('#chat');
  box.classList.toggle('open');
  unread = 0;
  document.body.dataset.unread = '0';
}

export function showChat(show) {
  $('#chat').classList.toggle('hidden', !show);
}
