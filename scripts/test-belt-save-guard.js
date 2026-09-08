#!/usr/bin/env node
/* NO PAGE MAY CUT HER WORDS ON THE WAY OUT (2026-09-08).
 *
 * The read-back saver was written on 2026-09-08 for the soap belt, after a
 * 2,343-character scene lost its tail to a silent `slice(0,1900)` ("a stupid
 * error that's gonna lose my edits"). It reached the two builders that chat
 * was running and NOT the other three copies, so the next morning three belt
 * pages she types her scenes into were still truncating every save — and
 * nothing anywhere would have said so. Sophie, the same day: "are chats
 * importing wrong versions · check every version".
 *
 * So the rule is a test rather than a memory. Every page builder that saves
 * into a verdict sheet is swept, and one that cuts the text it sends fails
 * here. Pure — no network, no browser.
 *
 *   node scripts/test-belt-save-guard.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOTS = ['docs', 'scripts', 'public'];
const SKIP = /node_modules|\.git|\/verdict-before-split/;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + m); if (!c) fails++; };

function walk(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (SKIP.test(p)) continue;
    if (e.isDirectory()) walk(p, out);
    else if (/\.(py|js|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = ROOTS.reduce((a, r) => walk(r, a), []);

// PAGES ALREADY SUPERSEDED, KEPT AS THE RECORD OF WHAT WAS POSTED. They are
// history and are never posted again; naming each one here is the only way to
// say so out loud.
const HISTORY = {
  'docs/severance-belt/her-scenes-the-belt-v3.html':
    'the v3 page, superseded — its live descendant was repaired by scripts/fix-belt-truncation.js',
};
// the repair tool holds the truncation as the PATTERN it hunts for
const TOOLS = ['scripts/fix-belt-truncation.js', 'scripts/test-belt-save-guard.js'];

// a box she writes in, saved into a verdict sheet on a debounce — the belt's
// shape, and the shape the read-back was written for
const savers = files.filter((f) => {
  if (TOOLS.includes(f)) return false;
  const s = fs.readFileSync(f, 'utf8');
  if (!s.includes('/api/chatfeed/verdict')) return false;
  if (!/timer\s*=\s*setTimeout/.test(s)) return false;        // a one-shot save is not this
  return /<textarea[^>]*class="p"/.test(s) || /class="p" data-key/.test(s);
});
ok(savers.length > 0, 'found ' + savers.length + ' scene boxes that save into a verdict sheet');

for (const f of savers) {
  const s = fs.readFileSync(f, 'utf8');
  const why = HISTORY[f.split(path.sep).join('/')];
  // THE ONE FORBIDDEN SHAPE: a verdict save that quietly sends less than the
  // box holds. `slice(0,LIMIT)` on the pagehide BEACON is fine — a beacon
  // cannot be told whether it landed, so it sends what the route will keep and
  // the next open reads back what really saved.
  const cuts = (s.split('\n').filter((l) => /sheet:\s*SHEET|sheet:CHAT|sheet:\s*'/.test(l)
    && /text:/.test(l) && /\.slice\(0,\s*\d/.test(l)));
  if (why) { ok(true, f + ': history — ' + why); continue; }
  ok(cuts.length === 0, f + ': nothing cuts her words on the way out'
    + (cuts.length ? ' — ' + cuts.length + ' line(s)' : ''));
  ok(s.includes('NOT SAVED WHOLE'), f + ': every save is read back off the sheet');
  ok(/LIMIT\s*=\s*\d+/.test(s), f + ': the box knows the limit it must refuse over');
}

// the repair tool itself carries the same saver, or a page it patches would
// come out worse than the builder's own
const fix = fs.readFileSync('scripts/fix-belt-truncation.js', 'utf8');
ok(fix.includes('NOT SAVED WHOLE') && fix.includes('LIMIT=8000'),
  'the live-page repair posts the read-back saver');

console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
process.exit(fails ? 1 : 0);
