#!/usr/bin/env node
// The "MORE WATER, RIGHT NOW" reel — Sophie's four hearted Playground images
// (Dreamy style, 2026-08-24: the drink-more-water study, three crazy reasons
// each) turned into one 9:16 reel: each image establishes full-frame, then
// zooms onto each of its three ideas, with ElevenLabs sound effects (whooshes,
// gurgles, surf, zaps) mixed underneath. Costs nothing to re-render — the SFX
// are generated once and reused from --sfx.
//
//   node scripts/water-reel/build.js --images <dir> --sfx <dir> --out <mp4>
//
// <dir> must hold the four webp files named in SHOTS below (the Playground's
// own Storage filenames, so provenance is readable); --sfx the mp3s named in
// the audio maps. ffmpeg comes from ffmpeg-static. The zoom targets are
// fractions of the 1024x1536 canvas, read off the pictures by eye — a new
// image needs its own eyeballing, nothing derives them.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('ffmpeg-static');

const args = {};
process.argv.slice(2).forEach((a, i, all) => { if (a.startsWith('--')) args[a.slice(2)] = all[i + 1]; });
const IMG = args.images, SFX = args.sfx, OUT = args.out || 'water-reel.mp4';
if (!IMG || !SFX) { console.error('need --images <dir> --sfx <dir>'); process.exit(1); }

const FPS = 30, W = 1080, H = 1620, PADH = 1920; // 2:3 art on a 9:16 canvas

// Reel order: the earnest one sets up the joke, the zappy one ends it.
// Each image: full-frame beat, then its three ideas left→right. sfx entries
// are [file, atSecondsIntoShot, volume].
const SHOTS = [
  // A — the straight take (hydrates / brain / smiley). Fulls end at z=1.0 so
  // the WHOLE poster is on screen (v2, Sophie); zooms launch from that full
  // frame and land framed on the panel rect, measured off the picture.
  { img: '1787619512551-35kqb3.webp', pad: 'f1d3a5', dur: 2.2, z: [1.06, 1.0], tx: 0.5, ty: 0.5, sfx: [['pour', 0, 0.9]] },
  { img: '1787619512551-35kqb3.webp', pad: 'f1d3a5', dur: 2.2, z: [1.0, 3.0], tx: 0.215, ty: 0.561, sfx: [['waterswish', 0, 0.5], ['gurgle', 0.3, 0.9]] },
  { img: '1787619512551-35kqb3.webp', pad: 'f1d3a5', dur: 2.2, z: [1.0, 3.0], tx: 0.503, ty: 0.561, sfx: [['waterswish', 0, 0.5], ['sparkle', 0.3, 0.9]] },
  { img: '1787619512551-35kqb3.webp', pad: 'f1d3a5', dur: 2.2, z: [1.0, 3.0], tx: 0.79, ty: 0.561, sfx: [['waterswish', 0, 0.5], ['chime', 0.3, 0.9]] },
  // C — funnel head / singing sweat fish / bones are secretly plants
  { img: '1787620392223-lfveov.webp', pad: 'eacfa1', dur: 2.0, z: [1.06, 1.0], tx: 0.5, ty: 0.5, sfx: [['gulp', 0, 0.9]] },
  { img: '1787620392223-lfveov.webp', pad: 'eacfa1', dur: 2.2, z: [1.0, 2.1], tx: 0.188, ty: 0.635, sfx: [['waterswish', 0, 0.5], ['pour', 0.3, 0.75]] },
  { img: '1787620392223-lfveov.webp', pad: 'eacfa1', dur: 2.2, z: [1.0, 2.1], tx: 0.50, ty: 0.635, sfx: [['waterswish', 0, 0.5], ['plinks', 0.3, 0.9]] },
  { img: '1787620392223-lfveov.webp', pad: 'eacfa1', dur: 2.2, z: [1.0, 2.1], tx: 0.81, ty: 0.635, sfx: [['waterswish', 0, 0.5], ['sparkle', 0.3, 0.85]] },
  // B — the night one (ear goblins / liquid light / boat in your stomach)
  { img: '1787620306161-xsmta2.webp', pad: 'ebcc97', dur: 2.0, z: [1.06, 1.0], tx: 0.5, ty: 0.5, sfx: [['splash', 0, 0.9]] },
  { img: '1787620306161-xsmta2.webp', pad: 'ebcc97', dur: 2.2, z: [1.0, 2.55], tx: 0.195, ty: 0.615, sfx: [['waterswish', 0, 0.5], ['goblin', 0.3, 0.95]] },
  { img: '1787620306161-xsmta2.webp', pad: 'ebcc97', dur: 2.2, z: [1.0, 2.55], tx: 0.49, ty: 0.615, sfx: [['waterswish', 0, 0.5], ['sparkle', 0.3, 0.85]] },
  { img: '1787620306161-xsmta2.webp', pad: 'ebcc97', dur: 2.4, z: [1.0, 2.55], tx: 0.80, ty: 0.615, sfx: [['waterswish', 0, 0.5], ['surf', 0.3, 1.0]] },
  // D — the zappy finale (spine ghosts / liquid lightning / third-eye knee)
  { img: '1787620455292-5g1ynr.webp', pad: 'eacda1', dur: 2.0, z: [1.06, 1.0], tx: 0.5, ty: 0.5, sfx: [['zap', 0, 0.85]] },
  { img: '1787620455292-5g1ynr.webp', pad: 'eacda1', dur: 2.2, z: [1.0, 2.05], tx: 0.29, ty: 0.465, sfx: [['waterswish', 0, 0.5], ['spooky', 0.3, 0.9]] },
  { img: '1787620455292-5g1ynr.webp', pad: 'eacda1', dur: 2.2, z: [1.0, 2.2], tx: 0.745, ty: 0.50, sfx: [['waterswish', 0, 0.5], ['zapbig', 0.25, 1.0]] },
  { img: '1787620455292-5g1ynr.webp', pad: 'eacda1', dur: 2.2, z: [1.0, 2.0], tx: 0.58, ty: 0.72, sfx: [['waterswish', 0, 0.5], ['future', 0.3, 0.9]] },
  // end card: "MORE WATER. RIGHT NOW."
  { img: '1787620455292-5g1ynr.webp', pad: 'eacda1', dur: 2.5, z: [1.2, 1.95], tx: 0.74, ty: 0.862, sfx: [['splash', 0.3, 0.95], ['zapbig', 0.6, 0.9]] },
];

const work = fs.mkdtempSync(path.join(require('os').tmpdir(), 'water-reel-'));
const run = (a) => execFileSync(ffmpeg, a, { stdio: ['ignore', 'ignore', 'pipe'] });

// ── the shots ─────────────────────────────────────────────────────────────
// One input frame, zoompan duplicates it d frames. The 3x upscale before
// zoompan is what keeps the pan from stepping in whole source pixels.
// Ease-out cubic: fast zippy start, settles on the target.
const parts = [];
SHOTS.forEach((s, i) => {
  const d = Math.round(s.dur * FPS);
  const [z0, z1] = s.z;
  const ease = `(1-pow(1-on/${d - 1},3))`;
  const zx = `${z0}+${(z1 - z0).toFixed(4)}*${ease}`;
  const x = `clip(${s.tx}*iw-(iw/zoom)/2,0,iw-iw/zoom)`;
  const y = `clip(${s.ty}*ih-(ih/zoom)/2,0,ih-ih/zoom)`;
  const out = path.join(work, `shot${String(i).padStart(2, '0')}.mp4`);
  run(['-y', '-i', path.join(IMG, s.img),
    '-vf', `scale=3072:4608,zoompan=z='${zx}':x='${x}':y='${y}':d=${d}:s=${W}x${H}:fps=${FPS},pad=${W}:${PADH}:(ow-iw)/2:(oh-ih)/2:color=0x${s.pad},format=yuv420p`,
    '-frames:v', String(d), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', out]);
  parts.push(out);
  console.log(`shot ${i + 1}/${SHOTS.length} done`);
});

const list = path.join(work, 'list.txt');
fs.writeFileSync(list, parts.map(p => `file '${p}'`).join('\n'));
const silent = path.join(work, 'silent.mp4');
run(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);

// ── the audio ─────────────────────────────────────────────────────────────
// Every sfx is delayed to its shot's start and mixed in one amix
// (normalize=0 — the default halves everything, the film editor's finding).
let t = 0; const inputs = [], chains = [];
SHOTS.forEach((s) => {
  s.sfx.forEach(([name, at, vol]) => {
    const ms = Math.round((t + at) * 1000);
    const idx = inputs.length / 2; // 2 argv entries per input file
    inputs.push('-i', path.join(SFX, `${name}.mp3`));
    chains.push(`[${idx}:a]volume=${vol},adelay=${ms}|${ms}[a${idx}]`);
  });
  t += s.dur;
});
const total = t.toFixed(2);
const mixIn = chains.map((_, i) => `[a${i}]`).join('');
const filter = chains.join(';') + `;${mixIn}amix=inputs=${chains.length}:normalize=0,alimiter=limit=0.95,apad[aout]`;
const audio = path.join(work, 'mix.m4a');
run(['-y', ...inputs, '-filter_complex', filter, '-map', '[aout]', '-t', total, '-c:a', 'aac', '-b:a', '192k', audio]);

run(['-y', '-i', silent, '-i', audio, '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', '-t', total, OUT]);
console.log(`done: ${OUT} (${total}s)`);
