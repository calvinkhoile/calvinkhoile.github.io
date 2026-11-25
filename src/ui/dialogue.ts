import type { DialogueChoice, DialogueNode } from '../content/dialogue';
import { hide, show } from './motion';

const CHARS_PER_SECOND = 40;

export interface DialogueResult {
  choice: DialogueChoice | null;
  /** True when the visitor pressed Esc to skip the rest. */
  skipped: boolean;
}

/** Pokémon-style text box: speaker tab, typewriter text, blinking ▼, optional choices at the end. */
export class DialogueBox {
  private readonly box: HTMLElement;
  private readonly speaker: HTMLElement;
  private readonly text: HTMLElement;
  private readonly more: HTMLElement;
  private readonly choices: HTMLElement;
  private readonly live: HTMLElement;
  private readonly instant: boolean;
  /** The typed part of the line, and the rest of it laid out invisibly so the box never reflows mid-line. */
  private readonly typed: HTMLElement;
  private readonly ghost: HTMLElement;
  private sizeAnim: Animation | null = null;
  private unpin: (() => void) | null = null;

  private node: DialogueNode | null = null;
  private index = 0;
  private shown = 0;
  private typing = false;
  private timer = 0;
  private resolve: ((r: DialogueResult) => void) | null = null;
  /** Called each time a line is advanced (used for the blip sound). */
  onAdvance: (() => void) | null = null;

  constructor(root: HTMLElement, reducedMotion: boolean) {
    this.instant = reducedMotion;
    this.box = document.createElement('div');
    this.box.className = 'dialogue';
    this.box.hidden = true;
    this.box.setAttribute('role', 'dialog');
    this.box.setAttribute('aria-label', 'Dialogue');
    this.box.innerHTML = `
      <div class="dialogue-speaker"></div>
      <p class="dialogue-text" aria-hidden="true"><span class="dialogue-typed"></span><span class="dialogue-ghost"></span></p>
      <p class="visually-hidden" aria-live="polite"></p>
      <span class="dialogue-more" aria-hidden="true"><span class="dialogue-hint"></span> ▼</span>
      <div class="dialogue-choices" role="group" aria-label="Choices"></div>`;
    root.appendChild(this.box);
    this.speaker = this.box.querySelector('.dialogue-speaker')!;
    this.text = this.box.querySelector('.dialogue-text')!;
    this.live = this.box.querySelector('.visually-hidden')!;
    this.more = this.box.querySelector('.dialogue-more')!;
    this.choices = this.box.querySelector('.dialogue-choices')!;
    this.typed = this.box.querySelector('.dialogue-typed')!;
    this.ghost = this.box.querySelector('.dialogue-ghost')!;
    window.addEventListener('resize', () => this.balanceChoices());

    this.box.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('button')) this.advance();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.node) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        this.finish(null, true);
        return;
      }
      const onChoice = document.activeElement instanceof HTMLButtonElement && this.choices.contains(document.activeElement);
      const buttons = Array.from(this.choices.querySelectorAll<HTMLButtonElement>('.dialogue-choice'));
      const arrow = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.code);
      if (arrow && buttons.length > 0) {
        // Choices on screen: arrows move between them, Enter picks.
        e.preventDefault();
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const step = e.code === 'ArrowDown' || e.code === 'ArrowRight' ? 1 : buttons.length - 1;
        buttons[(Math.max(0, at) + step) % buttons.length].focus();
      } else if (!e.repeat && !onChoice && !e.metaKey && !e.ctrlKey && !e.altKey && !['Tab', 'ShiftLeft', 'ShiftRight', 'ArrowLeft', 'ArrowUp'].includes(e.code)) {
        // Any key continues.
        e.preventDefault();
        this.advance();
      }
    });
  }

  get isOpen(): boolean {
    return this.node !== null;
  }

  play(node: DialogueNode): Promise<DialogueResult> {
    this.finish(null, true); // close anything already open
    this.node = node;
    this.index = 0;
    show(this.box);
    this.showLine();
    return new Promise((resolve) => (this.resolve = resolve));
  }

  /** Advance: finish the current line if it's still typing, otherwise go to the next line. */
  advance(): void {
    if (!this.node) return;
    if (this.typing) {
      this.completeLine();
      return;
    }
    if (this.choices.querySelector('.dialogue-choice')) return; // a choice is required
    this.onAdvance?.();
    this.index++;
    if (this.index >= this.node.lines.length) this.finish(null, false);
    else this.showLine();
  }

  private showLine(): void {
    const node = this.node!;
    const line = node.lines[this.index];
    this.resize(() => {
      if (this.speaker.textContent !== line.speaker) {
        this.speaker.textContent = line.speaker;
        this.speaker.classList.remove('is-new');
        void this.speaker.offsetWidth;
        this.speaker.classList.add('is-new');
      }
      this.live.textContent = `${line.speaker}: ${line.text}`;
      // The last line's choices are laid out (invisibly) from the start, so the box is already its
      // final size and nothing jumps when they appear.
      this.choices.replaceChildren();
      if (this.index === node.lines.length - 1 && node.choices?.length) {
        for (const [i, choice] of node.choices.entries()) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'dialogue-slot';
          b.tabIndex = -1;
          b.style.setProperty('--i', String(i));
          b.textContent = choice.label;
          b.addEventListener('click', () => this.finish(choice, false));
          this.choices.appendChild(b);
        }
      }
      this.more.hidden = true;
      this.typed.textContent = '';
      this.ghost.textContent = line.text;
      this.balanceChoices();
    });
    this.shown = 0;
    this.typing = true;
    window.clearInterval(this.timer);
    if (this.instant) {
      this.completeLine();
      return;
    }
    this.timer = window.setInterval(() => {
      this.shown++;
      this.typed.textContent = line.text.slice(0, this.shown);
      this.ghost.textContent = line.text.slice(this.shown);
      if (this.shown >= line.text.length) this.completeLine();
    }, 1000 / CHARS_PER_SECOND);
  }

  /** Choices share one row at equal widths; if any label wouldn't fit, they stack as a full-width list. */
  private balanceChoices(): void {
    const buttons = Array.from(this.choices.children) as HTMLElement[];
    this.choices.style.setProperty('--n', String(buttons.length || 1));
    this.choices.classList.remove('is-stacked');
    if (buttons.length < 2) return;
    if (buttons.some((b) => b.scrollWidth > b.clientWidth + 1)) this.choices.classList.add('is-stacked');
  }

  /**
   * Runs a content change and, when the box is already on screen, glides it from its old size to the
   * new one instead of snapping. The content is pinned at its final width while the frame moves, so
   * the text never rewraps mid-glide.
   */
  private resize(change: () => void): void {
    const box = this.box;
    const animate = !this.instant && !box.hidden && !box.classList.contains('is-entering');
    // Stop a glide still running and hand the pinned widths back before measuring.
    this.sizeAnim?.cancel();
    this.unpin?.();
    const before = animate ? box.getBoundingClientRect() : null;
    change();
    if (!before) return;
    const after = box.getBoundingClientRect();
    if (Math.abs(after.width - before.width) < 1 && Math.abs(after.height - before.height) < 1) return;
    const pinned = [this.text, this.choices];
    for (const el of pinned) el.style.width = `${el.getBoundingClientRect().width}px`;
    box.classList.add('is-resizing');
    const anim = box.animate(
      [
        { width: `${before.width}px`, height: `${before.height}px` },
        { width: `${after.width}px`, height: `${after.height}px` },
      ],
      { duration: 220, easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)' },
    );
    this.sizeAnim = anim;
    this.unpin = () => {
      this.unpin = null;
      this.sizeAnim = null;
      box.classList.remove('is-resizing');
      for (const el of pinned) el.style.width = '';
    };
    anim.onfinish = () => {
      if (this.sizeAnim === anim) this.unpin?.();
    };
  }

  private completeLine(): void {
    window.clearInterval(this.timer);
    const node = this.node!;
    const text = node.lines[this.index].text;
    this.typed.textContent = text;
    this.ghost.textContent = '';
    this.typing = false;
    const slots = Array.from(this.choices.children) as HTMLButtonElement[];
    if (slots.length > 0) {
      for (const b of slots) {
        b.className = 'dialogue-choice';
        b.removeAttribute('tabindex');
      }
      slots[0].focus({ preventScroll: true });
    } else {
      this.more.querySelector('.dialogue-hint')!.textContent = document.body.classList.contains('is-touch') ? 'Tap to continue' : 'Enter or → to continue';
      this.more.hidden = false;
    }
  }

  private finish(choice: DialogueChoice | null, skipped: boolean): void {
    if (!this.node) return;
    window.clearInterval(this.timer);
    this.node = null;
    // Leave the last line and choices on screen while the box powers off.
    void hide(this.box);
    const resolve = this.resolve;
    this.resolve = null;
    resolve?.({ choice, skipped });
  }
}
