export interface TrackerItem {
  id: string;
  label: string;
  done: boolean;
}

/**
 * Progress tracker for the place the visitor is in ("BetMGM Gym · 2/4 stations"). Sits with the quick links,
 * collapsed by default. Expanded, it lists each stop (tap one to jump to it) and offers to skip the walking.
 */
export class Tracker {
  private readonly el: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private key = '';

  constructor(
    host: HTMLElement,
    private readonly handlers: { onJump(id: string): void; onSkipAll(): void; onFinish(): void },
  ) {
    this.el = document.createElement('div');
    this.el.className = 'tracker';
    this.el.hidden = true;
    this.el.innerHTML = `<button type="button" class="station-counter" id="station-counter" aria-expanded="false" aria-controls="tracker-panel"></button>
      <div class="tracker-panel" id="tracker-panel" hidden></div>`;
    host.appendChild(this.el);
    this.button = this.el.querySelector('button')!;
    this.panel = this.el.querySelector('.tracker-panel')!;

    this.button.addEventListener('click', () => this.setOpen(this.panel.hidden));
    this.panel.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const jump = t.closest<HTMLElement>('[data-jump]');
      if (jump) {
        this.setOpen(false);
        this.handlers.onJump(jump.dataset.jump!);
      } else if (t.closest('.tracker-finish')) {
        this.setOpen(false);
        this.handlers.onFinish();
      } else if (t.closest('.tracker-skip')) {
        this.setOpen(false);
        this.handlers.onSkipAll();
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && !this.panel.hidden) this.setOpen(false);
    });
  }

  get isOpen(): boolean {
    return !this.panel.hidden;
  }

  setOpen(open: boolean): void {
    this.panel.hidden = !open;
    this.button.setAttribute('aria-expanded', String(open));
  }

  /** Show progress for a place, or hide the tracker with null. */
  set(place: string | null, items: TrackerItem[] = []): void {
    const key = place ? `${place}|${items.map((i) => `${i.id}${i.done ? 1 : 0}`).join()}` : '';
    if (key === this.key) return;
    this.key = key;
    if (!place) {
      this.el.hidden = true;
      this.setOpen(false);
      return;
    }
    const done = items.filter((i) => i.done).length;
    this.el.hidden = false;
    this.button.textContent = `${place} · ${done}/${items.length} stations${done === items.length ? ' ✓' : ''}`;
    this.panel.innerHTML = `<ul class="tracker-list">${items
      .map((i) => `<li><button type="button" class="tracker-item${i.done ? ' is-done' : ''}" data-jump="${i.id}"><span aria-hidden="true">${i.done ? '✓' : '○'}</span>${i.label}<span class="visually-hidden">${i.done ? ', visited' : ', not visited'}. Jump there.</span></button></li>`)
      .join('')}</ul>
      <button type="button" class="tracker-skip">Skip the walk: see all ${items.length} →</button>
      ${done < items.length ? `<button type="button" class="tracker-finish">Finish ${place === 'The Weightroom' ? 'the Weightroom' : 'this gym'} now</button>` : ''}`;
  }
}
