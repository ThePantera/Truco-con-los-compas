// Motor del Truco argentino. Estado serializable + funciones puras:
//   createGame(opts) -> estado
//   applyAction(estado, seat, accion) -> estado nuevo (tira TrucoError si no vale)
//   legalActions(estado, seat) -> acciones posibles
//   viewFor(estado, seat) -> lo que puede ver ese jugador (sin cartas ajenas)
//   startNextHand(estado) -> reparte la mano siguiente
//
// Equipos: seat % 2 (0 = "Nosotros" del anfitrión, 1 = "Ellos").
// Admite 2, 4 o 6 jugadores.

import { newDeck, shuffle, trucoRank, envidoPoints, hasFlor, florPoints, parseCard } from './cards.js';

export class TrucoError extends Error {}

export const TRUCO_NAMES = ['', 'Truco', 'Retruco', 'Vale cuatro'];
export const ENVIDO_NAMES = { envido: 'Envido', real: 'Real envido', falta: 'Falta envido' };
export const FLOR_NAMES = { flor: 'Flor', contraflor: 'Contraflor', contraflorResto: 'Contraflor al resto' };

const MAX_EVENTS = 80;

export const teamOf = (seat) => seat % 2;

export function createGame({ players, target = 30, flor = false }, rng = Math.random) {
  const n = players.length;
  if (![2, 4, 6].includes(n)) throw new TrucoError('El truco se juega de a 2, 4 o 6');
  const s = {
    config: { target, flor, numPlayers: n },
    players: players.map((p, i) => ({ id: p.id, name: p.name, isBot: !!p.isBot, team: teamOf(i) })),
    score: [0, 0],
    dealer: n - 1,
    handNo: 0,
    phase: 'playing',
    winnerTeam: null,
    hand: null,
    events: [],
    eventSeq: 0,
  };
  deal(s, rng);
  return s;
}

function emit(s, ev) {
  s.eventSeq += 1;
  s.events.push({ ...ev, seq: s.eventSeq });
  if (s.events.length > MAX_EVENTS) s.events.splice(0, s.events.length - MAX_EVENTS);
}

function deal(s, rng) {
  const n = s.config.numPlayers;
  const deck = shuffle(newDeck(), rng);
  const mano = (s.dealer + 1) % n;
  const cards = {};
  for (let i = 0; i < n; i++) cards[i] = [];
  // Se reparte de a una, empezando por la mano.
  for (let r = 0; r < 3; r++) for (let k = 0; k < n; k++) cards[(mano + k) % n].push(deck.pop().id);
  s.handNo += 1;
  s.hand = {
    mano,
    cards, // las 3 cartas originales de cada uno
    inHand: Object.fromEntries(Object.entries(cards).map(([k, v]) => [k, v.slice()])),
    rounds: [{ starter: mano, plays: [], winnerTeam: null, winnerSeat: null }],
    turn: mano,
    truco: { level: 0, owner: null },
    envido: { done: false },
    flor: { done: false },
    pending: null,
    suspended: null,
    awards: [],
    winnerTeam: null,
  };
  s.phase = 'playing';
  emit(s, { type: 'deal', handNo: s.handNo, mano, dealer: s.dealer });
}

export function startNextHand(state, rng = Math.random) {
  if (state.phase !== 'handOver') throw new TrucoError('La mano todavía no terminó');
  const s = structuredClone(state);
  s.dealer = (s.dealer + 1) % s.config.numPlayers;
  deal(s, rng);
  return s;
}

// ---------- helpers ----------

const cardsOf = (s, seat) => s.hand.cards[seat].map(parseCard);
const currentRound = (s) => s.hand.rounds[s.hand.rounds.length - 1];
const isFirstRound = (s) => s.hand.rounds.length === 1;
const hasPlayedThisRound = (s, seat) => currentRound(s).plays.some((p) => p.seat === seat);
const seatsOfTeam = (s, team) => s.players.map((_, i) => i).filter((i) => teamOf(i) === team);

export function seatHasFlor(s, seat) {
  return hasFlor(cardsOf(s, seat));
}

export function seatEnvido(s, seat) {
  return envidoPoints(cardsOf(s, seat));
}

// Orden de asientos empezando por la mano (desempata envido/flor/parda).
function orderFromMano(s) {
  const n = s.config.numPlayers;
  return Array.from({ length: n }, (_, k) => (s.hand.mano + k) % n);
}

export function faltaPoints(s, winnerTeam) {
  const { target } = s.config;
  const leader = Math.max(...s.score);
  if (target === 30 && leader < 15) return target - s.score[winnerTeam]; // en malas: gana el partido
  return target - leader;
}

function addPoints(s, team, points, reason) {
  if (points <= 0 || s.phase === 'gameOver') return;
  s.score[team] = Math.min(s.config.target, s.score[team] + points);
  s.hand.awards.push({ team, points, reason });
  emit(s, { type: 'points', team, points, reason, score: s.score.slice() });
  if (s.score[team] >= s.config.target) {
    s.phase = 'gameOver';
    s.winnerTeam = team;
    s.hand.winnerTeam = s.hand.winnerTeam ?? team;
    emit(s, { type: 'gameOver', team, score: s.score.slice() });
  }
}

function endHand(s, team, points, reason) {
  s.hand.pending = null;
  s.hand.suspended = null;
  s.hand.winnerTeam = team;
  emit(s, { type: 'handEnd', team, points, reason });
  if (s.phase !== 'gameOver') s.phase = 'handOver';
  addPoints(s, team, points, reason);
}

const trucoValue = (level) => level + 1; // sin cantar 1, truco 2, retruco 3, vale cuatro 4

// ---------- validación ----------

function envidoAllowedKinds(chain) {
  if (chain.length === 0) return ['envido', 'real', 'falta'];
  const last = chain[chain.length - 1];
  if (last === 'falta') return [];
  if (last === 'real') return ['falta'];
  const kinds = [];
  if (chain.filter((k) => k === 'envido').length < 2 && !chain.includes('real')) kinds.push('envido');
  if (!chain.includes('real')) kinds.push('real');
  kinds.push('falta');
  return kinds;
}

// Devuelve null si la acción es válida, o el motivo si no.
export function validate(s, seat, a) {
  if (s.phase !== 'playing') return 'La mano no está en juego';
  const h = s.hand;
  const team = teamOf(seat);
  const p = h.pending;
  const responding = p && p.respondTeam === team;
  const myTurn = h.turn === seat && !p;

  switch (a.type) {
    case 'play': {
      if (p) return 'Hay un canto esperando respuesta';
      if (h.turn !== seat) return 'No es tu turno';
      if (!h.inHand[seat].includes(a.cardId)) return 'No tenés esa carta';
      return null;
    }
    case 'truco': {
      if (p && p.kind === 'truco') {
        if (!responding) return 'No te toca responder';
        if (p.level >= 3) return 'Ya está en vale cuatro';
        return null;
      }
      if (!myTurn) return 'Solo podés cantar en tu turno';
      if (h.truco.level >= 3) return 'Ya está en vale cuatro';
      if (h.truco.owner !== null && h.truco.owner !== team) return 'El quiero lo tiene el otro equipo';
      return null;
    }
    case 'envido': {
      if (!['envido', 'real', 'falta'].includes(a.kind)) return 'Envido inválido';
      if (!isFirstRound(s) || h.envido.done || h.flor.done) return 'El envido ya pasó';
      if (p && p.kind === 'envido') {
        if (!responding) return 'No te toca responder';
        return envidoAllowedKinds(p.chain).includes(a.kind) ? null : 'No se puede subir así';
      }
      if (p && p.kind === 'truco') {
        // "El envido está primero"
        if (!responding || p.level !== 1 || h.suspended) return 'Ahora no se puede cantar envido';
        return null;
      }
      if (p) return 'Hay un canto esperando respuesta';
      if (!myTurn) return 'Solo podés cantar en tu turno';
      if (hasPlayedThisRound(s, seat)) return 'Ya jugaste tu carta';
      if (h.truco.level > 0) return 'Con el truco querido ya no hay envido';
      return null;
    }
    case 'flor': {
      if (!s.config.flor) return 'Se juega sin flor';
      if (p && p.kind === 'flor') {
        if (!responding) return 'No te toca responder';
        if (!['contraflor', 'contraflorResto'].includes(a.kind)) return 'Respuesta inválida';
        return seatHasFlor(s, seat) ? null : 'No tenés flor';
      }
      if (a.kind !== 'flor') return 'Primero hay que cantar flor';
      if (!isFirstRound(s) || h.flor.done) return 'La flor ya pasó';
      if (!seatHasFlor(s, seat)) return 'No tenés flor';
      if (hasPlayedThisRound(s, seat) && !responding) return 'Ya jugaste tu carta';
      if (p && p.kind === 'envido') return responding ? null : 'No te toca responder';
      if (p && p.kind === 'truco') return responding && p.level === 1 && !h.suspended ? null : 'Ahora no se puede';
      if (p) return 'Hay un canto esperando respuesta';
      if (!myTurn) return 'Solo podés cantar en tu turno';
      return null;
    }
    case 'quiero': {
      if (!p || !responding) return 'No hay nada que querer';
      if (p.kind === 'flor') return 'A la flor se responde con contraflor o achicándose';
      return null;
    }
    case 'noquiero': {
      if (!p || !responding) return 'No hay nada que rechazar';
      return null;
    }
    case 'mazo': {
      if (p) return p.kind === 'truco' && responding ? null : 'Hay un canto esperando respuesta';
      if (h.turn !== seat) return 'Solo en tu turno';
      return null;
    }
    default:
      return 'Acción desconocida';
  }
}

export function legalActions(s, seat) {
  if (s.phase !== 'playing') return [];
  const candidates = [
    ...s.hand.inHand[seat].map((cardId) => ({ type: 'play', cardId })),
    { type: 'truco' },
    { type: 'envido', kind: 'envido' },
    { type: 'envido', kind: 'real' },
    { type: 'envido', kind: 'falta' },
    { type: 'flor', kind: 'flor' },
    { type: 'flor', kind: 'contraflor' },
    { type: 'flor', kind: 'contraflorResto' },
    { type: 'quiero' },
    { type: 'noquiero' },
    { type: 'mazo' },
  ];
  return candidates.filter((a) => validate(s, seat, a) === null);
}

// ---------- aplicar ----------

export function applyAction(state, seat, action) {
  const err = validate(state, seat, action);
  if (err) throw new TrucoError(err);
  const s = structuredClone(state);
  const h = s.hand;
  const team = teamOf(seat);
  const p = h.pending;

  switch (action.type) {
    case 'play':
      playCard(s, seat, action.cardId);
      break;

    case 'truco': {
      const level = (p ? p.level : h.truco.level) + 1;
      if (p) h.truco.level = p.level; // subir implica aceptar lo anterior
      h.pending = { kind: 'truco', level, byTeam: team, bySeat: seat, respondTeam: 1 - team };
      emit(s, { type: 'canto', seat, canto: 'truco', level, text: `¡${TRUCO_NAMES[level]}!` });
      break;
    }

    case 'envido': {
      if (p && p.kind === 'truco') {
        h.suspended = p;
        h.pending = null;
      }
      const chain = h.pending && h.pending.kind === 'envido' ? [...h.pending.chain, action.kind] : [action.kind];
      h.pending = { kind: 'envido', chain, byTeam: team, bySeat: seat, respondTeam: 1 - team };
      emit(s, { type: 'canto', seat, canto: 'envido', kind: action.kind, text: `¡${ENVIDO_NAMES[action.kind]}!` });
      break;
    }

    case 'flor':
      if (p && p.kind === 'flor') {
        emit(s, { type: 'canto', seat, canto: 'flor', kind: action.kind, text: `¡${FLOR_NAMES[action.kind]}!` });
        resolveFlor(s, action.kind);
      } else {
        singFlor(s, seat);
      }
      break;

    case 'quiero':
      emit(s, { type: 'canto', seat, canto: 'quiero', text: '¡Quiero!' });
      if (p.kind === 'truco') {
        h.truco.level = p.level;
        h.truco.owner = team;
        h.pending = null;
      } else if (p.kind === 'envido') {
        resolveEnvido(s, true);
      }
      break;

    case 'noquiero':
      if (p.kind === 'truco') {
        emit(s, { type: 'canto', seat, canto: 'noquiero', text: 'No quiero' });
        endHand(s, p.byTeam, p.level, `${TRUCO_NAMES[p.level]} no querido`);
      } else if (p.kind === 'envido') {
        emit(s, { type: 'canto', seat, canto: 'noquiero', text: 'No quiero' });
        resolveEnvido(s, false);
      } else if (p.kind === 'flor') {
        emit(s, { type: 'canto', seat, canto: 'noquiero', text: 'Con flor me achico' });
        h.pending = null;
        finishFlor(s);
        addPoints(s, p.byTeam, 4, 'Flor (se achicaron)');
      }
      break;

    case 'mazo': {
      emit(s, { type: 'canto', seat, canto: 'mazo', text: 'Me voy al mazo' });
      const pts = p && p.kind === 'truco' ? p.level : trucoValue(h.truco.level);
      endHand(s, 1 - team, pts, 'Se fueron al mazo');
      break;
    }
  }
  return s;
}

function playCard(s, seat, cardId) {
  const h = s.hand;
  const n = s.config.numPlayers;
  h.inHand[seat] = h.inHand[seat].filter((c) => c !== cardId);
  const round = currentRound(s);
  round.plays.push({ seat, cardId });
  emit(s, { type: 'play', seat, cardId, round: h.rounds.length - 1 });

  if (round.plays.length < n) {
    h.turn = (seat + 1) % n;
    return;
  }

  // Se cierra la vuelta.
  let best = -1;
  for (const pl of round.plays) best = Math.max(best, trucoRank(parseCard(pl.cardId)));
  const top = round.plays.filter((pl) => trucoRank(parseCard(pl.cardId)) === best);
  const teams = new Set(top.map((pl) => teamOf(pl.seat)));
  if (teams.size === 1) {
    round.winnerTeam = teamOf(top[0].seat);
    round.winnerSeat = top[0].seat;
  } else {
    round.winnerTeam = 'parda';
  }
  emit(s, { type: 'round', round: h.rounds.length - 1, winnerTeam: round.winnerTeam, winnerSeat: round.winnerSeat });

  const winner = handWinner(h.rounds.map((r) => r.winnerTeam), teamOf(h.mano));
  if (winner !== null) {
    endHand(s, winner, trucoValue(h.truco.level), h.truco.level ? TRUCO_NAMES[h.truco.level] : 'La mano');
    return;
  }
  const starter = round.winnerSeat ?? round.starter;
  h.rounds.push({ starter, plays: [], winnerTeam: null, winnerSeat: null });
  h.turn = starter;
}

// Reglas de pardas. `results` son los ganadores de cada vuelta jugada (0, 1 o 'parda').
export function handWinner(results, manoTeam) {
  const [r1, r2, r3] = results;
  if (results.length < 2) return null;
  if (r1 === 'parda') {
    if (r2 !== 'parda') return r2;
    if (results.length < 3) return null;
    return r3 !== 'parda' ? r3 : manoTeam;
  }
  if (r2 === r1 || r2 === 'parda') return r1;
  if (results.length < 3) return null;
  return r3 === 'parda' ? r1 : r3;
}

function bestOfTeams(s, valueOf) {
  // Devuelve { values: [{seat, points}], winnerTeam } con desempate a favor de la mano.
  const order = orderFromMano(s);
  const values = order.map((seat) => ({ seat, points: valueOf(seat) })).filter((v) => v.points !== null);
  let winner = null;
  for (const v of values) if (!winner || v.points > winner.points) winner = v;
  return { values, winnerTeam: teamOf(winner.seat) };
}

function resumeSuspended(s) {
  const h = s.hand;
  if (h.suspended && s.phase === 'playing') h.pending = h.suspended;
  h.suspended = null;
}

function resolveEnvido(s, accepted) {
  const h = s.hand;
  const p = h.pending;
  h.pending = null;
  h.envido.done = true;
  h.envido.chain = p.chain;
  if (!accepted) {
    const pts = p.chain.length === 1 ? 1 : p.chain.slice(0, -1).reduce((acc, k) => acc + (k === 'real' ? 3 : 2), 0);
    addPoints(s, p.byTeam, pts, `${ENVIDO_NAMES[p.chain[p.chain.length - 1]]} no querido`);
  } else {
    const { values, winnerTeam } = bestOfTeams(s, (seat) => seatEnvido(s, seat));
    const pts = p.chain.includes('falta')
      ? faltaPoints(s, winnerTeam)
      : p.chain.reduce((acc, k) => acc + (k === 'real' ? 3 : 2), 0);
    emit(s, { type: 'envidoShow', values, winnerTeam });
    addPoints(s, winnerTeam, pts, `Envido (${p.chain.map((k) => ENVIDO_NAMES[k]).join(', ')})`);
  }
  resumeSuspended(s);
}

function singFlor(s, seat) {
  const h = s.hand;
  const team = teamOf(seat);
  const p = h.pending;
  if (p && p.kind === 'truco') h.suspended = p;
  h.pending = null; // la flor anula el envido pendiente
  emit(s, { type: 'canto', seat, canto: 'flor', kind: 'flor', text: '¡Flor!' });
  const rivalsWithFlor = seatsOfTeam(s, 1 - team).filter((x) => seatHasFlor(s, x));
  if (rivalsWithFlor.length === 0) {
    finishFlor(s);
    addPoints(s, team, 3, 'Flor');
    return;
  }
  h.pending = { kind: 'flor', byTeam: team, bySeat: seat, respondTeam: 1 - team };
}

function finishFlor(s) {
  s.hand.flor.done = true;
  s.hand.envido.done = true;
  resumeSuspended(s);
}

function resolveFlor(s, kind) {
  const h = s.hand;
  h.pending = null;
  const { values, winnerTeam } = bestOfTeams(s, (seat) => (seatHasFlor(s, seat) ? florPoints(cardsOf(s, seat)) : null));
  emit(s, { type: 'florShow', values, winnerTeam });
  const pts = kind === 'contraflorResto' ? faltaPoints(s, winnerTeam) : 6;
  finishFlor(s);
  addPoints(s, winnerTeam, pts, FLOR_NAMES[kind]);
}

// ---------- vista por jugador ----------

export function viewFor(s, seat) {
  const h = s.hand;
  const reveal = s.phase !== 'playing';
  const v = {
    config: s.config,
    players: s.players,
    score: s.score,
    dealer: s.dealer,
    handNo: s.handNo,
    phase: s.phase,
    winnerTeam: s.winnerTeam,
    events: s.events,
    eventSeq: s.eventSeq,
    me: seat,
    hand: {
      mano: h.mano,
      turn: h.turn,
      rounds: h.rounds,
      truco: h.truco,
      envido: h.envido,
      flor: h.flor,
      pending: h.pending,
      suspended: h.suspended,
      awards: h.awards,
      winnerTeam: h.winnerTeam,
      handCounts: Object.fromEntries(Object.entries(h.inHand).map(([k, c]) => [k, c.length])),
      myCards: seat === null ? [] : h.inHand[seat],
      myOriginal: seat === null ? [] : h.cards[seat],
      revealed: reveal ? h.cards : null,
    },
    legal: seat === null ? [] : legalActions(s, seat),
    myEnvido: seat === null ? null : seatEnvido(s, seat),
    myFlor: seat === null ? false : s.config.flor && seatHasFlor(s, seat),
  };
  return structuredClone(v);
}
