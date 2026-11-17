import { badges, type Badge } from '../content/badges';
import { trapTab } from './focus';
import { hide, isLeaving, show } from './motion';

const medal = (b: Badge, cls = '') =>
  `<span class="medal ${cls}" style="--medal:${b.color};--medal-accent:${b.accent}" aria-hidden="true"><span>${b.glyph}</span></span>`;

/** Badge case (HUD, top-left), its panel, and the award ceremony. */
export class BadgeUi {
  private readonly caseBtn: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private readonly ceremonyEl: HTMLElement;
  private owned: ReadonlySet<string> = new Set();
  private returnFocus: HTMLElement | null = null;

  constructor(
    root: HTMLElement,
    caseHost: HTMLElement,
    private readonly opts: { reducedMotion: boolean; onReset(): void; onToggle(open: boolean): void; onJump(route: string): void },
  ) {
    this.caseBtn = document.createElement('button');
    this.caseBtn.type = 'button';
    this.caseBtn.className = 'badge-case';
    this.caseBtn.id = 'badge-case';
    this.caseBtn.setAttribute('aria-haspopup', 'dialog');

    this.panel = document.createElement('div');
    this.panel.className = 'badge-panel';
    this.panel.hidden = true;
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-modal', 'true');
    this.panel.setAttribute('aria-label', 'Badges');

    this.ceremonyEl = document.createElement('div');
    this.ceremonyEl.className = 'ceremony';
    this.ceremonyEl.hidden = true;
    this.ceremonyEl.setAttribute('role', 'dialog');
    this.ceremonyEl.setAttribute('aria-modal', 'true');
    caseHost.appendChild(this.caseBtn);
    root.append(this.panel, this.ceremonyEl);

    // A panel still fading out counts as closed, so a quick second click reopens it instead of doing nothing.
    this.caseBtn.addEventListener('click', () => (this.panelOpen ? this.closePanel() : this.openPanel()));
    this.panel.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === this.panel || t.closest('.badge-panel-close')) return this.closePanel();
      const go = t.closest<HTMLElement>('[data-go]');
      if (go) {
        this.closePanel();
        this.opts.onJump(go.dataset.go!);
        return;
      }
      const reset = t.closest<HTMLButtonElement>('.badge-reset');
      if (!reset) return;
      // Two taps, so progress can't be wiped by accident.
      if (reset.dataset.armed) this.opts.onReset();
      else {
        reset.dataset.armed = '1';
        reset.textContent = `${document.body.classList.contains('is-touch') ? 'Tap' : 'Click'} again to clear everything`;
      }
    });
    window.addEventListener('keydown', (e) => {
      if (this.panel.hidden) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        this.closePanel();
      } else trapTab(this.panel, e);
    });
    this.refresh(this.owned);
  }

  get panelOpen(): boolean {
    return !this.panel.hidden && !isLeaving(this.panel);
  }

  refresh(owned: ReadonlySet<string>): void {
    this.owned = owned;
    const count = badges.filter((b) => owned.has(b.id)).length;
    this.caseBtn.setAttribute('aria-label', `Badges: ${count} of ${badges.length} earned. Open badge case.`);
    // A count up front, so the row of empty circles reads as "badges to collect".
    this.caseBtn.innerHTML = `<span class="badge-count" aria-hidden="true">${count}/${badges.length}</span>` + badges.map((b) => medal(b, owned.has(b.id) ? 'is-earned' : '')).join('');
    if (!this.panel.hidden) this.renderPanel();
  }

  private renderPanel(): void {
    const count = badges.filter((b) => this.owned.has(b.id)).length;
    this.panel.innerHTML = `<div class="badge-sheet">
      <header class="badge-panel-head">
        <h2>Badges <span>${count}/${badges.length}</span></h2>
        <button type="button" class="card-close badge-panel-close" aria-label="Close badges">✕</button>
      </header>
      <ul class="badge-list">
        ${badges
          .map((b) => {
            const earned = this.owned.has(b.id);
            // Every badge has a shortcut to the place that awards it.
            const route = b.scene ? `gym/${b.id}` : b.id === 'explorer' ? 'weightroom' : 'court';
            const gym: Record<string, string> = { ucla: 'UCLA', deloitte: 'Deloitte', meta: 'Meta', betmgm: 'BetMGM' };
            const where = b.scene ? `Jump to ${gym[b.id] ?? 'the gym'}` : b.id === 'explorer' ? 'Jump to the Weightroom' : 'Jump to the court';
            return `<li class="badge-row${earned ? ' is-earned' : ''}">${medal(b, earned ? 'is-earned' : '')}
              <div><strong>${b.name}</strong><p>${earned ? 'Earned ✓' : b.how}</p></div>
              <button type="button" class="badge-go" data-go="${route}">${where} →</button></li>`;
          })
          .join('')}
      </ul>
      <button type="button" class="badge-reset">Reset progress</button>
    </div>`;
  }

  private openPanel(): void {
    this.returnFocus = document.activeElement as HTMLElement | null;
    show(this.panel);
    this.renderPanel();
    this.opts.onToggle(true);
    (this.panel.querySelector('.badge-panel-close') as HTMLElement).focus({ preventScroll: true });
  }

  closePanel(): void {
    if (this.panel.hidden || isLeaving(this.panel)) return;
    void hide(this.panel);
    this.opts.onToggle(false);
    this.returnFocus?.focus?.({ preventScroll: true });
  }

  /** Badge spins up with confetti. Resolves when the visitor continues. */
  ceremony(badge: Badge): Promise<void> {
    const confetti = this.opts.reducedMotion
      ? ''
      : Array.from({ length: 36 }, (_, i) => {
          const hue = [badge.accent, badge.color, '#ffffff', '#fbbf24'][i % 4];
          return `<i style="--x:${(Math.random() * 100).toFixed(1)}%;--d:${(Math.random() * 0.6).toFixed(2)}s;--r:${Math.round(Math.random() * 360)}deg;--c:${hue}"></i>`;
        }).join('');
    this.ceremonyEl.setAttribute('aria-label', `${badge.name} earned`);
    this.ceremonyEl.innerHTML = `<div class="ceremony-confetti" aria-hidden="true">${confetti}</div>
      <div class="ceremony-body">
        ${medal(badge, 'is-earned medal--big')}
        <p class="ceremony-kicker">Badge earned</p>
        <h2 class="ceremony-name">${badge.name}</h2>
        <button type="button" class="btn btn-primary ceremony-continue">Continue</button>
      </div>`;
    show(this.ceremonyEl, { replay: true });
    navigator.vibrate?.([30, 40, 60]);
    const button = this.ceremonyEl.querySelector('.ceremony-continue') as HTMLButtonElement;
    button.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowRight' && !this.ceremonyEl.hidden) button.click();
    };
    window.addEventListener('keydown', onKey);
    return new Promise((resolve) => {
      button.addEventListener(
        'click',
        () => {
          window.removeEventListener('keydown', onKey);
          void hide(this.ceremonyEl).then(() => this.ceremonyEl.replaceChildren());
          resolve();
        },
        { once: true },
      );
    });
  }
}
