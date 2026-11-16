import * as THREE from 'three';
import type { QualitySettings } from '../engine/quality';
import { Builder, canvasTexture, flat, logoSign, textSign, type ArtScene } from './art';
import type { InteriorTheme, MapDef, Prop } from './maps/types';

// Interior art. Rooms are open toward the camera: full-height walls at the back (north, west), low curbs in front.
// A room's look comes from its theme (floor, wall, trim, accent, logo). Furniture is built per model key.

const GOLD = 0xc5a15a;
const BLACK = 0x15130f;
const STEEL = 0x6b7280;
const WOOD = 0x9a6b3f;

function tiled(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const tex = canvasTexture(size, size, (ctx) => draw(ctx, size));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function floorTexture(kind: InteriorTheme['floor']): THREE.CanvasTexture {
  switch (kind) {
    case 'casino':
      return tiled(128, (ctx) => {
        ctx.fillStyle = '#5a1420';
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = 'rgba(197,161,90,0.55)';
        ctx.lineWidth = 3;
        for (const [cx, cy] of [[64, 64], [0, 0], [128, 0], [0, 128], [128, 128]]) {
          ctx.beginPath();
          ctx.moveTo(cx, cy - 34);
          ctx.lineTo(cx + 34, cy);
          ctx.lineTo(cx, cy + 34);
          ctx.lineTo(cx - 34, cy);
          ctx.closePath();
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(197,161,90,0.7)';
        for (const [cx, cy] of [[64, 0], [0, 64], [128, 64], [64, 128]]) {
          ctx.beginPath();
          ctx.arc(cx, cy, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    case 'hardwood':
      return tiled(128, (ctx) => {
        // Gym floor: maple planks with staggered joints.
        ctx.fillStyle = '#d9a86a';
        ctx.fillRect(0, 0, 128, 128);
        const shades = ['#d3a062', '#deb077', '#cf9a5c', '#dbab70'];
        for (let row = 0; row < 8; row++) {
          ctx.fillStyle = shades[row % 4];
          ctx.fillRect(0, row * 16, 128, 15);
          ctx.fillStyle = 'rgba(90,55,20,0.35)';
          ctx.fillRect(((row * 53) % 128) | 0, row * 16, 2, 15);
        }
      });
    case 'office':
      return tiled(128, (ctx) => {
        // Carpet tiles in two greys.
        for (let y = 0; y < 2; y++) {
          for (let x = 0; x < 2; x++) {
            ctx.fillStyle = (x + y) % 2 ? '#4b5563' : '#565f6b';
            ctx.fillRect(x * 64, y * 64, 64, 64);
          }
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.strokeRect(0, 0, 64, 64);
        ctx.strokeRect(64, 64, 64, 64);
      });
    case 'studio':
      return tiled(128, (ctx) => {
        // Polished concrete with faint expansion joints.
        ctx.fillStyle = '#cfd4da';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(8, 20, 60, 30);
        ctx.fillRect(70, 80, 46, 28);
        ctx.strokeStyle = 'rgba(100,110,125,0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, 128, 128);
      });
  }
}

function photoMaterial(src: string): THREE.MeshBasicMaterial {
  const tex = new THREE.TextureLoader().load(src);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex });
}

function whiteboardTexture(seed: number): THREE.CanvasTexture {
  return canvasTexture(256, 160, (ctx) => {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 256, 160);
    const inks = ['#86bc25', '#1d4ed8', '#111827', '#dc2626'];
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    // Boxes-and-arrows, the universal language of consulting. Abstract on purpose: no real client detail.
    for (let i = 0; i < 3; i++) {
      const x = 22 + i * 78;
      const y = 28 + ((seed + i) % 2) * 18;
      ctx.strokeStyle = inks[(seed + i) % 4];
      ctx.strokeRect(x, y, 54, 34);
      if (i < 2) {
        ctx.beginPath();
        ctx.moveTo(x + 58, y + 17);
        ctx.lineTo(x + 74, y + 17 + (((seed + i + 1) % 2) - (seed + i) % 2) * 18);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(24, 96 + i * 14);
      ctx.lineTo(24 + 90 + ((seed * 37 + i * 53) % 110), 96 + i * 14);
      ctx.stroke();
    }
    ctx.fillStyle = inks[seed % 4];
    ctx.fillRect(196, 96, 14, 44);
    ctx.fillRect(216, 112, 14, 28);
  });
}

function storiesTexture(): THREE.CanvasTexture {
  return canvasTexture(160, 300, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 160, 300);
    g.addColorStop(0, '#0866ff');
    g.addColorStop(0.55, '#8b5cf6');
    g.addColorStop(1, '#f97316');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 160, 300);
    // Story progress bars, an avatar, and a reply field: enough to read as "Stories".
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 4; i++) ctx.fillRect(8 + i * 37, 10, 32, 4);
    ctx.beginPath();
    ctx.arc(24, 36, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(42, 30, 60, 5);
    ctx.fillRect(42, 40, 36, 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(10, 264, 104, 24, 12);
    ctx.stroke();
    ctx.font = '22px sans-serif';
    ctx.fillText('♥', 126, 284);
  });
}

export function buildInterior(map: MapDef, q: QualitySettings): ArtScene {
  const theme = map.theme!;
  const root = new THREE.Group();
  const shadows = q.shadowMapSize > 0;
  const b = new Builder(shadows);
  root.add(b.group);
  const animated: ((time: number) => void)[] = [];

  const floor = floorTexture(theme.floor);
  floor.repeat.set(map.width / 2, map.height / 2);
  flat(b, 0, 0, map.width, map.height, 0.0, new THREE.MeshLambertMaterial({ map: floor }));
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x05060a }));
  backdrop.position.set(map.width / 2, -0.05, map.height / 2);
  root.add(backdrop);

  const trim = b.mat(theme.trim, { emissive: new THREE.Color(theme.trim).multiplyScalar(0.25).getHex() });
  const wallMat = b.mat(theme.wall);
  const accent = b.mat(theme.accent, { emissive: new THREE.Color(theme.accent).multiplyScalar(0.45).getHex() });
  const steel = b.mat(STEEL);
  const wood = b.mat(WOOD);
  const dark = b.mat(0x111827);

  if (theme.floor === 'hardwood') {
    // Center circle and a baseline, in school colors.
    const ring = b.add(new THREE.Mesh(new THREE.RingGeometry(1.7, 1.85, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: theme.trim })));
    ring.position.set(8, 0.012, 7);
    flat(b, 1, 9.9, map.width - 2, 0.12, 0.012, new THREE.MeshBasicMaterial({ color: theme.accent }));
  }

  for (const p of map.props) {
    const cx = p.x + p.w / 2;
    const cz = p.z + p.d / 2;
    switch (p.model) {
      case 'wall': {
        b.box(p.x, 0, p.z, p.w, p.h, p.d, wallMat);
        const north = p.w > p.d;
        // Cap and baseboard on the room side, accent pinstripes up the wall.
        if (north) {
          b.box(p.x, p.h, p.z, p.w, 0.2, p.d + 0.08, trim);
          b.box(p.x + 1, 0, p.z + p.d, p.w - 1, 0.3, 0.06, trim);
          for (let x = p.x + 2.5; x < p.x + p.w; x += 3) b.box(x, 0.5, p.z + p.d, 0.08, p.h - 0.9, 0.04, accent);
        } else {
          b.box(p.x, p.h, p.z, p.w + 0.08, 0.2, p.d, trim);
          b.box(p.x + p.w, 0, p.z, 0.06, 0.3, p.d, trim);
          for (let z = p.z + 3.4; z < p.z + p.d; z += 3) b.box(p.x + p.w, 0.5, z, 0.04, p.h - 0.9, 0.08, accent);
        }
        break;
      }
      case 'curb':
        b.box(p.x, 0, p.z, p.w, p.h, p.d, trim);
        break;

      // ----- BetMGM -----
      case 'summit-stage': {
        b.box(p.x, 0, p.z, p.w, p.h, p.d, b.mat(0x2a2620));
        b.box(p.x, p.h - 0.06, p.z + p.d - 0.08, p.w, 0.07, 0.1, trim);
        // The stage screen shows the real Product Summit photo.
        b.box(cx - 1.9, 0.95, p.z - 0.02, 3.8, 2.5, 0.1, trim);
        b.panel(cx, 2.2, p.z + 0.08, 3.6, 2.3, 's', photoMaterial('/images/betmgm/product-summit.webp'), 0.02);
        b.box(cx - 0.3, p.h, cz - 0.1, 0.6, 1.05, 0.4, b.mat(0x3b2f1e)); // lectern
        break;
      }
      case 'server-rack': {
        const rack = b.mat(0x1f2937);
        const leds = [new THREE.MeshBasicMaterial({ color: 0x22c55e }), new THREE.MeshBasicMaterial({ color: 0x38bdf8 })];
        for (let i = 0; i < 3; i++) {
          const x = p.x + 0.05 + i;
          b.box(x, 0, p.z + 0.1, 0.9, p.h, 0.8, rack);
          for (let r = 0; r < 7; r++) b.panel(x + 0.45, 0.35 + r * 0.3, p.z + 0.9, 0.7, 0.07, 's', leds[(i + r) % 2], 0.02);
        }
        b.panel(cx, p.h + 0.45, p.z + 0.1, 2.6, 0.5, 's', textSign('LOYALTY APIs', 0x0b1220, 0x7dd3fc, 2.6 / 0.5), 0.02);
        const on = [new THREE.Color(0x22c55e), new THREE.Color(0x38bdf8)];
        const off = new THREE.Color(0x0f2a1a);
        animated.push((time) => {
          const k = Math.floor(time * 3) % 2;
          leds[0].color.copy(k ? on[0] : off);
          leds[1].color.copy(k ? off : on[1]);
        });
        break;
      }
      case 'rewards-counter': {
        b.box(p.x, 0, p.z, p.w, p.h, p.d, b.mat(BLACK));
        b.box(p.x - 0.02, p.h, p.z - 0.05, p.w + 0.1, 0.08, p.d + 0.1, trim);
        // Prize shelf on the wall behind the counter.
        const colors = [0xb3121f, 0x1d4ed8, 0xf59e0b, 0x7c3aed, 0x15803d];
        for (let s = 0; s < 2; s++) {
          b.box(p.x, 1.75 + s * 0.75, p.z + 0.1, 0.35, 0.06, p.d - 0.2, trim);
          for (let i = 0; i < 4; i++) b.box(p.x + 0.04, 1.81 + s * 0.75, p.z + 0.3 + i * 0.66, 0.26, 0.34, 0.4, b.mat(colors[(i + s * 2) % colors.length]));
        }
        b.panel(p.x, 3.5, cz, 3.2, 0.55, 'e', textSign('REWARDS STORE', BLACK, 0xffd76a, 3.2 / 0.55), 0.03);
        break;
      }
      case 'partner-desk': {
        b.box(p.x + 0.1, 0, p.z, p.w - 0.2, p.h, p.d, b.mat(0x7a4a2e));
        b.box(p.x + 0.05, p.h, p.z - 0.05, p.w - 0.1, 0.07, p.d + 0.1, b.mat(0x5a3620));
        b.box(p.x + 0.3, p.h + 0.07, cz - 0.25, 0.04, 0.32, 0.5, b.mat(0x9ca3af)); // laptop lid
        b.box(p.x + 0.3, p.h + 0.07, cz - 0.25, 0.36, 0.03, 0.5, steel);
        break;
      }
      case 'bellhop-cart': {
        // Brass luggage cart with suitcases: the Marriott partnership.
        const brass = b.mat(GOLD, { emissive: 0x3a2c0c });
        b.box(cx - 0.4, 0.18, cz - 0.3, 0.8, 0.08, 0.6, brass);
        for (const [dx, dz] of [[-0.36, -0.26], [0.32, -0.26], [-0.36, 0.22], [0.32, 0.22]]) b.box(cx + dx, 0.26, cz + dz, 0.05, 1.2, 0.05, brass);
        for (const dz of [-0.26, 0.22]) b.mesh(new THREE.TorusGeometry(0.34, 0.03, 6, 12, Math.PI), brass, cx, 1.46, cz + dz + 0.02);
        b.box(cx - 0.3, 0.26, cz - 0.2, 0.6, 0.3, 0.4, b.mat(0x7a2e2e));
        b.box(cx - 0.25, 0.56, cz - 0.17, 0.5, 0.24, 0.34, b.mat(0x2e4a7a));
        for (const [dx, dz] of [[-0.3, -0.22], [0.3, -0.22], [-0.3, 0.22], [0.3, 0.22]]) b.mesh(new THREE.SphereGeometry(0.08, 8, 6), b.mat(BLACK), cx + dx, 0.09, cz + dz);
        break;
      }
      case 'ai-pod': {
        b.box(p.x, 0, p.z + 0.2, p.w, p.h, p.d - 0.3, dark);
        const screens = [new THREE.MeshBasicMaterial({ color: 0x22d3ee }), new THREE.MeshBasicMaterial({ color: 0xa78bfa })];
        for (let i = 0; i < 3; i++) {
          const x = p.x + 0.38 + i * 0.62;
          b.box(x - 0.03, p.h, p.z + 0.5, 0.06, 0.2, 0.06, b.mat(0x374151));
          b.box(x - 0.27, p.h + 0.18, p.z + 0.48, 0.54, 0.4, 0.05, b.mat(0x0b0f17));
          b.panel(x, p.h + 0.38, p.z + 0.48, 0.48, 0.33, 'n', screens[i % 2], 0.01);
          b.panel(x, p.h + 0.38, p.z + 0.53, 0.48, 0.33, 's', screens[i % 2], 0.01);
        }
        const a = [new THREE.Color(0x22d3ee), new THREE.Color(0xa78bfa)];
        animated.push((time) => {
          screens[0].color.lerpColors(a[0], a[1], 0.5 + Math.sin(time * 1.7) * 0.5);
          screens[1].color.lerpColors(a[1], a[0], 0.5 + Math.sin(time * 1.3) * 0.5);
        });
        break;
      }
      case 'slot-machine': {
        b.box(p.x + 0.1, 0, p.z + 0.12, 0.7, p.h, 0.76, b.mat(p.color));
        b.panel(p.x + 0.8, 1.25, cz, 0.5, 0.45, 'e', new THREE.MeshBasicMaterial({ color: 0xfff3c4 }), 0.02);
        b.box(p.x + 0.72, 0.8, p.z + 0.2, 0.2, 0.08, 0.6, trim);
        b.mesh(new THREE.SphereGeometry(0.12, 8, 6), accent, p.x + 0.45, p.h + 0.1, cz);
        break;
      }
      case 'card-table': {
        const felt = b.mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.12, 20), b.mat(p.color), cx, p.h - 0.06, cz);
        felt.scale.z = 0.55;
        b.mesh(new THREE.CylinderGeometry(0.18, 0.3, p.h - 0.12, 8), b.mat(0x3b2f1e), cx, (p.h - 0.12) / 2, cz);
        const chip = new THREE.CylinderGeometry(0.07, 0.07, 0.04, 10);
        [0xb3121f, 0x111827, GOLD, 0x1d4ed8].forEach((c, i) => {
          for (let k = 0; k < 3 - (i % 2); k++) b.mesh(chip, b.mat(c), cx - 0.45 + i * 0.3, p.h + 0.02 + k * 0.04, cz + (i % 2 ? 0.12 : -0.1));
        });
        break;
      }

      // ----- UCLA -----
      case 'grad-stage': {
        b.box(p.x, 0, p.z, p.w, p.h, p.d, b.mat(0x6b4a2b));
        b.box(p.x, p.h - 0.06, p.z + p.d - 0.08, p.w, 0.07, 0.1, accent);
        // Blue curtain, gold banner, lectern, and a rolled diploma.
        b.panel(cx, 2.15, p.z, 3.8, 2.9, 's', b.mat(p.color), 0.05);
        for (let i = 0; i < 7; i++) b.panel(p.x + 0.35 + i * 0.55, 2.15, p.z, 0.06, 2.9, 's', b.mat(0x163d5f), 0.07);
        b.panel(cx, 3.1, p.z, 3.2, 0.6, 's', textSign('CLASS OF 2019', theme.accent, theme.trim, 3.2 / 0.6), 0.1);
        b.box(cx - 0.3, p.h, cz - 0.1, 0.6, 1.05, 0.4, b.mat(0x3b2f1e));
        const diploma = b.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.42, 8).rotateZ(Math.PI / 2), b.mat(0xf8fafc), cx, p.h + 1.1, cz + 0.1);
        diploma.castShadow = false;
        break;
      }
      case 'club-booth': {
        const alongZ = p.d > p.w;
        const len = alongZ ? p.d : p.w;
        const canopy = b.mat(p.color);
        // Folding table, four poles, a canopy, and a strip of bunting.
        if (alongZ) {
          b.box(p.x + 0.15, 0.7, p.z + 0.15, 0.7, 0.08, len - 0.3, b.mat(0xf8fafc));
          for (const z of [p.z + 0.1, p.z + len - 0.18]) for (const x of [p.x + 0.08, p.x + 0.84]) b.box(x, 0, z, 0.08, p.h, 0.08, steel);
          b.box(p.x - 0.05, p.h, p.z, 1.1, 0.12, len, canopy);
          b.box(p.x - 0.05, p.h - 0.3, p.z, 0.04, 0.3, len, canopy);
        } else {
          b.box(p.x + 0.15, 0.7, p.z + 0.15, len - 0.3, 0.08, 0.7, b.mat(0xf8fafc));
          for (const x of [p.x + 0.1, p.x + len - 0.18]) for (const z of [p.z + 0.08, p.z + 0.84]) b.box(x, 0, z, 0.08, p.h, 0.08, steel);
          b.box(p.x, p.h, p.z - 0.05, len, 0.12, 1.1, canopy);
          b.box(p.x, p.h - 0.3, p.z + 1.01, len, 0.3, 0.04, canopy);
        }
        // Flyers on the table.
        for (let i = 0; i < 3; i++) {
          const t = 0.4 + i * ((len - 0.8) / 2);
          b.box(alongZ ? p.x + 0.3 : p.x + t - 0.12, 0.78, alongZ ? p.z + t - 0.12 : p.z + 0.3, 0.24, 0.02, 0.24, b.mat([0xfde047, 0x93c5fd, 0xfca5a5][i]));
        }
        break;
      }
      case 'job-board': {
        // Corkboard on the west wall with the five internships pinned up as cards.
        b.box(p.x, 0.9, p.z + 0.1, 0.12, p.h - 0.7, p.d - 0.2, wood);
        b.panel(p.x + 0.12, 2.05, cz, p.d - 0.4, p.h - 1.0, 'e', b.mat(p.color), 0.01);
        const papers = [0xf8fafc, 0xfde047, 0xbfdbfe, 0xf8fafc, 0xfecaca];
        papers.forEach((c, i) => {
          const z = p.z + 0.55 + (i % 3) * 0.95 + (i > 2 ? 0.45 : 0);
          const y = i > 2 ? 1.65 : 2.45;
          b.panel(p.x + 0.12, y, z, 0.62, 0.5, 'e', b.mat(c), 0.03);
          b.mesh(new THREE.SphereGeometry(0.04, 6, 4), b.mat(0xdc2626), p.x + 0.2, y + 0.2, z);
        });
        b.panel(p.x + 0.12, 3.25, cz, 2.4, 0.42, 'e', textSign('INTERNSHIPS', theme.trim, 0xffffff, 2.4 / 0.42), 0.03);
        break;
      }
      case 'bench': {
        b.box(p.x + 0.1, p.h - 0.08, p.z + 0.25, p.w - 0.2, 0.08, 0.5, wood);
        for (const x of [p.x + 0.2, p.x + p.w - 0.3]) b.box(x, 0, p.z + 0.3, 0.1, p.h - 0.08, 0.4, steel);
        // A backpack someone left behind.
        b.box(p.x + 0.4, p.h, p.z + 0.32, 0.4, 0.5, 0.3, b.mat(theme.trim));
        b.box(p.x + 0.45, p.h + 0.1, p.z + 0.6, 0.3, 0.22, 0.06, b.mat(theme.accent));
        break;
      }
      case 'ball-rack': {
        b.box(p.x + 0.25, 0, p.z + 0.1, 0.5, 0.1, p.d - 0.2, steel);
        for (const z of [p.z + 0.1, p.z + p.d - 0.18]) b.box(p.x + 0.45, 0, z, 0.08, p.h, 0.08, steel);
        const ball = new THREE.SphereGeometry(0.22, 12, 8);
        for (let row = 0; row < 2; row++) {
          for (let i = 0; i < 3; i++) b.mesh(ball, b.mat(p.color), p.x + 0.5, 0.36 + row * 0.5, p.z + 0.45 + i * ((p.d - 0.9) / 2));
        }
        break;
      }

      // ----- Deloitte -----
      case 'whiteboard': {
        const seed = Math.round(p.x * 3 + p.z);
        const board = new THREE.MeshBasicMaterial({ map: whiteboardTexture(seed) });
        if (p.rotation) {
          // Hung on the west wall, facing east.
          b.box(p.x, 0.9, p.z + 0.1, 0.1, p.h - 0.8, p.d - 0.2, steel);
          b.panel(p.x + 0.1, 0.9 + (p.h - 0.8) / 2, cz, p.d - 0.4, p.h - 1.0, 'e', board, 0.01);
        } else {
          b.box(p.x + 0.1, 0.9, p.z, p.w - 0.2, p.h - 0.8, 0.1, steel);
          b.panel(cx, 0.9 + (p.h - 0.8) / 2, p.z + 0.1, p.w - 0.4, p.h - 1.0, 's', board, 0.01);
          b.box(p.x + 0.3, 0.86, p.z + 0.1, p.w - 0.6, 0.05, 0.12, steel); // marker tray
        }
        break;
      }
      case 'sushi-bar': {
        b.box(p.x + 0.3, 0, p.z, p.w - 0.3, p.h, p.d, b.mat(p.color));
        b.box(p.x + 0.15, p.h, p.z - 0.05, p.w - 0.1, 0.07, p.d + 0.1, b.mat(0x2b1d12));
        // Plates along the counter and stools on the room side.
        const plate = new THREE.CylinderGeometry(0.16, 0.13, 0.04, 12);
        const roll = new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8);
        [0xf8fafc, 0xfca5a5, 0xbbf7d0, 0xf8fafc].forEach((c, i) => {
          const z = p.z + 0.45 + i * ((p.d - 0.9) / 3);
          b.mesh(plate, b.mat(c), p.x + 0.75, p.h + 0.09, z);
          b.mesh(roll, b.mat(0x111827), p.x + 0.7, p.h + 0.14, z - 0.04);
          b.mesh(roll, b.mat(0xfb923c), p.x + 0.8, p.h + 0.14, z + 0.04);
        });
        for (let i = 0; i < 3; i++) {
          const z = p.z + 0.55 + i * ((p.d - 1.1) / 2);
          b.mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.07, 10), b.mat(0xb91c1c), p.x - 0.05, 0.72, z);
          b.mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.7, 6), steel, p.x - 0.05, 0.35, z);
        }
        // Noren curtain strip above the bar.
        b.box(p.x + 0.3, 2.5, p.z, 0.06, 0.55, p.d, b.mat(0x1e3a5f));
        break;
      }
      case 'office-desk': {
        b.box(p.x + 0.05, p.h - 0.07, p.z + 0.15, p.w - 0.1, 0.07, 0.7, b.mat(p.color));
        for (const x of [p.x + 0.1, p.x + p.w - 0.18]) b.box(x, 0, p.z + 0.2, 0.08, p.h - 0.07, 0.6, steel);
        b.box(cx - 0.3, p.h + 0.14, p.z + 0.3, 0.6, 0.4, 0.05, b.mat(0x0b0f17));
        b.panel(cx, p.h + 0.34, p.z + 0.35, 0.54, 0.33, 's', new THREE.MeshBasicMaterial({ color: 0xbfdbfe }), 0.01);
        b.box(cx - 0.03, p.h, p.z + 0.32, 0.06, 0.16, 0.06, steel);
        break;
      }
      case 'plant': {
        b.mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.45, 10), b.mat(0xe5e7eb), cx, 0.225, cz);
        b.mesh(new THREE.ConeGeometry(0.42, 1.1, 7), b.mat(p.color), cx, 1.0, cz);
        break;
      }

      // ----- Meta -----
      case 'giant-phone': {
        b.box(p.x + 0.1, 0.25, p.z + 0.35, p.w - 0.2, p.h - 0.25, 0.22, b.mat(p.color));
        b.panel(cx, 0.25 + (p.h - 0.25) / 2, p.z + 0.57, p.w - 0.42, p.h - 0.6, 's', new THREE.MeshBasicMaterial({ map: storiesTexture() }), 0.01);
        b.box(p.x + 0.3, 0, p.z + 0.25, p.w - 0.6, 0.25, 0.45, steel);
        break;
      }
      case 'hq-window': {
        // A window onto HQ: the real photo, framed, with a sill.
        b.box(p.x, 0.75, p.z, p.w, 0.12, 0.35, b.mat(p.color));
        b.box(cx - 1.95, 0.87, p.z - 0.02, 3.9, 2.55, 0.08, b.mat(0xffffff));
        b.panel(cx, 2.15, p.z + 0.06, 3.7, 2.35, 's', photoMaterial('/images/meta/meta-hq.webp'), 0.01);
        b.box(cx - 0.03, 0.97, p.z + 0.06, 0.06, 2.35, 0.05, b.mat(0xffffff));
        break;
      }
      case 'feedback-kiosk': {
        b.box(cx - 0.2, 0, cz - 0.2, 0.4, 1.05, 0.4, b.mat(0xe5e7eb));
        const screen = b.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.8), b.mat(0x0b0f17)));
        screen.position.set(cx + 0.12, 1.32, cz);
        screen.rotation.z = -0.3;
        const face = b.add(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.52), textSign('?  !', p.color, 0xffffff, 0.7 / 0.52)));
        face.position.set(cx + 0.185, 1.33, cz);
        face.rotation.set(0, Math.PI / 2, 0);
        face.rotateX(-0.3);
        break;
      }
      case 'mailbox': {
        const blue = b.mat(p.color);
        b.box(cx - 0.32, 0.35, cz - 0.3, 0.64, 0.75, 0.6, blue);
        b.mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.64, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), blue, cx, 1.1, cz);
        b.box(cx - 0.05, 0, cz - 0.05, 0.1, 0.35, 0.1, steel);
        b.panel(cx - 0.32, 1.0, cz, 0.42, 0.07, 'w', b.mat(0x0b0f17), 0.01); // slot
        b.box(cx - 0.02, 0.9, cz + 0.3, 0.04, 0.5, 0.04, steel);
        b.box(cx - 0.02, 1.25, cz + 0.3, 0.3, 0.16, 0.03, b.mat(0xdc2626)); // flag up: there's mail
        break;
      }
      case 'beanbag': {
        const bag = b.mesh(new THREE.SphereGeometry(0.45, 12, 8), b.mat(p.color), cx, 0.28, cz);
        bag.scale.y = 0.62;
        break;
      }

      default:
        b.box(p.x, 0, p.z, p.w, p.h, p.d, b.mat(p.color));
    }
  }

  // Big logo on the back wall, above the gym leader.
  const north = map.props.find((p: Prop) => p.model === 'wall' && p.w > p.d);
  if (north) {
    b.box(6.4, 2.3, north.d - 0.02, 4.2, 1.7, 0.08, trim);
    b.panel(8.5, 3.15, north.d + 0.06, 4.0, 1.5, 's', logoSign(theme.logo, theme.logoBg, 4.0 / 1.5), 0.02);
  }

  // Exit: a bright mat on the door tile with an arrow out.
  for (const d of map.doors) {
    flat(b, d.x + 0.05, d.z - 0.3, 0.9, 1.25, 0.02, b.mat(0xf8fafc, { emissive: 0x555555 }));
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.4).rotateX(-Math.PI / 2), textSign('EXIT ↓', 0xf8fafc, 0x111827, 0.9 / 0.4));
    label.position.set(d.x + 0.5, 0.03, d.z + 0.1);
    b.add(label);
  }

  b.merge();
  return { root, occluders: [], update: (time) => animated.forEach((fn) => fn(time)) };
}
