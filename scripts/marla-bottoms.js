#!/usr/bin/env node
/**
 * marla-bottoms.js — how clear is the bottom of each page's picture?
 *
 * Sophie's ask: the caption should sit ON the picture, not in a band under it.
 * Which pages can take it depends on what is actually drawn down there, and
 * that is a measurement, not a guess. Three buckets, her words:
 *   clear   — overlay the text straight onto the paper
 *   veiled  — some drawing down there; a white veil at low opacity gives the
 *             text a place without hiding anything
 *   redo    — something IMPORTANT is at the bottom; handle that page by hand
 *             (text on the facing page, or redraw the picture)
 *
 * THE METRIC IS INK COVERAGE IN THE TEXT BAND, and it reads the picture the
 * way the caption will sit on it: the bottom 20% minus the page margins, at
 * the size it is printed, on the two lines the caption actually occupies.
 * `heavy` is the share of pixels darker than the paper by more than 18/255 —
 * a watercolour wash counts, a bare paper grain does not.
 *
 *   node scripts/marla-bottoms.js [--json] [--band 0.2]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/marla/state.json'), 'utf8'));
const JSON_OUT = process.argv.includes('--json');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i === -1 ? d : process.argv[i + 1]; };
const BAND = Number(arg('band', 0.2));

// The band is the region the CAPTION really occupies, not a fixed fraction:
// a five-line caption reaches a third of the way up the page while a two-line
// one barely clears the margin. Measuring a flat 20% called page 24 clear and
// its text then landed across the picnic blanket. Same wrap and geometry as
// marla-textplace.js — move one, move both.
function wrapLines(text, max) {
  const out = []; let cur = '';
  for (const w of String(text).trim().split(/\s+/).filter(Boolean)) {
    if ((cur + ' ' + w).trim().length > max) { if (cur) out.push(cur.trim()); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur.trim());
  return out;
}
function bandFor(words, height) {
  const lines = wrapLines(words, 40), fontSize = 36, lineH = Math.round(fontSize * 1.34);
  const scale = height / 1536;                    // measurement runs at the art's own size
  const blockH = lines.length * lineH * scale;
  const topY = height - blockH - 70 * scale - 24; // a little air above the first line
  return Math.max(0, Math.min(topY, height - 40));
}

// The CURRENT picture for each page = the newest numbered round that drew it.
// Named variants (3a, 32e) are experiments, not the book, so they are skipped.
const ROUNDS = ['s1', 'v2', 'v3', 'v3e', 's2', 's2diag', 's4', 's5'];
function currentArt() {
  const out = {};
  for (const b of ROUNDS) {
    for (const [k, v] of Object.entries(state[b] || {})) {
      const n = Number(k);
      const url = v.artUrl || v.url;
      if (!n || !url) continue;
      const at = v.at || 0;
      if (!out[n] || at >= out[n].at) out[n] = { n, url, at, round: b };
    }
  }
  for (const [k, v] of Object.entries(state.pages || {})) {
    const n = Number(k);
    if (!out[n] && v.artUrl) out[n] = { n, url: v.artUrl, at: v.at || 0, round: 'r1' };
  }
  return Object.values(out).sort((a, b) => a.n - b.n);
}

async function measure(url, words) {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const img = sharp(buf).greyscale();
  const { width, height } = await img.metadata();
  const top = words ? Math.round(bandFor(words, height)) : Math.round(height * (1 - BAND));
  const left = Math.round(width * 0.07);           // the page margins the text keeps
  const w = width - left * 2;
  const h = height - top;
  const raw = await sharp(buf).greyscale()
    .extract({ left, top, width: w, height: h })
    .raw().toBuffer();

  // Paper is the brightest mode, not 255 — this stock is cream.
  const hist = new Array(256).fill(0);
  for (const p of raw) hist[p]++;
  let paper = 255;
  for (let v = 255; v >= 200; v--) { if (hist[v] > raw.length * 0.02) { paper = v; break; } }

  let heavy = 0, sum = 0, darkest = 255;
  for (const p of raw) {
    const d = paper - p;
    if (d > 18) heavy++;
    sum += d > 0 ? d : 0;
    if (p < darkest) darkest = p;
  }
  // Where the ink sits across the band, in tenths — a busy corner is a
  // different problem from an evenly busy strip, and the fix differs.
  const cols = new Array(10).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (paper - raw[y * w + x] > 18) cols[Math.min(9, Math.floor((x / w) * 10))]++;
    }
  }
  const per = cols.map((c) => +(c / (h * (w / 10))).toFixed(3));
  return {
    heavy: +(heavy / raw.length).toFixed(4),
    mean: +(sum / raw.length).toFixed(2),
    darkest,
    cols: per,
    clearRun: longestRun(per, 0.06),               // widest stretch of quiet tenths
  };
}
function longestRun(per, thr) {
  let best = 0, run = 0;
  for (const v of per) { if (v <= thr) { run++; if (run > best) best = run; } else run = 0; }
  return best;
}

(async () => {
  const list = currentArt();
  const rows = [];
  for (const it of list) {
    try {
      const m = await measure(it.url, (state.pages[String(it.n)] || {}).words || '');
      rows.push({ ...it, ...m });
      if (!JSON_OUT) console.log(`p${String(it.n).padStart(2)} ${it.round.padEnd(6)} heavy ${String(m.heavy).padEnd(7)} mean ${String(m.mean).padEnd(6)} clearRun ${m.clearRun}`);
    } catch (e) { console.log(`p${it.n}: ${e.message}`); }
  }
  if (JSON_OUT) console.log(JSON.stringify(rows, null, 1));
  else {
    const sorted = [...rows].sort((a, b) => a.heavy - b.heavy);
    console.log('\nquietest:', sorted.slice(0, 8).map((r) => `p${r.n}(${r.heavy})`).join(' '));
    console.log('busiest: ', sorted.slice(-8).map((r) => `p${r.n}(${r.heavy})`).join(' '));
  }
  fs.writeFileSync(path.join(ROOT, 'docs/marla/bottoms.json'), JSON.stringify(rows, null, 1) + '\n');
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
