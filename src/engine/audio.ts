// Sound effects. Off by default and never autoplayed: the visitor turns them on with the speaker button,
// and that click is the gesture browsers require before audio can play. Howler is only downloaded then.

export type Sfx = 'select' | 'advance' | 'open' | 'close' | 'toggle' | 'badge' | 'right' | 'wrong' | 'door' | 'bounce' | 'rim' | 'swish' | 'step-grass' | 'step-hard' | 'step-soft';

const VARIANTS: Partial<Record<Sfx, number>> = { 'step-grass': 2, 'step-hard': 2, 'step-soft': 2 };
const VOLUME: Partial<Record<Sfx, number>> = { 'step-grass': 0.25, 'step-hard': 0.22, 'step-soft': 0.2, advance: 0.4, select: 0.5, badge: 0.8 };
const KEY = 'mypark:sfx';

type HowlLike = { play(): number };

class Audio {
  enabled = false;
  private sounds = new Map<string, HowlLike>();
  private loading: Promise<void> | null = null;

  /** Whether the visitor left sound on last time. It still takes a click this visit to actually start. */
  get remembered(): boolean {
    try {
      return localStorage.getItem(KEY) === 'on';
    } catch {
      return false;
    }
  }

  async setEnabled(on: boolean): Promise<void> {
    this.enabled = on;
    try {
      localStorage.setItem(KEY, on ? 'on' : 'off');
    } catch {
      /* storage unavailable */
    }
    if (on) {
      await (this.loading ??= this.load());
      this.play('toggle');
    }
  }

  private async load(): Promise<void> {
    const { Howl } = await import('howler');
    const names: Sfx[] = ['select', 'advance', 'open', 'close', 'toggle', 'badge', 'right', 'wrong', 'door', 'bounce', 'rim', 'swish', 'step-grass', 'step-hard', 'step-soft'];
    for (const name of names) {
      const n = VARIANTS[name] ?? 1;
      for (let i = 1; i <= n; i++) {
        const key = n > 1 ? `${name}-${i}` : name;
        this.sounds.set(key, new Howl({ src: [`/audio/${key}.ogg`], volume: VOLUME[name] ?? 0.6 }));
      }
    }
  }

  play(name: Sfx): void {
    if (!this.enabled) return;
    const n = VARIANTS[name] ?? 1;
    const key = n > 1 ? `${name}-${1 + Math.floor(Math.random() * n)}` : name;
    this.sounds.get(key)?.play();
  }
}

export const audio = new Audio();
