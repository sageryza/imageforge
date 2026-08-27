#!/usr/bin/env node
/* ONE PILL PER CORNER — the native AutoScrollPill must never draw on a screen
   whose PAGE already carries one (2026-08-27, Sophie's screenshot of the
   Characters page: "two pills").

   `RootView.showAutoScroll` used to answer that with a hand-kept blacklist of
   tools, and forgetting one is SILENT: the two capsules stack in the same
   fixed corner, offset by the native pill's own padding, and the speed label
   reads "Fast" twice. It was already missed once (Voice Studio, Aug 2026, and
   its own comment says so) — and when this test was written FIVE more were
   still wrong: Dreams, Shop Report, Characters, Song Station and Films.

   So the answer is DERIVED in the app from `Tool.webPath` + `forgePillPages`,
   and this test is what keeps that mirror honest. THE TRUTH IS server.js, NOT
   WRITTEN HERE — registering a page with { pill: true } puts it in this test
   the same day. It fails in BOTH directions, because both are real bugs:
     • a page missing from the Swift set  → two pills
     • a page listed that has no pill     → no pill at all, no way back to top

   Run: node scripts/test-native-pill.js */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const root = fs.readFileSync(path.join(ROOT, 'ios/ImageForge/RootView.swift'), 'utf8');

let fails = 0, checks = 0;
function ok(cond, what) {
  checks++;
  if (!cond) { fails++; console.log('  ✗ ' + what); } else { console.log('  ✓ ' + what); }
}

// ── what server.js actually serves ─────────────────────────────────────────
// Each `app.get('/path', …)` plus the statement after it, up to the next
// route: serveGated on the same line, or a multi-line handler (/blog, and the
// plain sendFile pages like /gallery and /lessons, which carry no pill unless
// the FILE bakes one).
const lines = server.split('\n');
const routes = new Map();                       // '/path' -> { file, pill }
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^app\.get\('([^']+)'/);
  if (!m) continue;
  let chunk = '';
  for (let j = i; j < lines.length && j < i + 8; j++) {
    if (j > i && /^app\.(get|post|use)\(/.test(lines[j])) break;
    chunk += lines[j].replace(/^\s*\/\/.*$/, '') + '\n';
  }
  const g = chunk.match(/serveGated\('([^']+\.html)'([^)]*)\)/);
  if (g) { routes.set(m[1], { file: g[1], pill: /pill:\s*true/.test(g[2]) }); continue; }
  const sf = chunk.match(/public\/([\w.-]+\.html)/);
  if (sf) routes.set(m[1], { file: sf[1], pill: false });
}

// ── the pages that BAKE their own copy of scripts/pill.py ─────────────────
// (chats.html, writing.html, wall.html, gallery.html, storyroom.html). The
// injected copy lives in pill-inject.html and is not a page.
const baked = new Set(fs.readdirSync(PUB)
  .filter((f) => f.endsWith('.html') && f !== 'pill-inject.html')
  .filter((f) => fs.readFileSync(path.join(PUB, f), 'utf8').includes('class="float"')));

const derived = new Set();
for (const [p, r] of routes) if (r.pill || baked.has(r.file)) derived.add(p);

// ── the Swift mirror ──────────────────────────────────────────────────────
const setBlock = root.match(/let forgePillPages: Set<String> = \[([\s\S]*?)\n\]/);
if (!setBlock) { console.log('  ✗ forgePillPages not found in RootView.swift'); process.exit(1); }
const swiftSet = new Set([...setBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));

console.log('native pill · the mirror');
const missing = [...derived].filter((p) => !swiftSet.has(p)).sort();
const extra = [...swiftSet].filter((p) => !derived.has(p)).sort();
ok(!missing.length, 'every pill-carrying page is in forgePillPages'
  + (missing.length ? ' — MISSING (two pills would draw): ' + missing.join(', ') : ''));
ok(!extra.length, 'nothing in forgePillPages is pill-less'
  + (extra.length ? ' — EXTRA (no pill at all would draw): ' + extra.join(', ') : ''));

// ── every Tool.webPath is a page the server really serves ────────────────
console.log('native pill · Tool.webPath');
const wp = root.match(/var webPath: String\? \{([\s\S]*?)\n    \}/);
if (!wp) { console.log('  ✗ Tool.webPath not found'); process.exit(1); }
const paths = [...wp[1].matchAll(/return "([^"]+)"/g)].map((m) => m[1]);
ok(paths.length > 0, 'webPath returns ' + paths.length + ' page paths');
const unserved = paths.filter((p) => !routes.has(p));
ok(!unserved.length, 'every webPath is a route server.js serves'
  + (unserved.length ? ' — UNKNOWN: ' + unserved.join(', ') : ''));

// ── the blacklist must not grow back ──────────────────────────────────────
// A `if t == .x { return false }` for a tool whose page carries a pill is the
// old shape creeping back in beside the derived rule — harmless today, and
// the reason the next page gets forgotten.
console.log('native pill · no per-tool blacklist');
const sas = root.match(/private var showAutoScroll: Bool \{([\s\S]*?)\n    \}/);
ok(!!sas, 'showAutoScroll found');
if (sas) {
  const hard = [...sas[1].matchAll(/t == \.(\w+)/g)].map((m) => m[1]);
  const allowed = new Set(['filmeditor', 'movie']);   // no pill anywhere / depends on where it is
  const strays = hard.filter((t) => !allowed.has(t));
  ok(!strays.length, 'no per-tool opt-outs beyond the two that are not about a page'
    + (strays.length ? ' — found: ' + strays.join(', ') : ''));
  ok(/forgePillPages\.contains/.test(sas[1]), 'the answer is derived from forgePillPages');
}

console.log(`\n${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
