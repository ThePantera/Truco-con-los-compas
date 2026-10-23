// Cartas españolas dibujadas en SVG (sin imágenes externas).

import { parseCard } from '../engine/cards.js';

const SUIT_COLOR = { oro: '#c8960c', copa: '#b3261e', espada: '#2b5d8a', basto: '#2f6b2a' };

function symbol(suit, x, y, s = 1, rot = 0) {
  const t = `translate(${x} ${y}) rotate(${rot}) scale(${s})`;
  switch (suit) {
    case 'oro':
      return `<g transform="${t}"><circle r="9" fill="#f4c430" stroke="#9a6b00" stroke-width="1.4"/>
        <circle r="5.6" fill="none" stroke="#9a6b00" stroke-width="1"/><circle r="2.2" fill="#c8960c"/>
        <path d="M0-9V-6M0 9V6M-9 0H-6M9 0H6" stroke="#9a6b00" stroke-width="1"/></g>`;
    case 'copa':
      return `<g transform="${t}"><path d="M-8-9H8Q8 1 0 3Q-8 1-8-9Z" fill="#c0392b" stroke="#6e1a12" stroke-width="1.2"/>
        <rect x="-8.5" y="-10.5" width="17" height="2.4" rx="1" fill="#f4c430" stroke="#9a6b00" stroke-width=".6"/>
        <rect x="-1.4" y="3" width="2.8" height="4.5" fill="#f4c430"/><ellipse cy="9" rx="6" ry="2" fill="#f4c430" stroke="#9a6b00" stroke-width=".8"/></g>`;
    case 'espada':
      return `<g transform="${t}"><path d="M0-12L2.2 4.5H-2.2Z" fill="#a9d3f0" stroke="#24507a" stroke-width="1"/>
        <rect x="-6.5" y="4.5" width="13" height="2.2" rx="1" fill="#f4c430" stroke="#9a6b00" stroke-width=".6"/>
        <rect x="-1.2" y="6.7" width="2.4" height="4" fill="#7a4a22"/><circle cy="11.6" r="1.6" fill="#f4c430"/></g>`;
    case 'basto':
      return `<g transform="${t}"><path d="M-2.2 11H2.2L4.2-5Q5-11.5 0-11.5Q-5-11.5-4.2-5Z" fill="#9b6431" stroke="#4a2e12" stroke-width="1.1"/>
        <circle cx="-2.6" cy="-3" r="1.3" fill="#3f8f3a"/><circle cx="2.4" cy="1.5" r="1.3" fill="#3f8f3a"/><circle cx="-1.6" cy="5.5" r="1.1" fill="#3f8f3a"/></g>`;
  }
  return '';
}

const PIPS = {
  2: [[50, 42], [50, 108]],
  3: [[50, 36], [50, 75], [50, 114]],
  4: [[32, 44], [68, 44], [32, 106], [68, 106]],
  5: [[32, 40], [68, 40], [50, 75], [32, 110], [68, 110]],
  6: [[32, 38], [68, 38], [32, 75], [68, 75], [32, 112], [68, 112]],
  7: [[32, 34], [68, 34], [50, 54], [32, 76], [68, 76], [32, 114], [68, 114]],
};

// Cortes del marco: oro 1, copa 2, espada 3, basto 4 (como el naipe español).
function frame(suit) {
  const cuts = { oro: 1, copa: 2, espada: 3, basto: 4 }[suit];
  const color = SUIT_COLOR[suit];
  const segs = [];
  const len = 120 / (cuts + 1);
  for (let i = 0; i <= cuts; i++) {
    const y1 = 15 + i * len + (i ? 3 : 0);
    const y2 = 15 + (i + 1) * len - (i < cuts ? 3 : 0);
    segs.push(`<path d="M9 ${y1}V${y2}M91 ${y1}V${y2}" stroke="${color}" stroke-width="1.6"/>`);
  }
  return `<path d="M14 9H86M14 141H86" stroke="${color}" stroke-width="1.6"/>${segs.join('')}`;
}

function figure(card) {
  const color = SUIT_COLOR[card.suit];
  const label = { 10: 'SOTA', 11: 'CABALLO', 12: 'REY' }[card.num];
  const crown = card.num === 12
    ? '<path d="M36 34L40 24L45 31L50 21L55 31L60 24L64 34Z" fill="#f4c430" stroke="#9a6b00" stroke-width="1"/>'
    : card.num === 11
      ? '<path d="M35 36Q50 22 65 36" stroke="#6b3e1d" stroke-width="5" fill="none"/>'
      : '<rect x="40" y="27" width="20" height="7" rx="3" fill="#2b5d8a"/>';
  return `
    <rect x="22" y="22" width="56" height="106" rx="6" fill="#fff8e6" stroke="${color}" stroke-width="1.2"/>
    ${crown}
    <circle cx="50" cy="44" r="10" fill="#f2c9a0" stroke="#7a4a22" stroke-width="1"/>
    <path d="M45 43h2M53 43h2M47 49q3 2 6 0" stroke="#3b2414" stroke-width="1.2" fill="none"/>
    <path d="M32 120L36 64Q50 54 64 64L68 120Z" fill="${color}" opacity=".85"/>
    <path d="M40 66L50 110L60 66" fill="#f4c430" opacity=".7"/>
    ${symbol(card.suit, 50, 88, 1.25)}
    <text x="50" y="125" text-anchor="middle" font-size="7" font-weight="700" fill="#3b2414" font-family="Georgia,serif">${label}</text>`;
}

export function cardSVG(cardId) {
  const card = parseCard(cardId);
  const color = SUIT_COLOR[card.suit];
  let body;
  if (card.num === 1) {
    const rot = card.suit === 'espada' ? 0 : card.suit === 'basto' ? -12 : 0;
    body = symbol(card.suit, 50, 75, 3.1, rot);
    if (card.id === '1-espada' || card.id === '1-basto')
      body += `<path d="M24 118Q50 132 76 118" stroke="${color}" stroke-width="1.5" fill="none"/>`;
  } else if (card.num >= 10) {
    body = figure(card);
  } else {
    body = PIPS[card.num].map(([x, y]) => symbol(card.suit, x, y, 1.05)).join('');
  }
  const n = card.num;
  return `<svg viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg" class="card-svg" aria-label="${n} de ${card.suit}">
    <rect x="1" y="1" width="98" height="148" rx="9" fill="#fdf6e3" stroke="#b9a37a" stroke-width="1.5"/>
    ${frame(card.suit)}
    <text x="13" y="24" font-size="15" font-weight="800" fill="${color}" font-family="Georgia,serif">${n}</text>
    <text x="87" y="136" font-size="15" font-weight="800" fill="${color}" font-family="Georgia,serif" text-anchor="end" transform="rotate(180 80 131)">${n}</text>
    ${body}
  </svg>`;
}

export function cardBackSVG() {
  return `<svg viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg" class="card-svg">
    <defs><pattern id="rombo" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="12" height="12" fill="#8e1b1b"/><rect width="6" height="6" fill="#a62626"/></pattern></defs>
    <rect x="1" y="1" width="98" height="148" rx="9" fill="url(#rombo)" stroke="#f4c430" stroke-width="2.5"/>
    <rect x="9" y="9" width="82" height="132" rx="6" fill="none" stroke="#f4c430" stroke-width="1.2"/>
    <circle cx="50" cy="75" r="22" fill="#1d3557" stroke="#f4c430" stroke-width="2"/>
    <path d="M50 57l3 9h9l-7 6 3 9-8-5-8 5 3-9-7-6h9z" fill="#f4c430"/>
    <text x="50" y="112" text-anchor="middle" font-size="10" font-weight="900" fill="#f4c430" font-family="Georgia,serif">TRUCO</text>
  </svg>`;
}

export function cardEl(cardId, extraClass = '') {
  const el = document.createElement('div');
  el.className = `card ${extraClass}`;
  el.dataset.card = cardId || '';
  el.innerHTML = cardId ? cardSVG(cardId) : cardBackSVG();
  return el;
}
