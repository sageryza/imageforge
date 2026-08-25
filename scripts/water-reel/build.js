#!/usr/bin/env node
// The "MORE WATER, RIGHT NOW" reel v5 — Sophie's hearted Playground images as
// one 9:16 reel, narrated (one ElevenLabs take, whisper word timings). Her
// v4 notes, all in code here:
//  - the earnest image's panels flash by fast (nobody has to read them)
//  - "there's three reasons why" is out of the script
//  - every zoom fills the frame with its panel (tightened z per measured rect)
//  - the whole voice is sped up (--tempo, default 1.12) and the shots are
//    timed to the SPED-UP read
//  - sound effects vary — some hit with the line, some during, some after
//  - the finale never cuts twice to the same image: the third-eye shot GLIDES
//    down into the "MORE WATER! RIGHT NOW!" burst in one continuous move
//  - then a fast run-through of her people-watching sheets (--montage dir)
//    while the take's last line plays at --mtempo (default 1.3)
//
//   node build.js --images <dir> --sfx <dir> --vo vo.mp3 \
//                 --votimes votimes.json --montage <dir> --out <mp4>
//
// votimes.json = [{start,end}] per line in ORIGINAL VO time, 12 lines:
// 1 intro (image A), 2-4 C's reasons, 5-7 B's, 8-10 D's, 11 "More water!
// Right now!", 12 the people-watching teaser (montage only). Zoom targets
// are fractions of the 1024x1536 canvas, read off the pictures by eye and
// verified frame by frame — nothing derives them.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('ffmpeg-static');

const args = {};
process.argv.slice(2).forEach((a, i, all) => { if (a.startsWith('--')) args[a.slice(2)] = all[i + 1]; });
const IMG = args.images, SFX = args.sfx, OUT = args.out || 'water-reel.mp4';
const VO = args.vo, VOTIMES = args.votimes, MON = args.montage;
const TEMPO = Number(args.tempo || 1.12), MTEMPO = Number(args.mtempo || 1.3);
if (!IMG || !SFX || !VO || !VOTIMES || !MON) { console.error('need --images --sfx --vo --votimes --montage'); process.exit(1); }

const FPS = 30, W = 1080, H = 1620, PADH = 1920; // 2:3 art on a 9:16 canvas
const VOFF = 0.35; // the VO starts this far into the reel
const RAW = JSON.parse(fs.readFileSync(VOTIMES)); // 12 line spans, original VO time
const L = RAW.map(s => ({ start: s.start / TEMPO, end: s.end / TEMPO })); // sped-up time
const t = (s) => s + VOFF;

const A = { img: '1787619512551-35kqb3.webp', pad: 'f1d3a5' };
const C = { img: '1787620392223-lfveov.webp', pad: 'eacfa1' };
const B = { img: '1787620306161-xsmta2.webp', pad: 'ebcc97' };
const D = { img: '1787620455292-5g1ynr.webp', pad: 'eacda1' };
// the montage: the REST of the water study sheets, the unhearted draws
// (v6 — Sophie: "it's not the People Watching ones. There's more water
// ones. They just aren't hearted."), fast flashes under the sped-up
// "Drink gallons. Drink oceans." line.
const MONTAGE = [
  { img: '1787620659452-3i519q.webp', pad: 'ebd2aa', sfx: 'boing' },
  { img: '1787620184879-2zemot.webp', pad: 'ecd0a6', sfx: 'zap' },
  { img: '1787620593195-1qure2.webp', pad: 'eecfa6', sfx: 'chime' },
  { img: '1787620603958-sioafz.webp', pad: 'e4caa0', sfx: 'splash' },
  { img: '1787620578088-6fr3hh.webp', pad: 'ead0a2', sfx: 'plinks' },
  { img: '1787620576755-6n0olq.webp', pad: 'f0deba', sfx: 'zapbig' },
];

// A: full poster briefly, then the three panels as fast flashes.
const aEnd = t(L[0].end) + 0.15;
const aFull = t(L[0].end * 0.45);
const aStep = (aEnd - aFull) / 3;

// Main shots — a zoom runs from just before its line to just before the
// next; the full-poster beats live in the VO's breaks. sfx offsets vary on
// purpose (with / during / after the line).
const bounds = [
  { ...A, z: [1.06, 1.0], tx: 0.5, ty: 0.5, from: 0, to: aFull, sfx: [['pour', 0, 0.6]] },
  { ...A, z: [1.0, 3.35], tx: 0.215, ty: 0.561, from: aFull, to: aFull + aStep, sfx: [['waterswish', 0, 0.35]] },
  { ...A, z: [1.0, 3.35], tx: 0.503, ty: 0.561, from: aFull + aStep, to: aFull + 2 * aStep, sfx: [['waterswish', 0, 0.35]] },
  { ...A, z: [1.0, 3.35], tx: 0.79, ty: 0.561, from: aFull + 2 * aStep, to: aEnd, sfx: [['waterswish', 0, 0.35]] },
  { ...C, z: [1.06, 1.0], tx: 0.5, ty: 0.5, from: aEnd, to: t(L[1].start) - 0.2, sfx: [['gulp', 0, 0.75]] },
  { ...C, z: [1.0, 2.45], tx: 0.188, ty: 0.635, from: t(L[1].start) - 0.2, to: t(L[2].start) - 0.2, sfx: [['waterswish', 0, 0.4], ['pour', 1.0, 0.4]] },
  { ...C, z: [1.0, 2.45], tx: 0.50, ty: 0.635, from: t(L[2].start) - 0.2, to: t(L[3].start) - 0.2, sfx: [['plinks', 0.2, 0.5]] },
  { ...C, z: [1.0, 2.45], tx: 0.81, ty: 0.635, from: t(L[3].start) - 0.2, to: t(L[3].end) + 0.15, sfx: [['waterswish', 0, 0.4], ['sparkle', 1.4, 0.45]] },
  { ...B, z: [1.06, 1.0], tx: 0.5, ty: 0.5, from: t(L[3].end) + 0.15, to: t(L[4].start) - 0.2, sfx: [['splash', 0, 0.75]] },
  { ...B, z: [1.0, 2.95], tx: 0.195, ty: 0.615, from: t(L[4].start) - 0.2, to: t(L[5].start) - 0.2, sfx: [['goblin', 0.9, 0.55]] },
  { ...B, z: [1.0, 2.95], tx: 0.49, ty: 0.615, from: t(L[5].start) - 0.2, to: t(L[6].start) - 0.2, sfx: [['waterswish', 0, 0.4], ['sparkle', 0.3, 0.45]] },
  { ...B, z: [1.0, 2.95], tx: 0.80, ty: 0.615, from: t(L[6].start) - 0.2, to: t(L[6].end) + 0.15, sfx: [['surf', 0.8, 0.55]] },
  { ...D, z: [1.06, 1.0], tx: 0.5, ty: 0.5, from: t(L[6].end) + 0.15, to: t(L[7].start) - 0.2, sfx: [['zap', 0, 0.7]] },
  { ...D, z: [1.0, 2.2], tx: 0.285, ty: 0.47, from: t(L[7].start) - 0.2, to: t(L[8].start) - 0.2, sfx: [['waterswish', 0, 0.4], ['spooky', 1.2, 0.5]] },
  { ...D, z: [1.0, 2.2], tx: 0.745, ty: 0.50, from: t(L[8].start) - 0.2, to: t(L[9].start) - 0.2, sfx: [['zapbig', 0.3, 0.55]] },
  // third eye → glide down onto the burst: ONE shot, never a second cut to D
  { ...D, glide: { tx: [0.58, 0.74], ty: [0.72, 0.862], z: [2.0, 2.1], at: t(L[10].start) - 0.35 },
    z: [1.0, 2.0], tx: 0.58, ty: 0.72, from: t(L[9].start) - 0.2, to: t(L[10].end) + 0.35,
    sfx: [['waterswish', 0, 0.4], ['future', 0.4, 0.5], ['splash', t(L[10].start) - 0.35 - (t(L[9].start) - 0.2), 0.8]] },
];
// the montage: fast flashes under the sped-up last line
const monStart = bounds[bounds.length - 1].to;
const monDur = (RAW[11].end - RAW[11].start) / MTEMPO + 0.5;
const monStep = monDur / MONTAGE.length;
MONTAGE.forEach((m, i) => {
  bounds.push({ img: m.img, pad: m.pad, z: [1.0, 1.15], tx: 0.5, ty: 0.5,
    from: monStart + i * monStep, to: monStart + (i + 1) * monStep, sfx: [[m.sfx, 0.05, 0.55]] });
});
const SHOTS = bounds.map(s => ({ ...s, dur: s.to - s.from }));

const work = fs.mkdtempSync(path.join(require('os').tmpdir(), 'water-reel-'));
const run = (a) => execFileSync(ffmpeg, a, { stdio: ['ignore', 'ignore', 'pipe'] });

// ── the shots ─────────────────────────────────────────────────────────────
// One input frame, zoompan duplicates it d frames; 3x upscale keeps the pan
// from stepping in whole source pixels. The zoom completes in ~1.1s
// (ease-out cubic — zippy) then drifts gently. A `glide` shot pans/zooms to
// a second target starting at glide.at, over ~0.9s.
const parts = [];
SHOTS.forEach((s, i) => {
  const d = Math.max(6, Math.round(s.dur * FPS));
  const [z0, z1] = s.z;
  const zf = Math.min(d - 1, Math.round(1.1 * FPS));
  const ease = `(1-pow(1-min(on/${zf},1),3))`;
  let zx = `${z0}+${(z1 - z0).toFixed(4)}*${ease}+0.03*on/${d}`;
  let txe = String(s.tx), tye = String(s.ty);
  if (s.glide) {
    const f1 = Math.round((s.glide.at - s.from) * FPS), fg = Math.round(0.9 * FPS);
    const g = `(1-pow(1-min(max((on-${f1})/${fg},0),1),2))`;
    txe = `(${s.glide.tx[0]}+${(s.glide.tx[1] - s.glide.tx[0]).toFixed(4)}*${g})`;
    tye = `(${s.glide.ty[0]}+${(s.glide.ty[1] - s.glide.ty[0]).toFixed(4)}*${g})`;
    zx = `${z0}+${(s.glide.z[0] - z0).toFixed(4)}*${ease}+${(s.glide.z[1] - s.glide.z[0]).toFixed(4)}*${g}`;
  }
  const x = `clip(${txe}*iw-(iw/zoom)/2,0,iw-iw/zoom)`;
  const y = `clip(${tye}*ih-(ih/zoom)/2,0,ih-ih/zoom)`;
  const dir = s.glide || i < bounds.length - MONTAGE.length ? IMG : MON;
  const src = fs.existsSync(path.join(IMG, s.img)) ? path.join(IMG, s.img) : path.join(MON, s.img);
  const out = path.join(work, `shot${String(i).padStart(2, '0')}.mp4`);
  run(['-y', '-i', src,
    '-vf', `scale=3072:4608,zoompan=z='${zx}':x='${x}':y='${y}':d=${d}:s=${W}x${H}:fps=${FPS},pad=${W}:${PADH}:(ow-iw)/2:(oh-ih)/2:color=0x${s.pad},format=yuv420p`,
    '-frames:v', String(d), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', out]);
  parts.push(out);
  console.log(`shot ${i + 1}/${SHOTS.length} done (${s.dur.toFixed(2)}s)`);
});

const list = path.join(work, 'list.txt');
fs.writeFileSync(list, parts.map(p => `file '${p}'`).join('\n'));
const silent = path.join(work, 'silent.mp4');
run(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);

// ── the audio ─────────────────────────────────────────────────────────────
// One take, two slices cut at silent breaks (never mid-speech): the main
// read at TEMPO, and the last line at MTEMPO under the montage. sfx sit
// under the voice; amix normalize=0, one limiter.
const mainEnd = (RAW[10].end + 0.25).toFixed(3);   // original-time trim of the main read
const monSlice = (RAW[11].start - 0.12).toFixed(3);
const inputs = ['-i', VO, '-i', VO];
const chains = [
  `[0:a]atrim=0:${mainEnd},atempo=${TEMPO},adelay=${Math.round(VOFF * 1000)}|${Math.round(VOFF * 1000)}[a0]`,
  `[1:a]atrim=start=${monSlice},atempo=${MTEMPO},adelay=${Math.round(monStart * 1000)}|${Math.round(monStart * 1000)}[a1]`,
];
SHOTS.forEach((s) => {
  s.sfx.forEach(([name, at, vol]) => {
    const ms = Math.round((s.from + at) * 1000);
    const idx = inputs.length / 2; // 2 argv entries per input file
    inputs.push('-i', path.join(SFX, `${name}.mp3`));
    chains.push(`[${idx}:a]volume=${vol},adelay=${ms}|${ms}[a${idx}]`);
  });
});
const total = (SHOTS[SHOTS.length - 1].to + 0.2).toFixed(2);
const mixIn = chains.map((_, i) => `[a${i}]`).join('');
const filter = chains.join(';') + `;${mixIn}amix=inputs=${chains.length}:normalize=0,alimiter=limit=0.95,apad[aout]`;
const audio = path.join(work, 'mix.m4a');
run(['-y', ...inputs, '-filter_complex', filter, '-map', '[aout]', '-t', total, '-c:a', 'aac', '-b:a', '192k', audio]);

run(['-y', '-i', silent, '-i', audio, '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', '-t', total, OUT]);
console.log(`done: ${OUT} (${total}s)`);
