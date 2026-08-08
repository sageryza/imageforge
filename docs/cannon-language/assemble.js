#!/usr/bin/env node
// Stitch the film: retime each clip to its own narration line, concat, mux.
//
// Two rules that are load-bearing and were learned the hard way elsewhere in
// this repo:
//   * per-shot audio is concatenated as WAV, never aac — aac priming stacks
//     per join and walks the voice off the picture. The track is encoded ONCE,
//     at the mux.
//   * the audiobook voice is never loudnormed.
//
//   node assemble.js [--out film-v1.mp4]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = __dirname;
const WORK = process.env.CANNON_WORK ||
  '/tmp/claude-0/-home-user/f2896c89-febe-5a45-b7dd-d2f403c0f14e/scratchpad/narration';
const CLIPDIR = path.join(WORK, '..', 'clips');
const FFMPEG = require('/home/user/imageforge/node_modules/ffmpeg-static');
const FFPROBE = require('/home/user/imageforge/node_modules/ffprobe-static').path;

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUTFILE = path.resolve(argOf('--out', path.join(CLIPDIR, '..', 'film-v1.mp4')));

const shots = JSON.parse(fs.readFileSync(path.join(DIR, 'shots.json'), 'utf8')).shots;
const clips = JSON.parse(fs.readFileSync(path.join(DIR, 'clips.json'), 'utf8'));
const narr = JSON.parse(fs.readFileSync(path.join(DIR, 'narration.json'), 'utf8'));

const run = (a) => execFileSync(FFMPEG, a, { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 1 << 26 });
const dur = f => parseFloat(execFileSync(FFPROBE,
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

fs.mkdirSync(CLIPDIR, { recursive: true });

// 1. one continuous WAV of the narration, in shot order, sample-exact
const wavList = [];
for (const s of shots) {
  const n = narr[s.n];
  if (!n) throw new Error(`shot ${s.n}: no narration`);
  wavList.push(n.wav);
}
const wavTxt = path.join(CLIPDIR, 'audio.txt');
fs.writeFileSync(wavTxt, wavList.map(f => `file '${f}'`).join('\n'));
const fullWav = path.join(CLIPDIR, 'narration-full.wav');
run(['-v', 'error', '-f', 'concat', '-safe', '0', '-i', wavTxt,
  '-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '1', fullWav, '-y']);
console.log(`narration track: ${dur(fullWav).toFixed(2)}s`);

// 2. every clip retimed to its line — slowed if the clip is short, trimmed if long
const inputs = [], filters = [];
let i = 0, total = 0;
for (const s of shots) {
  const c = clips[s.n];
  if (!c) throw new Error(`shot ${s.n}: no clip`);
  const local = path.join(CLIPDIR, `c${String(s.n).padStart(2, '0')}.mp4`);
  if (!fs.existsSync(local)) throw new Error(`shot ${s.n}: ${local} not downloaded`);
  const L = narr[s.n].seconds, C = dur(local);
  const factor = L > C ? L / C : 1;
  inputs.push('-i', local);
  filters.push(
    `[${i}:v]setpts=${factor.toFixed(6)}*PTS,trim=duration=${L.toFixed(3)},` +
    `setpts=PTS-STARTPTS,fps=24,scale=512:768:force_original_aspect_ratio=decrease,` +
    `pad=512:768:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`);
  total += L;
  if (factor > 1.5) console.log(`  shot ${s.n}: slowed ${factor.toFixed(2)}x (line ${L}s vs clip ${C.toFixed(2)}s)`);
  i++;
}
const chain = filters.join(';') + ';' +
  Array.from({ length: i }, (_, k) => `[v${k}]`).join('') + `concat=n=${i}:v=1:a=0[vout]`;

// 3. single encode at the mux
run([...['-v', 'error'], ...inputs, '-i', fullWav,
  '-filter_complex', chain, '-map', '[vout]', '-map', `${i}:a`,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-shortest', OUTFILE, '-y']);

console.log(`\n${OUTFILE}`);
console.log(`shots ${i} · planned ${total.toFixed(2)}s · actual ${dur(OUTFILE).toFixed(2)}s`);
