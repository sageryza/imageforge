#!/usr/bin/env node
// test-filmeditor-render.js — a REAL render of a Film Editor cut through
// renderCut, with no Firestore: two solid-colour clips, a held still, and
// two sounds — one riding a clip, one free with a level and a fade-in —
// asserted with ffprobe/ffmpeg on the film that comes out. Then the picture
// is REORDERED and the anchored sound is shown to move with its clip while
// the free one stays put. Run: node scripts/test-filmeditor-render.js
//
// Fixtures are generated on the fly with ffmpeg-static and served from a
// tiny local http server, so the module's own downloadSource (the fetch
// path) is what fetches them; the doc carries https urls (the schema refuses
// anything else) and the test maps them onto the local server.
//
// The assertions are MEASUREMENTS — a frame's centre pixel, and a tone's
// level inside a window of the mix isolated by a bandpass (measured
// 2026-09-02: a tone that is there reads ~-25 dB, one that is not ~-57).

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync, spawnSync } = require('child_process');

const fe = require('../filmeditor');
const FF = require('ffmpeg-static');
const FP = require('ffprobe-static').path;

let pass = 0;
let failCount = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ok — ' + name); }
  else { failCount++; console.log('  FAIL — ' + name); }
}
const ff = (args) => execFileSync(FF, ['-y', '-loglevel', 'error', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
const ffprobe = (args) => execFileSync(FP, ['-v', 'error', ...args]).toString().trim();

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-render-'));
const fx = path.join(root, 'fx');
fs.mkdirSync(fx);

// ── fixtures ────────────────────────────────────────────────────────────
// red: 3s, with its own 220Hz tone (so piece mute is measurable);
// green: 3s, silent; blue: a PNG still; two tones, 440 and 880, 3s each.
ff(['-f', 'lavfi', '-i', 'color=c=red:size=320x240:rate=30:duration=3',
  '-f', 'lavfi', '-i', 'sine=frequency=220:duration=3',
  '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path.join(fx, 'red.mp4')]);
ff(['-f', 'lavfi', '-i', 'color=c=green:size=320x240:rate=30:duration=3',
  '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-an', path.join(fx, 'green.mp4')]);
ff(['-f', 'lavfi', '-i', 'color=c=blue:size=320x240:rate=1', '-frames:v', '1', path.join(fx, 'blue.png')]);
ff(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:a', 'pcm_s16le', path.join(fx, 'tone440.wav')]);
ff(['-f', 'lavfi', '-i', 'sine=frequency=880:duration=3', '-c:a', 'pcm_s16le', path.join(fx, 'tone880.wav')]);

// ── a tiny server, so downloadSource's fetch path is the one exercised ──
const server = http.createServer((req, res) => {
  const f = path.join(fx, path.basename(decodeURIComponent(req.url.split('?')[0])));
  if (!fs.existsSync(f)) { res.statusCode = 404; return res.end('nope'); }
  res.setHeader('Content-Type', 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
});

// ── measurements ─────────────────────────────────────────────────────────
const duration = (file) => parseFloat(ffprobe(['-show_entries', 'format=duration', '-of', 'csv=p=0', file]));
// the centre pixel's dominant channel at second t
function colourAt(file, t) {
  const raw = execFileSync(FF, ['-loglevel', 'error', '-ss', String(t), '-i', file, '-frames:v', '1',
    '-vf', 'crop=2:2:159:119,format=rgb24', '-f', 'rawvideo', '-']);
  const r = raw[0], g = raw[1], b = raw[2];
  const max = Math.max(r, g, b);
  if (max < 60) return 'dark';
  return r === max ? 'red' : g === max ? 'green' : 'blue';
}
// volumedetect reports on STDERR (ffmpeg's log), so the measurement reads
// the stderr of a spawn — execFileSync's return value is stdout alone.
function meanDb(args) {
  const r = spawnSync(FF, ['-loglevel', 'info', ...args, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /mean_volume:\s*(-?[\d.]+) dB/.exec(String(r.stderr || '') + String(r.stdout || ''));
  return m ? parseFloat(m[1]) : NaN;
}
// mean level (dB) of one tone inside a window, isolated by a bandpass
function toneLevel(file, hz, from, len) {
  return meanDb(['-ss', String(from), '-t', String(len), '-i', file,
    '-af', `bandpass=f=${hz}:width_type=q:w=30,volumedetect`]);
}
// the plain mean level of a window (no bandpass)
function level(file, from, len) {
  return meanDb(['-ss', String(from), '-t', String(len), '-i', file, '-af', 'volumedetect']);
}
const PRESENT = -45;   // a tone that is really there reads well above this
const ABSENT = -50;    // and one that is not reads well below it

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const U = (n) => 'https://fixtures.test/' + n;
  const download = (url, file) => fe.downloadSource(url.replace('https://fixtures.test/', base), file);

  const red = { key: 'red', url: U('red.mp4'), title: 'red', seconds: 3, in: 0, out: 3 };
  const green = { key: 'green', url: U('green.mp4'), title: 'green', seconds: 3, in: 0, out: 3 };
  const blue = { key: 'blue', kind: 'image', url: U('blue.png'), title: 'blue card', out: 2 };
  const sounds = [
    // rides the green clip — no `seconds` on purpose, so the render probes its length
    { key: 'ride', url: U('tone440.wav'), name: 'ride', anchor: { piece: 'green', offset: 0 } },
    // free at 1.0s, -6dB, half a second of fade-in
    { key: 'free', url: U('tone880.wav'), name: 'free', seconds: 3, at: 1, gain: -6, fadeIn: 0.5 },
  ];

  console.log('render 1 — red · blue still · green, the 440 riding green:');
  const dir1 = path.join(root, 'r1'); fs.mkdirSync(dir1);
  const labels = [];
  const r1 = await fe.renderCut({ clips: [red, blue, green], sounds }, {
    dir: dir1, download, progress: async (d, t, l) => { labels.push(l); },
  });
  ok(fs.existsSync(r1.file) && fs.statSync(r1.file).size > 1000, 'a film came out');
  ok(Math.abs(duration(r1.file) - 8) < 0.15, `the film is 8s — 3 + a 2s hold + 3 (got ${duration(r1.file).toFixed(2)})`);
  ok(r1.width === 320 && r1.height === 240, 'the canvas is the first VIDEO piece\'s frame');
  ok(r1.mixed === 2 && r1.clips.length === 3 && r1.sounds.length === 2, 'the render reports what it cut from');
  ok(labels.some((l) => /piece 2 of 3 — blue card/.test(l)) && labels.some((l) => /sound 1 of 2/.test(l)),
    'progress names each piece and each sound');
  ok(colourAt(r1.file, 1) === 'red', 'at 1s the frame is red');
  ok(colourAt(r1.file, 4) === 'blue', 'at 4s the frame is the blue still');
  ok(colourAt(r1.file, 7) === 'green', 'at 7s the frame is green');
  const a440in = toneLevel(r1.file, 440, 5.5, 2);
  const a440before = toneLevel(r1.file, 440, 0.2, 2.6);
  ok(a440in > PRESENT, `the 440 tone plays under the green clip (5.5–7.5s: ${a440in} dB)`);
  ok(a440before < ABSENT, `and is absent before it (0.2–2.8s: ${a440before} dB)`);
  const a880in = toneLevel(r1.file, 880, 1.6, 1.2);
  const a880before = toneLevel(r1.file, 880, 0.1, 0.8);
  ok(a880in > PRESENT, `the free 880 tone plays from 1s (1.6–2.8s: ${a880in} dB)`);
  ok(a880before < ABSENT, `and not before its clock time (0.1–0.9s: ${a880before} dB)`);
  const a220 = toneLevel(r1.file, 220, 0.1, 0.8);
  ok(a220 > PRESENT, `the red clip's own sound is kept at unity (220Hz 0.1–0.9s: ${a220} dB)`);
  // the level: the 880 alone (3.2–3.9s — red's tone ended at 3, the 440 starts at 5)
  // against the 440 alone (5.5–7.5s), same generator amplitude → the 6dB gain
  const lvl880 = level(r1.file, 3.2, 0.7);
  const lvl440 = level(r1.file, 5.5, 2);
  ok(Math.abs((lvl440 - lvl880) - 6) < 1.2, `the -6dB gain lands as ~6dB under the unity tone (${lvl440} vs ${lvl880})`);
  // the fade-in: the first 0.2s of the 880 is quieter than its settled middle
  const fadeHead = toneLevel(r1.file, 880, 1.02, 0.2);
  ok(fadeHead < a880in - 6, `the 0.5s fade-in makes the tone's first beat quieter (${fadeHead} vs ${a880in} dB)`);

  console.log('render 2 — green first, red muted: the 440 rides the move, the 880 stays:');
  const dir2 = path.join(root, 'r2'); fs.mkdirSync(dir2);
  const r2 = await fe.renderCut({ clips: [green, { ...red, mute: true }, blue], sounds }, { dir: dir2, download });
  ok(Math.abs(duration(r2.file) - 8) < 0.15, 'still 8s');
  ok(colourAt(r2.file, 1) === 'green' && colourAt(r2.file, 4) === 'red' && colourAt(r2.file, 7) === 'blue',
    'green at 1s, red at 4s, the still at 7s');
  const b440in = toneLevel(r2.file, 440, 0.5, 2);
  const b440late = toneLevel(r2.file, 440, 5.5, 2);
  ok(b440in > PRESENT, `the 440 moved with the green clip to the open (0.5–2.5s: ${b440in} dB)`);
  ok(b440late < ABSENT, `and is gone from where it used to be (5.5–7.5s: ${b440late} dB)`);
  const b880in = toneLevel(r2.file, 880, 1.6, 1.2);
  ok(b880in > PRESENT, `the free 880 still starts at its clock time (1.6–2.8s: ${b880in} dB)`);
  const b220 = toneLevel(r2.file, 220, 4.2, 0.7);
  ok(b220 < ABSENT, `the muted red clip lays down silence (220Hz 4.2–4.9s: ${b220} dB)`);

  console.log('render 3 — a cut of stills only, no sounds:');
  const dir3 = path.join(root, 'r3'); fs.mkdirSync(dir3);
  const r3 = await fe.renderCut({ clips: [blue, { ...blue, key: 'blue2', out: 1 }], sounds: [] }, { dir: dir3, download });
  ok(Math.abs(duration(r3.file) - 3) < 0.15 && r3.mixed === 0, 'two holds join to 3s with the picture lane muxed straight');
  ok(r3.width === 320 && r3.height === 240, 'the canvas comes from the first still when there is no footage');
  ok(colourAt(r3.file, 0.5) === 'blue' && colourAt(r3.file, 2.5) === 'blue', 'and it is the picture all the way through');

  console.log('refusals:');
  let refused = null;
  try { await fe.renderCut({ clips: [], sounds: [] }, { dir: root, download }); } catch (e) { refused = e.message; }
  ok(/empty/.test(refused || ''), 'an empty timeline is refused before anything runs');
  refused = null;
  const dir4 = path.join(root, 'r4'); fs.mkdirSync(dir4);
  try {
    await fe.renderCut({ clips: [red], sounds: [{ key: 'bad', url: U('blue.png'), name: 'a picture' }] }, { dir: dir4, download });
  } catch (e) { refused = e.message; }
  ok(/has no audio/.test(refused || ''), 'a sound with no audio stream fails the render honestly: ' + refused);

  console.log('the segment cache — a change to one shot re-cuts one shot:');
  // the key, pure
  const T = { width: 320, height: 240 };
  ok(fe.segKey(red, T) === fe.segKey({ ...red, key: 'other', title: 'renamed' }, T), 'the key ignores the piece\'s id and title');
  ok(fe.segKey(red, T) !== fe.segKey({ ...red, out: 2 }, T), 'a trim is a new key');
  ok(fe.segKey(red, T) !== fe.segKey({ ...red, gain: -6 }, T) && fe.segKey(red, T) !== fe.segKey({ ...red, mute: true }, T),
    'gain and mute are in the key (they change the PCM)');
  ok(fe.segKey(red, T) !== fe.segKey(red, { width: 640, height: 480 }), 'the canvas is in the key');
  ok(fe.segKey(blue, T) !== fe.segKey({ ...blue, out: 1 }, T), 'a still\'s hold is in the key');
  // an in-memory cache that records what the render asked of it
  const bank = new Map();
  const asked = { hits: 0, misses: 0, puts: 0 };
  const memCache = {
    async get(key, seg, wav) {
      const e = bank.get(key);
      if (!e) { asked.misses++; return false; }
      fs.writeFileSync(seg, e.seg); fs.writeFileSync(wav, e.wav); asked.hits++; return true;
    },
    async put(key, seg, wav) { bank.set(key, { seg: fs.readFileSync(seg), wav: fs.readFileSync(wav) }); asked.puts++; },
  };
  const downloads = [];
  const countingDownload = (url, file) => { downloads.push(url); return download(url, file); };
  const dir5 = path.join(root, 'r5'); fs.mkdirSync(dir5);
  const r5 = await fe.renderCut({ clips: [red, blue, green], sounds: [] }, { dir: dir5, download: countingDownload, cache: memCache });
  ok(asked.puts === 3 && asked.hits === 0 && r5.banked === 0, `a cold render banks every piece (${asked.puts} put, ${asked.hits} hit)`);
  downloads.length = 0;
  const labels5 = [];
  const dir6 = path.join(root, 'r6'); fs.mkdirSync(dir6);
  const r6 = await fe.renderCut({ clips: [red, { ...blue, out: 1 }, green], sounds: [] }, {
    dir: dir6, download: countingDownload, cache: memCache, progress: async (d, t, l) => { labels5.push(l); },
  });
  ok(asked.hits === 2 && asked.puts === 4 && r6.banked === 2, `the still's hold changed: two hits, one re-cut (${asked.hits} hit, ${asked.puts} put)`);
  ok(!downloads.includes(U('green.mp4')) && downloads.includes(U('blue.png')),
    'a banked piece is not even downloaded; the changed one is (' + downloads.map((u) => u.split('/').pop()).join(', ') + ')');
  ok(labels5.some((l) => /piece 3 of 3 — green \(banked\)/.test(l)), 'progress says which pieces came out of the bank');
  ok(Math.abs(duration(r6.file) - 7) < 0.15, `the film is 7s — 3 + a 1s hold + 3 (got ${duration(r6.file).toFixed(2)})`);
  ok(colourAt(r6.file, 1) === 'red' && colourAt(r6.file, 3.5) === 'blue' && colourAt(r6.file, 5.5) === 'green',
    'red at 1s, the shorter blue hold at 3.5s, green at 5.5s — banked segments join exactly as fresh ones');
  const c220 = toneLevel(r6.file, 220, 0.1, 0.8);
  ok(c220 > PRESENT, `the banked red clip still carries its own sound (220Hz: ${c220} dB)`);
  // a cache that dies never fails a render
  const dir7 = path.join(root, 'r7'); fs.mkdirSync(dir7);
  const broken = { async get() { throw new Error('storage down'); }, async put() { throw new Error('storage down'); } };
  const r7 = await fe.renderCut({ clips: [red], sounds: [] }, { dir: dir7, download, cache: broken });
  ok(fs.existsSync(r7.file) && r7.banked === 0, 'a cache that throws on both sides still renders');
  // a half-banked entry (the wav missing) is a miss, never a broken join
  const halfKey = fe.segKey(red, T);
  const halfCache = {
    async get(key, seg, wav) { const e = bank.get(key); if (!e || key !== halfKey) return false; fs.writeFileSync(seg, e.seg); return false; },
    async put() {},
  };
  const dir8 = path.join(root, 'r8'); fs.mkdirSync(dir8);
  const r8 = await fe.renderCut({ clips: [red], sounds: [] }, { dir: dir8, download, cache: halfCache });
  ok(Math.abs(duration(r8.file) - 3) < 0.15 && r8.banked === 0, 'a miss after a partial read re-cuts cleanly');

  server.close();
  fs.rmSync(root, { recursive: true, force: true });
  console.log('');
  console.log(pass + ' passed, ' + failCount + ' failed');
  process.exit(failCount ? 1 : 0);
})().catch((e) => {
  console.error('test-filmeditor-render crashed:', e);
  server.close();
  process.exit(1);
});
