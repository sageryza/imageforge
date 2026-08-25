#!/usr/bin/env node
// The "MORE WATER, RIGHT NOW" reel v3 — Sophie's four hearted Playground
// images (Dreamy, 2026-08-24) as one 9:16 reel with HER VOICE reading the
// poster's own captions. The VO is ONE ElevenLabs take (the sophie-audio
// rule — per-line calls change register at every cut), whisper word
// timestamps give each line its span (votimes.json), and every shot's
// duration is DERIVED from its line so the picture sits on the words.
// The earnest image (A) flashes by quickly under the opening line — its
// reasons are normal, nobody needs to read them (v3, Sophie).
//
//   node build.js --images <dir> --sfx <dir> --vo vo.mp3 \
//                 --votimes votimes.json --out <mp4>
//
// votimes.json = [{start,end}] per line in VO time, 11 lines:
// 1 = the study intro (image A), 2-4 = C's reasons, 5-7 = B's, 8-10 = D's,
// 11 = "More water! Right now!". Zoom targets are fractions of the
// 1024x1536 canvas, read off the pictures by eye and verified frame by
// frame — nothing derives them.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('ffmpeg-static');

const args = {};
process.argv.slice(2).forEach((a, i, all) => { if (a.startsWith('--')) args[a.slice(2)] = all[i + 1]; });
const IMG = args.images, SFX = args.sfx, OUT = args.out || 'water-reel.mp4';
const VO = args.vo, VOTIMES = args.votimes;
if (!IMG || !SFX || !VO || !VOTIMES) { console.error('need --images --sfx --vo --votimes'); process.exit(1); }

const FPS = 30, W = 1080, H = 1620, PADH = 1920; // 2:3 art on a 9:16 canvas
const VOFF = 0.4; // the VO starts this far into the reel
const L = JSON.parse(fs.readFileSync(VOTIMES)); // 11 line spans, VO time
const t = (s) => s + VOFF;

const A = { img: '1787619512551-35kqb3.webp', pad: 'f1d3a5' };
const C = { img: '1787620392223-lfveov.webp', pad: 'eacfa1' };
const B = { img: '1787620306161-xsmta2.webp', pad: 'ebcc97' };
const D = { img: '1787620455292-5g1ynr.webp', pad: 'eacda1' };

// A's flashes split line 1 unevenly: the full poster while the study line
// lands, then the three panels as quick flashes.
const aEnd = t(L[0].end) + 0.2;
const aFull = t(L[0].end * 0.40);
const aStep = (aEnd - aFull) / 3;

// A zoom shot runs from just before its line to just before the next line
// (or its section's end); the full-poster beats live in the VO's breaks.
const bounds = [
  { ...A, z: [1.06, 1.0], tx: 0.5, ty: 0.5, from: 0, to: aFull, sfx: [['pour', 0, 0.6]] },
  { ...A, z: [1.0, 3.0], tx: 0.215, ty: 0.561, from: aFull, to: aFull + aStep, sfx: [['waterswish', 0, 0.35]] },
  { ...A, z: [1.0, 3.0], tx: 0.503, ty: 0.561, from: aFull + aStep, to: aFull + 2 * aStep, sfx: [['waterswish', 0, 0.35]] },
  { ...A, z: [1.0, 3.0], tx: 0.79, ty: 0.561, from: aFull + 2 * aStep, to: aEnd, sfx: [['waterswish', 0, 0.35]] },
  { ...C, z: [1.06, 1.0], tx: 0.5, ty: 0.5, from: aEnd, to: t(L[1].start) - 0.25, sfx: [['gulp', 0, 0.75]] },
  { ...C, z: [1.0, 2.1], tx: 0.188, ty: 0.635, from: t(L[1].start) - 0.25, to: t(L[2].start) - 0.25, sfx: [['waterswish', 0, 0.4], ['pour', 0.4, 0.4]] },
  { ...C, z: [1.0, 2.1], tx: 0.50, ty: 0.635, from: t(L[2].start) - 0.25, to: t(L[3].start) - 0.25, sfx: [['waterswish', 0, 0.4], ['plinks', 0.4, 0.5]] },
  { ...C, z: [1.0, 2.1], tx: 0.81, ty: 0.635, from: t(L[3].start) - 0.25, to: t(L[3].end) + 0.2, sfx: [['waterswish', 0, 0.4], ['sparkle', 0.4, 0.45]] },
  { ...B, z: [1.06, 1.0], tx: 0.5, ty: 0.5, from: t(L[3].end) + 0.2, to: t(L[4].start) - 0.25, sfx: [['splash', 0, 0.75]] },
  { ...B, z: [1.0, 2.55], tx: 0.195, ty: 0.615, from: t(L[4].start) - 0.25, to: t(L[5].start) - 0.25, sfx: [['waterswish', 0, 0.4], ['goblin', 0.4, 0.55]] },
  { ...B, z: [1.0, 2.55], tx: 0.49, ty: 0.615, from: t(L[5].start) - 0.25, to: t(L[6].start) - 0.25, sfx: [['waterswish', 0, 0.4], ['sparkle', 0.4, 0.45]] },
  { ...B, z: [1.0, 2.55], tx: 0.80, ty: 0.615, from: t(L[6].start) - 0.25, to: t(L[6].end) + 0.2, sfx: [['waterswish', 0, 0.4], ['surf', 0.4, 0.55]] },
  { ...D, z: [1.06, 1.0], tx: 0.5, ty: 0.5, from: t(L[6].end) + 0.2, to: t(L[7].start) - 0.25, sfx: [['zap', 0, 0.7]] },
  { ...D, z: [1.0, 2.05], tx: 0.29, ty: 0.465, from: t(L[7].start) - 0.25, to: t(L[8].start) - 0.25, sfx: [['waterswish', 0, 0.4], ['spooky', 0.4, 0.5]] },
  { ...D, z: [1.0, 2.2], tx: 0.745, ty: 0.50, from: t(L[8].start) - 0.25, to: t(L[9].start) - 0.25, sfx: [['waterswish', 0, 0.4], ['zapbig', 0.3, 0.55]] },
  { ...D, z: [1.0, 2.0], tx: 0.58, ty: 0.72, from: t(L[9].start) - 0.25, to: t(L[10].start) - 0.3, sfx: [['waterswish', 0, 0.4], ['future', 0.4, 0.5]] },
  { ...D, z: [1.2, 1.95], tx: 0.74, ty: 0.862, from: t(L[10].start) - 0.3, to: t(L[10].end) + 1.3, sfx: [['splash', 0.2, 0.8], ['zapbig', 0.6, 0.6]] },
];
const SHOTS = bounds.map(s => ({ ...s, dur: s.to - s.from }));

const work = fs.mkdtempSync(path.join(require('os').tmpdir(), 'water-reel-'));
const run = (a) => execFileSync(ffmpeg, a, { stdio: ['ignore', 'ignore', 'pipe'] });

// ── the shots ─────────────────────────────────────────────────────────────
// One input frame, zoompan duplicates it d frames; 3x upscale keeps the pan
// from stepping in whole source pixels. The zoom completes in ~1.3s
// (ease-out cubic — zippy) whatever the shot's length, then drifts on
// gently, so a long line doesn't mean a slow-motion zoom.
const parts = [];
SHOTS.forEach((s, i) => {
  const d = Math.max(8, Math.round(s.dur * FPS));
  const [z0, z1] = s.z;
  const zf = Math.min(d - 1, Math.round(1.3 * FPS));
  const ease = `(1-pow(1-min(on/${zf},1),3))`;
  const zx = `${z0}+${(z1 - z0).toFixed(4)}*${ease}+0.03*on/${d}`;
  const x = `clip(${s.tx}*iw-(iw/zoom)/2,0,iw-iw/zoom)`;
  const y = `clip(${s.ty}*ih-(ih/zoom)/2,0,ih-ih/zoom)`;
  const out = path.join(work, `shot${String(i).padStart(2, '0')}.mp4`);
  run(['-y', '-i', path.join(IMG, s.img),
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
// The VO rides whole at VOFF (one take, never spliced — and never
// loudnormed); every sfx is delayed to its shot's start and sits under it.
// amix normalize=0 (the default halves everything — the film editor's
// finding), one limiter over the mix.
const inputs = ['-i', VO];
const chains = [`[0:a]adelay=${Math.round(VOFF * 1000)}|${Math.round(VOFF * 1000)}[a0]`];
SHOTS.forEach((s) => {
  s.sfx.forEach(([name, at, vol]) => {
    const ms = Math.round((s.from + at) * 1000);
    const idx = inputs.length / 2; // 2 argv entries per input file
    inputs.push('-i', path.join(SFX, `${name}.mp3`));
    chains.push(`[${idx}:a]volume=${vol},adelay=${ms}|${ms}[a${idx}]`);
  });
});
const total = SHOTS[SHOTS.length - 1].to.toFixed(2);
const mixIn = chains.map((_, i) => `[a${i}]`).join('');
const filter = chains.join(';') + `;${mixIn}amix=inputs=${chains.length}:normalize=0,alimiter=limit=0.95,apad[aout]`;
const audio = path.join(work, 'mix.m4a');
run(['-y', ...inputs, '-filter_complex', filter, '-map', '[aout]', '-t', total, '-c:a', 'aac', '-b:a', '192k', audio]);

run(['-y', '-i', silent, '-i', audio, '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', '-t', total, OUT]);
console.log(`done: ${OUT} (${total}s)`);
