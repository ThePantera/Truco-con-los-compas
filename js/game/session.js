// Sesiones de juego. El anfitrión (HostSession) corre el motor y los bots;
// los invitados (ClientSession) solo mandan acciones y reciben su vista.
// La UI habla con las dos de la misma forma.

import { createGame, applyAction, startNextHand, viewFor, teamOf, TrucoError } from '../engine/trucoEngine.js';
import { decide, botName } from '../bots/rivalBot.js';
import { hostRoom, joinRoom } from '../network/multiplayer.js';

const HAND_PAUSE_MS = 4200;
const MAX_CHAT = 140;

const clean = (text, max = MAX_CHAT) => String(text || '').replace(/[<>]/g, '').slice(0, max);

class Emitter {
  constructor() {
    this.handlers = {};
  }
  on(evt, fn) {
    (this.handlers[evt] ||= []).push(fn);
    return this;
  }
  emit(evt, ...args) {
    for (const fn of this.handlers[evt] || []) fn(...args);
  }
}

export class HostSession extends Emitter {
  constructor({ name, pid, online }) {
    super();
    this.isHost = true;
    this.online = online;
    this.myPid = pid;
    this.lobby = {
      code: null,
      hostPid: pid,
      size: 2,
      target: 30,
      flor: false,
      started: false,
      players: [{ pid, name: clean(name, 20), connected: true }],
    };
    this.clients = new Map(); // clientId de PeerJS -> pid
    this.state = null;
    this.seatPid = []; // pid del humano en cada asiento, o null si es bot
    this.botTimer = null;
    this.handTimer = null;
    this.table = {}; // tabla de la sala: nombre -> { wins, games }
  }

  async open() {
    if (!this.online) return;
    this.room = await hostRoom({
      onMessage: (clientId, msg) => this.onNetMessage(clientId, msg),
      onDisconnect: (clientId) => this.onNetDisconnect(clientId),
      onError: (text) => this.emit('notice', text),
    });
    this.lobby.code = this.room.code;
    this.pushLobby();
  }

  // ---------- red ----------

  sendTo(pid, msg) {
    if (pid === this.myPid) return this.deliverLocal(msg);
    for (const [clientId, p] of this.clients) if (p === pid) this.room.send(clientId, msg);
  }

  broadcast(msg) {
    this.deliverLocal(msg);
    if (this.room) this.room.broadcast(msg);
  }

  deliverLocal(msg) {
    this.emit(msg.t, msg);
  }

  onNetMessage(clientId, msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'hello') {
      const pid = clean(msg.pid, 40) || clientId;
      this.clients.set(clientId, pid);
      const existing = this.lobby.players.find((p) => p.pid === pid);
      if (existing) {
        existing.connected = true;
        existing.name = clean(msg.name, 20) || existing.name;
      } else {
        this.lobby.players.push({ pid, name: clean(msg.name, 20) || 'Anónimo', connected: true });
      }
      this.chatSystem(`${clean(msg.name, 20)} se sentó a la mesa 🪑`);
      this.pushLobby();
      this.room.send(clientId, { t: 'table', table: this.table });
      if (this.state) this.pushViews();
      return;
    }
    const pid = this.clients.get(clientId);
    if (!pid) return;
    this.handleFrom(pid, msg);
  }

  onNetDisconnect(clientId) {
    const pid = this.clients.get(clientId);
    this.clients.delete(clientId);
    const p = this.lobby.players.find((x) => x.pid === pid);
    if (!p) return;
    if (!this.lobby.started) {
      this.lobby.players = this.lobby.players.filter((x) => x.pid !== pid);
    } else {
      p.connected = false;
    }
    this.chatSystem(`${p.name} se levantó de la mesa${this.lobby.started ? ' (juega un bot por él hasta que vuelva)' : ''}`);
    this.pushLobby();
    if (this.state) this.pushViews();
  }

  // Mensajes de cualquier jugador (incluido el anfitrión).
  handleFrom(pid, msg) {
    const player = this.lobby.players.find((p) => p.pid === pid);
    if (!player) return;
    if (msg.t === 'action') this.doAction(pid, msg.action);
    else if (msg.t === 'chat') {
      const kind = msg.kind === 'emoji' ? 'emoji' : msg.kind === 'phrase' ? 'phrase' : 'text';
      const text = clean(msg.text);
      if (text.trim()) this.broadcast({ t: 'chat', name: player.name, pid, seat: this.seatPid.indexOf(pid), text, kind });
    } else if (msg.t === 'fx') {
      const fx = ['mate', 'golpe'].includes(msg.fx) ? msg.fx : null;
      if (fx) this.broadcast({ t: 'fx', fx, name: player.name, pid, seat: this.seatPid.indexOf(pid) });
    }
  }

  // ---------- API para la UI (el anfitrión es un jugador más) ----------

  sendAction(action) {
    this.handleFrom(this.myPid, { t: 'action', action });
  }
  sendChat(text, kind) {
    this.handleFrom(this.myPid, { t: 'chat', text, kind });
  }
  sendFx(fx) {
    this.handleFrom(this.myPid, { t: 'fx', fx });
  }

  setConfig({ size, target, flor }) {
    if (this.lobby.started) return;
    if ([2, 4, 6].includes(size)) this.lobby.size = size;
    if ([15, 30].includes(target)) this.lobby.target = target;
    if (typeof flor === 'boolean') this.lobby.flor = flor;
    this.pushLobby();
  }

  movePlayer(pid, delta) {
    const list = this.lobby.players;
    const i = list.findIndex((p) => p.pid === pid);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.pushLobby();
  }

  kick(pid) {
    if (pid === this.myPid) return;
    for (const [clientId, p] of this.clients) if (p === pid) this.room.send(clientId, { t: 'kicked' });
    this.lobby.players = this.lobby.players.filter((p) => p.pid !== pid);
    this.pushLobby();
  }

  pushLobby() {
    this.broadcast({ t: 'lobby', lobby: structuredClone(this.lobby) });
  }

  chatSystem(text) {
    this.broadcast({ t: 'chat', name: 'La mesa', pid: null, seat: -1, text, kind: 'system' });
  }

  // ---------- partida ----------

  startGame() {
    const n = this.lobby.size;
    const humans = this.lobby.players.filter((p) => p.connected).slice(0, n);
    const players = [];
    this.seatPid = [];
    let bots = 0;
    for (let i = 0; i < n; i++) {
      const h = humans[i];
      if (h) {
        players.push({ id: h.pid, name: h.name, isBot: false });
        this.seatPid.push(h.pid);
      } else {
        players.push({ id: `bot${i}`, name: botName(bots++), isBot: true });
        this.seatPid.push(null);
      }
    }
    this.lobby.started = true;
    this.state = createGame({ players, target: this.lobby.target, flor: this.lobby.flor });
    this.pushLobby();
    this.pushViews();
  }

  rematch() {
    clearTimeout(this.handTimer);
    clearTimeout(this.botTimer);
    this.state = null;
    this.lobby.started = false;
    this.lobby.players = this.lobby.players.filter((p) => p.connected);
    this.pushLobby();
    this.startGame();
  }

  backToLobby() {
    clearTimeout(this.handTimer);
    clearTimeout(this.botTimer);
    this.state = null;
    this.lobby.started = false;
    this.lobby.players = this.lobby.players.filter((p) => p.connected);
    this.pushLobby();
    this.broadcast({ t: 'toLobby' });
  }

  isBotSeat(seat) {
    const pid = this.seatPid[seat];
    if (!pid) return true;
    const p = this.lobby.players.find((x) => x.pid === pid);
    return !p || !p.connected;
  }

  doAction(pid, action) {
    if (!this.state || !action || typeof action !== 'object') return;
    const seat = this.seatPid.indexOf(pid);
    if (seat < 0) return;
    this.apply(seat, action, pid);
  }

  apply(seat, action, pid = null) {
    try {
      this.state = applyAction(this.state, seat, action);
    } catch (e) {
      if (e instanceof TrucoError) {
        if (pid) this.sendTo(pid, { t: 'error', text: e.message });
        return;
      }
      throw e;
    }
    this.afterChange();
  }

  afterChange() {
    const s = this.state;
    if (s.phase === 'gameOver') this.recordTable();
    this.pushViews();
    if (s.phase === 'handOver') {
      clearTimeout(this.handTimer);
      this.handTimer = setTimeout(() => {
        if (this.state && this.state.phase === 'handOver') {
          this.state = startNextHand(this.state);
          this.afterChange();
        }
      }, HAND_PAUSE_MS);
    }
  }

  recordTable() {
    const s = this.state;
    s.players.forEach((p, seat) => {
      if (p.isBot) return;
      const row = (this.table[p.name] ||= { wins: 0, games: 0 });
      row.games += 1;
      if (teamOf(seat) === s.winnerTeam) row.wins += 1;
    });
    this.broadcast({ t: 'table', table: this.table });
  }

  pushViews() {
    const s = this.state;
    if (!s) return;
    const view = (seat) => {
      const v = viewFor(s, seat);
      v.players = v.players.map((p, i) => ({ ...p, isBot: this.isBotSeat(i), away: !!this.seatPid[i] && this.isBotSeat(i) }));
      return v;
    };
    for (const p of this.lobby.players) {
      const seat = this.seatPid.indexOf(p.pid);
      this.sendTo(p.pid, { t: 'view', view: view(seat >= 0 ? seat : null) });
    }
    this.scheduleBots();
  }

  scheduleBots() {
    clearTimeout(this.botTimer);
    const s = this.state;
    if (!s || s.phase !== 'playing') return;
    const pick = () => {
      const st = this.state;
      const p = st.hand.pending;
      for (let seat = 0; seat < st.config.numPlayers; seat++) {
        if (!this.isBotSeat(seat)) continue;
        // Si el equipo que tiene que responder tiene humanos, que contesten ellos.
        if (p && p.respondTeam === teamOf(seat)) {
          const humansInTeam = st.players.some((_, i) => teamOf(i) === teamOf(seat) && !this.isBotSeat(i));
          if (humansInTeam) continue;
        }
        const action = decide(viewFor(st, seat));
        if (action) return { seat, action };
      }
      return null;
    };
    if (!pick()) return;
    const delay = 800 + Math.random() * 900;
    this.botTimer = setTimeout(() => {
      if (!this.state || this.state.phase !== 'playing') return;
      const next = pick();
      if (next) this.apply(next.seat, next.action);
    }, delay);
  }

  leave() {
    clearTimeout(this.botTimer);
    clearTimeout(this.handTimer);
    if (this.room) this.room.close();
  }
}

export class ClientSession extends Emitter {
  constructor({ name, pid, code }) {
    super();
    this.isHost = false;
    this.online = true;
    this.myPid = pid;
    this.name = clean(name, 20);
    this.code = code;
  }

  async open() {
    this.conn = await joinRoom(this.code, {
      onMessage: (msg) => msg && typeof msg.t === 'string' && this.emit(msg.t, msg),
      onClose: () => this.emit('closed'),
      onError: (text) => this.emit('notice', text),
    });
    this.conn.send({ t: 'hello', name: this.name, pid: this.myPid });
  }

  sendAction(action) {
    this.conn.send({ t: 'action', action });
  }
  sendChat(text, kind) {
    this.conn.send({ t: 'chat', text, kind });
  }
  sendFx(fx) {
    this.conn.send({ t: 'fx', fx });
  }
  leave() {
    if (this.conn) this.conn.close();
  }
}
