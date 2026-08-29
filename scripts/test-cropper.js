#!/usr/bin/env node
// test-cropper.js — the Squaring tool's rules, pure. No network, no Firestore.
//
// The load-bearing one is THE PIN: crop.html draws the preview with its own
// `box()` and cropper.js cuts with `cropBox()`, and if those two ever disagree
// the page shows her a crop that is not the crop she gets. The page's function
// is EXTRACTED from the real html and driven — never re-typed here, which
// would only pin this file against itself.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const C = require('../cropper');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; }
  catch (e) { fail++; console.error('  ✗ ' + name + '\n    ' + e.message); }
};

/* ── cropBox ───────────────────────────────────────────────────────────── */
t('a portrait source moves along Y, full width', () => {
  const b = C.cropBox(1024, 1536, 0.5);
  assert.strictEqual(b.width, 1024);
  assert.strictEqual(b.height, 1024);
  assert.strictEqual(b.left, 0);
  assert.strictEqual(b.top, 256);            // (1536-1024)/2
  assert.strictEqual(b.axis, 'y');
});

t('pos 0 is flush with the top, pos 1 flush with the bottom', () => {
  assert.strictEqual(C.cropBox(1024, 1536, 0).top, 0);
  assert.strictEqual(C.cropBox(1024, 1536, 1).top, 512);
});

t('the box never leaves the picture, at any pos', () => {
  for (const p of [-5, -0.01, 0, 0.37, 0.5, 1, 1.01, 99, NaN]) {
    const b = C.cropBox(1024, 1536, p);
    assert.ok(b.top >= 0, 'top ' + b.top + ' at pos ' + p);
    assert.ok(b.top + b.height <= 1536, 'bottom ' + (b.top + b.height) + ' at pos ' + p);
  }
});

t('a landscape source moves along X instead', () => {
  const b = C.cropBox(1920, 1080, 0);
  assert.strictEqual(b.axis, 'x');
  assert.strictEqual(b.left, 0);
  assert.strictEqual(b.top, 0);
  assert.strictEqual(b.width, 1080);
  assert.strictEqual(C.cropBox(1920, 1080, 1).left, 840);
});

t('a square source has no axis and cannot move', () => {
  const b = C.cropBox(1000, 1000, 0.9);
  assert.strictEqual(b.axis, null);
  assert.strictEqual(b.left, 0);
  assert.strictEqual(b.top, 0);
  assert.strictEqual(b.width, 1000);
});

t('an odd slack still lands on whole pixels inside the picture', () => {
  const b = C.cropBox(100, 133, 1);
  assert.strictEqual(b.top, 33);
  assert.strictEqual(b.top + b.height, 133);
  assert.ok(Number.isInteger(b.top));
});

/* ── THE PIN: the page's preview is the server's cut ───────────────────── */
t('crop.html previews exactly what cropper.js cuts', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'crop.html'), 'utf8');
  const m = html.match(/function box\(w, h, pos\) \{[\s\S]*?\n  \}/);
  assert.ok(m, 'could not find box() in crop.html — did it get renamed?');
  // eslint-disable-next-line no-new-func
  const box = new Function('return (' + m[0].replace(/^function box/, 'function') + ')')();

  const sizes = [[1024, 1536], [1536, 1024], [800, 800], [1200, 1600], [1920, 1080], [100, 133]];
  for (const [w, h] of sizes) {
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const srv = C.cropBox(w, h, p);
      const pg = box(w, h, p);
      assert.strictEqual(pg.axis, srv.axis, 'axis at ' + w + 'x' + h);
      // The page speaks in fractions of the drawn picture; the server in
      // pixels. Compare them in pixels, within a pixel of rounding.
      assert.ok(Math.abs(pg.x * w - srv.left) <= 1, 'left at ' + w + 'x' + h + ' pos ' + p);
      assert.ok(Math.abs(pg.y * h - srv.top) <= 1, 'top at ' + w + 'x' + h + ' pos ' + p);
      assert.ok(Math.abs(pg.w * w - srv.width) <= 1, 'width at ' + w + 'x' + h + ' pos ' + p);
      assert.ok(Math.abs(pg.h * h - srv.height) <= 1, 'height at ' + w + 'x' + h + ' pos ' + p);
    }
  }
});

/* ── building a set ────────────────────────────────────────────────────── */
t('an item without an http url is dropped, not stored', () => {
  const items = C.buildItems([
    { url: 'https://x/a.webp' },
    { url: 'not a url' },
    { url: '' },
    { },
    { url: 'https://x/b.webp' },
  ]);
  assert.strictEqual(items.length, 2);
});

t('pos defaults to the centre and is clamped', () => {
  const items = C.buildItems([{ url: 'https://x/a.webp' }, { url: 'https://x/b.webp', pos: 9 }]);
  assert.strictEqual(items[0].pos, 0.5);
  assert.strictEqual(items[1].pos, 1);
});

t('two pictures at the same url are two items, not one', () => {
  const items = C.buildItems([{ url: 'https://x/a.webp' }, { url: 'https://x/a.webp' }]);
  assert.strictEqual(items.length, 2);
  assert.notStrictEqual(items[0].key, items[1].key);
});

t('an apply target is whitelisted, never stored raw', () => {
  assert.strictEqual(C.cleanApply({ kind: 'memory', uid: 'u', id: 'm' }).kind, 'memory');
  assert.strictEqual(C.cleanApply({ kind: 'memory', uid: 'u' }), null);
  assert.strictEqual(C.cleanApply({ kind: 'delete-everything', uid: 'u', id: 'm' }), null);
  assert.strictEqual(C.cleanApply(null), null);
  // and nothing else on the object survives
  const a = C.cleanApply({ kind: 'memory', uid: 'u', id: 'm', collection: 'users', extra: 1 });
  assert.deepStrictEqual(Object.keys(a).sort(), ['id', 'kind', 'uid']);
});

t('the same set POSTed twice is the same doc', () => {
  const a = C.buildItems([{ url: 'https://x/a.webp' }, { url: 'https://x/b.webp' }]);
  assert.strictEqual(C.setId('Shirt', a), C.setId('Shirt', a));
  assert.notStrictEqual(C.setId('Shirt', a), C.setId('Other', a));
});

/* ── re-seeding must not throw her work away ───────────────────────────── */
t('re-seeding keeps her positions and the crop already cut', () => {
  const fresh = C.buildItems([{ url: 'https://x/a.webp', label: 'new words' }]);
  const old = [{ ...fresh[0], pos: 0.2, out: 'https://x/out.webp', outPos: 0.2, outAt: 5, label: 'old words' }];
  const merged = C.mergeItems(old, fresh);
  assert.strictEqual(merged[0].pos, 0.2, 'her position survived');
  assert.strictEqual(merged[0].out, 'https://x/out.webp', 'the cut copy survived');
  assert.strictEqual(merged[0].label, 'new words', 'but the label is the caller\'s to correct');
});

t('a picture added on re-seed starts fresh', () => {
  const fresh = C.buildItems([{ url: 'https://x/a.webp' }, { url: 'https://x/new.webp' }]);
  const merged = C.mergeItems([{ ...fresh[0], pos: 0.2, out: 'u' }], fresh);
  assert.strictEqual(merged[1].pos, 0.5);
  assert.strictEqual(merged[1].out, '');
});

/* ── what needs cutting ────────────────────────────────────────────────── */
t('never cut, or moved since the cut, needs cutting', () => {
  assert.ok(C.needsCut({ pos: 0.5, out: '', outPos: null }));
  assert.ok(C.needsCut({ pos: 0.4, out: 'u', outPos: 0.5 }));
  assert.ok(!C.needsCut({ pos: 0.5, out: 'u', outPos: 0.5 }));
});

t('nudging away and back costs nothing', () => {
  const it = { pos: 0.5, out: 'u', outPos: 0.5 };
  it.pos = 0.54; assert.ok(C.needsCut(it));
  it.pos = 0.5; assert.ok(!C.needsCut(it), 'back where it was — nothing to re-cut');
});

/* ── the job ───────────────────────────────────────────────────────────── */
t('a stale running job stops blocking a new one', () => {
  assert.ok(C.jobLive({ status: 'running', startedAt: Date.now() }));
  assert.ok(!C.jobLive({ status: 'running', startedAt: Date.now() - 60 * 60 * 1000 }));
  assert.ok(!C.jobLive({ status: 'done', startedAt: Date.now() }));
  assert.ok(!C.jobLive(null));
});

/* ── the page's own contracts ──────────────────────────────────────────── */
t('the page keeps the house rules', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'crop.html'), 'utf8');
  assert.ok(/class="tool"/.test(html), 'body class="tool"');
  assert.ok(/tool\.css/.test(html), 'links the shared kit');
  assert.ok(/tool-eyebrow/.test(html), 'the title hides itself in the app');
  assert.ok(/id="help"/.test(html) && /helpcard/.test(html), 'the explanation is behind the "?"');
  assert.ok(/\(function \(\) \{/.test(html), 'the page script is in an IIFE — the pill shares this scope');
  // No page-level let/const named after the pill's own globals.
  const script = html.slice(html.indexOf('<script>'));
  assert.ok(!/\n\s*(let|const)\s+(raf|I|playing|dir|vm|vmid)\b/.test(script.replace(/\(function[\s\S]*/, '')),
    'no top-level binding shadowing a pill global');
  assert.ok(!/placeholder=/.test(html), 'no pre-written text in anything she writes in');
  assert.ok(!/width:\s*100%[^;]*;\s*\}/.test(html.match(/\.btn[\s\S]{0,200}/) || ''), 'buttons hug their words');
  // No pill on this page (one screen, never scrolls) — but it must still be
  // written to survive one, which is what the IIFE and the globals check above
  // are for. Pin that it does not ASK for one either.
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.ok(/app\.get\('\/crop', serveGated\('crop\.html'\)\)/.test(server),
    'crop.html is served without the pill');
});

console.log((fail ? '✗' : '✓') + ' cropper: ' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
