import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadModel } from '../engine/loader';
import { paletteOf, type Look } from './looks';

export type CharacterAnim = 'Idle_Loop' | 'Walk_Loop' | 'Jog_Fwd_Loop' | 'Sprint_Loop' | 'Idle_Talking_Loop' | 'Interact';

const ANIM_FILE = 'trainer-anims.glb';
// Ground speed (units/s) each locomotion clip looks right at. Playback is scaled to the real speed so feet don't slide.
const NATURAL_SPEED: Partial<Record<CharacterAnim, number>> = { Walk_Loop: 1.7, Jog_Fwd_Loop: 3.8, Sprint_Loop: 6.5 };

let clipsPromise: Promise<THREE.AnimationClip[]> | null = null;
const loadClips = () => (clipsPromise ??= loadModel(ANIM_FILE).then((g) => g.animations));

function paletteTexture(look: Look): THREE.DataTexture {
  const colors = paletteOf(look);
  const data = new Uint8Array(colors.length * 4);
  colors.forEach((c, i) => data.set([(c >> 16) & 255, (c >> 8) & 255, c & 255, 255], i * 4));
  const tex = new THREE.DataTexture(data, colors.length, 1, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** A rigged, animated low-poly person. All characters share one skeleton and one animation file. */
export class Character {
  readonly object = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private current: CharacterAnim | null = null;
  private readonly material: THREE.MeshLambertMaterial;

  private constructor(model: THREE.Object3D, clips: THREE.AnimationClip[], look: Look, shadows: boolean) {
    // Smooth shading: flat shading on this base mesh reads as a bodysuit, smooth reads as clothes.
    this.material = new THREE.MeshLambertMaterial({ map: paletteTexture(look) });
    model.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      mesh.material = this.material;
      mesh.castShadow = shadows;
      mesh.frustumCulled = false; // the bind-pose bounds don't follow the animation
    });
    this.object.add(model);
    if (!shadows) {
      const blob = new THREE.Mesh(
        new THREE.CircleGeometry(0.45, 20),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
      );
      blob.rotation.x = -Math.PI / 2;
      blob.position.y = 0.04;
      this.object.add(blob);
    }
    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of clips) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.play('Idle_Loop', 0);
    this.mixer.update(0);
  }

  static async create(look: Look, opts: { shadows: boolean }): Promise<Character> {
    const [gltf, clips] = await Promise.all([loadModel(look.model), loadClips()]);
    return new Character(cloneSkinned(gltf.scene), clips, look, opts.shadows);
  }

  setLook(look: Look): void {
    this.material.map?.dispose();
    this.material.map = paletteTexture(look);
  }

  play(name: CharacterAnim, fade = 0.18): void {
    if (this.current === name) return;
    const next = this.actions.get(name);
    if (!next) return;
    const prev = this.current ? this.actions.get(this.current) : null;
    next.reset().setEffectiveWeight(1).play();
    if (prev && fade > 0) next.crossFadeFrom(prev, fade, false);
    else prev?.stop();
    this.current = name;
  }

  /** Pick idle / walk / jog / sprint from ground speed and keep the feet in step with it. */
  locomote(speed: number): void {
    const anim: CharacterAnim = speed < 0.25 ? 'Idle_Loop' : speed < 2.7 ? 'Walk_Loop' : speed < 5.2 ? 'Jog_Fwd_Loop' : 'Sprint_Loop';
    this.play(anim);
    const natural = NATURAL_SPEED[anim];
    this.actions.get(anim)!.timeScale = natural ? THREE.MathUtils.clamp(speed / natural, 0.6, 1.5) : 1;
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }
}
