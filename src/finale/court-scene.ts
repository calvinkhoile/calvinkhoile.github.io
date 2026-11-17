import * as THREE from 'three';
import { aimBone } from '../world/lift';
import type { Character } from '../world/character';
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
const JUMP = 0.38; // how high the visitor leaves the floor on a jumper
const BALL_R = 0.17;

const ease = (k: number) => k * k * (3 - 2 * k);
const L = THREE.MathUtils.lerp;

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
    // Two dark seams, so the backspin shows.
    const seam = new THREE.MeshBasicMaterial({ color: 0x3b1d0e });
    for (const r of [0, Math.PI / 2]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(BALL_R + 0.002, 0.008, 4, 20), seam);
      ring.rotation.y = r;
      this.ball.add(ring);
    }
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
    // Held out in front, at the waist.
    const f = this.player.facing;
    this.ball.position.set(x + Math.sin(f) * 0.34, 1.05, z + Math.cos(f) * 0.34);
  }

  update(dt: number): void {
    if (this.dribbling) this.dribbleT += dt;
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
  private arc(to: THREE.Vector3, dur: number, lift: number, spin = 0): Promise<void> {
    const from = this.ball.position.clone();
    const peak = Math.max(from.y, to.y) + lift;
    // Backspin: roll around the axis across the direction of travel.
    const axis = new THREE.Vector3(to.z - from.z, 0, from.x - to.x).normalize();
    let last = 0;
    return this.tween(dur, (k) => {
      if (spin && axis.lengthSq() > 0) this.ball.rotateOnWorldAxis(axis, -spin * (k - last) * dur);
      last = k;
      this.ball.position.lerpVectors(from, to, k);
      // Quadratic Bézier height: start, peak, end.
      this.ball.position.y = (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * peak + k * k * to.y;
    });
  }

  // ----- shootaround (free play, no questions) -----

  /** Pick up a ball at (x, z) and square up to the hoop. */
  beginShootaround(x: number, z: number): void {
    this.player.teleport(x, z);
    this.player.facing = Math.atan2(RIM.x - x, RIM.z - z);
    this.player.object.rotation.y = this.player.facing;
    this.holdBall(x, z);
    this.startDribble();
  }

  // ----- dribbling: from the moment the ball is picked up until the shot -----

  private dribbling = false;
  private dribbleT = 0;
  private readonly DRIBBLE_S = 0.52; // one bounce, hand to floor to hand

  private startDribble(): void {
    if (this.skip) return; // reduced motion: the ball is just held
    this.dribbling = true;
    const body = this.player.body;
    if (body) body.onPose = () => this.poseDribble();
  }

  private stopDribble(): void {
    this.dribbling = false;
  }

  /** Hand height (0 at the floor end, 1 at the top) for the current point of the bounce. */
  private dribbleHeight(): number {
    return Math.abs(Math.cos((this.dribbleT / this.DRIBBLE_S) * Math.PI));
  }

  private poseDribble(): void {
    const body = this.player.body;
    if (!body || !this.dribbling) return;
    const h = this.dribbleHeight();
    const hands = this.poseArms(body, this.player.object, 1, 'dribble', h);
    // The ball follows the dribbling hand across the floor, and bounces between it and the ground.
    const hand = hands[0];
    if (hand) this.ball.position.set(hand.x, BALL_R + (hand.y - 0.08 - BALL_R) * h, hand.z);
  }

  /** How far the shooter is from the rim, on the floor. Drives the size of the green window. */
  shotDistance(): number {
    return Math.hypot(RIM.x - this.player.x, RIM.z - this.player.z);
  }

  // ----- the jump shot: gather, rise, release at the top, land -----

  /** 0 = arms doing whatever the animation says, 1 = up in the shooting pose. */
  private arms = 0;
  /** While true, the ball rides in the hands (set every frame from the hand bones). */
  private inHands = false;
  private readonly facingQ = new THREE.Quaternion();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();

  /** Raise a character's arms toward a pose: a jump shot (shooting arm under the ball) or a block (both hands high). */
  private poseArms(body: Character, holder: THREE.Object3D, amount: number, style: 'shot' | 'block' | 'dribble', bounce = 0): THREE.Vector3[] {
    holder.getWorldQuaternion(this.facingQ);
    const k = ease(Math.min(1, amount));
    const inv = this.facingQ.clone().invert();
    const hands: THREE.Vector3[] = [];
    for (const [suffix, side, lead] of [['r', -1, true], ['l', 1, false]] as const) {
      const upper = body.bone(`upperarm_${suffix}`);
      const lower = body.bone(`lowerarm_${suffix}`);
      const hand = body.bone(`hand_${suffix}`);
      if (!upper || !lower || !hand) continue;
      // Which way is this arm's side, from the skeleton (the rig's left/right can be mirrored).
      const sx = Math.sign(holder.worldToLocal(upper.getWorldPosition(this.tmp)).x) || side;
      let up: THREE.Vector3;
      let fore: THREE.Vector3;
      if (style === 'dribble') {
        // Only the dribbling hand: elbow by the hip, forearm pumping as the ball comes up and goes down.
        if (!lead) continue;
        up = new THREE.Vector3(sx * 0.3, -0.8, 0.42);
        fore = new THREE.Vector3(sx * 0.12, L(-0.75, -0.15, bounce), 0.7);
      } else if (style === 'block') {
        // Both arms straight up, the lead hand reaching a bit forward for the ball.
        up = new THREE.Vector3(sx * 0.22, 1, lead ? 0.35 : 0.15);
        fore = new THREE.Vector3(sx * 0.05, 1, lead ? 0.4 : 0.15);
      } else {
        // Shooting arm: elbow up under the ball. Guide arm: out to the side of the ball.
        up = lead ? new THREE.Vector3(sx * 0.18, 0.7, 0.62) : new THREE.Vector3(sx * 0.55, 0.55, 0.55);
        fore = lead ? new THREE.Vector3(-sx * 0.08, 1, 0.18) : new THREE.Vector3(-sx * 0.45, 0.85, 0.2);
      }
      for (const [bone, child, dir] of [
        [upper, lower, up],
        [lower, hand, fore],
      ] as const) {
        // Blend from the animated direction to the posed one.
        const cur = child.getWorldPosition(this.tmp).sub(bone.getWorldPosition(this.tmp2)).normalize().applyQuaternion(inv);
        aimBone(bone, child, cur.lerp(dir.normalize(), k), this.facingQ);
      }
      hands.push(hand.getWorldPosition(new THREE.Vector3()));
    }
    return hands;
  }

  private poseShot(): void {
    const body = this.player.body;
    if (!body || this.arms <= 0) return;
    const hands = this.poseArms(body, this.player.object, this.arms, 'shot');
    if (this.inHands && hands.length === 2) {
      // Ball sits between the hands, just in front of them.
      const f = this.player.facing;
      this.ball.position.copy(hands[0]).add(hands[1]).multiplyScalar(0.5).add(this.tmp.set(Math.sin(f) * 0.12, 0.1, Math.cos(f) * 0.12));
    }
  }

  private setJump(y: number): void {
    const body = this.player.body;
    if (body) body.object.position.y = y;
  }

  /**
   * The visitor rises and lets it go. Resolves when the ball leaves the hands; `landed` resolves on the way down.
   * The ball's flight is up to the caller.
   */
  private async rise(hold?: Promise<unknown>, height = JUMP): Promise<{ landed: Promise<void> }> {
    const body = this.player.body;
    if (body) body.onPose = () => this.poseShot();
    this.player.vx = this.player.vz = 0;
    this.inHands = true;
    // Gather: ball comes up from the waist as the arms rise.
    const start = this.ball.position.clone();
    await this.tween(0.24, (k) => {
      this.arms = k;
      if (!body) this.ball.position.lerpVectors(start, this.tmp.copy(start).setY(2.2), k);
    });
    // Rise. Release just before the top.
    await this.tween(0.17, (k) => this.setJump(height * Math.sin((k * Math.PI) / 2)));
    // Hang at the top until the shooter lets go (the shot meter), floating up just a touch.
    if (hold) {
      let released = false;
      void hold.then(() => (released = true));
      // With reduced motion tweens finish instantly, so just wait (looping would never yield).
      if (this.skip) await hold;
      let hung = 0;
      while (!released) {
        await this.tween(1 / 30, (k) => {
          if (k >= 1) hung += 1 / 30;
          this.setJump(height + Math.min(0.08, hung * 0.12));
        });
      }
    }
    this.inHands = false;
    const top = this.player.body?.object.position.y ?? height;
    const landed = (async () => {
      await this.tween(0.2, (k) => this.setJump(top * Math.cos((k * Math.PI) / 2)));
      // Hold the follow-through a beat, then the arms come down.
      await this.tween(0.18, () => {});
      await this.tween(0.25, (k) => (this.arms = 1 - k));
      this.arms = 0;
      if (body && !this.inHands) body.onPose = null;
    })();
    return { landed };
  }

  /** Ball drops through the net and bounces back out to the visitor. */
  private async throughAndBack(): Promise<void> {
    const below = RIM.clone().setY(1.9);
    const from = this.ball.position.clone();
    await this.tween(0.24, (k) => this.ball.position.lerpVectors(from, below, k * k));
    await this.bounceBack(RIM.clone().setY(BALL_R).add(this.tmp.set(0.1, 0, 0.5)), 0.28);
  }

  /** From wherever the ball is: hit the floor at `floor`, take one more bounce toward the visitor, then into their hands. */
  private async bounceBack(floor: THREE.Vector3, dur: number): Promise<void> {
    await this.arc(floor, dur, 0.05, 6);
    const px = this.player.x;
    const pz = this.player.z;
    const mid = new THREE.Vector3(floor.x + (px - floor.x) * 0.55, BALL_R, floor.z + (pz - floor.z) * 0.55);
    await this.arc(mid, 0.45, 0.9, 5);
    const f = this.player.facing;
    await this.arc(new THREE.Vector3(px + Math.sin(f) * 0.34, 1.05, pz + Math.cos(f) * 0.34), 0.36, 0.45, 4);
  }

  /** Put one up. Resolves with whether it went in, once the ball is back in the visitor's hands. */
  async shoot(release?: Promise<boolean>): Promise<boolean> {
    let made = Math.random() < MAKE_CHANCE;
    const x = this.player.x;
    const z = this.player.z;
    const dist = Math.hypot(RIM.x - x, RIM.z - z);
    this.player.facing = Math.atan2(RIM.x - x, RIM.z - z);
    this.player.object.rotation.y = this.player.facing;
    // Pick up the dribble: the ball comes up into the shooting pocket.
    this.stopDribble();
    this.holdBall(x, z);
    const { landed } = await this.rise(release?.then((m) => (made = m)));
    const flight = 0.55 + dist * 0.06;
    const lift = 1.5 + dist * 0.12;
    if (made) {
      await this.arc(RIM.clone().setY(RIM.y + 0.12), flight, lift, 14);
      await this.throughAndBack();
    } else {
      // Off the front or the side of the rim, then out.
      const side = Math.random() < 0.5 ? -1 : 1;
      const rim = RIM.clone().add(new THREE.Vector3(side * 0.2, 0.12, 0.26));
      await this.arc(rim, flight, lift, 14);
      const out = new THREE.Vector3(RIM.x + side * 1.6, BALL_R, RIM.z + 1.8);
      await this.bounceBack(out, 0.5);
    }
    await landed;
    this.holdBall(this.player.x, this.player.z);
    this.startDribble();
    return made;
  }

  /** Five straight: the ball glows. */
  setOnFire(on: boolean): void {
    const m = this.ball.material as THREE.MeshLambertMaterial;
    m.emissive.setHex(on ? 0xff5a00 : 0x000000);
    m.emissiveIntensity = on ? 0.9 : 0;
  }

  /** Arcade cues for the plays (callouts, shake), wired up by the game. No-ops until set. */
  cue: (text: string, tone: 'good' | 'bad' | 'hype', shake?: 'soft' | 'hard') => void = () => {};

  /** Where the camera should look during the shootaround: between the shooter and the hoop, so both are in frame. */
  shotFocus(): { x: number; z: number } {
    return { x: this.player.x + (RIM.x - this.player.x) * 0.5, z: this.player.z + (RIM.z - this.player.z) * 0.5 };
  }

  endShootaround(): void {
    this.stopDribble();
    this.tweens = [];
    this.ball.visible = false;
    this.arms = 0;
    this.inHands = false;
    this.setJump(0);
    const body = this.player.body;
    if (body) body.onPose = null;
  }

  // ----- the closing play, after the final whistle -----

  private calvinArms = 0;

  /** One dribble from hand to hand: the ball goes down to the floor between the two spots and back up. */
  private dribbleTo(x: number, z: number, dur: number, calvinTo: { x: number; z: number } | null, calvinLag = 0.12): Promise<void> {
    const sx = this.player.x;
    const sz = this.player.z;
    const cx = this.calvin.x;
    const cz = this.calvin.z;
    const f = this.player.facing;
    const fx = Math.sin(f) * 0.34;
    const fz = Math.cos(f) * 0.34;
    return this.tween(dur, (k) => {
      const e = ease(k);
      this.player.teleport(sx + (x - sx) * e, sz + (z - sz) * e);
      this.player.facing = f;
      this.player.object.rotation.y = f;
      this.player.vx = k < 1 ? (x - sx) / dur : 0;
      this.player.vz = k < 1 ? (z - sz) / dur : 0;
      // Down to the floor at the midpoint, back up to the hand.
      const bounce = 1 - Math.abs(2 * k - 1);
      this.ball.position.set(this.player.x + fx, 1.0 - bounce * (1.0 - BALL_R), this.player.z + fz);
      if (calvinTo) {
        // Calvin slides with the ball, a beat behind.
        const c = ease(Math.max(0, (k - calvinLag) / (1 - calvinLag)));
        this.calvin.x = cx + (calvinTo.x - cx) * c;
        this.calvin.z = cz + (calvinTo.z - cz) * c;
      }
    });
  }

  /**
   * After the last possession: the visitor breaks Calvin down with a couple of crossovers and drives.
   * Won: Calvin bites on the last cross and the visitor lays it in. Lost: Calvin recovers and sends it into the bleachers.
   */
  async finalPlay(won: boolean): Promise<void> {
    if (this.skip) return;
    this.place();
    this.player.facing = NORTH;
    const body = this.player.body;
    const cbody = this.calvin.character;
    cbody.onPose = () => {
      if (this.calvinArms > 0) this.poseArms(cbody, cbody.object, this.calvinArms, 'block');
    };
    await this.tween(0.35, () => {});
    // Jab and cross, left then right. Calvin stays in front.
    await this.dribbleTo(37.3, 10.4, 0.34, { x: 37.4, z: CALVIN_SPOT.z });
    await this.dribbleTo(37.3, 10.4, 0.22, null); // hesitation: a dribble in place
    await this.dribbleTo(38.8, 10.3, 0.3, { x: 38.7, z: CALVIN_SPOT.z });
    if (won) {
      // Back to the left; Calvin guesses right and gets left behind.
      await this.dribbleTo(37.6, 10.1, 0.26, { x: 39.4, z: CALVIN_SPOT.z + 0.2 }, 0);
      await this.dribbleTo(37.4, 7.4, 0.42, null);
      await this.dribbleTo(37.7, 6.5, 0.24, null);
      const { landed } = await this.rise();
      // Soft off the glass and in.
      await this.arc(RIM.clone().setY(RIM.y + 0.1), 0.42, 0.55, 8);
      this.cue('GAME', 'hype', 'hard');
      await this.throughAndBack();
      await landed;
    } else {
      // Calvin cuts off the drive and meets the visitor at the rim.
      await this.dribbleTo(38.4, 7.6, 0.42, { x: 38.4, z: 6.7 }, 0);
      const jump = this.tween(0.5, (k) => {
        this.calvin.lift = 0.6 * Math.sin(k * Math.PI);
        this.calvinArms = Math.min(1, k * 3);
      });
      const { landed } = await this.rise();
      // Ball barely leaves the hand before Calvin swats it.
      await this.arc(new THREE.Vector3(38.4, 3.0, 6.9), 0.14, 0.05, 4);
      this.cue('REJECTED', 'bad', 'hard');
      await this.arc(new THREE.Vector3(42.6, BALL_R, 10.8), 0.6, 1.6, 22);
      await Promise.all([jump, landed]);
      this.calvin.lift = 0;
      await this.tween(0.25, (k) => (this.calvinArms = 1 - k));
      // It rolls away.
      await this.arc(new THREE.Vector3(43.4, BALL_R, 11.6), 0.4, 0.3, 6);
    }
    this.calvinArms = 0;
    this.calvin.lift = 0;
    cbody.onPose = null;
    if (body) body.onPose = null;
    await this.tween(0.5, () => {});
  }

  private twos = 0;
  /** Calvin has the ball: it rides between his hands while his arms are posed. */
  private calvinHasBall = false;

  /** Pose Calvin's arms each frame (block or shot), and carry the ball if he has it. */
  private bindCalvin(style: () => 'shot' | 'block'): () => void {
    const cbody = this.calvin.character;
    cbody.onPose = () => {
      if (this.calvinArms <= 0) return;
      const hands = this.poseArms(cbody, cbody.object, this.calvinArms, style());
      if (this.calvinHasBall && hands.length === 2) {
        const f = this.calvin.facing;
        this.ball.position.copy(hands[0]).add(hands[1]).multiplyScalar(0.5).add(this.tmp.set(Math.sin(f) * 0.12, 0.1, Math.cos(f) * 0.12));
      }
    };
    return () => {
      cbody.onPose = null;
      this.calvinArms = 0;
      this.calvin.lift = 0;
      this.calvin.lockFacing = null;
      this.calvinHasBall = false;
    };
  }

  private async afterPlay(): Promise<void> {
    const body = this.player.body;
    if (body) body.onPose = null;
    this.arms = 0;
    this.setJump(0);
    await this.tween(0.35, () => {});
    this.place();
  }

  /**
   * Visitor scores. Threes are a step-back from deep; twos alternate between a crossover dunk and a Euro step layup.
   */
  async make(points: number): Promise<void> {
    if (this.skip) return;
    this.place();
    if (points === 3) {
      // Jab, step back behind the arc, and let it fly over a late closeout.
      await this.dribbleTo(38.6, 10.3, 0.26, { x: 38.5, z: CALVIN_SPOT.z + 0.3 });
      await this.dribbleTo(37.9, 12.2, 0.32, null);
      const close = this.tween(0.5, (k) => (this.calvin.z = CALVIN_SPOT.z + 0.3 + 1.6 * ease(k)));
      const { landed } = await this.rise();
      await this.arc(RIM.clone().setY(RIM.y + 0.12), 1.0, 2.8, 14);
      this.cue('SPLASH', 'hype');
      await Promise.all([this.throughAndBack(), landed, close]);
    } else if (this.twos++ % 2 === 0) {
      // Crossover, blow by, throw it down.
      await this.dribbleTo(37.3, 10.4, 0.3, { x: 37.4, z: CALVIN_SPOT.z });
      await this.dribbleTo(38.9, 9.6, 0.26, { x: 37.2, z: CALVIN_SPOT.z }, 0);
      await this.dribbleTo(38.4, 6.9, 0.36, null);
      const { landed } = await this.rise(undefined, 0.95);
      // Over the rim, then down through it.
      await this.arc(RIM.clone().setY(RIM.y + 0.45), 0.16, 0.05, 6);
      const from = this.ball.position.clone();
      await this.tween(0.1, (k) => this.ball.position.lerpVectors(from, RIM.clone().setY(2.2), k));
      this.cue('SLAM', 'hype', 'hard');
      await Promise.all([this.bounceBack(RIM.clone().setY(BALL_R).add(this.tmp.set(0, 0, 0.4)), 0.2), landed]);
    } else {
      // Euro step: one way, then the other, and kiss it off the glass.
      await this.dribbleTo(39.1, 8.6, 0.34, { x: 38.9, z: CALVIN_SPOT.z - 0.4 });
      await this.dribbleTo(37.4, 7.0, 0.3, null);
      const { landed } = await this.rise();
      await this.arc(RIM.clone().setY(RIM.y + 0.1), 0.45, 0.7, 8);
      this.cue('BUCKET', 'good');
      await Promise.all([this.throughAndBack(), landed]);
    }
    await this.afterPlay();
  }

  /** Visitor misses: Calvin meets them at the rim and sends it back, then pulls up and buries one. */
  async miss(): Promise<void> {
    if (this.skip) return;
    this.place();
    let style: 'shot' | 'block' = 'block';
    const release = this.bindCalvin(() => style);
    await this.dribbleTo(38.6, 9.9, 0.28, { x: 38.6, z: CALVIN_SPOT.z });
    await this.dribbleTo(38.5, 7.8, 0.36, { x: 38.4, z: 6.8 }, 0);
    // Both go up. Calvin gets there first.
    const jump = this.tween(0.52, (k) => {
      this.calvin.lift = 0.65 * Math.sin(k * Math.PI);
      this.calvinArms = Math.min(1, k * 3);
    });
    const { landed } = await this.rise();
    await this.arc(new THREE.Vector3(38.45, 3.0, 7.1), 0.12, 0.05, 4);
    this.cue('REJECTED', 'bad', 'hard');
    // Swatted out toward the top of the key, where Calvin goes and gets it.
    await this.arc(new THREE.Vector3(37.2, BALL_R, 11.4), 0.55, 1.4, 20);
    await Promise.all([jump, landed]);
    this.calvinArms = 0;
    const cx = this.calvin.x;
    const cz = this.calvin.z;
    await this.tween(0.45, (k) => {
      this.calvin.x = cx + (37.2 - cx) * ease(k);
      this.calvin.z = cz + (11.0 - cz) * ease(k);
    });
    // Calvin's pull-up.
    style = 'shot';
    this.calvin.lockFacing = NORTH;
    this.calvinHasBall = true;
    await this.tween(0.25, (k) => (this.calvinArms = k));
    await this.tween(0.17, (k) => (this.calvin.lift = 0.4 * Math.sin((k * Math.PI) / 2)));
    this.calvinHasBall = false;
    const down = this.tween(0.22, (k) => (this.calvin.lift = 0.4 * Math.cos((k * Math.PI) / 2)));
    await this.arc(RIM.clone().setY(RIM.y + 0.12), 0.85, 2.0, 14);
    this.cue('COOKED', 'bad');
    const below = RIM.clone().setY(1.9);
    const from = this.ball.position.clone();
    await this.tween(0.24, (k) => this.ball.position.lerpVectors(from, below, k * k));
    await Promise.all([this.arc(RIM.clone().setY(BALL_R).add(this.tmp.set(0.2, 0, 0.6)), 0.28, 0.05, 6), down]);
    await this.tween(0.25, (k) => (this.calvinArms = 1 - k));
    release();
    // Calvin walks back to his spot as the ball resets.
    const bx = this.calvin.x;
    const bz = this.calvin.z;
    await this.tween(0.4, (k) => {
      this.calvin.x = bx + (CALVIN_SPOT.x - bx) * ease(k);
      this.calvin.z = bz + (CALVIN_SPOT.z - bz) * ease(k);
    });
    await this.afterPlay();
  }
}
