import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadModel } from '../engine/loader';
import { paletteOf, type Accessory, type Look } from './looks';

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
  private readonly model: THREE.Object3D;
  /** Runs after the animation each frame, to pose bones in code (the overhead press). */
  onPose: (() => void) | null = null;

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
    this.model = model;
    this.object.add(model);
    // Accessories are placed while the skeleton is still in its T-pose, then handed to a bone so they ride the animation.
    for (const acc of (look.accessories ?? []) as Accessory[]) addAccessory(model, acc, look, shadows);
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
  locomote(groundSpeed: number, scale = 1): void {
    // `scale` undoes the indoor slowdown so the same run cycle plays inside and out.
    const speed = groundSpeed / scale;
    const anim: CharacterAnim = speed < 0.25 ? 'Idle_Loop' : speed < 2.7 ? 'Walk_Loop' : speed < 5.2 ? 'Jog_Fwd_Loop' : 'Sprint_Loop';
    this.play(anim);
    const natural = NATURAL_SPEED[anim];
    this.actions.get(anim)!.timeScale = natural ? THREE.MathUtils.clamp(speed / natural, 0.6, 1.5) : 1;
  }

  update(dt: number): void {
    this.mixer.update(dt);
    this.onPose?.();
  }

  bone(name: string): THREE.Object3D | undefined {
    return this.model.getObjectByName(name);
  }
}

// ----- accessories -----
// Positions are in the base mesh's T-pose space: y up, facing +z, 1.81 tall, arms out along x.

function numberTexture(text: string, color: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.font = '800 96px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addAccessory(model: THREE.Object3D, kind: Accessory, look: Look, shadows: boolean): void {
  const bone = (name: string) => model.getObjectByName(name);
  const accent = look.accent ?? 0xffffff;
  const lambert = (color: number) => new THREE.MeshLambertMaterial({ color });
  const group = new THREE.Group();
  let host: THREE.Object3D | undefined;

  if (kind === 'backpack') {
    host = bone('spine_03');
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.15), lambert(0x1f2937));
    pack.position.set(0, 1.3, -0.215);
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.05), lambert(accent));
    pocket.position.set(0, 1.2, -0.305);
    group.add(pack, pocket);
    for (const x of [-0.12, 0.12]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.03), lambert(0x1f2937));
      strap.position.set(x, 1.36, 0.135);
      group.add(strap);
    }
  } else if (kind === 'laptop') {
    host = bone('lowerarm_l');
    const laptop = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.24), lambert(0xc0c5cc));
    laptop.position.set(0.56, 1.36, 0.02);
    group.add(laptop);
  } else if (kind === 'lanyard') {
    host = bone('spine_03');
    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.3, 0.012), lambert(accent));
      strap.position.set(side * 0.045, 1.37, 0.142);
      strap.rotation.z = side * 0.3;
      group.add(strap);
    }
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.1, 0.012), lambert(0xf8fafc));
    card.position.set(0, 1.19, 0.15);
    group.add(card);
  } else if (kind === 'number') {
    host = bone('spine_03');
    const mat = new THREE.MeshBasicMaterial({ map: numberTexture('13', accent), transparent: true, depthWrite: false });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), mat);
    front.position.set(0, 1.3, 0.142);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), mat);
    back.position.set(0, 1.34, -0.165);
    back.rotation.y = Math.PI;
    group.add(front, back);
  }
  if (!host) return;
  // Accessories are too small for their shadows to read, and skipping them saves a draw call each.
  void shadows;
  model.add(group);
  model.updateMatrixWorld(true);
  // attach() keeps each part where it is in the world while re-parenting it to the bone.
  for (const child of [...group.children]) host.attach(child);
  model.remove(group);
}
