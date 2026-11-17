import * as THREE from 'three';
import type { Character } from './character';

// Dumbbells, just for fun: pick them up at the Weightroom rack and do curls or overhead presses.
// There's no press clip in the animation library, so the arms are posed in code on top of the idle animation:
// each frame the upper arm and forearm are aimed at where they should point for the current height of the rep.

const REP_SECONDS = 0.95;
/** How fast the arms move between the curl stance (hands at the hips) and the press rack (hands at the shoulders). */
const SWITCH_SECONDS = 0.35;

export type Exercise = 'curl' | 'press';

interface Arm {
  upper: THREE.Object3D;
  lower: THREE.Object3D;
  hand: THREE.Object3D;
  side: number;
  bell: THREE.Group;
}

function dumbbell(): THREE.Group {
  const g = new THREE.Group();
  const steel = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 });
  const plate = new THREE.MeshLambertMaterial({ color: 0x111827 });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.34, 8).rotateZ(Math.PI / 2), steel);
  g.add(bar);
  for (const x of [-0.15, 0.15]) {
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.09, 10).rotateZ(Math.PI / 2), plate);
    head.position.x = x;
    g.add(head);
  }
  return g;
}

export class LiftMode {
  reps = 0;
  exercise: Exercise = 'curl';
  /** 0 = curl stance, 1 = press stance. Eases toward the current exercise. */
  private blend = 0;
  private arms: Arm[] = [];
  private t = 0; // seconds into the current rep, or -1 when resting at the shoulders
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly facing = new THREE.Quaternion();

  constructor(
    private readonly character: Character,
    /** Group the dumbbells are drawn in (the player's object, so they move and turn with the player). */
    private readonly holder: THREE.Object3D,
  ) {
    this.t = -1;
    for (const suffix of ['l', 'r']) {
      const upper = character.bone(`upperarm_${suffix}`);
      const lower = character.bone(`lowerarm_${suffix}`);
      const hand = character.bone(`hand_${suffix}`);
      if (!upper || !lower || !hand) continue;
      // Which side of the body this arm is on, read from the skeleton rather than assumed from the name.
      holder.updateMatrixWorld(true);
      const local = holder.worldToLocal(upper.getWorldPosition(new THREE.Vector3()));
      const bell = dumbbell();
      holder.add(bell);
      this.arms.push({ upper, lower, hand, side: Math.sign(local.x) || 1, bell });
    }
    character.onPose = () => this.pose();
  }

  get active(): boolean {
    return this.arms.length > 0;
  }

  /** Start a rep. Ignored while one is already in progress. */
  rep(exercise: Exercise = this.exercise): boolean {
    if (this.t >= 0) return false;
    if (exercise !== this.exercise) {
      // Switch stance first; the rep starts once the arms are in place.
      this.exercise = exercise;
      this.queued = true;
      this.reps++;
      return true;
    }
    this.t = 0;
    this.reps++;
    return true;
  }

  private queued = false;

  update(dt: number): void {
    const goal = this.exercise === 'press' ? 1 : 0;
    const step = dt / SWITCH_SECONDS;
    this.blend = goal > this.blend ? Math.min(goal, this.blend + step) : Math.max(goal, this.blend - step);
    if (this.queued && this.blend === goal && this.t < 0) {
      this.queued = false;
      this.t = 0;
    }
    if (this.t >= 0) {
      this.t += dt;
      if (this.t >= REP_SECONDS) this.t = -1;
    }
  }

  /** Put the dumbbells back and hand the arms back to the normal animation. */
  stop(): void {
    this.character.onPose = null;
    for (const arm of this.arms) this.holder.remove(arm.bell);
    this.arms = [];
  }

  /** 0 at the shoulders, 1 locked out overhead. */
  private height(): number {
    return this.t < 0 ? 0 : Math.sin((this.t / REP_SECONDS) * Math.PI) ** 0.8;
  }

  private pose(): void {
    const h = this.height();
    const k = this.blend * this.blend * (3 - 2 * this.blend); // smoothstep between stances
    this.holder.getWorldQuaternion(this.facing);
    const L = THREE.MathUtils.lerp;
    for (const arm of this.arms) {
      const x = arm.side;
      // Directions in the character's own space (x to its side, y up, z forward).
      // Each exercise only uses the rep height when it's the one being done.
      const hc = this.exercise === 'curl' ? h : 0;
      const hp = this.exercise === 'press' ? h : 0;
      // Curl: elbows pinned at the sides, forearms swing from hanging down to up by the shoulders.
      const cu = [x * 0.12, -1, 0.06];
      const cf = [x * 0.06, L(-1, 0.85, hc), L(0.12, 0.55, hc)];
      // Press: racked with elbows out and forearms vertical, then pushed straight up to lockout.
      const pu = [x * L(1, 0.32, hp), L(-0.08, 1, hp), L(0.22, 0.02, hp)];
      const pf = [x * L(0.02, 0.08, hp), 1, L(0.06, 0, hp)];
      this.aim(arm.upper, arm.lower, this.dir.set(L(cu[0], pu[0], k), L(cu[1], pu[1], k), L(cu[2], pu[2], k)));
      this.aim(arm.lower, arm.hand, this.dir.set(L(cf[0], pf[0], k), L(cf[1], pf[1], k), L(cf[2], pf[2], k)));
      // The dumbbell sits in the fist, bar level.
      arm.hand.getWorldPosition(this.a);
      this.holder.worldToLocal(this.a);
      arm.bell.position.copy(this.a).add(this.b.set(0, L(0, 0.06, k), 0.02));
    }
  }

  private aim(bone: THREE.Object3D, child: THREE.Object3D, dirLocal: THREE.Vector3): void {
    aimBone(bone, child, dirLocal, this.facing);
  }
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _world = new THREE.Quaternion();
const _parent = new THREE.Quaternion();

/**
 * Rotate `bone` so the segment from it to `child` points along `dirLocal`, given in the character's own space
 * (x to its side, y up, z forward). `facing` is the character's world rotation. Used to pose arms in code.
 */
export function aimBone(bone: THREE.Object3D, child: THREE.Object3D, dirLocal: THREE.Vector3, facing: THREE.Quaternion): void {
  bone.updateWorldMatrix(true, true);
  bone.getWorldPosition(_a);
  child.getWorldPosition(_b);
  const current = _b.sub(_a).normalize();
  const wanted = dirLocal.normalize().applyQuaternion(facing);
  _q.setFromUnitVectors(current, wanted);
  bone.getWorldQuaternion(_world).premultiply(_q);
  bone.parent!.getWorldQuaternion(_parent).invert();
  bone.quaternion.copy(_parent.multiply(_world));
  bone.updateMatrixWorld(true);
}
