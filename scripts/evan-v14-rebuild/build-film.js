// Stitch evan-v14.mp4: her live 148-key cut (page-cut 802a1228 audio) with the
// best existing art per unit. Per-shot segments at exact cumulative frame
// boundaries (vo-film's method — never the ffconcat stills demuxer), one mux,
// video guaranteed to cover the audio to the frame (the v13 defect).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const REPO = '/home/user/imageforge';
const FFMPEG = require(path.join(REPO, 'node_modules', 'ffmpeg-static'));
const FFPROBE = require(path.join(REPO, 'node_modules', 'ffprobe-static')).path;
const D = __dirname;
const W = 1000, H = 1500, FPS = 30, BG = '#f7f3ea';

const { timeline } = JSON.parse(fs.readFileSync(path.join(D, 'timeline.json'), 'utf8'));
const imgs = JSON.parse(fs.readFileSync(path.join(D, 'imgs.json'), 'utf8'));

// unit index -> image key (unit 0 is split into three sub-shots by block time)
const PLAN = {
  1: 'spiderman', 2: 'spiderman', 3: 'spiderman', 4: 'future', 5: 'flashes',
  6: 'gift', 7: 'walking', 8: 'walking', 9: 'sheldrake', 10: 'evanphone',
  11: 'chart45', 12: 'fourphones', 13: 'chart45', 14: 'walking', 15: 'walking',
  16: 'sheldrake', 17: 'walking', 18: 'sheldrake', 19: 'nottell', 20: 'sheldrake',
  21: 'nottell', 22: 'ndestudies', 23: 'ndestudies', 24: 'prying', 25: 'prying',
  26: 'dreamcall', 27: 'dreamcall', 28: 'dreamcall', 29: 'ratlab', 30: 'rattunnel',
  31: 'dyingrat', 32: 'dyingrat', 33: 'sawsame', 34: 'shards', 35: 'whatsaw',
  36: 'whatsaw2', 37: 'lighttunnel', 38: 'gritted', 39: 'punchtell',
  40: 'bothcall', 41: 'bothcall', 42: 'whatsaw', 43: 'whatsaw2',
  44: 'candybar', 45: 'candybar', 46: 'battleship', 47: 'battleship', 48: 'battleship',
  49: 'vow', 50: 'vow', 51: 'vow', 52: 'hungup', 53: 'hungup', 54: 'hungup',
  55: 'calldrops', 56: 'askgod', 57: 'askgod', 58: 'askgod', 59: 'askgod',
  60: 'firstrat', 61: 'firstrat', 62: 'patio', 63: 'patio', 64: 'patio',
  65: 'nightbed', 66: 'nightbed', 67: 'nightbed', 68: 'dyingrat',
  69: 'final', 70: 'final',
};
// unit 0 (0–21.52, source maps 1:1): ring / on-the-phone / magic-or-science
const SUB0 = [
  { img: 'ring', t0: 0, t1: 4.74 },
  { img: 'phone', t0: 4.74, t1: 14.92 },
  { img: 'magic', t0: 14.92, t1: 21.52 },
];

(async () => {
  // 1. shots: absolute [t0,t1) + image key, merging consecutive same-image units
  const rawShots = [];
  SUB0.forEach((s) => rawShots.push({ img: s.img, t0: s.t0, t1: s.t1 }));
  timeline.slice(1).forEach((u, i) => {
    const key = PLAN[i + 1];
    if (!key) throw new Error('no image for unit ' + (i + 1) + ' ' + u.id);
    rawShots.push({ img: key, t0: u.start, t1: u.start + u.dur, unit: u.id });
  });
  const shots = [];
  rawShots.forEach((s) => {
    const last = shots[shots.length - 1];
    if (last && last.img === s.img && Math.abs(last.t1 - s.t0) < 0.02) last.t1 = s.t1;
    else shots.push({ ...s });
  });

  // 2. audio: decoded wav (already made) -> aac; video must end at or after it
  const wav = path.join(D, 'cut-802a.wav');
  const audioDur = (fs.statSync(wav).size - 44) / 2 / 44100;
  shots[shots.length - 1].t1 = audioDur;

  // 3. download each distinct image once
  const imgDir = path.join(D, 'film-imgs'); fs.mkdirSync(imgDir, { recursive: true });
  const local = {};
  for (const key of [...new Set(shots.map((s) => s.img))]) {
    const f = path.join(imgDir, key + '.png');
    if (!fs.existsSync(f)) {
      const r = await fetch(imgs[key].url);
      if (!r.ok) throw new Error('image fetch ' + key + ' ' + r.status);
      fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    }
    local[key] = f;
  }

  // 4. per-shot segments at exact cumulative frame boundaries
  const segDir = path.join(D, 'film-segs'); fs.mkdirSync(segDir, { recursive: true });
  const list = [];
  let prevFrame = 0;
  shots.forEach((s, i) => {
    const endFrame = i === shots.length - 1 ? Math.ceil(audioDur * FPS) : Math.round(s.t1 * FPS);
    const frames = endFrame - prevFrame;
    if (frames <= 0) throw new Error('empty shot ' + i);
    const dur = frames / FPS;
    const seg = path.join(segDir, `seg-${String(i).padStart(2, '0')}-${s.img}.mp4`);
    if (!fs.existsSync(seg)) {
      execFileSync(FFMPEG, ['-v', 'error', '-y', '-loop', '1', '-framerate', String(FPS),
        '-t', dur.toFixed(4), '-i', local[s.img],
        '-vf', `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG}`,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
        '-r', String(FPS), seg]);
    }
    list.push(`file '${seg}'`);
    console.log(`shot ${String(i).padStart(2)} ${s.img.padEnd(11)} ${(prevFrame / FPS).toFixed(2)} -> ${(endFrame / FPS).toFixed(2)}  (${dur.toFixed(2)}s)`);
    prevFrame = endFrame;
  });
  fs.writeFileSync(path.join(D, 'segs.txt'), list.join('\n') + '\n');

  // 5. concat video segments (encoded segments, safe with the demuxer), mux audio
  const vcat = path.join(D, 'evan-v14-video.mp4');
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(D, 'segs.txt'), '-c', 'copy', vcat]);
  const out = path.join(D, 'evan-v14.mp4');
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', vcat, '-i', wav,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ac', '1', '-movflags', '+faststart', out]);

  const probe = (f, sel) => parseFloat(execFileSync(FFPROBE, ['-v', 'error', '-select_streams', sel, '-show_entries', 'stream=duration', '-of', 'csv=p=0', f]).toString());
  const vd = probe(out, 'v:0'), ad = probe(out, 'a:0');
  console.log(`\nevan-v14.mp4: video ${vd.toFixed(2)}s, audio ${ad.toFixed(2)}s, delta ${(vd - ad).toFixed(3)}s, shots ${shots.length}`);
  if (vd < ad - 0.05) throw new Error('VIDEO SHORTER THAN AUDIO — the v13 defect, do not deliver');
})().catch((e) => { console.error(e); process.exit(1); });
