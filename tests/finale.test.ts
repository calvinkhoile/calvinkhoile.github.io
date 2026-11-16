import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { drawGame, fixedGame, LIBRARY, rng } from '../src/finale/questions';
import { pointsFor, type Question } from '../src/finale/types';

const CATEGORIES = ['chess', 'hoops', 'points', 'betting', 'rivalry'];
const TYPES = ['chess', 'play', 'choice', 'rivalry'];

describe('Finale question library', () => {
  it('has 15 questions: 4 chess, 4 hoops, 3 points, 3 betting, 1 rivalry', () => {
    const count = (c: string) => LIBRARY.filter((q) => q.category === c).length;
    expect(LIBRARY).toHaveLength(15);
    expect(CATEGORIES.map(count)).toEqual([4, 4, 3, 3, 1]);
    expect(new Set(LIBRARY.map((q) => q.id)).size).toBe(15);
  });

  it.each(LIBRARY.map((q) => [q.id, q] as const))('%s matches the schema', (_id, q: Question) => {
    expect(CATEGORIES).toContain(q.category);
    expect(TYPES).toContain(q.type);
    expect(['normal', 'hard']).toContain(q.difficulty);
    for (const text of [q.setup, q.prompt, q.explain, q.calvinWin, q.calvinLose]) {
      expect(text.length).toBeGreaterThan(3);
      expect(text).not.toMatch(/—/); // no em dashes in copy
    }
    if (q.type === 'rivalry') {
      expect(q.matchups).toHaveLength(3);
      for (const m of q.matchups!) expect([m.a, m.b]).toContain(m.answer);
    } else {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.options.length).toBeLessThanOrEqual(4);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.options).toContain(q.answer);
    }
    if (q.type === 'chess') expect(q.fen).toBeTruthy();
    if (q.type === 'play') {
      const ids = q.play!.offense.map((p) => p.id);
      expect(q.play!.offense.filter((p) => p.ball)).toHaveLength(1);
      for (const o of q.options) {
        expect(ids).toContain(o);
        expect(q.play!.labels[o]).toBeTruthy();
      }
      for (const p of [...q.play!.offense, ...q.play!.defense]) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(50);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(47);
      }
      const all = [...ids, ...q.play!.defense.map((p) => p.id)];
      for (const a of q.play!.arrows ?? []) expect(all).toContain(a.from);
    }
  });

  it('does not quiz visitors on Calvin’s achievements beyond the one line he asked for', () => {
    // The plan bars questions about school records, awards, and work stats.
    for (const q of LIBRARY) expect(`${q.prompt} ${q.options.join(' ')}`).not.toMatch(/record|award|fellow|redemption rate/i);
  });
});

describe('Chess positions', () => {
  const chessQs = LIBRARY.filter((q) => q.type === 'chess');
  const after = (fen: string, san: string) => {
    const game = new Chess(fen);
    game.move(san); // throws on an illegal or ambiguous move
    return game;
  };

  it.each(chessQs.map((q) => [q.id, q] as const))('%s: legal position, every option is a legal move', (_id, q) => {
    expect(() => new Chess(q.fen!)).not.toThrow();
    expect(new Chess(q.fen!).turn()).toBe('w');
    for (const move of q.options) expect(() => after(q.fen!, move), move).not.toThrow();
    // The squares used for the reveal animation match the real move.
    const played = after(q.fen!, q.answer).history({ verbose: true }).at(-1)!;
    expect(q.move).toEqual({ from: played.from, to: played.to });
  });

  it.each(chessQs.filter((q) => q.answer.endsWith('#')).map((q) => [q.id, q] as const))('%s: the answer is the only mate among the options', (_id, q) => {
    expect(after(q.fen!, q.answer).isCheckmate()).toBe(true);
    for (const move of q.options.filter((m) => m !== q.answer)) expect(after(q.fen!, move).isCheckmate(), move).toBe(false);
  });

  it('chess-fork: Nf6+ checks the king and attacks the queen, and no other option does', () => {
    const q = chessQs.find((x) => x.id === 'chess-fork')!;
    const forks = (san: string) => {
      const game = after(q.fen!, san);
      const queen = game.board().flat().find((p) => p && p.type === 'q' && p.color === 'b')!.square;
      const knight = game.history({ verbose: true }).at(-1)!.to;
      // The knight attacks the queen if, with White to move again, it could capture on her square.
      const fen = game.fen().replace(' b ', ' w ');
      const attacksQueen = !game.isCheck()
        ? false
        : new Chess(fen, { skipValidation: true }).moves({ square: knight, verbose: true }).some((m) => m.to === queen);
      return game.isCheck() && attacksQueen;
    };
    expect(forks(q.answer)).toBe(true);
    for (const move of q.options.filter((m) => m !== q.answer)) expect(forks(move), move).toBe(false);
    // The explanation's detail: after Nc5 or Ng5, Black has Qd1 mate.
    for (const blunder of ['Nc5', 'Ng5']) expect(after(after(q.fen!, blunder).fen(), 'Qd1#').isCheckmate()).toBe(true);
  });
});

describe('Drawing a game', () => {
  it('follows the category rules across 200 seeded draws', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { possessions, suddenDeath } = drawGame(rng(seed));
      expect(possessions).toHaveLength(5);
      expect(possessions[4].category).toBe('rivalry');
      const four = possessions.slice(0, 4);
      const count = (c: string) => four.filter((q) => q.category === c).length;
      expect(count('rivalry')).toBe(0);
      expect(count('chess')).toBeGreaterThanOrEqual(1);
      expect(count('hoops')).toBeGreaterThanOrEqual(1);
      for (const c of ['chess', 'hoops', 'points', 'betting']) expect(count(c)).toBeLessThanOrEqual(2);
      expect(new Set(possessions.map((q) => q.id)).size).toBe(5);
      expect(suddenDeath.category).not.toBe('rivalry');
      expect(possessions.map((q) => q.id)).not.toContain(suddenDeath.id);
    }
  });

  it('is repeatable for a seed and shuffles options without losing the answer', () => {
    const a = drawGame(rng(42));
    const b = drawGame(rng(42));
    expect(a.possessions.map((q) => q.id)).toEqual(b.possessions.map((q) => q.id));
    expect(a.possessions.map((q) => q.options)).toEqual(b.possessions.map((q) => q.options));
    for (const q of a.possessions.filter((x) => x.type !== 'rivalry')) expect(q.options).toContain(q.answer);
  });

  it('avoids the previous game’s questions when it can', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const first = drawGame(rng(seed));
      const prev = first.possessions.map((q) => q.id);
      const second = drawGame(rng(seed + 1000), prev);
      const repeats = second.possessions.slice(0, 4).filter((q) => prev.includes(q.id));
      expect(repeats).toHaveLength(0);
    }
  });

  it('can end in a tie (two 3-pointers against three 2-pointers), which sudden death then breaks', () => {
    const game = fixedGame(['chess-fork', 'hoops-fastbreak', 'chess-backrank', 'points-bonus', 'rivalry-teams', 'betting-odds'])!;
    const values = game.possessions.map(pointsFor);
    expect(values).toEqual([3, 3, 2, 2, 2]);
    // Visitor takes the two hard ones, Calvin takes the rest: 6-6.
    expect(values[0] + values[1]).toBe(values[2] + values[3] + values[4]);
    expect(fixedGame(['nope'])).toBeNull();
  });
});
