#!/usr/bin/env node
// pwc-reel.js — People Watching Club: stock footage → B&W → freeze-frame on a
// stranger → a red hand-drawn arrow/circle + an invented backstory, escalating
// from plausible to impossible as the reel goes on. Sophie's concept, 2026-08-25.
//
//   node scripts/pwc-reel.js <plan.json>            → renders the full reel
//   node scripts/pwc-reel.js <plan.json> --stills   → only the annotated freeze
//                                                     stills, for eyeballing
//                                                     placement before a render
//
// The plan is bespoke per episode (which second to freeze on, where each person
// stands, what their story is) — see scripts/pwc-reels/ for examples. The
// freeze-frame is the load-bearing trick: an arrow drawn on MOVING footage
// drifts off its person within a second, and a freeze needs no tracking at all
// (it also reads as the classic "record scratch, yep that's Kevin" device).
// Costs nothing: ffmpeg + sharp on our own box, no model calls.
//
// Annotations render as SVG → PNG (sharp/librsvg). The handwriting fonts must
// be installed where fontconfig can see them (~/.fonts) — Caveat and
// Permanent Marker from google/fonts. The ink stays RED on purpose: the grade
// runs before the overlay, so the drawings are the only color in the frame.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');
const FF = require('ffmpeg-static');

const planPath = process.argv[2];
if (!planPath) { console.error('usage: pwc-reel.js <plan.json> [--stills]'); process.exit(1); }
const stillsOnly = process.argv.includes('--stills');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const dir = path.dirname(path.resolve(planPath));
const src = path.resolve(dir, plan.src);
const W = plan.width || 1920, H = plan.height || 1080;
const FPS = plan.fps || '30000/1001';
const work = fs.mkdtempSync(path.join(require('os').tmpdir(), 'pwcreel-'));

// One grade for every segment — segments must match byte-for-byte in look or
// the joins flash. B&W + a little contrast + fine grain + a soft vignette.
const GRADE = plan.grade ||
  'hue=s=0,eq=contrast=1.07:brightness=0.01,noise=alls=5:allf=t,vignette=PI/5.2:mode=forward';

// ---- seeded wobble, so a re-render draws the same "hand" ----
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function wobblyLine(r, x1, y1, x2, y2, segs = 8, amp = 4) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const nx = x1 + (x2 - x1) * t, ny = y1 + (y2 - y1) * t;
    const j = (i === 0 || i === segs) ? 0 : amp;
    pts.push([nx + (r() - 0.5) * 2 * j, ny + (r() - 0.5) * 2 * j]);
  }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  return d;
}

function arrowSvg(r, a) { // {from:[x,y], to:[x,y]} — to = the person
  const [x1, y1] = a.from, [x2, y2] = a.to;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const headLen = a.head || 30, spread = 0.46;
  let d = wobblyLine(r, x1, y1, x2, y2, 9, a.amp ?? 5);
  for (const s of [-1, 1]) {
    const hx = x2 - headLen * Math.cos(ang + s * spread);
    const hy = y2 - headLen * Math.sin(ang + s * spread);
    d += ' ' + wobblyLine(r, x2, y2, hx, hy, 3, 1.5).replace(/^M/, 'M');
  }
  return d;
}

function scribbleEllipse(r, c) { // {cx, cy, rx, ry} — 1.2 loops, jittered radius
  const steps = 46; let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = -0.35 + (i / steps) * (Math.PI * 2 * 1.12);
    const jr = 1 + (r() - 0.5) * 0.07;
    const x = c.cx + Math.cos(t) * c.rx * jr, y = c.cy + Math.sin(t) * c.ry * jr;
    d += (i ? ' L' : 'M') + ` ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Full-frame transparent overlay for one freeze (or the end card).
async function overlayPng(note, outFile, seed) {
  const r = rng(seed);
  const ink = note.ink || plan.ink || '#e0312e';
  const sw = note.strokeWidth || 7;
  const parts = [];   // main red ink
  const shadow = [];  // soft dark copy underneath, offset — lifts ink off pale pavement
  const pathEl = (d, w) => `<path d="${d}" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="${w}"/>`;
  if (note.arrow) { const d = arrowSvg(r, note.arrow); parts.push(pathEl(d, sw)); shadow.push(pathEl(d, sw)); }
  if (note.circle) { const d = scribbleEllipse(r, note.circle); parts.push(pathEl(d, sw)); shadow.push(pathEl(d, sw)); }
  if (note.lines && note.lines.length) {
    const size = note.size || 54, lh = note.lineHeight || 1.16;
    const font = note.font || plan.font || 'Permanent Marker';
    const anchor = note.anchor || 'middle';
    const rot = note.rot || 0;
    const tspans = note.lines.map((L, i) =>
      `<text x="${note.x}" y="${note.y + i * size * lh}" font-family="${font}" font-size="${size}" text-anchor="${anchor}">${esc(L)}</text>`).join('');
    const g = `<g transform="rotate(${rot} ${note.x} ${note.y})">${tspans}</g>`;
    parts.push(g); shadow.push(g);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<g transform="translate(3,4)" fill="rgba(10,10,10,0.6)" stroke="rgba(10,10,10,0.6)">${shadow.join('')}</g>` +
    `<g fill="${ink}" stroke="${ink}">${parts.join('')}</g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(outFile);
}

function run(args) { execFileSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' }); }

const ENC = ['-r', FPS, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-an'];

(async () => {
  const segs = [];
  let cursor = 0;
  const freezes = plan.freezes || [];
  for (let i = 0; i < freezes.length; i++) {
    const F = freezes[i];
    // the moving footage up to the freeze point
    if (F.t > cursor + 0.05 && !stillsOnly) {
      const p = path.join(work, `play${i}.mp4`);
      run(['-ss', String(cursor), '-to', String(F.t), '-i', src, '-vf', `${GRADE},setsar=1`, ...ENC, p]);
      segs.push(p);
    }
    // the frozen, annotated frame
    const frame = path.join(work, `frame${i}.png`);
    run(['-ss', String(F.t), '-i', src, '-frames:v', '1', frame]);
    const ov = path.join(work, `ov${i}.png`);
    await overlayPng(F, ov, plan.seed ? plan.seed + i : 41 + i * 7);
    if (stillsOnly) {
      const still = path.join(dir, `${path.basename(planPath, '.json')}-still${i + 1}.jpg`);
      run(['-i', frame, '-i', ov, '-filter_complex', `[0]${GRADE}[g];[g][1]overlay=0:0`, '-frames:v', '1', '-q:v', '3', still]);
      console.log('still →', still);
    } else {
      const p = path.join(work, `hold${i}.mp4`);
      run(['-loop', '1', '-t', String(F.dur || 3.2), '-i', frame, '-loop', '1', '-t', String(F.dur || 3.2), '-i', ov,
        '-filter_complex', `[0]${GRADE}[g];[1]fade=t=in:st=0.18:d=0.22:alpha=1[ov];[g][ov]overlay=0:0,setsar=1`, ...ENC, p]);
      segs.push(p);
    }
    cursor = F.t;
  }
  if (stillsOnly) return;
  // play out the tail, then the end card on the final frame
  let durOut = '';
  try { execFileSync(FF, ['-i', src], { stdio: 'pipe' }); }
  catch (e) { durOut = String(e.stderr || ''); } // ffmpeg -i with no output always exits 1; the duration is on stderr
  let tail = plan.tailTo;
  if (!tail) { const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(durOut + ''); tail = m ? (+m[1] * 3600 + +m[2] * 60 + +m[3]) - 0.05 : cursor; }
  if (tail > cursor + 0.05) {
    const p = path.join(work, 'playout.mp4');
    run(['-ss', String(cursor), '-to', String(tail), '-i', src, '-vf', `${GRADE},setsar=1`, ...ENC, p]);
    segs.push(p);
  }
  if (plan.endcard) {
    const frame = path.join(work, 'endframe.png');
    run(['-ss', String(Math.max(0, tail - 0.1)), '-i', src, '-frames:v', '1', frame]);
    const ov = path.join(work, 'endov.png');
    await overlayPng(plan.endcard, ov, (plan.seed || 40) + 99);
    const p = path.join(work, 'endcard.mp4');
    run(['-loop', '1', '-t', String(plan.endcard.dur || 2.4), '-i', frame, '-loop', '1', '-t', String(plan.endcard.dur || 2.4), '-i', ov,
      '-filter_complex', `[0]${GRADE},eq=brightness=-0.28[g];[1]fade=t=in:st=0.15:d=0.3:alpha=1[ov];[g][ov]overlay=0:0,setsar=1`, ...ENC, p]);
    segs.push(p);
  }
  const list = path.join(work, 'list.txt');
  fs.writeFileSync(list, segs.map(s => `file '${s}'`).join('\n'));
  const out = path.resolve(dir, plan.out || 'reel.mp4');
  run(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
  console.log('reel →', out);
})().catch(e => { console.error(e); process.exit(1); });
