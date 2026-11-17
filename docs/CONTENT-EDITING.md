# Editing Content

Everything a visitor reads lives in `src/content/`. Edit the text there, save, and the world, the cards, and (from M7) the résumé page all pick it up. No game logic to touch.

| File | What's in it | Source |
|---|---|---|
| `career.ts` | Company list and all 11 career entries (overviews and projects) | Migrated verbatim from the classic site |
| `profile.ts` | Name, title, bio paragraphs, links, email | Migrated verbatim |
| `side-builds.ts` | Sports Betting, Building with AI | Migrated verbatim |
| `hobbies.ts` | Running, Chess, Basketball and their photo slices | Migrated verbatim |
| `dialogue.ts` | Every NPC line, sign, and toast | **Drafts, see below** |
| `extras.ts` | One-off stops (the JetBlue note) | Calvin's own words |
| `finale-questions.json` | The 15 questions for the 1-on-1 | **Drafts, see the table at the bottom** |
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
| `<gym>.leader` | Gym leader, first talk (ucla, deloitte, meta, betmgm) | Two lines each: a welcome and what's in the room. Example: "Deloitte. First real job, and where I figured out I wanted to build products." |
| `<gym>.leaderDone` | Gym leader, every station visited (awards the badge) | One line each. Example: "That's all of UCLA. Go Bruins. This one's yours." |
| `<gym>.leaderAgain` | Gym leader, after the badge | One line each, pointing at the next gym. Example: "Ship-It Badge is yours. BetMGM is at the top of the path." |
| `toasts.twoBadges`, `toasts.fourBadges` | "Text from Calvin" at two and four badges | The two lines from the plan |
| `court.challenge`, `court.later` | Calvin at his court | The challenge lines from the plan, and "I'll be here. Ball's not going anywhere." |
| `door.locked` | Safety net for a door with no room behind it | Not reachable now that all four gyms exist |
| `toasts.welcomeBack` | Returning visitors | "Welcome back. Your progress is saved." |

`deloitte.sushi` is your own sentence from the Deloitte overview, not a draft.

### Other drafts

| What | Where | Draft |
|---|---|---|
| Badge names and how-to-earn lines | `src/content/badges.ts` | Bruin, Consultant, Ship-It, High Roller, Explorer, Park Legend (names from the plan) |
| Trainer names | `src/world/looks.ts` | Rookie, Playmaker, Sixth Man, Sharpshooter |
| Loading tips | `src/ui/screens.ts` | Three tips: tap-to-walk, sprinting, and the shot meter (the résumé tip was dropped, since the loading screen now has a résumé button) |
| Loading screen | `index.html` | "Calvin Le's / MyPark", "Warming up the park", "In a hurry? Open the résumé" |
| Court callouts | `src/main.ts`, `src/finale/court-scene.ts` | GREEN, BUCKET, BRICK, HEATING UP, ON FIRE, SPLASH, SLAM, REJECTED, COOKED, GAME, plus "Perfect release", "Slightly early", "Way late" |
| Shootaround how-to | `src/main.ts` | "Hold Shoot, let go at the top of the meter." (touch) / "Hold G, let go at the top of the meter." |
| Slow-device notice | `src/content/dialogue.ts` (`toasts.slow`) | "Running slow on this device? The résumé button up top is the fast version." |
| Intro shortcut | `src/content/dialogue.ts` (`plazaChoices`) | "Show me your latest work" (jumps to the BetMGM gym, Rewards Store open) |
| Badge how-to lines | `src/content/badges.ts` | "See every stop in the <gym> gym." (the old lines said to talk to Calvin, which isn't needed) |
| Result screen buttons | `src/finale/game.ts` | Added "Résumé"; "Email" is now "Copy email" |
| Station labels | `src/content/stations.ts` | Prompt names such as "Partnership Desk", "AI Lab", "Voice of the Customer" |
| Photo captions | `src/content/stations.ts` | "BetMGM Product Summit." and "Meta HQ." are placeholders. Write the captions you want |
| Card hints | `src/ui/card.ts` | "Drag the slider to compare before and after", "Tap A or B to zoom in" |
| Leader choices | `src/content/dialogue.ts` | "Finish this gym" / "Walk me through it" / "I'll look around" |
| Tracker | `src/ui/tracker.ts` | "Skip the walk: see all N →" |
| Station pop-up footer | `src/main.ts` | "Next: <station> →", "Finish" |
| Card footer lines | `src/main.ts` | "Next station →", "Talk to Calvin for your badge." |

## Finale questions (`src/content/finale-questions.json`)

Review every one before launch. To change a question, edit its entry: `setup` is Calvin's lead-in, `prompt` is the question, `options` are the choices, `answer` must match one option exactly, `explain` shows after answering, `calvinWin` is his line when the visitor misses, `calvinLose` when they score. `difficulty: "hard"` makes it worth 3. Run `npm test` after editing: it rejects malformed entries and wrong chess answers.

| # | Category | Pts | Prompt | Answer |
|---|---|---|---|---|
| 1 | chess | 2 | Find the move. | Re8# |
| 2 | chess | 2 | Finish it. | Qxf7# |
| 3 | chess | 2 | Mate in one. | Rg8# |
| 4 | chess | 3 | Find the fork. | Nf6+ |
| 5 | hoops | 2 | Who's open? | O2 |
| 6 | hoops | 2 | Where does the ball go? | O5 |
| 7 | hoops | 3 | What's the play? | O2 |
| 8 | hoops | 2 | Who gets it? | O3 |
| 9 | points | 2 | You've got 100k transferable credit card points. Usually the highest-value move? | Transfer to an airline or hotel partner for premium travel |
| 10 | points | 3 | Which airline gave away 25 years of elite status to people who completed its challenge? | JetBlue |
| 11 | points | 2 | Fastest way to earn a big chunk of points at once? | A credit card welcome bonus |
| 12 | betting | 2 | Which book do you take it at? | Book B |
| 13 | betting | 3 | To make money sports betting, do you need to know a lot about sports? | No. Learning line movement and price shopping matters more |
| 14 | betting | 2 | You bet $100 at +200 and win. How much profit? | $200 |
| 15 | rivalry | 2 | Pick the team I root for in each matchup. All three to score. | UCLA, Lakers, Rams |

The four chess answers are verified by a chess engine in the tests. The basketball diagrams (player positions in `play`) were drawn by me from the plan's descriptions and need your check: does each picture actually show the read?
