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

const JOY_RADIUS = 56; // px
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

  private inJoystickZone(x: number, y: number): boolean {
    const r = this.canvas.getBoundingClientRect();
    return x - r.left < r.width * 0.45 && y - r.top > r.height * 0.5;
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType === 'touch' && this.joyId === null && this.inJoystickZone(e.clientX, e.clientY)) {
      this.joyId = e.pointerId;
      this.joyBase = { x: e.clientX, y: e.clientY };
      this.joyVec = { x: 0, y: 0 };
      this.canvas.setPointerCapture(e.pointerId);
      this.drawJoystick();
      return;
    }
    this.pending.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: false });
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId === this.joyId) {
      let dx = e.clientX - this.joyBase.x;
      let dy = e.clientY - this.joyBase.y;
      const dist = Math.hypot(dx, dy);
      if (dist > JOY_RADIUS) {
        // Past the rim, drag the base along so the thumb never "falls off" the stick.
        const over = dist - JOY_RADIUS;
        this.joyBase.x += (dx / dist) * over;
        this.joyBase.y += (dy / dist) * over;
        dx = (dx / dist) * JOY_RADIUS;
        dy = (dy / dist) * JOY_RADIUS;
      }
      this.joyVec = { x: dx / JOY_RADIUS, y: dy / JOY_RADIUS };
      this.drawJoystick();
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
    this.joyEl.classList.remove('is-active');
  }

  private drawJoystick(): void {
    this.joyEl.classList.add('is-active');
    this.joyEl.style.transform = `translate(${this.joyBase.x}px, ${this.joyBase.y}px)`;
    this.knobEl.style.transform = `translate(${this.joyVec.x * JOY_RADIUS}px, ${this.joyVec.y * JOY_RADIUS}px)`;
    this.joyEl.classList.toggle('is-sprint', Math.hypot(this.joyVec.x, this.joyVec.y) >= JOY_SPRINT);
  }
}
