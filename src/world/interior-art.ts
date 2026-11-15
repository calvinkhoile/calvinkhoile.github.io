import * as THREE from 'three';
import type { QualitySettings } from '../engine/quality';
import { Builder, canvasTexture, flat, logoSign, textSign, type ArtScene } from './art';
import type { MapDef, Prop } from './maps/types';

// Interior art. Rooms are open toward the camera: full-height walls at the back (north, west), low curbs in front.

const GOLD = 0xc5a15a;
const BLACK = 0x15130f;

function carpetTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(128, 128, (ctx) => {
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
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function buildInterior(map: MapDef, q: QualitySettings): ArtScene {
  const root = new THREE.Group();
  const shadows = q.shadowMapSize > 0;
  const b = new Builder(shadows);
  root.add(b.group);
  const animated: ((time: number) => void)[] = [];

  // Floor: patterned casino carpet with a black border.
  const carpet = carpetTexture();
  carpet.repeat.set(map.width / 2, map.height / 2);
  flat(b, 0, 0, map.width, map.height, 0.0, new THREE.MeshLambertMaterial({ map: carpet }));
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x05060a }));
  backdrop.position.set(map.width / 2, -0.05, map.height / 2);
  root.add(backdrop);

  const gold = b.mat(GOLD, { emissive: 0x3a2c0c });
  const black = b.mat(BLACK);
  const neon = b.mat(0xffd76a, { emissive: 0xb8860b });

  for (const p of map.props) {
    const cx = p.x + p.w / 2;
    const cz = p.z + p.d / 2;
    switch (p.model) {
      case 'wall': {
        b.box(p.x, 0, p.z, p.w, p.h, p.d, black);
        const north = p.w > p.d;
        // Gold cap and baseboard on the room side, neon pinstripes up the wall.
        if (north) {
          b.box(p.x, p.h, p.z, p.w, 0.2, p.d + 0.08, gold);
          b.box(p.x + 1, 0, p.z + p.d, p.w - 1, 0.3, 0.06, gold);
          for (let x = p.x + 2.5; x < p.x + p.w; x += 3) b.box(x, 0.5, p.z + p.d, 0.08, p.h - 0.9, 0.04, neon);
        } else {
          b.box(p.x, p.h, p.z, p.w + 0.08, 0.2, p.d, gold);
          b.box(p.x + p.w, 0, p.z, 0.06, 0.3, p.d, gold);
          for (let z = p.z + 3.4; z < p.z + p.d; z += 3) b.box(p.x + p.w, 0.5, z, 0.04, p.h - 0.9, 0.08, neon);
        }
        break;
      }
      case 'curb':
        b.box(p.x, 0, p.z, p.w, p.h, p.d, gold);
        break;
      case 'summit-stage': {
        b.box(p.x, 0, p.z, p.w, p.h, p.d, b.mat(0x2a2620));
        b.box(p.x, p.h - 0.06, p.z + p.d - 0.08, p.w, 0.07, 0.1, gold);
        // The stage screen shows the real Product Summit photo.
        const tex = new THREE.TextureLoader().load('/images/betmgm/product-summit.webp');
        tex.colorSpace = THREE.SRGBColorSpace;
        b.box(cx - 1.9, 0.95, p.z - 0.02, 3.8, 2.5, 0.1, gold);
        b.panel(cx, 2.2, p.z + 0.08, 3.6, 2.3, 's', new THREE.MeshBasicMaterial({ map: tex }), 0.02);
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
        b.box(p.x, 0, p.z, p.w, p.h, p.d, black);
        b.box(p.x - 0.02, p.h, p.z - 0.05, p.w + 0.1, 0.08, p.d + 0.1, gold);
        // Prize shelf on the wall behind the counter.
        const colors = [0xb3121f, 0x1d4ed8, 0xf59e0b, 0x7c3aed, 0x15803d];
        for (let s = 0; s < 2; s++) {
          b.box(p.x, 1.75 + s * 0.75, p.z + 0.1, 0.35, 0.06, p.d - 0.2, gold);
          for (let i = 0; i < 4; i++) b.box(p.x + 0.04, 1.81 + s * 0.75, p.z + 0.3 + i * 0.66, 0.26, 0.34, 0.4, b.mat(colors[(i + s * 2) % colors.length]));
        }
        b.panel(p.x, 3.5, cz, 3.2, 0.55, 'e', textSign('REWARDS STORE', BLACK, 0xffd76a, 3.2 / 0.55), 0.03);
        break;
      }
      case 'partner-desk': {
        b.box(p.x + 0.1, 0, p.z, p.w - 0.2, p.h, p.d, b.mat(0x7a4a2e));
        b.box(p.x + 0.05, p.h, p.z - 0.05, p.w - 0.1, 0.07, p.d + 0.1, b.mat(0x5a3620));
        b.box(p.x + 0.3, p.h + 0.07, cz - 0.25, 0.04, 0.32, 0.5, b.mat(0x9ca3af)); // laptop lid
        b.box(p.x + 0.3, p.h + 0.07, cz - 0.25, 0.36, 0.03, 0.5, b.mat(0x6b7280));
        break;
      }
      case 'bellhop-cart': {
        // Brass luggage cart with suitcases: the Marriott partnership.
        b.box(cx - 0.4, 0.18, cz - 0.3, 0.8, 0.08, 0.6, gold);
        for (const [dx, dz] of [[-0.36, -0.26], [0.32, -0.26], [-0.36, 0.22], [0.32, 0.22]]) b.box(cx + dx, 0.26, cz + dz, 0.05, 1.2, 0.05, gold);
        for (const dz of [-0.26, 0.22]) b.mesh(new THREE.TorusGeometry(0.34, 0.03, 6, 12, Math.PI), gold, cx, 1.46, cz + dz + 0.02);
        b.box(cx - 0.3, 0.26, cz - 0.2, 0.6, 0.3, 0.4, b.mat(0x7a2e2e));
        b.box(cx - 0.25, 0.56, cz - 0.17, 0.5, 0.24, 0.34, b.mat(0x2e4a7a));
        for (const [dx, dz] of [[-0.3, -0.22], [0.3, -0.22], [-0.3, 0.22], [0.3, 0.22]]) b.mesh(new THREE.SphereGeometry(0.08, 8, 6), black, cx + dx, 0.09, cz + dz);
        break;
      }
      case 'ai-pod': {
        b.box(p.x, 0, p.z + 0.2, p.w, p.h, p.d - 0.3, b.mat(0x111827));
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
        b.box(p.x + 0.72, 0.8, p.z + 0.2, 0.2, 0.08, 0.6, gold);
        b.mesh(new THREE.SphereGeometry(0.12, 8, 6), neon, p.x + 0.45, p.h + 0.1, cz);
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
      default:
        b.box(p.x, 0, p.z, p.w, p.h, p.d, b.mat(p.color));
    }
  }

  // Big logo on the back wall, above the gym leader.
  const north = map.props.find((p: Prop) => p.model === 'wall' && p.w > p.d);
  if (north) {
    b.box(6.4, 2.3, north.d - 0.02, 4.2, 1.7, 0.08, gold);
    b.panel(8.5, 3.15, north.d + 0.06, 4.0, 1.5, 's', logoSign('/images/logos/betmgm.webp', 0x000000, 4.0 / 1.5), 0.02);
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
