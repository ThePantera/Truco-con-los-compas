// "El Guapo": bot rival. Decide solo con lo que ve su asiento (no hace trampa).

import { parseCard, trucoRank } from '../engine/cards.js';
import { teamOf } from '../engine/trucoEngine.js';

const rankOf = (id) => trucoRank(parseCard(id));

function find(legal, type, kind) {
  return legal.find((a) => a.type === type && (kind === undefined || a.kind === kind)) || null;
}

// Fuerza de la mano de 0 a 1 según las cartas que le quedan.
function handStrength(cards) {
  if (!cards.length) return 0;
  const ranks = cards.map(rankOf).sort((a, b) => b - a);
  const top = ranks[0] / 14;
  const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length / 14;
  return 0.6 * top + 0.4 * avg;
}

function roundsWon(v, team) {
  return v.hand.rounds.filter((r) => r.winnerTeam === team).length;
}

function roundsLost(v, team) {
  return v.hand.rounds.filter((r) => r.winnerTeam === 1 - team).length;
}

// Mejor carta jugada por cada equipo en la vuelta actual.
function currentBest(v) {
  const round = v.hand.rounds[v.hand.rounds.length - 1];
  const best = [-1, -1];
  for (const p of round.plays) best[teamOf(p.seat)] = Math.max(best[teamOf(p.seat)], rankOf(p.cardId));
  return { best, round };
}

export function decide(v, rng = Math.random) {
  const legal = v.legal;
  if (!legal.length) return null;
  const me = v.me;
  const team = teamOf(me);
  const h = v.hand;
  const p = h.pending;
  const strength = handStrength(h.myCards);
  const bluff = rng() < 0.12;
  const envido = v.myEnvido;
  const won = roundsWon(v, team);
  const lost = roundsLost(v, team);

  // --- respuestas ---
  if (p && p.respondTeam === team) {
    if (p.kind === 'flor') {
      return find(legal, 'flor', 'contraflor') || find(legal, 'noquiero');
    }
    if (v.myFlor && find(legal, 'flor', 'flor')) return find(legal, 'flor', 'flor');
    if (p.kind === 'envido') {
      const chainCost = p.chain.length;
      if (envido >= 31 && find(legal, 'envido', 'real') && rng() < 0.5) return find(legal, 'envido', 'real');
      if (envido >= 32 && find(legal, 'envido', 'falta') && rng() < 0.3) return find(legal, 'envido', 'falta');
      const needed = p.chain.includes('falta') ? 30 : 25 + chainCost;
      if (envido >= needed || (bluff && envido >= 23)) return find(legal, 'quiero');
      return find(legal, 'noquiero');
    }
    if (p.kind === 'truco') {
      // El envido está primero
      if (find(legal, 'envido', 'envido') && envido >= 27) return find(legal, 'envido', envido >= 31 ? 'real' : 'envido');
      const edge = strength + won * 0.25 - lost * 0.3;
      if (edge > 0.85 && find(legal, 'truco') && rng() < 0.5) return find(legal, 'truco');
      if (edge > 0.55 - p.level * 0.03 || bluff) return find(legal, 'quiero');
      return find(legal, 'noquiero');
    }
  }
  if (p) return null;
  if (h.turn !== me) return null;

  // --- cantos en su turno ---
  if (v.myFlor && find(legal, 'flor', 'flor')) return find(legal, 'flor', 'flor');
  if (find(legal, 'envido', 'envido')) {
    if (envido >= 33 && rng() < 0.4) return find(legal, 'envido', 'falta');
    if (envido >= 30 && rng() < 0.6) return find(legal, 'envido', 'real');
    if (envido >= 27 || (bluff && envido >= 22)) return find(legal, 'envido', 'envido');
  }
  const trucoAction = find(legal, 'truco');
  if (trucoAction) {
    const edge = strength + won * 0.3 - lost * 0.3;
    const level = h.truco.level;
    if (edge > 0.8 + level * 0.05 || (bluff && rng() < 0.4)) return trucoAction;
  }

  // --- elegir carta ---
  const cards = h.myCards.slice().sort((a, b) => rankOf(a) - rankOf(b)); // de menor a mayor
  const { best, round } = currentBest(v);
  const rivalBest = best[1 - team];
  const ourBest = best[team];
  const playsLeft = v.config.numPlayers - round.plays.length;

  let choice;
  if (round.plays.length === 0) {
    // Abre la vuelta: si ganó la primera, guarda la mejor; si no, sale con una del medio.
    if (h.rounds.length === 1) choice = cards[Math.floor(cards.length / 2)];
    else if (won > lost) choice = cards[cards.length - 1];
    else choice = cards[cards.length - 1];
  } else if (ourBest > rivalBest && playsLeft === 1) {
    choice = cards[0]; // el compañero ya la tiene: tira la peor
  } else {
    const winners = cards.filter((c) => rankOf(c) > rivalBest);
    if (winners.length) choice = winners[0];
    else {
      const tie = cards.find((c) => rankOf(c) === rivalBest);
      choice = tie && won > 0 ? tie : cards[0];
    }
  }
  if (choice) return { type: 'play', cardId: choice };
  return find(legal, 'mazo');
}

const BOT_NAMES = ['El Guapo', 'La Turca', 'El Tano', 'Don Pirulo', 'La Negra', 'El Ruso', 'Cacho', 'Tito'];
export function botName(i) {
  return `${BOT_NAMES[i % BOT_NAMES.length]} 🤖`;
}
