import type { Door, Interactable, MapDef, Prop, Zone } from './types';

// Exterior map, 80 x 60 tiles. Layout follows docs/mypark-world-plan.md section 5.1:
// gyms run south to north up the west side, spawn plaza in the south-west,
// Workshop mid-map, Blacktop on the east side, Calvin's Court in the north-east.

const W = 80;
const H = 60;

const C = {
  grass: 0x7bc67e,
  hedge: 0x3f8f4f,
  tree: 0x2f7d46,
  lamp: 0x4a4a4a,
  stone: 0xb8b2a7,
  uclaBrick: 0xa8553a,
  uclaBlue: 0x2774ae,
  deloitte: 0x1c1c1c,
  deloitteGreen: 0x86bc25,
  meta: 0xf2f4f7,
  metaBlue: 0x0866ff,
  betmgm: 0x15130f,
  betmgmGold: 0xc5a15a,
  workshop: 0x8a8f98,
  fence: 0x6b7280,
  wood: 0x9a6b3f,
  kiosk: 0x38bdf8,
  bleacher: 0x9ca3af,
};

const zones: Zone[] = [
  // Main path: south to north past every gym, then east along the top to the court.
  { kind: 'path', x: 18, z: 7, w: 3, d: 45 },
  { kind: 'path', x: 21, z: 7, w: 37, d: 3 },
  // Gym door aprons.
  { kind: 'path', x: 15, z: 48, w: 3, d: 3 }, // UCLA
  { kind: 'path', x: 14, z: 36, w: 4, d: 3 }, // Deloitte
  { kind: 'path', x: 15, z: 22, w: 3, d: 3 }, // Meta
  { kind: 'path', x: 15, z: 7, w: 3, d: 3 }, // BetMGM
  // Plaza and its link to the main path.
  { kind: 'plaza', x: 26, z: 43, w: 14, d: 12 },
  { kind: 'path', x: 21, z: 48, w: 5, d: 3 },
  // Workshop spur.
  { kind: 'path', x: 21, z: 29, w: 19, d: 3 },
  // Calvin's Court and the walk down to the Blacktop.
  { kind: 'court', x: 58, z: 3, w: 16, d: 14 },
  { kind: 'path', x: 65, z: 17, w: 3, d: 7 },
  // The Blacktop with its running track loop.
  { kind: 'concrete', x: 54, z: 24, w: 22, d: 18 },
  { kind: 'track', x: 56, z: 26, w: 18, d: 2 },
  { kind: 'track', x: 56, z: 38, w: 18, d: 2 },
  { kind: 'track', x: 56, z: 28, w: 2, d: 10 },
  { kind: 'track', x: 72, z: 28, w: 2, d: 10 },
  // Pond (edge feature, blocks).
  { kind: 'water', x: 45, z: 44, w: 9, d: 8, blocks: true },
];

const props: Prop[] = [
  // Map edges: hedges, no invisible walls.
  { model: 'hedge', x: 0, z: 0, w: W, d: 1, h: 1.1, color: C.hedge, blocks: true },
  { model: 'hedge', x: 0, z: H - 1, w: W, d: 1, h: 1.1, color: C.hedge, blocks: true },
  { model: 'hedge', x: 0, z: 1, w: 1, d: H - 2, h: 1.1, color: C.hedge, blocks: true },
  { model: 'hedge', x: W - 1, z: 1, w: 1, d: H - 2, h: 1.1, color: C.hedge, blocks: true },

  // Gyms (doors face east, onto the main path).
  { model: 'gym-ucla', x: 5, z: 45, w: 10, d: 8, h: 5, color: C.uclaBrick, blocks: true, fades: true, label: 'UCLA GYM' },
  { model: 'gym-ucla-tower', x: 5, z: 45, w: 2, d: 2, h: 8, color: C.uclaBrick, blocks: true, fades: true },
  { model: 'gym-ucla-tower', x: 5, z: 51, w: 2, d: 2, h: 8, color: C.uclaBrick, blocks: true, fades: true },
  { model: 'gym-deloitte', x: 6, z: 33, w: 8, d: 8, h: 13, color: C.deloitte, blocks: true, fades: true, label: 'DELOITTE GYM' },
  { model: 'gym-meta', x: 4, z: 20, w: 11, d: 7, h: 3.5, color: C.meta, blocks: true, fades: true, label: 'META GYM' },
  { model: 'gym-betmgm', x: 4, z: 3, w: 11, d: 10, h: 6, color: C.betmgm, blocks: true, fades: true, label: 'BETMGM GYM' },

  // Lamp posts at each gym entrance.
  { model: 'lamp', x: 17, z: 47, w: 1, d: 1, h: 3.2, color: C.lamp, blocks: true },
  { model: 'lamp', x: 17, z: 35, w: 1, d: 1, h: 3.2, color: C.lamp, blocks: true },
  { model: 'lamp', x: 17, z: 21, w: 1, d: 1, h: 3.2, color: C.lamp, blocks: true },
  { model: 'lamp', x: 17, z: 10, w: 1, d: 1, h: 3.2, color: C.lamp, blocks: true },

  // Spawn plaza.
  { model: 'fountain', x: 32, z: 47, w: 3, d: 3, h: 1.2, color: C.stone, blocks: true, label: 'SPAWN PLAZA' },
  { model: 'signpost', x: 28, z: 45, w: 1, d: 1, h: 2.4, color: C.wood, blocks: true },
  { model: 'resume-kiosk', x: 37, z: 45, w: 1, d: 1, h: 1.8, color: C.kiosk, blocks: true },

  // The Workshop (door faces west, onto the spur).
  { model: 'workshop', x: 40, z: 27, w: 8, d: 7, h: 4, color: C.workshop, blocks: true, fades: true, label: 'THE WORKSHOP' },

  // Calvin's Court: fence with gaps at the west path and the south walk, bleachers, hoop.
  { model: 'fence', x: 57, z: 2, w: 18, d: 1, h: 2, color: C.fence, blocks: true },
  { model: 'fence', x: 57, z: 3, w: 1, d: 4, h: 2, color: C.fence, blocks: true },
  { model: 'fence', x: 57, z: 10, w: 1, d: 8, h: 2, color: C.fence, blocks: true },
  { model: 'fence', x: 74, z: 3, w: 1, d: 15, h: 2, color: C.fence, blocks: true },
  { model: 'fence', x: 58, z: 17, w: 7, d: 1, h: 2, color: C.fence, blocks: true },
  { model: 'fence', x: 68, z: 17, w: 6, d: 1, h: 2, color: C.fence, blocks: true },
  { model: 'bleachers', x: 60, z: 3, w: 12, d: 1, h: 1.6, color: C.bleacher, blocks: true, label: "CALVIN'S COURT" },
  { model: 'hoop', x: 73, z: 9, w: 1, d: 2, h: 3.6, color: 0xe5e7eb, blocks: true },

  // The Blacktop.
  { model: 'mile-marker', x: 60, z: 25, w: 1, d: 1, h: 1.4, color: 0xf59e0b, blocks: true },
  { model: 'mile-marker', x: 69, z: 40, w: 1, d: 1, h: 1.4, color: 0xf59e0b, blocks: true },
  { model: 'chess-table', x: 61, z: 31, w: 1, d: 1, h: 0.9, color: C.stone, blocks: true },
  { model: 'chess-table', x: 61, z: 34, w: 1, d: 1, h: 0.9, color: C.stone, blocks: true },
  { model: 'coach-bench', x: 65, z: 35, w: 3, d: 1, h: 0.8, color: C.wood, blocks: true },
  { model: 'trophy-case', x: 68, z: 30, w: 2, d: 1, h: 2, color: 0xfacc15, blocks: true, label: 'THE BLACKTOP' },
  { model: 'hoop', x: 65, z: 29, w: 1, d: 1, h: 3.6, color: 0xe5e7eb, blocks: true },
];

const doors: Door[] = [
  { id: 'door-ucla', x: 15, z: 49, facing: 'e', to: 'gym-ucla', color: C.uclaBlue },
  { id: 'door-deloitte', x: 14, z: 37, facing: 'e', to: 'gym-deloitte', color: C.deloitteGreen },
  { id: 'door-meta', x: 15, z: 23, facing: 'e', to: 'gym-meta', color: C.metaBlue },
  { id: 'door-betmgm', x: 15, z: 8, facing: 'e', to: 'gym-betmgm', color: C.betmgmGold },
  { id: 'door-workshop', x: 39, z: 30, facing: 'w', to: 'workshop', color: 0xf97316 },
];

const interactables: Interactable[] = [
  { id: 'plaza/signpost', kind: 'sign', label: 'Signpost', x: 28.5, z: 45.5, radius: 1.5 },
  { id: 'plaza/resume-kiosk', kind: 'kiosk', label: 'Résumé Kiosk', x: 37.5, z: 45.5, radius: 1.5 },
];

// Trees: deterministic scatter on open grass, kept clear of paths, zones, and props.
function scatterTrees(count: number): Prop[] {
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const taken: { x: number; z: number; w: number; d: number }[] = [...zones, ...props];
  const margin = 2;
  const clear = (x: number, z: number) =>
    taken.every((r) => x + 1 + margin <= r.x || x - margin >= r.x + r.w || z + 1 + margin <= r.z || z - margin >= r.z + r.d);
  const trees: Prop[] = [];
  for (let tries = 0; trees.length < count && tries < count * 40; tries++) {
    const x = 2 + Math.floor(rand() * (W - 4));
    const z = 2 + Math.floor(rand() * (H - 4));
    if (!clear(x, z)) continue;
    const tree: Prop = { model: 'tree', x, z, w: 1, d: 1, h: 2.6 + rand() * 1.6, color: C.tree, blocks: true };
    trees.push(tree);
    taken.push(tree);
  }
  return trees;
}

export const exterior: MapDef = {
  id: 'exterior',
  width: W,
  height: H,
  groundColor: C.grass,
  zones,
  props: [...props, ...scatterTrees(60)],
  doors,
  interactables,
  npcs: [{ id: 'calvin-plaza', x: 30, z: 51, color: 0x0070d1 }],
  spawn: { x: 33.5, z: 52.5 },
  cameraBounds: { minX: 4, maxX: W - 4, minZ: 4, maxZ: H - 4 },
};
