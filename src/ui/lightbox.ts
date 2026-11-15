/** Full-screen photo viewer. Any image inside a card opens here on click or tap. */
export class Lightbox {
  private readonly el: HTMLElement;
  private readonly img: HTMLImageElement;
  private returnFocus: HTMLElement | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'lightbox';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', 'Photo');
    this.el.innerHTML = `<button class="lightbox-close" type="button" aria-label="Close photo">✕</button><img class="lightbox-img" alt="" />`;
    root.appendChild(this.el);
    this.img = this.el.querySelector('img')!;
    this.el.addEventListener('click', () => this.close());
    // Capture phase so Esc closes the photo before the card underneath sees it.
    window.addEventListener(
      'keydown',
      (e) => {
        if (this.isOpen && e.code === 'Escape') {
          e.stopPropagation();
          e.preventDefault();
          this.close();
        }
      },
      true,
    );
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  open(src: string, alt = ''): void {
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.img.src = src;
    this.img.alt = alt;
    this.el.hidden = false;
    (this.el.querySelector('.lightbox-close') as HTMLElement).focus({ preventScroll: true });
  }

  close(): void {
    if (!this.isOpen) return;
    this.el.hidden = true;
    this.img.removeAttribute('src');
    this.returnFocus?.focus?.({ preventScroll: true });
    this.onClose?.();
  }

  /** Called after the photo closes (used when a photo is opened on its own, outside a card). */
  onClose: (() => void) | null = null;
}
