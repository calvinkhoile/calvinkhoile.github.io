// Makes an AAC (.m4a) copy of every Ogg sound in public/audio, for Safari versions that can't play Ogg.
// There's no ffmpeg on this machine, so: a headless browser decodes each Ogg to raw samples, this script writes
// a WAV, and macOS's afconvert encodes it to AAC. Run after `npm run assets` when sounds change (macOS only).

import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'public/audio');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<!doctype html><title>decode</title>');

function wav(channels, sampleRate) {
  const frames = channels[0].length;
  const buf = Buffer.alloc(44 + frames * channels.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + frames * channels.length * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels.length, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * channels.length * 2, 28);
  buf.writeUInt16LE(channels.length * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(frames * channels.length * 2, 40);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (const ch of channels) {
      buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(ch[i] * 32767))), o);
      o += 2;
    }
  }
  return buf;
}

let kb = 0;
let count = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.ogg'))) {
  const b64 = readFileSync(join(dir, file)).toString('base64');
  const decoded = await page.evaluate(async (data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const ctx = new OfflineAudioContext(1, 1, 44100);
    const audio = await ctx.decodeAudioData(bytes.buffer);
    return { rate: audio.sampleRate, channels: Array.from({ length: audio.numberOfChannels }, (_, i) => Array.from(audio.getChannelData(i))) };
  }, b64);
  const tmp = join(dir, file.replace('.ogg', '.wav'));
  const out = join(dir, file.replace('.ogg', '.m4a'));
  writeFileSync(tmp, wav(decoded.channels, decoded.rate));
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '96000', tmp, out]);
  unlinkSync(tmp);
  kb += statSync(out).size / 1024;
  count++;
}
await browser.close();
console.log(`audio: ${count} AAC copies, ${kb.toFixed(1)} KB`);
