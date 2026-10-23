import { describe, it, expect } from 'vitest';
import { createGame, applyAction, startNextHand, viewFor, validate } from '../js/engine/trucoEngine.js';
import { decide } from '../js/bots/rivalBot.js';
import { advise } from '../js/bots/guideBot.js';

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `b${i}`, name: `Bot${i}`, isBot: true }));

describe('bots', () => {
  for (const n of [2, 4, 6]) {
    it(`juegan partidas completas solos (${n} jugadores)`, () => {
      for (let g = 0; g < 15; g++) {
        let s = createGame({ players: players(n), target: 30, flor: g % 2 === 1 });
        let steps = 0;
        while (s.phase !== 'gameOver') {
          expect(steps++).toBeLessThan(4000);
          if (s.phase === 'handOver') { s = startNextHand(s); continue; }
          let moved = false;
          for (let seat = 0; seat < n && !moved; seat++) {
            const v = viewFor(s, seat);
            const a = decide(v);
            if (!a) continue;
            expect(validate(s, seat, a)).toBe(null);
            s = applyAction(s, seat, a);
            moved = true;
          }
          expect(moved).toBe(true);
        }
      }
    });
  }

  it('el guía siempre sugiere algo válido cuando te toca', () => {
    let s = createGame({ players: players(2) });
    const v = viewFor(s, 0);
    const { tips, suggestion } = advise(v);
    expect(tips.length).toBeGreaterThan(0);
    expect(validate(s, 0, suggestion)).toBe(null);
  });
});
