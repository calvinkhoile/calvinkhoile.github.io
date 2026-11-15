// Keyboard, mouse, and touch all feed one InputState. The game reads it once per frame.

export interface InputState {
  /** Screen-space move vector, magnitude 0..1. +x is screen right, +y is screen up. */
  moveX: number;
  moveY: number;
  sprint: boolean;
  /** True for one frame when the interact button/key goes down. */
  interact: boolean;
  /** Screen point of a click or tap this frame (click/tap-to-move), else null. */
  tap: { x: number; y: number } | null;
}

const JOY_RADIUS = 48; // px
const JOY_GRAB = 1.8; // a touch within this many radii of the stick grabs it
const JOY_DEADZONE = 0.14;
const JOY_SPRINT = 0.85;
const TAP_SLOP = 12; // px a touch can drift and still count as a tap
const TAP_MS = 450;

const KEY_DIRS: Record<string, [number, number]> = {
  ArrowUp: [0, 1],
  KeyW: [0, 1],
  ArrowDown: [0, -1],
  KeyS: [0, -1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};
const INTERACT_KEYS = new Set(['KeyE', 'Space', 'Enter']);

export class Input {
  private keys = new Set<string>();
  private interactQueued = false;
  private tapQueued: { x: number; y: number } | null = null;

  private joyId: number | null = null;
  private joyBase = { x: 0, y: 0 };
  private joyVec = { x: 0, y: 0 };
  private pending = new Map<number, { x: number; y: number; t: number; moved: boolean }>();

  private readonly joyEl: HTMLElement;
  private readonly knobEl: HTMLElement;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    ui: HTMLElement,
  ) {
    this.joyEl = document.createElement('div');
    this.joyEl.className = 'joystick';
    this.joyEl.setAttribute('aria-hidden', 'true');
    this.knobEl = document.createElement('div');
    this.knobEl.className = 'joystick-knob';
    this.joyEl.appendChild(this.knobEl);
    ui.appendChild(this.joyEl);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => document.hidden && this.reset());

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // iOS Safari: block pinch and double-tap zoom on the canvas only (cards stay zoomable).
    canvas.addEventListener('gesturestart', (e) => e.preventDefault());
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  }

  /** Lets on-screen buttons (the A button) trigger an interact. */
  queueInteract(): void {
    this.interactQueued = true;
  }

  /** Read and clear this frame's input. */
  poll(): InputState {
    let x = 0;
    let y = 0;
    let sprint = false;

    for (const code of this.keys) {
      const d = KEY_DIRS[code];
      if (d) {
        x += d[0];
        y += d[1];
      }
    }
    if (x !== 0 || y !== 0) {
      // Normalize so diagonals aren't faster.
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
      sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    } else if (this.joyId !== null) {
      const mag = Math.hypot(this.joyVec.x, this.joyVec.y);
      if (mag > JOY_DEADZONE) {
        sprint = mag >= JOY_SPRINT;
        // Below the sprint threshold the stick is analog: a light push is a slow walk.
        const speed = sprint ? 1 : Math.min(1, (mag - JOY_DEADZONE) / (0.6 - JOY_DEADZONE));
        x = (this.joyVec.x / mag) * speed;
        y = (-this.joyVec.y / mag) * speed;
      }
    }

    const state: InputState = { moveX: x, moveY: y, sprint, interact: this.interactQueued, tap: this.tapQueued };
    this.interactQueued = false;
    this.tapQueued = null;
    return state;
  }

  private reset(): void {
    this.keys.clear();
    this.endJoystick();
    this.pending.clear();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    const onButton = !!el && (el.tagName === 'BUTTON' || el.tagName === 'A');
    if (KEY_DIRS[e.code]) {
      this.keys.add(e.code);
      e.preventDefault(); // arrows and space shouldn't scroll the page
    } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this.keys.add(e.code);
    } else if (INTERACT_KEYS.has(e.code) && !e.repeat && !onButton) {
      this.interactQueued = true;
      e.preventDefault();
    }
  };

  /** The stick sits at a fixed spot (placed by CSS). Returns its center, or null when it's hidden. */
  private joystickCenter(): { x: number; y: number } | null {
    const r = this.joyEl.getBoundingClientRect();
    if (getComputedStyle(this.joyEl).display === 'none') return null;
    return { x: r.left, y: r.top };
  }

  private setJoystick(clientX: number, clientY: number): void {
    let dx = clientX - this.joyBase.x;
    let dy = clientY - this.joyBase.y;
    const dist = Math.hypot(dx, dy);
    if (dist > JOY_RADIUS) {
      dx = (dx / dist) * JOY_RADIUS;
      dy = (dy / dist) * JOY_RADIUS;
    }
    this.joyVec = { x: dx / JOY_RADIUS, y: dy / JOY_RADIUS };
    this.drawJoystick();
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const center = e.pointerType === 'touch' && this.joyId === null ? this.joystickCenter() : null;
    if (center && Math.hypot(e.clientX - center.x, e.clientY - center.y) <= JOY_RADIUS * JOY_GRAB) {
      this.joyId = e.pointerId;
      this.joyBase = center;
      this.canvas.setPointerCapture(e.pointerId);
      this.setJoystick(e.clientX, e.clientY);
      return;
    }
    this.pending.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: false });
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId === this.joyId) {
      this.setJoystick(e.clientX, e.clientY);
      return;
    }
    const p = this.pending.get(e.pointerId);
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > TAP_SLOP) p.moved = true;
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId === this.joyId) {
      this.endJoystick();
      return;
    }
    const p = this.pending.get(e.pointerId);
    this.pending.delete(e.pointerId);
    if (!p || p.moved) return;
    if (e.pointerType !== 'mouse' && performance.now() - p.t > TAP_MS) return;
    this.tapQueued = { x: e.clientX, y: e.clientY };
  };

  private onPointerCancel = (e: PointerEvent): void => {
    if (e.pointerId === this.joyId) this.endJoystick();
    this.pending.delete(e.pointerId);
  };

  private endJoystick(): void {
    this.joyId = null;
    this.joyVec = { x: 0, y: 0 };
    this.joyEl.classList.remove('is-active', 'is-sprint');
    this.knobEl.style.transform = '';
  }

  private drawJoystick(): void {
    this.joyEl.classList.add('is-active');
    this.knobEl.style.transform = `translate(${this.joyVec.x * JOY_RADIUS}px, ${this.joyVec.y * JOY_RADIUS}px)`;
    this.joyEl.classList.toggle('is-sprint', Math.hypot(this.joyVec.x, this.joyVec.y) >= JOY_SPRINT);
  }
}
