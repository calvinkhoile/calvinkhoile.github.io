// Asset pipeline: optimizes every model listed in scripts/assets.manifest.json
// from assets-src/ (raw, gitignored) into public/models/ (committed).
//
// Manifest entry: { "src": "assets-src/<pack>/.../file.glb", "out": "name.glb", "textureSize": 512 }
// Each model is pruned, deduped, welded, and meshopt-compressed; textures become WebP.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'scripts/assets.manifest.json'), 'utf8'));
const outDir = join(root, 'public/models');
const cli = join(root, 'node_modules/.bin/gltf-transform');

const models = manifest.models ?? [];
if (models.length === 0) {
  console.log('assets: manifest has no models yet, nothing to do.');
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
let total = 0;
let failed = 0;
for (const m of models) {
  const src = join(root, m.src);
  const out = join(outDir, m.out);
  if (!existsSync(src)) {
    console.error(`assets: MISSING ${m.src}`);
    failed++;
    continue;
  }
  mkdirSync(dirname(out), { recursive: true });
  execFileSync(
    cli,
    ['optimize', src, out, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', String(m.textureSize ?? 512)],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  const kb = statSync(out).size / 1024;
  total += kb;
  console.log(`assets: ${m.out}  ${kb.toFixed(1)} KB`);
}
console.log(`assets: ${models.length - failed} model(s), ${total.toFixed(1)} KB total`);
if (failed) process.exit(1);
