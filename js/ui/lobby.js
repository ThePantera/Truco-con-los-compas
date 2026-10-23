// Sala de espera: código para compartir, jugadores, equipos y configuración.

import { $, esc, initials, toast } from './dom.js';

export function roomLink(code) {
  const url = new URL(window.location.href);
  const peer = url.searchParams.get('peer');
  url.search = '';
  url.searchParams.set('sala', code);
  if (peer) url.searchParams.set('peer', peer);
  url.hash = '';
  return url.toString();
}

export function renderLobby(lobby, session, { onStart, onLeave }) {
  const isHost = session.isHost;
  const n = lobby.size;
  const link = roomLink(lobby.code);
  const rows = lobby.players
    .map((p, i) => {
      const seated = i < n;
      const team = i % 2;
      const tag = seated ? `<span class="team-tag team-${team}">${team === 0 ? 'Equipo 1' : 'Equipo 2'}</span>` : '<span class="team-tag">mirando 👀</span>';
      const me = p.pid === session.myPid ? ' <small>(vos)</small>' : '';
      const host = p.pid === lobby.hostPid ? ' 👑' : '';
      const ctrl = isHost
        ? `<span class="row-ctrl">
            <button class="icon-btn" data-move="${esc(p.pid)}" data-d="-1" title="Subir">▲</button>
            <button class="icon-btn" data-move="${esc(p.pid)}" data-d="1" title="Bajar">▼</button>
            ${p.pid !== session.myPid ? `<button class="icon-btn" data-kick="${esc(p.pid)}" title="Sacar">✖</button>` : ''}
          </span>`
        : '';
      return `<li class="lobby-row ${p.connected ? '' : 'away'}"><span class="avatar small">${esc(initials(p.name))}</span><span class="row-name">${esc(p.name)}${me}${host}</span>${tag}${ctrl}</li>`;
    })
    .join('');
  const bots = Math.max(0, n - lobby.players.length);
  const botRows = Array.from({ length: bots }, (_, k) => {
    const i = lobby.players.length + k;
    return `<li class="lobby-row bot"><span class="avatar small">🤖</span><span class="row-name">Bot (si no llega nadie)</span><span class="team-tag team-${i % 2}">${i % 2 === 0 ? 'Equipo 1' : 'Equipo 2'}</span></li>`;
  }).join('');

  const seg = (name, options, value) =>
    `<div class="seg" data-seg="${name}">${options
      .map(([v, label]) => `<button class="seg-btn ${v === value ? 'on' : ''}" data-v="${v}" ${isHost ? '' : 'disabled'}>${label}</button>`)
      .join('')}</div>`;

  $('#lobby').innerHTML = `
    <div class="lobby-head">
      <button class="icon-btn" data-lobby-leave title="Salir">⬅</button>
      <div>
        <div class="lobby-title">Sala</div>
        <div class="room-code">${esc(lobby.code)}</div>
      </div>
    </div>
    <div class="share">
      <input readonly value="${esc(link)}" id="share-link" />
      <button class="btn btn-neon" data-copy>📋 Copiar link</button>
    </div>
    <p class="hint">Mandale el link (o el código <b>${esc(lobby.code)}</b>) a tus compas. El que crea la sala tiene que dejar esta pestaña abierta: su compu hace de mesa.</p>
    <div class="lobby-config">
      <label>Modo ${seg('size', [[2, '1 vs 1'], [4, '2 vs 2'], [6, '3 vs 3']], n)}</label>
      <label>Puntos ${seg('target', [[15, 'a 15'], [30, 'a 30']], lobby.target)}</label>
      <label>Flor ${seg('flor', [['0', 'Sin flor'], ['1', 'Con flor']], lobby.flor ? '1' : '0')}</label>
    </div>
    <ul class="lobby-list">${rows}${botRows}</ul>
    <p class="hint">Los equipos se arman alternando la lista: 1º, 3º y 5º contra 2º, 4º y 6º. ${isHost ? 'Usá ▲▼ para acomodar las parejas.' : ''}</p>
    ${isHost ? '<button class="btn btn-big btn-gold" data-start>🃏 ¡Arrancar partida!</button>' : '<div class="waiting">Esperando que el anfitrión arranque la partida<span class="dots"></span></div>'}
  `;

  const root = $('#lobby');
  root.querySelector('[data-lobby-leave]').onclick = onLeave;
  root.querySelector('[data-copy]').onclick = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copiado. ¡Pasalo por el chat de la oficina!');
    } catch {
      $('#share-link').select();
      toast('Copialo a mano: ya quedó seleccionado.');
    }
  };
  if (!isHost) return;
  root.querySelectorAll('[data-seg] .seg-btn').forEach((b) => {
    b.onclick = () => {
      const name = b.parentElement.dataset.seg;
      const v = b.dataset.v;
      if (name === 'size') session.setConfig({ size: Number(v) });
      if (name === 'target') session.setConfig({ target: Number(v) });
      if (name === 'flor') session.setConfig({ flor: v === '1' });
    };
  });
  root.querySelectorAll('[data-move]').forEach((b) => (b.onclick = () => session.movePlayer(b.dataset.move, Number(b.dataset.d))));
  root.querySelectorAll('[data-kick]').forEach((b) => (b.onclick = () => session.kick(b.dataset.kick)));
  root.querySelector('[data-start]').onclick = onStart;
}
