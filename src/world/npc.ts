import type { Point } from '../engine/grid';
import type { Character } from './character';
import type { NpcSpawn } from './maps/types';

const NPC_SPEED = 3.6;
const TURN_RATE = 10;

/** A non-player character: idles at a home tile, can walk a path, and turns to face whoever is nearby. */
export class Npc {
  x: number;
  z: number;
  facing: number;
  private path: Point[] = [];
  private arrived: (() => void) | null = null;
  private speed = 0;

  constructor(
    readonly spawn: NpcSpawn,
    readonly character: Character,
  ) {
    this.x = Math.floor(spawn.x) + 0.5;
    this.z = Math.floor(spawn.z) + 0.5;
    this.facing = Math.atan2(spawn.faceX - this.x, spawn.faceZ - this.z);
    this.sync();
  }

  get home(): Point {
    return { x: Math.floor(this.spawn.x) + 0.5, z: Math.floor(this.spawn.z) + 0.5 };
  }

  get walking(): boolean {
    return this.path.length > 0;
  }

  /** Walk along waypoints. Resolves on arrival (or immediately for an empty path). */
  walk(path: Point[] | null): Promise<void> {
    this.arrived?.();
    this.path = path ? [...path] : [];
    if (this.path.length === 0) return Promise.resolve();
    return new Promise((resolve) => (this.arrived = resolve));
  }

  update(dt: number, lookAt: Point | null): void {
    let target = this.facing;
    if (this.path.length > 0) {
      const next = this.path[0];
      const dx = next.x - this.x;
      const dz = next.z - this.z;
      const dist = Math.hypot(dx, dz);
      const step = NPC_SPEED * dt;
      if (dist <= step) {
        this.x = next.x;
        this.z = next.z;
        this.path.shift();
        if (this.path.length === 0) {
          const done = this.arrived;
          this.arrived = null;
          done?.();
        }
      } else {
        this.x += (dx / dist) * step;
        this.z += (dz / dist) * step;
      }
      target = Math.atan2(dx, dz);
      this.speed = NPC_SPEED;
    } else {
      this.speed = 0;
      // Idle: face the visitor when they're close, otherwise the default direction.
      const near = lookAt && Math.hypot(lookAt.x - this.x, lookAt.z - this.z) < 5;
      target = near ? Math.atan2(lookAt!.x - this.x, lookAt!.z - this.z) : Math.atan2(this.spawn.faceX - this.x, this.spawn.faceZ - this.z);
    }
    if (this.lockFacing !== null) target = this.lockFacing;
    let diff = target - this.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.facing += diff * Math.min(1, TURN_RATE * dt);
    this.character.locomote(this.speed);
    this.character.update(dt);
    this.sync();
  }

  /** Height off the floor, for scripted jumps (the block in the finale). */
  lift = 0;
  /** When set, he turns to this heading instead of tracking the visitor (scripted plays). */
  lockFacing: number | null = null;

  private sync(): void {
    this.character.object.position.set(this.x, this.lift, this.z);
    this.character.object.rotation.y = this.facing;
  }
}
