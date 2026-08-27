// Cut every located take to its own preview mp3 — a PLAIN trim of her original
// bytes with a little air either side, never a processed or re-levelled copy.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('ffmpeg-static');
const takes = JSON.parse(fs.readFileSync('/tmp/takes/takes.json', 'utf8'));
const OUT = '/tmp/takes/clips';
fs.mkdirSync(OUT, { recursive: true });
const PAD = 0.35;

// which take is the one the reel actually uses: the SLICES window in build-vo
const src = fs.readFileSync('scripts/water-reel/build-vo.js', 'utf8');
const block = src.slice(src.indexOf('const SLICES = {'), src.indexOf('\n};', src.indexOf('const SLICES = {')));
const SLICES = {};
for (const m of block.matchAll(/^\s{2}([a-z0-9]+):\s*\[([\d.]+),\s*([\d.]+)(?:,\s*(\d))?\]/gm)) {
  SLICES[m[1]] = { t0: +m[2], t1: +m[3], src: m[4] === '2' ? 'vo2' : 'vo' };
}
console.log('slices parsed:', Object.keys(SLICES).length);

let n = 0;
const rows = [];
for (const L of takes) {
  L.takes.forEach((t, i) => {
    const id = `${L.shot}-${i + 1}`;
    const f = path.join(OUT, `${id}.mp3`);
    const a = Math.max(0, t.t0 - PAD), b = t.t1 + PAD;
    execFileSync(ffmpeg, ['-v', 'error', '-y', '-ss', String(a), '-to', String(b),
      '-i', t.file, '-c:a', 'libmp3lame', '-b:a', '96k', '-ac', '1', f], { stdio: 'ignore' });
    const sl = SLICES[L.source];
    // BY MIDPOINT, not containment: the finder's window flexes with the line's
    // length so a located take often runs a beat wider than the slice it sits
    // in, and a containment test then marks the real take as unused.
    const mid = (t.t0 + t.t1) / 2;
    const used = !!sl && sl.src === t.src && mid >= sl.t0 && mid <= sl.t1;
    rows.push({ id, shot: L.shot, text: L.text, src: t.src, t0: t.t0, t1: t.t1,
      len: +(t.t1 - t.t0).toFixed(1), used, file: f });
    n++;
  });
}
fs.writeFileSync('/tmp/takes/rows.json', JSON.stringify(rows, null, 1));
console.log('cut', n, 'takes |', rows.filter((r) => r.used).length, 'marked as the one in the reel');
