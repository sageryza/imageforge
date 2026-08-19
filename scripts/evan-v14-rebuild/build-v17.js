// evan-v17 — her ten timestamped notes from the tap-to-note player, fixed.
// Every edit below was measured (windowed word-timestamp transcription of the
// source, RMS scan for the room tone) before being applied.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const REPO = '/home/user/imageforge';
const FFMPEG = require(path.join(REPO, 'node_modules', 'ffmpeg-static'));
const FFPROBE = require(path.join(REPO, 'node_modules', 'ffprobe-static')).path;
const D = __dirname;
const W = 1000, H = 1500, FPS = 30, BG = '#f7f3ea';
const FILM = 'https://storage.googleapis.com/membry-df528.firebasestorage.app/story/films/evan-v7-lite.mp3';
const MSCI = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/evan-v17/msci-scientist-in-england-v2.mp3';
const S45 = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/evan-v17/s45-actual-hit-rate.mp3';
const EYE = 'https://storage.googleapis.com/membry-df528.firebasestorage.app/story/evan-eye-mind-1787173362902.png';
const QUIET = { t0: 102.26, t1: 102.51 }; // measured −77dB peak; the old 2.95 sliver peaked −60.7dB (the ring)

const { merged } = JSON.parse(fs.readFileSync(path.join(D, 'parts-v15.json'), 'utf8'));
const imgs = JSON.parse(fs.readFileSync(path.join(D, 'imgs.json'), 'utf8'));
const S = JSON.parse(fs.readFileSync(path.join(D, 'assets-evan-story-visual-summary.json'), 'utf8')).assets;
imgs.patioRing = { url: S[14].url }; imgs.patioSign = { url: S[9].url };
imgs.sheldrakePick = { url: S[64].url }; imgs.bothcall13 = { url: S[13].url };
imgs.wrappers = { url: S[8].url }; imgs.couchspanish = { url: S[10].url };
imgs.ratcasual = { url: S[6].url };
imgs.sciwatch = { url: 'https://storage.googleapis.com/membry-df528.firebasestorage.app/story/evan-sci-watch-rat-1787080964728.png' };
imgs.ratthrough = { url: 'https://storage.googleapis.com/membry-df528.firebasestorage.app/story/evan-rat-through-tunnel-1787080964728.png' };
imgs.eyemind = { url: EYE };

const PLAN = {
  1: 'spiderman', 2: 'spiderman', 3: 'spiderman', 4: 'future', 5: 'flashes',
  6: 'gift', 7: 'walking', 8: 'walking', 9: 'sheldrakePick', 10: 'evanphone',
  11: 'chart45', 12: 'fourphones', 13: 'chart45', 14: 'walking', 15: 'walking',
  16: 'sheldrakePick', 17: 'walking', 18: 'sheldrakePick', 19: 'nottell', 20: 'sheldrakePick',
  21: 'nottell', 22: 'ndestudies', 23: 'ndestudies', 24: 'prying', 25: 'prying',
  26: 'dreamcall', 27: 'dreamcall', 28: 'dreamcall', 29: 'ratlab', 30: 'ratthrough',
  31: 'sciwatch', 32: 'sciwatch', 33: 'sawsame', 34: 'shards', 35: 'whatsaw',
  36: 'whatsaw2', 37: 'lighttunnel', 38: 'gritted', 39: 'punchtell',
  40: 'bothcall13', 41: 'bothcall13', 42: 'whatsaw', 43: 'whatsaw2',
  44: 'candybar', 45: 'candybar', 46: 'battleship', 47: 'battleship', 48: 'battleship',
  49: 'vow', 50: 'vow', 51: 'vow', 52: 'hungup', 53: 'hungup', 54: 'hungup',
  55: 'wrappers', 56: 'askgod', 57: 'askgod', 58: 'askgod', 59: 'askgod',
  60: 'couchspanish', 61: 'couchspanish', 62: 'patioSign', 63: 'patioSign', 64: 'patioSign',
  65: 'nightbed', 66: 'nightbed', 67: 'nightbed', 68: 'ratcasual',
  69: 'final', 70: 'final',
};
const SUB0 = [{ img: 'patioRing', src0: 0 }, { img: 'phone', src0: 4.74 }, { img: 'magic', src0: 14.92 }];

// ── the note fixes, applied to the v16 part list by exact span match ───────
function findPart(t0) {
  const i = merged.findIndex((p) => p.tts === undefined && !p.room && Math.abs(p.t0 - t0) < 0.05);
  if (i === -1) throw new Error(`part at t0=${t0} not found`);
  return i;
}
// [0:39] the grunt: "like it." really ends 43.32 — v16 ran to 43.94
merged[findPart(40.38)].t1 = 43.44;
// [0:50] "too much space": compress the two gift-line gaps (~0.2s each)
{
  const i = findPart(49.88);
  const p = merged[i];
  const a = { ...p, t1: 57.52, units: p.units, subEye: true };
  const b2 = { t0: 57.7, t1: 59.62, units: [] };
  const c = { t0: 59.8, t1: 62.07, units: [], tail: p.tail };
  merged.splice(i, 1, a, b2, c);
}
// [1:00] scientist clipped IN THE MASTER: end after "guy." (85.04 measured),
// then her own "He's a scientist in England" cut whole from the raw 339 memo
{
  const i = findPart(81.22);
  merged[i].t1 = 85.16; merged[i].tail = null;
  merged.splice(i + 1, 0, { tts: MSCI, unit: 8, clip: true });
}
// [1:08] the stray "ercent" fragment: part 6's head had widened into it
merged[findPart(105.72)].t0 = 106.10;
// [1:25] missing percent on 45: the master truncates it — end after b21's
// "25" and play Sheldrake's whole sentence from the original talk
{
  const i = findPart(93.56);
  merged[i].t1 = 103.72; merged[i].tail = null;
  merged.splice(i + 1, 0, { tts: S45, unit: 13, clip: true });
}
// [1:27] "sounding out": part 8's head had widened into the TTS tail
merged[findPart(113.66)].t0 = 113.95;
// [1:31] "only…(pause too long) 20%": speech ends ~119.4, resumes ~120.5 —
// cut the middle, keep ~0.4s of her beat, and stop clipping "more" (ends 121.22)
{
  const i = findPart(118.54);
  const p = merged[i];
  // energy-measured: "It's only" ends 118.80, pause to 119.86, "20 percent
  // more" 119.88-120.70 — keep ~0.4s of her beat
  merged.splice(i, 1, { t0: 118.54, t1: 119.00, units: p.units }, { t0: 119.70, t1: 120.80, units: [] });
}
// [1:13] the loud noise: every sliver was cut from the RING pause — resource
// them all from the measured quiet window
merged.forEach((p) => { if (p.room) { p.t0 = QUIET.t0; p.t1 = QUIET.t1; } });

const parts = merged.map((p) => p.tts !== undefined ? { tts: p.tts } : { t0: +p.t0.toFixed(2), t1: +p.t1.toFixed(2) });

(async () => {
  // ── audio via page-cut ───────────────────────────────────────────────────
  const body = JSON.stringify({ film: FILM, parts });
  let j = await (await fetch('https://imageforge-q125.onrender.com/api/editor/page-cut', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body })).json();
  const key = j.key;
  while (j.status === 'making') {
    await new Promise((r) => setTimeout(r, 5000));
    j = await (await fetch('https://imageforge-q125.onrender.com/api/editor/page-cut/' + key)).json();
    if (j.status === 'unknown') j = await (await fetch('https://imageforge-q125.onrender.com/api/editor/page-cut', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })).json();
  }
  if (j.status !== 'ready') throw new Error('page-cut failed: ' + JSON.stringify(j));
  console.log('audio:', j.url);
  fs.writeFileSync(path.join(D, 'audio-v17-url.txt'), j.url);
  const mp3 = path.join(D, 'cut-v17.mp3');
  fs.writeFileSync(mp3, Buffer.from(await (await fetch(j.url)).arrayBuffer()));
  const wav = path.join(D, 'cut-v17.wav');
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', mp3, '-ac', '1', '-ar', '44100', wav]);
  const audioDur = (fs.statSync(wav).size - 44) / 2 / 44100;

  // ── shots ────────────────────────────────────────────────────────────────
  const tts = JSON.parse(fs.readFileSync(path.join(D, 'tts-durs.json'), 'utf8'));
  const ttsDec = {};
  for (const id of Object.keys(tts)) ttsDec[id] = (fs.statSync(path.join(D, 'tts-' + id + '.wav')).size - 44) / 2 / 44100;
  const clipDur = {};
  for (const [u, f] of [[MSCI, 'clip-msci.mp3'], [S45, 'clip-s45.mp3']]) {
    const wv = path.join(D, f.replace('.mp3', '.wav'));
    execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', path.join(D, f), '-ac', '1', '-ar', '44100', wv]);
    clipDur[u] = (fs.statSync(wv).size - 44) / 2 / 44100;
  }
  const marks = JSON.parse(fs.readFileSync(path.join(D, 'marks-148.json'), 'utf8')).texts;
  const urlToId = {}; Object.keys(marks).forEach((k) => { if (k.startsWith('__tts:') && marks[k]) urlToId[marks[k]] = k.slice(6); });

  const shotsRaw = [];
  let t = 0;
  merged.forEach((p) => {
    if (p.room) {
      const dur = p.t1 - p.t0;
      shotsRaw.forEach((s, i) => { if (s.t1 === null) s.t1 = i + 1 < shotsRaw.length ? shotsRaw[i + 1].t0 : t; });
      if (shotsRaw.length) shotsRaw[shotsRaw.length - 1].t1 = t + dur;
      t += dur; return;
    }
    if (p.tts !== undefined) {
      const dur = p.clip ? clipDur[p.tts] : ttsDec[urlToId[p.tts]];
      shotsRaw.push({ img: PLAN[p.unit], t0: t, t1: t + dur, unit: p.unit });
      t += dur; return;
    }
    const pStart = t, pEnd = t + (p.t1 - p.t0);
    (p.units || []).forEach((entry) => {
      if (entry.unit === 0) {
        SUB0.forEach((s, si) => {
          const a = pStart + Math.max(0, s.src0 - p.t0);
          shotsRaw.push({ img: s.img, t0: a, t1: null, unit: 0 });
        });
        return;
      }
      const a = pStart + Math.max(0, entry.srcT0 - p.t0);
      shotsRaw.push({ img: PLAN[entry.unit], t0: a, t1: null, unit: entry.unit });
    });
    // the eye image inside b10: "I try to avoid them…" starts at master 52.28,
    // the gift image at b11's 55.34 (her note at 0:45)
    if (p.subEye) {
      shotsRaw.push({ img: 'eyemind', t0: pStart + (52.28 - p.t0), t1: null, unit: 5 });
      shotsRaw.push({ img: 'gift', t0: pStart + (55.34 - p.t0), t1: null, unit: 6 });
    }
    shotsRaw.sort((x, y) => x.t0 - y.t0);
    shotsRaw.forEach((s, i) => { if (s.t1 === null && i + 1 < shotsRaw.length) s.t1 = shotsRaw[i + 1].t0; });
    if (shotsRaw.length && shotsRaw[shotsRaw.length - 1].t1 === null) shotsRaw[shotsRaw.length - 1].t1 = pEnd;
    t = pEnd;
  });
  shotsRaw.forEach((s, i) => { if (s.t1 === null) s.t1 = i + 1 < shotsRaw.length ? shotsRaw[i + 1].t0 : audioDur; });
  const shots = [];
  shotsRaw.forEach((s) => {
    if (!s.img) throw new Error('no image for unit ' + s.unit);
    const last = shots[shots.length - 1];
    if (last && last.img === s.img && Math.abs(last.t1 - s.t0) < 0.06) last.t1 = s.t1;
    else if (s.t1 - s.t0 > 0.01) shots.push({ ...s });
  });
  shots[shots.length - 1].t1 = audioDur;

  // ── stitch ───────────────────────────────────────────────────────────────
  const imgDir = path.join(D, 'film-imgs-v17'); fs.mkdirSync(imgDir, { recursive: true });
  const local = {};
  for (const k of [...new Set(shots.map((s) => s.img))]) {
    const ext = imgs[k].url.includes('.webp') ? '.webp' : '.png';
    const f = path.join(imgDir, k + ext);
    if (!fs.existsSync(f)) fs.writeFileSync(f, Buffer.from(await (await fetch(imgs[k].url)).arrayBuffer()));
    local[k] = f;
  }
  const segDir = path.join(D, 'v17-segs'); fs.rmSync(segDir, { recursive: true, force: true }); fs.mkdirSync(segDir);
  const list = [];
  let prevFrame = 0;
  shots.forEach((s, i) => {
    const endFrame = i === shots.length - 1 ? Math.ceil(audioDur * FPS) : Math.round(s.t1 * FPS);
    const frames = endFrame - prevFrame;
    if (frames <= 0) throw new Error('empty shot ' + i + ' ' + s.img);
    const seg = path.join(segDir, `seg-${String(i).padStart(2, '0')}-${s.img}.mp4`);
    execFileSync(FFMPEG, ['-v', 'error', '-y', '-loop', '1', '-framerate', String(FPS),
      '-t', (frames / FPS).toFixed(4), '-i', local[s.img],
      '-vf', `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG}`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(FPS), seg]);
    list.push(`file '${seg}'`);
    console.log(`shot ${String(i).padStart(2)} ${s.img.padEnd(13)} ${(prevFrame / FPS).toFixed(2)} -> ${(endFrame / FPS).toFixed(2)}`);
    prevFrame = endFrame;
  });
  fs.writeFileSync(path.join(D, 'v17-segs.txt'), list.join('\n') + '\n');
  const vcat = path.join(D, 'evan-v17-video.mp4');
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(D, 'v17-segs.txt'), '-c', 'copy', vcat]);
  const out = path.join(D, 'evan-v17.mp4');
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', vcat, '-i', wav,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ac', '1', '-movflags', '+faststart', out]);
  const probe = (f, sel) => parseFloat(execFileSync(FFPROBE, ['-v', 'error', '-select_streams', sel, '-show_entries', 'stream=duration', '-of', 'csv=p=0', f]).toString());
  const vd = probe(out, 'v:0'), ad = probe(out, 'a:0');
  console.log(`\nevan-v17.mp4: video ${vd.toFixed(2)}s audio ${ad.toFixed(2)}s delta ${(vd - ad).toFixed(3)} shots ${shots.length}`);
  if (vd < ad - 0.05) throw new Error('VIDEO SHORTER THAN AUDIO');
})().catch((e) => { console.error(e); process.exit(1); });
