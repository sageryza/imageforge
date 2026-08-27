#!/usr/bin/env node
// Cut the science reel from reel.json — one still per entry, held for its
// voiceover span, the memo audio muxed once (never re-encoded per segment).
// Runs in the session container, not on the 512MB box.
// Usage: node docs/science-reel/render-film.js <workdir>
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');
const ffmpeg = require('ffmpeg-static');

const HERE = __dirname;
const work = process.argv[2] || '/tmp/science-reel';
fs.mkdirSync(work, { recursive: true });
const reel = JSON.parse(fs.readFileSync(path.join(HERE, 'reel.json'), 'utf8'));
const W = 1080, H = 1620;
const VO = 'https://storage.googleapis.com/membry-df528.firebasestorage.app/science-reel/vo-science-and-belief.m4a';

(async () => {
  const audio = path.join(work, 'vo.m4a');
  if (!fs.existsSync(audio)) {
    const res = await fetch(VO);
    fs.writeFileSync(audio, Buffer.from(await res.arrayBuffer()));
  }
  const lines = [];
  for (const r of reel) {
    const png = path.join(work, `p${r.key.padStart(3, '0')}.png`);
    if (!fs.existsSync(png)) {
      const res = await fetch(r.img);
      const buf = Buffer.from(await res.arrayBuffer());
      await sharp(buf).resize(W, H, { fit: 'cover' }).png().toFile(png);
      console.log('picture', r.key, r.from, 'ready');
    }
    lines.push(`file '${png}'`);
    lines.push(`duration ${(r.t1 - r.t0).toFixed(3)}`);
  }
  // hold the last picture to the end of the audio (the recording carries a
  // couple of seconds of air past the last word; -shortest trims to it)
  const last = path.join(work, `p${reel[reel.length - 1].key.padStart(3, '0')}.png`);
  lines.push(`file '${last}'`);
  lines.push('duration 6');
  lines.push(`file '${last}'`);
  const list = path.join(work, 'list.txt');
  fs.writeFileSync(list, lines.join('\n') + '\n');
  const out = path.join(work, 'science-reel.mp4');
  execFileSync(ffmpeg, [
    '-y', '-f', 'concat', '-safe', '0', '-i', list, '-i', audio,
    '-vf', 'fps=30,format=yuv420p',
    '-c:v', 'libx264', '-crf', '19', '-preset', 'medium',
    '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart', '-shortest', out,
  ], { stdio: 'inherit' });
  console.log('rendered', out, fs.statSync(out).size, 'bytes');
})().catch((e) => { console.error(e.message || e); process.exit(1); });
