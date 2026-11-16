// Shape of an entry in src/content/finale-questions.json. A Vitest test validates every entry against this.

export type Category = 'chess' | 'hoops' | 'points' | 'betting' | 'rivalry';
export type QuestionType = 'chess' | 'play' | 'choice' | 'rivalry';

export interface CourtPlayer {
  id: string;
  /** Half-court coordinates: 0-50 wide, 0-47 deep, hoop at (25, 5.25). */
  x: number;
  y: number;
  ball?: boolean;
}

export interface Play {
  offense: CourtPlayer[];
  defense: CourtPlayer[];
  arrows?: { from: string; to: [number, number]; style: 'solid' | 'dashed' }[];
  /** What each selectable player is called in the option list. */
  labels: Record<string, string>;
}

export interface Matchup {
  a: string;
  b: string;
  answer: string;
}

export interface Question {
  id: string;
  category: Category;
  type: QuestionType;
  /** normal = 2 points, hard = 3. */
  difficulty: 'normal' | 'hard';
  /** Calvin's one-line lead-in. */
  setup: string;
  prompt: string;
  fen?: string;
  /** Squares of the answer move, for the reveal animation (checked against chess.js in tests). */
  move?: { from: string; to: string };
  play?: Play;
  /** Odds board shown above the options (line shopping). */
  board?: { book: string; odds: string }[];
  matchups?: Matchup[];
  options: string[];
  answer: string;
  explain: string;
  /** Calvin's line when the visitor gets it wrong. */
  calvinWin: string;
  /** Calvin's line when the visitor gets it right. */
  calvinLose: string;
}

export const pointsFor = (q: Question): number => (q.difficulty === 'hard' ? 3 : 2);
