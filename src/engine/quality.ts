import { isCoarsePointer } from './renderer';

export type QualityTier = 'high' | 'medium' | 'low';

export interface QualitySettings {
  tier: QualityTier;
  /** Shadow map size in px. 0 means no real-time shadows (characters keep a blob shadow). */
  shadowMapSize: number;
  antialias: boolean;
  pixelRatioCap: number;
  fog: boolean;
  /** Decorative extras: flowers, skyline, marquee bulbs. */
  ambientDetail: boolean;
}

const TIERS: Record<QualityTier, Omit<QualitySettings, 'tier' | 'pixelRatioCap'>> = {
  high: { shadowMapSize: 2048, antialias: true, fog: true, ambientDetail: true },
  medium: { shadowMapSize: 1024, antialias: true, fog: true, ambientDetail: true },
  low: { shadowMapSize: 0, antialias: false, fog: false, ambientDetail: false },
};

const STORAGE_KEY = 'mypark:quality';
const isTier = (v: unknown): v is QualityTier => v === 'high' || v === 'medium' || v === 'low';

export function settingsFor(tier: QualityTier): QualitySettings {
  const coarse = isCoarsePointer();
  const pixelRatioCap = tier === 'low' ? 1 : coarse ? 1.5 : 2;
  return { tier, pixelRatioCap, ...TIERS[tier] };
}

/**
 * Pick the starting tier: `?quality=` wins, then a saved choice, then a guess from the device.
 * The frame-rate watchdog (below) steps down from there if the device can't keep up.
 */
export function pickTier(params: URLSearchParams): { tier: QualityTier; forced: boolean } {
  const q = params.get('quality');
  if (isTier(q)) return { tier: q, forced: true };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isTier(saved)) return { tier: saved, forced: true };
  } catch {
    /* storage unavailable */
  }
  const cores = navigator.hardwareConcurrency || 4;
  if (isCoarsePointer()) return { tier: cores >= 6 ? 'medium' : 'low', forced: false };
  return { tier: cores >= 4 ? 'high' : 'medium', forced: false };
}

export function saveTier(tier: QualityTier | null): void {
  try {
    if (tier) localStorage.setItem(STORAGE_KEY, tier);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Watches frame time and asks for a lower tier when the average stays under ~30fps. */
export class FrameWatchdog {
  private time = 0;
  private frames = 0;
  private warmup = 2; // ignore the first seconds (shader compiles, asset uploads)

  constructor(private readonly onSlow: () => void) {}

  tick(rawDt: number): void {
    if (this.warmup > 0) {
      this.warmup -= rawDt;
      return;
    }
    this.time += rawDt;
    this.frames++;
    if (this.time >= 3) {
      const fps = this.frames / this.time;
      this.time = 0;
      this.frames = 0;
      if (fps < 30) {
        this.warmup = 2;
        this.onSlow();
      }
    }
  }
}
