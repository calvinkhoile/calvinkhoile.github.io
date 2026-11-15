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
  kind: 'station' | 'sign' | 'kiosk';
  label: string;
  x: number;
  z: number;
  radius: number;
}

export interface NpcSpawn {
  id: string;
  x: number;
  z: number;
  color: number;
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
  cameraBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}
