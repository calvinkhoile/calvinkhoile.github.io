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
  /**
   * The other stops in this place, shown as a strip under the header with a check on the ones already seen.
   * Tapping one swaps the card to that stop without closing it.
   */
  stations?: { id: string; label: string; done: boolean; current: boolean }[];
  /** An action starting with "swap:" changes the card in place instead of closing it. */
  footer?: { label: string; action: string };
  footerNote?: string;
}

export interface CardHandlers {
  onLink?(target: string): void;
  onFooter?(action: string): void;
  /** A station in the strip, or a "swap:" footer, was chosen. The card stays open for the caller to replace. */
  onSwap?(action: string): void;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Content strings are plain text, except timeline roles, which may carry a <br>. */
const escBr = (s: string) => esc(s).replace(/&lt;br\s*\/?&gt;/g, '<br>');
const photo = (src: string, alt = '', cls = '') => `<img class="card-photo ${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" data-zoom />`;

function galleryHTML(photos: string[]): string {
  const multi = photos.length > 1;
  return `<div class="gallery" data-gallery>
    <div class="gallery-viewport" tabindex="0" role="group" aria-label="Photos. Scroll or use the arrow keys."><div class="gallery-track">
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

function baHTML(s: Screen): string {
  return `<div class="ba" style="--pos:50%" data-ba>
      <img class="ba-img" src="${esc(s.after!)}" alt="After" loading="lazy" />
      <div class="ba-clip"><img class="ba-img" src="${esc(s.before!)}" alt="Before" loading="lazy" /></div>
      <div class="ba-handle" aria-hidden="true"><span></span></div>
      <span class="ba-tag ba-tag-before" aria-hidden="true">Before</span>
      <span class="ba-tag ba-tag-after" aria-hidden="true">After</span>
      <input class="ba-range" type="range" min="0" max="100" value="50" aria-label="Drag to compare before and after" />
    </div>`;
}

/** One column of a combined row: label, visual, caption. */
function rowItemHTML(s: Screen): string {
  let visual: string;
  let wide = false;
  if (s.before && s.after) visual = baHTML(s);
  else if (s.gallery) {
    visual = galleryHTML(s.gallery);
    wide = true;
  } else if (s.img && s.imgHover) visual = zoomWrap(s.img, s.imgHover, s.imgHoverPos, s.label, s.imgWidth);
  else {
    // Phone screenshots carry a small imgWidth. Anything else is a landscape photo and gets a wider column on phones.
    wide = !s.imgWidth || parseInt(s.imgWidth, 10) > 300;
    visual = photo(s.img!, s.label);
  }
  return `<figure class="card-row-item${wide ? ' card-row-item--wide' : ''}">
    <figcaption class="card-row-label">${esc(s.label)}</figcaption>
    <div class="card-row-visual">${visual}</div>
    ${s.caption ? `<p class="card-caption">${esc(s.caption)}</p>` : ''}
  </figure>`;
}

const hintHTML = (text: string) => `<p class="card-hint"><span aria-hidden="true">↔</span> ${esc(text)}</p>`;
const LETTERS = 'ABCDEF';

/** Side-by-side with lettered spots on the left image. Picking a spot zooms into it and swaps the caption. */
function hotspotsHTML(s: Screen): string {
  const spots = s.hotspots!;
  return `<div class="spots" data-spots>
    ${hintHTML(document.body.classList.contains('is-touch') ? 'Tap A or B to zoom in' : 'Hover or click A or B to zoom in')}
    <div class="compare">
      <figure class="compare-side"><figcaption>${esc(s.leftLabel ?? 'Left')}</figcaption>
        <div class="spots-stage">
          <img class="card-photo" src="${esc(s.left!)}" alt="${esc(s.leftLabel ?? '')}" loading="lazy" />
          ${spots.map((h, i) => `<img class="spots-detail" data-detail="${i}" src="${esc(h.detail)}" style="top:${esc(h.pos)}" alt="${esc(h.title)} detail" loading="lazy" />`).join('')}
          ${spots.map((h, i) => `<button type="button" class="spots-pin" data-spot="${i}" style="top:${esc(h.pos)}" aria-label="${LETTERS[i]}: ${esc(h.title)}">${LETTERS[i]}</button>`).join('')}
        </div>
      </figure>
      <figure class="compare-side"><figcaption>${esc(s.rightLabel ?? 'Right')}</figcaption>${photo(s.right!, s.rightLabel ?? '')}</figure>
    </div>
    <div class="spots-tabs" role="group" aria-label="Details">
      ${spots.map((h, i) => `<button type="button" class="spots-tab" data-spot="${i}"><b>${LETTERS[i]}</b> ${esc(h.title)}</button>`).join('')}
    </div>
    ${spots.map((h, i) => `<p class="card-caption spots-caption" data-caption="${i}" hidden>${esc(h.caption)}</p>`).join('')}
  </div>`;
}

function screenHTML(s: Screen): string {
  let visual = '';
  if (s.hotspots && s.left && s.right) {
    return hotspotsHTML(s);
  } else if (s.before && s.after) {
    visual = `${hintHTML('Drag the slider to compare before and after')}<div class="ba" style="--pos:50%" data-ba>
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
      } else if (e.code === 'ArrowRight' && !e.repeat) {
        // Right arrow moves on, unless it's being used on a slider or inside the tab row.
        const el = document.activeElement as HTMLElement | null;
        const footer = this.card.querySelector<HTMLButtonElement>('.card-footer-btn');
        if (footer && !el?.closest('input, [role="tablist"]')) {
          e.preventDefault();
          footer.click();
        }
      }
    });
    this.card.addEventListener('click', (e) => this.onClick(e));
    // Scroll doesn't bubble, so listen in the capture phase to keep gallery dots in step with swipes.
    this.card.addEventListener(
      'scroll',
      (e) => {
        const viewport = e.target as HTMLElement;
        if (!viewport.classList?.contains('gallery-viewport')) return;
        const g = viewport.closest<HTMLElement>('[data-gallery]')!;
        this.galleryMark(g, Math.round(viewport.scrollLeft / Math.max(1, viewport.clientWidth)));
      },
      true,
    );
    this.card.addEventListener('pointerover', (e) => {
      // Desktop: hovering a lettered pin picks it.
      const pin = e.pointerType === 'mouse' ? (e.target as HTMLElement).closest<HTMLElement>('.spots-pin') : null;
      if (pin) this.pickSpot(pin.closest<HTMLElement>('[data-spots]')!, Number(pin.dataset.spot));
    });
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
    // Opening over an open card swaps the content in place: no slide out and back in.
    const swapping = !!this.model && !this.closing;
    if (this.model) this.finish(!swapping);
    this.card.classList.toggle('is-swap', swapping);
    this.model = model;
    this.handlers = handlers;
    if (!swapping) this.returnFocus = document.activeElement as HTMLElement | null;
    this.render(model);
    this.overlay.hidden = false;
    this.card.scrollTop = 0;
    document.body.classList.add('has-card');
    // With a "Next" or "Finish" button, that's where focus starts, so Enter moves on.
    ((this.card.querySelector('.card-footer-btn') ?? this.card.querySelector('.card-close')) as HTMLElement).focus({ preventScroll: true });
    return new Promise((resolve) => (this.resolve = resolve));
  }

  /** Close. On phones the sheet slides back down first. */
  close(): void {
    if (!this.model || this.closing) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return this.finish();
    this.closing = true;
    const sheet = this.isSheet();
    // Phones: the sheet slides back down. Desktop: the panel eases away.
    this.card.style.transition = sheet ? 'transform 0.22s cubic-bezier(0.4, 0, 1, 1)' : 'transform 0.16s ease, opacity 0.16s ease';
    this.card.style.transform = sheet ? 'translateY(105%)' : 'translateY(14px) scale(0.985)';
    if (!sheet) this.card.style.opacity = '0';
    this.overlay.classList.add('is-closing');
    this.closeTimer = window.setTimeout(() => this.finish(), sheet ? 220 : 160);
  }

  private closing = false;
  private closeTimer = 0;
  private isSheet(): boolean {
    return matchMedia('(max-width: 700px)').matches;
  }

  private finish(hide = true): void {
    if (!this.model) return;
    // A card opened mid-close must not be torn down by the old close timer.
    window.clearTimeout(this.closeTimer);
    this.closing = false;
    this.card.style.transition = '';
    this.card.style.transform = '';
    this.card.style.opacity = '';
    this.overlay.classList.remove('is-closing');
    this.model = null;
    if (hide) {
      this.overlay.hidden = true;
      this.card.replaceChildren();
      document.body.classList.remove('has-card');
      this.returnFocus?.focus?.({ preventScroll: true });
    }
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
    // Combine where we can: two or three simple screens (a slider, a screenshot, a photo set) sit side by side
    // with their captions instead of hiding behind tabs. Tabs remain for screens with lists or timelines to read.
    const simple = (s: Screen) => !s.hotspots && !s.bullets && !s.timeline && !!((s.before && s.after) || s.img || s.gallery);
    const row = m.screens.length > 1 && m.screens.length <= 3 && m.screens.every(simple);
    const tabs =
      !row && m.screens.length > 1
        ? `<div class="card-tabs" role="tablist" aria-label="Sections">${m.screens
            .map((s, i) => `<button type="button" role="tab" class="card-tab" id="card-tab-${i}" data-tab="${i}" aria-controls="card-panel-${i}">${esc(s.label)}</button>`)
            .join('')}</div>`
        : '';
    const panels = row
      ? `${m.screens.some((s) => s.before) ? hintHTML(m.screens.filter((s) => s.before).length > 1 ? 'Drag each slider to compare before and after' : 'Drag the slider to compare before and after') : ''}
         <div class="card-row" style="--cols:${m.screens.length}">${m.screens.map((s) => rowItemHTML(s)).join('')}</div>`
      : m.screens
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
      ${
        m.stations?.length
          ? `<nav class="card-stations" aria-label="Stops here">${m.stations
              .map(
                (st) =>
                  `<button type="button" class="card-station${st.current ? ' is-current' : ''}${st.done ? ' is-done' : ''}" data-station="${esc(st.id)}" ${st.current ? 'aria-current="true"' : ''}><span aria-hidden="true">${st.done ? '✓' : '○'}</span>${esc(st.label)}<span class="visually-hidden">${st.done ? ', seen' : ', not seen yet'}</span></button>`,
              )
              .join('')}</nav>`
          : ''
      }
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
    if (m.screens.length && !row) this.showTab(Math.min(m.initialTab ?? 0, m.screens.length - 1));
    this.card.querySelectorAll<HTMLElement>('[data-spots]').forEach((el) => this.pickSpot(el, 0));
  }

  private pickSpot(group: HTMLElement, i: number): void {
    group.querySelectorAll<HTMLElement>('[data-spot]').forEach((b) => {
      const on = Number(b.dataset.spot) === i;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    group.querySelectorAll<HTMLElement>('[data-detail]').forEach((d) => d.classList.toggle('is-on', Number(d.dataset.detail) === i));
    group.querySelectorAll<HTMLElement>('[data-caption]').forEach((c) => (c.hidden = Number(c.dataset.caption) !== i));
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
    const station = target.closest<HTMLElement>('[data-station]');
    if (station) {
      if (!station.classList.contains('is-current')) this.handlers.onSwap?.(`station:${station.dataset.station}`);
      return;
    }
    const footer = target.closest<HTMLElement>('[data-footer]');
    if (footer) {
      const handler = this.handlers.onFooter;
      const action = footer.dataset.footer!;
      if (action.startsWith('swap:')) return this.handlers.onSwap?.(action.slice(5));
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

    const pin = target.closest<HTMLElement>('[data-spot]');
    if (pin) return this.pickSpot(pin.closest<HTMLElement>('[data-spots]')!, Number(pin.dataset.spot));

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

  /** Galleries are native scroll strips (swipe on phones). Arrows and dots just scroll them. */
  private galleryGo(g: HTMLElement, n: number): void {
    const total = g.querySelectorAll('.gallery-slide').length;
    const i = ((n % total) + total) % total;
    const viewport = g.querySelector('.gallery-viewport') as HTMLElement;
    viewport.scrollTo({ left: i * viewport.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    this.galleryMark(g, i);
  }

  private galleryMark(g: HTMLElement, i: number): void {
    g.dataset.index = String(i);
    g.querySelectorAll('.gallery-dot').forEach((d, k) => d.classList.toggle('is-on', k === i));
  }

  /** Swipe left/right on a gallery to page it. Drag the header down to pull the sheet away, like a native bottom sheet. */
  private bindSwipes(): void {
    let start: { x: number; y: number; t: number; gallery: HTMLElement | null; header: boolean } | null = null;
    let dragging = false;
    this.card.addEventListener(
      'touchstart',
      (e) => {
        const t = e.target as HTMLElement;
        const header = this.isSheet() && !!t.closest('[data-swipe]') && !t.closest('button');
        start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now(), gallery: t.closest<HTMLElement>('[data-gallery]'), header };
        dragging = false;
      },
      { passive: true },
    );
    this.card.addEventListener(
      'touchmove',
      (e) => {
        if (!start?.header || this.closing) return;
        const dy = e.touches[0].clientY - start.y;
        if (!dragging && dy > 6) dragging = true;
        if (dragging) {
          // The sheet follows the finger.
          this.card.style.transition = 'none';
          this.card.style.transform = `translateY(${Math.max(0, dy)}px)`;
        }
      },
      { passive: true },
    );
    const release = (e: TouchEvent) => {
      if (!start) return;
      const dx = e.changedTouches[0].clientX - start.x;
      const dy = e.changedTouches[0].clientY - start.y;
      const s = start;
      start = null;
      void dx;
      if (s.header && dragging) {
        dragging = false;
        const velocity = dy / Math.max(1, performance.now() - s.t); // px per ms
        if (dy > 120 || (dy > 30 && velocity > 0.5)) {
          this.close();
        } else {
          // Not far enough: spring back.
          this.card.style.transition = 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)';
          this.card.style.transform = '';
        }
      }
    };
    this.card.addEventListener('touchend', release, { passive: true });
    this.card.addEventListener('touchcancel', release, { passive: true });
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
