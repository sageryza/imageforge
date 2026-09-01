// cut-panel-sheet.js — cut a FOREIGN panel sheet (one she dumped, drawn
// somewhere else) into one picture per panel.
//
// NOT the Playground's cutter. `cutSheet` in server.js knows the canvas it
// asked for, so it cuts on exact math with findSeams nudging each line into
// the real gutter. A sheet off her phone knows nothing: uneven outer margins,
// caption boxes one or two lines tall, and a grid the drawing tool never
// promised. So the cut is read off the INK instead — a column or row with no
// ink at all is a gutter, and everything between two gutters is a panel.
// Columns first, then rows WITHIN each column, which is what lets a two-line
// caption make its own panel taller than its neighbours.
//
// The caption box rides WITH its picture: it is inside the same ink band, so
// nothing has to know it exists. Panels come out in reading order (grouped
// into rows by vertical overlap, then left to right) and lossless — the
// house rule that nothing lossy stands between her original and the cut.
//
//   node scripts/cut-panel-sheet.js <dir of .png sheets> <out dir>
//
// First used on the "dream factory" Dump album (2026-09-01): six sheets,
// 51 panels, into a one-up review deck.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
sharp.cache(false);

const PAD = 6;           // px of paper kept around each panel
const MIN_GAP = 8;       // px — a run of blank lines this wide is a real gutter
const INK_FRAC = 0.004;  // fraction of a line's pixels that must be ink to count

function bands(profile, minRun, thresh) {
  const out = [];
  let start = -1;
  for (let i = 0; i < profile.length; i++) {
    const inked = profile[i] > thresh;
    if (inked && start < 0) start = i;
    if (!inked && start >= 0) {
      // look ahead: is the blank run long enough to be a gutter?
      let j = i;
      while (j < profile.length && profile[j] <= thresh) j++;
      if (j - i >= minRun || j >= profile.length) { out.push([start, i - 1]); start = -1; i = j - 1; }
      else i = j - 1;
    }
  }
  if (start >= 0) out.push([start, profile.length - 1]);
  return out;
}

async function cut(file, outDir) {
  const { data, info } = await sharp(file).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  // Paper is the most common light value; ink is anything much darker.
  const gray = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < gray.length; i++, p += C) {
    gray[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
  }
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  let paper = 0;
  for (let v = 150; v < 256; v++) if (hist[v] > hist[paper] || paper < 150) { if (hist[v] > hist[paper]) paper = v; }
  const INK = paper - 45;

  const colInk = new Array(W).fill(0);
  const rowInk = new Array(H).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (gray[y * W + x] < INK) { colInk[x]++; rowInk[y]++; }
    }
  }
  const cols = bands(colInk, MIN_GAP, H * INK_FRAC);
  const rects = [];
  for (const [x0, x1] of cols) {
    const rp = new Array(H).fill(0);
    for (let y = 0; y < H; y++) {
      let n = 0;
      for (let x = x0; x <= x1; x++) if (gray[y * W + x] < INK) n++;
      rp[y] = n;
    }
    const rows = bands(rp, MIN_GAP, (x1 - x0 + 1) * INK_FRAC);
    for (const [y0, y1] of rows) rects.push({ x0, x1, y0, y1 });
  }
  // reading order: top to bottom, then left to right
  rects.sort((a, b) => (a.y0 - b.y0) || (a.x0 - b.x0));
  // group into rows by overlap so the order really is left-to-right per row
  const ordered = [];
  const seen = new Set();
  for (const r of rects) {
    if (seen.has(r)) continue;
    const row = rects.filter(o => !seen.has(o) && o.y0 < r.y1 && o.y1 > r.y0);
    row.forEach(o => seen.add(o));
    row.sort((a, b) => a.x0 - b.x0);
    ordered.push(...row);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const base = path.basename(file, '.png');
  const raw = { width: W, height: H, channels: C };
  const made = [];
  for (let i = 0; i < ordered.length; i++) {
    const r = ordered[i];
    const left = Math.max(0, r.x0 - PAD), top = Math.max(0, r.y0 - PAD);
    const w = Math.min(W - left, r.x1 - r.x0 + 1 + PAD * 2);
    const h = Math.min(H - top, r.y1 - r.y0 + 1 + PAD * 2);
    const out = path.join(outDir, `${base}-p${String(i + 1).padStart(2, '0')}.png`);
    await sharp(data, { raw }).extract({ left, top, width: w, height: h })
      .png({ compressionLevel: 9 }).toFile(out);
    made.push({ out, w, h });
  }
  console.log(base, `${W}x${H}`, 'paper', paper, 'ink<', INK, '→', made.length, 'panels');
  made.forEach(m => console.log('   ', path.basename(m.out), `${m.w}x${m.h}`));
  return made;
}

(async () => {
  const dir = process.argv[2];
  const outDir = process.argv[3];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort()) {
    await cut(path.join(dir, f), outDir);
  }
})();
