// Asset pipeline: raw packs in assets-src/ (gitignored) -> optimized GLBs in public/models/ (committed).
// Driven by scripts/assets.manifest.json. Three kinds of output:
//   kits        many small models merged into one GLB (one download, shared textures). Each model is a named node.
//   characters  a base body + hairstyle merged into one skinned mesh under 5k triangles, one material.
//               Every triangle's UV points at one texel of an 8x1 palette, so a "look" is just 8 colors at runtime.
//   animations  selected clips from the Universal Animation Library, stripped to bone tracks only.

import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  compressTexture,
  dedup,
  flatten,
  join,
  mergeDocuments,
  meshopt,
  palette,
  prune,
  resample,
  simplify,
  unpartition,
  weld,
} from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join as joinPath, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(joinPath(root, 'scripts/assets.manifest.json'), 'utf8'));
const outDir = joinPath(root, 'public/models');
mkdirSync(outDir, { recursive: true });

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const quiet = (doc) => {
  doc.setLogger({ debug() {}, info() {}, warn() {}, error: console.error });
  return doc;
};

async function write(doc, name) {
  // keepAttributes: trainer UVs index a palette that is created at runtime, so nothing in the file references them.
  await doc.transform(prune({ keepAttributes: true }), unpartition(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = joinPath(outDir, name);
  await io.write(out, doc);
  const kb = statSync(out).size / 1024;
  const tris = doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0);
  console.log(`assets: ${name.padEnd(20)} ${kb.toFixed(1).padStart(7)} KB  ${String(Math.round(tris)).padStart(6)} tris`);
  return kb;
}

// ---------- kits ----------

async function buildKit(kit) {
  const doc = quiet(new Document());
  const scene = doc.createScene('kit');
  doc.getRoot().setDefaultScene(scene);
  for (const [name, src] of Object.entries(kit.models)) {
    const part = quiet(await io.read(joinPath(root, src)));
    // Optional recolor by material name (the nature kit ships teal foliage; the park wants warm greens).
    for (const mat of part.getRoot().listMaterials()) {
      const hexColor = kit.recolor?.[mat.getName()];
      if (!hexColor) continue;
      const n = parseInt(hexColor.slice(1), 16);
      const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.pow(v / 255, 2.2));
      mat.setBaseColorFactor([...lin, 1]);
    }
    // One mesh per model where possible: flat-color materials become a tiny palette texture.
    await part.transform(dedup(), palette({ min: 2 }), flatten(), join(), weld());
    mergeDocuments(doc, part);
    const scenes = doc.getRoot().listScenes();
    const merged = scenes[scenes.length - 1];
    const wrapper = doc.createNode(name);
    for (const child of merged.listChildren()) wrapper.addChild(child);
    merged.dispose();
    scene.addChild(wrapper);
  }
  await doc.transform(dedup(), prune());
  for (const tex of doc.getRoot().listTextures()) {
    const size = tex.getSize();
    // Palette textures are a few pixels wide and must stay lossless. Only real textures get resized.
    if (size && Math.max(size[0], size[1]) > 64) {
      await compressTexture(tex, { encoder: sharp, targetFormat: 'webp', resize: [kit.textureSize ?? 256, kit.textureSize ?? 256] });
    }
  }
  return write(doc, kit.out);
}

// ---------- characters ----------

const CHAR_DIR = 'assets-src/quaternius-base-characters';
const BODIES = {
  male: `${CHAR_DIR}/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf`,
  female: `${CHAR_DIR}/Base Characters/Godot - UE/Superhero_Female_FullBody.gltf`,
};
const HAIR_DIR = `${CHAR_DIR}/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)`;

// Palette slots. Keep in sync with src/world/looks.ts.
const REGION = { skin: 0, top: 1, sleeve: 2, pants: 3, calf: 4, shoes: 5, hair: 6, eyes: 7 };
const PALETTE_SIZE = 8;

/**
 * Which palette slot a body triangle belongs to. The base mesh is in a T-pose (arms out along x, y up, 1.81 tall),
 * so outfit edges are cut at fixed heights and arm lengths, which gives straight hems instead of ragged bone borders.
 */
function regionFor(joint, x, y) {
  if (/^Head/.test(joint)) return REGION.skin;
  if (/^(hand|index|middle|pinky|ring|thumb)/.test(joint)) return REGION.skin;
  if (/^(lowerarm|upperarm|clavicle)/.test(joint) && Math.abs(x) > 0.2) return Math.abs(x) > 0.37 ? REGION.sleeve : REGION.top;
  if (/^(foot|ball)/.test(joint) || y < 0.1) return REGION.shoes;
  if (/^neck/.test(joint) && y > 1.5) return REGION.skin;
  if (y >= 0.97) return REGION.top;
  if (y >= 0.5) return REGION.pants;
  return REGION.calf;
}

/** Read a .gltf with its textures stripped (we recolor by region, and some referenced images don't exist). */
async function readUntextured(path) {
  const abs = joinPath(root, path);
  const json = JSON.parse(readFileSync(abs, 'utf8'));
  delete json.images;
  delete json.textures;
  delete json.samplers;
  delete json.extensionsUsed;
  delete json.extensionsRequired;
  for (const m of json.materials ?? []) {
    for (const k of Object.keys(m)) if (k !== 'name') delete m[k];
  }
  const resources = {};
  for (const b of json.buffers) resources[b.uri] = readFileSync(joinPath(dirname(abs), b.uri));
  return quiet(await io.readJSON({ json, resources }));
}

async function simplifyTo(doc, targetTris) {
  await doc.transform(weld());
  const tris = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + p.getIndices().getCount() / 3, 0);
  if (tris > targetTris) {
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: targetTris / tris, error: 0.02 }));
  }
}

// Outfit edges: the body is cut along these planes so hems and cuffs are straight lines, not ragged triangle edges.
const CUTS = [
  { axis: 1, value: 0.97 }, // shirt hem
  { axis: 1, value: 0.5 }, // knee
  { axis: 1, value: 0.1 }, // ankle
  { axis: 0, value: 0.37 }, // short-sleeve cuffs
  { axis: 0, value: -0.37 },
];

function lerpVert(a, b, t) {
  const mix = (u, v) => u.map((x, i) => x + (v[i] - x) * t);
  const n = mix(a.n, b.n);
  const len = Math.hypot(...n) || 1;
  // Blend skin weights across both ends, keep the four strongest.
  const weights = new Map();
  for (let k = 0; k < 4; k++) {
    weights.set(a.j[k], (weights.get(a.j[k]) ?? 0) + a.w[k] * (1 - t));
    weights.set(b.j[k], (weights.get(b.j[k]) ?? 0) + b.w[k] * t);
  }
  const top = [...weights].filter(([, w]) => w > 0).sort((x, y) => y[1] - x[1]).slice(0, 4);
  const sum = top.reduce((acc, [, w]) => acc + w, 0) || 1;
  const j = [0, 0, 0, 0];
  const w = [0, 0, 0, 0];
  top.forEach(([joint, weight], i) => {
    j[i] = joint;
    w[i] = weight / sum;
  });
  return { p: mix(a.p, b.p), n: n.map((x) => x / len), j, w };
}

function splitByPlane(tris, verts, axis, value) {
  const EPS = 1e-5;
  const out = [];
  const cache = new Map();
  const cut = (a, b) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    let id = cache.get(key);
    if (id === undefined) {
      const t = (value - verts[a].p[axis]) / (verts[b].p[axis] - verts[a].p[axis]);
      id = verts.length;
      verts.push(lerpVert(verts[a], verts[b], t));
      cache.set(key, id);
    }
    return id;
  };
  for (const tri of tris) {
    const sign = tri.map((id) => {
      const d = verts[id].p[axis] - value;
      return d > EPS ? 1 : d < -EPS ? -1 : 0;
    });
    if (!sign.includes(1) || !sign.includes(-1)) {
      out.push(tri);
      continue;
    }
    // Rotate so `a` is the only vertex on its side of the plane.
    const lone = sign.findIndex((s, i) => s !== 0 && sign.filter((x) => x === s).length === 1 && i >= 0);
    const [a, b, c] = [tri[lone], tri[(lone + 1) % 3], tri[(lone + 2) % 3]];
    const sb = sign[(lone + 1) % 3];
    const sc = sign[(lone + 2) % 3];
    const ab = sb === 0 ? b : cut(a, b);
    const ac = sc === 0 ? c : cut(a, c);
    out.push([a, ab, ac]);
    if (ab === b) out.push([b, c, ac]);
    else if (ac === c) out.push([ab, b, c]);
    else out.push([ab, b, c], [ab, c, ac]);
  }
  return out;
}

/** Pull the triangles of every primitive in a doc, tagged with a palette region per triangle. */
function extractParts(doc, fixedRegion) {
  const parts = [];
  const skin = doc.getRoot().listSkins()[0];
  const jointNames = skin.listJoints().map((j) => j.getName());
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const nor = prim.getAttribute('NORMAL');
      const jnt = prim.getAttribute('JOINTS_0');
      const wgt = prim.getAttribute('WEIGHTS_0');
      const idx = prim.getIndices().getArray();
      const material = prim.getMaterial()?.getName() ?? '';
      let region = fixedRegion;
      if (region === undefined && /Eye/i.test(material)) region = REGION.eyes;
      if (region === undefined && /Hair/i.test(material)) region = REGION.hair; // eyebrows

      const verts = [];
      for (let v = 0; v < pos.getCount(); v++) {
        verts.push({ p: pos.getElement(v, []), n: nor.getElement(v, []), j: jnt.getElement(v, []), w: wgt.getElement(v, []) });
      }
      let tris = [];
      for (let t = 0; t < idx.length; t += 3) tris.push([idx[t], idx[t + 1], idx[t + 2]]);
      if (region === undefined) for (const c of CUTS) tris = splitByPlane(tris, verts, c.axis, c.value);

      const triRegion = tris.map((tri) => {
        if (region !== undefined) return region;
        // Centroid position + the heaviest bone across the triangle's three vertices.
        let cx = 0;
        let cy = 0;
        const votes = new Map();
        for (const id of tri) {
          const v = verts[id];
          cx += v.p[0] / 3;
          cy += v.p[1] / 3;
          for (let n = 0; n < 4; n++) votes.set(v.j[n], (votes.get(v.j[n]) ?? 0) + v.w[n]);
        }
        let best = -1;
        let bestW = -1;
        for (const [joint, weight] of votes) if (weight > bestW) [best, bestW] = [joint, weight];
        return regionFor(jointNames[best], cx, cy);
      });
      parts.push({ verts, tris, triRegion });
    }
  }
  return parts;
}

async function buildCharacter(spec) {
  const body = await readUntextured(BODIES[spec.body]);
  // Simplify the body and the hair separately so each keeps its shape.
  const hair = await readUntextured(`${HAIR_DIR}/${spec.hair}.gltf`);
  await simplifyTo(body, 3200);
  await simplifyTo(hair, 900);

  const parts = [...extractParts(body), ...extractParts(hair, REGION.hair)];

  // Merge everything into one primitive. A vertex shared by two regions is split so UVs stay constant per triangle.
  const positions = [];
  const normals = [];
  const joints = [];
  const weights = [];
  const uvs = [];
  const indices = [];
  for (const part of parts) {
    const remap = new Map();
    part.tris.forEach((tri, t) => {
      const region = part.triRegion[t];
      for (const id of tri) {
        const key = id * PALETTE_SIZE + region;
        let out = remap.get(key);
        if (out === undefined) {
          out = positions.length / 3;
          remap.set(key, out);
          const v = part.verts[id];
          positions.push(...v.p);
          normals.push(...v.n);
          joints.push(...v.j);
          weights.push(...v.w);
          uvs.push((region + 0.5) / PALETTE_SIZE, 0.5);
        }
        indices.push(out);
      }
    });
  }

  const buffer = body.getRoot().listBuffers()[0];
  const acc = (type, array) => body.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const material = body.createMaterial('Palette').setRoughnessFactor(1).setMetallicFactor(0);
  const prim = body
    .createPrimitive()
    .setMaterial(material)
    .setIndices(acc('SCALAR', new Uint16Array(indices)))
    .setAttribute('POSITION', acc('VEC3', new Float32Array(positions)))
    .setAttribute('NORMAL', acc('VEC3', new Float32Array(normals)))
    .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(uvs)))
    .setAttribute('JOINTS_0', acc('VEC4', new Uint8Array(joints)))
    .setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array(weights)));

  // Keep the first skinned node, give it the merged mesh, drop the rest.
  const meshNodes = body.getRoot().listNodes().filter((n) => n.getMesh());
  const keep = meshNodes[0];
  for (const m of body.getRoot().listMeshes()) m.dispose();
  keep.setName('Trainer').setMesh(body.createMesh('Trainer').addPrimitive(prim));
  for (const n of meshNodes.slice(1)) n.dispose();
  for (const a of body.getRoot().listAnimations()) a.dispose();
  return write(body, spec.out);
}

// ---------- animations ----------

async function buildAnimations(spec) {
  const doc = quiet(await io.read(joinPath(root, spec.src)));
  const r = doc.getRoot();
  const missing = spec.clips.filter((c) => !r.listAnimations().some((a) => a.getName() === c));
  if (missing.length) throw new Error(`animations: clips not found: ${missing.join(', ')}`);
  for (const a of r.listAnimations()) {
    if (spec.clips.includes(a.getName())) continue;
    // Dispose samplers and channels too, or their keyframe data stays in the file.
    for (const ch of a.listChannels()) ch.dispose();
    for (const sm of a.listSamplers()) sm.dispose();
    a.dispose();
  }
  // Bones only: no mannequin mesh, and no finger or scale tracks (invisible at this camera distance).
  for (const n of r.listNodes()) if (n.getMesh()) n.setMesh(null).setSkin(null);
  for (const m of r.listMeshes()) m.dispose();
  for (const s of r.listSkins()) s.dispose();
  for (const a of r.listAnimations()) {
    for (const ch of a.listChannels()) {
      const node = ch.getTargetNode();
      const finger = node && /^(index|middle|pinky|ring|thumb)_/.test(node.getName());
      if (!node || finger || ch.getTargetPath() === 'scale') {
        ch.getSampler()?.dispose();
        ch.dispose();
      }
    }
  }
  await doc.transform(resample({ tolerance: 0.0005 }));
  return write(doc, spec.out);
}

// ---------- logos (signage) ----------

async function buildLogos(logos) {
  const dir = joinPath(root, 'public/images/logos');
  mkdirSync(dir, { recursive: true });
  let kb = 0;
  for (const [out, src] of Object.entries(logos)) {
    const dst = joinPath(dir, out);
    if (out.endsWith('.svg')) copyFileSync(joinPath(root, src), dst);
    else await sharp(joinPath(root, src)).trim().resize({ width: 512, height: 512, fit: 'inside' }).webp({ quality: 85 }).toFile(dst);
    kb += statSync(dst).size / 1024;
  }
  console.log(`assets: ${Object.keys(logos).length} logos            ${kb.toFixed(1).padStart(7)} KB`);
}

// ---------- photos (project cards) ----------

/** 'meta/external signal 1.PNG' -> 'meta/external-signal-1.webp'. Keep in sync with how src/content paths are written. */
const photoSlug = (rel) => rel.replace(/\.[^.]+$/, '').toLowerCase().replace(/[ _]+/g, '-') + '.webp';

async function buildPhotos(spec) {
  let kb = 0;
  let count = 0;
  for (const folder of spec.folders) {
    const dir = joinPath(root, spec.srcDir, folder);
    for (const file of readdirSync(dir)) {
      if (file.startsWith('.')) continue;
      const dst = joinPath(root, 'public/images', photoSlug(`${folder}/${file}`));
      mkdirSync(dirname(dst), { recursive: true });
      await sharp(joinPath(dir, file))
        .rotate() // apply EXIF orientation before the metadata is dropped
        .resize({ width: spec.maxSize, height: spec.maxSize, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: spec.quality })
        .toFile(dst);
      kb += statSync(dst).size / 1024;
      count++;
    }
  }
  console.log(`assets: ${count} photos           ${kb.toFixed(1).padStart(7)} KB`);
}

// ---------- run ----------

let total = 0;
for (const kit of manifest.kits ?? []) total += await buildKit(kit);
for (const c of manifest.characters ?? []) total += await buildCharacter(c);
if (manifest.animations) total += await buildAnimations(manifest.animations);
console.log(`assets: ${total.toFixed(1)} KB total in public/models/`);
if (manifest.logos) await buildLogos(manifest.logos);
if (manifest.photos) await buildPhotos(manifest.photos);
