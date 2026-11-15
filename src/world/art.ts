import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { QualitySettings } from '../engine/quality';
import type { Kit } from './kit';
import type { Door, Facing, MapDef, Prop, Zone, ZoneKind } from './maps/types';

// Exterior art pass. Scenery comes from the CC0 kit (public/models/exterior.glb). Gyms, courts, and signage
// are built from primitives so each stop has its own identity. Everything reads its position from the map data.

export interface Occluder {
  /** Meshes to raycast against. */
  object: THREE.Object3D;
  materials: THREE.Material[];
  opacity: number;
}

export interface ArtScene {
  root: THREE.Group;
  occluders: Occluder[];
  /** Per-frame ambient animation (badges, marquee, kiosk glow). */
  update(time: number): void;
}

const PALETTE = {
  grass: 0x7bc67e,
  grassDark: 0x5fae6a,
  path: 0xc4683f,
  pathEdge: 0x9a4d2c,
  concrete: 0xd9d4cc,
  blacktop: 0x4b5058,
  track: 0xb5483a,
  water: 0x4fb3d9,
  hedge: 0x3f8f4f,
  stone: 0xb8b2a7,
  wood: 0x9a6b3f,
  steel: 0x6b7280,
  white: 0xf4f5f7,
  brick: 0xa8553a,
  brickDark: 0x8a4630,
  roofTile: 0x7a3b2a,
  uclaBlue: 0x2774ae,
  uclaGold: 0xffd100,
  deloitteGreen: 0x86bc25,
  metaBlue: 0x0866ff,
  glass: 0x9fd3f0,
  betBlack: 0x15130f,
  betGold: 0xc5a15a,
  bulb: 0xffe9a8,
};

const FACE_ROT: Record<Facing, number> = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };
const FACE_OUT: Record<Facing, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

/** Deterministic random so the park looks the same on every visit. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Collects the meshes of one building so it can fade as a unit. Materials are private to the builder. */
export class Builder {
  readonly group = new THREE.Group();
  private readonly mats = new Map<string, THREE.MeshLambertMaterial>();

  constructor(private readonly shadows: boolean) {}

  mat(color: number, opts: { emissive?: number; opacity?: number } = {}): THREE.MeshLambertMaterial {
    const key = `${color}:${opts.emissive ?? ''}:${opts.opacity ?? ''}`;
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ color, flatShading: true });
      if (opts.emissive !== undefined) m.emissive.setHex(opts.emissive);
      if (opts.opacity !== undefined) {
        m.transparent = true;
        m.opacity = opts.opacity;
        m.depthWrite = false;
      }
      this.mats.set(key, m);
    }
    return m;
  }

  add<T extends THREE.Object3D>(o: T): T {
    this.group.add(o);
    return o;
  }

  /** Box by min corner and size (map convention). */
  box(x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x + w / 2, y + h / 2, z + d / 2);
    mesh.castShadow = this.shadows;
    mesh.receiveShadow = this.shadows;
    return this.add(mesh);
  }

  mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = this.shadows;
    mesh.receiveShadow = this.shadows; // same flags as box(), so merge() can batch them together
    return this.add(mesh);
  }

  /** Flat panel on a wall. (x, z) is the panel center on the ground plan, already on the wall line. */
  panel(x: number, y: number, z: number, w: number, h: number, facing: Facing, material: THREE.Material, lift = 0.04): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    const out = FACE_OUT[facing];
    mesh.position.set(x + out[0] * lift, y, z + out[1] * lift);
    mesh.rotation.y = FACE_ROT[facing];
    return this.add(mesh);
  }

  /** Round-topped opening or window on a wall. (x, z) is its center on the wall line, y0 its sill. */
  arch(x: number, y0: number, z: number, w: number, h: number, facing: Facing, material: THREE.Material, lift = 0.05): void {
    const r = w / 2;
    this.panel(x, y0 + (h - r) / 2, z, w, h - r, facing, material, lift);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(r, 12, 0, Math.PI), material);
    const out = FACE_OUT[facing];
    cap.position.set(x + out[0] * lift, y0 + h - r, z + out[1] * lift);
    cap.rotation.y = FACE_ROT[facing];
    this.add(cap);
  }

  /** Gable roof: a triangular prism sitting on (x, z, w, d) at height y. The ridge runs along the longer side unless told otherwise. */
  gable(x: number, y: number, z: number, w: number, d: number, rise: number, material: THREE.Material, ridgeAlongX = w >= d): THREE.Mesh {
    const span = ridgeAlongX ? d : w;
    const len = ridgeAlongX ? w : d;
    const shape = new THREE.Shape([new THREE.Vector2(-span / 2, 0), new THREE.Vector2(span / 2, 0), new THREE.Vector2(0, rise)]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2);
    if (ridgeAlongX) geo.rotateY(Math.PI / 2);
    return this.mesh(geo, material, x + w / 2, y, z + d / 2);
  }

  /** A grid of windows on one wall of a box-shaped building. */
  windows(p: { x: number; z: number; w: number; d: number }, facing: 'e' | 's', y0: number, rows: number, cols: number, size: [number, number], color: number, inset = 1): void {
    const span = (facing === 'e' ? p.d : p.w) - inset * 2;
    const material = this.mat(color, { emissive: 0x0a1626 });
    const geo = new THREE.PlaneGeometry(size[0], size[1]);
    const inst = new THREE.InstancedMesh(geo, material, rows * cols);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), FACE_ROT[facing]);
    const one = new THREE.Vector3(1, 1, 1);
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = cols === 1 ? 0.5 : c / (cols - 1);
        const along = inset + span * t;
        const pos =
          facing === 'e'
            ? new THREE.Vector3(p.x + p.w + 0.03, y0 + r * (size[1] + 0.5), p.z + along)
            : new THREE.Vector3(p.x + along, y0 + r * (size[1] + 0.5), p.z + p.d + 0.03);
        inst.setMatrixAt(i++, m.compose(pos, q, one));
      }
    }
    this.add(inst);
  }

  /**
   * Collapse the static meshes into one mesh per material, which is what keeps the draw-call count low.
   * Meshes flagged `userData.dynamic` (they move every frame) and instanced meshes are left alone.
   */
  merge(): void {
    this.group.updateMatrixWorld(true);
    const buckets = new Map<string, { material: THREE.Material; cast: boolean; receive: boolean; geos: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }>();
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || (mesh as unknown as THREE.InstancedMesh).isInstancedMesh || mesh.userData.dynamic) return;
      if (Array.isArray(mesh.material)) return;
      const g = mesh.geometry;
      const names = Object.keys(g.attributes).sort().join();
      if (names !== 'normal,position,uv' || !g.index || !(g.attributes.position.array instanceof Float32Array)) return;
      const key = `${mesh.material.uuid}:${mesh.castShadow}:${mesh.receiveShadow}`;
      let bucket = buckets.get(key);
      if (!bucket) buckets.set(key, (bucket = { material: mesh.material, cast: mesh.castShadow, receive: mesh.receiveShadow, geos: [], meshes: [] }));
      bucket.geos.push(g.clone().applyMatrix4(mesh.matrixWorld));
      bucket.meshes.push(mesh);
    });
    const inv = this.group.matrixWorld.clone().invert();
    for (const bucket of buckets.values()) {
      if (bucket.meshes.length < 2) continue;
      const merged = mergeGeometries(bucket.geos);
      if (!merged) continue;
      for (const m of bucket.meshes) {
        m.removeFromParent();
        m.geometry.dispose();
      }
      const mesh = new THREE.Mesh(merged.applyMatrix4(inv), bucket.material);
      mesh.castShadow = bucket.cast;
      mesh.receiveShadow = bucket.receive;
      this.group.add(mesh);
    }
  }

  materials(): THREE.Material[] {
    const set = new Set<THREE.Material>();
    this.group.traverse((o) => {
      const mat = (o as THREE.Mesh).material;
      if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((m) => set.add(m));
    });
    return [...set];
  }
}

// ---------- textures ----------

export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Text sign. Signs are basic (unlit) materials so they stay readable in shadow. */
export function textSign(text: string, bg: number, fg: number, aspect: number, font = '800'): THREE.MeshBasicMaterial {
  const h = 128;
  const w = Math.round(h * aspect);
  const tex = canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = hex(bg);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = hex(fg);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 76;
    do {
      ctx.font = `${font} ${size}px Inter, system-ui, sans-serif`;
      size -= 4;
    } while (ctx.measureText(text).width > w * 0.86 && size > 20);
    ctx.fillText(text, w / 2, h / 2 + 4);
  });
  return new THREE.MeshBasicMaterial({ map: tex });
}

/** Logo on a backing board. The logo image is drawn onto a canvas once it loads, letterboxed with padding. */
export function logoSign(url: string, bg: number, aspect: number): THREE.MeshBasicMaterial {
  const h = 256;
  const w = Math.round(h * aspect);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = hex(bg);
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const img = new Image();
  img.onload = () => {
    const pad = 0.14;
    const scale = Math.min((w * (1 - pad * 2)) / img.width, (h * (1 - pad * 2)) / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    tex.needsUpdate = true;
  };
  img.src = url;
  return new THREE.MeshBasicMaterial({ map: tex });
}

function courtTexture(w: number, d: number): THREE.CanvasTexture {
  const s = 32; // px per world unit
  return canvasTexture(w * s, d * s, (ctx) => {
    const W = w * s;
    const D = d * s;
    ctx.fillStyle = '#3b6ea5';
    ctx.fillRect(0, 0, W, D);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    const m = 0.6 * s; // sideline margin
    const base = W - 1.2 * s; // baseline, hoop end (east)
    const cy = D / 2;
    const hoopX = base - 1.6 * s;
    // Paint.
    ctx.fillStyle = '#d9773a';
    ctx.fillRect(base - 5.8 * s, cy - 2.45 * s, 5.8 * s, 4.9 * s);
    ctx.strokeRect(base - 5.8 * s, cy - 2.45 * s, 5.8 * s, 4.9 * s);
    // Free-throw circle.
    ctx.beginPath();
    ctx.arc(base - 5.8 * s, cy, 1.8 * s, 0, Math.PI * 2);
    ctx.stroke();
    // Three-point line: straight corners + arc.
    const r = 6.2 * s;
    const corner = Math.min(cy - m - 0.3 * s, r);
    const dx = Math.sqrt(Math.max(0, r * r - corner * corner));
    ctx.beginPath();
    ctx.moveTo(base, cy - corner);
    ctx.lineTo(hoopX - dx, cy - corner);
    ctx.arc(hoopX, cy, r, Math.PI + Math.asin(corner / r), Math.PI - Math.asin(corner / r), true);
    ctx.lineTo(base, cy + corner);
    ctx.stroke();
    // Boundary and half-court circle.
    ctx.strokeRect(m, m, base - m, D - m * 2);
    ctx.beginPath();
    ctx.arc(m, cy, 1.8 * s, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
  });
}

function trackTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = hex(PALETTE.track);
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(0, 30, 64, 4);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function checkerTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(64, 64, (ctx) => {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#3a3a3a' : '#ece7dc';
        ctx.fillRect(x * 8, y * 8, 8, 8);
      }
    }
  });
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

function rollupTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#d7dadf';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#aab0b8';
    for (let y = 6; y < 128; y += 12) ctx.fillRect(0, y, 128, 3);
  });
}

// ---------- scene ----------

export function buildArt(map: MapDef, kit: Kit, q: QualitySettings): ArtScene {
  const root = new THREE.Group();
  const occluders: Occluder[] = [];
  const animated: ((time: number) => void)[] = [];
  const shadows = q.shadowMapSize > 0;
  const shared = new Builder(shadows); // everything that never fades
  root.add(shared.group);

  // Each building is its own batch so it can fade as a unit. Batches are merged after everything is placed.
  const buildings: Builder[] = [];
  const building = (build: (b: Builder) => void, into?: Builder): Builder => {
    const b = into ?? new Builder(shadows);
    build(b);
    if (!into) buildings.push(b);
    return b;
  };
  let ucla: Builder | undefined;

  buildGround(root, map, shadows);
  for (const zone of map.zones) buildZone(shared, zone, map);

  // Kit models that repeat are batched: collect transforms first, then emit one InstancedMesh per model.
  const batches = new Map<string, THREE.Matrix4[]>();
  const place = (model: string, x: number, z: number, scale: number, rotY = 0, y = 0) => {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
      new THREE.Vector3(scale, scale, scale),
    );
    const list = batches.get(model) ?? [];
    list.push(m);
    batches.set(model, list);
  };

  const rand = rng(77);
  for (const p of map.props) {
    const cx = p.x + p.w / 2;
    const cz = p.z + p.d / 2;
    switch (p.model) {
      case 'hedge':
        shared.box(p.x, 0, p.z, p.w, p.h, p.d, shared.mat(PALETTE.hedge));
        break;
      case 'tree': {
        const pick = rand();
        const model = pick < 0.3 ? 'palm-a' : pick < 0.55 ? 'palm-b' : pick < 0.7 ? 'palm-c' : pick < 0.85 ? 'tree-oak' : 'tree-round';
        place(model, cx, cz, (p.h / 1.4) * 1.15, rand() * Math.PI * 2);
        break;
      }
      case 'lamp':
        place('lamp', cx, cz, 5.4, Math.PI / 2);
        break;
      case 'signpost':
        place('sign', cx, cz, 5, -Math.PI / 4);
        break;
      case 'gym-ucla':
        ucla = building((b) => buildUcla(b, p));
        break;
      case 'gym-ucla-tower':
        // The towers join the main building's batch: fewer draw calls, and the whole hall fades together.
        building((b) => buildUclaTower(b, p), ucla);
        break;
      case 'gym-deloitte':
        building((b) => buildDeloitte(b, p, kit));
        break;
      case 'gym-meta': {
        building((b) => buildMeta(b, p));
        // Roof garden on the lower roof, in front of the upper volume.
        const ry = p.h + 0.2;
        for (let i = 0; i < 7; i++) place(i % 3 === 0 ? 'tree-oak' : 'bush', p.x + 6.9 + (i % 4) * 1.0 + rand() * 0.3, p.z + 0.8 + ((i * 1.7) % (p.d - 1.6)), i % 3 === 0 ? 1.7 : 2.6, rand() * 6.28, ry);
        break;
      }
      case 'meta-sign':
        building((b) => buildMetaSign(b, p));
        break;
      case 'gym-betmgm':
        building((b) => animated.push(buildBetmgm(b, p, q)));
        break;
      case 'workshop':
        building((b) => buildWorkshop(b, p));
        place('cone', p.x + 1.2, p.z + p.d + 0.7, 7);
        place('cone', p.x + 2.0, p.z + p.d + 1.0, 7);
        break;
      case 'fountain':
        buildFountain(shared, p);
        break;
      case 'resume-kiosk':
        animated.push(buildKiosk(shared, p));
        break;
      case 'fence':
        buildFence(shared, p);
        break;
      case 'bleachers':
        buildBleachers(shared, p);
        break;
      case 'hoop':
        buildHoop(shared, p);
        break;
      case 'mile-marker':
        shared.box(cx - 0.08, 0, cz - 0.08, 0.16, p.h, 0.16, shared.mat(PALETTE.steel));
        shared.box(cx - 0.45, p.h - 0.5, cz - 0.05, 0.9, 0.5, 0.1, shared.mat(p.color));
        break;
      case 'chess-table':
        buildChessTable(shared, p);
        break;
      case 'ticker-board':
        buildTickerBoard(shared, p);
        break;
      case 'workbench':
        buildWorkbench(shared, p);
        break;
      case 'squat-rack':
        buildSquatRack(shared, p);
        break;
      case 'bench-press':
        buildBenchPress(shared, p);
        break;
      case 'dumbbell-rack':
        buildDumbbellRack(shared, p);
        break;
      case 'coach-bench':
        shared.box(p.x + 0.1, 0.42, p.z + 0.25, p.w - 0.2, 0.1, 0.5, shared.mat(PALETTE.wood));
        shared.box(p.x + 0.1, 0.52, p.z + 0.2, p.w - 0.2, 0.5, 0.08, shared.mat(PALETTE.wood));
        for (const lx of [p.x + 0.25, p.x + p.w - 0.35]) shared.box(lx, 0, p.z + 0.3, 0.1, 0.42, 0.4, shared.mat(PALETTE.steel));
        break;
      case 'trophy-case':
        buildTrophyCase(shared, p);
        break;
      default:
        // Unknown model: keep the graybox block so nothing is ever invisible but solid.
        shared.box(p.x, 0, p.z, p.w, p.h, p.d, shared.mat(p.color));
    }
  }

  for (const door of map.doors) animated.push(buildDoor(shared, door));
  buildSigns(shared, map);
  if (q.ambientDetail) scatterDecor(map, place, shared);
  shared.merge();
  for (const b of buildings) {
    b.merge();
    root.add(b.group);
    occluders.push({ object: b.group, materials: b.materials(), opacity: 1 });
  }

  for (const [model, transforms] of batches) {
    for (const o of kit.instances(model, transforms, shadows && !model.startsWith('flower') && !model.startsWith('skyline'))) root.add(o);
  }

  return { root, occluders, update: (time) => animated.forEach((fn) => fn(time)) };
}

function buildGround(root: THREE.Group, map: MapDef, shadows: boolean): void {
  // Grass with a little per-vertex color variation so big lawns don't look flat.
  const geo = new THREE.PlaneGeometry(map.width, map.height, map.width / 2, map.height / 2).rotateX(-Math.PI / 2);
  const rand = rng(5);
  const base = new THREE.Color(PALETTE.grass);
  const colors: number[] = [];
  for (let i = 0; i < geo.attributes.position.count; i++) {
    const k = 0.94 + rand() * 0.1;
    colors.push(base.r * k, base.g * k, base.b * k);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.position.set(map.width / 2, 0, map.height / 2);
  ground.receiveShadow = shadows;
  const skirt = new THREE.Mesh(
    new THREE.PlaneGeometry(map.width + 300, map.height + 300).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: PALETTE.grassDark }),
  );
  skirt.position.set(map.width / 2, -0.03, map.height / 2);
  root.add(ground, skirt);
}

const ZONE_Y: Record<ZoneKind, number> = { water: 0.012, concrete: 0.014, plaza: 0.016, court: 0.018, path: 0.024, track: 0.03 };

export function flat(b: Builder, x: number, z: number, w: number, d: number, y: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), material);
  mesh.position.set(x + w / 2, y, z + d / 2);
  mesh.receiveShadow = true;
  return b.add(mesh);
}

function buildZone(b: Builder, zone: Zone, map: MapDef): void {
  const y = ZONE_Y[zone.kind];
  const smooth = (color: number) => {
    const m = b.mat(color);
    return m;
  };
  switch (zone.kind) {
    case 'path':
      // A darker rim under every path piece reads as a curb once the fills overlap it.
      flat(b, zone.x - 0.14, zone.z - 0.14, zone.w + 0.28, zone.d + 0.28, y - 0.006, smooth(PALETTE.pathEdge));
      flat(b, zone.x, zone.z, zone.w, zone.d, y, smooth(PALETTE.path));
      break;
    case 'plaza':
      flat(b, zone.x - 0.2, zone.z - 0.2, zone.w + 0.4, zone.d + 0.4, y - 0.004, smooth(0xb9b3a8));
      flat(b, zone.x, zone.z, zone.w, zone.d, y, smooth(PALETTE.concrete));
      break;
    case 'concrete':
      flat(b, zone.x, zone.z, zone.w, zone.d, y, smooth(PALETTE.blacktop));
      break;
    case 'court':
      flat(b, zone.x, zone.z, zone.w, zone.d, y, new THREE.MeshLambertMaterial({ map: courtTexture(zone.w, zone.d) }));
      break;
    case 'track': {
      const tex = trackTexture();
      const alongX = zone.w >= zone.d;
      tex.repeat.set(alongX ? zone.w / 2 : zone.d / 2, 1);
      const mesh = flat(b, zone.x, zone.z, zone.w, zone.d, y, new THREE.MeshLambertMaterial({ map: tex }));
      if (!alongX) {
        // Run the lane line the long way on north-south pieces.
        mesh.geometry.dispose();
        mesh.geometry = new THREE.PlaneGeometry(zone.d, zone.w).rotateX(-Math.PI / 2).rotateY(Math.PI / 2);
      }
      break;
    }
    case 'water': {
      flat(b, zone.x - 0.35, zone.z - 0.35, zone.w + 0.7, zone.d + 0.7, y - 0.004, smooth(PALETTE.stone));
      const water = flat(b, zone.x, zone.z, zone.w, zone.d, y, new THREE.MeshLambertMaterial({ color: PALETTE.water, emissive: 0x0b3a52 }));
      water.receiveShadow = false;
      break;
    }
  }
  void map;
}

// ---------- gyms ----------

const TOWER_W = 2.3;

/** UCLA: a nod to Royce Hall. Banded brick, a gabled nave, an arched portico, and a rose window between twin towers. */
function buildUcla(b: Builder, p: Prop): void {
  const brick = b.mat(PALETTE.brick);
  const cream = b.mat(0xe9dcc3);
  const tile = b.mat(0xb5553a);
  const dark = b.mat(0x2b2118);
  const glass = b.mat(0x35506e, { emissive: 0x0a1626 });
  const ex = p.x + p.w;
  const cz = p.z + p.d / 2;

  // Tall nave down the middle, lower aisles along both sides.
  b.box(p.x, 0, p.z + 1.4, p.w - 0.5, 5.4, p.d - 2.8, brick);
  b.gable(p.x - 0.2, 5.4, p.z + 1.2, p.w - 0.3, p.d - 2.4, 1.9, tile, true);
  for (const z of [p.z, p.z + p.d - 1.5]) {
    b.box(p.x, 0, z, p.w - TOWER_W + 0.2, 3.3, 1.5, brick);
    b.box(p.x - 0.1, 3.3, z - 0.1, p.w - TOWER_W + 0.3, 0.22, 1.7, tile);
  }
  b.box(p.x - 0.1, 0, p.z - 0.1, p.w + 0.2, 0.45, p.d + 0.2, cream);

  // South aisle: a row of arched windows with cream sills, and the brick banding Royce is known for.
  const sz = p.z + p.d;
  for (let i = 0; i < 5; i++) {
    const x = p.x + 0.9 + i * 1.45;
    b.arch(x, 0.95, sz, 0.85, 1.75, 's', cream, 0.04);
    b.arch(x, 1.05, sz, 0.62, 1.5, 's', glass, 0.07);
  }
  b.panel(p.x + (p.w - TOWER_W) / 2, 2.95, sz, p.w - TOWER_W, 0.16, 's', cream);
  // Clerestory windows on the nave, above the aisle roof.
  for (let i = 0; i < 5; i++) b.arch(p.x + 0.9 + i * 1.45, 3.85, p.z + p.d - 1.4, 0.55, 1.1, 's', glass, 0.05);

  // Front between the towers: gabled wall, three-arch portico, rose window.
  const fz = cz;
  const fw = p.d - TOWER_W * 2 + 0.2;
  b.box(ex - 0.7, 0, fz - fw / 2, 0.6, 5.6, fw, brick);
  b.gable(ex - 0.7, 5.6, fz - fw / 2, 0.6, fw, 1.5, brick, true);
  const fx = ex - 0.1;
  for (const dz of [-1.12, 0, 1.12]) {
    b.arch(fx, 0.45, fz + dz, 1.0, 2.5, 'e', cream, 0.03);
    b.arch(fx, 0.45, fz + dz, 0.76, 2.3, 'e', dark, 0.06);
  }
  b.panel(fx, 3.5, fz, 3.1, 0.95, 'e', logoSign('/images/logos/ucla.webp', 0xffffff, 3.1 / 0.95), 0.07);
  const rose = (r: number, mat: THREE.Material, lift: number) => {
    const m = b.add(new THREE.Mesh(new THREE.CircleGeometry(r, 16), mat));
    m.position.set(fx + lift, 4.85, fz);
    m.rotation.y = Math.PI / 2;
  };
  rose(0.62, cream, 0.03);
  rose(0.46, b.mat(PALETTE.uclaBlue, { emissive: 0x0d2a44 }), 0.06);
  rose(0.16, b.mat(PALETTE.uclaGold, { emissive: 0x4a3c00 }), 0.09);
  b.panel(fx, 5.75, fz, fw - 0.3, 0.14, 'e', cream);
}

function buildUclaTower(b: Builder, p: Prop): void {
  const brick = b.mat(PALETTE.brick);
  const cream = b.mat(0xe9dcc3);
  const dark = b.mat(0x2b2118);
  // The towers stand slightly proud of the walls, and the north one is a touch taller, like the real pair.
  const north = p.z < 48;
  const h = p.h + (north ? 0.9 : 0);
  const x = p.x - 0.15;
  const z = north ? p.z - 0.12 : p.z - 0.18;
  const w = TOWER_W;
  b.box(x, 0, z, w, h, w, brick);
  const ex = x + w;
  const sz = z + w;
  const cx = x + w / 2;
  const mz = z + w / 2;
  // Cream bands, then an open belfry with paired arches on the two faces the camera sees.
  for (const y of [2.9, 5.2, h - 2.25]) {
    b.panel(ex, y, mz, w, 0.16, 'e', cream, 0.03);
    b.panel(cx, y, sz, w, 0.16, 's', cream, 0.03);
  }
  for (const d of [-0.5, 0.5]) {
    b.arch(ex, h - 2.05, mz + d, 0.62, 1.55, 'e', cream, 0.04);
    b.arch(ex, h - 2.0, mz + d, 0.44, 1.4, 'e', dark, 0.07);
    b.arch(cx + d, h - 2.05, sz, 0.62, 1.55, 's', cream, 0.04);
    b.arch(cx + d, h - 2.0, sz, 0.44, 1.4, 's', dark, 0.07);
  }
  b.arch(ex, 3.4, mz, 0.5, 1.3, 'e', dark, 0.05);
  b.arch(cx, 3.4, sz, 0.5, 1.3, 's', dark, 0.05);
  b.box(x - 0.15, h, z - 0.15, w + 0.3, 0.3, w + 0.3, cream);
  b.mesh(new THREE.ConeGeometry((w / 2 + 0.2) * Math.SQRT2, 1.9, 4).rotateY(Math.PI / 4), b.mat(0xb5553a), cx, h + 1.25, mz);
}

/** Wordmark sign: white type with the green dot. Drawn here so the dot can be its own color. */
function deloitteWordmark(aspect: number): THREE.MeshBasicMaterial {
  const h = 160;
  const w = Math.round(h * aspect);
  const tex = canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.font = '800 104px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const text = 'Deloitte';
    const tw = ctx.measureText(text).width;
    const x0 = (w - tw - 30) / 2;
    ctx.fillStyle = '#fff';
    ctx.fillText(text, x0, h / 2 + 4);
    ctx.fillStyle = hex(PALETTE.deloitteGreen);
    ctx.beginPath();
    ctx.arc(x0 + tw + 16, h / 2 + 34, 13, 0, Math.PI * 2);
    ctx.fill();
  });
  return new THREE.MeshBasicMaterial({ map: tex });
}

/** Deloitte: corporate HQ. Dark glass tower, a glazed lobby under a canopy, green accent lines, wordmark up top. */
function buildDeloitte(b: Builder, p: Prop, kit: Kit): void {
  const tower = kit.single('tower', 0x7d858d);
  const scale = (p.w - 0.6) / 1.36;
  const height = 2.88 * scale;
  tower.scale.setScalar(scale);
  tower.rotation.y = Math.PI / 2;
  tower.position.set(p.x + p.w / 2, 0, p.z + p.d / 2);
  tower.traverse((o) => {
    o.castShadow = true;
  });
  b.add(tower);

  const black = b.mat(0x0d0d0d);
  const green = b.mat(PALETTE.deloitteGreen, { emissive: 0x3d5a0c });
  const ex = p.x + p.w;
  const cz = p.z + p.d / 2;
  // Double-height glazed lobby with mullions, under a thin black canopy with a green edge.
  b.box(ex - 0.45, 0, p.z + 0.5, 0.5, 3.4, p.d - 1.0, black);
  b.panel(ex + 0.05, 1.6, cz, p.d - 1.6, 2.7, 'e', b.mat(0x8fc7e6, { emissive: 0x16384d }), 0.02);
  for (let i = 0; i <= 6; i++) b.box(ex + 0.05, 0.25, p.z + 0.8 + (i * (p.d - 1.7)) / 6, 0.06, 2.7, 0.1, black);
  b.box(ex - 0.3, 3.05, cz - 3.0, 1.25, 0.16, 6.0, black);
  b.box(ex + 0.9, 3.05, cz - 3.0, 0.08, 0.16, 6.0, green);
  b.box(ex - 0.35, 3.4, cz - 2.9, 0.4, 1.3, 5.8, black);
  b.panel(ex + 0.05, 4.05, cz, 5.4, 1.1, 'e', deloitteWordmark(5.4 / 1.1), 0.02);
  // Green light lines up the corners the camera sees, and a rooftop wordmark for the long view.
  for (const [x, z] of [[ex - 0.36, cz + 3.4], [ex - 0.36, cz - 3.52]] as const) {
    b.box(x, 3.4, z, 0.12, height - 4.2, 0.12, green);
  }
  b.box(ex - 1.1, height - 0.4, cz - 2.9, 0.3, 1.5, 5.8, black);
  b.panel(ex - 0.8, height + 0.35, cz, 5.6, 1.2, 'e', deloitteWordmark(5.6 / 1.2), 0.02);
  // Granite planters squaring off the forecourt.
  for (const dz of [-3.2, 3.2]) b.box(ex + 0.1, 0, cz + dz - 0.5, 0.7, 0.5, 1.0, b.mat(0x3a3d42));
}

/** Meta: low tech campus. Stacked white volumes, long glass walls, blue fascia, and a roof garden (planted by the caller). */
function buildMeta(b: Builder, p: Prop): void {
  const white = b.mat(PALETTE.white);
  const blue = b.mat(PALETTE.metaBlue, { emissive: 0x02164a });
  const glass = b.mat(PALETTE.glass, { emissive: 0x16384d });
  const ex = p.x + p.w;
  const sz = p.z + p.d;
  // Main single-storey floor plate with a deep overhanging roof.
  b.box(p.x, 0, p.z, p.w, p.h, p.d, white);
  b.box(p.x - 0.5, p.h, p.z - 0.5, p.w + 1.3, 0.22, p.d + 1.3, white);
  b.box(p.x - 0.52, p.h - 0.3, p.z - 0.52, p.w + 1.34, 0.3, p.d + 1.34, blue);
  // A second, set-back volume makes it read as a campus, not a box.
  b.box(p.x + 0.8, p.h + 0.22, p.z + 0.6, 5.2, 2.2, p.d - 2.4, white);
  b.box(p.x + 0.6, p.h + 2.42, p.z + 0.4, 5.6, 0.2, p.d - 2.0, white);
  b.panel(p.x + 3.4, p.h + 1.35, sz - 1.8, 4.6, 1.5, 's', glass);
  b.panel(p.x + 6.0, p.h + 1.35, p.z + p.d / 2 - 0.6, p.d - 3.2, 1.5, 'e', glass);
  // Floor-to-ceiling glass on the ground floor, split by slim white fins.
  b.panel(ex, 1.6, p.z + 1.6, 2.4, 2.5, 'e', glass);
  b.panel(ex, 1.6, sz - 1.5, 2.2, 2.5, 'e', glass);
  b.panel(p.x + p.w / 2, 1.6, sz, p.w - 1.2, 2.5, 's', glass);
  for (let i = 1; i < 7; i++) b.box(p.x + (p.w / 7) * i - 0.05, 0.3, sz, 0.1, 2.65, 0.1, white);
  // Blue entry portal with the logo above the door (door tile is at z = 23).
  const dz = 23.5;
  b.box(ex, 0, dz - 1.3, 0.25, 3.0, 0.25, blue);
  b.box(ex, 0, dz + 1.05, 0.25, 3.0, 0.25, blue);
  b.box(ex, 2.75, dz - 1.3, 0.25, 0.3, 2.6, blue);
  b.panel(ex + 0.3, 3.75, dz, 2.6, 1.3, 'e', logoSign('/images/logos/meta.svg', 0xffffff, 2), 0.02);
  b.box(ex + 0.02, 3.05, dz - 1.4, 0.25, 1.45, 2.8, white);
}

/** The entrance sign every visitor photographs: a big board on the lawn with the logo. */
function buildMetaSign(b: Builder, p: Prop): void {
  const cx = p.x + p.w / 2;
  const cz = p.z + p.d / 2;
  b.box(cx - 0.22, 0, p.z + 0.15, 0.44, 0.35, p.d - 0.3, b.mat(0x9aa0a8));
  b.box(cx - 0.14, 0.35, p.z + 0.1, 0.28, p.h - 0.35, p.d - 0.2, b.mat(PALETTE.white));
  b.panel(cx + 0.14, p.h / 2 + 0.2, cz, p.d - 0.5, p.h - 0.7, 'e', logoSign('/images/logos/meta.svg', 0xffffff, (p.d - 0.5) / (p.h - 0.7)), 0.02);
  b.box(cx - 0.16, p.h, p.z + 0.08, 0.32, 0.1, p.d - 0.16, b.mat(PALETTE.metaBlue));
}

function chipTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#15130f';
    ctx.fillRect(0, 0, 256, 256);
    ctx.translate(128, 128);
    ctx.fillStyle = hex(PALETTE.betGold);
    ctx.beginPath();
    ctx.arc(0, 0, 126, 0, Math.PI * 2);
    ctx.fill();
    // Edge inserts.
    ctx.fillStyle = '#15130f';
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-16, -126, 32, 30);
    }
    ctx.beginPath();
    ctx.arc(0, 0, 84, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hex(PALETTE.betGold);
    ctx.lineWidth = 6;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = hex(PALETTE.betGold);
    ctx.font = '800 72px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('13', 0, 6);
  });
}

function verticalSign(text: string, bg: number, fg: number): THREE.MeshBasicMaterial {
  const cell = 96;
  const tex = canvasTexture(cell, cell * text.length, (ctx) => {
    ctx.fillStyle = hex(bg);
    ctx.fillRect(0, 0, cell, cell * text.length);
    ctx.fillStyle = hex(fg);
    ctx.font = '800 76px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    [...text].forEach((ch, i) => ctx.fillText(ch, cell / 2, cell * i + cell / 2 + 4));
  });
  return new THREE.MeshBasicMaterial({ map: tex });
}

/** BetMGM: Vegas casino. Stepped black-and-gold block, marquee billboard, pylon sign, a giant chip, red carpet, chasing bulbs. */
function buildBetmgm(b: Builder, p: Prop, q: QualitySettings): (time: number) => void {
  const black = b.mat(PALETTE.betBlack);
  const gold = b.mat(PALETTE.betGold, { emissive: 0x3a2c0c });
  const neon = b.mat(0xffd76a, { emissive: 0xb8860b });
  const ex = p.x + p.w;
  const sz = p.z + p.d;
  const cz = 8.5; // the door tile is at z = 8

  // Stepped massing: main block, a set-back crown, gold cornices on both.
  b.box(p.x, 0, p.z, p.w, p.h - 0.05, p.d, black);
  b.box(p.x - 0.15, p.h - 0.5, p.z - 0.15, p.w + 0.3, 0.5, p.d + 0.3, gold);
  b.box(p.x - 0.1, 0, p.z - 0.1, p.w + 0.2, 0.35, p.d + 0.2, gold);
  b.box(p.x + 1.6, p.h, p.z + 1.6, p.w - 3.2, 1.6, p.d - 3.2, black);
  b.box(p.x + 1.45, p.h + 1.6, p.z + 1.45, p.w - 2.9, 0.3, p.d - 2.9, gold);
  // Gold pilasters with neon strips between them on both visible faces.
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    b.box(ex, 0.35, p.z + 0.2 + t * (p.d - 0.7), 0.14, p.h - 0.85, 0.3, gold);
    b.box(p.x + 0.2 + t * (p.w - 0.7), 0.35, sz, 0.3, p.h - 0.85, 0.14, gold);
    if (i < 5) {
      b.box(p.x + 1.25 + t * (p.w - 0.7), 0.9, sz, 0.1, p.h - 2.0, 0.05, neon);
      if (Math.abs(p.z + 1.25 + t * (p.d - 0.7) - cz) > 3) b.box(ex, 0.9, p.z + 1.25 + t * (p.d - 0.7), 0.05, p.h - 2.0, 0.1, neon);
    }
  }
  // Porte-cochère canopy, entrance surround, and a red carpet out to the path.
  b.box(ex, 2.9, cz - 3.0, 2.3, 0.35, 6.0, gold);
  b.box(ex, 2.75, cz - 2.85, 2.15, 0.15, 5.7, black);
  b.box(ex, 0.35, cz - 1.7, 0.2, 2.4, 0.35, gold);
  b.box(ex, 0.35, cz + 1.35, 0.2, 2.4, 0.35, gold);
  flat(b, ex, cz - 0.75, 3.0, 1.5, 0.04, b.mat(0xb3121f));

  // Marquee billboard on the crown, facing the path.
  b.box(ex - 1.5, p.h + 0.2, cz - 3.6, 0.4, 3.1, 7.2, black);
  b.box(ex - 1.55, p.h + 0.1, cz - 3.7, 0.5, 0.2, 7.4, gold);
  b.box(ex - 1.55, p.h + 3.2, cz - 3.7, 0.5, 0.2, 7.4, gold);
  b.panel(ex - 1.1, p.h + 1.75, cz, 6.6, 2.6, 'e', logoSign('/images/logos/betmgm.webp', 0x000000, 6.6 / 2.6), 0.02);

  // Pylon sign on the corner, lettered down both faces, with a star on top.
  const px = ex - 0.2;
  const pz = sz - 0.2;
  const ph = 10.5;
  b.box(px, 0, pz, 1.0, ph, 1.0, black);
  b.box(px - 0.08, ph, pz - 0.08, 1.16, 0.25, 1.16, gold);
  const letters = verticalSign('BETMGM', PALETTE.betBlack, 0xffd76a);
  b.panel(px + 1.0, ph - 3.2, pz + 0.5, 0.86, 5.6, 'e', letters, 0.02);
  b.panel(px + 0.5, ph - 3.2, pz + 1.0, 0.86, 5.6, 's', letters, 0.02);
  const star = b.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.55), new THREE.MeshBasicMaterial({ color: 0xffd76a })));
  star.position.set(px + 0.5, ph + 1.0, pz + 0.5);
  star.userData.dynamic = true;

  // Giant chip standing on the crown, slowly turning.
  const chip = new THREE.Group();
  const chipMat = new THREE.MeshLambertMaterial({ map: chipTexture() });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.36, 28).rotateX(Math.PI / 2), gold);
  rim.castShadow = true;
  rim.userData.dynamic = true;
  chip.add(rim);
  for (const side of [1, -1]) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(1.48, 28), chipMat);
    face.position.z = side * 0.19;
    if (side < 0) face.rotation.y = Math.PI;
    face.userData.dynamic = true;
    chip.add(face);
  }
  chip.position.set(p.x + 4.2, p.h + 3.7, sz - 3.6);
  b.box(p.x + 4.1, p.h + 1.9, sz - 3.7, 0.2, 0.5, 0.2, gold);
  b.add(chip);

  const spin = (time: number) => {
    chip.rotation.y = time * 0.6;
    star.rotation.y = time * 1.5;
  };
  if (!q.ambientDetail) return spin;

  // Chasing bulbs: two interleaved sets that swap brightness.
  const sets = [0, 1].map(() => new THREE.MeshBasicMaterial({ color: PALETTE.bulb }));
  const geo = new THREE.SphereGeometry(0.11, 6, 4);
  const spots: THREE.Vector3[] = [];
  const run = (from: THREE.Vector3, to: THREE.Vector3, step = 0.45) => {
    const n = Math.max(1, Math.round(from.distanceTo(to) / step));
    for (let i = 0; i <= n; i++) spots.push(from.clone().lerp(to, i / n));
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  run(v(ex + 2.32, 3.08, cz - 3.0), v(ex + 2.32, 3.08, cz + 3.0)); // canopy edge
  run(v(ex - 1.05, p.h + 0.45, cz - 3.5), v(ex - 1.05, p.h + 0.45, cz + 3.5)); // billboard border
  run(v(ex - 1.05, p.h + 3.05, cz - 3.5), v(ex - 1.05, p.h + 3.05, cz + 3.5));
  run(v(ex - 1.05, p.h + 0.9, cz - 3.5), v(ex - 1.05, p.h + 2.6, cz - 3.5));
  run(v(ex - 1.05, p.h + 0.9, cz + 3.5), v(ex - 1.05, p.h + 2.6, cz + 3.5));
  run(v(ex + 0.18, p.h - 0.25, p.z + 0.3), v(ex + 0.18, p.h - 0.25, sz - 0.5), 0.7); // cornice
  run(v(p.x + 0.3, p.h - 0.25, sz + 0.18), v(ex - 0.5, p.h - 0.25, sz + 0.18), 0.7);
  run(v(px + 1.06, ph - 6.2, pz + 0.02), v(px + 1.06, ph - 0.2, pz + 0.02), 0.5); // pylon edges
  run(v(px + 0.02, ph - 6.2, pz + 1.06), v(px + 0.02, ph - 0.2, pz + 1.06), 0.5);
  const m = new THREE.Matrix4();
  [0, 1].forEach((k) => {
    const mine = spots.filter((_, i) => i % 2 === k);
    const inst = new THREE.InstancedMesh(geo, sets[k], mine.length);
    mine.forEach((s, i) => inst.setMatrixAt(i, m.makeTranslation(s.x, s.y, s.z)));
    b.add(inst);
  });
  const on = new THREE.Color(PALETTE.bulb);
  const off = new THREE.Color(0x6b5a2e);
  return (time) => {
    spin(time);
    const phase = Math.floor(time * 2.5) % 2;
    sets[0].color.copy(phase ? on : off);
    sets[1].color.copy(phase ? off : on);
  };
}

function buildWorkshop(b: Builder, p: Prop): void {
  const wall = b.mat(0x8a8f98);
  b.box(p.x, 0, p.z, p.w, p.h, p.d, wall);
  // Shed roof with a small overhang.
  b.box(p.x - 0.2, p.h, p.z - 0.2, p.w + 0.4, 0.25, p.d + 0.4, b.mat(0x4b5563));
  // Roll-up door on the south face, centered on the door tile.
  const sz = p.z + p.d;
  const cx = p.x + p.w / 2;
  b.panel(cx, 1.45, sz, 3.4, 2.9, 's', new THREE.MeshLambertMaterial({ map: rollupTexture() }));
  b.box(cx - 1.85, 0, sz, 0.15, 3.05, 0.1, b.mat(0x374151));
  b.box(cx + 1.7, 0, sz, 0.15, 3.05, 0.1, b.mat(0x374151));
  // Name board standing on the roof edge, where the camera can read it.
  b.box(cx - 2.6, p.h + 0.25, sz - 0.1, 5.2, 1.0, 0.2, b.mat(0x1f2937));
  b.panel(cx, p.h + 0.75, sz + 0.1, 5.0, 0.85, 's', textSign('THE WORKSHOP', 0x1f2937, 0xfbbf24, 5.0 / 0.85), 0.02);
  // Side window and string lights.
  b.panel(p.x + p.w, 2.2, p.z + p.d / 2, 2.4, 1.2, 'e', b.mat(PALETTE.glass, { emissive: 0x16384d }));
  const bulb = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  const geo = new THREE.SphereGeometry(0.09, 6, 4);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    b.add(new THREE.Mesh(geo, bulb)).position.set(p.x + 0.4 + t * (p.w - 0.8), 3.55 - Math.sin(t * Math.PI) * 0.3, sz + 0.75);
  }
}

// ---------- props ----------

function buildFountain(b: Builder, p: Prop): void {
  const cx = p.x + p.w / 2;
  const cz = p.z + p.d / 2;
  const stone = b.mat(PALETTE.stone);
  b.mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.6, 10), stone, cx, 0.3, cz).receiveShadow = true;
  b.mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.1, 10), b.mat(PALETTE.water, { emissive: 0x0b3a52 }), cx, 0.58, cz).castShadow = false;
  b.mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.5, 8), stone, cx, 0.9, cz);
  b.mesh(new THREE.CylinderGeometry(0.7, 0.25, 0.25, 8), stone, cx, 1.6, cz);
  b.mesh(new THREE.SphereGeometry(0.28, 8, 6), b.mat(PALETTE.water, { emissive: 0x0b3a52 }), cx, 1.85, cz);
}

function buildKiosk(b: Builder, p: Prop): (time: number) => void {
  const cx = p.x + p.w / 2;
  const cz = p.z + p.d / 2;
  b.box(cx - 0.3, 0, cz - 0.2, 0.6, 1.1, 0.4, b.mat(0x1f2937));
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const screen = b.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.08), screenMat));
  screen.position.set(cx, 1.45, cz + 0.02);
  screen.rotation.x = -0.25;
  const label = b.add(new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.5), textSign('RÉSUMÉ', 0x0b1220, 0x7dd3fc, 0.72 / 0.5)));
  label.position.set(cx, 1.46, cz + 0.07);
  label.rotation.x = -0.25;
  const a = new THREE.Color(0x38bdf8);
  const c = new THREE.Color(0x0ea5e9);
  return (time) => screenMat.color.lerpColors(c, a, 0.5 + Math.sin(time * 3) * 0.5);
}

function buildFence(b: Builder, p: Prop): void {
  // Chain-link: posts, a top rail, and a see-through panel, so the court stays visible from outside.
  const steel = b.mat(PALETTE.steel);
  const alongX = p.w >= p.d;
  const len = alongX ? p.w : p.d;
  const cx = p.x + p.w / 2;
  const cz = p.z + p.d / 2;
  const posts = Math.max(2, Math.round(len / 2) + 1);
  for (let i = 0; i < posts; i++) {
    const t = (i / (posts - 1) - 0.5) * (len - 0.2);
    b.box((alongX ? cx + t : cx) - 0.06, 0, (alongX ? cz : cz + t) - 0.06, 0.12, p.h, 0.12, steel);
  }
  b.box(alongX ? p.x : cx - 0.04, p.h - 0.08, alongX ? cz - 0.04 : p.z, alongX ? p.w : 0.08, 0.08, alongX ? 0.08 : p.d, steel);
  const mesh = b.add(new THREE.Mesh(new THREE.PlaneGeometry(len, p.h - 0.15), b.mat(0xcbd5e1, { opacity: 0.22 })));
  (mesh.material as THREE.Material).side = THREE.DoubleSide;
  mesh.position.set(cx, p.h / 2, cz);
  if (!alongX) mesh.rotation.y = Math.PI / 2;
}

function buildBleachers(b: Builder, p: Prop): void {
  const steel = b.mat(0x9ca3af);
  for (let i = 0; i < 3; i++) b.box(p.x, 0, p.z + (i * p.d) / 3, p.w, p.h - i * 0.5, p.d / 3, steel);
  // Scoreboard-style name board above the top row, facing the court.
  b.box(p.x + p.w / 2 - 3.3, p.h + 0.2, p.z - 0.05, 6.6, 1.5, 0.25, b.mat(0x111827));
  b.panel(p.x + p.w / 2, p.h + 0.95, p.z + 0.2, 6.2, 1.2, 's', textSign("CALVIN'S COURT", 0x111827, 0xfbbf24, 6.2 / 1.2), 0.02);
  for (const dx of [-3, 3]) b.box(p.x + p.w / 2 + dx - 0.08, 0, p.z, 0.16, p.h + 0.3, 0.16, steel);
}

function buildHoop(b: Builder, p: Prop): void {
  // Modeled facing +z, then turned by the prop's rotation.
  const g = new Builder(true);
  const steel = g.mat(0x4b5563);
  g.box(-0.1, 0, -0.1, 0.2, 3.3, 0.2, steel);
  g.box(-0.08, 3.1, -0.05, 0.16, 0.16, 0.75, steel);
  g.box(-0.9, 2.75, 0.62, 1.8, 1.1, 0.08, g.mat(0xf8fafc));
  const rim = g.mesh(new THREE.TorusGeometry(0.24, 0.03, 6, 14).rotateX(Math.PI / 2), g.mat(0xf97316), 0, 3.0, 0.98);
  rim.castShadow = false;
  const net = g.mesh(new THREE.CylinderGeometry(0.24, 0.15, 0.4, 8, 1, true), g.mat(0xffffff, { opacity: 0.55 }), 0, 2.8, 0.98);
  net.castShadow = false;
  (net.material as THREE.Material).side = THREE.DoubleSide;
  g.group.position.set(p.x + p.w / 2, 0, p.z + p.d / 2);
  g.group.rotation.y = p.rotation ?? 0;
  b.add(g.group);
}

function buildChessTable(b: Builder, p: Prop): void {
  const cx = p.x + p.w / 2;
  const cz = p.z + p.d / 2;
  const stone = b.mat(PALETTE.stone);
  b.mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.75, 8), stone, cx, 0.375, cz);
  b.box(cx - 0.45, 0.75, cz - 0.45, 0.9, 0.1, 0.9, stone);
  const board = b.add(new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.66).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: checkerTexture() })));
  board.position.set(cx, 0.86, cz);
  // Stools on the east and west sides.
  for (const dx of [-0.85, 0.85]) b.mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.45, 8), stone, cx + dx, 0.225, cz);
}

function buildTrophyCase(b: Builder, p: Prop): void {
  b.box(p.x + 0.1, 0, p.z + 0.2, p.w - 0.2, 0.8, 0.6, b.mat(PALETTE.wood));
  const glass = b.box(p.x + 0.15, 0.8, p.z + 0.25, p.w - 0.3, 1.1, 0.5, b.mat(0xdbeafe, { opacity: 0.3 }));
  glass.castShadow = false;
  const gold = b.mat(0xfacc15, { emissive: 0x4a3a05 });
  for (const dx of [0.55, 1.0, 1.45]) {
    const cx = p.x + dx;
    const cz = p.z + 0.5;
    b.mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.12, 8), gold, cx, 0.86, cz);
    b.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), gold, cx, 1.0, cz);
    b.mesh(new THREE.SphereGeometry(dx === 1.0 ? 0.17 : 0.13, 8, 6), gold, cx, 1.2, cz);
  }
}

function buildDoor(b: Builder, d: Door): (time: number) => void {
  const out = FACE_OUT[d.facing];
  // The door sits on the wall: the edge of the door tile opposite to the way it faces.
  const wx = d.x + 0.5 - out[0] * 0.5;
  const wz = d.z + 0.5 - out[1] * 0.5;
  b.panel(wx, 1.2, wz, 1.9, 2.4, d.facing, b.mat(0x111827), 0.07);
  b.panel(wx, 1.15, wz, 1.5, 2.2, d.facing, b.mat(d.color, { emissive: new THREE.Color(d.color).multiplyScalar(0.25).getHex() }), 0.1);
  // Welcome mat on the door tile.
  flat(b, d.x + 0.1, d.z + 0.1, 0.8, 0.8, 0.034, b.mat(d.color));
  // Floating badge above the door: grey until earned (M4 turns it full color).
  const badge = b.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.42), new THREE.MeshLambertMaterial({ color: 0xaab0b8, flatShading: true })));
  badge.userData.dynamic = true;
  badge.position.set(wx + out[0] * 0.9, 3.4, wz + out[1] * 0.9);
  const phase = d.x * 0.7 + d.z;
  return (time) => {
    badge.rotation.y = time * 1.2 + phase;
    badge.position.y = 3.4 + Math.sin(time * 1.6 + phase) * 0.12;
  };
}

function buildSigns(b: Builder, map: MapDef): void {
  // Banner arch over the walk into the Weightroom. Posts sit just off the path, so nothing blocks.
  const steel = b.mat(PALETTE.steel);
  const zone = map.zones.find((z) => z.kind === 'concrete');
  const walk = zone && map.zones.find((z) => z.kind === 'path' && z.z + z.d === zone.z);
  if (zone && walk) {
    const z = zone.z + 0.3;
    const x0 = walk.x - 0.65;
    const x1 = walk.x + walk.w + 0.5;
    b.box(x0, 0, z, 0.16, 3.6, 0.16, steel);
    b.box(x1, 0, z, 0.16, 3.6, 0.16, steel);
    b.box(x0 - 0.05, 2.8, z + 0.02, x1 - x0 + 0.26, 0.85, 0.12, b.mat(0x111827));
    b.panel((x0 + x1) / 2 + 0.08, 3.22, z + 0.14, x1 - x0, 0.7, 's', textSign('THE WEIGHTROOM', 0x111827, 0xffffff, (x1 - x0) / 0.7), 0.02);
  }
}

// ---------- Weightroom props ----------

function tickerTexture(): THREE.CanvasTexture {
  return canvasTexture(384, 192, (ctx) => {
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, 384, 192);
    ctx.font = '700 26px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'middle';
    // Made-up lines for a sportsbook board. Team cities only, no logos.
    const rows: [string, string, string][] = [
      ['LAL', '-110', '#22c55e'],
      ['NYK', '+105', '#f87171'],
      ['LAR', '-115', '#22c55e'],
      ['SF', '+120', '#f87171'],
      ['UCLA', '-3.5', '#fbbf24'],
    ];
    rows.forEach(([team, line, color], i) => {
      ctx.fillStyle = '#e5e7eb';
      ctx.fillText(team, 24, 26 + i * 35);
      ctx.fillStyle = color;
      ctx.fillText(line, 250, 26 + i * 35);
    });
  });
}

function buildTickerBoard(b: Builder, p: Prop): void {
  const cx = p.x + p.w / 2;
  for (const x of [p.x + 0.2, p.x + p.w - 0.36]) b.box(x, 0, p.z + 0.42, 0.16, p.h, 0.16, b.mat(PALETTE.steel));
  b.box(p.x + 0.1, 0.9, p.z + 0.38, p.w - 0.2, 1.7, 0.24, b.mat(0x111827));
  b.panel(cx, 1.75, p.z + 0.62, p.w - 0.4, 1.5, 's', new THREE.MeshBasicMaterial({ map: tickerTexture() }), 0.02);
}

function buildWorkbench(b: Builder, p: Prop): void {
  const wood = b.mat(PALETTE.wood);
  b.box(p.x + 0.05, p.h - 0.1, p.z + 0.15, p.w - 0.1, 0.1, 0.75, wood);
  for (const [dx, dz] of [[0.1, 0.2], [p.w - 0.22, 0.2], [0.1, 0.75], [p.w - 0.22, 0.75]]) b.box(p.x + dx, 0, p.z + dz, 0.12, p.h - 0.1, 0.12, b.mat(0x5a3620));
  // Two monitors, and a caution sign: this one is a work in progress.
  const glow = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
  for (const dx of [0.5, 1.3]) {
    b.box(p.x + dx - 0.03, p.h, p.z + 0.4, 0.06, 0.18, 0.06, b.mat(0x374151));
    b.box(p.x + dx - 0.32, p.h + 0.16, p.z + 0.38, 0.64, 0.44, 0.05, b.mat(0x0b0f17));
    b.panel(p.x + dx, p.h + 0.38, p.z + 0.43, 0.58, 0.38, 's', glow, 0.01);
  }
  const sign = b.mesh(new THREE.ConeGeometry(0.42, 0.7, 3).rotateY(Math.PI), b.mat(0xfacc15, { emissive: 0x4a3a05 }), p.x + p.w + 0.55, 0.55, p.z + 0.7);
  sign.scale.z = 0.18;
  b.box(p.x + p.w + 0.52, 0, p.z + 0.68, 0.06, 0.25, 0.06, b.mat(PALETTE.steel));
}

function buildSquatRack(b: Builder, p: Prop): void {
  const steel = b.mat(0x374151);
  const plate = b.mat(0x111827);
  for (const x of [p.x + 0.25, p.x + p.w - 0.37]) {
    b.box(x, 0, p.z + 0.25, 0.12, p.h, 0.12, steel);
    b.box(x, 0, p.z + 0.65, 0.12, 0.12, 0.3, steel);
  }
  b.box(p.x + 0.25, p.h - 0.12, p.z + 0.25, p.w - 0.5, 0.12, 0.12, steel);
  const bar = b.mesh(new THREE.CylinderGeometry(0.035, 0.035, p.w + 0.5, 8).rotateZ(Math.PI / 2), b.mat(0xcbd5e1), p.x + p.w / 2, 1.45, p.z + 0.42);
  bar.castShadow = false;
  for (const x of [p.x - 0.05, p.x + p.w + 0.05]) b.mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 14).rotateZ(Math.PI / 2), plate, x, 1.45, p.z + 0.42);
}

function buildBenchPress(b: Builder, p: Prop): void {
  const steel = b.mat(0x374151);
  b.box(p.x + 0.3, 0.4, p.z + 0.2, 0.4, 0.12, p.d - 0.5, b.mat(0x7f1d1d));
  b.box(p.x + 0.42, 0, p.z + 0.4, 0.16, 0.4, 0.16, steel);
  b.box(p.x + 0.42, 0, p.z + p.d - 0.7, 0.16, 0.4, 0.16, steel);
  for (const x of [p.x + 0.1, p.x + 0.8]) b.box(x, 0, p.z + 0.15, 0.1, p.h, 0.1, steel);
  b.mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8).rotateZ(Math.PI / 2), b.mat(0xcbd5e1), p.x + 0.5, p.h, p.z + 0.2);
  for (const x of [p.x - 0.2, p.x + 1.2]) b.mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 14).rotateZ(Math.PI / 2), b.mat(0x111827), x, p.h, p.z + 0.2);
}

function buildDumbbellRack(b: Builder, p: Prop): void {
  const steel = b.mat(0x374151);
  b.box(p.x + 0.1, 0.35, p.z + 0.3, p.w - 0.2, 0.06, 0.45, steel);
  b.box(p.x + 0.1, 0.75, p.z + 0.3, p.w - 0.2, 0.06, 0.45, steel);
  for (const x of [p.x + 0.1, p.x + p.w - 0.18]) b.box(x, 0, p.z + 0.3, 0.08, p.h, 0.45, steel);
  const head = new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8).rotateX(Math.PI / 2);
  const colors = [0x111827, 0x1d4ed8, 0xb91c1c];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 5; i++) {
      const x = p.x + 0.3 + i * ((p.w - 0.6) / 4);
      const y = 0.5 + row * 0.4;
      const m = b.mat(colors[(i + row) % 3]);
      b.mesh(head, m, x, y, p.z + 0.38);
      b.mesh(head, m, x, y, p.z + 0.68);
      b.box(x - 0.025, y - 0.025, p.z + 0.38, 0.05, 0.05, 0.3, b.mat(0xcbd5e1));
    }
  }
}

/** Non-colliding dressing: flowers, bushes, pond lilies and rocks, door planters, and a skyline past the hedges. */
function scatterDecor(map: MapDef, place: (model: string, x: number, z: number, scale: number, rotY?: number, y?: number) => void, b: Builder): void {
  const rand = rng(2026);
  const rects = [...map.zones, ...map.props];
  const onGrass = (x: number, z: number, margin: number) =>
    x > 1.5 && z > 1.5 && x < map.width - 1.5 && z < map.height - 1.5 &&
    rects.every((r) => x + margin <= r.x || x - margin >= r.x + r.w || z + margin <= r.z || z - margin >= r.z + r.d);

  const flowers = ['flower-red', 'flower-yellow', 'flower-purple'];
  for (let i = 0, placed = 0; placed < 150 && i < 3000; i++) {
    const x = 2 + rand() * (map.width - 4);
    const z = 2 + rand() * (map.height - 4);
    if (!onGrass(x, z, 0.4)) continue;
    // Flowers grow in little clusters.
    const kind = flowers[Math.floor(rand() * flowers.length)];
    for (let k = 0; k < 3; k++) place(kind, x + (rand() - 0.5) * 0.9, z + (rand() - 0.5) * 0.9, 1.6 + rand() * 0.8, rand() * 6.28);
    placed += 3;
  }
  for (let i = 0, placed = 0; placed < 45 && i < 2000; i++) {
    const x = 2 + rand() * (map.width - 4);
    const z = 2 + rand() * (map.height - 4);
    if (!onGrass(x, z, 0.8)) continue;
    place(rand() < 0.5 ? 'bush' : 'bush-detailed', x, z, 2.4 + rand() * 1.4, rand() * 6.28);
    placed++;
  }

  const pond = map.zones.find((z) => z.kind === 'water');
  if (pond) {
    for (let i = 0; i < 7; i++) place('lily', pond.x + 1 + rand() * (pond.w - 2), pond.z + 1 + rand() * (pond.d - 2), 2.2 + rand(), rand() * 6.28, 0.03);
    for (let i = 0; i < 8; i++) {
      const side = i % 4;
      const t = rand();
      const x = side === 0 ? pond.x - 0.2 : side === 1 ? pond.x + pond.w + 0.2 : pond.x + t * pond.w;
      const z = side === 2 ? pond.z - 0.2 : side === 3 ? pond.z + pond.d + 0.2 : pond.z + t * pond.d;
      place(i % 2 ? 'rock-small' : 'rock-large', x, z, 1.1 + rand() * 0.7, rand() * 6.28);
    }
  }

  // Planters flanking each gym door, tucked against the wall.
  for (const d of map.doors) {
    const out = FACE_OUT[d.facing];
    const side: [number, number] = [out[1], out[0]];
    for (const s of [-1.45, 1.45]) {
      place('planter', d.x + 0.5 - out[0] * 0.28 + side[0] * s, d.z + 0.5 - out[1] * 0.28 + side[1] * s, 2.1, FACE_ROT[d.facing]);
    }
  }

  // Skyline past the north and west hedges (the directions the camera looks).
  const sky = ['skyline-a', 'skyline-b', 'skyline-c', 'skyline-d'];
  for (let i = 0; i < 16; i++) place(sky[i % 4], -14 - rand() * 26, -8 + i * 5 + rand() * 2, 7 + rand() * 6, Math.floor(rand() * 4) * (Math.PI / 2));
  for (let i = 0; i < 15; i++) place(sky[(i + 1) % 4], -6 + i * 5 + rand() * 2, -14 - rand() * 26, 7 + rand() * 6, Math.floor(rand() * 4) * (Math.PI / 2));
  void b;
}

// ---------- lighting ----------

export interface Sun {
  objects: THREE.Object3D[];
  /** Keep the shadow frustum centered on what the camera is looking at. */
  follow(x: number, z: number): void;
  setShadows(mapSize: number): void;
}

/** Warm afternoon sun with soft shadows, plus sky fill. */
export function createSun(renderer: THREE.WebGLRenderer, mapSize: number): Sun {
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.4);
  const offset = new THREE.Vector3(-34, 46, 22);
  const hemi = new THREE.HemisphereLight(0xd4ecff, 0x7c9a63, 1.35);
  const RANGE = 46;
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -RANGE;
  cam.right = cam.top = RANGE;
  cam.near = 1;
  cam.far = 160;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;

  const setShadows = (size: number) => {
    const on = size > 0;
    renderer.shadowMap.enabled = on;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sun.castShadow = on;
    if (on && sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  };
  setShadows(mapSize);

  return {
    objects: [sun, sun.target, hemi],
    follow(x, z) {
      // Snap to whole units so shadow edges don't shimmer as the camera moves.
      const sx = Math.round(x);
      const sz = Math.round(z);
      sun.target.position.set(sx, 0, sz);
      sun.position.set(sx + offset.x, offset.y, sz + offset.z);
      sun.target.updateMatrixWorld();
    },
    setShadows,
  };
}
