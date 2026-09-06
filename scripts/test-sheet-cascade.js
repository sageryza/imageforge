#!/usr/bin/env node
// ✕ ON A SHEET IS ✕ ON ITS PANELS (2026-09-06, Sophie: "when i x a uncut
// panels sheet it shud x every panel in it unless i hearted it or heart it
// after or unex").
//
// The rule itself, pure — no Firestore, no browser — plus the source pins that
// keep it ONE rule: both vote routes and the Assets-tab door go through
// votePatchFor, the cut applies the same plan to the panels it just made, and
// the Playground links the shared file rather than keeping a copy.
//
//   node scripts/test-sheet-cascade.js
const fs = require('fs');
const path = require('path');
const C = require('../sheet-cascade');

let bad = 0;
const ok = (c, m) => { if (c) console.log('  ok  ' + m); else { console.error('FAIL: ' + m); bad++; } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// A cut panels run: the sheet is banked BESIDE the panels, so `images` is the
// four pieces and `sheetUrl` is the picture she paid for.
const cut = (votes, from) => ({
  id: 'r1', panels: ['a', 'b', 'c', 'd'], sheetUrl: 'S',
  images: ['p0', 'p1', 'p2', 'p3'],
  votes: votes || {}, voteFrom: from || {},
});

console.log('panels of a run');
ok(same(C.panelIndexes(cut()), [0, 1, 2, 3]), 'a cut run: every image is a panel');
ok(same(C.panelIndexes({ panels: ['a'], sheetUrl: 'S', images: ['S'], votes: {} }), []),
  'a cut-FAILED run is its own sheet — no panels, so nothing to cascade to');
ok(same(C.panelIndexes({ sheetUrl: 'S', images: ['x'] }), []), 'not a panels run at all');
ok(same(C.panelIndexes({ panels: ['a'], images: ['x'] }), []), 'no banked sheet');
ok(same(C.panelIndexes({ panels: ['a'], sheetUrl: 'S', images: [] }), []),
  'the cut has not landed yet — no panels on the doc');

console.log('\n✕ the sheet');
let p = C.plan(cut(), 'dislike');
ok(same(p.changed, [0, 1, 2, 3]), 'every panel is crossed out');
ok(p.votes[2] === 'dislike' && p.from[2] === 'sheet', 'and each carries the tag saying who did it');

p = C.plan(cut({ 1: 'like' }), 'dislike');
ok(same(p.changed, [0, 2, 3]), '"unless i hearted it" — a ♥ panel is left alone');
ok(p.votes[1] === undefined && p.from[1] === undefined, 'and nothing is written about it at all');

p = C.plan(cut({ 2: 'dislike' }), 'dislike');
ok(same(p.changed, [0, 1, 3]), 'a panel she ✕d HERSELF is left as it is');
ok(p.from[2] === undefined, 'and is never tagged as the sheet’s — or an un-✕ would undo her mark');

console.log('\nunex');
const after = cut({ '-1': 'dislike', 0: 'dislike', 1: 'dislike', 2: 'dislike', 3: 'dislike' },
  { 0: 'sheet', 1: 'sheet', 3: 'sheet' });     // panel 2 she crossed out herself
p = C.plan(after, null);
ok(same(p.changed, [0, 1, 3]), 'un-✕ lifts the ✕ off the panels the cascade marked');
ok(p.votes[0] === null && p.from[0] === null, 'the mark AND its tag go');
ok(p.votes[2] === undefined, 'her own ✕ survives it');

p = C.plan(after, 'like');
ok(same(p.changed, [0, 1, 3]), 'hearting the sheet ends the ✕ too, so it releases the same panels');

const hearted = cut({ '-1': 'dislike', 0: 'like', 1: 'dislike' }, { 0: 'sheet', 1: 'sheet' });
p = C.plan(hearted, null);
ok(same(p.changed, [1]), '"or heart it after" — a panel she hearted since is not touched by the release');

p = C.plan(cut(), 'like');
ok(same(p.changed, []), 'a ♥ on a sheet that was never ✕d does nothing to the panels');
p = C.plan(cut(), null);
ok(same(p.changed, []), 'and neither does clearing a sheet that carried no ✕');

console.log('\nthe panels that land after the ✕');
p = C.planForCut({ panels: ['a', 'b'], sheetUrl: 'S', images: ['p0', 'p1'], votes: { '-1': 'dislike' } });
ok(same(p.changed, [0, 1]), 'a sheet crossed out while it was still cutting marks its new panels');
p = C.planForCut({ panels: ['a', 'b'], sheetUrl: 'S', images: ['p0', 'p1'], votes: {} });
ok(same(p.changed, []), 'an unmarked sheet marks nothing');

console.log('\none rule, one copy');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, '..', 'public', 'promptlab.html'), 'utf8');
ok(/require\('\.\/sheet-cascade'\)/.test(server), 'server.js requires the shared rule');
ok(/app\.get\('\/sheet-cascade\.js'/.test(server), 'and serves it to the page');
ok(/<script src="\/sheet-cascade\.js"><\/script>/.test(page), 'the Playground links it');
ok(/window\.__sheetCascade/.test(page), 'and calls it rather than deciding for itself');
// The three doors a mark can come through — all of them plan the cascade the
// same way. A fourth that hand-writes `votes.${i}` would be a rule of its own.
const oneVote = server.slice(server.indexOf("app.post('/api/promptlab/:id/vote'"));
ok(/votePatchFor\(run, i, vote\)/.test(oneVote), 'the single vote route plans through votePatchFor');
const batch = server.slice(server.indexOf("app.post('/api/promptlab/votes'"),
  server.indexOf("app.post('/api/promptlab/:id/vote'"));
ok(/votePatchFor\(run, i, vote\)/.test(batch), 'the batch route does too');
ok(/votePatchFor\(run, i, next\)/.test(server.slice(server.indexOf('async function syncVoteToPlayground'),
  server.indexOf('async function syncVoteToPlayground') + 2000)),
  'and so does an Assets-tab ✕ coming back the other way');
ok(/sheetCascade\.planForCut\(fresh\)/.test(server), 'the cut applies it to the panels it just made');

console.log(bad ? '\n' + bad + ' FAILED' : '\nall good');
process.exit(bad ? 1 : 0);
