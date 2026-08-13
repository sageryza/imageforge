#!/usr/bin/env node
/**
 * Stitch a Darius film: the cut interview audio + the art, one file.
 *
 *   node scripts/darius-stitch.js <heart|proof> [--out film.mp4]
 *
 * Reads .darius-film/<set>.json (the shots and their clip urls, written by
 * darius-film.js) and the ORDER below, and gives every shot's pictures an
 * equal share of THAT shot's audio — so the picture always changes on the
 * sentence it belongs to, never on a clock.
 *
 * Two things here are load-bearing and both are earned elsewhere in this repo:
 *
 *  - **The per-shot audio is concatenated as PCM, never as mp3/aac.** Every
 *    concatenated aac file adds encoder priming (~24ms a join, measured in the
 *    Scratch Pad film) and eleven joins walks the voice out from under the
 *    pictures. Decode to wav, concatenate sample-exact, encode ONCE at the mux.
 *  - **His voice is never loudnormed.** These clips come out of the Episode
 *    Editor already levelled; nothing here touches the dynamics again.
 *
 * A picture is used at whatever quality it exists: the medium single render
 * when that landed, else the 512x768 panel cut out of the low sheet. Which one
 * each shot got is printed, and written to .darius-film/film.json.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, '.darius-film');
const PANELS = path.join(DIR, 'panels');
const SET = process.argv.find((a) => a === 'heart' || a === 'proof') || 'heart';
const MEDIUM = {
  heart: ['/home/user/out/darius-heart-medium', '/home/user/out/darius-heart-medium-2'],
  proof: ['/home/user/out/darius-proof-medium'],
}[SET];
const W = 1024, H = 1536;

// ffmpeg-static exports the path as a bare STRING; ffprobe-static exports
// { path }. Handle both rather than assuming they match.
const bin = (pkg, name) => {
  try { const m = require(pkg); return typeof m === 'string' ? m : m.path; } catch (_) { return name; }
};
const FFMPEG = process.env.FFMPEG_PATH || bin('ffmpeg-static', 'ffmpeg');
const FFPROBE = process.env.FFPROBE_PATH || bin('ffprobe-static', 'ffprobe');
const run = (b, a) => execFileSync(b, a, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
const dur = (f) => +run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration',
  '-of', 'default=nw=1:nk=1', f]).toString().trim();

/* THE RUNNING ORDER — every picture, in the order it appears, under the shot
   whose words it belongs to. Written out rather than derived: the order inside
   a shot is a judgement about what the sentence is doing (state the idea, then
   widen it), and a file listing can't hold that.
   Each shot's audio is divided equally between its pictures, so the count here
   is also the pacing — no shot may hold one still for its whole span. */
const ORDERS = { heart: {
  s01: ['dp-heart-spectrum-a', 'dp-heart-spectrum-b', 'dp-heart-mechanism-d'],
  s02: ['dp-heart-mechanism-a', 'dp-heart-mechanism-b'],
  s03: ['dp-heart-paralysis-a', 'dp-heart-paralysis-b', 'dp-heart-paralysis-c'],
  s04: ['dp-heart-mechanism-c', 'dp-heart-paralysis-d'],
  s05: ['dp-heart-soul-physical-a', 'dp-heart-soul-physical-b', 'dp-heart-soul-physical-c', 'dp-heart-soul-physical-d'],
  s06: ['dp-heart-spectrum-c', 'dp-heart-spectrum-d'],
  s07: ['dp-heart-field-analogies-a', 'dp-heart-more-a-a', 'dp-heart-more-b-a'],
  s08: ['dp-heart-field-analogies-b', 'dp-heart-more-a-b', 'dp-heart-more-b-b'],
  s09: ['dp-heart-field-analogies-c', 'dp-heart-more-a-c', 'dp-heart-more-b-c'],
  s10: ['dp-heart-field-analogies-d', 'dp-heart-more-a-d', 'dp-heart-more-b-d'],
  s11: ['dp-heart-energy-c', 'dp-heart-energy-d', 'dp-heart-energy-a'],
}, proof: {
  s01: ['dp-proof-accounts-c', 'dp-proof-friends-tv', 'dp-proof-overheard'],
  s02: ['dp-proof-whiteboard-a', 'dp-proof-whiteboard-b', 'dp-proof-whiteboard-c'],
  s03: ['dp-proof-whiteboard-d', 'dp-proof-group-slip'],
  s04: ['dp-proof-science-empty-chair', 'dp-proof-statements', 'dp-proof-accounts-d'],
  s05: ['dp-proof-accounts-a', 'dp-proof-son-camp', 'dp-proof-accounts-b'],
  s06: ['dp-proof-agency-window', 'dp-proof-viewing-room', 'dp-proof-files'],
  s07: ['dp-pyramid-tunnels-a', 'dp-pyramid-tunnels-b', 'dp-pyramid-tunnels-c', 'dp-pyramid-tunnels-d'],
} };

const ORDER = ORDERS[SET];

/* Medium if it landed, else the panel cut out of the low sheet — Sophie's rule
   for this pass: re-render the ones worth it, use the low panel where not. */
function pictureFor(panel) {
  // BOTH suffixes: a panel lifted out of a 2x2 sheet is re-rendered as
  // "<panel>-m.webp", but a picture drawn straight at medium (one that never
  // had a sheet) is just "<panel>.webp". Checking only the first silently
  // dropped nine of proof's pictures and left one still per span.
  for (const dir of MEDIUM) {
    for (const name of [panel + '-m.webp', panel + '.webp']) {
      const f = path.join(dir, name);
      if (fs.existsSync(f)) return { file: f, quality: 'medium' };
    }
  }
  const low = path.join(PANELS, panel + '.png');
  if (fs.existsSync(low)) return { file: low, quality: 'low panel' };
  return null;
}

async function main() {
  const out = (() => { const i = process.argv.indexOf('--out'); return i > -1 ? process.argv[i + 1] : path.join(DIR, SET + '-v1.mp4'); })();
  const st = JSON.parse(fs.readFileSync(path.join(DIR, SET + '.json'), 'utf8'));
  const work = fs.mkdtempSync(path.join(DIR, 'stitch-'));
  const audioDir = path.join(DIR, 'audio-' + SET);
  fs.mkdirSync(audioDir, { recursive: true });

  const wavs = [], segs = [], record = [];
  let n = 0;

  for (const shot of st.shots) {
    const url = (st.clips || {})[shot.id];
    if (!url) { console.log('  skip', shot.id, '— no audio'); continue; }
    const mp3 = path.join(audioDir, shot.id + '.mp3');
    if (!fs.existsSync(mp3)) fs.writeFileSync(mp3, Buffer.from(await (await fetch(url)).arrayBuffer()));

    // Decode to a common PCM format so the eleven join sample-exact.
    const wav = path.join(work, shot.id + '.wav');
    run(FFMPEG, ['-y', '-i', mp3, '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', wav]);
    wavs.push(wav);

    const D = dur(wav);
    // A missing picture is LOUD. Filtering silently is what let nine
    // suffix-mismatched pictures vanish into a film that still built.
    const want = ORDER[shot.id] || [];
    const panels = want.map(pictureFor);
    const gone = want.filter((_, i) => !panels[i]);
    if (gone.length) throw new Error(`${shot.id}: no picture for ${gone.join(', ')}`);
    if (!panels.length) throw new Error('no pictures listed for ' + shot.id);
    const each = D / panels.length;

    for (const p of panels) {
      const seg = path.join(work, `v${String(++n).padStart(3, '0')}.mp4`);
      // Pad rather than crop: a 2:3 picture already fits, and padding can never
      // cut the top off a drawing if one ever arrives a different shape.
      run(FFMPEG, ['-y', '-loop', '1', '-i', p.file, '-t', each.toFixed(3),
        '-vf', `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=white,format=yuv420p`,
        '-r', '24', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', seg]);
      segs.push(seg);
    }
    record.push({ shot: shot.id, name: shot.name, seconds: +D.toFixed(2), pictures: panels.map((p) => ({ file: path.basename(p.file), quality: p.quality })) });
    console.log(`  ${shot.id}  ${D.toFixed(1).padStart(5)}s  ${panels.length} pic  ${panels.map((p) => p.quality === 'medium' ? 'M' : 'l').join('')}  ${shot.name.slice(0, 44)}`);
  }

  const list = (files, f) => { fs.writeFileSync(f, files.map((x) => `file '${x}'`).join('\n') + '\n'); return f; };
  const track = path.join(work, 'track.wav');
  run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', list(wavs, path.join(work, 'a.txt')), '-c', 'copy', track]);
  const silent = path.join(work, 'silent.mp4');
  run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', list(segs, path.join(work, 'v.txt')), '-c', 'copy', silent]);

  // One encode of the audio, at the mux — never a concat of encoded pieces.
  run(FFMPEG, ['-y', '-i', silent, '-i', track, '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);

  const total = dur(out);
  fs.writeFileSync(path.join(DIR, SET + '-film.json'), JSON.stringify({ out, seconds: +total.toFixed(2), shots: record }, null, 1));
  fs.rmSync(work, { recursive: true, force: true });
  console.log(`\n${out} · ${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')} · ${segs.length} pictures`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
