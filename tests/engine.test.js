import { describe, it, expect } from 'vitest';
import { trucoRank, envidoPoints, hasFlor, florPoints, parseCard, newDeck } from '../js/engine/cards.js';
import {
  createGame, applyAction, legalActions, handWinner, startNextHand, viewFor, faltaPoints, TrucoError,
} from '../js/engine/trucoEngine.js';

const C = (...ids) => ids.map(parseCard);
const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `J${i}` }));

// Arma una partida y le pone a mano las cartas que queremos.
function rigged(hands, opts = {}) {
  const s = createGame({ players: players(hands.length), ...opts });
  hands.forEach((h, i) => {
    s.hand.cards[i] = h.slice();
    s.hand.inHand[i] = h.slice();
  });
  return s;
}

const act = (s, seat, a) => applyAction(s, seat, a);
const play = (s, seat, cardId) => act(s, seat, { type: 'play', cardId });

describe('cartas', () => {
  it('el mazo tiene 40 cartas sin 8 ni 9', () => {
    const d = newDeck();
    expect(d).toHaveLength(40);
    expect(d.some((c) => c.num === 8 || c.num === 9)).toBe(false);
  });

  it('jerarquía del truco', () => {
    const order = ['1-espada', '1-basto', '7-espada', '7-oro', '3-copa', '2-oro', '1-copa', '12-basto', '11-oro', '10-copa', '7-copa', '6-espada', '5-oro', '4-basto'];
    const ranks = order.map((id) => trucoRank(parseCard(id)));
    for (let i = 1; i < ranks.length; i++) expect(ranks[i - 1]).toBeGreaterThan(ranks[i]);
    expect(trucoRank(parseCard('3-espada'))).toBe(trucoRank(parseCard('3-oro')));
    expect(trucoRank(parseCard('1-oro'))).toBe(trucoRank(parseCard('1-copa')));
  });

  it('tantos de envido', () => {
    expect(envidoPoints(C('7-oro', '6-oro', '1-espada'))).toBe(33);
    expect(envidoPoints(C('12-oro', '11-oro', '1-espada'))).toBe(20);
    expect(envidoPoints(C('12-oro', '7-copa', '4-espada'))).toBe(7);
    expect(envidoPoints(C('10-oro', '11-copa', '12-espada'))).toBe(0);
    expect(envidoPoints(C('7-oro', '5-oro', '6-oro'))).toBe(33); // con tres del mismo palo cuentan las dos más altas
  });

  it('flor', () => {
    expect(hasFlor(C('1-oro', '5-oro', '12-oro'))).toBe(true);
    expect(hasFlor(C('1-oro', '5-oro', '12-copa'))).toBe(false);
    expect(florPoints(C('1-oro', '5-oro', '12-oro'))).toBe(26);
  });
});

describe('pardas', () => {
  it('gana quien gana dos', () => {
    expect(handWinner([0, 0], 0)).toBe(0);
    expect(handWinner([0, 1], 0)).toBe(null);
    expect(handWinner([0, 1, 1], 0)).toBe(1);
  });
  it('parda en primera define la segunda', () => {
    expect(handWinner(['parda', 1], 0)).toBe(1);
    expect(handWinner(['parda', 'parda'], 0)).toBe(null);
    expect(handWinner(['parda', 'parda', 0], 1)).toBe(0);
    expect(handWinner(['parda', 'parda', 'parda'], 1)).toBe(1);
  });
  it('parda después de ganar primera gana el de primera', () => {
    expect(handWinner([1, 'parda'], 0)).toBe(1);
    expect(handWinner([0, 1, 'parda'], 1)).toBe(0);
  });
});

describe('partida 1v1', () => {
  it('reparte 3 cartas a cada uno y empieza la mano', () => {
    const s = createGame({ players: players(2) });
    expect(s.hand.cards[0]).toHaveLength(3);
    expect(s.hand.cards[1]).toHaveLength(3);
    expect(s.hand.turn).toBe(0);
    expect(s.hand.mano).toBe(0);
  });

  it('no se puede jugar fuera de turno', () => {
    const s = rigged([['1-espada', '4-oro', '5-oro'], ['1-basto', '4-copa', '5-copa']]);
    expect(() => play(s, 1, '1-basto')).toThrow(TrucoError);
  });

  it('una mano simple sin cantos da 1 punto', () => {
    let s = rigged([['1-espada', '7-espada', '5-oro'], ['4-copa', '4-basto', '5-copa']]);
    s = play(s, 0, '1-espada');
    s = play(s, 1, '4-copa');
    expect(s.hand.turn).toBe(0); // ganó la vuelta, arranca
    s = play(s, 0, '7-espada');
    s = play(s, 1, '4-basto');
    expect(s.phase).toBe('handOver');
    expect(s.score).toEqual([1, 0]);
  });

  it('truco querido vale 2 y no querido 1', () => {
    let s = rigged([['1-espada', '7-espada', '5-oro'], ['4-copa', '4-basto', '5-copa']]);
    s = act(s, 0, { type: 'truco' });
    expect(() => play(s, 0, '1-espada')).toThrow();
    const declined = act(s, 1, { type: 'noquiero' });
    expect(declined.score).toEqual([1, 0]);

    s = act(s, 1, { type: 'quiero' });
    expect(s.hand.truco).toEqual({ level: 1, owner: 1 });
    s = play(s, 0, '1-espada');
    s = play(s, 1, '4-copa');
    s = play(s, 0, '7-espada');
    s = play(s, 1, '4-basto');
    expect(s.score).toEqual([2, 0]);
  });

  it('solo el que tiene el quiero puede subir', () => {
    let s = rigged([['1-espada', '7-espada', '5-oro'], ['4-copa', '4-basto', '5-copa']]);
    s = act(s, 0, { type: 'truco' });
    s = act(s, 1, { type: 'quiero' });
    // Turno de 0, pero el quiero lo tiene el equipo 1
    expect(legalActions(s, 0).some((a) => a.type === 'truco')).toBe(false);
    s = play(s, 0, '5-oro');
    expect(legalActions(s, 1).some((a) => a.type === 'truco')).toBe(true);
  });

  it('retruco y vale cuatro: no querido paga el nivel anterior', () => {
    let s = rigged([['1-espada', '7-espada', '5-oro'], ['4-copa', '4-basto', '5-copa']]);
    s = act(s, 0, { type: 'truco' });
    s = act(s, 1, { type: 'truco' }); // quiero retruco
    s = act(s, 0, { type: 'truco' }); // quiero vale cuatro
    expect(s.hand.pending.level).toBe(3);
    expect(legalActions(s, 1).some((a) => a.type === 'truco')).toBe(false);
    const declined = act(s, 1, { type: 'noquiero' });
    expect(declined.score).toEqual([3, 0]);
  });

  it('irse al mazo', () => {
    let s = rigged([['1-espada', '7-espada', '5-oro'], ['4-copa', '4-basto', '5-copa']]);
    s = act(s, 0, { type: 'mazo' });
    expect(s.score).toEqual([0, 1]);
    expect(s.phase).toBe('handOver');
  });

  it('envido querido: gana el que tiene más, la mano gana empates', () => {
    let s = rigged([['7-oro', '6-oro', '4-copa'], ['7-copa', '6-copa', '4-oro']]);
    s = act(s, 0, { type: 'envido', kind: 'envido' });
    s = act(s, 1, { type: 'quiero' });
    expect(s.score).toEqual([2, 0]);
    expect(s.hand.envido.done).toBe(true);
    expect(legalActions(s, 0).some((a) => a.type === 'envido')).toBe(false);
  });

  it('envido envido real envido no querido paga 4', () => {
    let s = rigged([['7-oro', '6-oro', '4-copa'], ['7-copa', '6-copa', '4-oro']]);
    s = act(s, 0, { type: 'envido', kind: 'envido' });
    s = act(s, 1, { type: 'envido', kind: 'envido' });
    s = act(s, 0, { type: 'envido', kind: 'real' });
    expect(legalActions(s, 1).filter((a) => a.type === 'envido').map((a) => a.kind)).toEqual(['falta']);
    s = act(s, 1, { type: 'noquiero' });
    expect(s.score).toEqual([4, 0]);
  });

  it('real envido querido vale 3; no querido 1', () => {
    let s = rigged([['1-oro', '2-copa', '4-copa'], ['7-copa', '6-copa', '4-oro']]);
    s = act(s, 0, { type: 'envido', kind: 'real' });
    const no = act(s, 1, { type: 'noquiero' });
    expect(no.score).toEqual([1, 0]);
    const si = act(s, 1, { type: 'quiero' });
    expect(si.score).toEqual([0, 3]); // 33 contra 26
  });

  it('falta envido en malas gana el partido', () => {
    let s = rigged([['7-oro', '6-oro', '4-copa'], ['1-copa', '2-espada', '4-oro']]);
    s.score = [5, 10];
    s = act(s, 0, { type: 'envido', kind: 'falta' });
    s = act(s, 1, { type: 'quiero' });
    expect(s.phase).toBe('gameOver');
    expect(s.winnerTeam).toBe(0);
  });

  it('falta envido en buenas da lo que le falta al que va ganando', () => {
    const s = rigged([['7-oro', '6-oro', '4-copa'], ['1-copa', '2-espada', '4-oro']]);
    s.score = [18, 22];
    expect(faltaPoints(s, 0)).toBe(8);
  });

  it('el envido está primero', () => {
    let s = rigged([['7-oro', '6-oro', '4-copa'], ['1-copa', '2-espada', '4-oro']]);
    s = act(s, 0, { type: 'truco' });
    s = act(s, 1, { type: 'envido', kind: 'envido' });
    expect(s.hand.pending.kind).toBe('envido');
    s = act(s, 0, { type: 'quiero' });
    expect(s.score).toEqual([2, 0]);
    // vuelve el truco pendiente para el equipo 1
    expect(s.hand.pending).toMatchObject({ kind: 'truco', level: 1, respondTeam: 1 });
  });

  it('no se canta envido después de jugar la carta ni en segunda', () => {
    let s = rigged([['7-oro', '6-oro', '4-copa'], ['1-copa', '2-espada', '4-oro']]);
    s = play(s, 0, '4-copa');
    expect(legalActions(s, 0).some((a) => a.type === 'envido')).toBe(false);
    expect(legalActions(s, 1).some((a) => a.type === 'envido')).toBe(true);
    s = play(s, 1, '4-oro');
    expect(legalActions(s, s.hand.turn).some((a) => a.type === 'envido')).toBe(false);
  });

  it('pasa a la mano siguiente y rota la mano', () => {
    let s = rigged([['1-espada', '7-espada', '5-oro'], ['4-copa', '4-basto', '5-copa']]);
    s = act(s, 0, { type: 'mazo' });
    s = startNextHand(s);
    expect(s.hand.mano).toBe(1);
    expect(s.hand.turn).toBe(1);
    expect(s.phase).toBe('playing');
  });

  it('termina el partido al llegar al objetivo', () => {
    let s = rigged([['1-espada', '7-espada', '5-oro'], ['4-copa', '4-basto', '5-copa']], { target: 15 });
    s.score = [0, 14];
    s = act(s, 0, { type: 'mazo' });
    expect(s.phase).toBe('gameOver');
    expect(s.winnerTeam).toBe(1);
    expect(s.score).toEqual([0, 15]);
    expect(() => startNextHand(s)).toThrow(TrucoError);
  });
});

describe('flor', () => {
  it('flor sin flor contraria: 3 puntos y no hay envido', () => {
    let s = rigged([['1-oro', '5-oro', '12-oro'], ['4-copa', '4-basto', '5-copa']], { flor: true });
    s = act(s, 0, { type: 'flor', kind: 'flor' });
    expect(s.score).toEqual([3, 0]);
    expect(legalActions(s, 0).some((a) => a.type === 'envido')).toBe(false);
  });

  it('flor contra flor: achicarse da 4, contraflor da 6 al mejor', () => {
    let s = rigged([['1-oro', '5-oro', '12-oro'], ['7-copa', '6-copa', '5-copa']], { flor: true });
    s = act(s, 0, { type: 'flor', kind: 'flor' });
    expect(s.hand.pending.kind).toBe('flor');
    expect(act(s, 1, { type: 'noquiero' }).score).toEqual([4, 0]);
    expect(act(s, 1, { type: 'flor', kind: 'contraflor' }).score).toEqual([0, 6]);
  });

  it('se puede responder un envido con flor', () => {
    let s = rigged([['7-oro', '6-oro', '4-copa'], ['7-copa', '6-copa', '5-copa']], { flor: true });
    s = act(s, 0, { type: 'envido', kind: 'envido' });
    s = act(s, 1, { type: 'flor', kind: 'flor' });
    expect(s.score).toEqual([0, 3]);
    expect(s.hand.pending).toBe(null);
  });

  it('sin la opción de flor no se canta', () => {
    const s = rigged([['1-oro', '5-oro', '12-oro'], ['4-copa', '4-basto', '5-copa']]);
    expect(() => act(s, 0, { type: 'flor', kind: 'flor' })).toThrow(TrucoError);
  });
});

describe('2v2', () => {
  it('equipos alternados y cualquiera del equipo responde', () => {
    let s = rigged([
      ['1-espada', '4-oro', '5-oro'],
      ['4-copa', '4-basto', '5-copa'],
      ['7-espada', '6-oro', '6-copa'],
      ['5-basto', '6-basto', '6-espada'],
    ]);
    s = act(s, 0, { type: 'truco' });
    expect(legalActions(s, 2).some((a) => a.type === 'quiero')).toBe(false);
    expect(legalActions(s, 3).some((a) => a.type === 'quiero')).toBe(true);
    s = act(s, 3, { type: 'quiero' });
    s = play(s, 0, '1-espada');
    s = play(s, 1, '4-copa');
    s = play(s, 2, '6-copa');
    s = play(s, 3, '5-basto');
    expect(s.hand.rounds[0].winnerTeam).toBe(0);
    expect(s.hand.turn).toBe(0);
    s = play(s, 0, '4-oro');
    s = play(s, 1, '4-basto');
    s = play(s, 2, '7-espada');
    s = play(s, 3, '6-basto');
    expect(s.score).toEqual([2, 0]);
  });

  it('el compañero que empata con el rival hace parda', () => {
    let s = rigged([
      ['3-espada', '4-oro', '5-oro'],
      ['3-copa', '4-basto', '5-copa'],
      ['4-espada', '6-oro', '6-copa'],
      ['5-basto', '6-basto', '6-espada'],
    ]);
    s = play(s, 0, '3-espada');
    s = play(s, 1, '3-copa');
    s = play(s, 2, '4-espada');
    s = play(s, 3, '5-basto');
    expect(s.hand.rounds[0].winnerTeam).toBe('parda');
    expect(s.hand.turn).toBe(0); // vuelve a empezar el que empezó
  });

  it('el envido de equipo toma el mejor de cada pareja', () => {
    let s = rigged([
      ['4-oro', '5-copa', '12-basto'],
      ['4-copa', '4-basto', '5-espada'],
      ['7-oro', '6-oro', '6-copa'],
      ['5-basto', '6-basto', '6-espada'],
    ]);
    s = act(s, 0, { type: 'envido', kind: 'envido' });
    s = act(s, 1, { type: 'quiero' });
    expect(s.score).toEqual([2, 0]); // 33 del compañero vs 31
  });
});

describe('6 jugadores', () => {
  it('reparte a seis', () => {
    const s = createGame({ players: players(6) });
    for (let i = 0; i < 6; i++) expect(s.hand.cards[i]).toHaveLength(3);
    const all = Object.values(s.hand.cards).flat();
    expect(new Set(all).size).toBe(18);
  });
});

describe('vista', () => {
  it('no muestra las cartas ajenas mientras se juega', () => {
    const s = createGame({ players: players(2) });
    const v = viewFor(s, 0);
    expect(v.hand.myCards).toEqual(s.hand.inHand[0]);
    expect(JSON.stringify(v)).not.toContain(s.hand.inHand[1][0] + '"]');
    expect(v.hand.revealed).toBe(null);
    expect(v.hand.handCounts[1]).toBe(3);
  });
});

describe('partidas al azar', () => {
  it('juegan miles de acciones legales sin romperse', () => {
    let seed = 7;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const n of [2, 4, 6]) {
      for (let g = 0; g < 30; g++) {
        let s = createGame({ players: players(n), target: 15, flor: g % 2 === 0 }, rng);
        let steps = 0;
        while (s.phase !== 'gameOver' && steps < 5000) {
          if (s.phase === 'handOver') { s = startNextHand(s, rng); continue; }
          const options = [];
          for (let seat = 0; seat < n; seat++) for (const a of legalActions(s, seat)) options.push([seat, a]);
          expect(options.length).toBeGreaterThan(0);
          // Más jugadas que cantos para que avance.
          const plays = options.filter(([, a]) => a.type === 'play');
          const pool = plays.length && rng() < 0.7 ? plays : options;
          const [seat, a] = pool[Math.floor(rng() * pool.length)];
          s = applyAction(s, seat, a);
          expect(s.score[0]).toBeLessThanOrEqual(15);
          steps++;
        }
        expect(s.phase).toBe('gameOver');
      }
    }
  });
});
