import { companies } from '../content/career';
import { countedStations, type SceneId } from '../content/stations';
import { trapTab } from './focus';
import { hide, isLeaving, show } from './motion';

// The highlights poster: all four gyms on one sheet, latest first, each with every stop as a one-tap jump.
// Opened from the poster board in the plaza or the HUD button. Copy comes straight from the content files.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface HighlightsOptions {
  /** Jump to a route like "gym/betmgm" or "gym/betmgm/rewards-store". */
  onJump(route: string): void;
  onToggle(open: boolean): void;
  /** Station ids already seen, for the checks. */
  visited(): ReadonlySet<string>;
}

export class Highlights {
  private readonly el: HTMLElement;
  private returnFocus: HTMLElement | null = null;

  constructor(root: HTMLElement, private readonly opts: HighlightsOptions) {
    this.el = document.createElement('div');
    this.el.className = 'badge-panel highlights-panel';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', 'Highlights');
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === this.el || t.closest('.badge-panel-close')) return this.close();
      const go = t.closest<HTMLElement>('[data-go]');
      if (go) {
        this.close();
        this.opts.onJump(go.dataset.go!);
      }
    });
    window.addEventListener('keydown', (e) => {
      if (this.el.hidden) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        this.close();
      } else trapTab(this.el, e);
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden && !isLeaving(this.el);
  }

  open(): void {
    if (this.isOpen) return;
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.render();
    show(this.el);
    this.opts.onToggle(true);
    (this.el.querySelector('.hl-go') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  close(): void {
    if (this.el.hidden || isLeaving(this.el)) return;
    void hide(this.el);
    this.opts.onToggle(false);
    this.returnFocus?.focus?.({ preventScroll: true });
  }

  private render(): void {
    const seen = this.opts.visited();
    const tiles = companies
      .map((c) => {
        const stops = countedStations(`gym-${c.id}` as SceneId);
        const chips = stops
          .map((st) => {
            const done = seen.has(st.id);
            const slug = st.id.split('/')[1];
            return `<li><button type="button" class="hl-stop${done ? ' is-done' : ''}" data-go="gym/${c.id}/${esc(slug)}"><span aria-hidden="true">${done ? '✓' : '○'}</span>${esc(st.label)}<span class="visually-hidden">${done ? ', seen' : ''}</span></button></li>`;
          })
          .join('');
        return `<li class="hl-tile hl-tile--${c.id}">
          <div class="hl-head">
            <img class="hl-logo" src="${esc(c.logo)}" alt="" />
            <div><h3>${esc(c.name)}</h3><p>${esc(c.role)} · <span class="hl-years">${esc(c.years)}</span></p></div>
          </div>
          <ul class="hl-stops" aria-label="${esc(c.name)} stops">${chips}</ul>
          <button type="button" class="hl-go" data-go="gym/${c.id}">Go to the ${esc(c.name)} gym →</button>
        </li>`;
      })
      .join('');
    // TODO(calvin): review the poster's title and kicker.
    this.el.innerHTML = `<div class="badge-sheet hl-sheet">
      <header class="badge-panel-head">
        <div><p class="hl-kicker">The park in one place</p><h2>Highlights</h2></div>
        <button type="button" class="card-close badge-panel-close" aria-label="Close highlights">✕</button>
      </header>
      <ul class="hl-grid">${tiles}</ul>
    </div>`;
  }
}
