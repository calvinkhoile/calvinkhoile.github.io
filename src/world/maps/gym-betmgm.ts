import { makeRoom } from './interior-base';

// BetMGM gym: casino floor. Four stations and the Product Summit stage.
const BLACK = 0x15130f;
const GOLD = 0xc5a15a;

export const gymBetmgm = makeRoom({
  id: 'gym-betmgm',
  dialogue: 'betmgm',
  theme: { floor: 'casino', wall: BLACK, trim: GOLD, accent: 0xffd76a, logo: '/images/logos/betmgm.webp', logoBg: 0x000000 },
  props: [
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
  ],
  interactables: [
    { id: 'betmgm/rewards-store', kind: 'station', label: 'Rewards Store', x: 3, z: 6.5, radius: 1.2, station: 'betmgm/rewards-store' },
    { id: 'betmgm/loyalty-apis', kind: 'station', label: 'Loyalty APIs', x: 12.5, z: 3, radius: 1.2, station: 'betmgm/loyalty-apis' },
    { id: 'betmgm/enablement-wins', kind: 'station', label: 'Partnership Desk', x: 12, z: 6, radius: 1.2, station: 'betmgm/enablement-wins' },
    { id: 'betmgm/ai-betmgm', kind: 'station', label: 'AI Lab', x: 6, z: 7, radius: 1.2, station: 'betmgm/ai-betmgm' },
    { id: 'betmgm/product-summit', kind: 'station', label: 'Product Summit Stage', x: 4, z: 4, radius: 1.2, station: 'betmgm/product-summit' },
  ],
});
