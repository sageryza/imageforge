#!/usr/bin/env node
// Cut the science reel: 28 still panels held for their voiceover spans,
// the memo audio muxed once (never re-encoded per segment). Runs in the
// session container, not on the 512MB box.
// Usage: node docs/science-reel/render-film.js <workdir>
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');
const ffmpeg = require('ffmpeg-static');

const HERE = __dirname;
const work = process.argv[2] || '/tmp/science-reel';
fs.mkdirSync(work, { recursive: true });
const plan = JSON.parse(fs.readFileSync(path.join(HERE, 'beats.json'), 'utf8'));
const spans = JSON.parse(fs.readFileSync(path.join(HERE, 'spans.json'), 'utf8'));
const runs = JSON.parse(fs.readFileSync(path.join(HERE, 'runs.json'), 'utf8'));
const W = 1080, H = 1620;

// panel url per beat n: runs[] carries beats:[n,...] and images[] in order
const urlFor = {};
for (const r of runs) r.beats.forEach((n, i) => { urlFor[n] = r.images[i]; });

(async () => {
  const audio = path.join(work, 'vo.m4a');
  if (!fs.existsSync(audio)) {
    const res = await fetch('https://storage.googleapis.com/membry-df528.firebasestorage.app/science-reel/vo-science-and-belief.m4a');
    fs.writeFileSync(audio, Buffer.from(await res.arrayBuffer()));
  }
  const lines = [];
  for (const s of spans) {
    const n = s.n;
    const url = urlFor[n];
    if (!url) throw new Error(`no panel for beat ${n}`);
    const png = path.join(work, `p${String(n).padStart(2, '0')}.png`);
    if (!fs.existsSync(png)) {
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      await sharp(buf).resize(W, H, { fit: 'cover' }).png().toFile(png);
      console.log('panel', n, 'ready');
    }
    lines.push(`file '${png}'`);
    lines.push(`duration ${(s.t1 - s.t0).toFixed(3)}`);
  }
  // hold the last picture to the end of the audio (the recording carries a
  // couple of seconds of air past the last word; -shortest trims to it)
  const last = path.join(work, `p${String(spans[spans.length - 1].n).padStart(2, '0')}.png`);
  lines.push(`file '${last}'`);
  lines.push('duration 6');
  lines.push(`file '${last}'`);
  const list = path.join(work, 'list.txt');
  fs.writeFileSync(list, lines.join('\n') + '\n');
  const out = path.join(work, 'science-reel.mp4');
  execFileSync(ffmpeg, [
    '-y', '-f', 'concat', '-safe', '0', '-i', list, '-i', audio,
    '-vf', `fps=30,format=yuv420p`,
    '-c:v', 'libx264', '-crf', '19', '-preset', 'medium',
    '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart', '-shortest', out,
  ], { stdio: 'inherit' });
  console.log('rendered', out, fs.statSync(out).size, 'bytes');
})().catch((e) => { console.error(e.message || e); process.exit(1); });
