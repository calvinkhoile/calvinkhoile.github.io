# Editing Content

Everything a visitor reads lives in `src/content/`. Edit the text there, save, and the world, the cards, and (from M7) the résumé page all pick it up. No game logic to touch.

| File | What's in it | Source |
|---|---|---|
| `career.ts` | Company list and all 11 career entries (overviews and projects) | Migrated verbatim from the classic site |
| `profile.ts` | Name, title, bio paragraphs, links, email | Migrated verbatim |
| `side-builds.ts` | Sports Betting, Building with AI | Migrated verbatim |
| `hobbies.ts` | Running, Chess, Basketball and their photo slices | Migrated verbatim |
| `dialogue.ts` | Every NPC line, sign, and toast | **Drafts, see below** |
| `stations.ts` | Which station opens which piece of content | Wiring, rarely edited |

Rules that apply to all of it: no em dashes, no banned words, real numbers (see `CLAUDE.md`).

**Changes made during migration:** three em dashes became a comma, a period, and a colon (`betmgm-overview` description, bio paragraph two, the coaching description). Image paths now point at optimized copies in `public/images/`. Nothing else was reworded.

## Photos

Card photos are optimized copies of the originals in `public/classic/assets/`. To add or replace one, drop the original into the matching folder there, run `npm run assets`, and reference it as `/images/<folder>/<name>.webp` (lowercase, spaces become dashes).

## Drafts waiting on Calvin

Every item here was written for you and needs your review. Each is marked `TODO(calvin)` in the code.

### Dialogue (`src/content/dialogue.ts`)

| Key | Where it plays | Draft |
|---|---|---|
| `plaza.intro` | Calvin walks up on a first visit | "Hey! I'm Calvin. Welcome to my park." / "Every building here is a stop in my career. Start at UCLA and work your way up." / "When you're done, come find me at my court. I'll be waiting with a ball." (from the plan) |
| `plaza.again` | Talking to plaza Calvin again | "Back already? What do you need?" |
| `plaza.explore` | Choosing "I'll explore" | "Cool. Résumé kiosk is right there if you're in a rush." (from the plan) |
| `plaza.tourStart` | Choosing "Show me around" | "Follow me. First stop is where it all started." |
| `plaza.tourEnd` | Arriving at the UCLA door | "UCLA. Best years of my life. Head in, I'll be back at the plaza." |
| `plaza.signpost` | The plaza signpost | Directions to every area |
| `betmgm.leader` | BetMGM gym leader, first talk | "Welcome to BetMGM. This is where I work now, on the rewards program." / "Four stations in here. Hit them all, then come back and see me." |
| `betmgm.leaderDone` | BetMGM gym leader, all stations visited | "That's all four. You know this place better than most new hires." |
| `door.locked` | Doors to gyms not built yet | "Still under construction. This one opens in the next build." (temporary, goes away in M4) |
| `blacktop.chessTeaser` | Second chess table | Points the visitor at the finale |
| `workshop.diorama` | Workshop easter egg | **Placeholder. Needs a few sentences from you on how this site was built** |
| `toasts.welcomeBack` | Returning visitors | "Welcome back. Your progress is saved." |

`deloitte.sushi` is your own sentence from the Deloitte overview, not a draft.

### Other drafts

| What | Where | Draft |
|---|---|---|
| Trainer names | `src/world/looks.ts` | Rookie, Playmaker, Sixth Man, Sharpshooter |
| Loading tips | `src/ui/screens.ts` | Three tips about the résumé button, tap-to-walk, and sprinting |
| Station labels | `src/content/stations.ts` | Prompt names such as "Partnership Desk", "AI Lab", "Voice of the Customer" |
| Card footer lines | `src/main.ts` | "Next station →", "Talk to Calvin for your badge." |
