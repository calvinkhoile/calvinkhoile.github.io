# CLAUDE.md

Calvin Le's personal website, served by GitHub Pages at https://calvinkhoile.github.io. The live site is a static portfolio. The `world` branch is rebuilding it as MyPark, a small 3D world you walk around in.

## Who I Am

Senior Product Manager at BetMGM, leading end-to-end Personalization (Player Experience) and BetMGM's AI initiative. Before that: Meta, Deloitte, UCLA. The site tells that story (Career), shows what I've built (MyBadges), and covers life outside work (MyPark: basketball, marathons, chess, coaching).

I'm a PM, not a full-time engineer. Explain non-obvious technical tradeoffs in plain terms, but don't over-explain basics.

## How to Work With Me

- **Be honest.** Data-first, but I trust strong qualitative signals. If a design or copy choice is weak, say so. Honest pushback beats validation.
- **No hedging.** Skip "perhaps," "you might consider." Just say the thing.
- **No scope creep.** Don't add sections, features, or refactors I didn't ask for. Suggest them in one line if they're worth it.
- **Don't ask permission for small decisions.** Ask when context is genuinely missing or a choice changes what the site says about me.
- **"quick take"** = 2–3 sentences, no preamble. **"review this"** = be critical, lead with what's weak.
- Plan before multi-file or structural changes.

## Writing Rules (for all site copy)

This is a recruiter- and hiring-manager-facing site. Copy should sound like me: casual but sharp, specific, human.

- Short, specific, real numbers and real outcomes. Lead with impact.
- Vary sentence length. Contractions and the occasional fragment are fine.
- **Never use em dashes.** Use commas, periods, or parentheses.
- Avoid negative parallelism ("Use X," not "Don't use Y, use X").
- Banned words: delve, leverage, utilize, unlock, harness, streamline, robust, cutting-edge.
- Write so AI detectors wouldn't flag it.
- Don't publish confidential BetMGM details (unreleased roadmap, internal metrics not cleared for public use, internal team names beyond what's already on the site). Flag anything borderline before adding it.

## Project Structure

Two things live in this repo, depending on the branch.

**`main` (live site):** the classic static site. `index.html`, `style.css`, `script.js`, `assets/`. No build step. Deployed by `.github/workflows/deploy.yml`, which uploads only those files.

**`world` (in progress):** MyPark, a 3D world built with Vite + TypeScript + three.js. Plan: `docs/mypark-world-plan.md`. Progress log: `docs/PROGRESS.md`. Goes live at M8 when `world` merges into `main`.

```
index.html          ← world entry (canvas + UI root)
src/
  main.ts           ← boot: capability check, scene, game loop
  engine/           ← renderer, camera, input (keyboard/mouse/touch), grid (collision + A*), debug overlay
  world/            ← player, NPCs, interactions, exterior and interior art, maps/ (one data file per scene)
  finale/           ← the 1-on-1: question draw rules, renderers, court animations, game flow
  ui/               ← DOM overlays: cards, dialogue, prompts, title and select screens, styles/
  content/          ← all copy: career, profile, side builds, hobbies, dialogue, station registry
public/
  classic/          ← the old site, frozen (index.html, style.css, script.js, assets/). Served at /classic/
  models/           ← optimized .glb output of `npm run assets`
tests/              ← Vitest unit tests; tests/e2e/ Playwright smoke tests
scripts/            ← asset pipeline + its manifest
assets-src/         ← raw downloaded asset packs (gitignored)
docs/               ← plan, PROGRESS.md, ASSETS.md (licenses), CONTENT-EDITING.md (how to edit copy, list of drafts)
```

- Stack: Vite 5, TypeScript (strict), three.js, Vitest, Playwright. All versions pinned exact in `package.json`. No React, no physics engine, no game engine.
- Maps are code (`src/world/maps/*.ts`): zones, props, doors, interactables. Blocking props stamp the collision grid automatically.
- UI overlays are plain DOM + CSS over the canvas.
- Site copy for the world lives in `src/content/`, migrated verbatim from the classic site. Edit copy there, never inside UI or game code. New draft copy gets a `TODO(calvin)` and a row in `docs/CONTENT-EDITING.md`.
- Classic site details (still true inside `public/classic/`): Three.js 0.165.0 via import map, Phosphor Icons, career content in the `careerData` object in `script.js`, section IDs `career` / `projects` / `hobbies`. Don't edit classic files; they're an archive.

## Design

The classic site and the world's DOM UI share a **PlayStation-inspired dark theme**: black canvas (`--bg: #000`), white ink, PlayStation Blue accent (`--accent: #0070d1`), translucent white hairlines. Tokens are defined at the top of `public/classic/style.css` and mirrored in `src/ui/styles/main.css`. Use them, don't inline hex values. The 3D world's own palette is in the plan (section 7.1).

`.kiro/steering/design.md` describes a **Cursor** cream/orange design system. That is not what the site uses. Treat the `style.css` tokens as the source of truth; only reference `design.md` if I explicitly ask to move toward that look.

Rules:
- Always check mobile. Most recent bugs have been mobile layout issues (see git log). Test at 375px and around 860px.
- Keep the hairline-and-surface depth style; avoid heavy drop shadows.
- Asset filenames have spaces and mixed-case extensions (`.PNG`, `.JPG`). GitHub Pages is case-sensitive, so match paths exactly.

## Running Locally

```
npm install
npm run dev        # http://localhost:5173 (classic site at /classic/)
npm run dev:lan    # adds a LAN URL for phone testing on the same Wi-Fi
npm run build      # typecheck + build to dist/
npm test           # unit tests
npm run test:e2e   # Playwright smoke tests (desktop + mobile viewports)
npm run assets     # optimize models from assets-src/ into public/models/
```

Debug URL params: `?debug=1` (grid, collision, FPS), `?yaw=0`, `?zoom=1.3`.

On `main`, the classic site still runs with `python3 -m http.server 8000`.

## Git & Deploy

- Pushing to `main` deploys via GitHub Actions (`.github/workflows/deploy.yml`, usually live within 1–2 minutes). There's no MR process here (unlike product-team-os).
- World work happens on the `world` branch. CI (`ci.yml`) builds and tests every push there and never deploys. Don't merge `world` into `main` without my go-ahead.
- Only commit or push when I ask.
- Commit messages: short, imperative, describe the user-visible change (e.g., "Fix mobile career panel staying open after collapsing a company").
- Remote: `github.com/calvinkhoile/calvinkhoile.github.io`.
