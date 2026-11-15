// A "look" is one base mesh plus 8 palette colors. Every triangle of a trainer mesh points at one palette slot
// (assigned in scripts/assets.mjs), so recoloring an outfit costs nothing to download.
// Slot order must match REGION in scripts/assets.mjs.

export interface Look {
  id: string;
  name: string;
  model: string;
  skin: number;
  top: number;
  /** Forearms: the top color for long sleeves, the skin color for a tee. */
  sleeve: number;
  pants: number;
  /** Lower legs: the pants color for long pants, the skin color for shorts. */
  calf: number;
  shoes: number;
  hair: number;
  eyes: number;
}

export const paletteOf = (l: Look): number[] => [l.skin, l.top, l.sleeve, l.pants, l.calf, l.shoes, l.hair, l.eyes];

// TODO(calvin): review names and outfits.
export const TRAINER_LOOKS: Look[] = [
  { id: 'a', name: 'Rookie', model: 'trainer-a.glb', skin: 0xe2b48c, top: 0xf2643b, sleeve: 0xe2b48c, pants: 0x34495e, calf: 0x34495e, shoes: 0xf5f5f5, hair: 0x3b2a1e, eyes: 0x22180f },
  { id: 'b', name: 'Playmaker', model: 'trainer-b.glb', skin: 0xc98f62, top: 0x19a7a0, sleeve: 0x19a7a0, pants: 0x4b5563, calf: 0x4b5563, shoes: 0xff8fb1, hair: 0x15110f, eyes: 0x15110f },
  { id: 'c', name: 'Sixth Man', model: 'trainer-c.glb', skin: 0x8d5a3b, top: 0xffc93c, sleeve: 0x8d5a3b, pants: 0x1f2937, calf: 0x8d5a3b, shoes: 0xf5f5f5, hair: 0x15110f, eyes: 0x15110f },
  { id: 'd', name: 'Sharpshooter', model: 'trainer-d.glb', skin: 0xf0c9a4, top: 0x8b5cf6, sleeve: 0xf0c9a4, pants: 0x3b6ea5, calf: 0x3b6ea5, shoes: 0x1f2937, hair: 0x8a3b1e, eyes: 0x2a1a10 },
];

export const DEFAULT_LOOK = TRAINER_LOOKS[0];
export const lookById = (id: string | null | undefined): Look => TRAINER_LOOKS.find((l) => l.id === id) ?? DEFAULT_LOOK;

// Placeholder Calvin until the M5 avatar pass: same base family, quarter-zip and khakis.
export const CALVIN_PLAZA_LOOK: Look = {
  id: 'calvin-plaza',
  name: 'Calvin',
  model: 'trainer-a.glb',
  skin: 0xe6bd94,
  top: 0x1d3557,
  sleeve: 0x1d3557,
  pants: 0xb9a27a,
  calf: 0xb9a27a,
  shoes: 0xf5f5f5,
  hair: 0x121212,
  eyes: 0x121212,
};
