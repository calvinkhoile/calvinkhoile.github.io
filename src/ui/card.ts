import type { Screen } from '../content/career';
import type { Lightbox } from './lightbox';

// Project card overlay: the most-viewed UI in the game. Desktop: a large panel over a dimmed, blurred world.
// Mobile: a full-screen sheet that slides up, swipe down on the header to dismiss.
// The rendering is ported from the classic site's renderDetail() and supports every screen type it had.

export interface CardModel {
  /** Stable id (station id or content key), exposed as data-card for tests and deep links. */
  id: string;
  logo?: string;
  tag?: string;
  title: string;
  subtitle?: string;
  /** Progress chip, e.g. "2/4 stations". */
  chip?: string;
  paragraphs: string[];
  list?: { label?: string; items: string[] };
  /** Jump links to other stations ("Find it in the gym"). */
  links?: { label: string; target: string }[];
  screens: Screen[];
  initialTab?: number;
  sidePhoto?: string;
  sidePhotoWide?: boolean;
  sideGallery?: string[];
  tags?: string[];
  /** Shows a work-in-progress strip. */
  wip?: boolean;
  footer?: { label: string; action: string };
  footerNote?: string;
}

export interface CardHandlers {
  onLink?(target: string): void;
  onFooter?(action: string): void;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Content strings are plain text, except timeline roles, which may carry a <br>. */
const escBr = (s: string) => esc(s).replace(/&lt;br\s*\/?&gt;/g, '<br>');
const photo = (src: string, alt = '', cls = '') => `<img class="card-photo ${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" data-zoom />`;

function galleryHTML(photos: string[]): string {
  const multi = photos.length > 1;
  return `<div class="gallery" data-gallery>
    <div class="gallery-viewport"><div class="gallery-track">
      ${photos.map((src, i) => `<div class="gallery-slide">${photo(src, `Photo ${i + 1} of ${photos.length}`)}</div>`).join('')}
    </div></div>
    ${
      multi
        ? `<button class="gallery-arrow gallery-prev" type="button" aria-label="Previous photo">‹</button>
           <button class="gallery-arrow gallery-next" type="button" aria-label="Next photo">›</button>
           <div class="gallery-dots">${photos.map((_, i) => `<button type="button" class="gallery-dot${i === 0 ? ' is-on' : ''}" data-i="${i}" aria-label="Photo ${i + 1}"></button>`).join('')}</div>`
        : ''
    }
  </div>`;
}

function zoomWrap(base: string, hover: string, pos: string | undefined, alt: string, maxWidth?: string): string {
  return `<button type="button" class="zoom" ${maxWidth ? `style="max-width:${esc(maxWidth)}"` : ''} aria-label="Show detail: ${esc(alt)}" data-zoomspot>
    <img class="card-photo" src="${esc(base)}" alt="${esc(alt)}" loading="lazy" />
    <img class="zoom-detail" src="${esc(hover)}" style="top:${esc(pos ?? '8%')}" alt="" loading="lazy" />
    <span class="zoom-hint" aria-hidden="true">Tap to zoom</span>
  </button>`;
}

function screenHTML(s: Screen): string {
  let visual = '';
  if (s.before && s.after) {
    visual = `<div class="ba" style="--pos:50%" data-ba>
      <img class="ba-img" src="${esc(s.after)}" alt="After" loading="lazy" />
      <div class="ba-clip"><img class="ba-img" src="${esc(s.before)}" alt="Before" loading="lazy" /></div>
      <div class="ba-handle" aria-hidden="true"><span></span></div>
      <span class="ba-tag ba-tag-before" aria-hidden="true">Before</span>
      <span class="ba-tag ba-tag-after" aria-hidden="true">After</span>
      <input class="ba-range" type="range" min="0" max="100" value="50" aria-label="Drag to compare before and after" />
    </div>`;
  } else if (s.left && s.right) {
    const left = s.leftHover ? zoomWrap(s.left, s.leftHover, s.leftHoverPos, s.leftLabel ?? 'Left') : photo(s.left, s.leftLabel ?? '');
    visual = `<div class="compare">
      <figure class="compare-side"><figcaption>${esc(s.leftLabel ?? 'Left')}</figcaption>${left}</figure>
      <figure class="compare-side"><figcaption>${esc(s.rightLabel ?? 'Right')}</figcaption>${photo(s.right, s.rightLabel ?? '')}</figure>
    </div>`;
  } else if (s.img && s.imgHover) {
    visual = `<div class="single">${zoomWrap(s.img, s.imgHover, s.imgHoverPos, s.label, s.imgWidth)}</div>`;
  } else if (s.img) {
    visual = `<div class="single">${photo(s.img, s.label).replace('<img ', `<img ${s.imgWidth ? `style="max-width:min(100%, ${esc(s.imgWidth)})"` : ''} `)}</div>`;
  } else if (s.gallery) {
    visual = galleryHTML(s.gallery);
  }
  const caption = s.caption ? `<p class="card-caption">${esc(s.caption)}</p>` : '';
  const bullets = s.bullets ? `<ul class="card-bullets">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : '';
  const timeline = s.timeline
    ? `<ol class="timeline">${s.timeline
        .map((t) => `<li class="timeline-item"><div class="timeline-period">${esc(t.period)}</div><div class="timeline-company">${esc(t.company)}</div><div class="timeline-role">${escBr(t.role)}</div></li>`)
        .join('')}</ol>`
    : '';
  // Photos beside text when there's a list to read, otherwise stacked.
  if (s.gallery && (s.bullets || s.timeline)) {
    return `<div class="screen-split"><div class="screen-split-visual">${visual}${caption}</div><div class="screen-split-text">${bullets}${timeline}</div></div>`;
  }
  return `${visual}${caption}${bullets}${timeline}`;
}

export class CardOverlay {
  private readonly overlay: HTMLElement;
  private readonly card: HTMLElement;
  private handlers: CardHandlers = {};
  private resolve: (() => void) | null = null;
  private returnFocus: HTMLElement | null = null;
  private model: CardModel | null = null;

  constructor(
    root: HTMLElement,
    private readonly lightbox: Lightbox,
  ) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'card-overlay';
    this.overlay.hidden = true;
    this.card = document.createElement('div');
    this.card.className = 'card';
    this.card.setAttribute('role', 'dialog');
    this.card.setAttribute('aria-modal', 'true');
    this.card.setAttribute('aria-labelledby', 'card-title');
    this.overlay.appendChild(this.card);
    root.appendChild(this.overlay);

    this.overlay.addEventListener('pointerdown', (e) => {
      if (e.target === this.overlay) this.close();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.model) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.code === 'Tab') {
        this.trapFocus(e);
      }
    });
    this.card.addEventListener('click', (e) => this.onClick(e));
    this.card.addEventListener('input', (e) => {
      const range = e.target as HTMLInputElement;
      if (range.classList.contains('ba-range')) (range.closest('[data-ba]') as HTMLElement).style.setProperty('--pos', `${range.value}%`);
    });
    this.bindSwipes();
  }

  get isOpen(): boolean {
    return this.model !== null;
  }

  get currentId(): string | null {
    return this.model?.id ?? null;
  }

  /** Open a card. Resolves when it closes. */
  open(model: CardModel, handlers: CardHandlers = {}): Promise<void> {
    if (this.model) this.finish();
    this.model = model;
    this.handlers = handlers;
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.render(model);
    this.overlay.hidden = false;
    this.card.scrollTop = 0;
    document.body.classList.add('has-card');
    (this.card.querySelector('.card-close') as HTMLElement).focus({ preventScroll: true });
    return new Promise((resolve) => (this.resolve = resolve));
  }

  close(): void {
    if (this.model) this.finish();
  }

  private finish(): void {
    this.model = null;
    this.overlay.hidden = true;
    this.card.replaceChildren();
    document.body.classList.remove('has-card');
    this.returnFocus?.focus?.({ preventScroll: true });
    const resolve = this.resolve;
    this.resolve = null;
    resolve?.();
  }

  private render(m: CardModel): void {
    const side = m.sidePhoto
      ? `<div class="card-side${m.sidePhotoWide ? ' card-side--wide' : ''}">${photo(m.sidePhoto, m.title)}</div>`
      : m.sideGallery
        ? `<div class="card-side">${galleryHTML(m.sideGallery)}</div>`
        : '';
    const tabs =
      m.screens.length > 1
        ? `<div class="card-tabs" role="tablist" aria-label="Sections">${m.screens
            .map((s, i) => `<button type="button" role="tab" class="card-tab" id="card-tab-${i}" data-tab="${i}" aria-controls="card-panel-${i}">${esc(s.label)}</button>`)
            .join('')}</div>`
        : '';
    const panels = m.screens
      .map((s, i) => `<div class="card-panel" role="tabpanel" id="card-panel-${i}" aria-labelledby="card-tab-${i}" data-panel="${i}" hidden>${screenHTML(s)}</div>`)
      .join('');

    this.card.dataset.card = m.id;
    this.card.innerHTML = `
      <header class="card-header" data-swipe>
        <span class="card-grip" aria-hidden="true"></span>
        ${m.logo ? `<img class="card-logo" src="${esc(m.logo)}" alt="" />` : ''}
        <div class="card-heading">
          ${m.tag ? `<span class="card-tag">${esc(m.tag)}</span>` : ''}
          <h2 class="card-title" id="card-title">${esc(m.title)}</h2>
          ${m.subtitle ? `<p class="card-subtitle">${esc(m.subtitle)}</p>` : ''}
        </div>
        ${m.chip ? `<span class="card-chip">${esc(m.chip)}</span>` : ''}
        <button class="card-close" type="button" aria-label="Close">✕</button>
      </header>
      <div class="card-body${side ? ' card-body--side' : ''}">
        <div class="card-main">
          ${m.paragraphs.map((p) => `<p class="card-desc">${esc(p)}</p>`).join('')}
          ${m.wip ? `<div class="card-wip" role="note">Work in progress</div>` : ''}
          ${m.tags?.length ? `<ul class="card-tags">${m.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
          ${
            m.list
              ? `<div class="card-list">${m.list.label ? `<h3 class="card-label">${esc(m.list.label)}</h3>` : ''}<ul class="card-bullets">${m.list.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`
              : ''
          }
          ${
            m.links?.length
              ? `<div class="card-links"><h3 class="card-label">Find it in the gym</h3><div class="card-link-row">${m.links
                  .map((l) => `<button type="button" class="card-link" data-link="${esc(l.target)}">${esc(l.label)}</button>`)
                  .join('')}</div></div>`
              : ''
          }
          ${m.screens.length ? `<section class="card-screens">${tabs}${panels}</section>` : ''}
        </div>
        ${side}
      </div>
      ${
        m.footer || m.footerNote
          ? `<footer class="card-footer">${m.footerNote ? `<span class="card-footer-note">${esc(m.footerNote)}</span>` : ''}${
              m.footer ? `<button type="button" class="btn btn-primary card-footer-btn" data-footer="${esc(m.footer.action)}">${esc(m.footer.label)}</button>` : ''
            }</footer>`
          : ''
      }`;
    if (m.screens.length) this.showTab(Math.min(m.initialTab ?? 0, m.screens.length - 1));
  }

  private showTab(i: number): void {
    this.card.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => (p.hidden = Number(p.dataset.panel) !== i));
    this.card.querySelectorAll<HTMLElement>('[data-tab]').forEach((t) => {
      const on = Number(t.dataset.tab) === i;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
  }

  private onClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (target.closest('.card-close')) return this.close();

    const tab = target.closest<HTMLElement>('[data-tab]');
    if (tab) return this.showTab(Number(tab.dataset.tab));

    const link = target.closest<HTMLElement>('[data-link]');
    if (link) {
      const handler = this.handlers.onLink;
      const to = link.dataset.link!;
      this.close();
      handler?.(to);
      return;
    }
    const footer = target.closest<HTMLElement>('[data-footer]');
    if (footer) {
      const handler = this.handlers.onFooter;
      const action = footer.dataset.footer!;
      this.close();
      handler?.(action);
      return;
    }

    const gallery = target.closest<HTMLElement>('[data-gallery]');
    if (gallery) {
      const dot = target.closest<HTMLElement>('.gallery-dot');
      if (dot) return this.galleryGo(gallery, Number(dot.dataset.i));
      if (target.closest('.gallery-prev')) return this.galleryGo(gallery, this.galleryIndex(gallery) - 1);
      if (target.closest('.gallery-next')) return this.galleryGo(gallery, this.galleryIndex(gallery) + 1);
    }

    const spot = target.closest<HTMLElement>('[data-zoomspot]');
    if (spot) {
      spot.classList.toggle('is-zoomed');
      return;
    }
    const img = target.closest<HTMLImageElement>('img[data-zoom]');
    if (img) this.lightbox.open(img.currentSrc || img.src, img.alt);
  }

  private galleryIndex(g: HTMLElement): number {
    return Number(g.dataset.index ?? 0);
  }

  private galleryGo(g: HTMLElement, n: number): void {
    const total = g.querySelectorAll('.gallery-slide').length;
    const i = ((n % total) + total) % total;
    g.dataset.index = String(i);
    (g.querySelector('.gallery-track') as HTMLElement).style.transform = `translateX(-${i * 100}%)`;
    g.querySelectorAll('.gallery-dot').forEach((d, k) => d.classList.toggle('is-on', k === i));
  }

  /** Swipe left/right on a gallery to page it. Swipe down on the header to dismiss the sheet. */
  private bindSwipes(): void {
    let start: { x: number; y: number; gallery: HTMLElement | null; header: boolean } | null = null;
    this.card.addEventListener(
      'touchstart',
      (e) => {
        const t = e.target as HTMLElement;
        const header = !!t.closest('[data-swipe]') && !t.closest('button');
        start = { x: e.touches[0].clientX, y: e.touches[0].clientY, gallery: t.closest<HTMLElement>('[data-gallery]'), header };
      },
      { passive: true },
    );
    this.card.addEventListener(
      'touchend',
      (e) => {
        if (!start) return;
        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        const s = start;
        start = null;
        if (s.gallery && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          this.galleryGo(s.gallery, this.galleryIndex(s.gallery) + (dx < 0 ? 1 : -1));
        } else if (s.header && dy > 70 && Math.abs(dy) > Math.abs(dx)) {
          this.close();
        }
      },
      { passive: true },
    );
  }

  private trapFocus(e: KeyboardEvent): void {
    const focusable = Array.from(this.card.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])')).filter(
      (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement;
    if (!this.card.contains(active)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
