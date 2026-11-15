import type { SceneId } from './stations';

// Collectible badges. They never block anything: the park is open from the start.
// TODO(calvin): review names and descriptions (names come from the plan).

export interface Badge {
  id: string;
  name: string;
  /** How to earn it, shown in the badge case. */
  how: string;
  color: string;
  accent: string;
  /** Short mark drawn on the badge. */
  glyph: string;
  /** Gym whose leader awards it. */
  scene?: SceneId;
}

export const badges: Badge[] = [
  { id: 'ucla', name: 'Bruin Badge', how: 'Visit every station in the UCLA gym, then talk to Calvin there.', color: '#2774ae', accent: '#ffd100', glyph: 'B', scene: 'gym-ucla' },
  { id: 'deloitte', name: 'Consultant Badge', how: 'Visit every station in the Deloitte gym, then talk to Calvin there.', color: '#111111', accent: '#86bc25', glyph: '●', scene: 'gym-deloitte' },
  { id: 'meta', name: 'Ship-It Badge', how: 'Visit every station in the Meta gym, then talk to Calvin there.', color: '#0866ff', accent: '#ffffff', glyph: '∞', scene: 'gym-meta' },
  { id: 'betmgm', name: 'High Roller Badge', how: 'Visit every station in the BetMGM gym, then talk to Calvin there.', color: '#15130f', accent: '#c5a15a', glyph: '♠', scene: 'gym-betmgm' },
  { id: 'explorer', name: 'Explorer Badge', how: 'Try every stop in The Weightroom.', color: '#166534', accent: '#bbf7d0', glyph: '✦' },
  { id: 'legend', name: 'Park Legend', how: "Beat Calvin 1-on-1 at Calvin's Court.", color: '#b45309', accent: '#fde68a', glyph: '★' },
];

export const CAREER_BADGES = ['ucla', 'deloitte', 'meta', 'betmgm'];
export const badgeById = (id: string): Badge | undefined => badges.find((b) => b.id === id);
export const badgeForScene = (scene: SceneId): Badge | undefined => badges.find((b) => b.scene === scene);
