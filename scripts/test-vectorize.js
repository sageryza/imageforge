#!/usr/bin/env node
// Does the trace still say what the card said?
//
//   node scripts/test-vectorize.js            # all thirteen fixtures
//   node scripts/test-vectorize.js weight     # just one
//
// This deliberately does NOT compare against the Python it was ported from.
// That was the first version of this test and it was the wrong question: the
// two agree on 8 of 13 cards and differ by one marginal colour on the rest,
// because PIL's Lanczos and sharp's differ at edges (measured: 4.2% of pixels
// off by more than 4), which is enough to move a cluster that was sitting on
// the share threshold anyway. Neither answer is the "right" one and chasing
// bit-parity would pin the port to an implementation detail of numpy.
//
// So the assertions are about the SOURCE CARD, which is what actually matters
// and is true of any correct implementation:
//
//   1. NO INVENTED COLOUR — every fill the trace uses is really in the card.
//      This is the halo bug and the pink-fleck bug, both of which shipped: a
//      cluster spent on the anti-aliased ramp, and a -1 label painted as
//      cluster 0. Both put a colour on the page that the card never had.
//   2. NO DROPPED COLOUR — almost every coloured pixel of the card is close to
//      some fill the trace kept. This is the "grey hammer head came out lilac"
//      bug and the "the astronaut lost his mint backpack" bug.
//   3. LINE WEIGHT — the trace draws the same amount of ink as the card, at
//      the source's own 50% crossing. This is what the ink=130 fix was
//      measured on; at 150 the cards drew 6-9% fat.
//   4. STRUCTURE — the rendered trace still looks like the card. A coarse
//      whole-image difference, which is what catches a catastrophe like the
//      Grand Tour losing its black background.
//
// 3 and 4 are measured on the RENDERED SVG, not on the flattened raster.
// Measuring the flatten is circular — it paints the ink mask it just defined,
// so line weight comes out at exactly 0.00% every time and the check proves
// nothing. Rasterising is sharp's (librsvg), which needs no browser.
//
// The fixtures are the exact PNGs the committed SVGs under
// docs/gravity-lock/vector/ were traced from, banked in Storage and listed in
// docs/gravity-lock/trace-fixtures.json. They are public, so this needs network
// but no credential; it caches under .cache/trace-fixtures/ and SKIPS rather
// than failing when it cannot reach them, the same way the playwright tests do.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { vectorize, DEFAULTS, dilate } = require('../vectorize');

const FIXTURES = path.join(__dirname, '..', 'docs', 'gravity-lock', 'trace-fixtures.json');
const CACHE = path.join(__dirname, '..', '.cache', 'trace-fixtures');

// Every cap is set ABOVE THE MEASURED SPREAD of the thirteen fixtures, with
// headroom, so the test fails on a regression rather than on noise. Observed
// across all thirteen: line weight -1.5% to +5.3%, unexplained colour at most
// 0.40%, whole-card difference at most 2.6. Re-measure before moving one.
const INVENTED_TOL = 12;   // a fill must sit this close to real card pixels
const INVENTED_MIN = 60;   // …and that many of them, or it is noise
const DROPPED_TOL = 22;    // a solid pixel further than this from every fill is unexplained
const DROPPED_MAX = 0.02;  // at most this share of SOLID pixels may be unexplained
// Line weight is rasteriser-dependent (librsvg and a browser antialias
// differently), so this cap belongs to sharp's renderer specifically.
const INK_TOL = 0.08;
const STRUCT_TOL = 5;      // mean abs RGB difference, rendered trace vs card

async function rgb(buf, width) {
  let s = sharp(buf).flatten({ background: '#ffffff' }).removeAlpha();
  if (width) s = s.resize(width, width, { fit: 'fill' });
  const { data, info } = await s.raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

const lumOf = (d, i) => 0.299 * d[i * 3] + 0.587 * d[i * 3 + 1] + 0.114 * d[i * 3 + 2];

async function check(id, url) {
  const png = path.join(CACHE, id + '.png');
  if (!fs.existsSync(png)) {
    fs.mkdirSync(CACHE, { recursive: true });
    const r = await fetch(url);
    if (!r.ok) throw new Error(`cannot fetch ${id}: ${r.status}`);
    fs.writeFileSync(png, Buffer.from(await r.arrayBuffer()));
  }
  const src = fs.readFileSync(png);
  const t0 = Date.now();
  const trace = await vectorize(src);
  const ms = Date.now() - t0;

  const S = await rgb(src);                     // the card at its own size
  const R = await rgb(Buffer.from(trace.svg), S.w);   // the trace, rendered to match
  const N = S.w * S.h;
  const bad = [];

  // 1 — no invented colour
  for (const c of trace.colors) {
    let n = 0;
    for (let i = 0; i < N; i++) {
      if (Math.abs(S.data[i * 3] - c[0]) <= INVENTED_TOL &&
          Math.abs(S.data[i * 3 + 1] - c[1]) <= INVENTED_TOL &&
          Math.abs(S.data[i * 3 + 2] - c[2]) <= INVENTED_TOL) { n++; if (n >= INVENTED_MIN) break; }
    }
    if (n < INVENTED_MIN) bad.push(`invented colour ${c.join(',')} — only ${n} pixels of the card are near it`);
  }

  // 2 — no dropped colour. Judged over the card's SOLID pixels only: the ink,
  // the paper and the anti-aliased collar beside every line are not fills and
  // are painted separately. Counting the collar here was the first version's
  // mistake and it read as a 10-19% failure on every card.
  //
  // PAPER counts as an explanation. The flatten's output is fills + ink +
  // paper, so a source pixel painted white is accounted for even though no
  // FILL is near it. Leaving white out failed the mirror card at 2.30% once
  // near-white fills started being merged into paper — and every one of those
  // 229 pixels was pale (within 45 of white) and correctly painted. Checked
  // before changing this, because loosening a test to make it pass is how a
  // real regression gets waved through.
  const inkm = new Uint8Array(N), paperm = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const l = lumOf(S.data, i);
    if (l < DEFAULTS.ink) inkm[i] = 1; else if (l > DEFAULTS.paper) paperm[i] = 1;
  }
  const edge = dilate(inkm, S.w, S.h, DEFAULTS.band);
  let solid = 0, unexplained = 0;
  for (let i = 0; i < N; i++) {
    if (inkm[i] || paperm[i] || edge[i]) continue;
    solid++;
    let best = Math.max(255 - S.data[i * 3], 255 - S.data[i * 3 + 1], 255 - S.data[i * 3 + 2]);
    for (const c of trace.colors) {
      const d = Math.max(Math.abs(S.data[i * 3] - c[0]), Math.abs(S.data[i * 3 + 1] - c[1]), Math.abs(S.data[i * 3 + 2] - c[2]));
      if (d < best) best = d;
    }
    if (best > DROPPED_TOL) unexplained++;
  }
  const share = solid ? unexplained / solid : 0;
  if (share > DROPPED_MAX) bad.push(`${(share * 100).toFixed(2)}% of the card's solid colour is in no fill (cap ${DROPPED_MAX * 100}%)`);

  // 3 + 4 — line weight and structure, rendered trace against the card
  let inkS = 0, inkR = 0, diff = 0;
  for (let i = 0; i < N; i++) {
    if (inkm[i]) inkS++;
    if (lumOf(R.data, i) < DEFAULTS.ink) inkR++;
    diff += Math.abs(S.data[i * 3] - R.data[i * 3]) + Math.abs(S.data[i * 3 + 1] - R.data[i * 3 + 1]) + Math.abs(S.data[i * 3 + 2] - R.data[i * 3 + 2]);
  }
  const rel = inkS ? (inkR - inkS) / inkS : 0;
  if (Math.abs(rel) > INK_TOL) bad.push(`line weight ${(rel * 100).toFixed(1)}% off the card (cap ${INK_TOL * 100}%)`);
  const mad = diff / (N * 3);
  if (mad > STRUCT_TOL) bad.push(`the rendered trace differs from the card by ${mad.toFixed(1)} per channel (cap ${STRUCT_TOL})`);

  return { id, fills: trace.colors.length, kb: Math.round(trace.svg.length / 1024), ink: rel, mad, unexplained: share, ms, bad };
}

let failedAuto = false;

(async () => {
  const only = process.argv[2];
  const map = JSON.parse(fs.readFileSync(FIXTURES, 'utf8'));
  const ids = Object.keys(map).filter((k) => !only || k === only);
  if (!ids.length) { console.error('no such fixture: ' + only); process.exit(1); }

  if (!fs.existsSync(path.join(CACHE, ids[0] + '.png'))) {
    try {
      const probe = await fetch(map[ids[0]], { method: 'HEAD' });
      if (!probe.ok) throw new Error('status ' + probe.status);
    } catch (e) {
      console.log('SKIP — the trace fixtures are not reachable (' + e.message + ')');
      process.exit(0);
    }
  }

  // The per-card checks below run at the FIXED default threshold on purpose —
  // that is what makes them a regression detector for the flattener. What ships
  // is `ink: 'auto'`, so prove separately that calibration lands where it says.
  {
    const { vectorize: vec, inkShare } = require('../vectorize');
    const one = ids.includes('weight') ? 'weight' : ids[0];
    const png = path.join(CACHE, one + '.png');
    if (fs.existsSync(png)) {
      const src = fs.readFileSync(png);
      const auto = await vec(src, { ink: 'auto' });
      const good = Math.abs(auto.inkErr) <= 0.02;
      console.log(`${good ? 'ok  ' : 'FAIL'} ink:auto on ${one} — ink ${auto.ink}, ${(auto.inkErr * 100).toFixed(1)}% off the source (cap 2%)`);
      if (!good) failedAuto = true;
    }
  }

  let failed = failedAuto ? 1 : 0;
  for (const id of ids) {
    const r = await check(id, map[id]);
    console.log(`${r.bad.length ? 'FAIL' : 'ok  '} ${id.padEnd(10)} ${r.fills} fills  ` +
      `ink ${(r.ink * 100 >= 0 ? '+' : '') + (r.ink * 100).toFixed(1)}%  ` +
      `unexplained ${(r.unexplained * 100).toFixed(2)}%  diff ${r.mad.toFixed(1)}  ${r.kb}KB  ${(r.ms / 1000).toFixed(1)}s`);
    for (const b of r.bad) console.log('       ' + b);
    if (r.bad.length) failed++;
  }
  console.log(failed ? `\n${failed} of ${ids.length} cards failed` : `\nall ${ids.length} cards trace faithfully`);
  process.exit(failed ? 1 : 0);
})();
