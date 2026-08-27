#!/usr/bin/env node
/* speed.js — pitch-preserved speed-up of a finished reel (Sophie, 2026-08-25:
 * "can you speed it up a lot but keep the pitch the same have it speed up
 * gradually I guess or all at once maybe do two versions").
 *
 * Runs on the FINISHED, MIXED film — voice and effects speed together, atempo
 * keeps the pitch. Two modes:
 *   --flat 1.3            one factor over the whole reel
 *   --ramp 1.15,1.25,1.35,1.45,1.55
 *   --ramp 1.15,1.5,2.0 --from d1
 *                         with --from, the reel plays untouched up to that
 *                         SHOT and the factors divide only what follows
 *                         N factors over N spans; the film is split at SHOT
 *                         boundaries nearest the even division (a mid-shot
 *                         split would retime a word across the seam), each
 *                         span retimed, then concatenated.
 * Shot boundaries come from the spec + vo-film's own per-shot wavs — the same
 * read mix-sfx.js does, never a guess.
 *
 *   node scripts/water-reel/speed.js --in v11.mp4 --film <dir> --spec spec.json \
 *        --flat 1.3 --out v11-fast.mp4
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('ffmpeg-static');
const ffprobe = require('ffprobe-static').path;

const args = {};
process.argv.slice(2).forEach((a, i, all) => { if (a.startsWith('--')) args[a.slice(2)] = all[i + 1]; });
const IN = args.in, OUT = args.out;
if (!IN || !OUT || (!args.flat && !args.ramp)) {
  console.error('need --in <mp4> --out <mp4> and --flat <f> or --ramp <f1,f2,…> (--ramp also needs --film --spec)');
  process.exit(1);
}
const dur = (f) => Number(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration',
  '-of', 'default=nk=1:nw=1', f]).toString().trim());
// atempo accepts 0.5-2.0 per instance; anything faster is a CHAIN, or ffmpeg
// errors out with a bare "Value out of range" that reads like a bug
const atempo = (f) => {
  const parts = []; let r = f;
  while (r > 2.0) { parts.push('atempo=2.0'); r /= 2.0; }
  while (r < 0.5) { parts.push('atempo=0.5'); r /= 0.5; }
  parts.push(`atempo=${r.toFixed(6)}`);
  return parts.join(',');
};
const enc = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'];

if (args.flat) {
  const f = Number(args.flat);
  execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', IN, '-filter_complex',
    `[0:v]setpts=PTS/${f}[v];[0:a]${atempo(f)}[a]`, '-map', '[v]', '-map', '[a]', ...enc, OUT],
    { stdio: ['ignore', 'inherit', 'inherit'] });
  console.log(`${OUT} — flat ${f}x, ${dur(IN).toFixed(1)}s -> ${dur(OUT).toFixed(1)}s`);
  process.exit(0);
}

const F = args.ramp.split(',').map(Number);
const FILM = args.film, SPEC = args.spec;
if (!FILM || !SPEC) { console.error('--ramp needs --film <dir> and --spec <spec.json>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
const shotDir = path.join(FILM, 'shots');
const onDisk = fs.readdirSync(shotDir).filter((n) => /^shot-\d+-.+\.wav$/.test(n));
const bounds = [0]; // cumulative shot boundaries in reel time
const startOf = {};  // shot id -> its start in reel time
let t = 0;
for (const sh of spec.shots) {
  const f = onDisk.find((n) => n.replace(/^shot-\d+-/, '').replace(/\.wav$/, '') === sh.id);
  if (!f) throw new Error(`no cut wav for shot ${sh.id}`);
  startOf[sh.id] = t;
  t += dur(path.join(shotDir, f));
  bounds.push(t);
}
const total = dur(IN);
// `--from <shotId>` RAMPS FROM ONE LINE (2026-08-27, Sophie: "start ramping up
// the speed in the one that says the ghosts that live in your spine and have
// it ramp up till the end of the video"). Everything before that shot plays at
// its own pace, untouched; the ramp divides only what is left. Named by SHOT
// rather than by a timestamp, because a re-cut moves every timestamp and would
// silently start the ramp mid-sentence somewhere else.
const FROM = args.from || '';
if (FROM && startOf[FROM] == null) {
  console.error(`--from ${FROM}: no such shot (have ${Object.keys(startOf).join(', ')})`);
  process.exit(1);
}
const head = FROM ? startOf[FROM] : 0;
const factors = head > 0 ? [1, ...F] : F.slice();
// split points: the shot boundary nearest each even division of the RAMPED part
const cuts = [0];
if (head > 0) cuts.push(head);
for (let i = 1; i < F.length; i++) {
  const target = head + ((total - head) * i) / F.length;
  let best = bounds[0];
  for (const b of bounds) if (Math.abs(b - target) < Math.abs(best - target)) best = b;
  cuts.push(best);
}
cuts.push(total);
const tmp = [];
for (let i = 0; i < factors.length; i++) {
  const seg = path.join(path.dirname(OUT), `_spd${i}.mp4`);
  // THE SEEK MUST HAPPEN ON THE INPUT, BEFORE THE RETIME (bug found 2026-08-27,
  // measured: a ramp asked for 90.3s of source came out 76.9s, and the cut
  // played a line from thirty seconds later at the joint). `-ss`/`-to` written
  // AFTER `-i` are OUTPUT options, so they slice the stream the filter has
  // ALREADY compressed — span i then grabbed source [cut*f, cut*f] instead of
  // [cut, cut], overlapping its neighbour and skipping whole lines. Every ramp
  // cut from v11 to v15 shipped with this. `-ss`/`-t` before `-i` seek the real
  // source, and the concat below then joins spans that actually abut.
  execFileSync(ffmpeg, ['-v', 'error', '-y',
    '-ss', cuts[i].toFixed(3), '-t', (cuts[i + 1] - cuts[i]).toFixed(3), '-i', IN,
    '-filter_complex',
    `[0:v]setpts=PTS/${factors[i]}[v];[0:a]${atempo(factors[i])}[a]`, '-map', '[v]', '-map', '[a]',
    '-video_track_timescale', '90000', ...enc.slice(0, -2), seg], { stdio: ['ignore', 'inherit', 'inherit'] });
  tmp.push(seg);
}
const list = path.join(path.dirname(OUT), '_spd.txt');
fs.writeFileSync(list, tmp.map((f) => `file '${f}'`).join('\n'));
execFileSync(ffmpeg, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', OUT],
  { stdio: ['ignore', 'inherit', 'inherit'] });
tmp.forEach((f) => fs.rmSync(f, { force: true })); fs.rmSync(list, { force: true });
console.log(`${OUT} — ramp ${factors.join('→')}${FROM ? ` from ${FROM} at ${head.toFixed(1)}s` : ''}, `
  + `${total.toFixed(1)}s -> ${dur(OUT).toFixed(1)}s (cuts at ${cuts.slice(1, -1).map((c) => c.toFixed(1)).join(', ')})`);
