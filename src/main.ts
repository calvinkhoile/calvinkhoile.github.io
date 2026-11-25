import * as THREE from 'three';
import './ui/styles/main.css';
import { badgeById, badgeForScene, badges as allBadges, CAREER_BADGES } from './content/badges';
import { dialogue as dialogueNodes, toasts, type DialogueNode } from './content/dialogue';
import { profile } from './content/profile';
import { countedStations, stationById, type SceneId } from './content/stations';
import { audio } from './engine/audio';
import { music, type Zone } from './engine/music';
import { FollowCamera } from './engine/camera';
import { CourtScene } from './finale/court-scene';
import { Finale } from './finale/game';
import { drawGame, fixedGame, rng } from './finale/questions';
import { DebugOverlay } from './engine/debug';
import { TILE_BLOCKED, type Grid } from './engine/grid';
import { Input, type InputState } from './engine/input';
import { loadAll, loadModel } from './engine/loader';
import { FrameWatchdog, pickTier, saveTier, settingsFor, type QualityTier } from './engine/quality';
import { createRenderer, hasWebGL2, isCoarsePointer } from './engine/renderer';
import { BadgeUi } from './ui/badges';
import { CardOverlay } from './ui/card';
import { aboutCard, careerCard, stationCard } from './ui/card-models';
import { DialogueBox } from './ui/dialogue';
import gearIcon from './ui/icons/gear-six.svg?raw';
import mapIcon from './ui/icons/map-trifold.svg?raw';
import musicIcon from './ui/icons/music-notes.svg?raw';
import speakerOff from './ui/icons/speaker-slash.svg?raw';
import speakerOn from './ui/icons/speaker-high.svg?raw';
import { Lightbox } from './ui/lightbox';
import { Minimap } from './ui/minimap';
import { Prompt } from './ui/prompts';
import { Screens } from './ui/screens';
import { SelectStage } from './ui/select-stage';
import { Settings } from './ui/settings';
import { Tracker } from './ui/tracker';
import { buildArt, createSun, type ArtScene } from './world/art';
import { Character } from './world/character';
import { buildGrid } from './world/collision';
import { Interactions, type Target } from './world/interactions';
import { buildInterior } from './world/interior-art';
import { LiftMode } from './world/lift';
import { Kit } from './world/kit';
import { CALVIN_LOOKS, CALVIN_PLAZA_LOOK, lookById, TRAINER_LOOKS } from './world/looks';
import type { Door, MapDef } from './world/maps/types';
import { Npc } from './world/npc';
import { OccluderFader } from './world/occlusion';
import { Player, PLAYER_RADIUS, WALK_SPEED } from './world/player';
import { formatRoute, parseRoute, type Route } from './world/routes';
import { clearSave, loadSave, writeSave } from './world/save';
import { SCENE_NAMES, SCENES } from './world/scenes';
import { hide, show } from './ui/motion';
import { Highlights } from './ui/highlights';
import { LooseBalls } from './world/loose-balls';
import { callout, shake } from './ui/callout';

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
      badges: string[];
      guide: string | null;
      /** The finale question on screen, if a game is in progress. */
      finale: { id: string; type: string; answer: string; options: string[]; matchups?: { a: string; b: string; answer: string }[] } | null;
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
/** Camera distance during the 1-on-1 and the shootaround: closer than the park, not as close as a room. */
const GAME_ZOOM = 0.72;
const DOOR_FACING: Record<Door['facing'], [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

const params = new URLSearchParams(location.search);
// `?lineup=1`: a review page showing Calvin in every outfit (for judging the avatar's likeness).
const LINEUP = params.has('lineup');
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
  const owned = new Set(save.badges);
  const persist = () => writeSave({ ...save, visitedStations: [...visited], badges: [...owned] });
  // A deep link drops the visitor straight in: no title screen, default look unless they already picked one.
  const entryRoute = parseRoute(location.hash);
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
  const row2 = document.getElementById('hud-row2') as HTMLElement;
  const fade = document.getElementById('fade') as HTMLElement;
  const toastEl = document.getElementById('toast') as HTMLElement;
  let toastTimer = 0;
  const toast = (text: string) => {
    toastEl.textContent = text;
    show(toastEl, { replay: true });
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => void hide(toastEl), 5000);
  };
  const badgeUi = new BadgeUi(ui, row2, {
    reducedMotion,
    onReset: () => {
      clearSave();
      location.hash = '';
      location.reload();
    },
    onToggle: (open) => {
      // One panel at a time: the badge case closes the map.
      if (open) closeMap();
      return open ? begin() : end();
    },
    // Jump buttons in the badge case: go straight to the place that awards each badge.
    onJump: (route) => {
      const target = parseRoute(`#/${route}`);
      if (target) void applyRoute(target);
    },
  });
  badgeUi.refresh(owned);
  const tracker = new Tracker(row2, {
    // Jump: put the visitor on the station and open it, same as walking up and pressing E.
    onJump: (id) => {
      if (busyCount === 0) void stationSession(id);
    },
    onSkipAll: () => {
      if (busyCount === 0) void walkthrough(trackedScene());
    },
    onFinish: () => {
      if (busyCount === 0) void finishPlace(trackedScene());
    },
  });

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
    // Calvin dresses for the era: plaza jacket, a different outfit in each gym, the jersey at his court.
    const npcs: Npc[] = [];
    for (const spawn of def.npcs) {
      const outfit = CALVIN_LOOKS[spawn.dialogue as keyof typeof CALVIN_LOOKS] ?? CALVIN_PLAZA_LOOK;
      const npc = new Npc(spawn, await Character.create(outfit, { shadows }));
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

  // ----- sound and map buttons, next to the badge case -----
  const iconButton = (id: string, label: string, svg: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = id;
    b.className = 'hud-btn hud-icon';
    b.setAttribute('aria-label', label);
    b.innerHTML = svg.replace('<svg ', '<svg class="icon" aria-hidden="true" focusable="false" ');
    mini.appendChild(b);
    return b;
  };
  const mini = document.createElement('div');
  mini.className = 'hud-mini';
  row2.appendChild(mini);
  // Highlights: every gym and stop on one sheet. Labeled, first in the row, and never collapsed away.
  const highlights = new Highlights(ui, {
    onJump: (route) => {
      const target = parseRoute(`#/${route}`);
      if (target) void applyRoute(target);
    },
    onToggle: (open) => {
      if (open) closeMap();
      return open ? begin() : end();
    },
    visited: () => visited,
  });
  const highlightsBtn = document.createElement('button');
  highlightsBtn.type = 'button';
  highlightsBtn.id = 'hud-highlights';
  highlightsBtn.className = 'hud-btn hud-highlights';
  highlightsBtn.innerHTML = `<svg class="icon" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M128 20l32 72 78 7-59 52 18 77-69-41-69 41 18-77-59-52 78-7z"/></svg><span>Highlights</span>`;
  highlightsBtn.addEventListener('click', () => highlights.open());
  mini.appendChild(highlightsBtn);
  // Sound effects start off on every visit and never autoplay. One click turns them on.
  const soundBtn = iconButton('hud-sound', 'Sound effects', speakerOff);
  soundBtn.setAttribute('aria-pressed', 'false');
  const setSfx = (on: boolean) => {
    void audio.setEnabled(on);
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.innerHTML = (on ? speakerOn : speakerOff).replace('<svg ', '<svg class="icon" aria-hidden="true" focusable="false" ');
    toast(on ? 'Sound effects on.' : 'Sound effects off.');
  };
  soundBtn.addEventListener('click', () => setSfx(!audio.enabled));
  // Music is a separate switch. Also off until asked for.
  const musicBtn = iconButton('hud-music', 'Music', musicIcon);
  musicBtn.setAttribute('aria-pressed', 'false');
  const setMusic = (on: boolean) => {
    music.setEnabled(on);
    musicBtn.setAttribute('aria-pressed', String(on));
    toast(on ? 'Music on.' : 'Music off.');
  };
  musicBtn.addEventListener('click', () => setMusic(!music.enabled));
  document.addEventListener('visibilitychange', () => music.setHidden(document.hidden));
  const mapBtn = iconButton('hud-map', 'Map', mapIcon);
  mapBtn.setAttribute('aria-pressed', 'false');
  const toggleMap = () => {
    if (current.id !== 'exterior') return toast('The map works outside.');
    mapBtn.setAttribute('aria-pressed', String(minimap.toggle()));
  };
  mapBtn.addEventListener('click', toggleMap);
  function closeMap(): void {
    if (minimap.isOpen) mapBtn.setAttribute('aria-pressed', String(minimap.toggle(false)));
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && state === 'play' && busyCount === 0 && !e.repeat) toggleMap();
  });

  // ----- settings menu -----
  let volume = 60;
  let qualityChoice: QualityTier | 'auto' = picked.forced ? picked.tier : 'auto';
  music.setVolume(volume / 100);
  const settings = new Settings(
    ui,
    () => ({ sfx: audio.enabled, music: music.enabled, volume, quality: qualityChoice }),
    {
      sfx: setSfx,
      music: setMusic,
      volume: (v) => {
        volume = v;
        music.setVolume(v / 100);
        void audio.setVolume(v / 100);
      },
      quality: (q) => {
        qualityChoice = q;
        // A fixed choice sticks (and switches off the automatic step-down). Auto goes back to a device guess.
        saveTier(q === 'auto' ? null : q);
        autoQuality = q === 'auto';
        applyTier(q === 'auto' ? pickTier(new URLSearchParams()).tier : q);
      },
      reset: () => {
        clearSave();
        location.hash = '';
        location.reload();
      },
      toggle: (open) => {
        if (open) closeMap();
        return open ? begin() : end();
      },
    },
  );
  iconButton('hud-settings', 'Settings', gearIcon).addEventListener('click', () => settings.open());

  // The Weightroom's footprint in the exterior map: the tracker shows its stops while the visitor is inside it.
  const inWeightroom = () => current.id === 'exterior' && player.x > 27 && player.x < 47 && player.z > 22 && player.z < 39;
  /** Which set of stations the tracker is about right now, or null when there's nothing to track here. */
  const trackedScene = (): SceneId => current.id;
  function updateCounter(): void {
    const counted = countedStations(current.id);
    const show = counted.length > 0 && (current.def.interior || inWeightroom());
    tracker.set(
      show ? (current.def.interior ? SCENE_NAMES[current.id] : 'The Weightroom') : null,
      counted.map((st) => ({ id: st.id, label: st.label, done: visited.has(st.id) })),
    );
  }

  function showScene(next: LoadedScene, x: number, z: number, facing: number): void {
    if (current) scene.remove(current.root);
    current = next;
    scene.add(next.root);
    const interior = !!next.def.interior;
    (scene.background as THREE.Color).setHex(interior ? INTERIOR_BACKDROP : SKY);
    scene.fog = !interior && quality.fog ? fog : null;
    follow.setZoomOut(userZoom * (interior ? INTERIOR_ZOOM : 1), true);
    follow.setBounds(next.def.cameraBounds);
    player.teleport(x, z);
    player.facing = facing;
    player.speedScale = interior ? INTERIOR_ZOOM : 1;
    follow.snapTo(x, z);
    marker.visible = false;
    pending = null;
    doorArmed = false;
    next.interactions.refresh(visited);
    updateCounter();
    syncHash();
    music.setZone(next.id === 'exterior' ? 'park' : (next.id as Zone));
  }

  /** Keep the URL hash on the current place (and open station card), without adding history entries. */
  function syncHash(): void {
    const station = cards.isOpen && cards.currentId && stationById(cards.currentId) ? cards.currentId : null;
    const hash = current ? formatRoute(current.id, station) : '#/';
    if (location.hash !== hash && !(hash === '#/' && location.hash === '')) history.replaceState(null, '', hash);
  }

  function refreshDoorBadges(): void {
    for (const b of allBadges) if (b.scene) exteriorScene.art.setDoorBadge?.(b.scene, owned.has(b.id));
  }

  /** Award a badge with the ceremony. No-op if it's already owned. */
  async function award(id: string): Promise<void> {
    const badge = badgeById(id);
    if (!badge || owned.has(id)) return;
    owned.add(id);
    persist();
    badgeUi.refresh(owned);
    refreshDoorBadges();
    begin();
    audio.play('badge');
    await badgeUi.ceremony(badge);
    end();
    // Calvin "texts" at two and four career badges.
    const career = CAREER_BADGES.filter((b) => owned.has(b)).length;
    if (CAREER_BADGES.includes(id) && career === 2) toast(toasts.twoBadges);
    if (CAREER_BADGES.includes(id) && career === 4) toast(toasts.fourBadges);
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
  /** Target the prompt is currently showing for. Clicking or tapping the prompt uses it. */
  let nearTarget: Target | null = null;
  prompt.onActivate = () => {
    if (nearTarget && busyCount === 0 && performance.now() > ignoreInteractUntil) interact(nearTarget);
  };
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
  const minimap = new Minimap(ui, exteriorScene.def);
  showScene(exteriorScene, exteriorScene.def.spawn.x, exteriorScene.def.spawn.z, Math.PI * 0.75);
  refreshDoorBadges();

  const input = new Input(canvas, ui);

  // ----- dialogue, cards, actions -----
  async function say(key: string, speakerOverride?: string): Promise<void> {
    let node: DialogueNode | undefined = dialogueNodes[key];
    if (!node) throw new Error(`dialogue: unknown node "${key}"`);
    if (speakerOverride) node = { ...node, lines: node.lines.map((l) => ({ ...l, speaker: speakerOverride })) };
    begin();
    document.body.classList.add('is-talking');
    talk.onAdvance = () => audio.play('advance');
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

  /** Open a card and wait for it to close. Resolves with the footer action that closed it, or null (X, Esc, swipe). */
  async function openCard(model: Parameters<CardOverlay['open']>[0]): Promise<string | null> {
    let picked: string | null = null;
    begin();
    const closed = cards.open(model, {
      onLink: guideTo,
      onFooter: (action) => {
        picked = action;
        if (action.startsWith('guide:')) guideTo(action.slice(6));
      },
    });
    syncHash();
    await closed;
    syncHash();
    end();
    return picked;
  }

  /** The fastest way through a place: mark every stop visited and hand over the badge, no cards. */
  async function finishPlace(sceneId: SceneId): Promise<void> {
    for (const st of countedStations(sceneId)) visited.add(st.id);
    persist();
    current.interactions.refresh(visited);
    updateCounter();
    const badge = sceneId === 'exterior' ? badgeById('explorer') : badgeForScene(sceneId);
    if (badge) await award(badge.id);
  }

  /**
   * One pop-up for a whole place. It opens on a station and carries a strip of every stop there, each with a
   * check once seen. The visitor can hop between stops in the strip or with "Next", and everything they open
   * counts as visited. Closing it after seeing them all (Finish, X, or a click outside) earns the badge.
   */
  async function stationSession(startId: string): Promise<void> {
    const first = stationById(startId);
    if (!first) return;
    const sceneId = first.scene;
    const stops = countedStations(sceneId);
    let id = startId;
    begin();
    for (;;) {
      const station = stationById(id)!;
      if (!visited.has(id)) {
        visited.add(id);
        persist();
        current.interactions.refresh(visited);
        updateCounter();
      }
      // Stand the visitor at the stop they're reading about.
      const target = current.interactions.byId(id);
      if (target && Math.hypot(target.x - player.x, target.z - player.z) > target.radius) window.__mypark!.teleport(target.x, target.z);

      const model = stationCard(station, chipFor(sceneId));
      if (!model) break;
      if (station.counts) {
        model.stations = stops.map((st) => ({ id: st.id, label: st.label, done: visited.has(st.id), current: st.id === id }));
        const next = stops.find((st) => !visited.has(st.id));
        model.footer = next ? { label: `Next: ${next.label} →`, action: `swap:station:${next.id}` } : { label: 'Finish', action: 'finish' };
      }
      // Resolves with a swap ("station:<id>") while the card stays open, or null once it closes.
      audio.play('open');
      const action = await new Promise<string | null>((resolve) => {
        void cards.open(model, { onLink: guideTo, onSwap: resolve }).then(() => resolve(null));
        syncHash();
      });
      if (!action?.startsWith('station:')) break;
      id = action.slice(8);
    }
    audio.play('close');
    syncHash();
    end();
    // All of this place seen: the badge is theirs, no extra trip to the gym leader.
    if (stops.length > 0 && stops.every((st) => visited.has(st.id))) {
      const badge = sceneId === 'exterior' ? badgeById('explorer') : badgeForScene(sceneId);
      if (badge) await award(badge.id);
    }
  }

  /** "Walk me through it" and "Skip the walk": open the pop-up on the first stop not yet seen. */
  function walkthrough(sceneId: SceneId): Promise<void> {
    const stops = countedStations(sceneId);
    const start = stops.find((st) => !visited.has(st.id)) ?? stops[0];
    return start ? stationSession(start.id) : Promise.resolve();
  }

  async function runAction(action: string): Promise<void> {
    if (action === 'about') return void (await openCard(aboutCard()));
    if (action.startsWith('badge:')) return award(action.slice(6));
    if (action === 'walkthrough') return walkthrough(current.id);
    if (action === 'finish-gym') return finishPlace(current.id);
    if (action === 'finale') return runFinale();
    if (action.startsWith('card:')) return void (await openCard(careerCard(action.slice(5), { chip: chipFor(current.id) })));
    if (action === 'tour') return say('plaza.tourStart');
    const calvin = exteriorScene.npcs[0];
    if (action === 'tour-walk') return tourGo(0);
    if (action === 'tour-next') return tourGo(tourAt + 1);
    if (action === 'tour-in') {
      const stop = TOUR[tourAt];
      const door = stop.door ? exteriorScene.def.doors.find((d) => d.id === stop.door) : undefined;
      void sendHome(calvin);
      if (door) await useDoor(door);
      return;
    }
    if (action === 'tour-return') {
      void sendHome(calvin);
    }
  }

  // ----- Calvin's tour: every gym in career order, then the court -----
  const TOUR: { line: string; door?: string; at?: { x: number; z: number } }[] = [
    { line: 'tour.ucla', door: 'door-ucla' },
    { line: 'tour.deloitte', door: 'door-deloitte' },
    { line: 'tour.meta', door: 'door-meta' },
    { line: 'tour.betmgm', door: 'door-betmgm' },
    { line: 'tour.court', at: { x: 31.5, z: 15.5 } },
  ];
  let tourAt = 0;

  /** Walk to tour stop i (Calvin a step ahead), then his line for it. */
  async function tourGo(i: number): Promise<void> {
    const stop = TOUR[i];
    if (!stop) return;
    tourAt = i;
    const calvin = exteriorScene.npcs[0];
    const grid = exteriorScene.grid;
    // Doors all face east onto the path: the visitor stops a couple of steps out, Calvin just north of them.
    const door = stop.door ? exteriorScene.def.doors.find((d) => d.id === stop.door) : undefined;
    const spot = door ? { x: door.x + 0.5 + 2.2, z: door.z + 0.5 } : stop.at!;
    const cSpot = { x: spot.x - 0.3, z: spot.z - 1.3 };
    begin();
    releaseHome(calvin);
    player.setPath(grid.findPath({ x: player.x, z: player.z }, spot, PLAYER_RADIUS));
    await calvin.walk(grid.findPath({ x: calvin.x, z: calvin.z }, cSpot, PLAYER_RADIUS));
    for (let k = 0; k < 60 && player.path.length > 0; k++) await wait(150);
    end();
    return say(stop.line);
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
    const content = station.content;
    // Props (a photo, a line of dialogue) are marked seen here. Card stations are handled by the session.
    if ((content.source === 'photo' || content.source === 'dialogue') && !visited.has(station.id)) {
      visited.add(station.id);
      persist();
      current.interactions.refresh(visited);
    }
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

    return stationSession(station.id);
  }

  let introSeen = false;
  async function talkTo(npc: Npc): Promise<void> {
    if (npc.spawn.role === 'court') return say('court.challenge');
    if (npc.spawn.role === 'plaza') {
      const key = introSeen ? 'plaza.again' : 'plaza.intro';
      introSeen = true;
      return say(key);
    }
    const prefix = npc.spawn.dialogue;
    const allDone = countedStations(current.id).every((s) => visited.has(s.id));
    const hasBadge = owned.has(badgeForScene(current.id)?.id ?? '');
    return say(hasBadge ? `${prefix}.leaderAgain` : allDone ? `${prefix}.leaderDone` : `${prefix}.leader`);
  }

  async function useDoor(door: Door): Promise<void> {
    const to = door.to as SceneId;
    if (!SCENES[to]) return say('door.locked', SCENE_NAMES[to] ?? 'Door');
    begin();
    const from = current.id;
    fade.classList.add('is-on');
    const [next] = await Promise.all([loadScene(to), wait(reducedMotion ? 0 : 340)]);
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
    await wait(reducedMotion ? 0 : 140);
    fade.classList.remove('is-on');
    end();
  }

  function interact(target: Target): void {
    pending = null;
    player.setPath(null);
    marker.visible = false;
    navigator.vibrate?.(10);
    audio.play(target.kind === 'door' ? 'door' : 'select');
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
      case 'lift':
        startLift(target);
        break;
      case 'shoot':
        startShootaround(target);
        break;
      case 'poster':
        highlights.open();
        break;
    }
  }

  // ----- the 1-on-1 at Calvin's Court -----
  const court = new CourtScene(exteriorScene.root, player, exteriorScene.npcs.find((n) => n.spawn.role === 'court')!, reducedMotion);
  // Loose balls roll around the court (the fence line, minus the baseline under the hoop).
  const looseBalls = new LooseBalls(exteriorScene.root, exteriorScene.interactions.targets, { minX: 30.6, maxX: 45.4, minZ: 5.8, maxZ: 16.4 }, (id, hidden) =>
    exteriorScene.interactions.setRingHidden(id, hidden),
  );
  let heldBall: string | null = null;
  court.cue = (text, tone, strength) => {
    callout(text, tone);
    if (strength) shake(strength);
  };
  const finale = new Finale(ui, court, {
    onWin: () => award('legend'),
    onCopyEmail: () => emailBtn.click(),
    onShare: (text) => {
      const url = `${location.origin}/`;
      // Phones get the native share sheet. Elsewhere the line is copied.
      if (navigator.share && document.body.classList.contains('is-touch')) void navigator.share({ text, url }).catch(() => {});
      // The line already names the site, so the copy doesn't tack the URL on a second time.
      else if (navigator.clipboard) void navigator.clipboard.writeText(text).then(() => toast('Copied. Paste it anywhere.'));
    },
  });
  const LAST_GAME_KEY = 'mypark:finale-last';
  async function runFinale(): Promise<void> {
    begin();
    document.body.classList.add('in-finale');
    let previous: string[] = [];
    try {
      previous = JSON.parse(localStorage.getItem(LAST_GAME_KEY) ?? '[]') as string[];
    } catch {
      /* storage unavailable */
    }
    // `?set=a,b,c,d,e,f` plays a fixed game and `?seed=7` makes the draw repeatable (both for testing).
    const fixed = params.get('set') ? fixedGame(params.get('set')!.split(',')) : null;
    const seeded = params.has('seed') ? rng(Number(params.get('seed')) || 1) : null;
    let again = true;
    // Game mode: the camera moves in on the court.
    follow.setZoomOut(userZoom * GAME_ZOOM);
    music.setZone('finale');
    while (again) {
      court.setup();
      follow.snapTo(player.x, player.z - 1.5);
      const out = await finale.play(fixed ?? drawGame(seeded ?? rng((Math.random() * 2 ** 31) | 0), previous));
      previous = out.result.ids;
      try {
        localStorage.setItem(LAST_GAME_KEY, JSON.stringify(previous));
      } catch {
        /* storage unavailable */
      }
      save.finaleBest = Math.max(save.finaleBest ?? 0, out.result.correct);
      persist();
      again = out.again;
    }
    court.teardown();
    music.setZone('park');
    follow.setZoomOut(userZoom);
    follow.snapTo(player.x, player.z);
    document.body.classList.remove('in-finale');
    end();
  }

  // ----- overhead press (the Weightroom dumbbells) -----
  let lift: LiftMode | null = null;
  const liftHud = document.getElementById('lift-hud') as HTMLElement;
  const liftCount = document.getElementById('lift-count') as HTMLElement;
  function startLift(target: Target): void {
    const body = player.body;
    if (!body || lift) return;
    begin();
    // Face away from the rack, toward the camera side, so the press is in view.
    player.teleport(target.x, target.z);
    player.facing = Math.PI * 0.25;
    player.object.rotation.y = player.facing;
    lift = new LiftMode(body, player.object);
    liftCount.textContent = '0 reps';
    liftRepLabel.textContent = 'Curl';
    liftPress.hidden = false;
    show(liftHud);
    document.body.classList.add('is-lifting');
  }
  // ----- shootaround: pick up a loose ball on the court and put up shots -----
  // Hold Shoot (or G) and the shooter rises while a meter fills. Let go at the top, in the green, and it's money.
  let shooting: { made: number; taken: number; busy: boolean; streak: number } | null = null;
  const meter = document.getElementById('shot-meter') as HTMLElement;
  const meterFill = meter.querySelector('.shot-meter-fill') as HTMLElement;
  const METER_FILL_S = 0.62; // press to the top of the meter
  const meterZone = meter.querySelector('.shot-meter-zone') as HTMLElement;
  // The green window, as a fraction of the fill. It shrinks with distance: layups are forgiving, deep threes aren't.
  let GREEN: [number, number] = [0.86, 1.06];
  let CLOSE: [number, number] = [0.66, 1.2];
  let distK = 0; // 0 at the rim, 1 from deep
  function sizeGreen(dist: number): void {
    distK = Math.min(1, Math.max(0, (dist - 2.5) / 8.5));
    const width = THREE.MathUtils.lerp(0.34, 0.07, distK);
    GREEN = [1 - width * 0.75, 1 + width * 0.25];
    CLOSE = [GREEN[0] - 0.2, GREEN[1] + 0.14];
    // Draw the zone where it really is on the meter (the meter shows 0 to 1).
    meterZone.style.top = `${(1 - Math.min(1, GREEN[1])) * 100}%`;
    meterZone.style.height = `${(Math.min(1, GREEN[1]) - GREEN[0]) * 100}%`;
  }
  let meterStart = 0;
  let meterRelease: ((made: boolean) => void) | null = null;
  let meterTimer = 0;
  let meterGrade = '';

  function startShootaround(target: Target): void {
    if (shooting || lift || court.active) return;
    begin();
    shooting = { made: 0, taken: 0, busy: false, streak: 0 };
    heldBall = target.id;
    looseBalls.hold(target.id);
    court.beginShootaround(target.x, target.z);
    follow.setZoomOut(userZoom * GAME_ZOOM);
    liftCount.textContent = '0 for 0';
    liftRepLabel.textContent = 'Shoot';
    liftPress.hidden = true;
    show(liftHud);
    document.body.classList.add('is-lifting');
    toast(document.body.classList.contains('is-touch') ? 'Hold Shoot, let go at the top of the meter.' : 'Hold G, let go at the top of the meter.');
  }

  function meterValue(): number {
    return (performance.now() - meterStart) / 1000 / METER_FILL_S;
  }

  /** Press: rise up and start the meter. */
  function pressShot(): void {
    const s = shooting;
    if (!s || s.busy) return;
    s.busy = true;
    sizeGreen(court.shotDistance());
    meterStart = performance.now();
    meter.classList.remove('is-green', 'is-late');
    meterFill.style.transform = 'scaleY(0)';
    show(meter, { replay: true });
    const release = new Promise<boolean>((resolve) => (meterRelease = resolve));
    // Hold too long and it goes up late anyway.
    meterTimer = window.setTimeout(releaseShot, METER_FILL_S * 1000 * 1.45);
    void runShot(s, release);
  }

  /** Let go: grade the timing and decide the shot. */
  function releaseShot(): void {
    const resolve = meterRelease;
    if (!resolve) return;
    meterRelease = null;
    window.clearTimeout(meterTimer);
    const v = meterValue();
    const green = v >= GREEN[0] && v <= GREEN[1];
    const close = v >= CLOSE[0] && v <= CLOSE[1];
    meterGrade = green ? 'green' : v < GREEN[0] ? (close ? 'Slightly early' : 'Way early') : close ? 'Slightly late' : 'Way late';
    meterFill.style.transform = `scaleY(${Math.min(1, v)})`;
    meter.classList.toggle('is-green', green);
    meter.classList.toggle('is-late', !green && v > GREEN[1]);
    // Hold the result a beat, then fade the meter out (it keeps riding beside the shooter as it goes).
    window.setTimeout(() => void hide(meter), 650);
    // Near misses still fall sometimes, less often from deep.
    resolve(green || Math.random() < (close ? THREE.MathUtils.lerp(0.6, 0.3, distK) : THREE.MathUtils.lerp(0.2, 0.05, distK)));
  }

  async function runShot(s: NonNullable<typeof shooting>, release: Promise<boolean>): Promise<void> {
    const made = await court.shoot(release);
    if (shooting !== s) return; // put the ball down mid-shot
    audio.play(made ? 'swish' : 'rim');
    s.busy = false;
    s.taken++;
    s.streak = made ? s.streak + 1 : 0;
    if (made) s.made++;
    liftCount.textContent = `${s.made} for ${s.taken}`;
    navigator.vibrate?.(made ? [15, 30, 15] : 10);
    const green = meterGrade === 'green';
    if (made && s.streak >= 3) {
      callout(s.streak >= 5 ? 'ON FIRE' : 'HEATING UP', 'hype', `${s.streak} straight`);
      court.setOnFire(s.streak >= 5);
    } else if (made) callout(green ? 'GREEN' : 'BUCKET', 'good', green ? 'Perfect release' : meterGrade);
    else {
      callout('BRICK', 'bad', meterGrade);
      court.setOnFire(false);
    }
  }

  /** Called every frame: the meter rides beside the shooter and fills while held. */
  function updateMeter(): void {
    if (meter.hidden) return;
    const at = toScreen(player.x, 1.6, player.z);
    meter.style.transform = `translate(${Math.round(at.x + 34)}px, ${Math.round(at.y - 70)}px)`;
    if (!meterRelease) return;
    const v = meterValue();
    meterFill.style.transform = `scaleY(${Math.min(1, v)})`;
    meter.classList.toggle('is-green', v >= GREEN[0] && v <= GREEN[1]);
    meter.classList.toggle('is-late', v > GREEN[1]);
  }

  function stopShootaround(): void {
    const s = shooting;
    if (!s) return;
    shooting = null;
    meterRelease = null;
    window.clearTimeout(meterTimer);
    meter.hidden = true;
    court.setOnFire(false);
    court.endShootaround();
    // The ball goes down where the visitor is standing, not back to where it was found.
    if (heldBall) looseBalls.drop(heldBall, player.x, player.z, player.facing);
    heldBall = null;
    follow.setZoomOut(userZoom);
    void hide(liftHud);
    document.body.classList.remove('is-lifting');
    end();
    if (s.taken > 0) toast(`${s.made} for ${s.taken} from the floor.`);
  }

  const liftRepLabel = document.getElementById('lift-rep-label') as HTMLElement;
  const liftPress = document.getElementById('lift-press') as HTMLButtonElement;
  function liftRep(exercise: 'curl' | 'press' = 'curl'): void {
    if (shooting) return;
    if (!lift?.rep(exercise)) return;
    audio.play('bounce');
    liftCount.textContent = `${lift.reps} ${lift.reps === 1 ? 'rep' : 'reps'}`;
    navigator.vibrate?.(15);
  }
  function stopLift(): void {
    if (!lift) return;
    const reps = lift.reps;
    lift.stop();
    lift = null;
    void hide(liftHud);
    document.body.classList.remove('is-lifting');
    end();
    if (reps > 0) toast(`${reps} ${reps === 1 ? 'rep' : 'reps'}. Dumbbells back on the rack.`);
  }
  const liftRepBtn = document.getElementById('lift-rep') as HTMLButtonElement;
  liftRepBtn.addEventListener('click', () => liftRep('curl'));
  // Shooting is press-and-hold: down starts the meter, up lets it go.
  liftRepBtn.addEventListener('pointerdown', (e) => {
    if (!shooting) return;
    e.preventDefault();
    liftRepBtn.setPointerCapture?.(e.pointerId);
    pressShot();
  });
  for (const type of ['pointerup', 'pointercancel'] as const) liftRepBtn.addEventListener(type, () => shooting && releaseShot());
  liftRepBtn.addEventListener('contextmenu', (e) => shooting && e.preventDefault());
  liftPress.addEventListener('click', () => liftRep('press'));
  const stopActivity = () => (shooting ? stopShootaround() : stopLift());
  document.getElementById('lift-done')!.addEventListener('click', stopActivity);
  window.addEventListener('keyup', (e) => {
    if (shooting && e.code === 'KeyG') releaseShot();
  });
  window.addEventListener('keydown', (e) => {
    if ((!lift && !shooting) || e.repeat) return;
    if (e.code === 'KeyG') {
      if (shooting) pressShot();
      else liftRep('curl');
    }
    else if (e.code === 'KeyH' && lift) liftRep('press');
    else if (['Space', 'Escape', 'KeyE', 'Enter'].includes(e.code)) {
      e.preventDefault();
      stopActivity();
    }
  });

  // ----- HUD: résumé + socials -----
  const hudLinks = document.getElementById('hud-links') as HTMLElement;
  const hudToggle = document.getElementById('hud-toggle') as HTMLButtonElement;
  const emailBtn = document.getElementById('hud-email') as HTMLButtonElement;
  document.getElementById('hud-email-text')!.textContent = profile.email;
  hudLinks.querySelectorAll<HTMLAnchorElement>('[data-social]').forEach((a) => (a.href = profile.links[a.dataset.social as keyof typeof profile.links]));

  // Accordion: expanded shows names (and the email spelled out), collapsed shows just the icons.
  // Phones start collapsed to leave room for the world. The choice is remembered.
  // The hint and toasts sit just under whatever the top-right HUD takes up right now (it grows in a gym,
  // and on phones when the links open), so they never land on top of it.
  const measureHud = () => {
    const bottom = Math.max(hudLinks.getBoundingClientRect().bottom, row2.getBoundingClientRect().bottom);
    document.documentElement.style.setProperty('--hud-bottom', `${Math.round(bottom)}px`);
  };
  const hudObserver = new ResizeObserver(measureHud);
  hudObserver.observe(hudLinks);
  hudObserver.observe(row2);
  window.addEventListener('resize', measureHud);

  const LINKS_KEY = 'mypark:links';
  const setLinksOpen = (open: boolean, remember = true) => {
    hudLinks.classList.toggle('is-collapsed', !open);
    hudToggle.setAttribute('aria-expanded', String(open));
    hudToggle.setAttribute('aria-label', open ? 'Collapse quick links' : 'Expand quick links');
    // On phones the expanded links are a column, so the second row has to move below it.
    row2.classList.toggle('is-pushed', open);
    document.body.classList.toggle('links-open', open);
    measureHud();
    if (!remember) return;
    try {
      localStorage.setItem(LINKS_KEY, open ? 'open' : 'closed');
    } catch {
      /* storage unavailable */
    }
  };
  let savedLinks: string | null = null;
  try {
    savedLinks = localStorage.getItem(LINKS_KEY);
  } catch {
    /* storage unavailable */
  }
  setLinksOpen(savedLinks ? savedLinks === 'open' : !matchMedia('(max-width: 700px)').matches, false);
  hudToggle.addEventListener('click', () => setLinksOpen(hudLinks.classList.contains('is-collapsed')));

  emailBtn.addEventListener('click', () => {
    // Copy the address. If the clipboard is off limits, fall back to opening a mail draft.
    const fallback = () => (location.href = `mailto:${profile.email}`);
    if (!navigator.clipboard) return fallback();
    navigator.clipboard.writeText(profile.email).then(() => {
      toast(`Copied ${profile.email}`);
      emailBtn.classList.add('is-copied');
      setTimeout(() => emailBtn.classList.remove('is-copied'), 2000);
    }, fallback);
  });

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
  let movedFor = 0; // seconds spent moving; the hint retires after a few

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
    // Clicking or tapping the thing itself (the counter, the board, Calvin) counts, not just its floor ring.
    const target = current.interactions.pick(clientX, clientY, toScreen, document.body.classList.contains('is-touch') ? 50 : 42);
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
    const over = current.interactions.pick(e.clientX, e.clientY, toScreen, 42);
    canvas.style.cursor = over ? 'pointer' : '';
    current.interactions.setHover(over);
  });

  // ----- quality: step down a tier when the device can't hold ~30fps -----
  const applyTier = (tier: QualityTier) => {
    quality = settingsFor(tier);
    sun.setShadows(quality.shadowMapSize);
    renderer.setPixelRatioCap(quality.pixelRatioCap);
    scene.fog = !current.def.interior && quality.fog ? fog : null;
  };
  const watchdog = new FrameWatchdog((fps) => {
    if (!autoQuality || state !== 'play' || busyCount > 0) return;
    if (quality.tier === 'high') applyTier('medium');
    else if (quality.tier === 'medium') applyTier('low');
    else if (fps < 20 && !slowWarned && !fallbackOff) {
      // Already on the lowest tier and still crawling: offer the fast version instead of a slideshow.
      // Never cover what they're reading: wait for a quiet moment, then a short notice instead of a takeover.
      const cls = document.body.classList;
      if (cls.contains('has-card') || cls.contains('is-talking') || court.active || shooting || lift) return;
      slowWarned = true;
      toast(toasts.slow);
    }
  });
  let slowWarned = false;
  let autoQuality = !picked.forced;
  // The browser tests render in software, which is slow by nature. They opt out of the slow-device screen.
  let fallbackOff = false;
  try {
    fallbackOff = localStorage.getItem('mypark:nofallback') === '1';
  } catch {
    /* storage unavailable */
  }

  const projected = new THREE.Vector3();
  function toScreen(x: number, y: number, z: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    projected.set(x, y, z).project(follow.camera);
    return { x: rect.left + ((projected.x + 1) / 2) * rect.width, y: rect.top + ((1 - projected.y) / 2) * rect.height };
  }

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
    get badges() {
      return [...owned];
    },
    get guide() {
      return current.interactions.guideId;
    },
    get finale() {
      const q = finale.current;
      return q ? { id: q.id, type: q.type, answer: q.answer, options: q.options, matchups: q.matchups } : null;
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
  let stride = 0;
  let courtLit = false;
  /** Grass unless the visitor is standing on a path, the plaza, the court, or the Weightroom floor. */
  const surfaceAt = (x: number, z: number) =>
    exteriorScene.def.zones.some((zn) => zn.kind !== 'water' && x >= zn.x && x < zn.x + zn.w && z >= zn.z && z < zn.z + zn.d) ? 'step-hard' : 'step-grass';
  let courtHinted = false;
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
      // Character select: the park keeps rendering behind, the trainers are drawn on top of it.
      stage.update(dt);
      current.art.update(time);
      for (const npc of current.npcs) npc.update(dt, null);
      player.object.visible = false;
      renderer.three.render(scene, follow.camera);
      player.object.visible = true;
      renderer.three.autoClear = false;
      renderer.three.clearDepth();
      renderer.three.render(stage.scene, stage.camera);
      renderer.three.autoClear = true;
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
    if (!courtHinted && playing && current.id === 'exterior' && player.x > 30 && player.x < 46 && player.z > 3 && player.z < 17) {
      courtHinted = true;
      toast(document.body.classList.contains('is-touch') ? 'Loose balls on the court. Walk up to one and tap it to shoot around.' : 'Loose balls on the court. Walk up to one and press E to shoot around.');
    }
    if (current.id === 'exterior') updateCounter(); // cheap: only re-renders when the visitor enters or leaves the Weightroom
    // Scripted walks still move the player, but ignore the controls.
    const active = playing ? polled : { ...idleInput, desktop: polled.desktop };
    if (active.tap) moveTo(active.tap.x, active.tap.y);
    if (active.moveX !== 0 || active.moveY !== 0) pending = null;

    // During the 1-on-1 the court scene moves the player along scripted paths.
    if (!court.active) player.update(dt, active, follow.basis(), current.grid);
    court.update(dt);
    if (current === exteriorScene) {
      looseBalls.setSuspended(court.active);
      looseBalls.update(dt, player, false);
    }
    lift?.update(dt);
    player.animate(dt);
    for (const npc of current.npcs) npc.update(dt, state === 'play' ? { x: player.x, z: player.z } : null);
    // How-to-move hint: hidden while moving, back after a few seconds of standing still.
    // Once they've clearly got the hang of moving, it's retired for good. It also stays out of a notice's way.
    stillFor = player.moving || !playing ? 0 : stillFor + dt;
    if (player.moving) movedFor += dt;
    const hintOff = movedFor > 4 || player.moving || !toastEl.hidden || (minimap.isOpen && document.body.classList.contains('is-touch')) || (stillFor < HINT_AFTER_IDLE && hint.classList.contains('is-hidden'));
    hint.classList.toggle('is-hidden', hintOff);
    if (marker.visible) {
      if (player.path.length === 0) marker.visible = false;
      else marker.scale.setScalar(1 + Math.sin(time * 8) * 0.12);
    }

    // Footsteps: one every stride, on whatever is underfoot.
    if (audio.enabled && player.moving && !court.active) {
      stride += player.speed * dt;
      if (stride > 1.5) {
        stride = 0;
        audio.play(current.def.interior ? 'step-soft' : surfaceAt(player.x, player.z));
      }
    }
    if (current.id === 'exterior') {
      minimap.update(player.x, player.z, player.facing, time);
      // Stadium lights come on as the visitor nears the court.
      const nearCourt = player.x > 25 && player.z < 22;
      if (nearCourt !== courtLit) exteriorScene.art.setCourtLights?.((courtLit = nearCourt));
    }
    else if (minimap.isOpen) mapBtn.setAttribute('aria-pressed', String(minimap.toggle(false)));

    updateMeter();
    const focus = shooting ? court.shotFocus() : player;
    follow.update(dt, focus.x, focus.z, shooting ? 0 : player.vx, shooting ? 0 : player.vz, WALK_SPEED);

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
        nearTarget = near;
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

  /** Go where a deep link points: into a gym, to an outdoor spot, and open a station's card if one is named. */
  async function applyRoute(route: Route): Promise<void> {
    if (busyCount > 0) return;
    if (route.scene !== current.id) {
      if (route.scene === 'exterior') {
        showScene(exteriorScene, exteriorScene.def.spawn.x, exteriorScene.def.spawn.z, Math.PI);
      } else if (SCENES[route.scene]) {
        begin();
        const next = await loadScene(route.scene);
        showScene(next, next.def.spawn.x, next.def.spawn.z, Math.PI);
        end();
      }
    }
    if (route.spot === 'weightroom') window.__mypark!.teleport(38.5, 25);
    if (route.spot === 'court') window.__mypark!.teleport(35, 13);
    if (route.station) await stationSession(route.station);
  }
  window.addEventListener('hashchange', () => {
    const route = parseRoute(location.hash);
    if (route && state === 'play') void applyRoute(route);
  });

  if (save.look || entryRoute) {
    // Returning visitor or deep link: straight into the park, no title screen.
    introSeen = true;
    enterWorld();
    if (entryRoute) await applyRoute(entryRoute);
    else toast(toasts.welcomeBack);
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

if (LINEUP) void import('./dev/lineup').then((m) => m.runLineup(canvas));
else void boot();
