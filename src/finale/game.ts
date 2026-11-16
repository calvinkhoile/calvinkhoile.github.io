import { profile } from '../content/profile';
import { audio } from '../engine/audio';
import type { CourtScene } from './court-scene';
import type { Draw } from './questions';
import { renderQuestion } from './renderers';
import { pointsFor, type Question } from './types';

// The 1-on-1: five possessions, each a scenario question. Right answer, the visitor scores. Wrong, Calvin does.
// Possession 5 is always the Rivalry Round. A tie goes to one sudden-death possession.

export interface GameResult {
  visitor: number;
  calvin: number;
  /** Correct answers out of the first five possessions. */
  correct: number;
  won: boolean;
  ids: string[];
}

export interface FinaleHooks {
  /** Runs when the visitor wins, before the result screen (the badge ceremony). */
  onWin(): Promise<void>;
  onShare(text: string): void;
  onCopyEmail(): void;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// TODO(calvin): review. Result lines are from the plan; the rest are drafts.
const COPY = {
  win: 'You beat Calvin.',
  winLine: "Respect. Let's actually talk.",
  loseLine: 'Good run. Come back and get your revenge. (Or just message me, that works too.)',
  bucket: 'Bucket.',
  blocked: 'Blocked.',
  suddenDeath: 'Tied up. Next bucket wins.',
};

export class Finale {
  private readonly el: HTMLElement;
  private readonly board: HTMLElement;
  private readonly card: HTMLElement;
  /** The question on screen, exposed for tests. */
  current: Question | null = null;

  constructor(
    root: HTMLElement,
    private readonly court: CourtScene,
    private readonly hooks: FinaleHooks,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'finale';
    this.el.hidden = true;
    this.el.innerHTML = `<div class="scoreboard" role="status" aria-live="polite"></div><section class="finale-card" aria-live="polite"></section>`;
    root.appendChild(this.el);
    // Right arrow is the same as pressing the highlighted "next" button.
    window.addEventListener('keydown', (e) => {
      if (this.el.hidden || e.code !== 'ArrowRight' || e.repeat) return;
      const next = this.card.querySelector<HTMLButtonElement>('.q-verdict:not([hidden]) .q-next');
      if (next) {
        e.preventDefault();
        next.click();
      }
    });
    this.board = this.el.querySelector('.scoreboard')!;
    this.card = this.el.querySelector('.finale-card')!;
  }

  /** Play one full game. Resolves with the result and whether the visitor wants to run it back. */
  async play(draw: Draw): Promise<{ result: GameResult; again: boolean }> {
    this.el.hidden = false;
    let visitor = 0;
    let calvin = 0;
    let correct = 0;
    const total = draw.possessions.length;

    for (let i = 0; i < total; i++) {
      this.score(visitor, calvin, `POSS ${i + 1}/${total}`);
      const q = draw.possessions[i];
      const right = await this.possession(q, i === total - 1 ? 'Final score' : 'Next possession');
      if (right) {
        visitor += pointsFor(q);
        correct++;
      } else calvin += pointsFor(q);
      this.score(visitor, calvin, `POSS ${i + 1}/${total}`);
      await this.verdict;
    }
    if (visitor === calvin) {
      this.score(visitor, calvin, 'SUDDEN DEATH');
      const q = draw.suddenDeath;
      const right = await this.possession(q, 'Final score', COPY.suddenDeath);
      if (right) visitor += pointsFor(q);
      else calvin += pointsFor(q);
      this.score(visitor, calvin, 'SUDDEN DEATH');
      await this.verdict;
    }

    const result: GameResult = { visitor, calvin, correct, won: visitor > calvin, ids: draw.possessions.map((q) => q.id) };
    this.current = null;
    this.score(visitor, calvin, 'FINAL');
    if (result.won) {
      this.card.hidden = true;
      await this.hooks.onWin();
      this.card.hidden = false;
    }
    const again = await this.result(result);
    this.el.hidden = true;
    this.card.replaceChildren();
    return { result, again };
  }

  /** Resolves when the visitor dismisses the verdict for the current possession. */
  private verdict: Promise<void> = Promise.resolve();

  private score(visitor: number, calvin: number, label: string): void {
    this.board.innerHTML = `<span class="sb-team">YOU <b>${visitor}</b></span><span class="sb-poss">${label}</span><span class="sb-team">CALVIN <b>${calvin}</b></span>`;
    this.board.setAttribute('aria-label', `You ${visitor}, Calvin ${calvin}. ${label}.`);
  }

  private possession(q: Question, nextLabel: string, lead?: string): Promise<boolean> {
    this.current = q;
    return new Promise((resolve) => {
      this.card.classList.remove('is-watching');
      this.card.dataset.question = q.id;
      this.card.innerHTML = `<p class="q-setup"><b>Calvin</b> ${esc(lead ? `${lead} ${q.setup}` : q.setup)}</p>
        <h2 class="q-prompt">${esc(q.prompt)}${q.difficulty === 'hard' ? ' <span class="q-three">3 PTS</span>' : ''}</h2>
        <div class="q-body"></div><div class="q-verdict" hidden></div>`;
      const body = this.card.querySelector<HTMLElement>('.q-body')!;
      const rendered = renderQuestion(q, body, async (picked) => {
        const right = picked === q.answer;
        audio.play(right ? 'right' : 'wrong');
        await rendered.reveal();
        // Step aside so the play on the court is visible, then come back with the verdict.
        this.card.classList.add('is-watching');
        if (right) await this.court.make(pointsFor(q));
        else await this.court.miss();
        this.card.classList.remove('is-watching');
        const verdict = this.card.querySelector<HTMLElement>('.q-verdict')!;
        verdict.hidden = false;
        verdict.className = `q-verdict ${right ? 'is-right' : 'is-wrong'}`;
        verdict.innerHTML = `<p class="q-call">${right ? `${COPY.bucket} +${pointsFor(q)}` : `${COPY.blocked} Calvin scores ${pointsFor(q)}.`}</p>
          <p class="q-explain">${esc(q.explain)}</p>
          <p class="q-calvin"><b>Calvin</b> ${esc(right ? q.calvinLose : q.calvinWin)}</p>
          <button type="button" class="btn btn-primary q-next">${nextLabel}</button>`;
        const next = verdict.querySelector<HTMLButtonElement>('.q-next')!;
        next.focus({ preventScroll: true });
        verdict.scrollIntoView({ block: 'nearest' });
        this.verdict = new Promise((done) => next.addEventListener('click', () => done(), { once: true }));
        resolve(right);
      });
    });
  }

  private result(r: GameResult): Promise<boolean> {
    const headline = r.won ? COPY.win : `Calvin wins, ${r.calvin}-${r.visitor}.`;
    const share = `I went ${r.correct}/5 vs Calvin at calvinkhoile.github.io`;
    this.card.dataset.question = 'result';
    this.card.innerHTML = `<div class="finale-result ${r.won ? 'is-win' : 'is-loss'}">
        <h2 class="result-headline">${esc(headline)}</h2>
        <p class="result-score">${r.won ? `${r.visitor}-${r.calvin}. ` : ''}You answered ${r.correct}/5.</p>
        <p class="q-calvin"><b>Calvin</b> ${esc(r.won ? COPY.winLine : COPY.loseLine)}</p>
        <div class="result-contact">
          <a class="btn" href="${profile.links.linkedin}" target="_blank" rel="noopener">LinkedIn</a>
          <button type="button" class="btn result-email">Email</button>
          <a class="btn" href="${profile.links.x}" target="_blank" rel="noopener">Twitter</a>
        </div>
        <div class="result-actions">
          <button type="button" class="btn result-share">Share your score</button>
          <button type="button" class="btn btn-primary result-again">Run it back</button>
          <button type="button" class="btn result-exit">Back to the park</button>
        </div>
      </div>`;
    this.card.querySelector<HTMLButtonElement>('.result-again')!.focus({ preventScroll: true });
    this.card.querySelector('.result-share')!.addEventListener('click', () => this.hooks.onShare(share));
    this.card.querySelector('.result-email')!.addEventListener('click', () => this.hooks.onCopyEmail());
    return new Promise((resolve) => {
      this.card.querySelector('.result-again')!.addEventListener('click', () => resolve(true), { once: true });
      this.card.querySelector('.result-exit')!.addEventListener('click', () => resolve(false), { once: true });
    });
  }
}
