// The stuck-run sweep's decision table (pl-orphans.js) — what happens to a
// Playground run a deploy restart orphaned. Pure, no network, no Firestore.
//
//   node scripts/test-pl-orphans.js
//
// The case that earned this file (2026-08-29): a panels run killed DURING
// generation — no banked sheet — was marked failed with the money already
// spent. It must be REDRAWN, capped, with the staleness clock restarting on
// each redraw so the next sweep tick cannot kill the draw the last one
// started.
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const plOrphans = require(path.join(__dirname, '..', 'pl-orphans.js'));
const sheetGrid = require(path.join(__dirname, '..', 'sheet-grid.js'));

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log(`  ok ${n}  ${name}`); };

const panels = ['a door', 'a card game', 'a party', 'a window', 'pill bottles', 'a platform'];
const block = sheetGrid.panelBlock(6, panels);
const base = {
  panels, grid: { across: 2, down: 3, count: 6 }, sheet: '2336x3504',
  cell: '1168x1168', quality: 'medium', gptStyle: 'dreamy',
  fullPrompt: `THE HEAD\n\n${block}\n\nTHE TAIL`, prompt: panels.join(' / '),
};
const ts = (ms) => ({ toMillis: () => ms });

// --- the decision ---
ok('killed mid-generation → redraw, with a rebuilt cfg', () => {
  const p = plOrphans.orphanPlan({ ...base, status: 'running' });
  assert.strictEqual(p.action, 'redraw');
  assert.strictEqual(p.cfg.plan.sheet, '2336x3504');
  assert.strictEqual(p.cfg.plan.count, 6);
  assert.strictEqual(p.cfg.head, 'THE HEAD');
  assert.strictEqual(p.cfg.tail, 'THE TAIL');
  assert.strictEqual(p.cfg.styleId, 'dreamy');
});

ok('banked sheet, no cut → recut (free), never a redraw', () => {
  const p = plOrphans.orphanPlan({ ...base, sheetUrl: 'https://x/s.webp', images: [] });
  assert.strictEqual(p.action, 'recut');
});

ok('redraw cap reached → fail honestly', () => {
  const p = plOrphans.orphanPlan({ ...base, redraws: plOrphans.REDRAW_CAP });
  assert.strictEqual(p.action, 'fail');
});

ok('one redraw spent, cap is 2 → still redraws', () => {
  assert.strictEqual(plOrphans.REDRAW_CAP >= 2, true,
    'deploys land in bursts (three merges in a row, 2026-08-27) — one retry is not enough');
  const p = plOrphans.orphanPlan({ ...base, redraws: 1 });
  assert.strictEqual(p.action, 'redraw');
});

ok('a single (non-panels) run → fail, as before', () => {
  const p = plOrphans.orphanPlan({ status: 'running', fullPrompt: 'x', quality: 'low' });
  assert.strictEqual(p.action, 'fail');
});

ok('a panels doc too broken to rebuild → fail, never a blind redraw', () => {
  const p = plOrphans.orphanPlan({ ...base, sheet: 'not-a-size' });
  assert.strictEqual(p.action, 'fail');
});

// --- the clock ---
ok('redrawnAt restarts the staleness clock', () => {
  const created = 1000, redrawn = 900000;
  assert.strictEqual(plOrphans.orphanAgeAt({ createdAt: ts(created) }), created);
  assert.strictEqual(
    plOrphans.orphanAgeAt({ createdAt: ts(created), redrawnAt: ts(redrawn) }), redrawn);
});

// --- the wiring: server.js must ask the module, not keep its own copy ---
const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
ok('server.js asks orphanPlan / orphanAgeAt', () => {
  assert.ok(src.includes('plOrphans.orphanPlan('), 'sweep must call plOrphans.orphanPlan');
  assert.ok(src.includes('plOrphans.orphanAgeAt('), 'sweep must use the restarting clock');
});
ok('server.js keeps no second panelsCfgOf', () => {
  assert.ok(!/function panelsCfgOf\(/.test(src),
    'panelsCfgOf lives in pl-orphans.js — a second copy drifts');
});
ok('a redraw restamps redrawnAt beside redraws', () => {
  assert.ok(/redraws: n, redrawnAt/.test(src),
    'without redrawnAt the next tick kills the draw this one started');
});

console.log(`\ntest-pl-orphans: ${n} ok`);
