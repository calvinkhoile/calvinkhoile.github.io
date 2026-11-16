import type { Question } from '../types';

// Question renderers. Each draws its question into `host` and calls `onAnswer` once.
// `reveal` then shows the right answer on the same view (the move, the pass, the picks).

export interface Rendered {
  /** Show the correct answer. Resolves when the reveal has finished playing. */
  reveal(): Promise<void>;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Option buttons shared by chess, play, and choice. Marks right and wrong with a glyph as well as color. */
function optionList(host: HTMLElement, options: { value: string; label: string }[], answer: string, onPick: (value: string) => void): { mark(picked: string): void } {
  const list = document.createElement('div');
  list.className = 'q-options';
  list.setAttribute('role', 'group');
  list.setAttribute('aria-label', 'Answers');
  list.dataset.count = String(options.length);
  list.innerHTML = options.map((o) => `<button type="button" class="q-option" data-option="${esc(o.value)}"><span>${esc(o.label)}</span></button>`).join('');
  host.appendChild(list);
  let done = false;
  list.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.q-option');
    if (!btn || done) return;
    done = true;
    onPick(btn.dataset.option!);
  });
  queueMicrotask(() => list.querySelector<HTMLButtonElement>('.q-option')?.focus({ preventScroll: true }));
  return {
    mark(picked) {
      done = true;
      list.querySelectorAll<HTMLButtonElement>('.q-option').forEach((b) => {
        b.disabled = true;
        const value = b.dataset.option!;
        if (value === answer) b.classList.add('is-right');
        else if (value === picked) b.classList.add('is-wrong');
      });
    },
  };
}

// ----- chess -----

const GLYPH: Record<string, string> = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙', k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const NAME: Record<string, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };

function boardFromFen(fen: string): Record<string, string> {
  const squares: Record<string, string> = {};
  fen.split(' ')[0].split('/').forEach((row, r) => {
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) file += Number(ch);
      else squares['abcdefgh'[file++] + (8 - r)] = ch;
    }
  });
  return squares;
}

function chess(q: Question, host: HTMLElement, onAnswer: (picked: string) => void): Rendered {
  const squares = boardFromFen(q.fen!);
  const board = document.createElement('div');
  board.className = 'chessboard';
  board.setAttribute('role', 'img');
  const pieces = Object.entries(squares).map(([sq, p]) => `${p === p.toUpperCase() ? 'White' : 'Black'} ${NAME[p.toLowerCase()]} on ${sq}`);
  board.setAttribute('aria-label', `Chess position, White to move. ${pieces.join(', ')}.`);
  for (let r = 8; r >= 1; r--) {
    for (const f of 'abcdefgh') {
      const sq = f + r;
      const cell = document.createElement('div');
      cell.className = `sq ${('abcdefgh'.indexOf(f) + r) % 2 ? 'sq-light' : 'sq-dark'}`;
      cell.dataset.sq = sq;
      const piece = squares[sq];
      if (piece) cell.innerHTML = `<span class="piece ${piece === piece.toUpperCase() ? 'piece-w' : 'piece-b'}">${GLYPH[piece]}</span>`;
      if (f === 'a') cell.insertAdjacentHTML('beforeend', `<i class="coord coord-rank">${r}</i>`);
      if (r === 1) cell.insertAdjacentHTML('beforeend', `<i class="coord coord-file">${f}</i>`);
      board.appendChild(cell);
    }
  }
  host.appendChild(board);
  // Check (+) and mate (#) marks are left off the buttons: they'd give the answer away, and nobody should miss
  // a question over notation.
  const opts = optionList(host, q.options.map((o) => ({ value: o, label: o.replace(/[+#]+$/, '') })), q.answer, (picked) => {
    opts.mark(picked);
    onAnswer(picked);
  });
  return {
    async reveal() {
      if (!q.move) return;
      const from = board.querySelector<HTMLElement>(`[data-sq="${q.move.from}"]`)!;
      const to = board.querySelector<HTMLElement>(`[data-sq="${q.move.to}"]`)!;
      const piece = from.querySelector<HTMLElement>('.piece');
      from.classList.add('sq-from');
      to.classList.add('sq-to');
      if (!piece) return;
      if (!reduced()) {
        // Slide the piece to its new square.
        const a = from.getBoundingClientRect();
        const b = to.getBoundingClientRect();
        piece.style.transition = 'transform 0.45s ease';
        piece.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px)`;
        await wait(470);
        piece.style.transition = '';
        piece.style.transform = '';
      }
      to.querySelector('.piece')?.remove();
      to.prepend(piece);
    },
  };
}

// ----- basketball read -----

function play(q: Question, host: HTMLElement, onAnswer: (picked: string) => void): Rendered {
  const p = q.play!;
  const all = [...p.offense, ...p.defense];
  const at = (id: string) => all.find((x) => x.id === id)!;
  const handler = p.offense.find((o) => o.ball)!;
  const NS = 'http://www.w3.org/2000/svg';
  const wrap = document.createElement('div');
  wrap.className = 'court-diagram';
  const describe = `Half-court diagram. You have the ball as ${handler.id}. Teammates: ${q.options.map((o) => `${o}, ${p.labels[o]}`).join('; ')}.`;
  wrap.innerHTML = `<svg viewBox="-1 -1 52 40" role="img" aria-label="${esc(describe)}">
    <defs><marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker></defs>
    <rect x="0" y="0" width="50" height="38" class="court-floor"/>
    <rect x="17" y="0" width="16" height="19" class="court-paint"/>
    <circle cx="25" cy="19" r="6" class="court-line"/>
    <path d="M3 0 V14 A23.75 23.75 0 0 0 47 14 V0" class="court-line"/>
    <line x1="22" y1="4" x2="28" y2="4" class="court-board"/>
    <circle cx="25" cy="5.25" r="0.9" class="court-rim"/>
    ${(p.arrows ?? [])
      .map((a) => {
        const f = at(a.from);
        return `<line x1="${f.x}" y1="${f.y}" x2="${a.to[0]}" y2="${a.to[1]}" class="court-arrow${a.style === 'dashed' ? ' is-dashed' : ''}" marker-end="url(#arrowhead)"/>`;
      })
      .join('')}
    <line class="court-pass" x1="${handler.x}" y1="${handler.y}" x2="${handler.x}" y2="${handler.y}" marker-end="url(#arrowhead)" visibility="hidden"/>
    ${p.defense.map((d) => `<text x="${d.x}" y="${d.y}" class="court-x">X</text>`).join('')}
    ${p.offense
      .map((o) => {
        const pickable = q.options.includes(o.id) && !o.ball;
        return `<g class="court-o${o.ball ? ' has-ball' : ''}${pickable ? ' is-pickable' : ''}" data-player="${o.id}" ${pickable ? `tabindex="0" role="button" aria-label="Pass to ${o.id}, ${esc(p.labels[o.id] ?? '')}"` : ''}>
          <circle cx="${o.x}" cy="${o.y}" r="${o.ball ? 2.3 : 1.9}"/><text x="${o.x}" y="${o.y}">${o.id.slice(1)}</text></g>`;
      })
      .join('')}
  </svg>
  <p class="court-key"><b>O</b> your team · <b>X</b> defense · filled circle has the ball</p>`;
  host.appendChild(wrap);
  const svg = wrap.querySelector('svg')!;
  void NS;

  let answered = false;
  const pick = (id: string) => {
    if (answered) return;
    answered = true;
    opts.mark(id);
    onAnswer(id);
  };
  // Tap a teammate on the diagram, or use the buttons underneath (easier on small screens).
  svg.addEventListener('click', (e) => {
    const g = (e.target as Element).closest<SVGGElement>('.is-pickable');
    if (g) pick(g.dataset.player!);
  });
  svg.addEventListener('keydown', (e) => {
    const g = (e.target as Element).closest<SVGGElement>('.is-pickable');
    if (g && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      pick(g.dataset.player!);
    }
  });
  const opts = optionList(host, q.options.map((o) => ({ value: o, label: o === handler.id ? p.labels[o] : `${o} · ${p.labels[o]}` })), q.answer, pick);
  return {
    async reveal() {
      svg.querySelector(`[data-player="${q.answer}"]`)?.classList.add('is-answer');
      const target = at(q.answer);
      if (target.id === handler.id) return;
      const line = svg.querySelector<SVGLineElement>('.court-pass')!;
      // Stop the pass line short of the receiver so the arrowhead doesn't cover the number.
      const dx = target.x - handler.x;
      const dy = target.y - handler.y;
      const len = Math.hypot(dx, dy) || 1;
      line.setAttribute('x2', String(target.x - (dx / len) * 2.6));
      line.setAttribute('y2', String(target.y - (dy / len) * 2.6));
      line.setAttribute('visibility', 'visible');
      await wait(reduced() ? 0 : 500);
    },
  };
}

// ----- multiple choice -----

function choice(q: Question, host: HTMLElement, onAnswer: (picked: string) => void): Rendered {
  if (q.board) {
    const table = document.createElement('table');
    table.className = 'odds-board';
    table.innerHTML = `<caption class="visually-hidden">Odds for the same bet at three books</caption><tbody>${q.board.map((b) => `<tr><th scope="row">${esc(b.book)}</th><td>${esc(b.odds)}</td></tr>`).join('')}</tbody>`;
    host.appendChild(table);
  }
  const opts = optionList(host, q.options.map((o) => ({ value: o, label: o })), q.answer, (picked) => {
    opts.mark(picked);
    onAnswer(picked);
  });
  return { reveal: async () => {} };
}

// ----- rivalry round -----

// Team names and colors only. No logos.
const TEAM_COLORS: Record<string, [string, string]> = {
  UCLA: ['#2774ae', '#ffd100'],
  USC: ['#990000', '#ffc72c'],
  Lakers: ['#552583', '#fdb927'],
  Knicks: ['#006bb6', '#f58426'],
  Rams: ['#003594', '#ffa300'],
  '49ers': ['#aa0000', '#b3995d'],
};

function rivalry(q: Question, host: HTMLElement, onAnswer: (picked: string) => void): Rendered {
  const wrap = document.createElement('div');
  wrap.className = 'rivalry';
  wrap.innerHTML =
    q
      .matchups!.map(
        (m, i) => `<div class="matchup" data-matchup="${i}" role="group" aria-label="${esc(m.a)} or ${esc(m.b)}">
        ${[m.a, m.b]
          .map((team) => {
            const [bg, fg] = TEAM_COLORS[team] ?? ['#374151', '#ffffff'];
            return `<button type="button" class="team" data-team="${esc(team)}" aria-pressed="false" style="--team:${bg};--team-ink:${fg}">${esc(team)}</button>`;
          })
          .join('<span class="vs" aria-hidden="true">vs</span>')}
      </div>`,
      )
      .join('') + `<button type="button" class="btn btn-primary rivalry-lock" disabled>Lock it in</button>`;
  host.appendChild(wrap);
  const picks: (string | null)[] = q.matchups!.map(() => null);
  const lock = wrap.querySelector<HTMLButtonElement>('.rivalry-lock')!;
  let locked = false;
  wrap.addEventListener('click', (e) => {
    if (locked) return;
    const team = (e.target as HTMLElement).closest<HTMLButtonElement>('.team');
    if (team) {
      const row = team.closest<HTMLElement>('.matchup')!;
      picks[Number(row.dataset.matchup)] = team.dataset.team!;
      row.querySelectorAll('.team').forEach((b) => b.setAttribute('aria-pressed', String(b === team)));
      lock.disabled = picks.some((p) => !p);
    } else if ((e.target as HTMLElement).closest('.rivalry-lock') && !lock.disabled) {
      locked = true;
      lock.hidden = true;
      wrap.querySelectorAll<HTMLButtonElement>('.team').forEach((b) => (b.disabled = true));
      onAnswer(picks.join(', '));
    }
  });
  queueMicrotask(() => wrap.querySelector<HTMLButtonElement>('.team')?.focus({ preventScroll: true }));
  return {
    async reveal() {
      // One matchup at a time, for drama.
      for (const [i, m] of q.matchups!.entries()) {
        await wait(reduced() ? 0 : 520);
        const row = wrap.querySelector<HTMLElement>(`[data-matchup="${i}"]`)!;
        row.classList.add(picks[i] === m.answer ? 'is-right' : 'is-wrong');
        row.querySelector(`[data-team="${m.answer}"]`)?.classList.add('is-answer');
      }
    },
  };
}

export function renderQuestion(q: Question, host: HTMLElement, onAnswer: (picked: string) => void): Rendered {
  switch (q.type) {
    case 'chess':
      return chess(q, host, onAnswer);
    case 'play':
      return play(q, host, onAnswer);
    case 'rivalry':
      return rivalry(q, host, onAnswer);
    default:
      return choice(q, host, onAnswer);
  }
}
