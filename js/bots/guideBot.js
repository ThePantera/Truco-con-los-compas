// "El Bot Guía": mira tu mano y te explica qué conviene hacer, en criollo.

import { parseCard, trucoRank, cardNickname } from '../engine/cards.js';
import { teamOf, TRUCO_NAMES, ENVIDO_NAMES } from '../engine/trucoEngine.js';
import { decide } from './rivalBot.js';

const rankOf = (id) => trucoRank(parseCard(id));

function describeStrength(rank) {
  if (rank >= 11) return 'una carta brava';
  if (rank >= 9) return 'una carta buena';
  if (rank >= 6) return 'una carta del montón';
  return 'una carta bajita';
}

function envidoComment(pts) {
  if (pts >= 31) return `Tenés ${pts} de envido: ¡eso es un cañón! Cantá real envido o hasta falta.`;
  if (pts >= 28) return `Tenés ${pts} de envido: está muy bueno, cantá envido sin miedo.`;
  if (pts >= 25) return `Tenés ${pts} de envido: es medio pelo. Querelo si te lo cantan, pero no lo subas.`;
  if (pts >= 20) return `Tenés ${pts} de envido: flojito. Mejor no meterse salvo que quieras mentir.`;
  return `Tenés ${pts} de envido (cartas de distinto palo). No te conviene el envido.`;
}

function actionText(a) {
  if (!a) return null;
  switch (a.type) {
    case 'play': return `Jugá el ${cardNickname(parseCard(a.cardId))}.`;
    case 'truco': return 'Cantá truco (o subilo).';
    case 'envido': return `Cantá ${ENVIDO_NAMES[a.kind]}.`;
    case 'flor': return '¡Cantá flor!';
    case 'quiero': return 'Decí "quiero".';
    case 'noquiero': return 'Decí "no quiero".';
    case 'mazo': return 'Andate al mazo, no hay nada que hacer.';
  }
  return null;
}

// Devuelve { tips: string[], suggestion: accion|null, suggestionText }
export function advise(v) {
  const tips = [];
  const h = v.hand;
  const me = v.me;
  const team = teamOf(me);
  if (v.phase !== 'playing' || me === null) return { tips, suggestion: null, suggestionText: null };

  const p = h.pending;
  const myCards = h.myCards;
  const sorted = myCards.slice().sort((a, b) => rankOf(b) - rankOf(a));

  if (p && p.respondTeam === team) {
    if (p.kind === 'truco') {
      tips.push(`Te cantaron ${TRUCO_NAMES[p.level]}. Si querés, la mano pasa a valer ${p.level + 1} puntos; si no querés, ellos se llevan ${p.level}.`);
      if (h.rounds.length === 1 && !h.envido.done && p.level === 1) tips.push('Ojo: "el envido está primero". Todavía podés cantar envido antes de contestar el truco.');
    } else if (p.kind === 'envido') {
      tips.push(`Te cantaron ${p.chain.map((k) => ENVIDO_NAMES[k]).join(' + ')}. Se comparan los tantos de envido, gana el más alto (si empatan, gana la mano).`);
    } else if (p.kind === 'flor') {
      tips.push('Los dos equipos tienen flor. Podés achicarte (ellos +4) o contraflor (el que tenga la flor más alta se lleva 6).');
    }
  } else if (p) {
    tips.push('Esperando que el otro equipo conteste el canto...');
  } else if (h.turn !== me) {
    tips.push('No es tu turno. Mirá qué tiran los demás y andá pensando.');
  }

  if (sorted.length) {
    const best = parseCard(sorted[0]);
    tips.push(`Tu mejor carta para el truco es ${cardNickname(best)}: ${describeStrength(trucoRank(best))}.`);
  }
  if (h.rounds.length === 1 && !h.envido.done && !h.flor.done) {
    if (v.myFlor) tips.push('¡Tenés flor! Las tres cartas del mismo palo. Cantala antes de jugar: son 3 puntos.');
    else tips.push(envidoComment(v.myEnvido));
  }
  const round = h.rounds[h.rounds.length - 1];
  if (round.plays.length && h.turn === me && !p) {
    const rivalBest = Math.max(-1, ...round.plays.filter((x) => teamOf(x.seat) !== team).map((x) => rankOf(x.cardId)));
    const canBeat = myCards.filter((c) => rankOf(c) > rivalBest);
    if (rivalBest >= 0) {
      if (canBeat.length) tips.push(`Podés ganar esta vuelta con ${cardNickname(parseCard(canBeat.sort((a, b) => rankOf(a) - rankOf(b))[0]))} (la más baja que alcanza).`);
      else tips.push('Esta vuelta no la ganás: tirá la más baja y guardá las buenas.');
    }
  }

  const suggestion = decide({ ...v }, () => 0.5);
  return { tips, suggestion, suggestionText: actionText(suggestion) };
}

// Reglamento corto que muestra la ayuda.
export const RULES = [
  { title: '¿De qué se trata?', body: 'Se juega con mazo español de 40 cartas. Cada jugador recibe 3. Una mano tiene hasta 3 "vueltas": gana la mano el que gana 2. Se juega a 15 o a 30 puntos (en 30, los primeros 15 son "las malas" y los otros "las buenas").' },
  { title: 'Las cartas, de mayor a menor', body: '1 de espada (el macho) > 1 de basto (la hembra) > 7 de espada > 7 de oro > todos los 3 > todos los 2 > 1 de copa y oro > 12 > 11 > 10 > 7 de copa y basto > 6 > 5 > 4.' },
  { title: 'Truco', body: 'En tu turno podés cantar Truco. Si te dicen "quiero", la mano vale 2. Si no quieren, ganás 1. Después el que quiso puede subir a Retruco (3) y el otro a Vale cuatro (4).' },
  { title: 'Envido', body: 'Solo en la primera vuelta, antes de jugar tu carta. Si tenés dos cartas del mismo palo sumás 20 + sus valores (las figuras 10, 11 y 12 valen 0). Si no, vale tu carta más alta. Envido = 2, Real envido = 3, Falta envido = lo que le falta al que va ganando.' },
  { title: 'Flor (opcional)', body: 'Tres cartas del mismo palo. Si está activada, cantala: son 3 puntos y se termina el envido.' },
  { title: 'Pardas', body: 'Si en una vuelta empatan, es "parda". Si se empata la primera, gana el que gane la segunda. Si ganaste la primera y se empata otra, ganás vos. Si todo es parda, gana la mano.' },
  { title: 'Irse al mazo', body: 'Si tu mano es mala, en tu turno podés irte al mazo: el rival se lleva lo que valía la mano.' },
  { title: 'Atajos', body: 'G: tomar un mate 🧉 · H: golpear la mesa 👊 · 1, 2, 3: tirar carta · T: truco · E: envido · Q: quiero · N: no quiero.' },
];
