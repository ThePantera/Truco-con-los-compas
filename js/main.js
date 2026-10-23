// Punto de entrada: arma la escena, el menú y conecta la sesión de juego con la UI.

import { $, $$, showScreen, toast, esc } from './ui/dom.js';
import { sceneHTML } from './graphics/scene.js';
import { renderTable, bubble, floatEmoji, banner, resetTable } from './ui/table.js';
import { renderLobby } from './ui/lobby.js';
import { initChat, addChat, clearChat, toggleChatMobile, showChat, FRASES } from './ui/chat.js';
import { openHelp, openRanking, renderGuide, renderResult, hideResult } from './ui/panels.js';
import { HostSession, ClientSession } from './game/session.js';
import { normalizeCode } from './network/multiplayer.js';
import { advise } from './bots/guideBot.js';
import { initAudio, toggleMusic, toggleVoice, isMusicOn, sfx, shout } from './audio/soundManager.js';
import { mozaPasa } from './character/mesonera.js';
import { mateEl, tomarMate, golpearMesa, bindKeys } from './graphics/fpController.js';
import { MatchTracker, recordGame, bump, loadStats, titleFor } from './stats/ranking.js';
import { teamOf, TRUCO_NAMES } from './engine/trucoEngine.js';
import { teamLabel } from './ui/table.js';

const app = {
  session: null,
  view: null,
  lastSeq: 0,
  tracker: new MatchTracker(),
  recordedGame: false,
  table: {},
  guideOn: readPref('truco-guide', true),
  advice: { tips: [], suggestion: null, suggestionText: null },
  lastResult: null,
};

function readPref(key, def) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : v === '1';
  } catch {
    return def;
  }
}
function writePref(key, val) {
  try {
    localStorage.setItem(key, typeof val === 'boolean' ? (val ? '1' : '0') : val);
  } catch {
    /* nada */
  }
}

function myPid() {
  let pid = null;
  try {
    pid = localStorage.getItem('truco-pid');
    if (!pid) {
      pid = `p-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('truco-pid', pid);
    }
  } catch {
    pid = `p-${Math.random().toString(36).slice(2, 10)}`;
  }
  return pid;
}

function myName() {
  const v = $('#name-input').value.trim();
  if (v) writePref('truco-name', v);
  return v || 'Pibe anónimo';
}

// ---------- menú ----------

function renderBadge() {
  const s = loadStats();
  $('#player-badge').innerHTML = s.games
    ? `<span>🏅 ${esc(titleFor(s.rating))}</span><b>${s.rating}</b><span>${s.wins}G/${s.games}PJ${s.streak > 1 ? ` · 🔥${s.streak}` : ''}</span>`
    : '<span>¡Bienvenido al bar! Jugá tu primera partida.</span>';
}

function goMenu() {
  if (app.session) app.session.leave();
  app.session = null;
  app.view = null;
  hideResult();
  showChat(false);
  document.body.classList.remove('in-game');
  showScreen('screen-menu');
  renderBadge();
  const url = new URL(window.location.href);
  if (url.searchParams.has('sala')) {
    url.searchParams.delete('sala');
    history.replaceState(null, '', url);
  }
}

function attach(session) {
  app.session = session;
  app.lastSeq = 0;
  app.recordedGame = false;
  app.tracker.reset();
  app.table = {};
  clearChat();
  session
    .on('lobby', ({ lobby }) => {
      app.lobby = lobby;
      if (!lobby.started) {
        app.view = null;
        showLobby();
      }
    })
    .on('view', ({ view }) => onView(view))
    .on('chat', onChat)
    .on('fx', onFx)
    .on('table', ({ table }) => (app.table = table))
    .on('error', ({ text }) => toast(`🙅 ${esc(text)}`, { kind: 'warn' }))
    .on('notice', (text) => toast(esc(text), { kind: 'warn', ms: 5000 }))
    .on('kicked', () => {
      toast('El anfitrión te sacó de la sala.', { kind: 'warn' });
      goMenu();
    })
    .on('toLobby', () => {
      hideResult();
      showLobby();
    })
    .on('closed', () => {
      toast('Se cortó la conexión con la sala. ¿El anfitrión cerró la pestaña?', { kind: 'warn', ms: 6000 });
      goMenu();
    });
}

function showLobby() {
  if (!app.session || !app.lobby) return;
  document.body.classList.remove('in-game');
  showScreen('screen-lobby');
  showChat(app.session.online);
  renderLobby(app.lobby, app.session, {
    onStart: () => {
      initAudio();
      app.session.startGame();
    },
    onLeave: goMenu,
  });
}

async function startLocal(size) {
  initAudio();
  const s = new HostSession({ name: myName(), pid: myPid(), online: false });
  attach(s);
  s.setConfig({ size, target: 30 });
  s.startGame();
}

async function createRoom() {
  initAudio();
  const s = new HostSession({ name: myName(), pid: myPid(), online: true });
  attach(s);
  toast('Abriendo la sala...');
  try {
    await s.open();
  } catch (e) {
    toast(esc(e.message), { kind: 'warn', ms: 6000 });
    goMenu();
  }
}

async function joinRoom(code) {
  initAudio();
  const c = normalizeCode(code);
  if (c.length < 4) {
    toast('Poné el código de 4 letras que te pasaron.', { kind: 'warn' });
    return;
  }
  const s = new ClientSession({ name: myName(), pid: myPid(), code: c });
  attach(s);
  toast(`Entrando a la sala ${c}...`);
  try {
    await s.open();
  } catch (e) {
    toast(esc(e.message), { kind: 'warn', ms: 6000 });
    goMenu();
  }
}

// ---------- partida ----------

function onView(view) {
  const firstOfGame = !app.view || view.handNo < (app.view.handNo || 0) || (view.handNo === 1 && view.eventSeq < app.lastSeq);
  if (firstOfGame) {
    app.lastSeq = 0;
    app.recordedGame = false;
    app.tracker.reset();
    resetTable();
    hideResult();
  }
  app.view = view;
  if ($('#screen-game').classList.contains('hidden')) {
    showScreen('screen-game');
    document.body.classList.add('in-game');
    showChat(true);
    $('#room-label').textContent = app.session.online ? `Sala ${app.lobby ? app.lobby.code : ''}` : 'Contra los bots';
  }
  app.advice = advise(view);
  draw();
  processEvents(view);
  app.tracker.observe(view);
  if (view.phase === 'gameOver') onGameOver(view);
}

function draw() {
  const v = app.view;
  if (!v) return;
  renderTable(v, {
    guideOn: app.guideOn,
    suggestion: app.advice.suggestion,
    onPlay: (cardId) => app.session.sendAction({ type: 'play', cardId }),
    onAction: (a) => app.session.sendAction(a),
  });
  renderGuide(app.advice, app.guideOn);
}

const BIG_CANTOS = new Set(['truco', 'envido', 'flor']);

function processEvents(v) {
  const fresh = v.events.filter((e) => e.seq > app.lastSeq);
  app.lastSeq = v.eventSeq;
  // Si llegamos tarde (reconexión), no reproducimos todo el historial.
  const list = fresh.length > 12 ? fresh.slice(-4) : fresh;
  const myTeam = v.me !== null && v.me >= 0 ? teamOf(v.me) : 0;
  for (const ev of list) {
    switch (ev.type) {
      case 'deal':
        sfx('card');
        setTimeout(() => sfx('card'), 120);
        setTimeout(() => sfx('card'), 240);
        break;
      case 'play':
        sfx('card');
        break;
      case 'canto': {
        bubble(v, ev.seat, esc(ev.text), { cls: `bubble-${ev.canto}` });
        if (BIG_CANTOS.has(ev.canto)) {
          sfx('canto');
          banner(`<span>${esc(v.players[ev.seat].name)}</span>${esc(ev.text)}`, `banner-${ev.canto}`);
          shout(ev.text.replace(/[¡!]/g, ''), { pitch: 0.8 + Math.random() * 0.5 });
        } else if (ev.canto === 'quiero' || ev.canto === 'noquiero') {
          shout(ev.text.replace(/[¡!]/g, ''));
        }
        if (ev.canto === 'truco' && v.players[ev.seat].isBot && Math.random() < 0.35) {
          const f = ['¡Quiero retruco, papá!', 'Mirá que tengo el macho, eh...', '¿Qué mirás, bobo? Andá pa\' allá'];
          setTimeout(() => bubble(v, ev.seat, esc(f[Math.floor(Math.random() * f.length)]), { cls: 'bubble-chat' }), 900);
        }
        break;
      }
      case 'envidoShow':
      case 'florShow':
        ev.values.forEach((x, i) =>
          setTimeout(() => bubble(v, x.seat, `${ev.type === 'florShow' ? 'Flor de ' : 'Tengo '}<b>${x.points}</b>`, { cls: 'bubble-envido', ms: 3000 }), i * 450),
        );
        break;
      case 'points':
        sfx('point');
        toast(`${ev.team === myTeam ? '🟢' : '🔴'} <b>${teamLabel(ev.team, v.me)}</b> +${ev.points} · ${esc(ev.reason)}`, { ms: 2600 });
        break;
      case 'handEnd':
        if (v.phase !== 'gameOver') {
          banner(`${teamLabel(ev.team, v.me)} ${v.me !== null && v.me >= 0 ? 'se llevan' : 'se lleva'} la mano <small>+${ev.points}</small>`, ev.team === myTeam ? 'banner-good' : 'banner-bad');
          setTimeout(() => mozaPasa($('#screen-game')), 1400);
        }
        break;
      case 'round':
        break;
    }
  }
}

function onGameOver(v) {
  if (app.recordedGame) return;
  app.recordedGame = true;
  let info = null;
  if (v.me !== null && v.me >= 0) {
    const vsHumans = v.players.some((p, i) => teamOf(i) !== teamOf(v.me) && !p.isBot);
    info = recordGame(v, app.tracker, { online: app.session.online, vsHumans });
    sfx(v.winnerTeam === teamOf(v.me) ? 'win' : 'lose');
    shout(v.winnerTeam === teamOf(v.me) ? '¡Dale campeón!' : 'La próxima será');
    info.unlocked.forEach((a, i) => setTimeout(() => toast(`${a.icon} ¡Logro desbloqueado! <b>${esc(a.name)}</b>`, { kind: 'gold', ms: 4500 }), 800 + i * 600));
  }
  setTimeout(() => {
    if (!app.view || app.view.phase !== 'gameOver') return;
    renderResult(v, info ? { ...info, table: app.table } : { table: app.table, unlocked: [], stats: null, delta: 0 }, {
      isHost: app.session.isHost,
      online: app.session.online,
      onRematch: () => {
        hideResult();
        app.session.rematch();
      },
      onLobby: () => {
        hideResult();
        app.session.backToLobby();
      },
      onMenu: goMenu,
    });
  }, 1600);
}

function onChat(msg) {
  addChat(msg);
  if (msg.kind === 'system') return;
  sfx('pop');
  if (app.view && msg.seat >= 0) {
    if (msg.kind === 'emoji') floatEmoji(app.view, msg.seat, msg.text);
    else bubble(app.view, msg.seat, esc(msg.text), { cls: 'bubble-chat', ms: 3500 });
  }
}

function onFx(msg) {
  if (msg.fx === 'mate') {
    if (msg.pid !== app.session.myPid) toast(`🧉 ${esc(msg.name)} se tomó un mate`, { ms: 1800 });
    if (app.view && msg.seat >= 0) floatEmoji(app.view, msg.seat, '🧉');
    if (msg.pid !== app.session.myPid) sfx('mate');
  } else if (msg.fx === 'golpe') {
    golpearMesa($('#table'));
    sfx('slam');
    if (app.view && msg.seat >= 0) floatEmoji(app.view, msg.seat, '👊');
  }
}

// ---------- controles ----------

function doMate() {
  if (!app.session || !app.view) return;
  if (tomarMate($('#fp-layer'))) {
    sfx('mate');
    app.session.sendFx('mate');
    bump('mates').forEach((a) => toast(`${a.icon} ¡Logro desbloqueado! <b>${esc(a.name)}</b>`, { kind: 'gold' }));
  }
}

function doGolpe() {
  if (!app.session || !app.view) return;
  app.session.sendFx('golpe');
}

function sendChat(text, kind) {
  if (!app.session) return;
  app.session.sendChat(text, kind);
  bump('chats').forEach((a) => toast(`${a.icon} ¡Logro desbloqueado! <b>${esc(a.name)}</b>`, { kind: 'gold' }));
}

function firstLegal(pred) {
  const v = app.view;
  if (!v) return;
  const a = v.legal.find(pred);
  if (a) app.session.sendAction(a);
}

function playIndex(i) {
  const v = app.view;
  if (!v) return;
  const id = v.hand.myCards[i];
  if (id) firstLegal((a) => a.type === 'play' && a.cardId === id);
}

function handleGlobalAction(action) {
  switch (action) {
    case 'local-2': return startLocal(2);
    case 'local-4': return startLocal(4);
    case 'create-room': return createRoom();
    case 'help': return openHelp();
    case 'ranking': return openRanking(app.table);
    case 'music': {
      const on = toggleMusic();
      toast(on ? '🎵 Milonga prendida' : '🔇 Música apagada', { ms: 1500 });
      return;
    }
    case 'voice': {
      const on = toggleVoice();
      toast(on ? '🗣️ Gritos prendidos' : '🤐 Gritos apagados', { ms: 1500 });
      return;
    }
    case 'toggle-guide':
      app.guideOn = !app.guideOn;
      writePref('truco-guide', app.guideOn);
      draw();
      return;
    case 'toggle-chat': return toggleChatMobile();
    case 'leave':
      if (confirm('¿Te levantás de la mesa?')) goMenu();
      return;
  }
}

function init() {
  $('#scene').innerHTML = sceneHTML();
  $('#fp-layer').appendChild(mateEl());
  const fpHint = document.createElement('div');
  fpHint.className = 'fp-hint';
  fpHint.innerHTML = '<button class="fp-btn" data-fp="mate" title="Tecla G">🧉 <kbd>G</kbd></button><button class="fp-btn" data-fp="golpe" title="Tecla H">👊 <kbd>H</kbd></button>';
  $('#fp-layer').appendChild(fpHint);
  fpHint.querySelector('[data-fp="mate"]').onclick = doMate;
  fpHint.querySelector('[data-fp="golpe"]').onclick = doGolpe;

  try {
    $('#name-input').value = localStorage.getItem('truco-name') || '';
  } catch {
    /* nada */
  }
  renderBadge();
  initChat({ onSend: sendChat });

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (b) handleGlobalAction(b.dataset.action);
  });
  $('#join-form').onsubmit = (e) => {
    e.preventDefault();
    joinRoom($('#code-input').value);
  };

  bindKeys({
    g: doMate,
    h: doGolpe,
    1: () => playIndex(0),
    2: () => playIndex(1),
    3: () => playIndex(2),
    t: () => firstLegal((a) => a.type === 'truco'),
    e: () => firstLegal((a) => a.type === 'envido' && a.kind === 'envido'),
    q: () => firstLegal((a) => a.type === 'quiero'),
    n: () => firstLegal((a) => a.type === 'noquiero'),
  });

  const sala = new URLSearchParams(window.location.search).get('sala');
  if (sala) {
    $('#code-input').value = normalizeCode(sala);
    toast(`Te invitaron a la sala <b>${esc(normalizeCode(sala))}</b>. Poné tu nombre y tocá "Entrar a la sala".`, { ms: 6000 });
    $('#name-input').focus();
  }

  // El audio arranca con el primer toque (regla de los navegadores).
  window.addEventListener('pointerdown', () => initAudio(), { once: true });
}

// Para depurar desde la consola.
window.__truco = { app, TRUCO_NAMES, FRASES, isMusicOn };

init();
