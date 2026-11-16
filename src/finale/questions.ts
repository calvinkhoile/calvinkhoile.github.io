import raw from '../content/finale-questions.json';
import type { Category, Question } from './types';

export const LIBRARY = raw as Question[];
export const byId = (id: string): Question | undefined => LIBRARY.find((q) => q.id === id);

/** Small seeded generator (mulberry32) so a draw can be replayed with `?seed=`. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: readonly T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const MAIN: Category[] = ['chess', 'hoops', 'points', 'betting'];

export interface Draw {
  /** Five possessions. The fifth is always the Rivalry Round. */
  possessions: Question[];
  /** Used only if the game is tied after five. */
  suddenDeath: Question;
}

/**
 * Draw a game. Possessions 1-4 come from chess, hoops, points, and betting: at least one chess and one hoops,
 * at most two from any category, and no repeats from the previous game when that's possible.
 * Possession 5 is the Rivalry Round. Answer options are shuffled on every draw.
 */
export function drawGame(rand: () => number, previous: readonly string[] = []): Draw {
  const pool = (cat: Category, avoid: boolean) => shuffle(LIBRARY.filter((q) => q.category === cat && (!avoid || !previous.includes(q.id))), rand);
  const pick = (avoid: boolean): Question[] | null => {
    const chess = pool('chess', avoid);
    const hoops = pool('hoops', avoid);
    if (chess.length === 0 || hoops.length === 0) return null;
    const picked = [chess[0], hoops[0]];
    const counts: Record<string, number> = { chess: 1, hoops: 1 };
    const rest = shuffle(
      MAIN.flatMap((c) => pool(c, avoid)).filter((q) => !picked.includes(q)),
      rand,
    );
    for (const q of rest) {
      if (picked.length === 4) break;
      if ((counts[q.category] ?? 0) >= 2) continue;
      picked.push(q);
      counts[q.category] = (counts[q.category] ?? 0) + 1;
    }
    return picked.length === 4 ? picked : null;
  };
  const four = pick(true) ?? pick(false)!;
  const rivalry = LIBRARY.find((q) => q.category === 'rivalry')!;
  const unused = shuffle(LIBRARY.filter((q) => q.category !== 'rivalry' && !four.includes(q)), rand);
  const withShuffledOptions = (q: Question): Question => ({ ...q, options: shuffle(q.options, rand) });
  return {
    possessions: [...shuffle(four, rand), rivalry].map(withShuffledOptions),
    suddenDeath: withShuffledOptions(unused[0]),
  };
}

/** A fixed game from question ids (tests and `?set=`): the first five are the possessions, the sixth is sudden death. */
export function fixedGame(ids: readonly string[]): Draw | null {
  const qs = ids.map(byId);
  if (qs.length < 6 || qs.some((q) => !q)) return null;
  return { possessions: qs.slice(0, 5) as Question[], suddenDeath: qs[5] as Question };
}
