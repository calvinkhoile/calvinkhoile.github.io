# Calvin's Avatar: Tier B (better likeness)

Tier A is what's in the park now: the shared base character recolored into six outfits. It's consistent with the trainers, but the body is the stock muscular base and the face is generic. Tier B swaps in a stylized model generated from your photo. It takes about 15 minutes of your time.

See the current one at `http://localhost:5173/?lineup=1` (add `&close=1` for the face).

## What you do

1. **Pick the tool.** Meshy (meshy.ai) or Tripo (tripo3d.ai). Both have free tiers and an image-to-3D mode. Use your own account.
2. **Upload a photo.** `public/classic/assets/headshot.jpg` works. A full-body photo, standing straight with arms slightly away from your sides, gives a much better result than a headshot, because the tool has to invent everything it can't see.
3. **Settings that matter:**
   - Style: stylized / cartoon / low-poly, not realistic.
   - Pose: **T-pose or A-pose** if the tool offers it. This matters most, since the model gets a skeleton afterwards.
   - Topology: quad or "game ready" if offered. Target polycount: the lowest option (10k or under is fine, it gets reduced again).
   - Texture: on.
4. **Generate two or three** and pick the one that looks most like you from a distance. Hair shape and build matter more than the face at the park's camera distance.
5. **Download as GLB** (or FBX if GLB isn't offered).
6. **Drop the file in** `assets-src/calvin/` (create the folder) and tell me its name.

## What I do with it

1. Reduce it to under 5k triangles.
2. Fit it to the same 65-bone skeleton the trainers use, so every animation already in the park works on it.
3. Rebuild the six outfits on it (plaza, UCLA, Deloitte, Meta, BetMGM, court) and regenerate the lineup for you to compare against Tier A.

## If it doesn't look good

Tier A ships. A consistent toy-world Calvin beats an uncanny one. A middle option is a Blender pass on Tier A (slimmer build, softer brows, real shoes, a jacket collar), which needs nothing from you.

## Licensing note

Check the tool's terms for the plan you're on before generating: some free tiers license the output as CC BY or restrict commercial use. A personal portfolio is usually fine, but it goes in `docs/ASSETS.md` either way.
