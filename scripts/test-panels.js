#!/usr/bin/env node
/**
 * PANELS — the geometry, the prompt, the suffix rewrite and the cost model.
 * Pure: no network, no Firebase, no model call.
 *
 *   node scripts/test-panels.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const G = require('../sheet-grid');
const P = require('../panels');
const sizeTier = require('../size-tier');

// The two measured anchors' medium rates, read out of panels.js rather than
// retyped — the direction of the clamp depends on them.
const CENTS_RATE = (shape) => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'panels.js'), 'utf8');
  const m = new RegExp(shape + ": \\{ ratio: [\\d.]+, low: \\[[\\d., ]+\\], medium: \\[[\\d.]+, ([\\d.]+)\\]").exec(src);
  assert.ok(m, 'found the ' + shape + ' anchor in panels.js');
  return Number(m[1]);
};

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('  ok  ' + name); };
const ROOT = path.join(__dirname, '..');

console.log('\npanels\n');

// --------------------------------------------------------------------------
// The geometry
// --------------------------------------------------------------------------

t('every canvas obeys every gpt-image-2 constraint', () => {
  for (const grid of Object.keys(G.GRIDS)) {
    for (const shape of Object.keys(G.SHAPES)) {
      for (const tier of Object.keys(G.TIERS)) {
        const p = G.sheetFor(Number(grid), shape, tier);
        assert.ok(p, `${grid}/${shape}/${tier} has a plan`);
        const where = `${grid}/${shape}/${tier} ${p.sheet}`;
        assert.strictEqual(p.width % 16, 0, `width x16: ${where}`);
        assert.strictEqual(p.height % 16, 0, `height x16: ${where}`);
        assert.ok(Math.max(p.width, p.height) <= G.MAX_EDGE, `long edge: ${where}`);
        assert.ok(p.pixels <= G.MAX_PX, `under the pixel cap: ${where}`);
        assert.ok(p.pixels >= G.MIN_PX, `over the pixel floor: ${where}`);
        const r = Math.max(p.width, p.height) / Math.min(p.width, p.height);
        assert.ok(r <= 3, `ratio under 3:1: ${where}`);
      }
    }
  }
});

t('a sheet divides into WHOLE-pixel cells that tile it exactly', () => {
  // This is what makes the cut a lossless crop rather than a resample — the
  // house "nothing stands between the source and the output" rule.
  for (const grid of Object.keys(G.GRIDS)) {
    for (const shape of Object.keys(G.SHAPES)) {
      for (const tier of Object.keys(G.TIERS)) {
        const p = G.sheetFor(Number(grid), shape, tier);
        const boxes = G.cutBoxes(p);
        assert.strictEqual(boxes.length, p.count, `${grid}: one box per cell`);
        assert.strictEqual(p.cellWidth * p.across, p.width, `${grid}: cells span the width`);
        assert.strictEqual(p.cellHeight * p.down, p.height, `${grid}: cells span the height`);
        // no box leaves the sheet, and together they cover every pixel once
        let area = 0;
        for (const b of boxes) {
          assert.ok(b.left >= 0 && b.top >= 0, 'box starts inside');
          assert.ok(b.left + b.width <= p.width, 'box ends inside (x)');
          assert.ok(b.top + b.height <= p.height, 'box ends inside (y)');
          area += b.width * b.height;
        }
        assert.strictEqual(area, p.pixels, `${grid}/${shape}/${tier}: the cuts tile the sheet`);
      }
    }
  }
});

t('a cell keeps the shape she picked, whatever the grid', () => {
  // 2:3 stays 2:3 in a 2x2, a 3x3 AND side by side on a landscape page —
  // that last one is the whole point of "2 (landscape, side by side)".
  for (const grid of Object.keys(G.GRIDS)) {
    for (const tier of Object.keys(G.TIERS)) {
      const p = G.sheetFor(Number(grid), 'portrait', tier);
      assert.ok(Math.abs(p.cellWidth / p.cellHeight - 2 / 3) < 1e-9,
        `${grid}/${tier}: cell is 2:3 (${p.cell})`);
      const s = G.sheetFor(Number(grid), 'square', tier);
      assert.strictEqual(s.cellWidth, s.cellHeight, `${grid}/${tier}: cell is square`);
    }
  }
});

t('TWO is a LANDSCAPE page of portrait pictures — her words', () => {
  const p = G.sheetFor(2, 'portrait', '4k');
  assert.ok(p.width > p.height, `the sheet is landscape (${p.sheet})`);
  assert.ok(p.cellHeight > p.cellWidth, `each picture is portrait (${p.cell})`);
  assert.strictEqual(p.count, 2);
  assert.deepStrictEqual(G.cellNames(2), ['left', 'right']);
});

t('the grid-4 portrait ladder IS the Playground’s own canvases', () => {
  // The strongest check there is that the derivation is right: it reproduces,
  // from the constraints alone, the three canvases PL_GPT.res names by hand.
  assert.strictEqual(G.sheetFor(4, 'portrait', '1k').sheet, '1024x1536');
  assert.strictEqual(G.sheetFor(4, 'portrait', '2k').sheet, '1568x2352');
  assert.strictEqual(G.sheetFor(4, 'portrait', '4k').sheet, '2336x3504');
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  for (const c of ['1024x1536', '1568x2352', '2336x3504']) {
    assert.ok(src.includes(c), `server.js still names ${c}`);
  }
});

t('a cut panel’s caption is the fraction and the SHEET’s tier', () => {
  const p = G.sheetFor(4, 'portrait', '4k');
  assert.strictEqual(sizeTier.cutSize(p.sheet, p.count), '1/4 (4K)');
  // the thing this avoids: the panel's OWN pixels land on the 1K rung
  assert.strictEqual(sizeTier.tierOf(p.cell), '1K');
  assert.strictEqual(sizeTier.cutSize(G.sheetFor(9, 'portrait', '4k').sheet, 9), '1/9 (4K)');
  assert.strictEqual(sizeTier.cutSize(G.sheetFor(2, 'portrait', '2k').sheet, 2), '1/2 (2K)');
});

t('an unknown grid, shape or tier is null — never an invented canvas', () => {
  assert.strictEqual(G.sheetFor(5, 'portrait', '4k'), null);
  assert.strictEqual(G.sheetFor(4, 'oblong', '4k'), null);
  assert.strictEqual(G.sheetFor(4, 'portrait', '8k'), null);
  assert.deepStrictEqual(G.cutBoxes(null), []);
});

// --------------------------------------------------------------------------
// The prompt
// --------------------------------------------------------------------------

const DREAMY_SUFFIX = 'Render as ONE single illustration — NOT a grid, NOT split panels. '
  + 'Draw it inside a hand-drawn border, like the frames in the style '
  + 'reference. no text. Again: the attached image is a STYLE reference '
  + 'only — do not draw its content, its subjects or its composition.';

t('the style’s "one single illustration" clause is REMOVED, not argued with', () => {
  // The load-bearing one. Two sentences arguing produce a single panel with
  // ghosts of the others; the clause has to go, and only the clause.
  const out = P.sheetSuffix(DREAMY_SUFFIX);
  assert.ok(!/single illustration/i.test(out), 'the one-picture clause is gone');
  assert.ok(!/NOT a grid/i.test(out), 'the anti-grid clause is gone');
  // everything else survives verbatim — the border, the text rule, the ref rule
  assert.ok(out.includes('hand-drawn border'), 'the border clause survives');
  assert.ok(out.includes('no text.'), 'the text rule survives');
  assert.ok(out.includes('STYLE reference'), 'the reference rule survives');
});

t('a tail with no such clause is left exactly alone', () => {
  const evan = 'Do not include any text in the image.';
  assert.strictEqual(P.sheetSuffix(evan), evan);
  assert.strictEqual(P.sheetSuffix(''), '');
  assert.strictEqual(P.sheetSuffix(null), '');
});

t('her words go in VERBATIM, one line per cell, in reading order', () => {
  const plan = G.sheetFor(4, 'portrait', '4k');
  const panels = ['a cat on a fire escape', 'the same cat asleep',
    'a bowl of milk', 'rain on the window'];
  const out = P.buildPrompt({ plan, panels, prefix: 'PRE', suffix: 'SUF',
    cells: G.cellNames(4) });
  panels.forEach((p, i) => {
    assert.ok(out.includes(`${G.cellNames(4)[i]}: ${p}`), `panel ${i} verbatim and named`);
  });
  assert.ok(out.startsWith('PRE'), 'the prefix leads');
  assert.ok(out.trimEnd().endsWith('SUF'), 'the tail rides last, after her words');
  // her words appear ONCE each — nothing is restated or summarised
  panels.forEach((p) => {
    assert.strictEqual(out.split(p).length - 1, 1, `"${p}" appears once`);
  });
});

t('the grid sentence states the CUT, and says nothing about decoration', () => {
  // A sentence here about borders or caption boxes would argue with a style's
  // own tail — the exact failure the module header warns about, and Dreamy
  // legitimately asks for a hand-drawn frame per panel.
  const plan = G.sheetFor(4, 'portrait', '4k');
  const out = P.buildPrompt({ plan, panels: ['a', 'b', 'c', 'd'],
    prefix: '', suffix: '', cells: G.cellNames(4) });
  assert.ok(/no gutters/.test(out), 'it forbids gutters — the cut needs that');
  assert.ok(/cut along those lines/.test(out), 'it says why');
  assert.ok(!/\bborder\b/i.test(out), 'it says nothing about borders');
  assert.ok(!/caption box/i.test(out), 'it says nothing about caption boxes');
  // and it names the real geometry
  assert.ok(out.includes('2x2 grid of 4'), 'names the grid');
  const two = P.buildPrompt({ plan: G.sheetFor(2, 'portrait', '4k'),
    panels: ['a', 'b'], prefix: '', suffix: '', cells: G.cellNames(2) });
  assert.ok(/single row of 2 .* side by side/.test(two), 'two reads as a row, not a grid');
});

// --------------------------------------------------------------------------
// The cost model
// --------------------------------------------------------------------------

t('the cost model reproduces the MEASURED table it was not fitted on', () => {
  // The coefficients come from the 1K and 4K rungs of PL_GPT.res; the 2K rung
  // is the independent check. A per-megapixel rate was the first cut here and
  // it was ~2x wrong at 4K — gpt-image-2 is SUB-linear in pixels, which is the
  // whole reason this tool is cheaper.
  const cases = [
    ['portrait', 1568, 2352, { low: 0.75, medium: 6.55, high: 26.21 }],
    ['square', 1920, 1920, { low: 1.09, medium: 9.83, high: 39.31 }],
    // and the rungs it WAS fitted on must come back exact-ish too
    ['portrait', 2336, 3504, { low: 1.35, medium: 11.74, high: 46.94 }],
    ['square', 1024, 1024, { low: 0.6, medium: 5.3, high: 21.1 }],
  ];
  for (const [name, w, h, want] of cases) {
    const got = P.sheetCents({ pixels: w * h, width: w, height: h, count: 1 });
    for (const q of ['low', 'medium', 'high']) {
      const err = Math.abs(got[q].sheet - want[q]) / want[q];
      assert.ok(err < 0.05, `${name} ${w}x${h} ${q}: ${got[q].sheet} vs ${want[q]} (${(err * 100).toFixed(1)}%)`);
      assert.strictEqual(got[q].approx, true, 'every estimate says it is one');
    }
  }
});

t('"each" is the sheet split by the panel count — the number the tool is for', () => {
  const plan = G.sheetFor(4, 'portrait', '4k');
  const c = P.sheetCents(plan).medium;
  assert.ok(Math.abs(c.each - c.sheet / 4) < 0.02, 'each = sheet / count');
  // and the claim the tool rests on: a 4K quarter beats a separate 1K draw
  // on price AND on pixels
  assert.ok(c.each < 4.1, `a 4K quarter (${c.each}c) is cheaper than a 1K draw (4.1c)`);
  assert.ok(plan.cellWidth * plan.cellHeight > 1024 * 1536,
    'and it has more pixels than a 1K draw');
});

t('a ratio outside the measured range is CLAMPED and says so', () => {
  // Two squares side by side make a 2:1 page and nothing at 2:1 was ever
  // measured. Running the fit out there is a straight line leaving its data.
  const wide = G.sheetFor(2, 'square', '4k');
  const c = P.sheetCents(wide).medium;
  assert.strictEqual(c.clamped, true, 'a 2:1 sheet is flagged as clamped');
  // it is quoted at the NEAREST MEASURED shape (2:3), not at a line run out
  // past the data — the same pixels in a real 2:3 page come back identical
  const asPortrait = P.sheetCents(
    { pixels: wide.pixels, width: 2 * 1000, height: 3 * 1000, count: wide.count });
  assert.ok(Math.abs(c.sheet - asPortrait.medium.sheet) < 0.02,
    `clamped to the 2:3 anchor (${c.sheet} vs ${asPortrait.medium.sheet})`);
  // and since cost FALLS as a page gets less square, quoting the 2:3 price for
  // a 2:1 page errs high rather than low — the safe direction for a number she
  // decides what to spend from
  assert.ok(CENTS_RATE('square') > CENTS_RATE('portrait'),
    'the measured anchors do fall that way');
  // and a shape inside the range is NOT flagged
  assert.strictEqual(P.sheetCents(G.sheetFor(4, 'portrait', '4k')).medium.clamped, false);
});

// --------------------------------------------------------------------------
// The page's contracts
// --------------------------------------------------------------------------

const PAGE = fs.readFileSync(path.join(ROOT, 'public', 'panels.html'), 'utf8');

t('the page holds NO price and NO prompt text of its own', () => {
  // Same rule as the Playground's /styles route: server.js owns what is sent
  // and what it costs; a copy in the HTML is a second source of truth.
  assert.ok(!/\b\d+\.\d+\s*c\b/.test(PAGE.replace(/cents/g, '')), 'no cost figure baked in');
  assert.ok(!/style reference/i.test(PAGE.replace(/reference is paid for/i, '')),
    'no style prefix baked in');
  assert.ok(PAGE.includes('/api/panels/config'), 'it asks the server instead');
});

t('the boxes ship EMPTY — no placeholder, no example', () => {
  const areas = PAGE.match(/<textarea[^>]*>[\s\S]*?<\/textarea>/g) || [];
  for (const a of areas) {
    assert.ok(!/placeholder=/.test(a), `no placeholder: ${a.slice(0, 60)}`);
    const inner = a.replace(/<textarea[^>]*>/, '').replace(/<\/textarea>/, '').trim();
    assert.strictEqual(inner, '', `nothing between the tags: ${a.slice(0, 60)}`);
  }
  // the same grep the house rule asks for, on text inputs
  assert.ok(!/<input[^>]*type=["']text["'][^>]*value=["'][^"']+["']/.test(PAGE), 'no prefilled input');
});

t('the pill contract: corner reserved, no page-level var collision, no own pill', () => {
  assert.ok(/padding-right:\s*64px/.test(PAGE), 'the control row reserves 64px for the pill');
  assert.ok(!/class="float"/.test(PAGE), 'the page adds no pill of its own — the server injects it');
  assert.ok(/body\.tool \.float/.test(PAGE), 'it out-specifies .float to colour the injected pill');
  // the injected pill declares `var raf` / `var I` in global scope; a
  // page-level `let raf` kills its script at parse time
  assert.ok(/\(function \(\) \{/.test(PAGE), 'the page script is wrapped in an IIFE');
  for (const name of ['raf', 'I', 'playing']) {
    const re = new RegExp('^\\s*(let|const|var)\\s+' + name + '\\b', 'm');
    assert.ok(!re.test(PAGE), `no top-level ${name}`);
  }
});

t('the generate glyph is the house star, character for character', () => {
  // One generate glyph everywhere — a button that spends a model call must
  // read the same in every surface.
  const lab = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');
  const star = /sparkles: '(<svg[\s\S]*?<\/svg>)'/.exec(lab);
  assert.ok(star, 'found the Playground’s star');
  assert.ok(PAGE.includes(star[1]), 'panels.html carries the identical glyph');
});

t('the slider is the Playground’s .swtog, geometry for geometry', () => {
  // The same control in two tools must not drift — she asked for them to be
  // identical there and this is a third copy of the same shape.
  const lab = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');
  for (const prop of ['--tw: 78px', '--k: 26px', '--gap: 22px', 'height: 34px', 'border-radius: 17px']) {
    assert.ok(lab.includes(prop), `promptlab declares ${prop}`);
    assert.ok(PAGE.includes(prop), `panels declares ${prop}`);
  }
  assert.ok(/\.swtog\[data-n="2"\]::after \{ transform: translateX\(calc\(var\(--gap\) \* 2\)\)/.test(PAGE),
    'the stops are derived from --gap, not typed');
});

t('server.js mounts it, and hands it every dependency it names', () => {
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.ok(src.includes("app.use('/api/panels', panels.router)"), 'the api is mounted');
  assert.ok(src.includes("app.get('/panels', serveGated('panels.html'"), 'the page is served');
  // every dep the module reads must actually be handed over — a missing one
  // fails at draw time, after she has already tapped generate
  const mount = /panels\.init\(\{([\s\S]*?)\}\);/.exec(src);
  assert.ok(mount, 'found panels.init');
  for (const key of ['imageEdit', 'refsFor', 'saveBuffer', 'fileCreation', 'styles', 'gpt']) {
    assert.ok(new RegExp(key + ':').test(mount[1]), `init passes ${key}`);
  }
});

t('fileCreationDoc writes the third caption slot, and takes an override', () => {
  // A cut panel's slot cannot be derived from its own pixels, so the Panels
  // module has to be able to pass it in.
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.ok(/async function fileCreationDoc\(\{[^}]*sizeSlot/.test(src),
    'fileCreationDoc accepts sizeSlot');
  assert.ok(/const slot = sizeSlot \|\|/.test(src), 'the override wins over the derivation');
});

t('the searchable text is her words first', () => {
  const hay = P.hay({ panels: ['a cat on a fire escape'], style: 'dreamy',
    quality: 'medium', sheetSize: '2336x3504', cellSize: '1168x1752', count: 4 });
  assert.ok(hay.startsWith('a cat on a fire escape'), 'her words lead');
  assert.ok(hay.includes('dreamy') && hay.includes('medium'), 'and how it was drawn is in there');
  assert.strictEqual(hay, hay.toLowerCase(), 'lowercased for matching');
});

// --------------------------------------------------------------------------
// THE CUT ITSELF, against real pixels. sharp is already a dependency; nothing
// here touches the network and nothing is spent.
// --------------------------------------------------------------------------

(async () => {
  const sharp = require('sharp');
  const COLOURS = ['#c1440e', '#0e6ec1', '#2f8f2f', '#8f2f8f', '#c9a227',
    '#227fc9', '#c92255', '#22c9a2', '#555555'];

  for (const [grid, shape] of [[4, 'portrait'], [9, 'portrait'], [2, 'portrait'], [4, 'square']]) {
    const plan = G.sheetFor(grid, shape, '4k');
    const boxes = G.cutBoxes(plan);
    // A sheet whose cells are solid, DISTINCT colours: a wrong crop then shows
    // up as a wrong colour rather than as a plausible-looking picture.
    // Lossless, because the only variable under test is the crop.
    const sheet = await sharp({ create: { width: plan.width, height: plan.height,
      channels: 3, background: '#000' } })
      .composite(boxes.map((b, i) => ({
        input: { create: { width: b.width, height: b.height, channels: 3,
          background: COLOURS[i] } }, left: b.left, top: b.top })))
      .webp({ lossless: true }).toBuffer();

    for (let i = 0; i < plan.count; i++) {
      const cut = await sharp(sheet).extract(boxes[i]).webp({ lossless: true }).toBuffer();
      const { data, info } = await sharp(cut).raw().toBuffer({ resolveWithObject: true });
      assert.strictEqual(`${info.width}x${info.height}`, plan.cell,
        `grid ${grid} ${shape} panel ${i}: the cut is exactly one cell`);
      // sample the CENTRE — the question is which region was cropped, and a
      // corner pixel sits on an encoder edge
      const o = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
      const hex = '#' + [data[o], data[o + 1], data[o + 2]]
        .map((v) => v.toString(16).padStart(2, '0')).join('');
      assert.strictEqual(hex, COLOURS[i],
        `grid ${grid} ${shape} panel ${i}: cropped its OWN cell, not a neighbour's`);
    }
    n++;
    console.log(`  ok  the cut lands on the right pixels — grid ${grid} ${shape} `
      + `(${plan.sheet} -> ${plan.count} x ${plan.cell})`);
  }

  console.log(`\n${n} checks passed.\n`);
})().catch((e) => { console.error('\nFAILED:', e.message, '\n'); process.exit(1); });
