// La moza del bar: cruza la mesa al terminar cada mano, pasa el trapo y tira un comentario.

const FRASES = [
  '¿Les traigo otra ronda, chicos?',
  'Cuidado con el mantel que lo lavé ayer...',
  '¡Qué manera de mentir, por Dios!',
  'El de la esquina está mirando las cartas, eh.',
  'Ya les caliento el agua para el mate.',
  'Dos cortados y una de muzza, ¿no?',
  'Acá se juega limpio, ¿estamos?',
  '¡Esa mano la ganaba hasta mi abuela!',
];

const SVG = `<svg viewBox="0 0 80 140" xmlns="http://www.w3.org/2000/svg">
  <circle cx="40" cy="12" r="9" fill="#3b2414"/>
  <circle cx="40" cy="26" r="13" fill="#e6b48d" stroke="#3b2414" stroke-width="1.5"/>
  <path d="M27 22Q30 8 40 10Q50 8 53 22Q48 15 40 15Q32 15 27 22Z" fill="#3b2414"/>
  <circle cx="35" cy="26" r="1.6" fill="#1b1b1b"/><circle cx="45" cy="26" r="1.6" fill="#1b1b1b"/>
  <path d="M35 32Q40 35 45 32" stroke="#a33" stroke-width="1.6" fill="none"/>
  <path d="M24 44Q40 36 56 44L60 98H20Z" fill="#1d3557"/>
  <path d="M28 52H52L56 104H24Z" fill="#fdf6e3" stroke="#b9a37a"/>
  <path d="M32 60h16M30 72h20" stroke="#e63946" stroke-width="1.5"/>
  <path class="arm" d="M56 48L72 70" stroke="#e6b48d" stroke-width="6" stroke-linecap="round"/>
  <rect class="trapo" x="66" y="66" width="14" height="10" rx="2" fill="#f4c430"/>
  <path d="M24 48L12 74" stroke="#e6b48d" stroke-width="6" stroke-linecap="round"/>
  <path d="M30 104L28 136M50 104L52 136" stroke="#3b2414" stroke-width="6" stroke-linecap="round"/>
</svg>`;

let busy = false;

export function mozaPasa(container, { onWipe } = {}) {
  if (busy || !container) return;
  busy = true;
  const el = document.createElement('div');
  el.className = 'moza';
  el.innerHTML = `${SVG}<div class="moza-bubble">${FRASES[Math.floor(Math.random() * FRASES.length)]}</div>`;
  container.appendChild(el);
  setTimeout(() => onWipe && onWipe(), 1600);
  setTimeout(() => {
    el.remove();
    busy = false;
  }, 3600);
}
