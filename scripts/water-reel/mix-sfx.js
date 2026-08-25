#!/usr/bin/env node
/* mix-sfx.js — lay the water reel's sound effects UNDER a vo-film narration.
 *
 * vo-film owns the voice and hands back per-shot audio; this only adds the
 * effects bed on top of its finished film, so nothing here can move a word.
 *   node scripts/water-reel/mix-sfx.js --film <dir> --sfx <dir> --out <mp4>
 *
 * Sophie's rules, from her notes on v6 (2026-08-25):
 *  - "the sound effects need to be a little bit quieter when they're behind
 *    the voice" — nothing above 0.30, most at 0.20-0.25, against speech that
 *    sits at about -13dB.
 *  - "have her keep talking continuously don't wait for the sound effect to
 *    finish" — every effect starts INSIDE its shot (0.1-0.5s in) and plays
 *    over her, rather than being given a silent slot of its own.
 * Shot starts are the cumulative per-shot audio lengths vo-film cut, read
 * back off its own shots/ directory — never re-derived from the script.
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('ffmpeg-static');
const ffprobe = require('ffprobe-static').path;

const args = {};
process.argv.slice(2).forEach((a, i, all) => { if (a.startsWith('--')) args[a.slice(2)] = all[i + 1]; });
const FILM = args.film, SFX = args.sfx, OUT = args.out;
if (!FILM || !SFX || !OUT) { console.error('need --film <dir> --sfx <dir> --out <mp4>'); process.exit(1); }

// shot id -> [effect, seconds into the shot, volume]
const BED = {
  a0: [['pour', 0.15, 0.30]],       a1: [['waterswish', 0.20, 0.18]],
  a2: [['sparkle', 0.30, 0.20]],    a3: [['chime', 0.25, 0.22]],
  a4: [['gulp', 0.20, 0.25]],
  c1: [['pour', 0.45, 0.22]],       c2: [['plinks', 0.30, 0.28]],
  c3: [['sparkle', 0.50, 0.22]],
  d1: [['spooky', 0.60, 0.28]],     d2: [['zapbig', 0.25, 0.30]],
  d3: [['future', 0.40, 0.24], ['splash', 3.60, 0.30]],
  e0: [['waterswish', 0.15, 0.20]], e1: [['gurgle', 0.50, 0.22]],
  e2: [['zap', 0.35, 0.24]],        e3: [['sparkle', 0.40, 0.24]],
  e4: [['splash', 0.20, 0.28]],
  f1: [['spooky', 0.40, 0.26]],     f2: [['goblin', 0.35, 0.30]],
  f3: [['chime', 0.30, 0.24]],
  g1: [['waterswish', 0.20, 0.20]], g2: [['plinks', 0.45, 0.22]],
  g3: [['surf', 0.35, 0.24]],
  h1: [['boing', 0.30, 0.24]],      h2: [['pour', 0.40, 0.24]],
  h3: [['splash', 0.30, 0.24]],
  i1: [['spooky', 0.35, 0.24]],     i2: [['zapbig', 0.30, 0.28]],
  i3: [['future', 0.30, 0.24]],     i4: [['drips', 0.40, 0.24]],
  z1: [['splash', 0.10, 0.30], ['zapbig', 0.70, 0.26]],
};

const dur = (f) => Number(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration',
  '-of', 'default=nk=1:nw=1', f]).toString().trim());

const shotDir = path.join(FILM, 'shots');
const shots = fs.readdirSync(shotDir).filter((f) => /^shot-\d+-.+\.wav$/.test(f)).sort();
// the finished film, never one of the per-shot `seg-*.mp4` pieces beside it
const film = path.join(FILM, fs.readdirSync(FILM)
  .find((f) => f.endsWith('.mp4') && !f.startsWith('_') && !f.startsWith('seg-')));

const inputs = ['-i', film]; const chains = ['[0:a]volume=1.0[a0]'];
let t = 0, placed = 0;
for (const f of shots) {
  const id = f.replace(/^shot-\d+-/, '').replace(/\.wav$/, '');
  for (const [name, at, vol] of (BED[id] || [])) {
    const file = path.join(SFX, `${name}.mp3`);
    if (!fs.existsSync(file)) { console.warn(`missing sfx ${name}`); continue; }
    const ms = Math.round((t + at) * 1000);
    const idx = inputs.length / 2;
    inputs.push('-i', file);
    chains.push(`[${idx}:a]volume=${vol},adelay=${ms}|${ms}[a${idx}]`);
    placed++;
  }
  t += dur(path.join(shotDir, f));
}
const mix = chains.map((_, i) => `[a${i}]`).join('');
const filter = `${chains.join(';')};${mix}amix=inputs=${chains.length}:normalize=0,alimiter=limit=0.95[aout]`;
execFileSync(ffmpeg, ['-v', 'error', '-y', ...inputs, '-filter_complex', filter,
  '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
  '-movflags', '+faststart', OUT], { stdio: ['ignore', 'ignore', 'pipe'] });
console.log(`${OUT} — ${placed} effects under ${t.toFixed(1)}s of narration`);
