#!/usr/bin/env node
/**
 * SHEET SEAMS — the image-aware cut lines behind Panels (2026-08-25, Sophie:
 * "the cutting doesn't cut on the right lines because it's using math … it
 * needs some mechanism that's actually aware and looks at the picture").
 *
 * Pure: sheets are built as raw grayscale bytes, so this needs neither sharp
 * nor the network. The one rule under test everywhere: the seam follows a
 * REAL drawn gutter and otherwise stands on the mathematical line — the
 * failure mode is "no better than before", never "worse".
 *
 *   node scripts/test-sheet-seams.js
 */
const assert = require('assert');
const S = require('../sheet-seams');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('  ok  ' + name); };

console.log('\nsheet-seams\n');

// A synthetic sheet: `panels` paints dark regions, everything else is paper.
// gray value: paper 245 (ink 10), panel body 150 (ink 105).
function makeSheet(width, height, panels) {
  const data = new Uint8Array(width * height).fill(245);
  for (const p of panels) {
    for (let y = p.top; y < p.top + p.height; y++) {
      for (let x = p.left; x < p.left + p.width; x++) data[y * width + x] = 150;
    }
  }
  return data;
}

t('a gutter drawn OFF the mathematical line is found, and the cut lands in its middle', () => {
  // 400 wide, math line at 200 — but the model drew the gutter at 212..228
  const W = 400, H = 300;
  const data = makeSheet(W, H, [
    { left: 10, top: 10, width: 202, height: H - 20 },   // left panel ends at 212
    { left: 228, top: 10, width: W - 238, height: H - 20 }, // right starts at 228
  ]);
  const { xs, moved } = S.findSeams({ data, width: W, height: H, across: 2, down: 1 });
  assert.strictEqual(moved, 1, 'the picture moved the seam');
  assert.ok(Math.abs(xs[1] - 220) <= 3, `seam ${xs[1]} sits in the gutter's middle (~220)`);
});

t('both axes of a 2x2, each gutter off its line a different way', () => {
  const W = 400, H = 600;
  // vertical gutter at 186..200 (math 200), horizontal at 306..322 (math 300)
  const data = makeSheet(W, H, [
    { left: 8, top: 8, width: 178, height: 298 },
    { left: 200, top: 8, width: 192, height: 298 },
    { left: 8, top: 322, width: 178, height: 270 },
    { left: 200, top: 322, width: 192, height: 270 },
  ]);
  const { xs, ys, moved } = S.findSeams({ data, width: W, height: H, across: 2, down: 2 });
  assert.strictEqual(moved, 2, 'both internal seams moved');
  assert.ok(Math.abs(xs[1] - 193) <= 3, `vertical seam ${xs[1]} ~193`);
  assert.ok(Math.abs(ys[1] - 314) <= 3, `horizontal seam ${ys[1]} ~314`);
});

t('a gutter exactly ON the line stays put in effect — seam lands where math would', () => {
  const W = 400, H = 300;
  const data = makeSheet(W, H, [
    { left: 10, top: 10, width: 182, height: H - 20 },   // ends 192
    { left: 208, top: 10, width: 182, height: H - 20 },  // gutter 192..208, centre 200
  ]);
  const { xs } = S.findSeams({ data, width: W, height: H, across: 2, down: 1 });
  assert.ok(Math.abs(xs[1] - 200) <= 2, `seam ${xs[1]} ~200`);
});

t('a FULL-BLEED sheet cuts ON the drawn border line, off the math line (the cat-sheet case)', () => {
  // Measured live 2026-08-25: a 2x2 with no paper anywhere — panels butt on
  // one drawn line, the row border 8px off the math line at mean ink 184
  // against a ~147 field. The first cut of this module invented a valley
  // 149px into the picture here; the peak rule is what fixed it.
  const W = 400, H = 300;
  const data = new Uint8Array(W * H).fill(110);   // busy art everywhere (ink 145)
  // the border: a 6px darker band at x 212..217 (math line 200)
  for (let y = 0; y < H; y++) for (let x = 212; x <= 217; x++) data[y * W + x] = 40;
  const { xs, moved } = S.findSeams({ data, width: W, height: H, across: 2, down: 1 });
  assert.strictEqual(moved, 1, 'the border moved the seam');
  assert.ok(Math.abs(xs[1] - 214) <= 3, `seam ${xs[1]} sits on the border (~214)`);
});

t('a LIGHT PATCH inside busy art is not a gutter — the paper test refuses it', () => {
  // the false valley that shipped first: lighter than its flanks, but nowhere
  // near paper against the sheet as a whole
  const W = 400, H = 300;
  const data = new Uint8Array(W * H).fill(110);   // ink 145
  for (let y = 0; y < H; y++) for (let x = 176; x <= 196; x++) data[y * W + x] = 140; // ink 115
  const { xs, moved } = S.findSeams({ data, width: W, height: H, across: 2, down: 1 });
  assert.strictEqual(moved, 0, 'not fooled');
  assert.strictEqual(xs[1], 200, 'the math line stands');
});

t('NO gutter (a hard step of two solid regions) falls back to the math line', () => {
  // The old solid-colour fixtures are exactly this shape: the minimum in the
  // window is just whichever side is lighter, and moving there would slice a
  // panel. The valley test refuses it.
  const W = 400, H = 300;
  const data = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    data[y * W + x] = x < 200 ? 120 : 200;   // darker left, lighter right, no valley
  }
  const { xs, moved } = S.findSeams({ data, width: W, height: H, across: 2, down: 1 });
  assert.strictEqual(moved, 0, 'nothing moved');
  assert.strictEqual(xs[1], 200, 'the math line stands');
});

t('a UNIFORM sheet falls back to the math lines on both axes', () => {
  const W = 300, H = 300;
  const data = new Uint8Array(W * H).fill(180);
  const { xs, ys, moved } = S.findSeams({ data, width: W, height: H, across: 3, down: 3 });
  assert.strictEqual(moved, 0);
  assert.deepStrictEqual(xs, [0, 100, 200, 300]);
  assert.deepStrictEqual(ys, [0, 100, 200, 300]);
});

t('a gutter OUTSIDE the search window is not chased — the window bounds the correction', () => {
  // gutter drawn a third of the sheet off the line: further than any real
  // drift, and chasing it would make one panel a sliver
  const W = 400, H = 300;
  const data = makeSheet(W, H, [
    { left: 10, top: 10, width: 110, height: H - 20 },   // ends 120
    { left: 136, top: 10, width: W - 146, height: H - 20 }, // gutter 120..136
  ]);
  const { xs } = S.findSeams({ data, width: W, height: H, across: 2, down: 1 });
  // window is ±12% of the 200px cell = ±24, so 120..136 (80px out) is out of reach
  assert.ok(Math.abs(xs[1] - 200) <= 26, `seam ${xs[1]} stayed near the line, not at 128`);
});

t('seamBoxes tiles the sheet exactly, whatever the seams did', () => {
  const seams = { xs: [0, 193, 400], ys: [0, 314, 600] };
  const boxes = S.seamBoxes(seams);
  assert.strictEqual(boxes.length, 4);
  const area = boxes.reduce((s, b) => s + b.width * b.height, 0);
  assert.strictEqual(area, 400 * 600, 'no pixel lost, none doubled');
  assert.deepStrictEqual(boxes[0], { left: 0, top: 0, width: 193, height: 314 });
  assert.deepStrictEqual(boxes[3], { left: 193, top: 314, width: 207, height: 286 });
});

t('reading order matches sheet-grid cellNames order (row-major)', () => {
  const boxes = S.seamBoxes({ xs: [0, 100, 200, 300], ys: [0, 150, 300] });
  assert.strictEqual(boxes.length, 6);
  assert.deepStrictEqual(boxes.map((b) => [b.left, b.top]),
    [[0, 0], [100, 0], [200, 0], [0, 150], [100, 150], [200, 150]]);
});

t('degenerate input falls back rather than throwing an inside-out crop', () => {
  const out = S.mathSeams(300, 300, 3, 3);
  assert.deepStrictEqual(out.xs, [0, 100, 200, 300]);
  assert.throws(() => S.findSeams({}), /sheet pixels required/);
});

console.log(`\n${n} checks passed.\n`);
