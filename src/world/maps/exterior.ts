import type { Door, Interactable, MapDef, Prop, Zone } from './types';

// Exterior map, 52 x 60 tiles. Gyms run south to north up the west side with the main path beside them.
// Calvin's Court sits at the top of the path next to BetMGM, the Weightroom (side builds and hobbies, outdoors)
// is in the middle, and the spawn plaza is at the bottom. Everything is one short loop.
// (Shrunk from the plan's 80 x 60 after Calvin's M3 review: the court was too far and the side areas were easy to miss.)

const W = 52;
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
  fence: 0x6b7280,
  wood: 0x9a6b3f,
  kiosk: 0x38bdf8,
  bleacher: 0x9ca3af,
};

const zones: Zone[] = [
  // Main path: south to north past every gym, then a short run east to the court.
  { kind: 'path', x: 18, z: 7, w: 3, d: 45 },
  { kind: 'path', x: 21, z: 7, w: 9, d: 3 },
  // Gym door aprons.
  { kind: 'path', x: 15, z: 48, w: 3, d: 3 }, // UCLA
  { kind: 'path', x: 14, z: 36, w: 4, d: 3 }, // Deloitte
  { kind: 'path', x: 15, z: 22, w: 3, d: 3 }, // Meta
  { kind: 'path', x: 15, z: 7, w: 3, d: 3 }, // BetMGM
  // Plaza and its link to the main path.
  { kind: 'plaza', x: 26, z: 43, w: 14, d: 12 },
  { kind: 'path', x: 21, z: 48, w: 5, d: 3 },
  // Loop: plaza north to the Weightroom, Weightroom north to the court, and a spur from the main path.
  { kind: 'path', x: 32, z: 38, w: 3, d: 5 },
  { kind: 'path', x: 37, z: 17, w: 3, d: 6 },
  { kind: 'path', x: 21, z: 29, w: 7, d: 3 },
  // Calvin's Court.
  { kind: 'court', x: 30, z: 3, w: 16, d: 14 },
  // The Weightroom: rubber floor with a sprint lane along its south edge.
  { kind: 'concrete', x: 28, z: 23, w: 18, d: 15 },
  { kind: 'track', x: 29, z: 35, w: 16, d: 2 },
  // Pond (edge feature, blocks).
  { kind: 'water', x: 43, z: 44, w: 7, d: 8, blocks: true },
];

const props: Prop[] = [
  // Map edges: hedges, no invisible walls.
  { model: 'hedge', x: 0, z: 0, w: W, d: 1, h: 1.1, color: C.hedge, blocks: true },
  { model: 'hedge', x: 0, z: H - 1, w: W, d: 1, h: 1.1, color: C.hedge, blocks: true },
  { model: 'hedge', x: 0, z: 1, w: 1, d: H - 2, h: 1.1, color: C.hedge, blocks: true },
  { model: 'hedge', x: W - 1, z: 1, w: 1, d: H - 2, h: 1.1, color: C.hedge, blocks: true },

  // Gyms (doors face east, onto the main path).
  { model: 'gym-ucla', x: 5, z: 45, w: 10, d: 8, h: 5, color: C.uclaBrick, blocks: true, fades: true, label: 'UCLA GYM' },
  { model: 'gym-ucla-tower', x: 13, z: 45, w: 2, d: 2, h: 8, color: C.uclaBrick, blocks: true, fades: true },
  { model: 'gym-ucla-tower', x: 13, z: 51, w: 2, d: 2, h: 8, color: C.uclaBrick, blocks: true, fades: true },
  { model: 'gym-deloitte', x: 6, z: 33, w: 8, d: 8, h: 13, color: C.deloitte, blocks: true, fades: true, label: 'DELOITTE GYM' },
  { model: 'gym-meta', x: 4, z: 20, w: 11, d: 7, h: 3.5, color: C.meta, blocks: true, fades: true, label: 'META GYM' },
  { model: 'gym-betmgm', x: 4, z: 3, w: 11, d: 10, h: 6, color: C.betmgm, blocks: true, fades: true, label: 'BETMGM GYM' },

  // Meta's monument sign on the lawn by its entrance.
  { model: 'meta-sign', x: 16, z: 26, w: 1, d: 3, h: 2.6, color: C.metaBlue, blocks: true },

  // Lamp posts at each gym entrance.
  { model: 'lamp', x: 17, z: 47, w: 1, d: 1, h: 3.2, color: C.lamp, blocks: true },
  { model: 'lamp', x: 17, z: 35, w: 1, d: 1, h: 3.2, color: C.lamp, blocks: true },
  { model: 'lamp', x: 17, z: 21, w: 1, d: 1, h: 3.2, color: C.lamp, blocks: true },
  { model: 'lamp', x: 17, z: 10, w: 1, d: 1, h: 3.2, color: C.lamp, blocks: true },

  // Spawn plaza.
  { model: 'fountain', x: 32, z: 47, w: 3, d: 3, h: 1.2, color: C.stone, blocks: true, label: 'SPAWN PLAZA' },
  { model: 'signpost', x: 28, z: 45, w: 1, d: 1, h: 2.4, color: C.wood, blocks: true },
  { model: 'resume-kiosk', x: 37, z: 45, w: 1, d: 1, h: 1.8, color: C.kiosk, blocks: true },

  // Calvin's Court: fence with gaps at the west path and the south walk, bleachers, hoop.
  { model: 'fence', x: 29, z: 2, w: 18, d: 1, h: 2, color: C.fence, blocks: true },
  { model: 'fence', x: 29, z: 3, w: 1, d: 4, h: 2, color: C.fence, blocks: true },
  { model: 'fence', x: 29, z: 10, w: 1, d: 8, h: 2, color: C.fence, blocks: true },
  { model: 'fence', x: 46, z: 3, w: 1, d: 15, h: 2, color: C.fence, blocks: true },
  { model: 'fence', x: 30, z: 17, w: 7, d: 1, h: 2, color: C.fence, blocks: true },
  { model: 'fence', x: 40, z: 17, w: 6, d: 1, h: 2, color: C.fence, blocks: true },
  { model: 'bleachers', x: 32, z: 3, w: 12, d: 1, h: 1.6, color: C.bleacher, blocks: true, label: "CALVIN'S COURT" },
  // The hoop stands at the north end, in front of the bleachers, facing the camera.
  { model: 'hoop', x: 37, z: 4, w: 2, d: 1, h: 3.6, color: 0xe5e7eb, rotation: 0, blocks: true },
  // Loose balls for a shootaround (decor: you can walk through them).
  { model: 'basketball', x: 34, z: 9, w: 1, d: 1, h: 0.34, color: 0xe8752a, blocks: false },
  { model: 'basketball', x: 42, z: 12, w: 1, d: 1, h: 0.34, color: 0xe8752a, blocks: false },
  { model: 'basketball', x: 43, z: 6, w: 1, d: 1, h: 0.34, color: 0xe8752a, blocks: false },

  // A model jet on a stand, east of the court (the JetBlue challenge).
  { model: 'airplane', x: 47, z: 6, w: 3, d: 5, h: 2.6, color: 0xf8fafc, blocks: true },

  // The Weightroom (outdoors). Five stops: two side builds along the north edge, three hobbies below.
  { model: 'ticker-board', x: 30, z: 24, w: 3, d: 1, h: 2.6, color: 0x111827, blocks: true },
  { model: 'workbench', x: 42, z: 24, w: 2, d: 1, h: 0.9, color: C.wood, blocks: true },
  { model: 'chess-table', x: 30, z: 30, w: 1, d: 1, h: 0.9, color: C.stone, blocks: true },
  { model: 'hoop', x: 44, z: 30, w: 1, d: 1, h: 3.6, color: 0xe5e7eb, rotation: -Math.PI / 2, blocks: true },
  { model: 'mile-marker', x: 37, z: 34, w: 1, d: 1, h: 1.4, color: 0xf59e0b, blocks: true },
  // Weights, so it reads as a weightroom.
  { model: 'squat-rack', x: 36, z: 27, w: 2, d: 1, h: 2.3, color: 0x374151, blocks: true },
  { model: 'bench-press', x: 34, z: 30, w: 1, d: 2, h: 1.1, color: 0x374151, blocks: true },
  { model: 'dumbbell-rack', x: 39, z: 31, w: 2, d: 1, h: 0.9, color: 0x374151, blocks: true },
];

const doors: Door[] = [
  { id: 'door-ucla', x: 15, z: 49, facing: 'e', to: 'gym-ucla', color: C.uclaBlue },
  { id: 'door-deloitte', x: 14, z: 37, facing: 'e', to: 'gym-deloitte', color: C.deloitteGreen },
  { id: 'door-meta', x: 15, z: 23, facing: 'e', to: 'gym-meta', color: C.metaBlue },
  { id: 'door-betmgm', x: 15, z: 8, facing: 'e', to: 'gym-betmgm', color: C.betmgmGold },
];

const interactables: Interactable[] = [
  { id: 'plaza/signpost', kind: 'sign', label: 'Signpost', x: 28.5, z: 46.7, radius: 1.3, dialogue: 'plaza.signpost' },
  { id: 'plaza/resume-kiosk', kind: 'kiosk', label: 'Résumé Kiosk', x: 37.5, z: 46.7, radius: 1.3, href: '/resume.pdf' },

  // The Weightroom.
  { id: 'weightroom/sports-betting', kind: 'station', label: 'Sportsbook Ticker', x: 31.5, z: 26, radius: 1.2, station: 'weightroom/sports-betting' },
  { id: 'weightroom/chess', kind: 'station', label: 'Chess Table', x: 30.5, z: 32, radius: 1.2, station: 'weightroom/chess' },
  { id: 'weightroom/basketball', kind: 'station', label: 'Hoop', x: 42.6, z: 30.5, radius: 1.2, station: 'weightroom/basketball' },
  { id: 'weightroom/running', kind: 'station', label: 'Sprint Lane', x: 37.5, z: 36, radius: 1.2, station: 'weightroom/running' },
  // Just for fun: pick up the dumbbells and press them overhead.
  { id: 'weightroom/dumbbells', kind: 'lift', label: 'Grab the dumbbells', x: 40, z: 32.8, radius: 1.1 },

  // Shootaround: every loose ball on the court can be picked up and shot from where it lies.
  { id: 'court/ball-1', kind: 'shoot', label: 'Pick up the ball', x: 34.5, z: 9.5, radius: 1.3 },
  { id: 'court/ball-2', kind: 'shoot', label: 'Pick up the ball', x: 42.5, z: 12.5, radius: 1.3 },
  { id: 'court/ball-3', kind: 'shoot', label: 'Pick up the ball', x: 43.5, z: 6.5, radius: 1.3 },

  { id: 'court/jetblue', kind: 'station', label: 'Mini Jet', x: 48.5, z: 12.2, radius: 1.3, station: 'court/jetblue' },
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
  props: [...props, ...scatterTrees(42)],
  doors,
  interactables,
  npcs: [
    { id: 'calvin-plaza', label: 'Calvin', x: 30, z: 51, role: 'plaza', dialogue: 'plaza', faceX: 33.5, faceZ: 52.5 },
    // Top of the key at his court, in the #13 jersey. The 1-on-1 itself arrives in M6.
    { id: 'calvin-court', label: 'Calvin', x: 38, z: 12, role: 'court', dialogue: 'court', faceX: 34, faceZ: 17 },
  ],
  spawn: { x: 33.5, z: 52.5 },
  cameraBounds: { minX: 4, maxX: W - 4, minZ: 4, maxZ: H - 4 },
  // Arrows lead from the plaza to UCLA, north past every gym, and on to the court. Short spurs point into each door.
  // The Weightroom gets none on purpose: it's the detour for whenever, the gyms come first.
  guides: [
    [{ x: 30.5, z: 49.5 }, { x: 19.5, z: 49.5 }],
    [{ x: 19.5, z: 47 }, { x: 19.5, z: 8.5 }, { x: 28.5, z: 8.5 }],
    [{ x: 18.3, z: 49.5 }, { x: 16.2, z: 49.5 }],
    [{ x: 18.3, z: 37.5 }, { x: 15.2, z: 37.5 }],
    [{ x: 18.3, z: 23.5 }, { x: 16.2, z: 23.5 }],
    [{ x: 18.3, z: 8.5 }, { x: 16.2, z: 8.5 }],
  ],
};
