import * as THREE from 'three';
import type { Target } from './interactions';

// Loose basketballs on Calvin's Court. They roll: a nudge now and then (an uneven blacktop), friction, bounces off
// the court's edges and each other, and a kick when the visitor walks into one. Each ball carries its pick-up
// target with it, so "Pick up the ball" is always where the ball is.

const R = 0.17;
const FRICTION = 0.9; // per second, exponential: slows to a stop in a few seconds
const KICK = 1.6;

interface Ball {
  target: Target;
  mesh: THREE.Mesh;
  vx: number;
  vz: number;
  /** Seconds until the next idle nudge. */
  nudgeIn: number;
  held: boolean;
  radius: number;
}

export interface CourtBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class LooseBalls {
  private readonly balls: Ball[] = [];
  private suspended = false;
  private readonly axis = new THREE.Vector3();

  constructor(
    root: THREE.Object3D,
    targets: Target[],
    private readonly bounds: CourtBounds,
    /** Hide or show a ball's flashing ring. */
    private readonly setRingHidden: (id: string, hidden: boolean) => void,
  ) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xe8752a });
    const seam = new THREE.MeshBasicMaterial({ color: 0x3b1d0e });
    const geo = new THREE.SphereGeometry(R, 14, 10);
    const ringGeo = new THREE.TorusGeometry(R + 0.002, 0.008, 4, 20);
    for (const target of targets.filter((t) => t.kind === 'shoot')) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      // Two seams, so the roll reads.
      for (const r of [0, Math.PI / 2]) {
        const ring = new THREE.Mesh(ringGeo, seam);
        ring.rotation.y = r;
        mesh.add(ring);
      }
      mesh.position.set(target.x, R, target.z);
      root.add(mesh);
      this.balls.push({ target, mesh, vx: 0, vz: 0, nudgeIn: 1 + Math.random() * 4, held: false, radius: target.radius });
    }
  }

  /** The ball is in someone's hands: hide it and its ring, and take it out of reach. */
  hold(id: string): void {
    const b = this.balls.find((x) => x.target.id === id);
    if (!b) return;
    b.held = true;
    b.mesh.visible = false;
    b.target.radius = 0;
    this.setRingHidden(id, true);
  }

  /** Put it down where the visitor is, rolling a little the way they face. */
  drop(id: string, x: number, z: number, facing: number): void {
    const b = this.balls.find((x2) => x2.target.id === id);
    if (!b) return;
    b.held = false;
    b.mesh.visible = !this.suspended;
    b.target.radius = this.suspended ? 0 : b.radius;
    this.setRingHidden(id, this.suspended);
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);
    this.place(b, x + fx * 0.5, z + fz * 0.5);
    b.vx = fx * 0.9;
    b.vz = fz * 0.9;
  }

  /** During the 1-on-1 the loose balls are cleared off the floor. */
  setSuspended(on: boolean): void {
    if (on === this.suspended) return;
    this.suspended = on;
    for (const b of this.balls) {
      if (b.held) continue;
      b.mesh.visible = !on;
      b.target.radius = on ? 0 : b.radius;
      this.setRingHidden(b.target.id, on);
      b.vx = b.vz = 0;
    }
  }

  private place(b: Ball, x: number, z: number): void {
    const { minX, maxX, minZ, maxZ } = this.bounds;
    b.mesh.position.set(Math.min(maxX, Math.max(minX, x)), R, Math.min(maxZ, Math.max(minZ, z)));
    b.target.x = b.mesh.position.x;
    b.target.z = b.mesh.position.z;
    b.target.anchor = { x: b.target.x, y: R, z: b.target.z };
  }

  update(dt: number, player: { x: number; z: number; vx: number; vz: number }, frozen: boolean): void {
    if (this.suspended || frozen) return;
    const live = this.balls.filter((b) => !b.held);
    for (const b of live) {
      // Every few seconds a resting ball drifts off, like it found a slope in the blacktop.
      b.nudgeIn -= dt;
      if (b.nudgeIn <= 0) {
        b.nudgeIn = 3 + Math.random() * 5;
        if (Math.hypot(b.vx, b.vz) < 0.15) {
          const a = Math.random() * Math.PI * 2;
          const speed = 0.5 + Math.random() * 0.8;
          b.vx += Math.cos(a) * speed;
          b.vz += Math.sin(a) * speed;
        }
      }
      // Walk into one and it gets kicked along.
      const px = b.mesh.position.x - player.x;
      const pz = b.mesh.position.z - player.z;
      const pd = Math.hypot(px, pz);
      const moving = Math.hypot(player.vx, player.vz);
      if (pd < 0.55 && moving > 0.5) {
        b.vx = player.vx * 0.9 + (px / (pd || 1)) * KICK;
        b.vz = player.vz * 0.9 + (pz / (pd || 1)) * KICK;
      }
    }
    // Balls knock into each other.
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i];
        const c = live[j];
        const dx = c.mesh.position.x - a.mesh.position.x;
        const dz = c.mesh.position.z - a.mesh.position.z;
        const d = Math.hypot(dx, dz);
        if (d === 0 || d > R * 2) continue;
        const nx = dx / d;
        const nz = dz / d;
        const push = (R * 2 - d) / 2;
        a.mesh.position.x -= nx * push;
        a.mesh.position.z -= nz * push;
        c.mesh.position.x += nx * push;
        c.mesh.position.z += nz * push;
        // Swap the velocity along the line between them.
        const va = a.vx * nx + a.vz * nz;
        const vc = c.vx * nx + c.vz * nz;
        a.vx += (vc - va) * nx;
        a.vz += (vc - va) * nz;
        c.vx += (va - vc) * nx;
        c.vz += (va - vc) * nz;
      }
    }
    const { minX, maxX, minZ, maxZ } = this.bounds;
    const slow = Math.exp(-FRICTION * dt);
    for (const b of live) {
      b.vx *= slow;
      b.vz *= slow;
      if (Math.hypot(b.vx, b.vz) < 0.02) b.vx = b.vz = 0;
      let x = b.mesh.position.x + b.vx * dt;
      let z = b.mesh.position.z + b.vz * dt;
      // Off the fence or the baseline and back into play, losing some speed.
      if (x < minX || x > maxX) {
        x = Math.min(maxX, Math.max(minX, x));
        b.vx *= -0.6;
      }
      if (z < minZ || z > maxZ) {
        z = Math.min(maxZ, Math.max(minZ, z));
        b.vz *= -0.6;
      }
      const dist = Math.hypot(x - b.mesh.position.x, z - b.mesh.position.z);
      if (dist > 0) {
        // Roll: turn around the axis across the direction of travel, by distance over radius.
        this.axis.set(b.vz, 0, -b.vx).normalize();
        b.mesh.rotateOnWorldAxis(this.axis, dist / R);
      }
      this.place(b, x, z);
    }
  }
}
