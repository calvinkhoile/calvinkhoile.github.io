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
class Builder {
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

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Text sign. Signs are basic (unlit) materials so they stay readable in shadow. */
function textSign(text: string, bg: number, fg: number, aspect: number, font = '800'): THREE.MeshBasicMaterial {
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
function logoSign(url: string, bg: number, aspect: number): THREE.MeshBasicMaterial {
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

  const building = (build: (b: Builder) => void): void => {
    const b = new Builder(shadows);
    build(b);
    b.merge();
    root.add(b.group);
    occluders.push({ object: b.group, materials: b.materials(), opacity: 1 });
  };

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
        building((b) => buildUcla(b, p));
        break;
      case 'gym-ucla-tower':
        building((b) => buildUclaTower(b, p));
        break;
      case 'gym-deloitte':
        building((b) => buildDeloitte(b, p, kit));
        break;
      case 'gym-meta':
        building((b) => buildMeta(b, p));
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

function flat(b: Builder, x: number, z: number, w: number, d: number, y: number, material: THREE.Material): THREE.Mesh {
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

function buildUcla(b: Builder, p: Prop): void {
  const brick = b.mat(PALETTE.brick);
  b.box(p.x, 0, p.z, p.w, p.h, p.d, brick);
  // Pitched tile roof running north-south, plus a stone base course.
  // Hip roof: a four-sided pyramid stretched to the footprint, with a small overhang.
  const roof = b.mesh(new THREE.ConeGeometry((p.w / 2) * Math.SQRT2 * 1.05, 2.4, 4).rotateY(Math.PI / 4), b.mat(0xb5553a), p.x + p.w / 2, p.h + 1.2, p.z + p.d / 2);
  roof.scale.z = p.d / p.w;
  b.box(p.x - 0.1, 0, p.z - 0.1, p.w + 0.2, 0.5, p.d + 0.2, b.mat(PALETTE.stone));
  // Arched entrance between the towers (east face).
  const ex = p.x + p.w;
  const cz = p.z + p.d / 2;
  b.panel(ex, 1.5, cz, 2.6, 3, 'e', b.mat(PALETTE.brickDark));
  const arch = b.add(new THREE.Mesh(new THREE.CircleGeometry(1.3, 16, 0, Math.PI), b.mat(PALETTE.brickDark)));
  arch.position.set(ex + 0.04, 3, cz);
  arch.rotation.y = Math.PI / 2;
  b.panel(ex, 4.25, cz, 3.4, 1.1, 'e', logoSign('/images/logos/ucla.webp', 0xffffff, 3.4 / 1.1), 0.08);
  // Blue and gold banners on the south wall.
  for (let i = 0; i < 4; i++) {
    b.panel(p.x + 1.5 + i * 2.2, 2.6, p.z + p.d, 0.8, 2.4, 's', b.mat(i % 2 ? PALETTE.uclaGold : PALETTE.uclaBlue));
  }
}

function buildUclaTower(b: Builder, p: Prop): void {
  const brick = b.mat(PALETTE.brick);
  // Slightly proud of the main wall so the towers read as towers.
  b.box(p.x + 0.1, 0, p.z - 0.1, p.w + 0.25, p.h, p.d + 0.2, brick);
  b.box(p.x, p.h, p.z - 0.2, p.w + 0.45, 0.3, p.d + 0.4, b.mat(PALETTE.stone));
  b.mesh(new THREE.ConeGeometry(1.75, 2, 4).rotateY(Math.PI / 4), b.mat(PALETTE.roofTile), p.x + p.w / 2 + 0.22, p.h + 1.3, p.z + p.d / 2);
  const win = b.mat(0x2b3440, { emissive: 0x0a1626 });
  for (const y of [5.6, 6.9]) {
    b.panel(p.x + p.w + 0.35, y, p.z + p.d / 2, 0.7, 0.9, 'e', win);
    b.panel(p.x + p.w / 2 + 0.2, y, p.z + p.d + 0.1, 0.7, 0.9, 's', win);
  }
}

function buildDeloitte(b: Builder, p: Prop, kit: Kit): void {
  // Glass office tower from the kit, darkened, on a black podium with the green dot.
  const tower = kit.single('tower', 0x8b9299);
  const scale = (p.w - 0.6) / 1.36;
  tower.scale.setScalar(scale);
  tower.rotation.y = Math.PI / 2;
  tower.position.set(p.x + p.w / 2, 0, p.z + p.d / 2);
  tower.traverse((o) => {
    o.castShadow = true;
  });
  b.add(tower);
  const ex = p.x + p.w;
  const cz = p.z + p.d / 2;
  b.box(ex - 0.5, 3.1, cz - 2.6, 0.7, 1.5, 5.2, b.mat(0x0d0d0d));
  b.panel(ex + 0.2, 3.85, cz, 4.6, 1.2, 'e', logoSign('/images/logos/deloitte.webp', 0x000000, 4.6 / 1.2), 0.02);
  b.box(ex - 0.52, 2.95, cz - 2.62, 0.74, 0.15, 5.24, b.mat(PALETTE.deloitteGreen, { emissive: 0x2c4a05 }));
}

function buildMeta(b: Builder, p: Prop): void {
  const white = b.mat(PALETTE.white);
  b.box(p.x, 0, p.z, p.w, p.h, p.d, white);
  // Flat overhanging roof with a Meta-blue fascia.
  b.box(p.x - 0.4, p.h, p.z - 0.4, p.w + 1.1, 0.25, p.d + 1.1, white);
  b.box(p.x - 0.42, p.h - 0.35, p.z - 0.42, p.w + 1.14, 0.35, p.d + 1.14, b.mat(PALETTE.metaBlue));
  // Long glass walls.
  const glass = b.mat(PALETTE.glass, { emissive: 0x16384d });
  b.panel(p.x + p.w, 1.55, p.z + 1.7, 2.6, 2.3, 'e', glass);
  b.panel(p.x + p.w, 1.55, p.z + p.d - 1.4, 2.0, 2.3, 'e', glass);
  b.panel(p.x + p.w / 2, 1.55, p.z + p.d, p.w - 1.6, 2.3, 's', glass);
  for (let i = 1; i < 5; i++) b.box(p.x + (p.w / 5) * i - 0.06, 0.3, p.z + p.d, 0.12, 2.5, 0.08, white);
  // Rooftop sign.
  const cz = p.z + 3.5;
  b.box(p.x + p.w - 0.3, p.h + 0.25, cz - 2.2, 0.3, 2.3, 4.4, white);
  b.panel(p.x + p.w, p.h + 1.4, cz, 4.2, 2.0, 'e', logoSign('/images/logos/meta.svg', 0xffffff, 2.1), 0.02);
}

function buildBetmgm(b: Builder, p: Prop, q: QualitySettings): (time: number) => void {
  const black = b.mat(PALETTE.betBlack);
  const gold = b.mat(PALETTE.betGold, { emissive: 0x3a2c0c });
  b.box(p.x, 0, p.z, p.w, p.h - 0.05, p.d, black);
  b.box(p.x - 0.15, p.h - 0.5, p.z - 0.15, p.w + 0.3, 0.5, p.d + 0.3, gold);
  b.box(p.x + 0.35, p.h - 0.05, p.z + 0.35, p.w - 0.7, 0.12, p.d - 0.7, b.mat(0x24211b));
  b.box(p.x - 0.1, 0, p.z - 0.1, p.w + 0.2, 0.35, p.d + 0.2, gold);
  // Gold pilasters on the visible faces.
  for (let i = 0; i <= 4; i++) {
    b.box(p.x + p.w, 0.35, p.z + 0.3 + (i * (p.d - 0.9)) / 4, 0.12, p.h - 0.85, 0.3, gold);
    b.box(p.x + 0.3 + (i * (p.w - 0.9)) / 4, 0.35, p.z + p.d, 0.3, p.h - 0.85, 0.12, gold);
  }
  // Canopy and marquee over the door (door tile is at z = 8, so the entrance centers on 8.5).
  const cz = 8.5;
  const ex = p.x + p.w;
  b.box(ex, 2.7, cz - 2.4, 1.5, 0.3, 4.8, gold);
  b.box(ex + 0.1, 3.0, cz - 2.2, 0.35, 1.7, 4.4, black);
  b.panel(ex + 0.45, 3.85, cz, 4.2, 1.5, 'e', logoSign('/images/logos/betmgm.webp', 0x000000, 4.2 / 1.5), 0.02);

  if (!q.ambientDetail) return () => {};
  // Chasing marquee bulbs: two interleaved sets that swap brightness.
  const sets = [0, 1].map(() => new THREE.MeshBasicMaterial({ color: PALETTE.bulb }));
  const geo = new THREE.SphereGeometry(0.11, 6, 4);
  const spots: THREE.Vector3[] = [];
  for (let z = cz - 2.3; z <= cz + 2.31; z += 0.46) spots.push(new THREE.Vector3(ex + 1.5, 2.85, z), new THREE.Vector3(ex + 0.5, 4.75, z));
  for (let z = p.z + 0.3; z <= p.z + p.d; z += 0.8) spots.push(new THREE.Vector3(ex + 0.18, p.h - 0.25, z));
  for (let x = p.x + 0.3; x <= p.x + p.w; x += 0.8) spots.push(new THREE.Vector3(x, p.h - 0.25, p.z + p.d + 0.18));
  const m = new THREE.Matrix4();
  [0, 1].forEach((k) => {
    const mine = spots.filter((_, i) => i % 2 === k);
    const inst = new THREE.InstancedMesh(geo, sets[k], mine.length);
    mine.forEach((v, i) => inst.setMatrixAt(i, m.makeTranslation(v.x, v.y, v.z)));
    b.add(inst);
  });
  const on = new THREE.Color(PALETTE.bulb);
  const off = new THREE.Color(0x6b5a2e);
  return (time) => {
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
  // Banner arch over the walk into the Blacktop. Posts sit just off the path, so nothing blocks.
  const steel = b.mat(PALETTE.steel);
  const zone = map.zones.find((z) => z.kind === 'concrete');
  if (zone) {
    const z = zone.z + 0.3;
    b.box(64.35, 0, z, 0.16, 3.6, 0.16, steel);
    b.box(68.5, 0, z, 0.16, 3.6, 0.16, steel);
    b.box(64.3, 2.8, z + 0.02, 4.4, 0.85, 0.12, b.mat(0x111827));
    b.panel(66.5, 3.22, z + 0.14, 4.2, 0.7, 's', textSign('THE BLACKTOP', 0x111827, 0xffffff, 6), 0.02);
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
  for (let i = 0; i < 20; i++) place(sky[(i + 1) % 4], -6 + i * 5 + rand() * 2, -14 - rand() * 26, 7 + rand() * 6, Math.floor(rand() * 4) * (Math.PI / 2));
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
