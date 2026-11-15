import * as THREE from 'three';
import { stationById, type Station } from '../content/stations';
import type { Door, Interactable, MapDef } from './maps/types';
import type { Npc } from './npc';

export interface Target {
  id: string;
  kind: 'station' | 'sign' | 'kiosk' | 'npc' | 'door';
  label: string;
  x: number;
  z: number;
  radius: number;
  /** Height the prompt floats at. */
  height: number;
  source?: Interactable;
  station?: Station;
  door?: Door;
  npc?: Npc;
}

const RING_TODO = 0x38bdf8;
const RING_DONE = 0x22c55e;

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
  private readonly rings = new Map<string, { ring: THREE.Mesh; check: THREE.Sprite }>();
  private readonly guide: THREE.Mesh;
  private guideTarget: Target | null = null;

  constructor(map: MapDef, npcs: Npc[], doorLabel: (d: Door) => string) {
    for (const i of map.interactables) {
      const station = i.station ? stationById(i.station) : undefined;
      if (i.kind === 'station' && !station) throw new Error(`map ${map.id}: unknown station "${i.station}"`);
      const target: Target = { id: i.id, kind: i.kind, label: station?.label ?? i.label, x: i.x, z: i.z, radius: i.radius, height: 2.2, source: i, station };
      this.targets.push(target);
      if (i.kind === 'station') this.addRing(target);
    }
    for (const d of map.doors) {
      this.targets.push({ id: d.id, kind: 'door', label: doorLabel(d), x: d.x + 0.5, z: d.z + 0.5, radius: 1.15, height: 2.7, door: d });
    }
    for (const n of npcs) {
      this.targets.push({ id: n.spawn.id, kind: 'npc', label: `Talk to ${n.spawn.label}`, x: n.x, z: n.z, radius: 1.9, height: 2.3, npc: n });
    }

    // Bouncing arrow that points the visitor at a station ("Next station", "Find it in the gym").
    this.guide = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0xfbbf24, depthTest: false, transparent: true }));
    this.guide.renderOrder = 13;
    this.guide.visible = false;
    this.root.add(this.guide);
  }

  private addRing(t: Target): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.92, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: RING_TODO, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    ring.position.set(t.x, 0.05, t.z);
    // Visited is never shown by color alone: a check mark sits beside the ring too.
    const check = checkSprite();
    check.position.set(t.x, 0.5, t.z);
    check.visible = false;
    this.root.add(ring, check);
    this.rings.set(t.id, { ring, check });
  }

  /** Recolor rings from the visited set. */
  refresh(visited: ReadonlySet<string>): void {
    for (const t of this.targets) {
      const r = this.rings.get(t.id);
      if (!r || !t.station) continue;
      const done = visited.has(t.station.id);
      (r.ring.material as THREE.MeshBasicMaterial).color.setHex(done ? RING_DONE : RING_TODO);
      r.check.visible = done;
    }
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

  setGuide(target: Target | null): void {
    this.guideTarget = target;
    this.guide.visible = target !== null;
  }

  get guideId(): string | null {
    return this.guideTarget?.id ?? null;
  }

  update(time: number, playerX: number, playerZ: number): void {
    for (const { ring } of this.rings.values()) ring.scale.setScalar(1 + Math.sin(time * 3) * 0.04);
    const g = this.guideTarget;
    if (!g) return;
    this.guide.position.set(g.x, 2.6 + Math.sin(time * 5) * 0.18, g.z);
    this.guide.rotation.y = time * 2;
    // The arrow has done its job once the visitor gets there.
    if (Math.hypot(g.x - playerX, g.z - playerZ) < g.radius) this.setGuide(null);
  }
}
