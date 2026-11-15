import * as THREE from 'three';
import './ui/styles/main.css';
import { FollowCamera } from './engine/camera';
import { DebugOverlay } from './engine/debug';
import { Input } from './engine/input';
import { createRenderer, hasWebGL2, isCoarsePointer } from './engine/renderer';
import { buildGraybox, buildGrid, OccluderFader } from './world/graybox';
import { exterior } from './world/maps/exterior';
import { Player, PLAYER_RADIUS, WALK_SPEED } from './world/player';

declare global {
  interface Window {
    /** Read-only handle for smoke tests and console poking. */
    __mypark?: {
      ready: boolean;
      player: { x: number; z: number; speed: number; pathLength: number };
      /** Screen position of a world point on the ground, in CSS pixels. */
      project(x: number, z: number): { x: number; y: number };
      isBlocked(x: number, z: number): boolean;
    };
  }
}

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('world') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;

function boot(): void {
  if (!hasWebGL2()) {
    document.getElementById('fallback')!.hidden = false;
    canvas.hidden = true;
    return;
  }

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = createRenderer(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe3f5);
  scene.fog = new THREE.Fog(0xbfe3f5, 90, 190);

  // Warm sun + sky fill. Shadows arrive with the art pass (M2).
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
  sun.position.set(-30, 60, 20);
  scene.add(sun, new THREE.HemisphereLight(0xcfe9ff, 0x6f8f5a, 1.5));

  const map = exterior;
  const grid = buildGrid(map);
  const world = buildGraybox(map);
  scene.add(world.root);

  const player = new Player(map.spawn.x, map.spawn.z);
  scene.add(player.object);

  // Tuning knobs for comparing camera feel on a real device:
  // `?yaw=0` squares the camera to the map (45 is the planned isometric look), `?zoom=1.3` pulls it back 30%.
  const num = (key: string, fallback: number) => {
    const v = Number(params.get(key));
    return params.has(key) && Number.isFinite(v) ? v : fallback;
  };
  const follow = new FollowCamera({
    yawDeg: num('yaw', 45),
    zoomOut: Math.min(3, Math.max(0.5, num('zoom', 1))),
    reducedMotion,
  });
  follow.setBounds(map.cameraBounds);
  renderer.onResize((aspect) => follow.resize(aspect));
  follow.snapTo(player.x, player.z);

  const input = new Input(canvas, ui);
  const fader = new OccluderFader(world.occluders);
  const debug = params.get('debug') === '1' ? new DebugOverlay(grid, map, ui) : null;
  if (debug) scene.add(debug.root);

  // Click/tap-to-move destination marker.
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.42, 28).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  marker.position.y = 0.06;
  marker.visible = false;
  scene.add(marker);

  // Mobile A button (interact). Nothing to interact with until M3, so it only gives feedback for now.
  const aButton = document.getElementById('a-button') as HTMLButtonElement;
  const showTouchUi = () => document.body.classList.add('is-touch');
  if (isCoarsePointer()) showTouchUi();
  window.addEventListener('touchstart', showTouchUi, { once: true, passive: true });
  aButton.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    input.queueInteract();
  });

  const hint = document.getElementById('hint') as HTMLElement;
  let hintDismissed = false;
  const dismissHint = () => {
    if (hintDismissed) return;
    hintDismissed = true;
    hint.classList.add('is-hidden');
  };
  // Desktop: the hint fades after 30s. Touch: it keeps flashing until the visitor first moves.
  setTimeout(() => {
    if (!document.body.classList.contains('is-touch')) dismissHint();
  }, 30_000);

  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const ndc = new THREE.Vector2();

  const moveTo = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, follow.camera);
    if (!raycaster.ray.intersectPlane(groundPlane, hit)) return;
    const path = grid.findPath({ x: player.x, z: player.z }, { x: hit.x, z: hit.z }, PLAYER_RADIUS);
    player.setPath(path);
    if (path && path.length > 0) {
      const end = path[path.length - 1];
      marker.position.set(end.x, 0.06, end.z);
      marker.visible = true;
    }
  };

  const projected = new THREE.Vector3();
  window.__mypark = {
    ready: true,
    get player() {
      return { x: player.x, z: player.z, speed: player.speed, pathLength: player.path.length };
    },
    project(x, z) {
      const rect = canvas.getBoundingClientRect();
      projected.set(x, 0, z).project(follow.camera);
      return { x: rect.left + ((projected.x + 1) / 2) * rect.width, y: rect.top + ((1 - projected.y) / 2) * rect.height };
    },
    isBlocked: (x, z) => grid.circleBlocked(x, z, PLAYER_RADIUS),
  };

  let last = performance.now();
  let time = 0;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    // Clamp dt so a background tab or a hitch never launches the player across the map.
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    if (document.hidden) return;
    time += dt;

    const state = input.poll();
    if (state.tap) moveTo(state.tap.x, state.tap.y);
    if (state.interact) {
      aButton.classList.remove('is-pulse');
      void aButton.offsetWidth; // restart the pulse animation
      aButton.classList.add('is-pulse');
      navigator.vibrate?.(10);
    }

    player.update(dt, state, follow.basis(), grid);
    if (player.moving) dismissHint();
    if (marker.visible) {
      if (player.path.length === 0) marker.visible = false;
      else marker.scale.setScalar(1 + Math.sin(time * 8) * 0.12);
    }

    follow.update(dt, player.x, player.z, player.vx, player.vz, WALK_SPEED);
    fader.update(dt, follow.camera, player.x, player.z);
    renderer.three.render(scene, follow.camera);
    debug?.update(dt, {
      x: player.x,
      z: player.z,
      speed: player.speed,
      path: player.path,
      calls: renderer.three.info.render.calls,
      tris: renderer.three.info.render.triangles,
    });
  };
  requestAnimationFrame(frame);
}

boot();
