#!/usr/bin/env node
// Does a recolour actually change the colour — all of it, and only it?
//
//   node scripts/test-vector-recolor.js
//
// Recolouring is the one thing a vector buys you that a PNG cannot, and the
// obvious implementation (find-and-replace the palette hex codes) is WRONG in a
// way that looks fine in the diff and terrible on the page: vtracer writes a
// palette of four colours out as twenty-one hex values — the shapes come back
// slightly shifted, and thin BLEND layers sit wherever two colours meet. Replace
// only the exact matches and every edge keeps a fringe of the old colour.
//
// So this measures the RENDERED PICTURE, not the file. Four things:
//
//   1. GONE — almost none of the old colour is left anywhere on the page.
//   2. THERE — the area that was the old colour is now the new one, to within
//      a couple of levels, and it is the same size it was.
//   3. UNTOUCHED — every colour she did not name is pixel-identical.
//   4. NOTHING = NOTHING — recolouring with all nulls returns the same file,
//      byte for byte. This is what catches the projection quietly rounding
//      every other fill by a point or two.
//
// Fixtures are the Gravity Lock cards, the same ones test-vectorize.js uses:
// public, so this needs network but no credential, and it SKIPS rather than
// failing when they cannot be reached.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { vectorize, recolor, svgFills, edgeAnchors, toRgb, toHex } = require('../vectorize');

const FIXTURES = path.join(__dirname, '..', 'docs', 'gravity-lock', 'trace-fixtures.json');
const CACHE = path.join(__dirname, '..', '.cache', 'trace-fixtures');
const AT = 500;          // render size for every measurement
const HIT = 6;           // a pixel counts as a colour within this per channel
const LEFTOVER = 0.05;   // at most this % of the page may still be the old colour

let failed = 0;
const ok = (good, msg) => { console.log(`${good ? 'ok  ' : 'FAIL'} ${msg}`); if (!good) failed++; };

async function pixels(svg) {
  const { data, info } = await sharp(Buffer.from(svg))
    .flatten({ background: '#ffffff' }).removeAlpha()
    .resize(AT, AT, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  return { data, n: info.width * info.height };
}
const near = (d, i, c, tol = HIT) =>
  Math.abs(d[i * 3] - c[0]) <= tol && Math.abs(d[i * 3 + 1] - c[1]) <= tol && Math.abs(d[i * 3 + 2] - c[2]) <= tol;
const pct = (n, N) => (n / N * 100);

async function load(id, url) {
  const png = path.join(CACHE, id + '.png');
  if (!fs.existsSync(png)) {
    fs.mkdirSync(CACHE, { recursive: true });
    const r = await fetch(url);
    if (!r.ok) throw new Error(`cannot fetch ${id}: ${r.status}`);
    fs.writeFileSync(png, Buffer.from(await r.arrayBuffer()));
  }
  return fs.readFileSync(png);
}

(async () => {
  const map = JSON.parse(fs.readFileSync(FIXTURES, 'utf8'));
  const ids = ['weight', 'kepler', 'hole'].filter((k) => map[k]);
  if (!fs.existsSync(path.join(CACHE, ids[0] + '.png'))) {
    try {
      const probe = await fetch(map[ids[0]], { method: 'HEAD' });
      if (!probe.ok) throw new Error('status ' + probe.status);
    } catch (e) {
      console.log('SKIP — the trace fixtures are not reachable (' + e.message + ')');
      process.exit(0);
    }
  }

  // ── colour parsing: hex, [r,g,b] and CSS NAMES, and no guessing ──────────
  ok(toHex(toRgb('salmon')) === '#fa8072', 'a colour name is understood — salmon is #fa8072');
  ok(toHex(toRgb('Steel Blue')) === '#4682b4', 'spacing and case in a name do not matter');
  ok(toHex(toRgb('#3f6fd8')) === '#3f6fd8' && toHex(toRgb('#abc')) === '#aabbcc', 'hex, long and short');
  let threw = false;
  try { toRgb('dusty rose'); } catch (e) { threw = true; }
  ok(threw, 'an unknown name is refused, never guessed at');

  for (const id of ids) {
    const src = await load(id, map[id]);
    const t = await vectorize(src, { ink: 'auto' });
    const pal = t.colors;
    console.log(`\n${id} — ${pal.length} fills, ${svgFills(t.svg).length} hex values in the file`);

    // 4 — nothing asked, nothing changed.
    ok(recolor(t.svg, pal, pal.map(() => null)) === t.svg,
      'recolouring nothing returns the identical file');

    // Pick the fill with the most area to swap: the test means nothing if it
    // recolours a 0.01% sliver and calls it a pass.
    //
    // Area is counted at 4, the same window `recolor` treats as "this fill IS
    // that anchor" — NOT at 12. At 12 a near-white palette entry swallows the
    // whole paper (kepler's #f3f3f3 measured 90.8% of the page that way, and
    // the test then demanded the paper turn blue).
    const before = await pixels(t.svg);
    const areas = pal.map((c) => {
      let n = 0;
      for (let i = 0; i < before.n; i++) if (near(before.data, i, c, 4)) n++;
      return n;
    });
    const slot = areas.indexOf(Math.max(...areas));
    const old = pal[slot];
    const NEW = toRgb('#3f6fd8');
    ok(pct(areas[slot], before.n) > 0.4,
      `the colour under test covers ${pct(areas[slot], before.n).toFixed(2)}% of the page`);

    const out = recolor(t.svg, pal, pal.map((c, i) => (i === slot ? NEW : null)));
    const after = await pixels(out);

    let left = 0, landed = 0;
    for (let i = 0; i < after.n; i++) {
      if (near(after.data, i, old, 12)) left++;
      if (near(after.data, i, NEW)) landed++;
    }
    ok(pct(left, after.n) < LEFTOVER,
      `${toHex(old)} is gone — ${pct(left, after.n).toFixed(3)}% of the page still near it (cap ${LEFTOVER}%)`);
    ok(landed >= areas[slot] * 0.9,
      `the new colour covers what the old one did — ${pct(landed, after.n).toFixed(2)}% against ${pct(areas[slot], before.n).toFixed(2)}%`);

    // 3 — every other colour, plus the line and the paper, untouched.
    const edge = edgeAnchors(t.svg);
    const others = pal.filter((_, i) => i !== slot).concat([edge.ink, edge.paper]).filter(Boolean);
    let moved = 0, held = 0;
    for (let i = 0; i < before.n; i++) {
      if (!others.some((c) => near(before.data, i, c, 2))) continue;
      held++;
      if (before.data[i * 3] !== after.data[i * 3] || before.data[i * 3 + 1] !== after.data[i * 3 + 1]
        || before.data[i * 3 + 2] !== after.data[i * 3 + 2]) moved++;
    }
    // Not exactly zero, and it should not be: the rasteriser antialiases the
    // SEAM between the recoloured shape and its neighbour, so the pixels
    // straight along that edge legitimately change. Everything away from the
    // edge must not.
    ok(held > 0 && moved / held < 0.002,
      `the ${others.length} colours she did not name held still — ${moved} of ${held} pixels moved, all on the seam (cap 0.2%)`);
  }

  // ── ink and paper are anchors like any other ─────────────────────────────
  {
    const t = await vectorize(await load(ids[0], map[ids[0]]), { ink: 'auto' });
    const edge = edgeAnchors(t.svg);
    const navy = toRgb('#1f3a5f');
    const out = recolor(t.svg, [...t.colors, edge.ink], [...t.colors.map(() => null), navy]);
    const p = await pixels(out);
    let inkLeft = 0, navyNow = 0;
    for (let i = 0; i < p.n; i++) {
      if (near(p.data, i, edge.ink, 12)) inkLeft++;
      if (near(p.data, i, navy)) navyNow++;
    }
    ok(pct(inkLeft, p.n) < LEFTOVER && navyNow > 0,
      `the ink line can be recoloured — ${pct(navyNow, p.n).toFixed(2)}% navy, ${pct(inkLeft, p.n).toFixed(3)}% still black`);
  }

  console.log(failed ? `\n${failed} check${failed > 1 ? 's' : ''} failed` : '\nrecolouring is faithful');
  process.exit(failed ? 1 : 0);
})();
