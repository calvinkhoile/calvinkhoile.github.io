// Progress lives in localStorage under one key. Every read and write is guarded: the game works without storage.

const KEY = 'mypark:v1';

export interface SaveData {
  look: string | null;
  badges: string[];
  visitedStations: string[];
  finaleBest: number | null;
}

const empty = (): SaveData => ({ look: null, badges: [], visitedStations: [], finaleBest: null });

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const d = JSON.parse(raw) as Partial<SaveData>;
    return {
      look: typeof d.look === 'string' ? d.look : null,
      badges: Array.isArray(d.badges) ? d.badges.filter((b) => typeof b === 'string') : [],
      visitedStations: Array.isArray(d.visitedStations) ? d.visitedStations.filter((s) => typeof s === 'string') : [],
      finaleBest: typeof d.finaleBest === 'number' ? d.finaleBest : null,
    };
  } catch {
    return empty();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable or full: play on without saving */
  }
}
