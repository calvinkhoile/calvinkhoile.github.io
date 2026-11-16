// Map files are plain data so they can be authored and edited directly in code.
// Coordinates: x grows east, z grows south. 1 tile = 1 world unit. (x, z) is always the min (north-west) corner.

export type ZoneKind = 'path' | 'plaza' | 'concrete' | 'court' | 'track' | 'water';

export interface Zone {
  kind: ZoneKind;
  x: number;
  z: number;
  w: number;
  d: number;
  /** Water and similar zones stamp their footprint as blocked. */
  blocks?: boolean;
}

export interface Prop {
  /** Model key. In the graybox every model is a colored box. */
  model: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: number;
  rotation?: number;
  /** Blocking props stamp their footprint into the collision grid. */
  blocks: boolean;
  /** Floating text label (graybox only). */
  label?: string;
  /** Fades out when it sits between the camera and the player. */
  fades?: boolean;
}

export type Facing = 'n' | 'e' | 's' | 'w';

export interface Door {
  id: string;
  /** Walkable tile directly in front of the door. */
  x: number;
  z: number;
  /** Direction the door faces (out of the building). */
  facing: Facing;
  /** Scene the door leads to. */
  to: string;
  color: number;
}

export interface Interactable {
  id: string;
  kind: 'station' | 'sign' | 'kiosk' | 'lift' | 'shoot';
  label: string;
  /** Where the visitor stands to use it (center of the floor ring). Must be walkable. */
  x: number;
  z: number;
  radius: number;
  /** Station id from src/content/stations.ts (kind: station). */
  station?: string;
  /** Dialogue node key (kind: sign). */
  dialogue?: string;
  /** Link opened in a new tab (kind: kiosk). */
  href?: string;
}

export interface NpcSpawn {
  id: string;
  label: string;
  x: number;
  z: number;
  /** Which behavior the NPC has: the plaza guide, or a gym leader for a company. */
  role: 'plaza' | 'leader' | 'court';
  /** Dialogue prefix for leaders, e.g. "betmgm" -> betmgm.leader / betmgm.leaderDone. */
  dialogue: string;
  /** Point the NPC faces while idle. */
  faceX: number;
  faceZ: number;
}

/** Look of an interior room. */
export interface InteriorTheme {
  floor: 'casino' | 'hardwood' | 'office' | 'studio';
  wall: number;
  trim: number;
  /** Accent used for pinstripes and details. */
  accent: number;
  logo: string;
  /** Backing color behind the wall logo. */
  logoBg: number;
}

export interface MapDef {
  id: string;
  width: number;
  height: number;
  groundColor: number;
  zones: Zone[];
  props: Prop[];
  doors: Door[];
  interactables: Interactable[];
  npcs: NpcSpawn[];
  spawn: { x: number; z: number };
  /** Ground arrows that lead visitors along the main route. Each list is a polyline; arrows point along it. */
  guides?: { x: number; z: number }[][];
  /** Interiors: tighter camera, dark backdrop, no fog. */
  interior?: boolean;
  theme?: InteriorTheme;
  cameraBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}
