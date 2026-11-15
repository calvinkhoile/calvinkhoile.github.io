import * as THREE from 'three';
import { Character } from '../world/character';
import { TRAINER_LOOKS } from '../world/looks';

/** Character select: the four trainer looks on a small stage, the chosen one front and center, turning slowly. */
export class SelectStage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private readonly slots: { pivot: THREE.Group; character: Character | null }[] = [];
  private selected = 0;
  private spin = 0;

  constructor(reducedMotion: boolean) {
    // No background: the stage is drawn over the live park, so the world stays in view while picking.
    this.scene.add(new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 1.6));
    const key = new THREE.DirectionalLight(0xfff1d6, 2.2);
    key.position.set(2, 4, 5);
    this.scene.add(key);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x0070d1, transparent: true, opacity: 0.35 }),
    );
    this.scene.add(floor);
    TRAINER_LOOKS.forEach((look, i) => {
      const pivot = new THREE.Group();
      this.scene.add(pivot);
      const slot = { pivot, character: null as Character | null };
      this.slots.push(slot);
      // The other looks stream in while the title screen is up.
      void Character.create(look, { shadows: true }).then((c) => {
        slot.character = c;
        pivot.add(c.object);
      });
      pivot.position.x = i * 1.7;
    });
    this.reducedMotion = reducedMotion;
    this.resize(1);
  }

  private readonly reducedMotion: boolean;

  get index(): number {
    return this.selected;
  }

  select(i: number): void {
    const n = this.slots.length;
    this.selected = ((i % n) + n) % n;
    this.spin = 0;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    // Pull back on narrow screens so the neighbors still peek in.
    const dist = aspect < 0.8 ? 8.6 : 7.2;
    this.camera.position.set(0, 1.5, dist);
    this.camera.lookAt(0, 0.95, 0);
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    this.spin += dt;
    this.slots.forEach((slot, i) => {
      const isSel = i === this.selected;
      const targetX = (i - this.selected) * 1.7;
      const k = this.reducedMotion ? 1 : Math.min(1, dt * 10);
      slot.pivot.position.x += (targetX - slot.pivot.position.x) * k;
      const scale = isSel ? 1.12 : 0.82;
      slot.pivot.scale.setScalar(slot.pivot.scale.x + (scale - slot.pivot.scale.x) * k);
      slot.pivot.rotation.y = isSel && !this.reducedMotion ? Math.sin(this.spin * 0.9) * 0.9 : 0;
      slot.character?.update(dt);
    });
  }
}
