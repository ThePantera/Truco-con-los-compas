// Paneles: reglas, ranking, Bot Guía y resultado final.

import { $, esc, openModal } from './dom.js';
import { RULES } from '../bots/guideBot.js';
import { cardSVG } from '../graphics/cardRenderer.js';
import { ACHIEVEMENTS, loadStats, titleFor } from '../stats/ranking.js';
import { teamOf } from '../engine/trucoEngine.js';
import { teamLabel } from './table.js';

const LADDER = ['1-espada', '1-basto', '7-espada', '7-oro', '3-copa', '2-oro', '1-copa', '12-basto', '11-oro', '10-copa', '7-copa', '6-espada', '5-oro', '4-basto'];

export function openHelp() {
  openModal(`
    <h2 class="modal-title">📖 Cómo se juega al truco</h2>
    <p class="modal-sub">Te lo explica el Bot Guía 🧉. Durante la partida, prendelo con el botón 🧉 y te va diciendo qué conviene.</p>
    <div class="ladder">${LADDER.map((id, i) => `<div class="ladder-card"><div class="card">${cardSVG(id)}</div><small>${i + 1}º</small></div>`).join('')}</div>
    <div class="rules">${RULES.map((r) => `<details ${r.title.startsWith('¿') ? 'open' : ''}><summary>${esc(r.title)}</summary><p>${esc(r.body)}</p></details>`).join('')}</div>
  `);
}

export function openRanking(roomTable) {
  const s = loadStats();
  const pct = s.games ? Math.round((s.wins / s.games) * 100) : 0;
  const ach = Object.entries(ACHIEVEMENTS)
    .map(([id, a]) => `<div class="ach ${s.achievements[id] ? 'got' : ''}" title="${esc(a.desc)}"><span>${a.icon}</span><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div>`)
    .join('');
  const hist = s.history
    .map((h) => `<li class="${h.won ? 'w' : 'l'}">${h.won ? '✅ Ganaste' : '❌ Perdiste'} ${h.score[0]} a ${h.score[1]} · ${h.mode}${h.online ? ' online' : ''} <small>${new Date(h.date).toLocaleDateString('es-AR')}</small></li>`)
    .join('');
  openModal(`
    <h2 class="modal-title">🏆 Tu ranking</h2>
    <div class="rank-hero"><div class="rating">${s.rating}</div><div><b>${esc(titleFor(s.rating))}</b><br/><small>Puntaje de barrio</small></div></div>
    <div class="stat-grid">
      <div><b>${s.games}</b><small>partidas</small></div>
      <div><b>${s.wins}</b><small>ganadas</small></div>
      <div><b>${pct}%</b><small>efectividad</small></div>
      <div><b>${s.streak > 0 ? '🔥 ' + s.streak : s.streak}</b><small>racha</small></div>
      <div><b>${s.bestStreak}</b><small>mejor racha</small></div>
      <div><b>${s.mates}</b><small>mates 🧉</small></div>
    </div>
    ${roomTableHTML(roomTable)}
    <h3>Logros</h3><div class="ach-grid">${ach}</div>
    <h3>Últimas partidas</h3><ul class="history">${hist || '<li>Todavía no jugaste. ¿Qué esperás?</li>'}</ul>
  `);
}

export function roomTableHTML(table) {
  const rows = Object.entries(table || {}).sort((a, b) => b[1].wins - a[1].wins || a[1].games - b[1].games);
  if (!rows.length) return '';
  return `<h3>🏢 Tabla de la sala</h3><ol class="room-table">${rows
    .map(([name, r], i) => `<li><span>${i === 0 ? '👑 ' : ''}${esc(name)}</span><b>${r.wins} G / ${r.games} PJ</b></li>`)
    .join('')}</ol>`;
}

export function renderGuide(advice, on) {
  const g = $('#guide');
  g.classList.toggle('off', !on);
  if (!on) {
    g.innerHTML = '<button class="guide-toggle" data-action="toggle-guide">🧉 ¿Necesitás ayuda? Prendé el Bot Guía</button>';
    return;
  }
  g.innerHTML = `
    <div class="guide-head"><span class="guide-avatar">🧉</span><b>Bot Guía</b><button class="icon-btn" data-action="toggle-guide" title="Apagar">✖</button></div>
    ${advice.suggestionText ? `<div class="guide-suggest">💡 ${esc(advice.suggestionText)}</div>` : ''}
    <ul class="guide-tips">${advice.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <button class="btn btn-small btn-ghost" data-action="help">📖 Ver reglas completas</button>`;
}

export function renderResult(v, info, { isHost, online, onRematch, onLobby, onMenu }) {
  const box = $('#result');
  const me = v.me;
  const myTeam = me !== null && me >= 0 ? teamOf(me) : 0;
  const won = v.winnerTeam === myTeam;
  const unlocked = (info && info.unlocked) || [];
  box.innerHTML = `
    <div class="result-card ${won ? 'won' : 'lost'}">
      <div class="result-emoji">${won ? '🏆' : '😭'}</div>
      <h2>${won ? '¡Ganaron!' : 'Perdieron...'}</h2>
      <p class="result-score">${teamLabel(myTeam, me)} ${v.score[myTeam]} — ${v.score[1 - myTeam]} ${teamLabel(1 - myTeam, me)}</p>
      ${won ? '<p>¡Dale campeón, dale campeón! 🎶</p>' : '<p>Andá a cantarle a Gardel... y pedí la revancha.</p>'}
      ${info ? `<p class="delta ${info.delta >= 0 ? 'up' : 'down'}">Puntaje de barrio: ${info.stats.rating} (${info.delta >= 0 ? '+' : ''}${info.delta}) · ${esc(titleFor(info.stats.rating))}${info.stats.streak > 1 ? ` · racha 🔥${info.stats.streak}` : ''}</p>` : ''}
      ${unlocked.length ? `<div class="unlocked">${unlocked.map((a) => `<div class="ach got"><span>${a.icon}</span><b>${esc(a.name)}</b><small>¡Logro nuevo!</small></div>`).join('')}</div>` : ''}
      ${roomTableHTML(info && info.table)}
      <div class="result-btns">
        ${isHost ? '<button class="btn btn-gold" data-r="rematch">🔁 Revancha</button>' : '<p class="hint">El anfitrión decide si hay revancha...</p>'}
        ${isHost && online ? '<button class="btn" data-r="lobby">👥 Volver a la sala</button>' : ''}
        <button class="btn btn-ghost" data-r="menu">🏠 Menú</button>
      </div>
    </div>`;
  box.classList.remove('hidden');
  const on = (k, fn) => {
    const b = box.querySelector(`[data-r="${k}"]`);
    if (b) b.onclick = fn;
  };
  on('rematch', onRematch);
  on('lobby', onLobby);
  on('menu', onMenu);
}

export function hideResult() {
  $('#result').classList.add('hidden');
}
