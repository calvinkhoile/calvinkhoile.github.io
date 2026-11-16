import type { SceneId } from '../../content/stations';
import type { Interactable, InteriorTheme, MapDef, Prop } from './types';

// Every gym interior is the same 16 x 12 shell: full-height walls at the back (north, west), low curbs toward
// the camera, the exit in the middle of the south edge, and Calvin (gym leader) at the back center.
// A gym file only lists what's unique to it: theme, furniture, stations.

export const ROOM_W = 16;
export const ROOM_H = 12;

export interface RoomSpec {
  id: SceneId;
  /** Dialogue prefix: "<prefix>.leader", "<prefix>.leaderDone", "<prefix>.leaderAgain". */
  dialogue: string;
  theme: InteriorTheme;
  props: Prop[];
  interactables: Interactable[];
}

export function makeRoom(spec: RoomSpec): MapDef {
  const { wall, trim } = spec.theme;
  const shell: Prop[] = [
    { model: 'wall', x: 0, z: 0, w: ROOM_W, d: 1, h: 4.2, color: wall, blocks: true },
    { model: 'wall', x: 0, z: 1, w: 1, d: ROOM_H - 1, h: 4.2, color: wall, blocks: true },
    { model: 'curb', x: 1, z: ROOM_H - 1, w: 7, d: 1, h: 0.35, color: trim, blocks: true },
    { model: 'curb', x: 9, z: ROOM_H - 1, w: ROOM_W - 9, d: 1, h: 0.35, color: trim, blocks: true },
    { model: 'curb', x: ROOM_W - 1, z: 1, w: 1, d: ROOM_H - 2, h: 0.35, color: trim, blocks: true },
  ];
  return {
    id: spec.id,
    width: ROOM_W,
    height: ROOM_H,
    groundColor: 0x222222,
    interior: true,
    theme: spec.theme,
    zones: [],
    props: [...shell, ...spec.props],
    doors: [{ id: 'exit', x: 8, z: 11, facing: 's', to: 'exterior', color: trim }],
    interactables: spec.interactables,
    npcs: [{ id: `calvin-${spec.dialogue}`, label: 'Calvin', x: 8, z: 2, role: 'leader', dialogue: spec.dialogue, faceX: 8.5, faceZ: 10 }],
    spawn: { x: 8.5, z: 9.6 },
    cameraBounds: { minX: 5, maxX: 11, minZ: 4, maxZ: 9 },
  };
}
