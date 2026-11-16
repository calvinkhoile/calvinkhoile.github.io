import * as THREE from 'three';
import type { Npc } from '../world/npc';
import type { Player } from '../world/player';

// Court animations for the 1-on-1. Kept cheap on purpose: characters slide along short paths with their run
// animation, and the ball flies on scripted arcs. The goal is readable and fun, not realistic.

// The hoop stands at the north end of the court facing south (toward the camera).
const RIM = new THREE.Vector3(38, 3.0, 5.48);
const PLAYER_SPOT = { x: 38, z: 10.6 };
const CALVIN_SPOT = { x: 38, z: 8.9 };
const NORTH = Math.PI; // facing the hoop
const SOUTH = 0;
const MAKE_CHANCE = 0.62; // shootaround

type Tween = { t: number; dur: number; step(k: number): void; done(): void };

export class CourtScene {
  private readonly ball: THREE.Mesh;
  private tweens: Tween[] = [];
  private readonly skip: boolean;
  active = false;

  constructor(
    root: THREE.Object3D,
    private readonly player: Player,
    private readonly calvin: Npc,
    reducedMotion: boolean,
  ) {
    this.skip = reducedMotion;
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), new THREE.MeshLambertMaterial({ color: 0xe8752a }));
    this.ball.castShadow = true;
    this.ball.visible = false;
    root.add(this.ball);
  }

  /** Put both players in position for a possession: visitor at the top of the key with the ball, Calvin guarding. */
  setup(): void {
    this.active = true;
    this.place();
  }

  teardown(): void {
    this.active = false;
    this.tweens = [];
    this.ball.visible = false;
    this.player.vx = this.player.vz = 0;
    // Calvin goes back to the top of the key. The visitor steps aside so they aren't standing in him.
    const home = this.calvin.home;
    this.calvin.x = home.x;
    this.calvin.z = home.z;
    this.player.teleport(36, 12.5);
  }

  private place(): void {
    this.player.teleport(PLAYER_SPOT.x, PLAYER_SPOT.z);
    this.player.facing = NORTH;
    this.player.object.rotation.y = NORTH;
    this.calvin.x = CALVIN_SPOT.x;
    this.calvin.z = CALVIN_SPOT.z;
    this.calvin.facing = SOUTH;
    this.holdBall(this.player.x, this.player.z);
  }

  private holdBall(x: number, z: number): void {
    this.ball.visible = true;
    // Held out in front, on the hoop side.
    this.ball.position.set(x + 0.24, 1.05, z - 0.32);
  }

  update(dt: number): void {
    for (const tw of [...this.tweens]) {
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.step(k);
      if (k >= 1) {
        this.tweens.splice(this.tweens.indexOf(tw), 1);
        tw.done();
      }
    }
  }

  private tween(dur: number, step: (k: number) => void): Promise<void> {
    if (this.skip) {
      step(1);
      return Promise.resolve();
    }
    return new Promise((done) => this.tweens.push({ t: 0, dur, step, done }));
  }

  /** Ball on an arc from where it is to a target, peaking `lift` above the higher end. */
  private arc(to: THREE.Vector3, dur: number, lift: number): Promise<void> {
    const from = this.ball.position.clone();
    const peak = Math.max(from.y, to.y) + lift;
    return this.tween(dur, (k) => {
      this.ball.position.lerpVectors(from, to, k);
      // Quadratic Bézier height: start, peak, end.
      this.ball.position.y = (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * peak + k * k * to.y;
    });
  }

  private movePlayer(x: number, z: number, dur: number): Promise<void> {
    const sx = this.player.x;
    const sz = this.player.z;
    return this.tween(dur, (k) => {
      this.player.teleport(sx + (x - sx) * k, sz + (z - sz) * k);
      this.player.facing = NORTH;
      this.player.object.rotation.y = NORTH;
      // Fake a ground speed so the run animation plays while the body slides.
      this.player.vx = k < 1 ? (x - sx) / dur : 0;
      this.player.vz = k < 1 ? (z - sz) / dur : 0;
      this.holdBall(this.player.x, this.player.z);
    });
  }

  private async swish(): Promise<void> {
    const below = RIM.clone().setY(1.6);
    const from = this.ball.position.clone();
    await this.tween(0.22, (k) => this.ball.position.lerpVectors(from, below, k));
    this.ball.visible = false;
  }

  // ----- shootaround (free play, no questions) -----

  /** Pick up a ball at (x, z) and square up to the hoop. */
  beginShootaround(x: number, z: number): void {
    this.player.teleport(x, z);
    this.player.facing = Math.atan2(RIM.x - x, RIM.z - z);
    this.player.object.rotation.y = this.player.facing;
    this.holdBall(x, z);
  }

  /** Put one up. Resolves with whether it went in. */
  async shoot(): Promise<boolean> {
    const made = Math.random() < MAKE_CHANCE;
    const x = this.player.x;
    const z = this.player.z;
    const dist = Math.hypot(RIM.x - x, RIM.z - z);
    this.ball.position.set(x + 0.1, 2.0, z - 0.2);
    if (made) {
      await this.arc(RIM, 0.5 + dist * 0.07, 1.6 + dist * 0.12);
      await this.swish();
    } else {
      // Front rim, and out.
      const rim = RIM.clone().add(new THREE.Vector3(0.2, 0.06, 0.24));
      await this.arc(rim, 0.5 + dist * 0.07, 1.6 + dist * 0.12);
      await this.arc(new THREE.Vector3(RIM.x + 2.2, 0.17, RIM.z + 2.6), 0.55, 0.9);
    }
    await this.tween(0.2, () => {});
    this.holdBall(x, z);
    return made;
  }

  endShootaround(): void {
    this.tweens = [];
    this.ball.visible = false;
  }

  /** Visitor scores: a deep three for hard questions, a drive past Calvin otherwise. */
  async make(points: number): Promise<void> {
    if (points === 3) {
      await this.arc(RIM, 0.95, 2.6);
    } else {
      await this.movePlayer(39.1, 7.3, 0.6);
      await this.arc(RIM, 0.42, 0.9);
    }
    await this.swish();
    await this.tween(0.25, () => {});
    this.place();
  }

  /** Visitor misses: Calvin blocks the shot, then pulls up and buries one. */
  async miss(): Promise<void> {
    await this.movePlayer(38.2, 9.9, 0.3);
    // The block: ball swatted back the way it came.
    await this.arc(new THREE.Vector3(36, 0.2, 12.6), 0.45, 1.4);
    // Calvin's turn.
    this.ball.position.set(this.calvin.x + 0.2, 1.5, this.calvin.z - 0.25);
    this.calvin.facing = NORTH;
    await this.arc(RIM, 0.9, 2.2);
    await this.swish();
    await this.tween(0.25, () => {});
    this.place();
  }
}
