# CLAUDE.md

Calvin Le's personal website. Static portfolio served by GitHub Pages at https://calvinkhoile.github.io.

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

No framework, no build step, no package manager.

```
index.html   ← all markup: nav, bio/hero (3D model), section grid, section panels, lightbox
style.css    ← all styles; design tokens on :root; breakpoints at 860 / 600 / 380px
script.js    ← section open/close/switch, careerData (company content), projects, hobby carousel, lightbox
assets/      ← images grouped by company/topic (betmgm/, meta/, deloitte/, hobbies/, logos/)
```

- **Three.js** (0.165.0 via import map + jsDelivr) renders the hero 3D model in an inline `<script type="module">` at the bottom of `index.html`.
- **Phosphor Icons** (2.1.1 via unpkg) for icons.
- Fonts: Inter (body) and Roboto (display) from Google Fonts.
- Career content lives in the `careerData` object in `script.js`, not in the HTML. Edit there for company copy and photos.
- Section IDs: `career`, `projects` (labeled MyBadges), `hobbies` (labeled MyPark).

## Design

The live site is a **PlayStation-inspired dark theme**: black canvas (`--bg: #000`), white ink, PlayStation Blue accent (`--accent: #0070d1`), translucent white hairlines. Tokens are defined at the top of `style.css`. Use them, don't inline hex values.

`.kiro/steering/design.md` describes a **Cursor** cream/orange design system. That is not what the site uses. Treat `style.css` tokens as the source of truth; only reference `design.md` if I explicitly ask to move toward that look.

Rules:
- Always check mobile. Most recent bugs have been mobile layout issues (see git log). Test at 375px and around 860px.
- Keep the hairline-and-surface depth style; avoid heavy drop shadows.
- Asset filenames have spaces and mixed-case extensions (`.PNG`, `.JPG`). GitHub Pages is case-sensitive, so match paths exactly.

## Running Locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Serving (vs. opening the file directly) is required for the ES module import map and the 3D model to load.

## Git & Deploy

- Pushing to `main` deploys via GitHub Pages (usually live within 1–2 minutes). There's no MR process here (unlike product-team-os).
- Only commit or push when I ask.
- Commit messages: short, imperative, describe the user-visible change (e.g., "Fix mobile career panel staying open after collapsing a company").
- Remote: `github.com/calvinkhoile/calvinkhoile.github.io`.
