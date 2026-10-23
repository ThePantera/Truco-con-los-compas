// Dibuja la mesa: asientos, cartas jugadas, mi mano, botones de canto y marcador.

import { $, esc, initials } from './dom.js';
import { cardEl, cardSVG } from '../graphics/cardRenderer.js';
import { teamOf, TRUCO_NAMES, ENVIDO_NAMES, FLOR_NAMES } from '../engine/trucoEngine.js';
import { parseCard, trucoRank } from '../engine/cards.js';

let renderedPlays = new Set();
let lastHandNo = null;

// Posición relativa de cada asiento alrededor de la mesa (yo siempre abajo).
// El truco se juega hacia la derecha, así que el siguiente queda a mi derecha.
export function seatGeometry(seat, me, n) {
  const r = (seat - (me ?? 0) + n) % n;
  const theta = Math.PI / 2 - (r * 2 * Math.PI) / n;
  return { r, cos: Math.cos(theta), sin: Math.sin(theta) };
}

export function teamLabel(team, me) {
  if (me === null || me === undefined || me < 0) return team === 0 ? 'Equipo 1' : 'Equipo 2';
  return team === teamOf(me) ? 'Nosotros' : 'Ellos';
}

function fosforosSVG(points, target) {
  // Grupos de 5: cuatro lados de un cuadrado y la diagonal.
  const groups = [];
  const half = target / 2;
  for (let g = 0; g < target / 5; g++) {
    const n = Math.max(0, Math.min(5, points - g * 5));
    const seg = [
      'M4 4H26', 'M26 4V26', 'M26 26H4', 'M4 26V4', 'M5 25L25 5',
    ].slice(0, n).map((d) => `<path d="${d}"/>`).join('');
    const heads = [[4, 4], [26, 4], [26, 26], [4, 26], [25, 5]].slice(0, n).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.3"/>`).join('');
    groups.push(`<svg viewBox="0 0 30 30" class="fosforo ${g * 5 === half ? 'buenas-start' : ''}"><g class="palitos">${seg}</g><g class="cabezas">${heads}</g></svg>`);
  }
  return groups.join('');
}

export function renderScoreboard(v) {
  const me = v.me;
  const target = v.config.target;
  const order = me !== null && me >= 0 ? [teamOf(me), 1 - teamOf(me)] : [0, 1];
  $('#scoreboard').innerHTML = order
    .map((team) => {
      const pts = v.score[team];
      const malas = target === 30 ? (pts < 15 ? 'en las malas' : 'en las buenas') : '';
      return `<div class="score-team team-${team}">
        <div class="score-head"><b>${teamLabel(team, me)}</b><span class="score-num">${pts}</span></div>
        <div class="fosforos">${fosforosSVG(pts, target)}</div>
        <small>${malas}</small>
      </div>`;
    })
    .join('<div class="score-vs">a ' + target + '</div>');
}

function renderSeats(v) {
  const n = v.config.numPlayers;
  const h = v.hand;
  const played = new Set(h.rounds.flatMap((r) => r.plays.map((pl) => pl.cardId)));
  const html = v.players
    .map((p, seat) => {
      if (seat === v.me) return '';
      const g = seatGeometry(seat, v.me, n);
      const x = 50 + (window.innerWidth < 600 ? 40 : 47) * g.cos;
      const y = 50 + 45 * g.sin;
      const count = h.handCounts[seat] ?? 0;
      const backs = h.revealed
        ? h.revealed[seat].filter((id) => !played.has(id)).map((id) => `<span class="mini-face">${cardSVG(id)}</span>`).join('')
        : Array.from({ length: count }, () => '<span class="mini-back"></span>').join('');
      const isTurn = v.phase === 'playing' && h.turn === seat && !h.pending;
      const isResp = v.phase === 'playing' && h.pending && h.pending.respondTeam === teamOf(seat);
      return `<div class="seat team-${teamOf(seat)} ${isTurn ? 'turn' : ''} ${isResp ? 'responding' : ''}" data-seat="${seat}" style="left:${x}%;top:${y}%">
        <div class="avatar">${p.isBot && !p.away ? '🤖' : esc(initials(p.name))}${h.mano === seat ? '<span class="mano-badge" title="Es mano">M</span>' : ''}</div>
        <div class="seat-name">${esc(p.name)}${p.away ? ' <small>(se fue)</small>' : ''}</div>
        <div class="seat-cards">${backs}</div>
        <div class="bubble-anchor"></div>
      </div>`;
    })
    .join('');
  $('#seats').innerHTML = html;
}

function renderPlayed(v) {
  const n = v.config.numPlayers;
  const h = v.hand;
  if (lastHandNo !== v.handNo) {
    renderedPlays = new Set();
    lastHandNo = v.handNo;
    $('#played').innerHTML = '';
  }
  const container = $('#played');
  const present = new Set();
  h.rounds.forEach((round, ri) => {
    let bestRank = -1;
    for (const pl of round.plays) bestRank = Math.max(bestRank, trucoRank(parseCard(pl.cardId)));
    round.plays.forEach((pl) => {
      const key = `${ri}-${pl.seat}-${pl.cardId}`;
      present.add(key);
      let el = container.querySelector(`[data-key="${key}"]`);
      if (!el) {
        const g = seatGeometry(pl.seat, v.me, n);
        el = cardEl(pl.cardId, 'played-card');
        el.dataset.key = key;
        // Cada jugador apoya sus cartas en fila frente a él.
        const off = (ri - 1) * 11;
        const x = 50 + 24 * g.cos - off * g.sin;
        const y = 50 + 22 * g.sin + off * g.cos;
        el.style.left = `${x}%`;
        el.style.top = `${y}%`;
        el.style.zIndex = String(10 + ri);
        el.style.setProperty('--from-x', `${g.cos * 260}px`);
        el.style.setProperty('--from-y', `${g.sin * 260}px`);
        el.style.setProperty('--rot', `${(Math.random() * 16 - 8).toFixed(1)}deg`);
        if (!renderedPlays.has(key)) el.classList.add('fly-in');
        renderedPlays.add(key);
        container.appendChild(el);
      }
      const done = round.winnerTeam !== null;
      const isBest = trucoRank(parseCard(pl.cardId)) === bestRank;
      el.classList.toggle('winner', done && round.winnerTeam !== 'parda' && isBest && teamOf(pl.seat) === round.winnerTeam);
      el.classList.toggle('loser', done && !(round.winnerTeam !== 'parda' && isBest && teamOf(pl.seat) === round.winnerTeam));
    });
  });
  for (const el of Array.from(container.children)) if (!present.has(el.dataset.key)) el.remove();
}

function actionLabel(a, v) {
  const p = v.hand.pending;
  switch (a.type) {
    case 'truco': {
      const level = (p && p.kind === 'truco' ? p.level : v.hand.truco.level) + 1;
      return p && p.kind === 'truco' ? `¡Quiero ${TRUCO_NAMES[level]}!` : `¡${TRUCO_NAMES[level]}!`;
    }
    case 'envido': return ENVIDO_NAMES[a.kind];
    case 'flor': return FLOR_NAMES[a.kind];
    case 'quiero': return '¡Quiero!';
    case 'noquiero': return p && p.kind === 'flor' ? 'Con flor me achico' : 'No quiero';
    case 'mazo': return 'Al mazo';
  }
  return a.type;
}

const ACTION_CLASS = { truco: 'btn-truco', envido: 'btn-envido', flor: 'btn-flor', quiero: 'btn-quiero', noquiero: 'btn-noquiero', mazo: 'btn-mazo' };

function sameAction(a, b) {
  return a && b && a.type === b.type && (a.kind || null) === (b.kind || null) && (a.cardId || null) === (b.cardId || null);
}

function renderActions(v, ctx) {
  const actions = v.legal.filter((a) => a.type !== 'play');
  $('#actions').innerHTML = actions
    .map((a, i) => {
      const hint = ctx.guideOn && sameAction(a, ctx.suggestion) ? 'suggested' : '';
      return `<button class="btn act ${ACTION_CLASS[a.type]} ${hint}" data-i="${i}">${actionLabel(a, v)}</button>`;
    })
    .join('');
  $('#actions').querySelectorAll('button').forEach((b) => {
    b.onclick = () => ctx.onAction(actions[Number(b.dataset.i)]);
  });
}

function renderStatus(v) {
  const h = v.hand;
  const p = h.pending;
  const me = v.me;
  let text = '';
  if (v.phase === 'handOver') text = 'Mano terminada. La moza acomoda la mesa...';
  else if (v.phase === 'gameOver') text = '¡Se terminó el partido!';
  else if (p) {
    const who = esc(v.players[p.bySeat].name);
    const what = p.kind === 'truco' ? TRUCO_NAMES[p.level] : p.kind === 'envido' ? p.chain.map((k) => ENVIDO_NAMES[k]).join(' + ') : 'Flor';
    text = me !== null && me >= 0 && p.respondTeam === teamOf(me)
      ? `<b>${who}</b> cantó <b>${what}</b>. ¿Qué le contestás?`
      : `<b>${who}</b> cantó <b>${what}</b>. Esperando respuesta...`;
  } else if (h.turn === me) text = '<b>¡Te toca!</b> Tirá una carta o cantá.';
  else text = `Le toca a <b>${esc(v.players[h.turn].name)}</b>`;
  if (v.phase === 'playing' && h.rounds.length === 1 && !h.envido.done && me !== null && me >= 0) {
    text += ` <span class="envido-chip">Tu envido: ${v.myFlor ? 'flor 🌸' : v.myEnvido}</span>`;
  }
  $('#status').innerHTML = text;
}

function renderHand(v, ctx) {
  const box = $('#my-hand');
  const playable = new Set(v.legal.filter((a) => a.type === 'play').map((a) => a.cardId));
  const cards = v.phase === 'playing' ? v.hand.myCards : [];
  const existing = Array.from(box.children).map((c) => c.dataset.card).join(',');
  if (existing !== cards.join(',')) {
    box.innerHTML = '';
    cards.forEach((id, i) => {
      const el = cardEl(id, 'hand-card deal-in');
      el.style.setProperty('--i', i);
      el.style.setProperty('--fan', `${(i - (cards.length - 1) / 2) * 8}deg`);
      el.title = `Tecla ${i + 1}`;
      box.appendChild(el);
    });
  }
  Array.from(box.children).forEach((el) => {
    const id = el.dataset.card;
    el.classList.toggle('playable', playable.has(id));
    el.classList.toggle('suggested', ctx.guideOn && ctx.suggestion && ctx.suggestion.type === 'play' && ctx.suggestion.cardId === id);
    el.onclick = playable.has(id) ? () => ctx.onPlay(id) : null;
  });
}

function renderCenter(v) {
  const h = v.hand;
  const bits = [];
  if (h.truco.level) bits.push(`<span class="chip chip-truco">${TRUCO_NAMES[h.truco.level]}</span>`);
  if (h.envido.done && h.envido.chain) bits.push('<span class="chip">Envido jugado</span>');
  bits.push(`<span class="chip chip-soft">Mano #${v.handNo} · ${h.rounds.length}ª vuelta</span>`);
  $('#table-center').innerHTML = bits.join('');
}

export function renderTable(v, ctx) {
  renderScoreboard(v);
  renderSeats(v);
  renderPlayed(v);
  renderCenter(v);
  renderStatus(v);
  renderActions(v, ctx);
  renderHand(v, ctx);
}

// Globo de diálogo sobre un asiento (o sobre mi mano si soy yo).
export function bubble(v, seat, html, { cls = '', ms = 2600 } = {}) {
  let anchor;
  if (seat === v.me) anchor = $('#my-hand');
  else anchor = document.querySelector(`.seat[data-seat="${seat}"] .bubble-anchor`);
  if (!anchor) return;
  const b = document.createElement('div');
  b.className = `bubble ${cls}`;
  b.innerHTML = html;
  anchor.appendChild(b);
  setTimeout(() => b.classList.add('out'), ms);
  setTimeout(() => b.remove(), ms + 400);
}

export function floatEmoji(v, seat, emoji) {
  let anchor = seat === v.me || seat < 0 ? $('#my-hand') : document.querySelector(`.seat[data-seat="${seat}"]`);
  if (!anchor) anchor = $('#table');
  const r = anchor.getBoundingClientRect();
  const e = document.createElement('div');
  e.className = 'float-emoji';
  e.textContent = emoji;
  e.style.left = `${r.left + r.width / 2}px`;
  e.style.top = `${r.top + r.height / 3}px`;
  document.body.appendChild(e);
  setTimeout(() => e.remove(), 2200);
}

export function banner(html, cls = '') {
  const b = $('#banner');
  b.className = `banner show ${cls}`;
  b.innerHTML = html;
  clearTimeout(banner.t);
  banner.t = setTimeout(() => (b.className = 'banner'), 1700);
}

export function resetTable() {
  renderedPlays = new Set();
  lastHandNo = null;
  $('#played').innerHTML = '';
  $('#my-hand').innerHTML = '';
}
