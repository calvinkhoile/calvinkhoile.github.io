import { TRAINER_LOOKS, type Look } from '../world/looks';
import type { SelectStage } from './select-stage';

// Loading, title, and character select. Plain DOM over the canvas.

// TODO(calvin): review loading tips.
const TIPS = [
  "Tip: there's a résumé button in the top right if you're in a hurry.",
  'Tip: tap or click the ground and you walk there.',
  'Tip: on a phone, push the joystick all the way to sprint.',
];

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export class Screens {
  private readonly loading = el('loading');
  private readonly bar = el('loading-bar');
  private readonly tip = el('loading-tip');
  private readonly title = el('title');
  private readonly select = el('select');
  private tipTimer = 0;

  constructor() {
    let i = 0;
    this.tip.textContent = TIPS[0];
    this.tipTimer = window.setInterval(() => {
      i = (i + 1) % TIPS.length;
      this.tip.textContent = TIPS[i];
    }, 2600);
  }

  setProgress(fraction: number): void {
    this.bar.style.transform = `scaleX(${Math.max(0.04, Math.min(1, fraction))})`;
    document.getElementById('loading-track')!.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
  }

  hideLoading(): void {
    window.clearInterval(this.tipTimer);
    this.loading.classList.add('is-done');
    window.setTimeout(() => (this.loading.hidden = true), 400);
  }

  /** Title screen. Resolves when the visitor presses Start (button, Enter, or Space). */
  showTitle(): Promise<void> {
    this.title.hidden = false;
    const start = el<HTMLButtonElement>('title-start');
    start.focus({ preventScroll: true });
    return new Promise((resolve) => {
      const go = () => {
        window.removeEventListener('keydown', onKey);
        this.title.hidden = true;
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.code !== 'Enter' && e.code !== 'Space') return;
        // Let Enter on the résumé link follow the link.
        if (document.activeElement instanceof HTMLAnchorElement) return;
        e.preventDefault();
        go();
      };
      window.addEventListener('keydown', onKey);
      start.addEventListener('click', go, { once: true });
    });
  }

  /** Character select. Arrow keys, buttons, or swipe to browse; Enter or the button confirms. */
  showSelect(stage: SelectStage, initial: number): Promise<Look> {
    this.select.hidden = false;
    const name = el('select-name');
    const dots = el('select-dots');
    const confirm = el<HTMLButtonElement>('select-confirm');
    dots.replaceChildren(...TRAINER_LOOKS.map(() => document.createElement('span')));

    const show = (i: number) => {
      stage.select(i);
      const look = TRAINER_LOOKS[stage.index];
      name.textContent = look.name;
      Array.from(dots.children).forEach((d, k) => d.classList.toggle('is-on', k === stage.index));
    };
    show(initial);
    confirm.focus({ preventScroll: true });

    return new Promise((resolve) => {
      const prev = () => show(stage.index - 1);
      const next = () => show(stage.index + 1);
      const done = () => {
        window.removeEventListener('keydown', onKey);
        this.select.removeEventListener('pointerdown', onDown);
        this.select.removeEventListener('pointerup', onUp);
        this.select.hidden = true;
        resolve(TRAINER_LOOKS[stage.index]);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') prev();
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') next();
        else if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          done();
        }
      };
      let downX: number | null = null;
      const onDown = (e: PointerEvent) => {
        downX = (e.target as HTMLElement).closest('button') ? null : e.clientX;
      };
      const onUp = (e: PointerEvent) => {
        if (downX === null) return;
        const dx = e.clientX - downX;
        downX = null;
        if (dx > 40) prev();
        else if (dx < -40) next();
      };
      window.addEventListener('keydown', onKey);
      this.select.addEventListener('pointerdown', onDown);
      this.select.addEventListener('pointerup', onUp);
      el('select-prev').onclick = prev;
      el('select-next').onclick = next;
      confirm.addEventListener('click', done, { once: true });
    });
  }
}
