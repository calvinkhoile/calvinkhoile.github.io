// Big arcade callouts over the court ("GREEN", "REJECTED", "SLAM") and a short screen shake.
// Purely visual: the scoreboard, the counter, and the screen-reader live regions carry the actual result.

export type Tone = 'good' | 'bad' | 'hype';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let host: HTMLElement | null = null;

function root(): HTMLElement {
  if (host) return host;
  host = document.createElement('div');
  host.className = 'callouts';
  host.setAttribute('aria-hidden', 'true');
  document.getElementById('ui')?.appendChild(host) ?? document.body.appendChild(host);
  return host;
}

/** Pop a word over the action. `sub` is a smaller line under it. */
export function callout(text: string, tone: Tone = 'good', sub = ''): void {
  const el = document.createElement('div');
  el.className = `callout callout--${tone}`;
  el.innerHTML = `<span class="callout-main"></span>${sub ? '<span class="callout-sub"></span>' : ''}`;
  el.querySelector('.callout-main')!.textContent = text;
  if (sub) el.querySelector('.callout-sub')!.textContent = sub;
  const r = root();
  // One at a time: a new callout replaces the last.
  r.replaceChildren(el);
  window.setTimeout(() => el.remove(), reduced() ? 900 : 1300);
}

/** A quick shake of the world (not the UI). Skipped with reduced motion. */
export function shake(strength: 'soft' | 'hard' = 'soft'): void {
  if (reduced()) return;
  const canvas = document.querySelector<HTMLElement>('canvas');
  if (!canvas) return;
  canvas.classList.remove('shake-soft', 'shake-hard');
  void canvas.offsetWidth;
  canvas.classList.add(`shake-${strength}`);
  window.setTimeout(() => canvas.classList.remove(`shake-${strength}`), 400);
}
