import type { MapDef, Prop } from './types';

// BetMGM gym interior, 16 x 12 tiles. The camera looks north-west, so the north and west walls are full height
// and the south and east edges are low curbs. Calvin (gym leader) stands at the back; four stations and one prop.

const W = 16;
const H = 12;
const BLACK = 0x15130f;
const GOLD = 0xc5a15a;

const props: Prop[] = [
  // Walls: tall at the back, low curbs toward the camera.
  { model: 'wall', x: 0, z: 0, w: W, d: 1, h: 4.2, color: BLACK, blocks: true },
  { model: 'wall', x: 0, z: 1, w: 1, d: H - 1, h: 4.2, color: BLACK, blocks: true },
  { model: 'curb', x: 1, z: H - 1, w: 7, d: 1, h: 0.35, color: GOLD, blocks: true },
  { model: 'curb', x: 9, z: H - 1, w: W - 9, d: 1, h: 0.35, color: GOLD, blocks: true },
  { model: 'curb', x: W - 1, z: 1, w: 1, d: H - 2, h: 0.35, color: GOLD, blocks: true },

  // Product Summit stage (prop station): platform against the back wall with the photo on its screen.
  { model: 'summit-stage', x: 2, z: 1, w: 4, d: 2, h: 0.4, color: 0x2a2620, blocks: true },
  // Server racks / API terminal.
  { model: 'server-rack', x: 11, z: 1, w: 3, d: 1, h: 2.4, color: 0x1f2937, blocks: true },
  // Rewards Store counter along the west wall.
  { model: 'rewards-counter', x: 1, z: 5, w: 1, d: 3, h: 1.1, color: GOLD, blocks: true },
  // Partnership desk on the east side, with a bellhop cart beside it.
  { model: 'partner-desk', x: 13, z: 5, w: 1, d: 2, h: 0.9, color: 0x7a4a2e, blocks: true },
  { model: 'bellhop-cart', x: 13, z: 8, w: 1, d: 1, h: 1.7, color: GOLD, blocks: true },
  // AI lab pod: a desk with glowing monitors.
  { model: 'ai-pod', x: 5, z: 8, w: 2, d: 1, h: 0.9, color: 0x111827, blocks: true },
  // Casino dressing.
  { model: 'slot-machine', x: 1, z: 1, w: 1, d: 1, h: 1.9, color: 0xb3121f, blocks: true },
  { model: 'slot-machine', x: 1, z: 2, w: 1, d: 1, h: 1.9, color: 0x1d4ed8, blocks: true },
  { model: 'slot-machine', x: 1, z: 3, w: 1, d: 1, h: 1.9, color: 0x15803d, blocks: true },
  { model: 'card-table', x: 10, z: 8, w: 2, d: 1, h: 0.9, color: 0x0f5132, blocks: true },
];

export const gymBetmgm: MapDef = {
  id: 'gym-betmgm',
  width: W,
  height: H,
  groundColor: 0x4a0f18,
  interior: true,
  zones: [],
  props,
  doors: [{ id: 'exit', x: 8, z: 11, facing: 's', to: 'exterior', color: GOLD }],
  interactables: [
    { id: 'betmgm/rewards-store', kind: 'station', label: 'Rewards Store', x: 3, z: 6.5, radius: 1.2, station: 'betmgm/rewards-store' },
    { id: 'betmgm/loyalty-apis', kind: 'station', label: 'Loyalty APIs', x: 12.5, z: 3, radius: 1.2, station: 'betmgm/loyalty-apis' },
    { id: 'betmgm/enablement-wins', kind: 'station', label: 'Partnership Desk', x: 12, z: 6, radius: 1.2, station: 'betmgm/enablement-wins' },
    { id: 'betmgm/ai-betmgm', kind: 'station', label: 'AI Lab', x: 6, z: 7, radius: 1.2, station: 'betmgm/ai-betmgm' },
    { id: 'betmgm/product-summit', kind: 'station', label: 'Product Summit Stage', x: 4, z: 4, radius: 1.2, station: 'betmgm/product-summit' },
  ],
  npcs: [{ id: 'calvin-betmgm', label: 'Calvin', x: 8, z: 2, role: 'leader', dialogue: 'betmgm', faceX: 8.5, faceZ: 10 }],
  spawn: { x: 8.5, z: 9.6 },
  cameraBounds: { minX: 5, maxX: 11, minZ: 4, maxZ: 9 },
};
