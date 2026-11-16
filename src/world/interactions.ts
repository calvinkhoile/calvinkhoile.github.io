import * as THREE from 'three';
import { stationById, type Station } from '../content/stations';
import type { Door, Interactable, MapDef } from './maps/types';
import type { Npc } from './npc';

export interface Target {
  id: string;
  kind: 'station' | 'sign' | 'kiosk' | 'lift' | 'shoot' | 'npc' | 'door';
  label: string;
  x: number;
  z: number;
  radius: number;
  /** Height the prompt floats at. */
  height: number;
  /** The physical thing (prop, door, body) a click or tap should hit, in world space. */
  anchor: { x: number; y: number; z: number };
  source?: Interactable;
  station?: Station;
  door?: Door;
  npc?: Npc;
}

/** Center of the solid prop nearest to a station's stand point: that's the object the station is "about". */
function propAnchor(map: MapDef, x: number, z: number): { x: number; y: number; z: number } {
  let best = { x, y: 0.8, z };
  let bestD = 3.2;
  for (const p of map.props) {
    if (!p.blocks || ['wall', 'curb', 'hedge', 'fence', 'tree', 'lamp'].includes(p.model)) continue;
    // Distance from the stand point to the prop's footprint, not its center, so long counters still match.
    const dx = Math.max(p.x - x, 0, x - (p.x + p.w));
    const dz = Math.max(p.z - z, 0, z - (p.z + p.d));
    const d = Math.hypot(dx, dz);
    if (d < bestD) {
      bestD = d;
      best = { x: p.x + p.w / 2, y: Math.min(p.h, 2.4) / 2, z: p.z + p.d / 2 };
    }
  }
  return best;
}

const RING_TODO = 0x38bdf8;
const RING_DONE = 0x22c55e;
/** Things to do rather than read (dumbbells, loose basketballs) get an orange ring. */
const RING_PLAY = 0xfb923c;
const WHITE = new THREE.Color(0xffffff);

function checkSprite(): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(18, 33);
  ctx.lineTo(28, 43);
  ctx.lineTo(46, 23);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.setScalar(0.55);
  sprite.renderOrder = 12;
  return sprite;
}

/** Everything in a scene the visitor can interact with, plus the station floor rings. */
export class Interactions {
  readonly root = new THREE.Group();
  readonly targets: Target[] = [];
  /** All floor rings are one instanced mesh (one draw call), colored per instance. */
  private ringMesh: THREE.InstancedMesh | null = null;
  private readonly rings = new Map<string, { index: number; x: number; z: number; check: THREE.Sprite; color: number }>();
  private readonly guide: THREE.Mesh;
  private guideTarget: Target | null = null;

  constructor(map: MapDef, npcs: Npc[], doorLabel: (d: Door) => string) {
    for (const i of map.interactables) {
      const station = i.station ? stationById(i.station) : undefined;
      if (i.kind === 'station' && !station) throw new Error(`map ${map.id}: unknown station "${i.station}"`);
      const target: Target = { id: i.id, kind: i.kind, label: station?.label ?? i.label, x: i.x, z: i.z, radius: i.radius, height: 2.2, anchor: propAnchor(map, i.x, i.z), source: i, station };
      this.targets.push(target);
      if (i.kind === 'station' || i.kind === 'lift' || i.kind === 'shoot') this.addRing(target);
    }
    for (const d of map.doors) {
      this.targets.push({ id: d.id, kind: 'door', label: doorLabel(d), x: d.x + 0.5, z: d.z + 0.5, radius: 1.15, height: 2.7, anchor: { x: d.x + 0.5, y: 1.2, z: d.z + 0.5 }, door: d });
    }
    for (const n of npcs) {
      this.targets.push({ id: n.spawn.id, kind: 'npc', label: `Talk to ${n.spawn.label}`, x: n.x, z: n.z, radius: 1.9, height: 2.3, anchor: { x: n.x, y: 1, z: n.z }, npc: n });
    }

    this.buildRings();

    // Bouncing arrow that points the visitor at a station ("Next station", "Find it in the gym").
    this.guide = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0xfbbf24, depthTest: false, transparent: true }));
    this.guide.renderOrder = 13;
    this.guide.visible = false;
    this.root.add(this.guide);
  }

  private addRing(t: Target): void {
    // Visited is never shown by color alone: a check mark sits on the ring too.
    const check = checkSprite();
    check.position.set(t.x, 0.5, t.z);
    check.visible = false;
    this.root.add(check);
    this.rings.set(t.id, { index: this.rings.size, x: t.x, z: t.z, check, color: t.kind === 'station' ? RING_TODO : RING_PLAY });
  }

  private buildRings(): void {
    if (this.rings.size === 0) return;
    const mesh = new THREE.InstancedMesh(
      new THREE.RingGeometry(0.72, 0.92, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }),
      this.rings.size,
    );
    const color = new THREE.Color();
    for (const r of this.rings.values()) mesh.setColorAt(r.index, color.setHex(r.color));
    mesh.frustumCulled = false;
    this.ringMesh = mesh;
    this.root.add(mesh);
    this.placeRings(1);
  }

  private placeRings(scale: number): void {
    if (!this.ringMesh) return;
    const m = new THREE.Matrix4();
    for (const r of this.rings.values()) this.ringMesh.setMatrixAt(r.index, m.makeScale(scale, 1, scale).setPosition(r.x, 0.05, r.z));
    this.ringMesh.instanceMatrix.needsUpdate = true;
  }

  /** Recolor rings from the visited set. */
  refresh(visited: ReadonlySet<string>): void {
    this.lastVisited = visited;
    const color = new THREE.Color();
    for (const t of this.targets) {
      const r = this.rings.get(t.id);
      if (!r || !this.ringMesh) continue;
      const done = !!t.station && visited.has(t.station.id);
      color.setHex(done ? RING_DONE : r.color);
      // Hovered: pushed most of the way to white, so it reads as "this one".
      if (t.id === this.hovered) color.lerp(WHITE, 0.7);
      this.ringMesh.setColorAt(r.index, color);
      r.check.visible = done;
    }
    if (this.ringMesh?.instanceColor) this.ringMesh.instanceColor.needsUpdate = true;
  }

  byId(id: string): Target | undefined {
    return this.targets.find((t) => t.id === id);
  }

  /** The target in range that the visitor is most plausibly going for: nearest, biased toward where they face. */
  nearest(x: number, z: number, facing: number): Target | null {
    let best: Target | null = null;
    let bestScore = Infinity;
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);
    for (const t of this.targets) {
      // NPC targets follow the NPC as it walks.
      const tx = t.npc ? t.npc.x : t.x;
      const tz = t.npc ? t.npc.z : t.z;
      if (t.npc?.walking) continue;
      const dx = tx - x;
      const dz = tz - z;
      const dist = Math.hypot(dx, dz);
      if (dist > t.radius) continue;
      const ahead = dist > 0.01 ? (dx * fx + dz * fz) / dist : 1;
      const score = dist - ahead * 0.6;
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }

  /**
   * Target under a click or tap, in screen space. A hit on the floor ring or on the object itself both count,
   * so visitors can click the counter, the whiteboard, or Calvin directly.
   */
  pick(sx: number, sy: number, project: (x: number, y: number, z: number) => { x: number; y: number }, reach: number): Target | null {
    let best: Target | null = null;
    let bestD = reach;
    for (const t of this.targets) {
      if (t.npc?.walking) continue;
      const points = t.npc
        ? [project(t.npc.x, 1.0, t.npc.z), project(t.npc.x, 0.2, t.npc.z), project(t.npc.x, 1.7, t.npc.z)]
        : [project(t.x, 0, t.z), project(t.anchor.x, t.anchor.y, t.anchor.z), project(t.anchor.x, t.anchor.y * 2, t.anchor.z)];
      for (const p of points) {
        const d = Math.hypot(p.x - sx, p.y - sy);
        if (d < bestD) {
          bestD = d;
          best = t;
        }
      }
    }
    return best;
  }

  /** Target under a clicked ground point, if any (click/tap-to-interact). */
  at(x: number, z: number): Target | null {
    let best: Target | null = null;
    let bestD = Infinity;
    for (const t of this.targets) {
      const d = Math.hypot((t.npc ? t.npc.x : t.x) - x, (t.npc ? t.npc.z : t.z) - z);
      if (d < Math.min(t.radius, 1.1) && d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  private hovered: string | null = null;
  private lastVisited: ReadonlySet<string> = new Set();

  /** Desktop: brighten the ring of whatever the pointer is over. */
  setHover(target: Target | null): void {
    const id = target && this.rings.has(target.id) ? target.id : null;
    if (id === this.hovered) return;
    this.hovered = id;
    this.refresh(this.lastVisited);
  }

  setGuide(target: Target | null): void {
    this.guideTarget = target;
    this.guide.visible = target !== null;
  }

  get guideId(): string | null {
    return this.guideTarget?.id ?? null;
  }

  update(time: number, playerX: number, playerZ: number): void {
    this.placeRings(1 + Math.sin(time * 3) * 0.04);
    const g = this.guideTarget;
    if (!g) return;
    this.guide.position.set(g.x, 2.6 + Math.sin(time * 5) * 0.18, g.z);
    this.guide.rotation.y = time * 2;
    // The arrow has done its job once the visitor gets there.
    if (Math.hypot(g.x - playerX, g.z - playerZ) < g.radius) this.setGuide(null);
  }
}
