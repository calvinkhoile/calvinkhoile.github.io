import * as THREE from 'three';
import './ui/styles/main.css';
import { dialogue as dialogueNodes, toasts, type DialogueNode } from './content/dialogue';
import { countedStations, stationById, type SceneId } from './content/stations';
import { FollowCamera } from './engine/camera';
import { DebugOverlay } from './engine/debug';
import { TILE_BLOCKED, type Grid } from './engine/grid';
import { Input, type InputState } from './engine/input';
import { loadAll, loadModel } from './engine/loader';
import { FrameWatchdog, pickTier, settingsFor, type QualityTier } from './engine/quality';
import { createRenderer, hasWebGL2, isCoarsePointer } from './engine/renderer';
import { CardOverlay } from './ui/card';
import { aboutCard, careerCard, stationCard } from './ui/card-models';
import { DialogueBox } from './ui/dialogue';
import { Lightbox } from './ui/lightbox';
import { Prompt } from './ui/prompts';
import { Screens } from './ui/screens';
import { SelectStage } from './ui/select-stage';
import { buildArt, createSun, type ArtScene } from './world/art';
import { Character } from './world/character';
import { buildGrid } from './world/collision';
import { Interactions, type Target } from './world/interactions';
import { buildInterior } from './world/interior-art';
import { Kit } from './world/kit';
import { CALVIN_PLAZA_LOOK, lookById, TRAINER_LOOKS } from './world/looks';
import type { Door, MapDef } from './world/maps/types';
import { Npc } from './world/npc';
import { OccluderFader } from './world/occlusion';
import { Player, PLAYER_RADIUS, WALK_SPEED } from './world/player';
import { loadSave, writeSave } from './world/save';
import { SCENE_NAMES, SCENES } from './world/scenes';

declare global {
  interface Window {
    /** Read-only handle for smoke tests and console poking. */
    __mypark?: {
      /** True once the visitor is in the world and can move. */
      ready: boolean;
      state: 'loading' | 'title' | 'select' | 'play';
      scene: string;
      /** True while a dialogue, card, scripted walk, or scene change has control. */
      busy: boolean;
      quality: QualityTier;
      look: string;
      drawCalls: number;
      visited: string[];
      guide: string | null;
      player: { x: number; z: number; speed: number; pathLength: number };
      targets: { id: string; kind: string; label: string; x: number; z: number }[];
      /** Screen position of a world point on the ground, in CSS pixels. */
      project(x: number, z: number): { x: number; y: number };
      isBlocked(x: number, z: number): boolean;
      /** Drop the player at a world position in the current scene (tests and, later, deep links). */
      teleport(x: number, z: number): void;
      /** Open any station's card by id, wherever the visitor is (tests and, later, deep links). False if it has no card. */
      openStationCard(id: string): boolean;
    };
  }
}

type GameState = 'loading' | 'title' | 'select' | 'play';

interface LoadedScene {
  id: SceneId;
  def: MapDef;
  grid: Grid;
  root: THREE.Group;
  art: ArtScene;
  npcs: Npc[];
  interactions: Interactions;
  fader: OccluderFader;
  debug: DebugOverlay | null;
}

const SKY = 0xbfe3f5;
const INTERIOR_BACKDROP = 0x05060a;
const INTERIOR_ZOOM = 0.62;
const DOOR_FACING: Record<Door['facing'], [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('world') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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
  const visited = new Set(save.visitedStations);
  const persist = () => writeSave({ ...save, visitedStations: [...visited] });
  let state: GameState = 'loading';

  // ----- renderer, quality, lights -----
  const picked = pickTier(params);
  let quality = settingsFor(picked.tier);
  const renderer = createRenderer(canvas, { antialias: quality.antialias, pixelRatioCap: quality.pixelRatioCap });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  const fog = new THREE.Fog(SKY, 95, 210);
  const sun = createSun(renderer.three, quality.shadowMapSize);
  scene.add(...sun.objects);
  const shadows = quality.shadowMapSize > 0;

  // ----- first playable download: scenery kit, the visitor's trainer, and Calvin -----
  const look = lookById(save.look);
  const [kitGltf, playerBody] = await loadAll(
    [loadModel('exterior.glb'), Character.create(look, { shadows }), Character.create(CALVIN_PLAZA_LOOK, { shadows })],
    (f) => screens.setProgress(f),
  );
  const kit = new Kit(kitGltf);

  // ----- UI layers -----
  const lightbox = new Lightbox(ui);
  const cards = new CardOverlay(ui, lightbox);
  const talk = new DialogueBox(ui, reducedMotion);
  const prompt = new Prompt(ui);
  const counter = document.getElementById('station-counter') as HTMLElement;
  const fade = document.getElementById('fade') as HTMLElement;
  const toastEl = document.getElementById('toast') as HTMLElement;
  const toast = (text: string) => {
    toastEl.textContent = text;
    toastEl.hidden = false;
    setTimeout(() => (toastEl.hidden = true), 4500);
  };

  // ----- camera -----
  // Tuning knobs for comparing camera feel on a real device:
  // `?yaw=0` squares the camera to the map (45 is the isometric look), `?zoom=1.3` pulls it back 30%.
  const num = (key: string, fallback: number) => {
    const v = Number(params.get(key));
    return params.has(key) && Number.isFinite(v) ? v : fallback;
  };
  const userZoom = Math.min(3, Math.max(0.5, num('zoom', 1)));
  const follow = new FollowCamera({ yawDeg: num('yaw', 45), zoomOut: userZoom, reducedMotion });
  let stage: SelectStage | null = null;
  renderer.onResize((aspect) => {
    follow.resize(aspect);
    stage?.resize(aspect);
  });

  // ----- scenes -----
  const player = new Player(0, 0);
  player.setCharacter(playerBody);
  scene.add(player.object);
  const loaded = new Map<SceneId, LoadedScene>();
  let current!: LoadedScene;

  const doorLabel = (d: Door) => (d.to === 'exterior' ? 'Exit to the park' : `Enter ${SCENE_NAMES[d.to as SceneId] ?? d.to}`);

  async function loadScene(id: SceneId): Promise<LoadedScene> {
    const cached = loaded.get(id);
    if (cached) return cached;
    const def = SCENES[id];
    if (!def) throw new Error(`scene "${id}" is not built yet`);
    const grid = buildGrid(def);
    const art = def.interior ? buildInterior(def, quality) : buildArt(def, kit, quality);
    const root = new THREE.Group();
    root.add(art.root);
    // TODO(M5): era outfits per gym leader. Every Calvin wears the plaza look for now.
    const npcs: Npc[] = [];
    for (const spawn of def.npcs) {
      const npc = new Npc(spawn, await Character.create(CALVIN_PLAZA_LOOK, { shadows }));
      root.add(npc.character.object);
      npcs.push(npc);
    }
    const interactions = new Interactions(def, npcs, doorLabel);
    interactions.refresh(visited);
    root.add(interactions.root);
    const debug = params.get('debug') === '1' ? new DebugOverlay(grid, def, ui) : null;
    if (debug) root.add(debug.root);
    const sceneData: LoadedScene = { id, def, grid, root, art, npcs, interactions, fader: new OccluderFader(art.occluders), debug };
    loaded.set(id, sceneData);
    return sceneData;
  }

  function updateCounter(): void {
    const counted = countedStations(current.id);
    if (!current.def.interior || counted.length === 0) {
      counter.hidden = true;
      return;
    }
    const done = counted.filter((s) => visited.has(s.id)).length;
    counter.textContent = `${SCENE_NAMES[current.id]} · ${done}/${counted.length} stations${done === counted.length ? ' ✓' : ''}`;
    counter.hidden = false;
  }

  function showScene(next: LoadedScene, x: number, z: number, facing: number): void {
    if (current) scene.remove(current.root);
    current = next;
    scene.add(next.root);
    const interior = !!next.def.interior;
    (scene.background as THREE.Color).setHex(interior ? INTERIOR_BACKDROP : SKY);
    scene.fog = !interior && quality.fog ? fog : null;
    follow.setZoomOut(userZoom * (interior ? INTERIOR_ZOOM : 1));
    follow.setBounds(next.def.cameraBounds);
    player.teleport(x, z);
    player.facing = facing;
    follow.snapTo(x, z);
    marker.visible = false;
    pending = null;
    doorArmed = false;
    next.interactions.refresh(visited);
    updateCounter();
  }

  // Click/tap-to-move destination marker.
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.42, 28).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  marker.position.y = 0.07;
  marker.visible = false;
  scene.add(marker);

  /** Target the visitor clicked or tapped; they interact with it on arrival. */
  let pending: Target | null = null;
  /** Doors only fire after the visitor has stepped off them once (stops enter/exit loops). */
  let doorArmed = false;
  /** Number of things currently holding control (dialogue, card, scripted walk, scene change). */
  let busyCount = 0;
  let ignoreInteractUntil = 0;
  const begin = () => {
    busyCount++;
    prompt.set(null);
  };
  const end = () => {
    busyCount = Math.max(0, busyCount - 1);
    // The key or tap that closed a dialogue must not immediately start a new interaction.
    ignoreInteractUntil = performance.now() + 250;
  };

  const exteriorScene = await loadScene('exterior');
  showScene(exteriorScene, exteriorScene.def.spawn.x, exteriorScene.def.spawn.z, Math.PI * 0.75);

  const input = new Input(canvas, ui);

  // ----- dialogue, cards, actions -----
  async function say(key: string, speakerOverride?: string): Promise<void> {
    let node: DialogueNode | undefined = dialogueNodes[key];
    if (!node) throw new Error(`dialogue: unknown node "${key}"`);
    if (speakerOverride) node = { ...node, lines: node.lines.map((l) => ({ ...l, speaker: speakerOverride })) };
    begin();
    document.body.classList.add('is-talking');
    const result = await talk.play(node);
    document.body.classList.remove('is-talking');
    end();
    if (result.skipped) return;
    if (result.choice?.next) return say(result.choice.next);
    const action = result.choice?.action ?? node.action;
    if (action) await runAction(action);
  }

  const chipFor = (sceneId: SceneId): string | undefined => {
    const counted = countedStations(sceneId);
    if (sceneId === 'exterior' || counted.length === 0) return undefined;
    return `${counted.filter((s) => visited.has(s.id)).length}/${counted.length} stations`;
  };

  const guideTo = (stationId: string) => {
    const target = current.interactions.byId(stationId);
    if (target) current.interactions.setGuide(target);
  };

  async function openCard(model: Parameters<CardOverlay['open']>[0]): Promise<void> {
    begin();
    await cards.open(model, {
      onLink: guideTo,
      onFooter: (action) => {
        if (action.startsWith('guide:')) guideTo(action.slice(6));
      },
    });
    end();
  }

  async function runAction(action: string): Promise<void> {
    if (action === 'about') return openCard(aboutCard());
    if (action.startsWith('card:')) return openCard(careerCard(action.slice(5), { chip: chipFor(current.id) }));
    if (action === 'tour') return say('plaza.tourStart');
    const calvin = exteriorScene.npcs[0];
    const grid = exteriorScene.grid;
    if (action === 'tour-walk') {
      // Calvin leads, the visitor is walked along behind him. Any manual input hands control back.
      begin();
      releaseHome(calvin);
      player.setPath(grid.findPath({ x: player.x, z: player.z }, { x: 19.6, z: 49.5 }, PLAYER_RADIUS));
      await calvin.walk(grid.findPath({ x: calvin.x, z: calvin.z }, { x: 17.5, z: 50.6 }, PLAYER_RADIUS));
      for (let i = 0; i < 40 && player.path.length > 0; i++) await wait(150);
      end();
      return say('plaza.tourEnd');
    }
    if (action === 'tour-return') {
      void sendHome(calvin);
    }
  }

  // NPC home tiles are solid while the NPC stands on them and free while it roams.
  const releaseHome = (npc: Npc) => exteriorScene.grid.setFlag(Math.floor(npc.home.x), Math.floor(npc.home.z), TILE_BLOCKED, false);
  async function sendHome(npc: Npc): Promise<void> {
    const grid = exteriorScene.grid;
    releaseHome(npc);
    await npc.walk(grid.findPath({ x: npc.x, z: npc.z }, npc.home, PLAYER_RADIUS));
    // Don't trap the visitor if they're standing on Calvin's spot.
    const onHome = Math.floor(player.x) === Math.floor(npc.home.x) && Math.floor(player.z) === Math.floor(npc.home.z) && current === exteriorScene;
    if (!npc.walking && !onHome) grid.setFlag(Math.floor(npc.home.x), Math.floor(npc.home.z), TILE_BLOCKED, true);
  }

  async function openStation(target: Target): Promise<void> {
    const station = target.station!;
    if (!visited.has(station.id)) {
      visited.add(station.id);
      persist();
      current.interactions.refresh(visited);
      updateCounter();
    }
    const content = station.content;
    if (content.source === 'photo') {
      begin();
      lightbox.onClose = () => {
        lightbox.onClose = null;
        end();
      };
      lightbox.open(content.src, content.alt, content.caption);
      return;
    }
    if (content.source === 'dialogue') return say(content.key);

    const model = stationCard(station, chipFor(station.scene));
    if (!model) return;
    // Footer: point at the nearest station still unvisited, or send them to the gym leader.
    const remaining = countedStations(station.scene)
      .filter((s) => !visited.has(s.id))
      .map((s) => current.interactions.byId(s.id))
      .filter((t): t is Target => !!t)
      .sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
    if (remaining.length > 0) model.footer = { label: 'Next station →', action: `guide:${remaining[0].id}` };
    else if (current.npcs.some((n) => n.spawn.role === 'leader')) model.footerNote = 'Talk to Calvin for your badge.';
    await openCard(model);
  }

  let introSeen = false;
  async function talkTo(npc: Npc): Promise<void> {
    if (npc.spawn.role === 'plaza') {
      const key = introSeen ? 'plaza.again' : 'plaza.intro';
      introSeen = true;
      return say(key);
    }
    const prefix = npc.spawn.dialogue;
    const allDone = countedStations(current.id).every((s) => visited.has(s.id));
    return say(allDone ? `${prefix}.leaderDone` : `${prefix}.leader`);
  }

  async function useDoor(door: Door): Promise<void> {
    const to = door.to as SceneId;
    if (!SCENES[to]) return say('door.locked', SCENE_NAMES[to] ?? 'Door');
    begin();
    const from = current.id;
    fade.classList.add('is-on');
    const [next] = await Promise.all([loadScene(to), wait(reducedMotion ? 0 : 200)]);
    if (next.def.interior) {
      showScene(next, next.def.spawn.x, next.def.spawn.z, Math.PI);
    } else {
      // Back outside: just in front of the door we went in by, facing away from it.
      const back = next.def.doors.find((d) => d.to === from);
      const out = back ? DOOR_FACING[back.facing] : [0, 1];
      const x = back ? back.x + 0.5 + out[0] * 1.4 : next.def.spawn.x;
      const z = back ? back.z + 0.5 + out[1] * 1.4 : next.def.spawn.z;
      showScene(next, x, z, Math.atan2(out[0], out[1]));
    }
    await wait(reducedMotion ? 0 : 120);
    fade.classList.remove('is-on');
    end();
  }

  function interact(target: Target): void {
    pending = null;
    player.setPath(null);
    marker.visible = false;
    navigator.vibrate?.(10);
    switch (target.kind) {
      case 'door':
        void useDoor(target.door!);
        break;
      case 'kiosk':
        window.open(target.source!.href!, '_blank', 'noopener');
        break;
      case 'sign':
        void say(target.source!.dialogue!);
        break;
      case 'npc':
        void talkTo(target.npc!);
        break;
      case 'station':
        void openStation(target);
        break;
    }
  }

  // ----- HUD bits -----
  const aButton = document.getElementById('a-button') as HTMLButtonElement;
  const showTouchUi = () => document.body.classList.add('is-touch');
  if (isCoarsePointer()) showTouchUi();
  window.addEventListener('touchstart', showTouchUi, { once: true, passive: true });
  aButton.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    aButton.classList.remove('is-pulse');
    void aButton.offsetWidth; // restart the pulse animation
    aButton.classList.add('is-pulse');
    if (talk.isOpen) talk.advance();
    else input.queueInteract();
  });

  const hint = document.getElementById('hint') as HTMLElement;
  const HINT_AFTER_IDLE = 5; // seconds standing still before the how-to-move hint comes back

  // ----- pointer: click/tap to move or interact, hover cursor -----
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const ndc = new THREE.Vector2();
  const groundAt = (clientX: number, clientY: number): THREE.Vector3 | null => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, follow.camera);
    return raycaster.ray.intersectPlane(groundPlane, hit);
  };

  const moveTo = (clientX: number, clientY: number) => {
    const point = groundAt(clientX, clientY);
    if (!point) return;
    const target = current.interactions.at(point.x, point.z);
    const goal = target ? { x: target.npc ? target.npc.x : target.x, z: target.npc ? target.npc.z : target.z } : { x: point.x, z: point.z };
    pending = target;
    const path = current.grid.findPath({ x: player.x, z: player.z }, goal, PLAYER_RADIUS);
    player.setPath(path);
    if (path && path.length > 0) {
      const last = path[path.length - 1];
      marker.position.set(last.x, 0.07, last.z);
      marker.visible = true;
    }
  };

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || state !== 'play' || busyCount > 0) return;
    const point = groundAt(e.clientX, e.clientY);
    canvas.style.cursor = point && current.interactions.at(point.x, point.z) ? 'pointer' : '';
  });

  // ----- quality: step down a tier when the device can't hold ~30fps -----
  const applyTier = (tier: QualityTier) => {
    quality = settingsFor(tier);
    sun.setShadows(quality.shadowMapSize);
    renderer.setPixelRatioCap(quality.pixelRatioCap);
    scene.fog = !current.def.interior && quality.fog ? fog : null;
  };
  const watchdog = new FrameWatchdog(() => {
    if (picked.forced || state !== 'play' || busyCount > 0) return;
    if (quality.tier === 'high') applyTier('medium');
    else if (quality.tier === 'medium') applyTier('low');
  });

  const projected = new THREE.Vector3();
  const toScreen = (x: number, y: number, z: number) => {
    const rect = canvas.getBoundingClientRect();
    projected.set(x, y, z).project(follow.camera);
    return { x: rect.left + ((projected.x + 1) / 2) * rect.width, y: rect.top + ((1 - projected.y) / 2) * rect.height };
  };

  let currentLook = look.id;
  window.__mypark = {
    get ready() {
      return state === 'play';
    },
    get state() {
      return state;
    },
    get scene() {
      return current.id;
    },
    get busy() {
      return busyCount > 0;
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
    get visited() {
      return [...visited];
    },
    get guide() {
      return current.interactions.guideId;
    },
    get player() {
      return { x: player.x, z: player.z, speed: player.speed, pathLength: player.path.length };
    },
    get targets() {
      return current.interactions.targets.map((t) => ({ id: t.id, kind: t.kind, label: t.label, x: t.npc ? t.npc.x : t.x, z: t.npc ? t.npc.z : t.z }));
    },
    project: (x, z) => toScreen(x, 0, z),
    isBlocked: (x, z) => current.grid.circleBlocked(x, z, PLAYER_RADIUS),
    teleport(x, z) {
      player.teleport(x, z);
      follow.snapTo(x, z);
      pending = null;
      doorArmed = false;
    },
    openStationCard(id) {
      const station = stationById(id);
      const model = station && stationCard(station, chipFor(station.scene));
      if (!model) return false;
      void openCard(model);
      return true;
    },
  };

  // ----- game loop -----
  const idleInput: InputState = { moveX: 0, moveY: 0, sprint: false, desktop: true, interact: false, tap: null };
  let stillFor = 0;
  let last = performance.now();
  let time = 0;
  let frozen = false;
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

    // A card or photo covers the world: draw one frame, then rest until it closes.
    const covered = cards.isOpen || lightbox.isOpen;
    if (covered && frozen) {
      input.poll();
      return;
    }
    frozen = covered;

    const polled = input.poll();
    let canAct = false;
    const playing = state === 'play' && busyCount === 0;
    // Scripted walks still move the player, but ignore the controls.
    const active = playing ? polled : { ...idleInput, desktop: polled.desktop };
    if (active.tap) moveTo(active.tap.x, active.tap.y);
    if (active.moveX !== 0 || active.moveY !== 0) pending = null;

    player.update(dt, active, follow.basis(), current.grid);
    player.animate(dt);
    for (const npc of current.npcs) npc.update(dt, state === 'play' ? { x: player.x, z: player.z } : null);
    // How-to-move hint: hidden while moving, back after a few seconds of standing still.
    stillFor = player.moving || !playing ? 0 : stillFor + dt;
    hint.classList.toggle('is-hidden', player.moving || (stillFor < HINT_AFTER_IDLE && hint.classList.contains('is-hidden')));
    if (marker.visible) {
      if (player.path.length === 0) marker.visible = false;
      else marker.scale.setScalar(1 + Math.sin(time * 8) * 0.12);
    }

    follow.update(dt, player.x, player.z, player.vx, player.vz, WALK_SPEED);

    if (playing) {
      // Doors: walking onto the door tile goes through.
      const door = current.def.doors.find((d) => Math.hypot(d.x + 0.5 - player.x, d.z + 0.5 - player.z) < 0.45);
      if (!door) doorArmed = true;
      const near = current.interactions.nearest(player.x, player.z, player.facing);
      const canInteract = performance.now() > ignoreInteractUntil;
      if (door && doorArmed) {
        doorArmed = false;
        void useDoor(door);
      } else if (pending && near === pending && canInteract) {
        interact(pending);
      } else if (near) {
        const at = toScreen(near.npc ? near.npc.x : near.x, near.height, near.npc ? near.npc.z : near.z);
        prompt.set(near.label, at.x, at.y);
        if (active.interact && canInteract) interact(near);
      } else {
        prompt.set(null);
      }
      canAct = !!near;
    } else {
      prompt.set(null);
      canAct = talk.isOpen;
    }
    // Touch: the A button only shows up when there's something to press it for.
    document.body.classList.toggle('can-act', canAct);

    sun.follow(player.x, player.z);
    current.fader.update(dt, follow.camera, player.x, player.z);
    current.art.update(time);
    current.interactions.update(time, player.x, player.z);
    renderer.three.render(scene, follow.camera);
    watchdog.tick(rawDt);
    current.debug?.update(dt, {
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
  };

  if (save.look) {
    // Returning visitor: straight into the park with their look and progress.
    introSeen = true;
    enterWorld();
    toast(toasts.welcomeBack);
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
  save.look = chosen.id;
  persist();
  enterWorld();

  // First visit: Calvin walks up and introduces himself. Esc skips it.
  const calvin = exteriorScene.npcs[0];
  begin();
  releaseHome(calvin);
  const dx = calvin.x - player.x;
  const dz = calvin.z - player.z;
  const gap = Math.hypot(dx, dz) || 1;
  await calvin.walk(exteriorScene.grid.findPath({ x: calvin.x, z: calvin.z }, { x: player.x + (dx / gap) * 1.5, z: player.z + (dz / gap) * 1.5 }, PLAYER_RADIUS));
  end();
  introSeen = true;
  await say('plaza.intro');
  if (!calvin.walking && (calvin.x !== calvin.home.x || calvin.z !== calvin.home.z) && busyCount === 0) void sendHome(calvin);
}

void boot();
