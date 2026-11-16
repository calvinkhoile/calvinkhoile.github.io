import { makeRoom } from './interior-base';

// Deloitte gym: a consulting office. Three project whiteboards and the sushi bar where 2020 caught up with Calvin.
const WHITE = 0xe9ecef;
const GREEN = 0x86bc25;

export const gymDeloitte = makeRoom({
  id: 'gym-deloitte',
  dialogue: 'deloitte',
  theme: { floor: 'office', wall: 0x1c1c1c, trim: GREEN, accent: GREEN, logo: '/images/logos/deloitte.webp', logoBg: 0x000000 },
  props: [
    // Three whiteboards: two on the back wall, one on the west wall.
    { model: 'whiteboard', x: 2, z: 1, w: 3, d: 1, h: 2.4, color: WHITE, blocks: true },
    { model: 'whiteboard', x: 11, z: 1, w: 3, d: 1, h: 2.4, color: WHITE, blocks: true },
    { model: 'whiteboard', x: 1, z: 5, w: 1, d: 3, h: 2.4, color: WHITE, rotation: Math.PI / 2, blocks: true },
    // Sushi bar counter with stools (prop station).
    { model: 'sushi-bar', x: 12, z: 6, w: 2, d: 3, h: 1.1, color: 0x7a4a2e, blocks: true },
    // Office dressing.
    { model: 'office-desk', x: 5, z: 8, w: 2, d: 1, h: 0.8, color: 0x9ca3af, blocks: true },
    { model: 'plant', x: 1, z: 1, w: 1, d: 1, h: 1.6, color: 0x3f9e4d, blocks: true },
    { model: 'plant', x: 14, z: 1, w: 1, d: 1, h: 1.6, color: 0x3f9e4d, blocks: true },
  ],
  interactables: [
    { id: 'deloitte/finance-upgrade', kind: 'station', label: 'Financial System Upgrade', x: 3.5, z: 3, radius: 1.2, station: 'deloitte/finance-upgrade' },
    { id: 'deloitte/hr-tools', kind: 'station', label: 'Self-Service HR Tools', x: 12.5, z: 3, radius: 1.2, station: 'deloitte/hr-tools' },
    { id: 'deloitte/case-management', kind: 'station', label: 'Case Management', x: 3, z: 6.5, radius: 1.2, station: 'deloitte/case-management' },
    { id: 'deloitte/sushi-bar', kind: 'station', label: 'Sushi Bar', x: 10.8, z: 7.5, radius: 1.2, station: 'deloitte/sushi-bar' },
  ],
});
