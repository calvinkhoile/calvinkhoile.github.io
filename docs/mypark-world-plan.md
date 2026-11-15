# MyPark World: Build Plan

**Owner:** Calvin Le
**Builder:** Fable (agent)
**Status:** Draft v1, Nov 14, 2026
**Repo:** `calvinkhoile/calvinkhoile.github.io` (GitHub Pages)

---

## 1. The Pitch

Turn calvinkhoile.github.io from a dashboard into a small 3D world you walk around in. Think NBA 2K's MyPark crossed with a Pokémon overworld. The visitor plays a trainer who shows up at Calvin's park. Calvin (as a low-poly NPC) greets them. A path leads through four "gyms," one per career stop (UCLA, Deloitte, Meta, BetMGM). Each gym is a walkable interior where every project is a stop. The path ends at Calvin's home court, where the visitor plays Calvin 1-on-1. Every possession is a scenario question (a chess position, a basketball read, a points-hacking call). Win or lose, it ends with a way to reach Calvin.

**What success looks like**
- A visitor gets to at least one gym and opens a project card within 60 seconds of landing.
- A recruiter who wants none of this reaches a clean résumé in one click from any screen.
- It runs smoothly on a mid-range phone (iPhone 12 / Pixel 6 class) and feels as good on mobile as on desktop.
- People share it. The finale is the hook.

**Non-goals (v1)**
- Multiplayer, accounts, a backend, analytics, a CMS.
- A guestbook where visitors leave their name. It's a planned v2 story (Section 16), so don't build it, but don't block it either: keep the result screen and the plaza layout able to fit one later.
- Rewriting Calvin's content. All copy and photos come from the current site (Section 9).
- Physics simulation. Movement and collision are grid-based (Section 6.4).

---

## 2. Decisions Already Made

| Topic | Decision |
|---|---|
| Visual style | 3D low-poly, fixed isometric-style camera (MyPark feel) |
| Gyms | Walkable interiors; each project is an interactable station |
| Characters | Visitor plays a trainer (pick 1 of 4 looks). Calvin is an NPC: a guide at spawn plus "gym leader" versions in each gym |
| Calvin's avatar | New low-poly Calvin, styled from `assets/model.glb` (Avaturn scan) and photos in `assets/` |
| Art source | CC0 / licensed 3D asset packs. Custom work only for Calvin, logos, and signage |
| Progression | Open world. A path and Calvin's NPC nudge visitors in chronological order. Badges are collectible and never block anything |
| Finale | 1-on-1 basketball vs Calvin. 5 possessions, each a scenario question drawn from a library of 15 |
| Naming | The world is **MyPark**. The hobbies zone becomes **The Blacktop** and side builds become **The Workshop**. "Badges" now means the collectible gym badges, so the old MyBadges / MyPark tab names retire |
| Escape hatch | A résumé view one click away at all times, plus an automatic fallback when WebGL isn't available or the device is too slow |
| Hosting | GitHub Pages, built and deployed by GitHub Actions |

---

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | The codebase will be large and agent-built. Types catch mistakes early |
| Bundler / dev server | Vite 5 | Fast, simple, static output for Pages |
| 3D | three.js (r165+, pin an exact version) | Already used on the site. Huge ecosystem, no engine lock-in |
| Asset pipeline | `@gltf-transform/cli` (meshopt compression, texture resize, WebP/KTX2) | Keeps mobile downloads small |
| UI overlays | Plain DOM + CSS over the canvas (no React) | Project cards are text- and image-heavy. DOM is accessible, selectable, and can reuse the current site's card styles |
| Mobile joystick | `nipplejs` (pin version) or a custom ~150-line joystick | Proven touch handling. Custom is fine if nipplejs feels off |
| Audio | `howler.js` (pin version) | Handles mobile audio unlock quirks |
| Chess logic (finale) | `chess.js` (pin version), at build/test time only | Checks that every chess answer in the library is legal and correct |
| Tests | Vitest (logic), Playwright (smoke tests at desktop + mobile viewports) | The agent needs a way to verify its own work |
| Deploy | GitHub Actions → `actions/deploy-pages` | Pages serves the `dist/` build output |

**No physics engine, no game engine, no React.** Keep the dependency list short.

### Deploy change (important)
The site currently deploys straight from `main` with no build. After this project:
1. **At M0**, Fable adds `.github/workflows/deploy.yml` to `main` that deploys the **current static site unchanged** (no build). It must upload **only the site files** (`index.html`, `style.css`, `script.js`, `assets/`, plus `.nojekyll`) by copying them into a staging folder and uploading that as the Pages artifact. Never upload `docs/`, `CLAUDE.md`, `assets-src/`, or anything else; those stay in the repo but must never be served. Only after that workflow is on `main` does **Calvin** switch the Pages source to **GitHub Actions** (repo Settings → Pages → Source). The live site doesn't change and there's no downtime. Fable gives exact instructions.
2. The world is built on a branch (`world`). Pages serves only one site per repo, so the world has no public preview before launch. For phone testing at M1+, Fable runs `vite --host` and Calvin opens the LAN URL on his phone (same Wi-Fi). If that doesn't work, use a temporary tunnel (e.g., `cloudflared tunnel --url`), never a public deploy.
3. **At M8**, the workflow on `world` is changed to `npm ci && npm run build` and uploads `dist/`. Merging `world` → `main` swaps the live site. Rollback = revert the merge.

### Vite build specifics
- Set `build.assetsDir` to `_app` so Vite's hashed output can't collide with content folders.
- `/classic/` lives in `public/classic/` (passthrough, copied as-is). It keeps its own import map and plain `<script src>`; Vite must not process it. Fix its asset paths to point at `/classic/assets/...` or a shared `/images/` folder.
- `/resume/` is **prerendered at build time**: a Node script (`scripts/build-resume.ts`, run as part of `npm run build`) reads `src/content/*` and writes static `dist/resume/index.html`. It must work with JavaScript disabled.

---

## 4. Repo Structure (target)

```
/
├─ index.html                 ← world entry (canvas + UI root)
├─ resume/index.html          ← résumé view (static, crawlable, no WebGL)
├─ classic/                   ← the current site, preserved as-is (index.html, style.css, script.js)
├─ public/
│  ├─ models/                 ← optimized .glb files (post-pipeline)
│  ├─ textures/
│  ├─ images/                 ← optimized photos for cards (WebP, max 1600px)
│  ├─ audio/
│  └─ favicon.png
├─ assets-src/                ← raw downloaded packs + originals (gitignored if huge; see 8.4)
├─ src/
│  ├─ main.ts                 ← boot: capability check → loader → world or fallback
│  ├─ engine/
│  │  ├─ renderer.ts          ← WebGLRenderer, resize, pixel-ratio cap, quality tiers
│  │  ├─ camera.ts            ← isometric follow camera
│  │  ├─ input.ts             ← keyboard, mouse/raycast, touch joystick → one InputState
│  │  ├─ grid.ts              ← collision grid, A* pathfinding
│  │  ├─ scene-manager.ts     ← load/unload exterior + interiors, fade transitions
│  │  ├─ loader.ts            ← GLTF + meshopt decoder, progress events, caching
│  │  └─ audio.ts
│  ├─ world/
│  │  ├─ maps/                ← one map file per scene (exterior.ts, gym-ucla.ts, ...)
│  │  ├─ player.ts            ← visitor movement + animation states
│  │  ├─ npc.ts               ← Calvin NPC variants, dialogue triggers
│  │  ├─ interactables.ts     ← stations, signs, doors, collectibles
│  │  └─ badges.ts            ← badge state, persistence
│  ├─ ui/
│  │  ├─ hud.ts               ← badge case, mute, résumé link, minimap toggle
│  │  ├─ dialogue.ts          ← Pokémon-style text box (typewriter, advance on tap/key)
│  │  ├─ card.ts              ← project card overlay (reuses classic card patterns)
│  │  ├─ prompts.ts           ← "Press E / Tap ●" proximity prompts
│  │  ├─ title-screen.ts      ← press start + character select
│  │  └─ styles/
│  ├─ finale/
│  │  ├─ game.ts              ← 1v1 state machine
│  │  ├─ questions.ts         ← loads + samples the question library
│  │  ├─ renderers/           ← chess board, half-court diagram, multiple choice, rivalry
│  │  └─ court-scene.ts       ← animations for make/miss/block
│  └─ content/
│     ├─ career.ts            ← careerData, migrated verbatim from classic/script.js
│     ├─ profile.ts           ← bio paragraphs, social links, email
│     ├─ stations.ts          ← station registry (see 6.9)
│     ├─ side-builds.ts
│     ├─ hobbies.ts
│     ├─ dialogue.ts          ← all NPC lines in one place (easy for Calvin to edit)
│     └─ finale-questions.json
├─ tests/
├─ docs/
│  ├─ mypark-world-plan.md    ← this file
│  ├─ ASSETS.md               ← every third-party asset: source URL, license, author
│  └─ CONTENT-EDITING.md      ← how Calvin edits copy, dialogue, questions
└─ .github/workflows/deploy.yml
```

---

## 5. The World

### 5.1 Map layout (exterior)

One outdoor map, roughly 80 × 60 tiles (1 tile = 1 world unit ≈ 1 meter). Sunny California afternoon: palm trees, warm light, long soft shadows. A winding path connects everything in chronological order, shaped like a loose "S" so the camera reveals one area at a time.

```
                    N
   ┌──────────────────────────────────────────────┐
   │  [BetMGM Gym]──────path──────[Calvin's Court] │  ← finale (NE corner)
   │      │  (Vegas strip vibe)        (home court)│
   │     path                                  │   │
   │      │                          [The Blacktop]│  ← hobbies zone
   │  [Meta Gym]                     track · chess │
   │      │  (campus, blue)          tables · hoop │
   │     path ─────────────[The Workshop]          │  ← side builds
   │      │                                        │
   │  [Deloitte Gym]                               │
   │      │  (glass tower)                         │
   │     path                                      │
   │  [UCLA Gym]──path──[Spawn Plaza]              │  ← visitor starts here (SW)
   │  (brick, Royce-ish)  Calvin NPC, fountain,    │
   │                      signpost, résumé kiosk   │
   └──────────────────────────────────────────────┘
```

- **Spawn Plaza:** fountain, a wooden signpost pointing to every area, and a **Résumé Kiosk** (a glowing terminal that opens `/resume`). Calvin NPC stands here for the intro.
- **Path:** brick-red ground tiles with small "footprint" decals pointing the way. Lamp posts mark each gym entrance.
- **Gym exteriors** are recognizable at a glance (see 5.3). Each has a floating badge icon above the door, grey until earned, then full color.
- **The Workshop** (side builds) and **The Blacktop** (hobbies) sit off the main path. They're optional detours.
- **Calvin's Court** sits at the end of the path, fenced, with stadium lights that switch on when the visitor gets close.
- **Edges:** low hedges, water, or fences. No invisible walls in open space.

### 5.2 Camera

- Perspective camera with a narrow FOV (~30°), placed high and angled ~50° down, 45° yaw. That gives the isometric look while keeping some depth. (An orthographic camera is the fallback if perspective feels off.)
- Smooth follow on the player (critically damped spring, ~0.15s), with a small lead in the direction of movement.
- No player-controlled rotation in v1. Fixed angle = no motion sickness and simpler controls.
- Interiors use the same angle with a tighter zoom. The camera clamps to room bounds.
- Buildings and props between the camera and the player fade to ~30% opacity (raycast from camera to player).

### 5.3 Gym exteriors

| Gym | Look | Signage | Badge |
|---|---|---|---|
| UCLA | Red-brick building with twin towers (Royce Hall nod), blue-and-gold banners | "UCLA" + Bruin-blue sign | **Bruin Badge** (blue/gold) |
| Deloitte | Sleek glass office tower, black with a green accent | "Deloitte." with the green dot | **Consultant Badge** (green dot) |
| Meta | Low modern campus building, white + Meta blue, big "like" sign energy (no thumbs-up logo; use the Meta infinity logo from `assets/logos/meta.svg`) | Meta logo | **Ship-It Badge** (blue infinity) |
| BetMGM | Vegas casino facade, black and gold, marquee lights | BetMGM logo, marquee | **High Roller Badge** (gold chip) |

Logos come from `assets/logos/`. They appear only on signage, the same way they're used on the current site.

### 5.4 Gym interiors (walkable)

Each interior is its own small scene (about 16 × 12 tiles), loaded when the visitor walks through the door (fade to black, ~400ms). Leaving drops them back outside facing away from the door.

Every interior has:
- **The gym leader:** a Calvin NPC dressed for that era, standing at the back. Talking to him plays a short intro and opens the company **Overview** card. Talking to him *after* visiting every station awards the badge (with a little ceremony: badge spins up, chime, confetti).
- **Stations:** one per project. A station is a physical object (a screen, a trophy case, a desk) with a glowing floor ring. Walking into the ring shows the prompt. Interacting opens that project's card.
- **A visited state:** visited stations' rings turn from blue to green. A counter by the door shows "2/4 stations."
- **Ambient detail** so the room feels lived-in (Section 7 lists the asset packs).

| Gym | Gym leader look | Stations (→ content key) |
|---|---|---|
| **UCLA** (3 counted) | Calvin in a UCLA hoodie + backpack. Leader opens `ucla-overview` (header + desc) | **Graduation stage** → `ucla-overview` Education tab · **Club fair booths** → Clubs tab · **Internship job board** → Internships tab (render the timeline as pinned cards) |
| **Deloitte** (3 counted) | Calvin in a blazer, laptop under arm. Leader opens `deloitte-overview` | **3 project whiteboards**, one per `impact` bullet in `deloitte-overview` (financial system upgrade, self-service HR tools, JIRA case management). Each opens a small card showing that bullet's existing text verbatim, with the Deloitte photos (`content.source: 'impact'`). Prop: **sushi bar counter**, dialogue line in Calvin's own words from the source copy: "When the world shut down in 2020, I was at a sushi bar in SF for a client project." |
| **Meta** (3 counted) | Calvin in a Meta hoodie. Leader opens `meta-overview` | **Feedback kiosk** → `external-feedback` · **Feature wall** (a giant phone showing Stories) → `highlighted-features` · **Voice of the customer mailbox** → `product-feedback` · Prop: **HQ window** framing `meta hq.jpeg` (lightbox) |
| **BetMGM** (4 counted) | Calvin in a quarter-zip, lanyard. Leader opens `betmgm-overview` | **Rewards Store counter** → `rewards-store` · **Server rack / API terminal** → `loyalty-apis` · **Partnership desk** with a Marriott bellhop cart → `enablement-wins` · **AI lab pod** with glowing monitors → `ai-betmgm` · Prop: **Product Summit stage** with `product summit.JPG` on the stage screen (lightbox) |

### 5.5 The Workshop (side builds, "MyBadges")

A garage with a roll-up door, workbench, and string lights.
- **Sportsbook ticker board** → Sports Betting card (Pikkit screenshots, CLV story).
- **Workbench with two monitors** → Building with AI card (Claude Code, Cursor, GitHub tags; keep the "work in progress" framing, but use a 3D caution sign instead of the current WIP image).
- **"You are here" easter egg:** a tiny diorama of the park on the workbench. Interacting opens a short card about how this site was built (Calvin writes the copy; Fable leaves a placeholder and flags it).

### 5.6 The Blacktop (hobbies, "Off the Court")

An outdoor zone, no interior.
- **Running track loop:** two mile markers, one per marathon (LA 2026, Huntington Beach 2025). Each opens its slice of the Running card. Optional: the visitor runs faster on the track (1.5× speed).
- **Chess tables:** two stone tables with boards. One opens the Chess card (rating screenshot). The other is a "play Calvin later" teaser pointing at the finale.
- **Coach's bench + travel team banner** ("Genesis Elite") → the Coaching slice of the Basketball card.
- **Trophy case** with the HS record → the Basketball card, opened on the Record slice. Its tabs also include the Playing slice (`basketball 1.JPG`, driving to the rim at Fountain Valley).
- Counted for the Explorer badge: both mile markers, the chess table, the coach's bench, the trophy case, and both Workshop stations.

### 5.7 Calvin's Court (finale)

A fenced half-court with stadium lights, a scoreboard, and a few NPC spectators on bleachers. Calvin stands at the top of the key in a jersey (#13, from his handle) with a ball. Details in Section 10.

---

## 6. Gameplay Systems

### 6.1 First load and title screen

1. **Loading screen** (target < 3s on 4G for the first playable frame): Calvin's knight favicon, a progress bar, a rotating tip ("Tip: there's a résumé button in the top right if you're in a hurry").
2. **Title screen:** the world renders behind a blurred overlay. "CALVIN LE" in a chunky display font, "Sr. Product Manager · BetMGM" under it, and two buttons:
   - **Press Start** (Enter / tap) → character select
   - **View Résumé** → `/resume`
3. **Character select:** 4 trainer looks, shown as rotating low-poly models. All 4 share one skeleton and one animation file; the looks are mesh/material variants of the same base, so the extra three cost under ~300KB total. Load them while the title screen is up. Arrow keys / swipe to pick, Enter / tap to confirm. The choice is saved to localStorage.
4. **Spawn:** the visitor appears in the plaza. Calvin NPC walks up and starts the intro dialogue automatically (skippable).

Returning visitors (localStorage has a save) skip the title screen and get a "Welcome back" line, with their badges intact.

### 6.2 Controls

| Action | Desktop | Mobile |
|---|---|---|
| Move | Arrow keys or WASD (8-direction, normalized diagonals) | Virtual joystick. A touch that **starts** in the bottom-left joystick zone (left 45% of the screen, bottom 50%) spawns the joystick where the thumb lands. Taps anywhere else are tap-to-move or tap-to-interact |
| Interact / advance dialogue | E, Space, or Enter | Big round **A** button, bottom-right |
| Click-to-interact | Click any interactable or NPC: the player auto-walks there (A* on the grid), then interacts | Tap any interactable or NPC: same behavior |
| Click-to-move | Click open ground to walk there | Tap open ground to walk there |
| Close card / back | Esc or the X button | X button, or swipe down on the card |
| Sprint | Hold Shift | Push the joystick past 85% |
| Menu | Esc (when no card is open) or the menu button | Menu button, right edge |
| Map | M toggles the minimap | Map button in the menu |

- Hovering an interactable on desktop shows an outline glow and a pointer cursor.
- Movement speed: 4 units/s walking, 6.5 sprinting. Snappy acceleration (~80ms to full speed); no ice-skating.
- Collision should feel forgiving: slide along walls, don't stop dead.
- Haptics: a short vibration (where supported) on interact and on badge earned.
- Mobile layout respects safe areas (`env(safe-area-inset-*)`) so the A button and joystick zone clear the iPhone home indicator and rounded corners. Use `100dvh`, not `100vh`, so iOS's collapsing toolbar doesn't push UI off-screen. Disable pinch-zoom and double-tap zoom on the canvas (`touch-action: none`), but not on cards.

### 6.3 Interaction model

- Each interactable has an **interaction radius** (default 1.5 units). Entering it shows a floating prompt above the object ("E · Rewards Store" on desktop, "● Rewards Store" on mobile).
- If several are in range, the nearest one in the facing direction wins.
- Interacting:
  - **NPC:** opens the dialogue box (6.5).
  - **Station:** opens the project card (Section 9). The game pauses input while it's open.
  - **Door:** fade transition to the linked scene.
  - **Sign:** a one-line dialogue box.
  - **Kiosk:** opens `/resume` in a new tab.

### 6.4 Collision and pathfinding

- Every map has a **walkability grid** (2D array of tile flags: walkable, blocked, door, interact-zone).
- Map files are code (`src/world/maps/*.ts`), not a level editor, so the agent can author and edit them directly. Each map declares: grid size, ground tiles, a list of placed props (`{ model, x, z, rotation, blocks: true }`), doors, interactables, NPC spawns, and the camera bounds.
- Props marked `blocks` automatically stamp their footprint into the grid.
- Movement: circle-vs-grid collision with axis separation (move X, resolve, move Z, resolve) so the player slides along walls.
- Click/tap-to-move uses A* on the same grid, with path smoothing (string-pulling).
- A debug overlay (`?debug=1`) draws the grid, collision cells, interact radii, and an FPS counter.

### 6.5 Dialogue

- Pokémon-style box anchored to the bottom of the screen: speaker name tab, typewriter text (~40 chars/s), a blinking ▼ when the line is done.
- Advance with E / Space / Enter / click / tap / the A button. Advancing mid-typewriter completes the line instantly.
- Choice prompts (2–3 options) for branching lines (e.g., "Want the tour?" → "Show me around" / "I'll explore").
- All lines live in `src/content/dialogue.ts`, keyed by NPC and trigger, so Calvin can edit copy without touching logic.
- Calvin's voice in dialogue: casual, a little funny, self-aware. Follow the writing rules in `CLAUDE.md` (no em dashes, no banned words).

**Draft lines (Calvin to edit):**
- Intro: "Hey! I'm Calvin. Welcome to my park." → "Every building here is a stop in my career. Start at UCLA and work your way up." → "When you're done, come find me at my court. I'll be waiting with a ball." → choice: "Show me around" (Calvin walks the visitor to the UCLA door) / "I'll explore" ("Cool. Résumé kiosk is right there if you're in a rush.") / "Who are you?" (opens an **About Calvin** card with the two bio paragraphs from `profile.ts`, verbatim).
- Talking to plaza Calvin again any time offers the same three options.
- Mid-path, after 2 badges: Calvin texts the visitor (a phone-notification toast): "Two badges already? You're moving. Court's open whenever you're ready."
- All 4 badges: "Okay you've done your homework. Let's see if it paid off. Court. Now."

### 6.6 Badges and save state

- 4 career badges (one per gym), plus 2 bonus badges: **Explorer** (visited the Workshop and the Blacktop) and **Park Legend** (won the finale).
- A badge case in the HUD (top-left) shows 6 slots. Clicking it opens a panel listing each badge and where to earn it.
- Saved to localStorage under `mypark:v1`: `{ look, badges[], visitedStations[], finaleBest }`. All reads and writes are wrapped in try/catch; the game works fine without storage.
- A "Reset progress" option in the menu.

### 6.7 HUD

Minimal, translucent, stays out of the way:
- **Top-left:** badge case.
- **Top-right, row 1 (quick links, always visible, never hidden in a menu):** **Résumé** (labeled button, opens `/resume`), then icon buttons for **LinkedIn**, **Email** (copies `calvinkhoile13@gmail.com` with a "Copied" toast, plus a `mailto:` fallback), **GitHub**, and **X**. Same URLs as today's site (`index.html` lines ~42–45). On mobile, Résumé stays visible and the four icons collapse into a single "Contact" button that opens a small sheet.
- **Right edge, below the links (audio toggles):** two separate toggles stacked vertically, **Music** and **Sound effects**, each an icon button with an on/off state (and `aria-pressed`). Both start off. Then the menu button.
- **Bottom-center (desktop only, first 30s):** a controls hint that fades out after the visitor moves.
- **Optional minimap** (M on desktop, or the Map button in the menu): a top-down sketch of the park showing the player dot and gym icons.

### 6.8 Deep links

The URL hash tracks location so Calvin can send someone straight to a project:
- `#/` plaza · `#/gym/betmgm` inside the BetMGM gym · `#/gym/betmgm/rewards-store` in the gym with that card open · `#/court` at the finale.
- Deep links skip the title screen (default look) and drop the visitor at the target.
- Full route list: `#/gym/<ucla|deloitte|meta|betmgm>[/<station>]`, `#/workshop[/<station>]`, `#/blacktop[/<station>]`, `#/court`. Station slugs come from the registry in 6.9.

### 6.9 Station registry (the glue)

One file, `src/content/stations.ts`, connects everything. Each entry:

```ts
{ id: 'betmgm/rewards-store',   // scene/slug: used in visitedStations[], deep links, analytics-free progress
  scene: 'gym-betmgm',
  label: 'Rewards Store',       // prompt text + screen-reader label
  content: { source: 'career', key: 'rewards-store', tab?: 0 },  // or source: 'side-builds' | 'hobbies' | 'impact' | 'photo'
  counts: true }                // counts toward the gym's "x/N" and the badge
```

- **Counted stations** open real content. **Props** (`counts: false`) are optional extras: photo props open the lightbox with one photo, easter eggs open a dialogue line.
- Map files reference stations by `id`, never by content key directly. The badge for a gym is awarded when every `counts: true` station in that scene is visited and the visitor talks to the gym leader.
- Gym leader → always opens that company's `*-overview` card. Overviews are never also a station (no duplicates).
- The station tables in 5.4–5.6 list every entry. Fable creates the registry from them.

---

## 7. Art Direction and Assets

### 7.1 Style guide

- **Low-poly, flat-shaded, chunky proportions.** Characters are about 1.8 units tall with slightly big heads (stylized, not chibi).
- **Palette:** warm and saturated. Sky gradient from soft blue to peach at the horizon. Ground: grass green `#7BC67E`, path brick `#C4683F`, concrete `#D9D4CC`. Each gym brings its own accent color (UCLA blue `#2774AE` / gold `#FFD100`, Deloitte green `#86BC25`, Meta blue `#0866FF`, BetMGM gold `#C5A15A` on black).
- **Lighting:** one warm directional "sun" with soft shadows (shadow map 2048 on desktop, 1024 on mobile, or baked blob shadows on the low tier), plus hemisphere fill. Light fog at the map edges for depth.
- **No textures beyond palette atlases.** Most CC0 low-poly packs use a single small gradient texture. Keep it that way.
- **UI:** a Pokémon-inspired dialogue box and cards with modern polish. Display font: a chunky rounded face (e.g., "Lilita One" or "Bungee" from Google Fonts) for headers and badges. Body: Inter, which the site already uses. A pixel font is used only for the scoreboard in the finale.

### 7.2 Asset sources (verify license on download)

Prefer **CC0** so there are no attribution or licensing headaches. Some packs (itch.io, Google Drive links) sit behind click-through download pages an agent can't get through. Fable lists exactly which files it needs and Calvin downloads them into `assets-src/`. Every asset used goes in `docs/ASSETS.md` with its source URL, author, and license.

| Need | Source (first choice → fallback) |
|---|---|
| Buildings, roads, city props | Kenney **City Kit (Commercial)**, **City Kit (Roads)**, **City Kit (Suburban)** (kenney.nl, CC0) → KayKit **City Builder Bits** (kaylousberg.itch.io, CC0) |
| Nature (trees, palms, hedges, rocks) | Kenney **Nature Kit** (CC0) → Quaternius **Ultimate Nature** (quaternius.com, CC0). Kenney blocks automated downloads, so Calvin downloads every Kenney pack |
| Interiors (desks, monitors, shelves, couches) | Kenney **Furniture Kit** (CC0) → Quaternius **Ultimate Furniture / Office** packs (CC0) |
| Characters (visitor trainers, NPCs) | Quaternius **Universal Base Characters** (CC0, rigged, built for the Universal Animation Library). It ships without modern outfits (Quaternius's only outfit pack is fantasy), so casual clothes (hoodies, blazer, jersey) are made by recoloring and lightly modeling over the base in Blender. Fallback: other CC0 casual characters on Poly Pizza. Pick one family for every character, including Calvin. No fantasy outfits |
| Animations (idle, walk, run, wave, talk, dribble, shoot, celebrate) | Locomotion: bundled with the character pack → Quaternius **Universal Animation Library** (CC0). Basketball clips (dribble, shoot, block) are unlikely in CC0 libraries: use Mixamo (free; Calvin downloads with his Adobe login) or fake them in code (10.6). Mixamo files may be used in a project but not redistributed standalone, so commit only the retargeted, compressed GLBs baked into game assets, never raw Mixamo FBX files |
| Basketball (hoop, ball, court lines, bleachers, scoreboard) | No Kenney 3D basketball kit exists (the Sports Pack is 2D). Build court lines, hoop (torus + box + backboard), ball, and scoreboard in code from primitives; Poly Pizza CC0 models only if they match the style |
| Chess set (Blacktop tables) | Poly Pizza CC0 → primitives |
| Sound effects | Kenney **Interface Sounds**, **Impact Sounds**, **Digital Audio** (CC0) |
| Music | One looping chill lo-fi/chiptune track per zone, CC0 or CC-BY (e.g., OpenGameArt filtered by license). Fable logs attribution in ASSETS.md and adds a credits line on the résumé page if CC-BY |

Paid packs (e.g., Synty POLYGON City) are an option only if Calvin approves the spend. Note: Synty's license doesn't allow redistributing raw files, so source assets would have to be gitignored and only the built output committed. Default to CC0.

### 7.3 Calvin's low-poly avatar

This is the one fully custom character, and it's the hardest art task. A tiered approach:

1. **Tier A (default, Fable can do this alone):** start from the CC0 base character that best matches Calvin's build. Recolor skin, hair, and clothes to match his photos (`assets/headshot.jpg`, `assets/model.glb` for proportions and colors). Swap or modify the hair mesh to match his hairstyle. Add era outfits by recoloring (UCLA hoodie blue/gold, blazer, Meta hoodie, quarter-zip, #13 jersey). Glasses or accessories only if they show up in the photos.
2. **Tier B (better likeness, needs Calvin for ~15 min):** generate a stylized low-poly model from his headshot with an image-to-3D tool (e.g., Meshy or Tripo, used through Calvin's own account). Decimate it to under 5k triangles in Blender (or `gltf-transform simplify`) and retarget the base character's animations onto it. Fable writes step-by-step instructions; Calvin runs the generation and drops the file into `assets-src/calvin/`.
3. **Fallback:** if Tier B doesn't look good, ship Tier A. A consistent toy-world Calvin beats an uncanny one.

Requirements either way: under 5k tris, one material, the same skeleton as the visitor characters so animations are shared, and recognizably Calvin from the default camera distance (hair, skin tone, build, signature #13).

The realistic Avaturn scan (`assets/model.glb`) isn't used in the world. Optional: it can appear on the résumé page as the profile model, as it does on today's site.

### 7.4 Asset pipeline

- Raw downloads go in `assets-src/<pack-name>/` with the pack's license file.
- `npm run assets` runs a script that, for every model used: strips unused nodes and animations, merges materials where possible, applies meshopt compression, and writes to `public/models/`.
- Photos for cards: resized to max 1600px on the long edge, WebP at quality ~80, written to `public/images/`. (The current `assets/` folder is 79MB, mostly unoptimized photos. Target: under 10MB total for card images.)
- **Budgets:** exterior scene total under 4MB of models (compressed), each interior under 1.5MB, each character under 400KB including animations.

---

## 8. Performance, Quality, and Accessibility

### 8.1 Performance targets

| Metric | Desktop | Mid-range mobile |
|---|---|---|
| First playable frame (cold, 4G) | < 3s | < 5s |
| Frame rate | 60fps | ≥ 45fps target, 30fps floor |
| First playable download (JS + plaza + 1 default trainer + Calvin) | < 3MB | < 3MB |
| Total exterior after background streaming | < 6MB | < 6MB |
| Draw calls (exterior) | < 150 | < 150 |
| Memory | < 300MB | < 200MB |

### 8.2 How to hit them

- **Load progressively:** spawn plaza + player + Calvin first, then the rest of the exterior in the background, then interiors only when the visitor approaches their door (prefetch within ~10 tiles).
- **Instance** repeated props (trees, lamps, fences, path tiles) with `InstancedMesh`.
- Cap pixel ratio at 2 on desktop and 1.5 on mobile.
- **Quality tiers** (auto-picked from a quick GPU benchmark on boot, user-overridable in the menu):
  - **High:** real-time shadows (2048), antialiasing, all ambient animations.
  - **Medium:** 1024 shadows, fewer ambient NPCs.
  - **Low:** blob shadows, no antialiasing, pixel ratio 1, no fog.
- Pause rendering when the tab is hidden, and when a full-screen card covers the canvas (render one frame and freeze).
- **Fallback trigger:** if WebGL2 isn't available, or the benchmark comes in under ~20fps on Low, show a friendly screen: "Your device is sitting this one out. Here's the fast version." It links to `/resume` and `/classic/`.

### 8.3 Accessibility

- **The résumé view is the accessible version.** `/resume` is semantic HTML: headings, lists, alt text, all content from Section 9. It's linked from the HUD, the title screen, the loading screen, and in a visually-hidden "Skip to résumé" link that comes first in tab order.
- All DOM UI (cards, dialogue, menus) is keyboard-navigable with visible focus rings, uses ARIA roles (`dialog`, `aria-modal`, focus trap, focus returns on close), and meets WCAG AA contrast.
- `prefers-reduced-motion`: disable camera lead and bob, confetti, and the screen shake in the finale. Use instant fades.
- No information conveyed by color alone (visited stations also get a ✓ icon).
- Audio is **off by default** (separate Music and Sound effects toggles). One click turns either on. Never autoplay with sound.
- Every interactable has a text label, so the prompt doubles as a screen-reader live-region announcement ("Rewards Store. Press E to open.").

### 8.4 SEO and sharing

- `index.html` includes a proper `<title>`, meta description, and Open Graph/Twitter card tags with a hero screenshot of the park (Fable captures it with Playwright).
- A `<noscript>` block with a short bio and a link to `/resume`.
- `/resume` is fully crawlable and holds all the real text content.
- `sitemap.xml` listing `/`, `/resume`, `/classic/`.

---

## 9. Content

### 9.1 Source of truth

All copy and media come from the current site. **Don't rewrite Calvin's copy.** Migrate it verbatim, with one exception: replace any em dashes with a comma or period, per the CLAUDE.md writing rules (there's one in `betmgm-overview.desc`).

| Content | Current location | New location |
|---|---|---|
| Career projects (11 entries) | `careerData` in `script.js` (lines ~221–406) | `src/content/career.ts` |
| Career list structure (companies, roles, dates, project order) | `index.html` career panel (lines ~106–224) | `src/content/career.ts` (a `companies` array) |
| Bio paragraphs, social links | `index.html` bio section (lines ~33–49) | `src/content/profile.ts` |
| Side builds (Sports Betting, Building with AI) | `index.html` projects panel (lines ~227–283) | `src/content/side-builds.ts` |
| Hobbies (Running, Chess, Basketball) | `index.html` hobbies panel (lines ~286–366) | `src/content/hobbies.ts` |

New copy needed (Fable drafts it, marks it `// TODO(calvin): review`, and lists every draft in `docs/CONTENT-EDITING.md`): NPC dialogue, signposts, badge names and descriptions, finale questions, the Workshop easter egg.

### 9.2 Project card overlay

The card is the most-viewed UI in the game, so it needs to look great.

- **Desktop:** a large panel (max 960px wide) slides up over a dimmed, blurred world. **Mobile:** a full-screen sheet that slides up, swipe down to dismiss.
- **Header:** company logo, project title, role line (the `company` field), and the station's badge-progress chip.
- **Body:** the `desc` paragraph, then `impact` bullets if any, then the `screens` tabs.
- **Screen types to support** (all exist in today's `careerData`; port the current rendering logic from `script.js` `renderDetail()` and its helpers):
  - `before` / `after` → a before/after comparison slider
  - `left` / `right` with `leftHover` → a side-by-side with hover/tap zoom
  - `gallery` → a swipeable carousel
  - `img` with `imgHover` → an image with a zoom spot
  - `bullets` → bullet list beside the gallery
  - `timeline` → a vertical timeline (UCLA internships)
  - `highlights` → buttons that jump to sibling projects. In the world, these say "Find it in the gym" and close the card while a floor arrow points to that station.
  - `sidePhoto` / `sideGallery` → a photo column
- Tapping an image opens the lightbox (as on today's site).
- **Footer:** "Next station →" (closes the card, points an arrow to the nearest unvisited station) and, on the last station, "Talk to Calvin for your badge."

### 9.3 Résumé view (`/resume`)

A clean, fast, single-page résumé, generated at build time from the same content files so it never drifts out of sync with the world:
- Name, title, bio, links, email.
- Experience: BetMGM → Meta → Deloitte → UCLA (reverse chronological). Each company shows its overview `desc` and each project's `desc` verbatim, plus `impact` bullets where they exist. No newly written summaries.
- Side builds and hobbies, short.
- A "Play the world →" button back to `/`.
- Visual style: the current site's dark theme tokens from `classic/style.css`, simplified.

### 9.4 Classic view (`/classic/`)

Move the current `index.html`, `style.css`, and `script.js` into `/classic/` unchanged (fix asset paths). It's a zero-effort fallback, and it preserves the old site.

---

## 10. The Finale: 1-on-1 vs Calvin

### 10.1 Flow

1. The visitor walks onto Calvin's Court. Lights flare on. Calvin spins the ball on a finger.
2. **Challenge dialogue:** "So you made it. First to the most buckets after 5 possessions. Every possession, I'm giving you a read. Get it right, you score. Get it wrong, I'm cooking you." → "Run it" / "Not yet."
3. **Transition** into "game mode": the camera moves to a broadcast angle (side-on, lower), a scoreboard drops in (pixel font: VISITOR 0 · CALVIN 0 · POSS 1/5), and the crowd murmurs.
4. **5 possessions.** Each one:
   1. A short setup line from Calvin ("Chess break. You're White. Find mate.").
   2. **Question card** slides up (Section 10.3). Untimed by default; an optional 20s shot clock is in settings.
   3. The visitor answers.
   4. **Correct:** the visitor's character drives and scores (dunk, layup, or a deep three on "hard" questions, worth 3 points; the rest are worth 2). A short "why" line explains the answer.
   5. **Wrong:** Calvin blocks the shot, then pulls up and buries one, scoring the question's point value (2, or 3 on hard). He reveals the right answer with a one-line explanation.
   6. The score updates and the next possession starts.
5. **Final whistle.** The higher score wins. Ties go to a sudden-death possession (one more question).
6. **Result screen:**
   - **Win:** "You beat Calvin." Park Legend badge, confetti, Calvin's line: "Respect. Let's actually talk." + LinkedIn / Email / X buttons.
   - **Lose:** e.g. "Calvin wins, 6–4." Calvin's line: "Good run. Come back and get your revenge. (Or just message me, that works too.)" + the same contact buttons + **Run it back** (draws a fresh set of 5).
   - Both show "You answered N/5" and a share button (copies the URL plus "I went N/5 vs Calvin at calvinkhoile.github.io").

### 10.2 Question sampling

- The library has **15 questions** across 5 categories: chess (4), hoops (4), points (3), betting (3), rivalry (1).
- **Possessions 1–4** are drawn from chess, hoops, points, and betting: at least 1 chess and 1 hoops, max 2 from any category, and no repeats from the visitor's previous game when possible (track the last set in localStorage).
- **Possession 5 is always the Rivalry Round** ("Game point. Let's see if you know my teams."). It's the light, fun closer.
- If the game is tied after 5, the sudden-death question is drawn from the unused chess/hoops/points/betting questions.
- Answer options are shuffled on every draw.
- **No questions about Calvin's personal achievements** (school records, awards, work stats). They read as bragging. The finale tests the visitor's instincts in Calvin's hobbies, not trivia about his résumé.

### 10.3 Question types and renderers

| Type | Renderer | How the visitor answers |
|---|---|---|
| `chess` | A 2D board rendered from a FEN string (DOM grid or SVG). Piece SVGs: prefer a CC0 set. Lichess hosts many piece sets with mixed licenses, so check each one. The classic "Cburnett" set is CC-BY-SA 3.0, which is allowed if it's attributed in ASSETS.md and on the résumé credits line | Pick from 3–4 move options (e.g., "Qxf7#"). On reveal, animate the move on the board |
| `play` (basketball read) | A top-down SVG half-court with Xs (defense) and Os (offense), from a positions JSON. The ball handler is highlighted | Tap/click the teammate to pass to (or pick from options on small screens). On reveal, draw the pass line |
| `choice` | Plain multiple choice with an optional image (e.g., a fake odds board for line shopping) | Pick 1 of 3–4 |
| `rivalry` | Three head-to-head matchups shown at once, each as two team cards side by side (team name + colors, no official logos) | Pick one team in each matchup. **All 3 must be right** to score. Reveal each pick one at a time for drama |

### 10.4 Question schema (`src/content/finale-questions.json`)

(The `//` comments below are annotations only. The real file is plain JSON, and a Vitest test validates every entry against this shape.)

```json
{
  "id": "chess-backrank",
  "category": "chess",            // chess | hoops | points | betting | rivalry
  "type": "chess",                // chess | play | choice | rivalry
  "matchups": null,               // for type=rivalry: [{ "a": "UCLA", "b": "USC", "answer": "UCLA" }, ...]
  "difficulty": "normal",         // normal (2 pts) | hard (3 pts)
  "setup": "Chess break. You're White. Mate in one.",
  "prompt": "Find the move.",
  "fen": "6k1/5ppp/8/8/8/8/3r1PPP/4R1K1 w - - 0 1",
  "play": null,                   // for type=play: { offense: [...], defense: [...], ball: "O1" }
  "image": null,                  // optional, for type=choice
  "options": ["Re8#", "Re7", "h3", "Kf1"],
  "answer": "Re8#",
  "explain": "Back-rank mate. Black's own pawns trap the king.",
  "calvinWin": "Back rank. Gets everyone.",
  "calvinLose": "Yeah, that's the one."
}
```

`play` positions use half-court coordinates (0–50 wide, 0–47 deep, hoop at 25, 5.25). Example:

```json
"play": {
  "offense": [{"id": "O1", "x": 25, "y": 30, "ball": true}, {"id": "O2", "x": 3, "y": 2}, {"id": "O3", "x": 47, "y": 2}, {"id": "O4", "x": 18, "y": 10}, {"id": "O5", "x": 34, "y": 22}],
  "defense": [{"id": "X1", "x": 25, "y": 27}, {"id": "X2", "x": 10, "y": 8}, {"id": "X3", "x": 44, "y": 5}, {"id": "X4", "x": 19, "y": 8}, {"id": "X5", "x": 32, "y": 20}],
  "arrows": [{"from": "X2", "to": [12, 12], "style": "dashed"}],
  "answer": "O2"
}
```

### 10.5 Starter question library (15)

**Calvin must review every question before launch.** Fable must check every chess position with `chess.js` in a unit test: the position is legal, the answer is legal and does what the explanation claims, and no distractor also works. (All four positions below were already checked with chess.js 1.0.0. Each answer is the only mate or the only fork among the options.) Write all SAN moves with full disambiguation where needed (chess.js rejects ambiguous moves).

**Chess (4)**
1. **Back-rank mate** (normal). FEN `6k1/5ppp/8/8/8/8/3r1PPP/4R1K1 w - - 0 1`. Answer **Re8#**. Distractors: Re7, h3, Kf1.
2. **Scholar's mate** (normal). After 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6??, FEN `r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4`. Answer **Qxf7#**. Distractors: Qxe5+, Bxf7+, Qh4.
3. **Rook ladder** (normal). FEN `k7/7R/8/8/8/8/8/6RK w - - 0 1`. Answer **Rg8#** (one rook cuts off the 7th rank, the other mates on the 8th). Distractors: Rh8+, Rb7, Kg2.
4. **Knight fork** (hard). FEN `6k1/3q1p1p/8/8/4N3/8/5PPP/6K1 w - - 0 1`. Answer **Nf6+** (forks king and queen). Distractors: Nc5, Nd6, Ng5. Fun detail for the explanation: after Nc5 or Ng5, Black has Qd1 mate.

**Basketball reads (4)** (positions authored in JSON by Fable, sanity-checked by Calvin)
5. **Help defense leaves the corner** (normal). The ball handler drives baseline, X2 helps off the weak-side corner. Answer: kick to the **weak-side corner shooter (O2)**.
6. **Pick-and-roll, defense blitzes** (normal). Both defenders jump the ball handler on the screen. Answer: hit the **rolling big (O5)** in the pocket for a 4-on-3.
7. **2-on-1 fast break** (hard). The lone defender commits to the ball. Answer: **dump it to the wing (O2)** for the layup. Explain: "Make the defender pick. Whoever he leaves gets the ball."
8. **Denial, backdoor** (normal). The wing (O3) is overplayed hard in the passing lane and cuts backdoor to the rim. Answer: **hit the backdoor cutter (O3)**. Explain: "When they deny the pass, go behind them."

**Points and loyalty (3)**
9. **Best use of points** (normal). "You've got 100k transferable credit card points. Usually the highest-value move?" Answer: **transfer to an airline or hotel partner for premium travel.** Distractors: cash back at 1¢, buy gift cards, spend on Amazon at checkout.
10. **Status for decades** (hard). "Which airline gave away 25 years of elite status to people who completed its challenge?" Answer: **JetBlue.** Distractors: Delta, United, Southwest. Explain (Calvin's line): "I did it. Mosaic 1 until 2051."
11. **The big bonus** (normal). "Fastest way to earn a big chunk of points at once?" Answer: **a credit card welcome bonus.** Distractors: everyday spending, an airline shopping portal, flying more.

**Sports betting (3)**
12. **Line shopping** (normal). Image: an odds board for the same bet: Book A −110, Book B +105, Book C −115. "Which book?" Answer: **Book B (+105).** Explain: "Same bet, better price. Always shop the line."
13. **Do you need to know sports?** (hard). "To make money sports betting, do you need to know a lot about sports?" Options: "Yes, you need to be an expert" / "No. Learning line movement and price shopping matters more" / "Only for parlays" / "Only for live betting". Answer: **No. Line movement and price shopping matter more.** Explain: "Sports knowledge can help, but the edge is in the prices, not the picks."
14. **Reading odds** (normal). "You bet $100 at +200 and win. How much profit?" Answer: **$200.** Distractors: $100, $150, $300.

**Rivalry Round (1, always possession 5)**
15. **Know my teams** (normal, 2 pts). Setup: "Game point. Let's see if you know my teams." Three matchups, pick the team Calvin roots for in each. All 3 right = bucket.
    - UCLA vs USC → **UCLA** (football and basketball)
    - Lakers vs Knicks → **Lakers**
    - Rams vs 49ers → **Rams**
    - Explain: "UCLA football and basketball first, then the Lakers, then the Rams." Team cards use names and team colors only, no official logos.

### 10.6 Court animations (keep it cheap)

Use the shared character skeleton. Needed clips: idle-dribble, drive, layup/dunk, jump-shot, block, celebrate, slump. If a clip isn't in the CC0 library, fake it with code: tween the character's position along a path and play a jump. The ball is a separate mesh parented to the hand bone, then flies along a scripted arc (quadratic Bézier) to the hoop. Net "swish" is a quick vertex wobble or a scale pulse. The goal is readable and fun, not realistic.

---

## 11. Audio

- **Two independent toggles on the right edge of the HUD:** Music and Sound effects (see 6.7). Both start off and each choice is remembered in localStorage. Turning either one on counts as the user gesture that unlocks audio.
- Also in the menu: volume sliders for each, for people who want it quieter rather than off.
- **Music:** a chill exterior loop, a slightly different loop per gym (crossfade on enter/exit, ~800ms), and an upbeat track for the finale.
- **SFX:** footsteps (subtle, surface-aware: grass vs concrete vs gym floor), UI blips (prompt appear, dialogue advance, card open/close), the badge fanfare, door whoosh, basketball dribble/swish/rim/block, crowd cheer/groan.
- Unlock the audio context on the first user gesture (howler handles this).

---

## 12. Milestones

Build on the `world` branch. Each milestone ends with a Playwright smoke test passing at **1440×900 desktop** and **390×844 mobile (touch emulation)**, plus a short note in `docs/PROGRESS.md` with screenshots. Calvin reviews at the ★ checkpoints before Fable continues.

| # | Milestone | Done when |
|---|---|---|
| **M0** | **Project setup** | Vite + TS + three.js scaffold. On `main`: a Pages workflow that deploys the current site unchanged, then Calvin switches the Pages source (3, step 1). On `world`: current site copied to `public/classic/` and still works, and CI runs build + tests on every push without deploying. LAN phone preview (`vite --host`) documented. `npm run dev`, `build`, `test`, `assets` all work. `CLAUDE.md` updated for the new stack |
| **M1** | **Graybox movement** ★ | Gray-box exterior with block buildings at the right positions. A capsule player moves with keyboard, joystick, and click/tap-to-move. Camera follows. Collision slides along walls. Debug overlay works. **Feels good on a real phone.** Calvin tests on his own phone at this checkpoint, because the feel is the whole game |
| **M2** | **Exterior art pass** | CC0 assets placed. Gym facades, path, plaza, Workshop, Blacktop, court. Lighting, shadows, quality tiers. Visitor characters (4 looks) animated (idle/walk/run). Loading screen + title + character select. Performance budgets met on Low/Medium/High |
| **M3** | **Interaction + dialogue + cards** ★ | Proximity prompts, the dialogue system, Calvin NPC at spawn with the intro. The project card overlay supports every screen type from 9.2, with all content migrated. Door transitions into one interior (**BetMGM** first, since it has the richest content) with all 4 stations working |
| **M4** | **All gyms + badges** | UCLA, Deloitte, and Meta interiors. Gym leaders, visited states, badge ceremony, badge case, save/load, deep links. Workshop and Blacktop stations |
| **M5** | **Calvin's avatar** ★ | Tier A Calvin built and shown in all outfits. Instructions for Tier B handed to Calvin. Calvin approves the likeness (or picks Tier B and supplies the model) |
| **M6** | **Finale** ★ | Court scene, game state machine, all 4 renderers (chess, play, choice, rivalry), 15 questions loaded and validated (chess.js tests pass), animations, result screens, Run it back, share. Calvin reviews every question |
| **M7** | **Polish** | Audio, minimap, haptics, reduced motion, accessibility pass (axe-core in Playwright: zero serious violations on cards, dialogue, menus, résumé), `/resume` generated from content, SEO tags, OG image, `<noscript>`, WebGL fallback screen |
| **M8** | **Launch** ★ | Calvin's final review on desktop + iPhone + Android. Pages has been on GitHub Actions since M0. Update the workflow on `world` to build and deploy `dist/`, then merge `world` → `main`. Verify the live site. Tag `v1.0` |

---

## 13. Testing Checklist (before M8)

- [ ] Fresh visit: loading → title → character select → intro → walk to UCLA in under 60s.
- [ ] Every station in every gym opens the right card with correct images (no 404s; Playwright checks all image requests).
- [ ] Earning all 6 badges works; reload keeps them; reset clears them.
- [ ] Every deep link lands in the right place.
- [ ] Finale: 10 automated runs, each drawing a valid set of 5 that follows the category rules (possession 5 is always the Rivalry Round). Win, lose, and tie paths all reachable. Use a `?seed=` query param (debug builds only) so tests can force a specific draw and reach a tie (e.g., a 3-pointer vs two 2-pointers can't tie, so the fixture must pick matching point values).
- [ ] Keyboard-only: complete one gym and the finale without a mouse.
- [ ] Mobile: joystick, A button, tap-to-move, card swipe-to-dismiss, landscape and portrait.
- [ ] iOS Safari, Android Chrome, desktop Chrome/Safari/Firefox/Edge.
- [ ] Low tier holds 30fps on the oldest available test device.
- [ ] `/resume` and `/classic/` work with JavaScript disabled (`/classic/` can degrade; `/resume` must be complete).
- [ ] WebGL disabled → fallback screen with working links.
- [ ] Lighthouse on `/resume`: Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95.
- [ ] `docs/ASSETS.md` lists every third-party file; no unlicensed assets.

---

## 14. What Calvin Needs to Provide

| Item | When | Notes |
|---|---|---|
| Review the M1 movement feel on his phone | M1 | The most important checkpoint |
| Approve or edit the draft NPC dialogue and signposts | M3–M4 | Listed in `docs/CONTENT-EDITING.md` |
| Copy for the Workshop "how this site was built" easter egg | M4 | A few sentences |
| Avatar: approve Tier A, or run the Tier B generation (~15 min) | M5 | Fable provides step-by-step instructions |
| Review all 15 finale questions and the basketball diagrams | M6 | Add or swap any questions |
| Mixamo animation downloads (only if CC0 clips fall short) | M2 or M6 | Needs his Adobe login |
| Switch Pages source to GitHub Actions (after Fable's M0 workflow is on `main`) | M0 | Repo Settings → Pages → Source. Live site doesn't change |
| Download click-through asset packs into `assets-src/` | M2 | Fable gives a list with URLs |
| Any paid asset pack purchase (optional) | M2 | Only if CC0 packs don't cut it |

---

## 15. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| **Scope.** A 3D world is a lot of game for a portfolio | Milestones are cumulative and each one is shippable. If time runs out after M4, ship with a simple trivia finale. The graybox-first approach means the hard parts (feel, performance) get proven before art time is spent |
| **Mobile performance** | Budgets in 8.1, quality tiers, instancing, progressive loading, and testing on real devices at M1 and M2, not at the end |
| **Calvin's likeness looks uncanny** | Tiered avatar approach (7.3). Stylized wins over realistic |
| **CC0 packs don't share a style** | Pick one primary family (Kenney *or* KayKit) for buildings and characters, and only fill gaps from others. Unify with a shared palette and the same lighting |
| **Recruiters bounce** | The Résumé button is always visible. Title screen offers it. Fallback for weak devices. Deep links |
| **Content drifts between the world, résumé, and classic** | The world and the résumé read the same content files. Classic is frozen as an archive |
| **Chess or basketball answers are wrong** | chess.js validation in tests. Calvin reviews every basketball diagram |
| **Deploy cutover breaks the live site** | Build on the `world` branch. `main` serves the current site until M8. Rollback = revert the merge |

---

## 16. Future (v2, don't build in v1)

**Guestbook: "I visited Calvin's park."** Visitors leave their name (and optionally a one-line note) and see that they're on the wall. Ideas for where it lives: a signable board in the Spawn Plaza, and a "Sign the wall" prompt on the finale result screen. It needs a small backend or hosted store (e.g., a serverless function with a KV store, or a moderated form service) plus moderation for names. Scope it as its own plan once v1 ships.
