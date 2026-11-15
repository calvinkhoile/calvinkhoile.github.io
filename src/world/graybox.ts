import * as THREE from 'three';
import { Grid, TILE_BLOCKED, TILE_DOOR, TILE_INTERACT } from '../engine/grid';
import type { Door, MapDef, ZoneKind } from './maps/types';

const ZONE_COLORS: Record<ZoneKind, number> = {
  path: 0xc4683f,
  plaza: 0xd9d4cc,
  concrete: 0x8f959e,
  court: 0x3b6ea5,
  track: 0xb5483a,
  water: 0x4fb3d9,
};
// Small height offsets so overlapping flat zones never z-fight.
const ZONE_Y: Record<ZoneKind, number> = { water: 0.01, concrete: 0.012, plaza: 0.014, court: 0.016, path: 0.02, track: 0.026 };

/** Build the collision grid from a map: blocking props and zones stamp their footprints. */
export function buildGrid(map: MapDef): Grid {
  const grid = new Grid(map.width, map.height);
  for (const z of map.zones) if (z.blocks) grid.stampRect(z.x, z.z, z.w, z.d, TILE_BLOCKED);
  for (const p of map.props) if (p.blocks) grid.stampRect(p.x, p.z, p.w, p.d, TILE_BLOCKED);
  for (const n of map.npcs) grid.setFlag(Math.floor(n.x), Math.floor(n.z), TILE_BLOCKED);
  for (const d of map.doors) grid.setFlag(d.x, d.z, TILE_DOOR);
  for (const i of map.interactables) {
    const r = Math.ceil(i.radius);
    for (let tz = Math.floor(i.z) - r; tz <= Math.floor(i.z) + r; tz++) {
      for (let tx = Math.floor(i.x) - r; tx <= Math.floor(i.x) + r; tx++) {
        if (Math.hypot(tx + 0.5 - i.x, tz + 0.5 - i.z) <= i.radius) grid.setFlag(tx, tz, TILE_INTERACT);
      }
    }
  }
  return grid;
}

export interface GrayboxScene {
  root: THREE.Group;
  /** Meshes that fade when they come between the camera and the player. */
  occluders: THREE.Mesh[];
}

/** Build a gray-box scene: flat colored zones and one box per prop. Real art replaces this in M2. */
export function buildGraybox(map: MapDef): GrayboxScene {
  const root = new THREE.Group();
  const occluders: THREE.Mesh[] = [];

  // Ground, with a darker skirt so the map edge doesn't float in the sky.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(map.width, map.height),
    new THREE.MeshLambertMaterial({ color: map.groundColor }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(map.width / 2, 0, map.height / 2);
  const skirt = new THREE.Mesh(
    new THREE.PlaneGeometry(map.width + 240, map.height + 240),
    new THREE.MeshLambertMaterial({ color: 0x5fae6a }),
  );
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.set(map.width / 2, -0.02, map.height / 2);
  root.add(ground, skirt);

  for (const z of map.zones) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(z.w, z.d),
      new THREE.MeshLambertMaterial({ color: ZONE_COLORS[z.kind] }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(z.x + z.w / 2, ZONE_Y[z.kind], z.z + z.d / 2);
    root.add(m);
  }

  // Props: fading ones get their own material; the rest are batched per color.
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const byColor = new Map<number, typeof map.props>();
  for (const p of map.props) {
    if (p.fades) {
      const mesh = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: p.color }));
      mesh.scale.set(p.w, p.h, p.d);
      mesh.position.set(p.x + p.w / 2, p.h / 2, p.z + p.d / 2);
      root.add(mesh);
      occluders.push(mesh);
    } else {
      const list = byColor.get(p.color) ?? [];
      list.push(p);
      byColor.set(p.color, list);
    }
    if (p.label) root.add(makeLabel(p.label, p.x + p.w / 2, p.h + 1.6, p.z + p.d / 2));
  }
  const m4 = new THREE.Matrix4();
  for (const [color, list] of byColor) {
    const inst = new THREE.InstancedMesh(unitBox, new THREE.MeshLambertMaterial({ color }), list.length);
    list.forEach((p, i) => {
      m4.makeScale(p.w, p.h, p.d).setPosition(p.x + p.w / 2, p.h / 2, p.z + p.d / 2);
      inst.setMatrixAt(i, m4);
    });
    inst.instanceMatrix.needsUpdate = true;
    root.add(inst);
  }

  for (const d of map.doors) root.add(makeDoor(d));

  // NPC placeholders.
  for (const n of map.npcs) {
    const npc = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.1, 4, 12),
      new THREE.MeshLambertMaterial({ color: n.color }),
    );
    npc.position.set(Math.floor(n.x) + 0.5, 0.9, Math.floor(n.z) + 0.5);
    root.add(npc, makeLabel('CALVIN', npc.position.x, 2.6, npc.position.z, 0.6));
  }

  return { root, occluders };
}

function makeDoor(d: Door): THREE.Group {
  const g = new THREE.Group();
  const out = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[d.facing];
  // The slab sits on the wall, on the edge of the door tile opposite to where the door faces.
  const cx = d.x + 0.5 - out[0] * 0.48;
  const cz = d.z + 0.5 - out[1] * 0.48;
  const alongX = out[0] === 0;
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(alongX ? 1.5 : 0.12, 2.3, alongX ? 0.12 : 1.5),
    new THREE.MeshLambertMaterial({ color: d.color }),
  );
  slab.position.set(cx, 1.15, cz);
  // Floating badge above the door: grey until earned.
  const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshLambertMaterial({ color: 0x9ca3af }));
  badge.position.set(cx + out[0] * 0.5, 3.3, cz + out[1] * 0.5);
  g.add(slab, badge);
  return g;
}

function makeLabel(text: string, x: number, y: number, z: number, scale = 1): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const font = '700 44px Inter, system-ui, sans-serif';
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 40;
  canvas.width = w;
  canvas.height = 72;
  ctx.font = font;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, 72, 16);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 20, 38);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set((w / 72) * 1.1 * scale, 1.1 * scale, 1);
  sprite.position.set(x, y, z);
  sprite.renderOrder = 10;
  return sprite;
}

/** Fade occluders toward 30% when they block the view of the player, back to solid when they don't. */
export class OccluderFader {
  private readonly ray = new THREE.Raycaster();
  private readonly head = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();

  constructor(private readonly occluders: THREE.Mesh[]) {}

  update(dt: number, camera: THREE.Camera, x: number, z: number): void {
    this.head.set(x, 1.2, z);
    this.dir.subVectors(this.head, camera.position);
    const dist = this.dir.length();
    this.ray.set(camera.position, this.dir.normalize());
    this.ray.far = dist - 0.3;
    const hits = new Set(this.ray.intersectObjects(this.occluders, false).map((h) => h.object));
    for (const mesh of this.occluders) {
      const mat = mesh.material as THREE.MeshLambertMaterial;
      const target = hits.has(mesh) ? 0.3 : 1;
      if (mat.opacity === target) continue;
      const next = mat.opacity + Math.sign(target - mat.opacity) * Math.min(Math.abs(target - mat.opacity), dt * 5);
      mat.opacity = next;
      const transparent = next < 0.999;
      if (mat.transparent !== transparent) {
        mat.transparent = transparent;
        mat.depthWrite = !transparent;
        mat.needsUpdate = true;
      }
    }
  }
}
