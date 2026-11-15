import * as THREE from 'three';
import './ui/styles/main.css';
import { FollowCamera } from './engine/camera';
import { DebugOverlay } from './engine/debug';
import { Input } from './engine/input';
import { loadAll, loadModel } from './engine/loader';
import { FrameWatchdog, pickTier, settingsFor, type QualityTier } from './engine/quality';
import { createRenderer, hasWebGL2, isCoarsePointer } from './engine/renderer';
import { Screens } from './ui/screens';
import { SelectStage } from './ui/select-stage';
import { buildArt, createSun } from './world/art';
import { Character } from './world/character';
import { buildGrid } from './world/collision';
import { Kit } from './world/kit';
import { CALVIN_PLAZA_LOOK, lookById, TRAINER_LOOKS } from './world/looks';
import { exterior } from './world/maps/exterior';
import { OccluderFader } from './world/occlusion';
import { Player, PLAYER_RADIUS, WALK_SPEED } from './world/player';
import { loadSave, writeSave } from './world/save';

declare global {
  interface Window {
    /** Read-only handle for smoke tests and console poking. */
    __mypark?: {
      /** True once the visitor is in the world and can move. */
      ready: boolean;
      state: 'loading' | 'title' | 'select' | 'play';
      quality: QualityTier;
      look: string;
      drawCalls: number;
      player: { x: number; z: number; speed: number; pathLength: number };
      /** Screen position of a world point on the ground, in CSS pixels. */
      project(x: number, z: number): { x: number; y: number };
      isBlocked(x: number, z: number): boolean;
      /** Drop the player at a world position (tests and, later, deep links). */
      teleport(x: number, z: number): void;
    };
  }
}

type GameState = 'loading' | 'title' | 'select' | 'play';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('world') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;

async function boot(): Promise<void> {
  if (!hasWebGL2()) {
    document.getElementById('fallback')!.hidden = false;
    document.getElementById('loading')!.hidden = true;
    canvas.hidden = true;
    return;
  }

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const screens = new Screens();
  const save = loadSave();
  let state: GameState = 'loading';

  // ----- renderer, quality, lights -----
  const picked = pickTier(params);
  let quality = settingsFor(picked.tier);
  const renderer = createRenderer(canvas, { antialias: quality.antialias, pixelRatioCap: quality.pixelRatioCap });
  const scene = new THREE.Scene();
  const SKY = 0xbfe3f5;
  scene.background = new THREE.Color(SKY);
  const fog = new THREE.Fog(SKY, 95, 210);
  scene.fog = quality.fog ? fog : null;
  const sun = createSun(renderer.three, quality.shadowMapSize);
  scene.add(...sun.objects);

  // ----- first playable download: scenery kit, the visitor's trainer, and Calvin -----
  const map = exterior;
  const look = lookById(save.look);
  const shadows = quality.shadowMapSize > 0;
  const [kitGltf, playerBody, calvin] = await loadAll(
    [loadModel('exterior.glb'), Character.create(look, { shadows }), Character.create(CALVIN_PLAZA_LOOK, { shadows })],
    (f) => screens.setProgress(f),
  );

  const grid = buildGrid(map);
  const art = buildArt(map, new Kit(kitGltf), quality);
  scene.add(art.root);

  const player = new Player(map.spawn.x, map.spawn.z);
  player.setCharacter(playerBody);
  player.facing = Math.PI * 0.75; // face the camera-side of the plaza on spawn
  scene.add(player.object);

  // Plaza Calvin stands on his tile, turned toward the spawn point. Dialogue arrives in M3.
  const npcs: Character[] = [];
  for (const n of map.npcs) {
    const x = Math.floor(n.x) + 0.5;
    const z = Math.floor(n.z) + 0.5;
    calvin.object.position.set(x, 0, z);
    calvin.object.rotation.y = Math.atan2(map.spawn.x - x, map.spawn.z - z);
    scene.add(calvin.object);
    npcs.push(calvin);
  }

  // ----- camera -----
  // Tuning knobs for comparing camera feel on a real device:
  // `?yaw=0` squares the camera to the map (45 is the isometric look), `?zoom=1.3` pulls it back 30%.
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
  let stage: SelectStage | null = null;
  renderer.onResize((aspect) => {
    follow.resize(aspect);
    stage?.resize(aspect);
  });
  follow.snapTo(player.x, player.z);

  const input = new Input(canvas, ui);
  const fader = new OccluderFader(art.occluders);
  const debug = params.get('debug') === '1' ? new DebugOverlay(grid, map, ui) : null;
  if (debug) scene.add(debug.root);

  // Click/tap-to-move destination marker.
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.42, 28).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  marker.position.y = 0.07;
  marker.visible = false;
  scene.add(marker);

  // ----- HUD bits -----
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
      marker.position.set(end.x, 0.07, end.z);
      marker.visible = true;
    }
  };

  // ----- quality: step down a tier when the device can't hold ~30fps -----
  const applyTier = (tier: QualityTier) => {
    quality = settingsFor(tier);
    sun.setShadows(quality.shadowMapSize);
    renderer.setPixelRatioCap(quality.pixelRatioCap);
    scene.fog = quality.fog ? fog : null;
  };
  const watchdog = new FrameWatchdog(() => {
    if (picked.forced || state !== 'play') return;
    if (quality.tier === 'high') applyTier('medium');
    else if (quality.tier === 'medium') applyTier('low');
  });

  const projected = new THREE.Vector3();
  let currentLook = look.id;
  window.__mypark = {
    get ready() {
      return state === 'play';
    },
    get state() {
      return state;
    },
    get quality() {
      return quality.tier;
    },
    get look() {
      return currentLook;
    },
    get drawCalls() {
      return renderer.three.info.render.calls;
    },
    get player() {
      return { x: player.x, z: player.z, speed: player.speed, pathLength: player.path.length };
    },
    project(x, z) {
      const rect = canvas.getBoundingClientRect();
      projected.set(x, 0, z).project(follow.camera);
      return { x: rect.left + ((projected.x + 1) / 2) * rect.width, y: rect.top + ((1 - projected.y) / 2) * rect.height };
    },
    isBlocked: (x, z) => grid.circleBlocked(x, z, PLAYER_RADIUS),
    teleport(x, z) {
      player.teleport(x, z);
      follow.snapTo(x, z);
    },
  };

  // ----- game loop -----
  const idleInput = { moveX: 0, moveY: 0, sprint: false, interact: false, tap: null };
  let last = performance.now();
  let time = 0;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const rawDt = (now - last) / 1000;
    last = now;
    if (document.hidden) return;
    // Clamp dt so a background tab or a hitch never launches the player across the map.
    const dt = Math.min(0.05, Math.max(0.001, rawDt));
    time += dt;

    if (state === 'select' && stage) {
      stage.update(dt);
      renderer.three.render(stage.scene, stage.camera);
      return;
    }

    const polled = input.poll();
    const active = state === 'play' ? polled : idleInput;
    if (active.tap) moveTo(active.tap.x, active.tap.y);
    if (active.interact) {
      aButton.classList.remove('is-pulse');
      void aButton.offsetWidth; // restart the pulse animation
      aButton.classList.add('is-pulse');
      navigator.vibrate?.(10);
    }

    player.update(dt, active, follow.basis(), grid);
    player.animate(dt);
    for (const npc of npcs) npc.update(dt);
    if (player.moving) dismissHint();
    if (marker.visible) {
      if (player.path.length === 0) marker.visible = false;
      else marker.scale.setScalar(1 + Math.sin(time * 8) * 0.12);
    }

    follow.update(dt, player.x, player.z, player.vx, player.vz, WALK_SPEED);
    sun.follow(player.x, player.z);
    fader.update(dt, follow.camera, player.x, player.z);
    art.update(time);
    renderer.three.render(scene, follow.camera);
    watchdog.tick(rawDt);
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
  screens.hideLoading();

  // ----- title, character select, play -----
  const enterWorld = () => {
    state = 'play';
    document.body.classList.add('is-playing');
    // Desktop: the hint fades after 30s. Touch: it keeps flashing until the visitor first moves.
    setTimeout(() => {
      if (!document.body.classList.contains('is-touch')) dismissHint();
    }, 30_000);
  };

  if (save.look) {
    // Returning visitor: straight into the park with their look.
    enterWorld();
    return;
  }

  state = 'title';
  stage = new SelectStage(reducedMotion); // starts streaming the other three looks behind the title
  stage.resize(canvas.clientWidth / canvas.clientHeight);
  await screens.showTitle();
  state = 'select';
  const chosen = await screens.showSelect(stage, TRAINER_LOOKS.indexOf(look));
  playerBody.setLook(chosen);
  if (chosen.model !== look.model) player.setCharacter(await Character.create(chosen, { shadows }));
  currentLook = chosen.id;
  writeSave({ ...save, look: chosen.id });
  enterWorld();
}

void boot();
