import { hide, show } from './motion';

/** Full-screen photo viewer. Any image inside a card opens here on click or tap. */
export class Lightbox {
  private readonly el: HTMLElement;
  private readonly img: HTMLImageElement;
  private returnFocus: HTMLElement | null = null;
  private closing = false;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'lightbox';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', 'Photo');
    this.el.innerHTML = `<button class="lightbox-close" type="button" aria-label="Close photo">✕</button><figure class="lightbox-figure"><img class="lightbox-img" alt="" /><figcaption class="lightbox-caption"></figcaption></figure>`;
    root.appendChild(this.el);
    this.img = this.el.querySelector('img')!;
    this.el.addEventListener('click', () => this.close());
    // Capture phase so Esc closes the photo before the card underneath sees it.
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.isOpen) return;
        if (e.code === 'Escape') {
          e.stopPropagation();
          e.preventDefault();
          this.close();
        } else if (e.code === 'Tab' || e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
          // The close button is the only control: keep focus here and keep keys off the card underneath.
          e.stopPropagation();
          e.preventDefault();
          (this.el.querySelector('.lightbox-close') as HTMLElement).focus();
        }
      },
      true,
    );
  }

  get isOpen(): boolean {
    return !this.el.hidden && !this.closing;
  }

  open(src: string, alt = '', caption = ''): void {
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.img.src = src;
    this.img.alt = alt;
    const cap = this.el.querySelector('.lightbox-caption') as HTMLElement;
    cap.textContent = caption;
    cap.hidden = !caption;
    // Captioned photos (station props) are shown a little smaller, like a framed print.
    this.el.classList.toggle('lightbox--captioned', !!caption);
    this.closing = false;
    show(this.el, { replay: true });
    (this.el.querySelector('.lightbox-close') as HTMLElement).focus({ preventScroll: true });
  }

  close(): void {
    if (!this.isOpen) return;
    this.closing = true;
    this.returnFocus?.focus?.({ preventScroll: true });
    this.onClose?.();
    void hide(this.el).then(() => {
      this.closing = false;
      this.img.removeAttribute('src');
    });
  }

  /** Called after the photo closes (used when a photo is opened on its own, outside a card). */
  onClose: (() => void) | null = null;
}
