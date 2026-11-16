// A "look" is one base mesh plus 8 palette colors. Every triangle of a trainer mesh points at one palette slot
// (assigned in scripts/assets.mjs), so recoloring an outfit costs nothing to download.
// Slot order must match REGION in scripts/assets.mjs.

export interface Look {
  accessories?: string[];
  accent?: number;
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

// ----- Calvin (Tier A avatar) -----
// One base (same family and skeleton as the trainers), recolored per era, plus a few small accessories.
// Hair and skin are matched to his headshot: short black hair with volume on top, warm tan skin, no glasses.

export type Accessory = 'backpack' | 'laptop' | 'lanyard' | 'number';

export interface CalvinLook extends Look {
  /** What this outfit is, for the review lineup. */
  caption: string;
  accessories: Accessory[];
  /** Color for accessory details (backpack trim, jersey number). */
  accent: number;
}

const CALVIN = { model: 'trainer-a.glb', skin: 0xdcae84, hair: 0x16130f, eyes: 0x16130f };
const SKIN = CALVIN.skin;

export const CALVIN_LOOKS: Record<'plaza' | 'ucla' | 'deloitte' | 'meta' | 'betmgm' | 'court', CalvinLook> = {
  // The black jacket from his headshot.
  plaza: { ...CALVIN, id: 'calvin-plaza', name: 'Calvin', caption: 'Plaza: black jacket, dark jeans', top: 0x1b1b1d, sleeve: 0x1b1b1d, pants: 0x2f3640, calf: 0x2f3640, shoes: 0xf5f5f5, accessories: [], accent: 0xffffff },
  ucla: { ...CALVIN, id: 'calvin-ucla', name: 'Calvin', caption: 'UCLA: blue hoodie, backpack', top: 0x2774ae, sleeve: 0x2774ae, pants: 0x3b4252, calf: 0x3b4252, shoes: 0xf5f5f5, accessories: ['backpack'], accent: 0xffd100 },
  deloitte: { ...CALVIN, id: 'calvin-deloitte', name: 'Calvin', caption: 'Deloitte: charcoal blazer, laptop', top: 0x30343b, sleeve: 0x30343b, pants: 0x30343b, calf: 0x30343b, shoes: 0x1a1a1a, accessories: ['laptop'], accent: 0x86bc25 },
  meta: { ...CALVIN, id: 'calvin-meta', name: 'Calvin', caption: 'Meta: grey hoodie', top: 0x8d99ae, sleeve: 0x8d99ae, pants: 0x1f2937, calf: 0x1f2937, shoes: 0xf5f5f5, accessories: [], accent: 0x0866ff },
  betmgm: { ...CALVIN, id: 'calvin-betmgm', name: 'Calvin', caption: 'BetMGM: navy quarter-zip, lanyard', top: 0x1d3557, sleeve: 0x1d3557, pants: 0xb9a27a, calf: 0xb9a27a, shoes: 0xf5f5f5, accessories: ['lanyard'], accent: 0xc5a15a },
  // Jersey: short sleeves and shorts, number 13 front and back.
  court: { ...CALVIN, id: 'calvin-court', name: 'Calvin', caption: 'Court: #13 jersey', top: 0x2774ae, sleeve: SKIN, pants: 0x2774ae, calf: SKIN, shoes: 0xf5f5f5, accessories: ['number'], accent: 0xffd100 },
};

export const CALVIN_PLAZA_LOOK = CALVIN_LOOKS.plaza;
