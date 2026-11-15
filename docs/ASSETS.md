# Third-Party Assets

Every third-party file that ships in the site, with its source and license. Raw packs live in `assets-src/` (gitignored). `npm run assets` builds the optimized files listed here from `scripts/assets.manifest.json`.

## 3D models

| Shipped file | Contents | Source pack | Author | License |
|---|---|---|---|---|
| `public/models/exterior.glb` | Palms, trees, bushes, rocks, flowers, lily pads, signpost, pot | Nature Kit (kenney.nl/assets/nature-kit) | Kenney | CC0 1.0 |
| `public/models/exterior.glb` | Street lamp, traffic cones | City Kit (Roads) (kenney.nl/assets/city-kit-roads) | Kenney | CC0 1.0 |
| `public/models/exterior.glb` | Planter | City Kit (Suburban) (kenney.nl/assets/city-kit-suburban) | Kenney | CC0 1.0 |
| `public/models/exterior.glb` | Office tower (Deloitte gym), parasol, skyline buildings | City Kit (Commercial) (kenney.nl/assets/city-kit-commercial) | Kenney | CC0 1.0 |
| `public/models/trainer-a.glb` to `trainer-d.glb` | Base bodies and hairstyles, simplified and recolored by region | Universal Base Characters, Standard (quaternius.com) | Quaternius | CC0 1.0 |
| `public/models/trainer-anims.glb` | Idle, walk, jog, sprint, talk, interact clips | Universal Animation Library, Standard (quaternius.com) | Quaternius | CC0 1.0 |

Changes made to the originals: nature kit foliage and wood recolored, models merged into one file, characters reduced to under 5k triangles and re-UV'd onto a palette, animations stripped of finger and scale tracks. CC0 allows all of this with no attribution required.

Gym exteriors, courts, fences, signs, and the fountain are built in code (`src/world/art.ts`), not from third-party files.

## Logos (signage only)

| Shipped file | Source | Notes |
|---|---|---|
| `public/images/logos/ucla.webp` | `public/classic/assets/logos/UCLA-Logo-transparent.png` | Trademarks of their owners. Used on gym signage the same way the classic site uses them |
| `public/images/logos/deloitte.webp` | `public/classic/assets/logos/deloitte.png` | Same |
| `public/images/logos/meta.svg` | `public/classic/assets/logos/meta.svg` | Same |
| `public/images/logos/betmgm.webp` | `public/classic/assets/logos/betmgm.png` | Same |

## Fonts

| Font | Source | License |
|---|---|---|
| Inter | Google Fonts | SIL Open Font License 1.1 |
| Lilita One | Google Fonts | SIL Open Font License 1.1 |

## Downloaded but not shipped yet

Kenney Furniture Kit, Impact Sounds, Interface Sounds (CC0), Quaternius Ultimate Nature (CC0). They'll be listed above when something from them is used.
