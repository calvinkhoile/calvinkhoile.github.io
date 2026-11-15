import { Grid, TILE_BLOCKED, TILE_DOOR, TILE_INTERACT } from '../engine/grid';
import type { MapDef } from './maps/types';

/** Build the collision grid from a map: blocking props and zones stamp their footprints. */
export function buildGrid(map: MapDef): Grid {
  const grid = new Grid(map.width, map.height);
  for (const z of map.zones) if (z.blocks) grid.stampRect(z.x, z.z, z.w, z.d, TILE_BLOCKED);
  for (const p of map.props) if (p.blocks) grid.stampRect(p.x, p.z, p.w, p.d, TILE_BLOCKED);
  for (const n of map.npcs) grid.setFlag(Math.floor(n.x), Math.floor(n.z), TILE_BLOCKED);
  for (const d of map.doors) grid.setFlag(d.x, d.z, TILE_DOOR);
  for (const i of map.interactables) {
    const r = Math.ceil(i.radius);
    for (let tz = Math.floor(i.z) - r; tz <= Math.floor(i.z) + r; tz++) {
      for (let tx = Math.floor(i.x) - r; tx <= Math.floor(i.x) + r; tx++) {
        if (Math.hypot(tx + 0.5 - i.x, tz + 0.5 - i.z) <= i.radius) grid.setFlag(tx, tz, TILE_INTERACT);
      }
    }
  }
  return grid;
}
