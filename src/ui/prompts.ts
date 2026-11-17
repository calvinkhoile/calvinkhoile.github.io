import { hide, show } from './motion';

/** "E · Rewards Store" proximity prompt. It floats over the object and doubles as a screen-reader announcement. */
export class Prompt {
  private readonly el: HTMLElement;
  private readonly key: HTMLElement;
  private readonly label: HTMLElement;
  private readonly live: HTMLElement;
  private current: string | null = null;
  /** Called when the prompt itself is clicked or tapped. */
  onActivate: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'prompt';
    this.el.hidden = true;
    this.el.innerHTML = `<span class="prompt-key" aria-hidden="true"></span><span class="prompt-label" aria-hidden="true"></span>`;
    this.live = document.createElement('p');
    this.live.className = 'visually-hidden';
    this.live.setAttribute('aria-live', 'polite');
    root.append(this.el, this.live);
    this.el.addEventListener('click', () => this.onActivate?.());
    this.key = this.el.querySelector('.prompt-key')!;
    this.label = this.el.querySelector('.prompt-label')!;
  }

  /** Show `label` at a screen position, or hide when label is null. */
  set(label: string | null, x = 0, y = 0): void {
    if (label === null) {
      if (this.current !== null) {
        this.current = null;
        void hide(this.el);
        this.live.textContent = '';
      }
      return;
    }
    const touch = document.body.classList.contains('is-touch');
    if (label !== this.current) {
      this.current = label;
      this.key.textContent = touch ? '●' : 'E';
      this.label.textContent = label;
      this.live.textContent = `${label}. ${touch ? 'Tap A' : 'Press E'} to open.`;
      show(this.el);
    }
    this.el.style.transform = `translate(-50%, -100%) translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
}
