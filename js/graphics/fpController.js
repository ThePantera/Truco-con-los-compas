// Controles "de primera persona": G para tomar un mate, H para golpear la mesa,
// y atajos de teclado para jugar sin mouse.

const MATE_SVG = `<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg">
  <path d="M46 4L52 2L44 60" stroke="#c0c0c0" stroke-width="4" stroke-linecap="round"/>
  <path d="M14 40Q12 30 24 28H56Q68 30 66 40Q72 80 58 104Q40 116 22 104Q8 80 14 40Z" fill="#7a4a22" stroke="#3b2414" stroke-width="3"/>
  <path d="M16 46H64" stroke="#c8960c" stroke-width="5"/>
  <ellipse cx="40" cy="30" rx="22" ry="5" fill="#3f8f3a"/>
</svg>`;

export function mateEl() {
  const el = document.createElement('div');
  el.className = 'fp-mate';
  el.innerHTML = MATE_SVG;
  return el;
}

export function tomarMate(container) {
  const m = container.querySelector('.fp-mate');
  if (!m || m.classList.contains('drinking')) return false;
  m.classList.add('drinking');
  setTimeout(() => m.classList.remove('drinking'), 1400);
  return true;
}

export function golpearMesa(tableEl) {
  if (!tableEl) return;
  tableEl.classList.remove('shake');
  void tableEl.offsetWidth;
  tableEl.classList.add('shake');
}

// keymap: { g, h, 1, 2, 3, t, e, q, n, m } -> función
export function bindKeys(keymap) {
  const handler = (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.ctrlKey || e.metaKey || e.altKey) return;
    const fn = keymap[e.key.toLowerCase()];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
