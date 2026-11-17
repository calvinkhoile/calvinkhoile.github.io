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
      <p class="dialogue-text" aria-hidden="true"></p>
      <p class="visually-hidden" aria-live="polite"></p>
      <span class="dialogue-more" aria-hidden="true"><span class="dialogue-hint"></span> ▼</span>
      <div class="dialogue-choices" role="group" aria-label="Choices"></div>`;
    root.appendChild(this.box);
    this.speaker = this.box.querySelector('.dialogue-speaker')!;
    this.text = this.box.querySelector('.dialogue-text')!;
    this.live = this.box.querySelector('.visually-hidden')!;
    this.more = this.box.querySelector('.dialogue-more')!;
    this.choices = this.box.querySelector('.dialogue-choices')!;

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
      const buttons = Array.from(this.choices.querySelectorAll('button'));
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
    if (this.choices.childElementCount > 0) return; // a choice is required
    this.onAdvance?.();
    this.index++;
    if (this.index >= this.node.lines.length) this.finish(null, false);
    else this.showLine();
  }

  private showLine(): void {
    const line = this.node!.lines[this.index];
    if (this.speaker.textContent !== line.speaker) {
      this.speaker.textContent = line.speaker;
      this.speaker.classList.remove('is-new');
      void this.speaker.offsetWidth;
      this.speaker.classList.add('is-new');
    }
    this.live.textContent = `${line.speaker}: ${line.text}`;
    this.choices.replaceChildren();
    this.more.hidden = true;
    this.shown = 0;
    this.typing = true;
    window.clearInterval(this.timer);
    if (this.instant) {
      this.completeLine();
      return;
    }
    this.text.textContent = '';
    this.timer = window.setInterval(() => {
      this.shown++;
      this.text.textContent = line.text.slice(0, this.shown);
      if (this.shown >= line.text.length) this.completeLine();
    }, 1000 / CHARS_PER_SECOND);
  }

  private completeLine(): void {
    window.clearInterval(this.timer);
    const node = this.node!;
    this.text.textContent = node.lines[this.index].text;
    this.typing = false;
    const last = this.index === node.lines.length - 1;
    if (last && node.choices?.length) {
      for (const [i, choice] of node.choices.entries()) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'dialogue-choice';
        b.style.setProperty('--i', String(i));
        b.textContent = choice.label;
        b.addEventListener('click', () => this.finish(choice, false));
        this.choices.appendChild(b);
      }
      (this.choices.firstElementChild as HTMLButtonElement).focus({ preventScroll: true });
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
