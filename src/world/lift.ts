import * as THREE from 'three';
import type { Character } from './character';

// Overhead press, just for fun: pick up the dumbbells at the Weightroom rack and press them.
// There's no press clip in the animation library, so the arms are posed in code on top of the idle animation:
// each frame the upper arm and forearm are aimed at where they should point for the current height of the rep.

const REP_SECONDS = 0.95;

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
  private arms: Arm[] = [];
  private t = 0; // seconds into the current rep, or -1 when resting at the shoulders
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly world = new THREE.Quaternion();
  private readonly parent = new THREE.Quaternion();
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
  rep(): boolean {
    if (this.t >= 0) return false;
    this.t = 0;
    this.reps++;
    return true;
  }

  update(dt: number): void {
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
    this.holder.getWorldQuaternion(this.facing);
    for (const arm of this.arms) {
      // Directions in the character's own space (x to its side, y up, z forward), blended from rack to lockout.
      const upper = this.dir.set(arm.side * THREE.MathUtils.lerp(0.78, 0.28, h), THREE.MathUtils.lerp(-0.5, 0.96, h), THREE.MathUtils.lerp(0.36, 0.04, h));
      this.aim(arm.upper, arm.lower, upper);
      const fore = this.dir.set(arm.side * THREE.MathUtils.lerp(-0.12, -0.03, h), 1, THREE.MathUtils.lerp(0.2, 0, h));
      this.aim(arm.lower, arm.hand, fore);
      // The dumbbell sits in the fist, bar level.
      arm.hand.getWorldPosition(this.a);
      this.holder.worldToLocal(this.a);
      arm.bell.position.copy(this.a).add(this.b.set(0, 0.06, 0.02));
    }
  }

  /** Rotate `bone` so the segment from it to `child` points along `dirLocal` (given in character space). */
  private aim(bone: THREE.Object3D, child: THREE.Object3D, dirLocal: THREE.Vector3): void {
    bone.updateWorldMatrix(true, true);
    bone.getWorldPosition(this.a);
    child.getWorldPosition(this.b);
    const current = this.b.sub(this.a).normalize();
    const wanted = dirLocal.normalize().applyQuaternion(this.facing);
    this.q.setFromUnitVectors(current, wanted);
    bone.getWorldQuaternion(this.world).premultiply(this.q);
    bone.parent!.getWorldQuaternion(this.parent).invert();
    bone.quaternion.copy(this.parent.multiply(this.world));
    bone.updateMatrixWorld(true);
  }
}
