import * as THREE from 'three';
import type { Occluder } from './art';

/** Fade buildings toward 30% when they block the view of the player, back to solid when they don't. */
export class OccluderFader {
  private readonly ray = new THREE.Raycaster();
  private readonly head = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();

  constructor(private readonly occluders: Occluder[]) {}

  update(dt: number, camera: THREE.Camera, x: number, z: number): void {
    this.head.set(x, 1.2, z);
    this.dir.subVectors(this.head, camera.position);
    const dist = this.dir.length();
    this.ray.set(camera.position, this.dir.normalize());
    this.ray.far = dist - 0.3;
    for (const occ of this.occluders) {
      const blocking = this.ray.intersectObject(occ.object, true).length > 0;
      const target = blocking ? 0.3 : 1;
      if (occ.opacity === target) continue;
      occ.opacity += Math.sign(target - occ.opacity) * Math.min(Math.abs(target - occ.opacity), dt * 5);
      const solid = occ.opacity > 0.999;
      for (const m of occ.materials) {
        // Signs and glass keep their own look; only fully opaque materials are faded.
        if (m.userData.baseOpacity === undefined) m.userData.baseOpacity = m.transparent ? m.opacity : 1;
        const base = m.userData.baseOpacity as number;
        m.opacity = base * occ.opacity;
        const transparent = !solid || base < 1;
        if (m.transparent !== transparent) {
          m.transparent = transparent;
          m.depthWrite = !transparent;
          m.needsUpdate = true;
        }
      }
    }
  }
}
