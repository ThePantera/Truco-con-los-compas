// La escenografía: paredón de ladrillo del bar con grafitis, cartel de neón,
// guirnalda de lamparitas y fileteado. Todo SVG/CSS, sin archivos externos.

const drips = (color, xs, y) =>
  xs.map((x, i) => `<path d="M${x} ${y}v${8 + ((i * 7) % 14)}" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>`).join('');

function jersey(x, y, num, stars = 0) {
  const stripes = [0, 1, 2, 3, 4].map((i) => `<rect x="${-30 + i * 12}" y="-8" width="6" height="60" fill="#74acdf"/>`).join('');
  const st = Array.from({ length: stars }, (_, i) => `<path transform="translate(${-10 + i * 10} -16) scale(.45)" d="M0-10l3 7h7l-6 5 2 8-6-5-6 5 2-8-6-5h7z" fill="#f4c430"/>`).join('');
  return `<g transform="translate(${x} ${y})">
    <path d="M-30-8L-44 4L-38 16L-30 10V52H30V10L38 16L44 4L30-8L14-12Q0 -4-14-12Z" fill="#fff" stroke="#1b1b1b" stroke-width="2"/>
    <clipPath id="jc${num}${x}"><path d="M-30-8V52H30V-8L14-12Q0-4-14-12Z"/></clipPath>
    <g clip-path="url(#jc${num}${x})">${stripes}</g>
    <path d="M-30-8L-44 4L-38 16L-30 10V52H30V10L38 16L44 4L30-8L14-12Q0 -4-14-12Z" fill="none" stroke="#1b1b1b" stroke-width="2"/>
    <text y="34" text-anchor="middle" font-size="26" font-weight="900" fill="#1d3557" stroke="#fff" stroke-width="1" font-family="Impact,Arial Black,sans-serif">${num}</text>
    ${st}
  </g>`;
}

function diego() {
  return `<svg class="graffiti g-diego" viewBox="0 0 220 230" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 200Q110 170 210 205" stroke="#ff2e88" stroke-width="5" fill="none" opacity=".6"/>
    <ellipse cx="110" cy="22" rx="34" ry="8" fill="none" stroke="#f4c430" stroke-width="4"/>
    ${jersey(110, 150, 10)}
    <g transform="translate(110 92)">
      ${[[-26, -22], [-14, -32], [0, -36], [14, -32], [26, -22], [-30, -6], [30, -6], [-20, -28], [20, -28]].map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="11" fill="#1b1b1b"/>`).join('')}
      <ellipse rx="24" ry="28" fill="#d9a47a" stroke="#1b1b1b" stroke-width="2"/>
      ${[[-18, -20], [-6, -26], [6, -26], [18, -20]].map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="8" fill="#1b1b1b"/>`).join('')}
      <path d="M-12-4h7M5-4h7" stroke="#1b1b1b" stroke-width="3" stroke-linecap="round"/>
      <path d="M-9 12Q0 19 9 12" stroke="#1b1b1b" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <circle cx="-24" cy="6" r="2.5" fill="#f4c430"/>
    </g>
    <text x="110" y="222" text-anchor="middle" font-size="40" font-weight="900" fill="#74acdf" stroke="#fff" stroke-width="2" font-family="Impact,Arial Black,sans-serif" transform="rotate(-4 110 205)">D10S</text>
    ${drips('#74acdf', [70, 96, 128, 150], 222)}
  </svg>`;
}

function messi() {
  return `<svg class="graffiti g-messi" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
    ${jersey(100, 160, 10, 3)}
    <g transform="translate(100 98)">
      <path d="M-24-12Q-26-38 0-40Q26-38 24-12Q14-30 0-28Q-14-30-24-12Z" fill="#6b3e1d"/>
      <ellipse rx="22" ry="27" fill="#e6b48d" stroke="#1b1b1b" stroke-width="2"/>
      <path d="M-22-14Q-20-34 0-34Q20-34 22-14Q12-26 0-25Q-12-26-22-14Z" fill="#6b3e1d"/>
      <path d="M-21 4Q-20 28 0 30Q20 28 21 4Q14 16 0 15Q-14 16-21 4Z" fill="#6b3e1d"/>
      <path d="M-11-4h6M5-4h6" stroke="#1b1b1b" stroke-width="3" stroke-linecap="round"/>
      <path d="M-6 13Q0 16 6 13" stroke="#3b2414" stroke-width="2" fill="none"/>
    </g>
    <g transform="translate(196 150)">
      <path d="M-12 40H12L8 30H-8Z" fill="#2f6b2a"/>
      <path d="M-8 30Q-16 6-6-8Q-14-22 0-30Q14-22 6-8Q16 6 8 30Z" fill="#f4c430" stroke="#9a6b00" stroke-width="2"/>
      <circle cy="-22" r="9" fill="#ffd95a" stroke="#9a6b00" stroke-width="2"/>
    </g>
    <g transform="translate(176 40)">
      <path d="M-56-24H56Q64-24 64-16V8Q64 16 56 16H-20L-34 30L-30 16H-56Q-64 16-64 8V-16Q-64-24-56-24Z" fill="#fff" stroke="#1b1b1b" stroke-width="2.5"/>
      <text y="-1" text-anchor="middle" font-size="15" font-weight="900" fill="#1b1b1b" font-family="Impact,Arial Black,sans-serif">¿QUÉ MIRÁS,</text>
      <text y="13" text-anchor="middle" font-size="15" font-weight="900" fill="#e63946" font-family="Impact,Arial Black,sans-serif">BOBO?</text>
    </g>
    <text x="100" y="232" text-anchor="middle" font-size="36" font-weight="900" fill="#fff" stroke="#74acdf" stroke-width="2.5" font-family="Impact,Arial Black,sans-serif" transform="rotate(3 100 220)">MESSI</text>
    ${drips('#fff', [70, 92, 118], 232)}
  </svg>`;
}

function solDeMayo() {
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a = (i * Math.PI) / 8;
    const r1 = 22;
    const r2 = i % 2 ? 36 : 42;
    return `<path d="M${Math.cos(a) * r1} ${Math.sin(a) * r1}L${Math.cos(a) * r2} ${Math.sin(a) * r2}" stroke="#f4c430" stroke-width="5" stroke-linecap="round"/>`;
  }).join('');
  return `<svg class="graffiti g-sol" viewBox="-50 -50 100 100" xmlns="http://www.w3.org/2000/svg">
    ${rays}<circle r="20" fill="#f4c430" stroke="#9a6b00" stroke-width="2"/>
    <path d="M-8-4h5M3-4h5M-6 7Q0 11 6 7" stroke="#9a6b00" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  </svg>`;
}

function tag(text, cls) {
  return `<div class="tag ${cls}">${text}</div>`;
}

export function sceneHTML() {
  return `
    <div class="wall">
      <div class="lights">${Array.from({ length: 18 }, (_, i) => `<span style="--i:${i}"></span>`).join('')}</div>
      <div class="neon-sign"><span class="neon-a">Bar</span> <span class="neon-b">El Truco</span><small>Boedo · desde 1942</small></div>
      ${diego()}
      ${messi()}
      ${solDeMayo()}
      ${tag('LA MANO DE D10S', 't1')}
      ${tag('BOEDO', 't2')}
      ${tag('¡QUIERO RETRUCO!', 't3')}
      ${tag('ANDÁ PA\' ALLÁ', 't4')}
      <div class="filete-sign">Truco con los compas</div>
    </div>`;
}
