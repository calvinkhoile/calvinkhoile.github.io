// Background music, generated in the browser with Web Audio: a slow lo-fi loop of soft chords and plucked notes.
// Nothing is downloaded and nothing needs a license. Each place gets its own key and feel, and the 1-on-1
// picks up the tempo. Off by default. It's a placeholder Calvin can swap for a real track later.

export type Zone = 'park' | 'gym-ucla' | 'gym-deloitte' | 'gym-meta' | 'gym-betmgm' | 'finale';

interface Mood {
  /** Semitones above C. */
  key: number;
  bpm: number;
  /** Adds a bass pulse and a soft tick: the finale. */
  drive?: boolean;
}

const MOODS: Record<Zone, Mood> = {
  park: { key: 0, bpm: 74 },
  'gym-ucla': { key: 5, bpm: 78 },
  'gym-deloitte': { key: -3, bpm: 70 },
  'gym-meta': { key: 2, bpm: 80 },
  'gym-betmgm': { key: -5, bpm: 76 },
  finale: { key: 0, bpm: 104, drive: true },
};

// I, vi, IV, V as seventh chords, in semitones from the key. One chord per bar.
const CHORDS = [
  [0, 4, 7, 11],
  [9, 12, 16, 19],
  [5, 9, 12, 16],
  [7, 11, 14, 17],
];
const KEY = 'mypark:music';
const hz = (semitone: number) => 261.63 * 2 ** (semitone / 12);

class Music {
  enabled = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer = 0;
  private nextBar = 0;
  private bar = 0;
  private zone: Zone = 'park';
  private volume = 0.6;

  get remembered(): boolean {
    try {
      return localStorage.getItem(KEY) === 'on';
    } catch {
      return false;
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    try {
      localStorage.setItem(KEY, on ? 'on' : 'off');
    } catch {
      /* storage unavailable */
    }
    if (on) this.start();
    else this.stop();
  }

  setZone(zone: Zone): void {
    this.zone = zone; // picked up at the next bar, so the change lands on a downbeat
  }

  /** 0 to 1. */
  setVolume(v: number): void {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v * 0.22, this.ctx.currentTime, 0.1);
  }

  /** Quiet while the tab is in the background. */
  setHidden(hidden: boolean): void {
    if (!this.ctx || !this.enabled) return;
    if (hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  private start(): void {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx ??= new Ctx();
    void this.ctx.resume();
    if (!this.master) {
      // Everything runs through a low-pass filter for the soft, muffled lo-fi sound.
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1500;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(filter).connect(this.ctx.destination);
    }
    this.master.gain.setTargetAtTime(this.volume * 0.22, this.ctx.currentTime, 0.4);
    this.nextBar = this.ctx.currentTime + 0.1;
    window.clearInterval(this.timer);
    // Schedule a little ahead of the clock so timing stays steady even if a frame hitches.
    this.timer = window.setInterval(() => this.schedule(), 120);
  }

  private stop(): void {
    window.clearInterval(this.timer);
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }

  private schedule(): void {
    const ctx = this.ctx!;
    while (this.nextBar < ctx.currentTime + 0.4) {
      const mood = MOODS[this.zone];
      const beat = 60 / mood.bpm;
      const chord = CHORDS[this.bar % CHORDS.length].map((n) => n + mood.key);
      const t = this.nextBar;
      // Pad: the chord, held for the bar with a slow swell.
      for (const n of chord) this.note(hz(n - 12), t, beat * 4, 0.16, 'sine', 0.5);
      // Plucks: chord tones on the off-beats, a different order each bar.
      for (let i = 0; i < 8; i++) {
        if ((i + this.bar) % 3 === 2) continue; // leave some air
        const n = chord[(i * 3 + this.bar) % chord.length] + (i % 4 === 3 ? 12 : 0);
        this.note(hz(n), t + i * (beat / 2), beat * 0.9, 0.2, 'triangle', 0.01);
      }
      if (mood.drive) {
        for (let b = 0; b < 4; b++) {
          this.note(hz(chord[0] - 24), t + b * beat, beat * 0.5, 0.55, 'sine', 0.01);
          this.tick(t + b * beat + beat / 2);
        }
      }
      this.nextBar += beat * 4;
      this.bar++;
    }
  }

  private note(freq: number, at: number, dur: number, level: number, type: OscillatorType, attack: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  /** A soft hi-hat-like tick: a few milliseconds of filtered noise. */
  private tick(at: number): void {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * 0.04);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5000;
    const gain = ctx.createGain();
    gain.gain.value = 0.35;
    // Straight to the output: the master low-pass would swallow it.
    src.connect(hp).connect(gain).connect(ctx.destination);
    gain.gain.setValueAtTime(0.35 * this.volume * 0.22, at);
    src.start(at);
  }
}

export const music = new Music();
