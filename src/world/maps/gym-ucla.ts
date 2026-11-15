import { makeRoom } from './interior-base';

// UCLA gym: a campus gymnasium. Graduation stage, club fair booths, internship job board.
const BRICK = 0x8a4630;
const BLUE = 0x2774ae;
const GOLD = 0xffd100;

export const gymUcla = makeRoom({
  id: 'gym-ucla',
  dialogue: 'ucla',
  theme: { floor: 'hardwood', wall: BRICK, trim: BLUE, accent: GOLD, logo: '/images/logos/ucla.webp', logoBg: 0xffffff },
  props: [
    // Graduation stage against the back wall.
    { model: 'grad-stage', x: 2, z: 1, w: 4, d: 2, h: 0.4, color: 0x1f4f7a, blocks: true },
    // Club fair: three booths along the east side.
    { model: 'club-booth', x: 13, z: 3, w: 1, d: 2, h: 2.2, color: BLUE, blocks: true },
    { model: 'club-booth', x: 13, z: 6, w: 1, d: 2, h: 2.2, color: GOLD, blocks: true },
    { model: 'club-booth', x: 11, z: 1, w: 2, d: 1, h: 2.2, color: 0xe5e7eb, blocks: true },
    // Internship job board on the west wall.
    { model: 'job-board', x: 1, z: 5, w: 1, d: 3, h: 2.6, color: 0xb08968, blocks: true },
    // Dressing: backpack bench and a ball rack.
    { model: 'bench', x: 5, z: 8, w: 2, d: 1, h: 0.5, color: 0x9a6b3f, blocks: true },
    { model: 'ball-rack', x: 1, z: 2, w: 1, d: 2, h: 1.2, color: 0xf97316, blocks: true },
  ],
  interactables: [
    { id: 'ucla/graduation', kind: 'station', label: 'Graduation Stage', x: 4, z: 4, radius: 1.2, station: 'ucla/graduation' },
    { id: 'ucla/clubs', kind: 'station', label: 'Club Fair', x: 11.8, z: 4.6, radius: 1.2, station: 'ucla/clubs' },
    { id: 'ucla/internships', kind: 'station', label: 'Internship Board', x: 3, z: 6.5, radius: 1.2, station: 'ucla/internships' },
  ],
});
