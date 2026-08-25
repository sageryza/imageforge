#!/usr/bin/env node
/* mix-sfx.js — lay the water reel's sound effects UNDER a vo-film narration.
 *
 * vo-film owns the voice and hands back per-shot audio; this only adds the
 * effects bed on top of its finished film, so nothing here can move a word.
 *   node scripts/water-reel/mix-sfx.js --film <dir> --sfx <dir> --out <mp4>
 *
 * EVERY EFFECT IS LEVELLED BY MEASUREMENT, NEVER BY A MULTIPLIER (v9, Sophie
 * 2026-08-25: "the sound effects are quite loud… if you measure the decibel
 * level, maybe you can tone the volume down for just the ones that are really
 * loud, especially towards the end"). She was pointing at a real fault: the
 * source files span 26 dB of mean level (plinks -37.2, zapbig -11.2) and v8
 * applied near-uniform gains of 0.18-0.30, i.e. 4 dB of spread — so one clip
 * sat 9 dB under her voice and another 35 dB under, and which one you got
 * depended entirely on how hot the file happened to be. And the hottest
 * files — zapbig, spooky, surf, zap — are exactly the ones clustered in the
 * last third, which is why the end was the worst of it.
 *
 * So the table carries an INTENT in dB and the gain is derived:
 *   gain = TARGET + lift - measured mean,  clamped so the peak stays under
 *   PEAK_CEIL (a spiky source like plinks has a 28 dB crest and would spike
 *   even at a polite mean).
 * TAPER pulls the bed further down across the reel, ending 4 dB quieter than
 * it starts — her "especially towards the end", applied continuously rather
 * than as a cliff at some shot.
 *
 * Her earlier rules, still in force (v6 notes):
 *  - "have her keep talking continuously don't wait for the sound effect to
 *    finish" — every effect starts INSIDE its shot (0.1-0.7s in) and plays
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

// Her narration measures about -13 dB mean, so the bed sits 17 dB under it.
const TARGET = Number(args.target || -30);   // dB mean, every effect, after gain
const TAPER = Number(args.taper || 4);       // dB quieter by the end of the reel
const PEAK_CEIL = -6;                        // dBFS, no effect may spike past this

// shot id -> [effect, seconds into the shot, lift in dB above the bed]
// A lift is a deliberate poke through the voice on a punchline, never a
// symptom of a hot file — the file's own level is measured out first.
const BED = {
  a0: [['pour', 0.15, +2]],         a1: [['waterswish', 0.20, 0]],
  a2: [['sparkle', 0.30, 0]],       a3: [['chime', 0.25, +1]],
  a4: [['gulp', 0.20, +2]],
  c1: [['pour', 0.45, 0]],          c2: [['plinks', 0.30, +2]],
  c3: [['sparkle', 0.50, 0]],
  b1: [['drips', 0.35, +1]],        b2: [['sparkle', 0.30, +1]],
  b3: [['surf', 0.40, 0]],          b4: [['gulp', 0.25, +1]],
  d1: [['spooky', 0.60, +1]],       d2: [['zapbig', 0.25, +2]],
  d3: [['future', 0.40, 0], ['splash', 3.60, +2]],
  e0: [['waterswish', 0.15, 0]],    e1: [['gurgle', 0.50, 0]],
  e2: [['zap', 0.35, +1]],          e3: [['sparkle', 0.40, 0]],
  e4: [['splash', 0.20, +2]],
  f1: [['spooky', 0.40, +1]],       f2: [['goblin', 0.35, +2]],
  f3: [['chime', 0.30, 0]],
  g1: [['waterswish', 0.20, 0]],    g2: [['plinks', 0.45, 0]],
  g3: [['surf', 0.35, 0]],
  h1: [['boing', 0.30, +1]],        h2: [['pour', 0.40, 0]],
  h3: [['splash', 0.30, 0]],
  i1: [['spooky', 0.35, 0]],        i2: [['zapbig', 0.30, +1]],
  i3: [['future', 0.30, 0]],        i4: [['drips', 0.40, 0]],
  z1: [['splash', 0.10, +2]],
};

const dur = (f) => Number(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration',
  '-of', 'default=nk=1:nw=1', f]).toString().trim());

// volumedetect prints at info level, so -v error would swallow it
const levels = {};
function level(file) {
  if (levels[file]) return levels[file];
  let txt = '';
  try { execFileSync(ffmpeg, ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] }); } catch (e) { txt = String(e.stderr || ''); }
  if (!txt) { try { txt = String(execFileSync(ffmpeg, ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'buffer' }).stderr || ''); } catch (e) { txt = String(e.stderr || ''); } }
  const mean = Number((txt.match(/mean_volume:\s*(-?[\d.]+) dB/) || [])[1]);
  const max = Number((txt.match(/max_volume:\s*(-?[\d.]+) dB/) || [])[1]);
  if (!Number.isFinite(mean) || !Number.isFinite(max)) throw new Error(`could not measure ${file}`);
  return (levels[file] = { mean, max });
}

const shotDir = path.join(FILM, 'shots');
const shots = fs.readdirSync(shotDir).filter((f) => /^shot-\d+-.+\.wav$/.test(f)).sort();
// the finished film, never one of the per-shot `seg-*.mp4` pieces beside it
const film = path.join(FILM, fs.readdirSync(FILM)
  .find((f) => f.endsWith('.mp4') && !f.startsWith('_') && !f.startsWith('seg-')));

const lens = shots.map((f) => dur(path.join(shotDir, f)));
const total = lens.reduce((a, b) => a + b, 0);

const inputs = ['-i', film]; const chains = ['[0:a]volume=1.0[a0]'];
const log = [];
let t = 0, placed = 0;
shots.forEach((f, si) => {
  const id = f.replace(/^shot-\d+-/, '').replace(/\.wav$/, '');
  for (const [name, at, lift] of (BED[id] || [])) {
    const file = path.join(SFX, `${name}.mp3`);
    if (!fs.existsSync(file)) { console.warn(`missing sfx ${name}`); continue; }
    const { mean, max } = level(file);
    const taper = -TAPER * ((t + at) / total);           // 0 dB at the head, -TAPER at the tail
    let gain = TARGET + (lift || 0) + taper - mean;
    const ceil = PEAK_CEIL - max;                        // keep the peak polite
    if (gain > ceil) gain = ceil;
    const ms = Math.round((t + at) * 1000);
    const idx = inputs.length / 2;
    inputs.push('-i', file);
    chains.push(`[${idx}:a]volume=${gain.toFixed(2)}dB,adelay=${ms}|${ms}[a${idx}]`);
    log.push(`${id.padEnd(3)} ${name.padEnd(11)} src ${mean.toFixed(1)}dB -> ${gain.toFixed(1)}dB (peak ${(max + gain).toFixed(1)})`);
    placed++;
  }
  t += lens[si];
});
const mix = chains.map((_, i) => `[a${i}]`).join('');
const filter = `${chains.join(';')};${mix}amix=inputs=${chains.length}:normalize=0,alimiter=limit=0.95[aout]`;
execFileSync(ffmpeg, ['-v', 'error', '-y', ...inputs, '-filter_complex', filter,
  '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
  '-movflags', '+faststart', OUT], { stdio: ['ignore', 'ignore', 'pipe'] });
if (args.verbose !== undefined) console.log(log.join('\n'));
console.log(`${OUT} — ${placed} effects under ${t.toFixed(1)}s, bed ${TARGET}dB tapering ${TAPER}dB`);
