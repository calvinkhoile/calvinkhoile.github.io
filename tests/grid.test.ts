import { describe, expect, it } from 'vitest';
import { Grid, TILE_BLOCKED } from '../src/engine/grid';
import { buildGrid } from '../src/world/collision';
import { exterior } from '../src/world/maps/exterior';

const R = 0.35;

function room(): Grid {
  // 10 x 10 with a wall across x = 5, gap at z = 8.
  const g = new Grid(10, 10);
  for (let z = 0; z < 10; z++) if (z !== 8) g.setFlag(5, z, TILE_BLOCKED);
  return g;
}

describe('Grid collision', () => {
  it('treats out-of-bounds as blocked', () => {
    const g = new Grid(4, 4);
    expect(g.isBlocked(-1, 0)).toBe(true);
    expect(g.isBlocked(4, 0)).toBe(true);
    expect(g.isBlocked(0, 0)).toBe(false);
  });

  it('stops at a wall without entering it', () => {
    const g = room();
    const p = g.moveCircle({ x: 3, z: 2.5 }, 5, 0, R);
    expect(p.x).toBeLessThanOrEqual(5 - R + 1e-3);
    expect(p.x).toBeGreaterThan(5 - R - 0.05);
    expect(g.circleBlocked(p.x, p.z, R)).toBe(false);
  });

  it('slides along a wall when moving diagonally into it', () => {
    const g = room();
    let p = { x: 4.6, z: 2.5 };
    for (let i = 0; i < 30; i++) p = g.moveCircle(p, 0.1, 0.1, R);
    expect(p.x).toBeLessThanOrEqual(5 - R + 1e-3);
    expect(p.z).toBeGreaterThan(5); // kept moving on the free axis
  });

  it('never tunnels through a wall on a huge step', () => {
    const g = room();
    const p = g.moveCircle({ x: 2, z: 2.5 }, 7, 0, R);
    expect(p.x).toBeLessThan(5);
  });
});

describe('Grid pathfinding', () => {
  it('routes through the gap in a wall', () => {
    const g = room();
    const path = g.findPath({ x: 2.5, z: 2.5 }, { x: 8.5, z: 2.5 }, R)!;
    expect(path).not.toBeNull();
    const end = path[path.length - 1];
    expect(end.x).toBeCloseTo(8.5);
    expect(end.z).toBeCloseTo(2.5);
    expect(path.some((p) => Math.floor(p.z) === 8)).toBe(true);
    // Every leg is walkable for the player's radius.
    let prev = { x: 2.5, z: 2.5 };
    for (const p of path) {
      expect(g.lineClear(prev, p, R)).toBe(true);
      prev = p;
    }
  });

  it('string-pulls an open-field path to a single segment', () => {
    const g = new Grid(20, 20);
    const path = g.findPath({ x: 1.5, z: 1.5 }, { x: 17.2, z: 9.7 }, R)!;
    expect(path).toHaveLength(1);
    expect(path[0]).toEqual({ x: 17.2, z: 9.7 });
  });

  it('retargets a blocked goal to the nearest walkable tile', () => {
    const g = room();
    const path = g.findPath({ x: 2.5, z: 2.5 }, { x: 5.5, z: 2.5 }, R)!;
    const end = path[path.length - 1];
    expect(g.isBlocked(Math.floor(end.x), Math.floor(end.z))).toBe(false);
  });

  it('retargets to the side of an obstacle that faces the player', () => {
    const g = new Grid(12, 12);
    g.stampRect(4, 4, 3, 3, TILE_BLOCKED); // 3x3 block, center tile (5, 5)
    const fromSouth = g.findPath({ x: 5.5, z: 10.5 }, { x: 5.5, z: 5.5 }, R)!;
    expect(Math.floor(fromSouth[fromSouth.length - 1].z)).toBe(7);
    const fromNorth = g.findPath({ x: 5.5, z: 1.5 }, { x: 5.5, z: 5.5 }, R)!;
    expect(Math.floor(fromNorth[fromNorth.length - 1].z)).toBe(3);
  });

  it('returns null when the goal is sealed off', () => {
    const g = new Grid(10, 10);
    for (let z = 0; z < 10; z++) g.setFlag(5, z, TILE_BLOCKED);
    expect(g.findPath({ x: 2.5, z: 2.5 }, { x: 8.5, z: 2.5 }, R)).toBeNull();
  });
});

describe('Exterior map', () => {
  const grid = buildGrid(exterior);

  it('spawns the player on open ground', () => {
    expect(grid.circleBlocked(exterior.spawn.x, exterior.spawn.z, R)).toBe(false);
  });

  it('has a walkable route from spawn to every door', () => {
    for (const door of exterior.doors) {
      expect(grid.isBlocked(door.x, door.z), `${door.id} tile is blocked`).toBe(false);
      const path = grid.findPath(exterior.spawn, { x: door.x + 0.5, z: door.z + 0.5 }, R);
      expect(path, `no route to ${door.id}`).not.toBeNull();
    }
  });

  it('has a walkable route from spawn to the court and the Blacktop', () => {
    expect(grid.findPath(exterior.spawn, { x: 66, z: 10 }, R)).not.toBeNull();
    expect(grid.findPath(exterior.spawn, { x: 65, z: 32 }, R)).not.toBeNull();
  });

  it('is fully enclosed (no walkable tile on the map edge)', () => {
    for (let x = 0; x < exterior.width; x++) {
      expect(grid.isBlocked(x, 0)).toBe(true);
      expect(grid.isBlocked(x, exterior.height - 1)).toBe(true);
    }
    for (let z = 0; z < exterior.height; z++) {
      expect(grid.isBlocked(0, z)).toBe(true);
      expect(grid.isBlocked(exterior.width - 1, z)).toBe(true);
    }
  });
});
