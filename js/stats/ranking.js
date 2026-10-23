// Estadísticas, rachas, puntaje "de barrio" y logros. Se guardan en el navegador
// de cada jugador. La tabla de la sala (quién le ganó a quién hoy) la lleva el anfitrión.

import { teamOf } from '../engine/trucoEngine.js';

const KEY = 'truco-stats-v1';

export const ACHIEVEMENTS = {
  primera: { icon: '🥇', name: 'Debut con gloria', desc: 'Ganá tu primera partida' },
  racha3: { icon: '🔥', name: 'Está on fire', desc: 'Ganá 3 partidas seguidas' },
  racha5: { icon: '👑', name: 'Rey del conventillo', desc: 'Ganá 5 partidas seguidas' },
  envido33: { icon: '💯', name: 'Las 33 de la gloria', desc: 'Ganá un envido con 33' },
  vale4: { icon: '💪', name: 'Vale cuatro', desc: 'Ganá una mano en vale cuatro' },
  flor: { icon: '🌸', name: 'Florcita', desc: 'Cantá una flor' },
  zapatero: { icon: '👞', name: 'Zapatero', desc: 'Ganá dejando al rival en 0' },
  remontada: { icon: '🚀', name: 'La remontada', desc: 'Ganá después de ir perdiendo por 10 o más' },
  online: { icon: '🏢', name: 'Crack de la oficina', desc: 'Ganá una partida online contra un compa' },
  matero: { icon: '🧉', name: 'Cebador oficial', desc: 'Tomá 20 mates en la mesa' },
  charla: { icon: '🗣️', name: 'Charlatán', desc: 'Mandá 30 mensajes o emojis' },
  maraton: { icon: '⏱️', name: 'Maratonista', desc: 'Jugá 10 partidas' },
};

const TITLES = [
  [0, 'Pibe de barrio'],
  [1050, 'Habitué del bar'],
  [1120, 'Guapo de Boedo'],
  [1200, 'Capo del conventillo'],
  [1300, 'Leyenda de Caminito'],
];

function fresh() {
  return {
    games: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0, rating: 1000,
    mates: 0, chats: 0, achievements: {}, history: [],
  };
}

export function loadStats() {
  try {
    return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return fresh();
  }
}

function save(stats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    /* sin storage, sin ranking */
  }
}

export function titleFor(rating) {
  let t = TITLES[0][1];
  for (const [min, name] of TITLES) if (rating >= min) t = name;
  return t;
}

function unlock(stats, id, unlocked) {
  if (!stats.achievements[id]) {
    stats.achievements[id] = new Date().toISOString();
    unlocked.push(ACHIEVEMENTS[id]);
  }
}

export function bump(field) {
  const s = loadStats();
  s[field] = (s[field] || 0) + 1;
  const unlocked = [];
  if (s.mates >= 20) unlock(s, 'matero', unlocked);
  if (s.chats >= 30) unlock(s, 'charla', unlocked);
  save(s);
  return unlocked;
}

// Seguimiento durante la partida para logros que dependen de eventos.
export class MatchTracker {
  constructor() {
    this.reset();
  }
  reset() {
    this.flags = { envido33: false, vale4: false, flor: false, worstDiff: 0 };
    this.seen = 0;
  }
  observe(view) {
    if (view.me === null || view.me < 0) return;
    const myTeam = teamOf(view.me);
    for (const ev of view.events) {
      if (ev.seq <= this.seen) continue;
      if (ev.type === 'envidoShow' && ev.winnerTeam === myTeam && ev.values.some((x) => x.seat === view.me && x.points === 33)) this.flags.envido33 = true;
      if (ev.type === 'handEnd' && ev.team === myTeam && ev.reason === 'Vale cuatro') this.flags.vale4 = true;
      if (ev.type === 'canto' && ev.seat === view.me && ev.canto === 'flor') this.flags.flor = true;
      if (ev.type === 'points') this.flags.worstDiff = Math.min(this.flags.worstDiff, ev.score[myTeam] - ev.score[1 - myTeam]);
    }
    this.seen = view.eventSeq;
  }
}

// Registra el resultado. Devuelve { stats, delta, unlocked }.
export function recordGame(view, tracker, { online, vsHumans }) {
  const stats = loadStats();
  const myTeam = teamOf(view.me);
  const won = view.winnerTeam === myTeam;
  const unlocked = [];
  stats.games += 1;
  if (won) {
    stats.wins += 1;
    stats.streak = Math.max(0, stats.streak) + 1;
  } else {
    stats.losses += 1;
    stats.streak = Math.min(0, stats.streak) - 1;
  }
  stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
  const k = vsHumans ? 32 : 16;
  const delta = Math.round(won ? k * (1 + Math.max(0, stats.streak - 1) * 0.1) : -k * 0.75);
  stats.rating = Math.max(800, stats.rating + delta);
  stats.history.unshift({
    date: new Date().toISOString(),
    won,
    score: [view.score[myTeam], view.score[1 - myTeam]],
    mode: `${view.config.numPlayers / 2}v${view.config.numPlayers / 2}`,
    online,
  });
  stats.history = stats.history.slice(0, 20);

  if (won) unlock(stats, 'primera', unlocked);
  if (stats.streak >= 3) unlock(stats, 'racha3', unlocked);
  if (stats.streak >= 5) unlock(stats, 'racha5', unlocked);
  if (tracker.flags.envido33) unlock(stats, 'envido33', unlocked);
  if (tracker.flags.vale4) unlock(stats, 'vale4', unlocked);
  if (tracker.flags.flor) unlock(stats, 'flor', unlocked);
  if (won && view.score[1 - myTeam] === 0) unlock(stats, 'zapatero', unlocked);
  if (won && tracker.flags.worstDiff <= -10) unlock(stats, 'remontada', unlocked);
  if (won && online && vsHumans) unlock(stats, 'online', unlocked);
  if (stats.games >= 10) unlock(stats, 'maraton', unlocked);
  save(stats);
  return { stats, delta, unlocked };
}
