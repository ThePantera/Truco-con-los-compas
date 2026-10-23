// Utilidades chicas de DOM.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function showScreen(id) {
  for (const s of $$('.screen')) s.classList.toggle('hidden', s.id !== id);
}

export function toast(html, { kind = 'info', ms = 3200 } = {}) {
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.innerHTML = html;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

export function openModal(html, { onClose } = {}) {
  const m = $('#modal');
  m.innerHTML = `<div class="modal-box"><button class="icon-btn modal-close" aria-label="Cerrar">✖</button>${html}</div>`;
  m.classList.remove('hidden');
  const close = () => {
    m.classList.add('hidden');
    m.innerHTML = '';
    onClose && onClose();
  };
  $('.modal-close', m).onclick = close;
  m.onclick = (e) => {
    if (e.target === m) close();
  };
  return close;
}

export function initials(name) {
  const clean = String(name || '?').replace(/[^\p{L}\p{N} ]/gu, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}
