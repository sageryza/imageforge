// evan-v15: corrected audio (merged seams + re-listened boundaries) and the
// shot map updated to her hearts and notes.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const REPO = '/home/user/imageforge';
const FFMPEG = require(path.join(REPO, 'node_modules', 'ffmpeg-static'));
const FFPROBE = require(path.join(REPO, 'node_modules', 'ffprobe-static')).path;
const D = __dirname;
const W = 1000, H = 1500, FPS = 30, BG = '#f7f3ea';
const FILM = 'https://storage.googleapis.com/membry-df528.firebasestorage.app/story/films/evan-v7-lite.mp3';

const { parts, merged } = JSON.parse(fs.readFileSync(path.join(D, 'parts-v15.json'), 'utf8'));
const u = JSON.parse(fs.readFileSync(path.join(D, 'units.json'), 'utf8'));
const imgs = JSON.parse(fs.readFileSync(path.join(D, 'imgs.json'), 'utf8'));
const S = JSON.parse(fs.readFileSync(path.join(D, 'assets-evan-story-visual-summary.json'), 'utf8')).assets;
// her picks from the notes survey
imgs.patio = { url: S[14].url, label: S[14].description };
imgs.sheldrakePick = { url: S[64].url, label: 'Sheldrake image — her own Playground pick' };
imgs.bothcall13 = { url: S[13].url, label: S[13].description };
imgs.wrappers = { url: S[8].url, label: S[8].description };
imgs.couchspanish = { url: S[10].url, label: S[10].description };
imgs.ratcasual = { url: S[6].url, label: S[6].description };

const PLAN = {
  1: 'spiderman', 2: 'spiderman', 3: 'spiderman', 4: 'future', 5: 'flashes',
  6: 'gift', 7: 'walking', 8: 'walking', 9: 'sheldrakePick', 10: 'evanphone',
  11: 'chart45', 12: 'fourphones', 13: 'chart45', 14: 'walking', 15: 'walking',
  16: 'sheldrakePick', 17: 'walking', 18: 'sheldrakePick', 19: 'nottell', 20: 'sheldrakePick',
  21: 'nottell', 22: 'ndestudies', 23: 'ndestudies', 24: 'prying', 25: 'prying',
  26: 'dreamcall', 27: 'dreamcall', 28: 'dreamcall', 29: 'ratlab', 30: 'rattunnel',
  31: 'dyingrat', 32: 'dyingrat', 33: 'sawsame', 34: 'shards', 35: 'whatsaw',
  36: 'whatsaw2', 37: 'lighttunnel', 38: 'gritted', 39: 'punchtell',
  40: 'bothcall13', 41: 'bothcall13', 42: 'whatsaw', 43: 'whatsaw2',
  44: 'candybar', 45: 'candybar', 46: 'battleship', 47: 'battleship', 48: 'battleship',
  49: 'vow', 50: 'vow', 51: 'vow', 52: 'hungup', 53: 'hungup', 54: 'hungup',
  55: 'wrappers', 56: 'askgod', 57: 'askgod', 58: 'askgod', 59: 'askgod',
  60: 'couchspanish', 61: 'couchspanish', 62: 'patio', 63: 'patio', 64: 'patio',
  65: 'nightbed', 66: 'nightbed', 67: 'nightbed', 68: 'ratcasual',
  69: 'final', 70: 'final',
};
const SUB0 = [ // inside unit 0's single span, at source block boundaries
  { img: 'patio', src0: 0 }, { img: 'phone', src0: 4.74 }, { img: 'magic', src0: 14.92 },
];

(async () => {
  // ── audio: fetch the content-addressed cut of the corrected parts ────────
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
  const mp3 = path.join(D, 'cut-v15.mp3');
  fs.writeFileSync(mp3, Buffer.from(await (await fetch(j.url)).arrayBuffer()));
  const wav = path.join(D, 'cut-v15.wav');
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', mp3, '-ac', '1', '-ar', '44100', wav]);
  const audioDur = (fs.statSync(wav).size - 44) / 2 / 44100;

  // ── per-part film times; per-unit shot boundaries ────────────────────────
  const tts = JSON.parse(fs.readFileSync(path.join(D, 'tts-durs.json'), 'utf8'));
  const ttsDec = {};
  for (const id of Object.keys(tts)) ttsDec[id] = (fs.statSync(path.join(D, 'tts-' + id + '.wav')).size - 44) / 2 / 44100;
  const marks = JSON.parse(fs.readFileSync(path.join(D, 'marks-148.json'), 'utf8')).texts;
  const urlToId = {}; Object.keys(marks).forEach((k) => { if (k.startsWith('__tts:') && marks[k]) urlToId[marks[k]] = k.slice(6); });

  const shotsRaw = [];
  let t = 0;
  merged.forEach((p) => {
    if (p.tts !== undefined) {
      const dur = ttsDec[urlToId[p.tts]];
      shotsRaw.push({ img: PLAN[p.unit], t0: t, t1: t + dur, unit: p.unit });
      t += dur; return;
    }
    const pStart = t, pEnd = t + (p.t1 - p.t0);
    p.units.forEach((entry, i) => {
      if (entry.unit === 0) {
        SUB0.forEach((s, si) => {
          const a = pStart + Math.max(0, s.src0 - p.t0);
          const b = si + 1 < SUB0.length ? pStart + Math.max(0, SUB0[si + 1].src0 - p.t0) : null;
          shotsRaw.push({ img: s.img, t0: a, t1: b, unit: 0 });
        });
        return;
      }
      const a = pStart + Math.max(0, entry.srcT0 - p.t0);
      shotsRaw.push({ img: PLAN[entry.unit], t0: a, t1: null, unit: entry.unit });
    });
    // close open-ended shots at part end (next part will reopen)
    for (let i = shotsRaw.length - 1; i >= 0 && shotsRaw[i].t1 === null; i--) { /* noop */ }
    shotsRaw.forEach((s, i) => { if (s.t1 === null && i + 1 < shotsRaw.length) s.t1 = shotsRaw[i + 1].t0; });
    if (shotsRaw.length && shotsRaw[shotsRaw.length - 1].t1 === null) shotsRaw[shotsRaw.length - 1].t1 = pEnd;
    t = pEnd;
  });
  // fill any nulls from successor starts, then merge same-image runs
  shotsRaw.forEach((s, i) => { if (s.t1 === null) s.t1 = i + 1 < shotsRaw.length ? shotsRaw[i + 1].t0 : audioDur; });
  const shots = [];
  shotsRaw.forEach((s) => {
    if (!s.img) throw new Error('no image for unit ' + s.unit);
    const last = shots[shots.length - 1];
    if (last && last.img === s.img && Math.abs(last.t1 - s.t0) < 0.05) last.t1 = s.t1;
    else shots.push({ ...s });
  });
  shots[shots.length - 1].t1 = audioDur;

  // ── images, segments, concat, mux (as v14) ───────────────────────────────
  const imgDir = path.join(D, 'film-imgs'); fs.mkdirSync(imgDir, { recursive: true });
  const local = {};
  for (const k of [...new Set(shots.map((s) => s.img))]) {
    const ext = imgs[k].url.includes('.webp') ? '.webp' : '.png';
    const f = path.join(imgDir, k + ext);
    if (!fs.existsSync(f)) fs.writeFileSync(f, Buffer.from(await (await fetch(imgs[k].url)).arrayBuffer()));
    local[k] = f;
  }
  const segDir = path.join(D, 'v15-segs'); fs.rmSync(segDir, { recursive: true, force: true }); fs.mkdirSync(segDir);
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
  fs.writeFileSync(path.join(D, 'v15-segs.txt'), list.join('\n') + '\n');
  const vcat = path.join(D, 'evan-v15-video.mp4');
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(D, 'v15-segs.txt'), '-c', 'copy', vcat]);
  const out = path.join(D, 'evan-v15.mp4');
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', vcat, '-i', wav,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ac', '1', '-movflags', '+faststart', out]);
  const probe = (f, sel) => parseFloat(execFileSync(FFPROBE, ['-v', 'error', '-select_streams', sel, '-show_entries', 'stream=duration', '-of', 'csv=p=0', f]).toString());
  const vd = probe(out, 'v:0'), ad = probe(out, 'a:0');
  console.log(`\nevan-v15.mp4: video ${vd.toFixed(2)}s audio ${ad.toFixed(2)}s delta ${(vd - ad).toFixed(3)} shots ${shots.length}`);
  if (vd < ad - 0.05) throw new Error('VIDEO SHORTER THAN AUDIO');
  fs.writeFileSync(path.join(D, 'audio-v15-url.txt'), j.url);
})().catch((e) => { console.error(e); process.exit(1); });
