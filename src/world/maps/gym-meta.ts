import { makeRoom } from './interior-base';

// Meta gym: an open-plan product floor. Feedback kiosk, feature wall (a giant phone), voice-of-the-customer mailbox,
// and a window onto HQ.
const BLUE = 0x0866ff;

export const gymMeta = makeRoom({
  id: 'gym-meta',
  dialogue: 'meta',
  theme: { floor: 'studio', wall: 0xf4f5f7, trim: BLUE, accent: BLUE, logo: '/images/logos/meta.svg', logoBg: 0xffffff },
  props: [
    // Feature wall: a giant phone standing against the back wall.
    { model: 'giant-phone', x: 11, z: 1, w: 2, d: 1, h: 3.4, color: 0x111827, blocks: true },
    // HQ window on the back wall (prop station).
    { model: 'hq-window', x: 2, z: 1, w: 4, d: 1, h: 0.5, color: 0xd1d5db, blocks: true },
    // Feedback kiosk on the west side.
    { model: 'feedback-kiosk', x: 1, z: 6, w: 1, d: 1, h: 1.5, color: BLUE, blocks: true },
    // Voice of the customer: a big blue mailbox.
    { model: 'mailbox', x: 13, z: 6, w: 1, d: 1, h: 1.5, color: BLUE, blocks: true },
    // Dressing: beanbags and a standing desk.
    { model: 'beanbag', x: 5, z: 8, w: 1, d: 1, h: 0.6, color: 0xf97316, blocks: true },
    { model: 'beanbag', x: 6, z: 8, w: 1, d: 1, h: 0.6, color: 0x8b5cf6, blocks: true },
    { model: 'office-desk', x: 10, z: 8, w: 2, d: 1, h: 1.05, color: 0xe5e7eb, blocks: true },
  ],
  interactables: [
    { id: 'meta/external-feedback', kind: 'station', label: 'Feedback Kiosk', x: 3, z: 6.5, radius: 1.2, station: 'meta/external-feedback' },
    { id: 'meta/highlighted-features', kind: 'station', label: 'Feature Wall', x: 12, z: 3, radius: 1.2, station: 'meta/highlighted-features' },
    { id: 'meta/product-feedback', kind: 'station', label: 'Voice of the Customer', x: 12, z: 6.5, radius: 1.2, station: 'meta/product-feedback' },
    { id: 'meta/hq-window', kind: 'station', label: 'HQ Window', x: 4, z: 3, radius: 1.2, station: 'meta/hq-window' },
  ],
});
