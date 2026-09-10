'use strict';
// node scripts/test-video-floor.js
//
// The pixel-floor guard: the rule pure, then a REAL encode.
//
// The end-to-end half matters more than it looks. `planUpscale` answering a
// big enough canvas proves nothing about whether the file that reaches the
// door really carries those pixels — an ffmpeg scale filter with the
// arguments in the wrong order, or an even-rounding that libx264 quietly
// adjusts, both leave a plan that reads perfect and a clip still under the
// floor. So the test encodes a genuinely too-small clip through the same
// filter footage.js uses and MEASURES the result with ffprobe.

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const floor = require('../video-floor');

let fail = 0;
const ok = (cond, what) => { console.log((cond ? '  ok   ' : '  FAIL ') + what); if (!cond) fail++; };

console.log('the rule');
{
  // Her real refused clip.
  const p = floor.planUpscale(480, 360);
  ok(p && p.pixels >= floor.MIN_PIXELS, `480x360 is lifted over the floor (${p && p.pixels})`);
  ok(p && Math.abs((p.w / p.h) - (480 / 360)) < 0.02, 'the aspect is kept');
  ok(p && p.w % 2 === 0 && p.h % 2 === 0, 'both edges are even');
  ok(p && p.from.pixels === 172800, 'it remembers what it was');

  // The clip that DID draw — nothing is baked for it, which is what keeps
  // the guard free on the common case.
  ok(floor.planUpscale(560, 752) === null, '560x752 already clears the floor, so no copy');
  ok(floor.planUpscale(854, 480) === null, '854x480 clears it too');

  // A failed probe must never become invented dimensions.
  ok(floor.planUpscale(0, 0) === null, 'a zero answers null');
  ok(floor.planUpscale(null, 480) === null, 'a missing width answers null');
  ok(floor.planUpscale('x', 'y') === null, 'nonsense answers null');

  // Lopsided shapes are where even-rounding is most likely to land short.
  for (const [w, h] of [[320, 240], [240, 320], [160, 640], [640, 160], [100, 100], [2, 2], [426, 240]]) {
    const q = floor.planUpscale(w, h);
    ok(q && q.pixels >= floor.MIN_PIXELS, `${w}x${h} clears the floor (${q && q.w}x${q && q.h})`);
    ok(q && q.pixels <= floor.MAX_PIXELS, `${w}x${h} stays under the ceiling`);
  }

  // The note is the loud half — a silent transform is the thing the house
  // rule forbids.
  const note = floor.upscaleNote(floor.planUpscale(480, 360), 'clip.mov');
  ok(/480×360/.test(note), 'the note says what it was');
  ok(/untouched/.test(note), 'the note says her original is untouched');
  ok(floor.upscaleNote(null, 'clip.mov') === '', 'no plan, no note');
}

console.log('a real encode');
{
  let ffmpeg = null, ffprobe = null;
  try { ffmpeg = require('ffmpeg-static'); ffprobe = require('ffprobe-static').path; } catch { /* below */ }
  if (!ffmpeg || !ffprobe) {
    console.log('  skip  ffmpeg/ffprobe not installed');
  } else {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'floor-test-'));
    const small = path.join(dir, 'small.mp4');
    const big = path.join(dir, 'big.mp4');
    // 480x360 — her clip's shape, and under the floor.
    spawnSync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'testsrc=size=480x360:rate=24:duration=1',
      '-pix_fmt', 'yuv420p', small], { stdio: 'ignore' });
    ok(fs.existsSync(small), 'built a too-small fixture');

    const size = (file) => {
      const r = spawnSync(ffprobe, ['-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height', '-of', 'json', file], { encoding: 'utf8' });
      const st = JSON.parse(r.stdout).streams[0];
      return { w: st.width, h: st.height };
    };
    const was = size(small);
    ok(was.w * was.h < floor.MIN_PIXELS, `the fixture is under the floor (${was.w}x${was.h})`);

    const plan = floor.planUpscale(was.w, was.h);
    // The exact filter footage.js uses.
    spawnSync(ffmpeg, ['-y', '-i', small, '-vf', `scale=${plan.w}:${plan.h}:flags=lanczos`,
      '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', big], { stdio: 'ignore' });
    ok(fs.existsSync(big), 'the encode produced a file');
    const now = size(big);
    ok(now.w === plan.w && now.h === plan.h, `the file really carries the planned canvas (${now.w}x${now.h})`);
    ok(now.w * now.h >= floor.MIN_PIXELS, 'the file clears the floor');
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log('the wiring');
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'footage.js'), 'utf8');
  ok(/body\.referenceVideoUrls = floored\.urls/.test(src), 'the SENT urls are the floored ones');
  ok(/const extra = \{ door: d\.door, refs,/.test(src), 'the card still shows her own references');
  ok(/if \(floored\.notes\.length\) extra\.note/.test(src), 'a baked copy is disclosed on the job');
  ok(/footage\/upscaled\//.test(src), 'the copy is a new object, never her original');
  const page = fs.readFileSync(path.join(__dirname, '..', 'public', 'footage.html'), 'utf8');
  ok(/note: d\.note \|\| ''/.test(page), 'the page shows the note without waiting for a reload');
}

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
