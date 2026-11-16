import type { QualityTier } from '../engine/quality';

export interface SettingsState {
  sfx: boolean;
  music: boolean;
  /** 0 to 100. */
  volume: number;
  quality: QualityTier | 'auto';
}

/** Settings menu: sound, music, volume, graphics quality, and reset. Opened from the gear button. */
export class Settings {
  private readonly el: HTMLElement;
  private returnFocus: HTMLElement | null = null;

  constructor(
    root: HTMLElement,
    private readonly get: () => SettingsState,
    private readonly on: {
      sfx(on: boolean): void;
      music(on: boolean): void;
      volume(v: number): void;
      quality(q: QualityTier | 'auto'): void;
      reset(): void;
      toggle(open: boolean): void;
    },
  ) {
    this.el = document.createElement('div');
    this.el.className = 'badge-panel settings-panel';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', 'Settings');
    root.appendChild(this.el);

    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === this.el || t.closest('.badge-panel-close')) return this.close();
      const sw = t.closest<HTMLButtonElement>('[data-switch]');
      if (sw) {
        const next = sw.getAttribute('aria-checked') !== 'true';
        if (sw.dataset.switch === 'sfx') this.on.sfx(next);
        else this.on.music(next);
        return this.render();
      }
      const q = t.closest<HTMLButtonElement>('[data-quality]');
      if (q) {
        this.on.quality(q.dataset.quality as QualityTier | 'auto');
        return this.render();
      }
      const reset = t.closest<HTMLButtonElement>('.badge-reset');
      if (reset) {
        if (reset.dataset.armed) this.on.reset();
        else {
          reset.dataset.armed = '1';
          reset.textContent = 'Tap again to clear everything';
        }
      }
    });
    this.el.addEventListener('input', (e) => {
      const range = e.target as HTMLInputElement;
      if (range.id === 'settings-volume') this.on.volume(Number(range.value));
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && !this.el.hidden) {
        e.preventDefault();
        this.close();
      }
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  private render(): void {
    const s = this.get();
    const sw = (id: 'sfx' | 'music', label: string, on: boolean) =>
      `<div class="settings-row"><span id="settings-${id}-label">${label}</span>
        <button type="button" class="switch" role="switch" data-switch="${id}" aria-checked="${on}" aria-labelledby="settings-${id}-label"><span></span></button></div>`;
    const tiers: [QualityTier | 'auto', string][] = [['auto', 'Auto'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']];
    const keep = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.switch ?? document.activeElement.dataset.quality : undefined;
    this.el.innerHTML = `<div class="badge-sheet">
      <header class="badge-panel-head"><h2>Settings</h2><button type="button" class="card-close badge-panel-close" aria-label="Close settings">✕</button></header>
      ${sw('sfx', 'Sound effects', s.sfx)}
      ${sw('music', 'Music', s.music)}
      <div class="settings-row"><label for="settings-volume">Volume</label><input id="settings-volume" type="range" min="0" max="100" step="5" value="${s.volume}" /></div>
      <div class="settings-row settings-row--stack"><span id="settings-quality-label">Graphics</span>
        <div class="segmented" role="group" aria-labelledby="settings-quality-label">
          ${tiers.map(([v, label]) => `<button type="button" data-quality="${v}" aria-pressed="${s.quality === v}">${label}</button>`).join('')}
        </div>
        <p class="settings-note">Auto picks for your device and steps down if it struggles.</p>
      </div>
      <button type="button" class="badge-reset">Reset progress</button>
    </div>`;
    // Re-rendering replaces the buttons, so put focus back where it was.
    if (keep) this.el.querySelector<HTMLElement>(`[data-switch="${keep}"], [data-quality="${keep}"]`)?.focus({ preventScroll: true });
  }

  open(): void {
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.el.hidden = false;
    this.render();
    this.on.toggle(true);
    (this.el.querySelector('.badge-panel-close') as HTMLElement).focus({ preventScroll: true });
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.on.toggle(false);
    this.returnFocus?.focus?.({ preventScroll: true });
  }
}
