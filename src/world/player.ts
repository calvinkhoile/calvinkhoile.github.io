import * as THREE from 'three';
import type { Grid, Point } from '../engine/grid';
import type { InputState } from '../engine/input';

export const WALK_SPEED = 4;
export const SPRINT_SPEED = 6.5;
export const PLAYER_RADIUS = 0.35;
const ACCEL = SPRINT_SPEED / 0.08; // ~80ms to full speed, no ice-skating
const TURN_RATE = 14; // rad/s the model turns toward its heading
const AUTO_SPRINT_DISTANCE = 12; // click/tap-to-move sprints on long trips

export class Player {
  readonly object = new THREE.Group();
  x: number;
  z: number;
  vx = 0;
  vz = 0;
  facing = 0;
  path: Point[] = [];
  private stuckTime = 0;

  constructor(x: number, z: number) {
    this.x = x;
    this.z = z;

    // Graybox trainer: a capsule with a visor so facing is readable.
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(PLAYER_RADIUS, 1.8 - PLAYER_RADIUS * 2, 4, 12),
      new THREE.MeshLambertMaterial({ color: 0xff6b35 }),
    );
    body.position.y = 0.9;
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.16, 0.2),
      new THREE.MeshLambertMaterial({ color: 0x1f2937 }),
    );
    visor.position.set(0, 1.45, PLAYER_RADIUS - 0.04);
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(PLAYER_RADIUS * 1.25, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.04;
    this.object.add(body, visor, shadow);
    this.sync();
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vz);
  }

  get moving(): boolean {
    return this.speed > 0.05;
  }

  setPath(path: Point[] | null): void {
    this.path = path ?? [];
    this.stuckTime = 0;
  }

  teleport(x: number, z: number): void {
    this.x = x;
    this.z = z;
    this.vx = this.vz = 0;
    this.path = [];
    this.sync();
  }

  update(dt: number, input: InputState, basis: { fx: number; fz: number; rx: number; rz: number }, grid: Grid): void {
    // Desired velocity: manual input wins and cancels any click-to-move path.
    let wantX = 0;
    let wantZ = 0;
    const mag = Math.hypot(input.moveX, input.moveY);
    if (mag > 0) {
      this.path = [];
      const top = input.sprint ? SPRINT_SPEED : WALK_SPEED;
      wantX = (basis.rx * input.moveX + basis.fx * input.moveY) * top;
      wantZ = (basis.rz * input.moveX + basis.fz * input.moveY) * top;
    } else if (this.path.length > 0) {
      const remaining = this.remainingPathLength();
      const top = remaining > AUTO_SPRINT_DISTANCE || input.sprint ? SPRINT_SPEED : WALK_SPEED;
      // Drop waypoints we've reached.
      while (this.path.length > 0 && Math.hypot(this.path[0].x - this.x, this.path[0].z - this.z) < 0.12) this.path.shift();
      const next = this.path[0];
      if (next) {
        const dx = next.x - this.x;
        const dz = next.z - this.z;
        const dist = Math.hypot(dx, dz);
        // Ease into the final waypoint so the player doesn't overshoot and jitter.
        const speed = this.path.length === 1 ? Math.min(top, Math.max(1.2, dist * 9)) : top;
        wantX = (dx / dist) * speed;
        wantZ = (dz / dist) * speed;
      }
    }

    // Accelerate toward the desired velocity.
    const ddx = wantX - this.vx;
    const ddz = wantZ - this.vz;
    const dv = Math.hypot(ddx, ddz);
    const maxDv = ACCEL * dt;
    if (dv <= maxDv) {
      this.vx = wantX;
      this.vz = wantZ;
    } else {
      this.vx += (ddx / dv) * maxDv;
      this.vz += (ddz / dv) * maxDv;
    }

    // Move with sliding collision, then keep only the velocity that actually happened.
    if (this.vx !== 0 || this.vz !== 0) {
      const moved = grid.moveCircle({ x: this.x, z: this.z }, this.vx * dt, this.vz * dt, PLAYER_RADIUS);
      const ax = (moved.x - this.x) / dt;
      const az = (moved.z - this.z) / dt;
      this.x = moved.x;
      this.z = moved.z;

      if (this.path.length > 0) {
        // Give up on a path if something keeps us from making progress.
        this.stuckTime = Math.hypot(ax, az) < 0.3 ? this.stuckTime + dt : 0;
        if (this.stuckTime > 0.5) this.setPath(null);
      }
      // Face the direction of travel (the intent, so sliding along a wall still looks right).
      if (Math.hypot(wantX, wantZ) > 0.2) {
        const target = Math.atan2(wantX, wantZ);
        let diff = target - this.facing;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.facing += diff * Math.min(1, TURN_RATE * dt);
      }
      this.vx = ax;
      this.vz = az;
    }
    this.sync();
  }

  private remainingPathLength(): number {
    let len = 0;
    let px = this.x;
    let pz = this.z;
    for (const p of this.path) {
      len += Math.hypot(p.x - px, p.z - pz);
      px = p.x;
      pz = p.z;
    }
    return len;
  }

  private sync(): void {
    this.object.position.set(this.x, 0, this.z);
    this.object.rotation.y = this.facing;
  }
}
