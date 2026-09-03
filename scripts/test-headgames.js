#!/usr/bin/env node
// test-headgames.js — the Head Games rules, pure, no network.
// Pins what each shape SHOWS once the bits are in it:
//   • the scale: running totals, the tilt (bounded), the first move and the
//     block that DECIDED it — the earliest step from which the beam never
//     came back — plus a bad index and a double tap placing nothing
//   • the jars: days shut, the shelf's count and longest, the shelf order
//     (shut first, longest-shut leading)
//   • the train: the route reads station-first, the line before/after the
//     station
//   • the tower: load-bearing / stands-without / untested, never assumed
//   • the tags: grouped by who, case- and space-insensitive, most first
// And the page build: the rules are inlined, the chat is baked, nothing the
// page kit warns about is in it (an .eyebrow above the title, a .sub line).
//
//   node scripts/test-headgames.js

const path = require('path');
const R = require(path.join(__dirname, '..', 'docs', 'headgames', 'rules.js'));
const { build } = require(path.join(__dirname, 'headgames-page.js'));

let pass = 0; const fails = [];
function is(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fails.push(name + '\n    want ' + JSON.stringify(want) + '\n    got  ' + JSON.stringify(got));
}
const ok = (name, c) => is(name, Boolean(c), true);

/* ── the scale ─────────────────────────────────────────────────────────── */
const pros = [{ text: 'closer to mom', w: 3 }, { text: 'cheaper', w: 2 }];
const cons = [{ text: 'no friends there', w: 4 }, { text: 'rain', w: 1 }];
let rep = R.weigh(pros, cons, []);
is('nothing placed: level, no steps', [rep.left, rep.right, rep.tilt, rep.leans, rep.firstTipAt, rep.decidedAt, rep.done], [0, 0, 0, 'level', -1, -1, false]);

rep = R.weigh(pros, cons, [{ side: 'pro', i: 0 }]);
is('one pro: 3 for, tips for', [rep.left, rep.right, rep.leans, rep.firstTipAt, rep.decidedAt], [3, 0, 'pro', 0, 0]);
is('tilt is negative toward FOR and 2.5°/block', rep.tilt, -7.5);

// for 3, then against 4 (now against by 1), then for 2 (for by 1): the
// deciding step is the LAST swing — the cheaper one — not the first move
rep = R.weigh(pros, cons, [{ side: 'pro', i: 0 }, { side: 'con', i: 0 }, { side: 'pro', i: 1 }]);
is('totals after three', [rep.left, rep.right], [5, 4]);
is('first moved on the first block, decided on the third', [rep.firstTipAt, rep.decidedAt, rep.leans], [0, 2, 'pro']);
ok('the line names the deciding block', /Tipped for on: cheaper\./.test(R.scaleLine(rep)));
ok('…and the first mover when it differs', /First moved on: closer to mom\./.test(R.scaleLine(rep)));

// against 4, then for 3 (still against), then for 2 (for by 1), then against 1 (level)
rep = R.weigh(pros, cons, [{ side: 'con', i: 0 }, { side: 'pro', i: 0 }, { side: 'pro', i: 1 }, { side: 'con', i: 1 }]);
is('all four placed ends level', [rep.left, rep.right, rep.leans, rep.decidedAt, rep.done], [5, 5, 'level', -1, true]);
ok('a level line says level and both counts', /^Level\. 5 for, 5 against\.$/.test(R.scaleLine(rep)));

rep = R.weigh(pros, cons, [{ side: 'pro', i: 7 }, { side: 'con', i: 0 }, { side: 'con', i: 0 }]);
is('a bad index and a double tap place nothing', [rep.placedCount, rep.right], [1, 4]);

rep = R.weigh([{ text: 'a', w: 5 }, { text: 'b', w: 5 }, { text: 'c', w: 5 }], [], [{ side: 'pro', i: 0 }, { side: 'pro', i: 1 }, { side: 'pro', i: 2 }]);
is('the tilt is bounded', rep.tilt, -R.TILT_MAX);
is('a weight is clamped to 1..5 and rounded', [R.blocks(0), R.blocks(9), R.blocks(2.6), R.blocks('x')], [1, 5, 3, 1]);

// the deciding block never moves once the sign has settled: two more blocks
// on the winning side leave decidedAt where it was
rep = R.weigh(pros, cons, [{ side: 'con', i: 0 }, { side: 'con', i: 1 }, { side: 'pro', i: 1 }]);
is('decided on the first block when the sign never changed', [rep.decidedAt, rep.leans], [0, 'con']);

/* ── the jars ──────────────────────────────────────────────────────────── */
const DAY = 86400000;
const t0 = 1_800_000_000_000;
const jars = [
  { id: 'a', q: 'why do cats purr', shutAt: t0 - 3 * DAY, openedAt: null },
  { id: 'b', q: 'how far is the moon', shutAt: t0 - 10 * DAY, openedAt: null },
  { id: 'c', q: 'what is a quark', shutAt: t0 - 20 * DAY, openedAt: t0 - 2 * DAY, answer: 'small' },
  { id: 'd', q: 'who was first', shutAt: t0 - 1 * DAY, openedAt: t0 },
];
is('days shut counts whole days to now', R.jarDays(jars[0], t0), 3);
is('an opened jar counts the days it WAS shut', R.jarDays(jars[2], t0), 18);
is('the shelf: two shut, the longest is b at 10 days', [R.jarShelf(jars, t0).shut, R.jarShelf(jars, t0).longest.id, R.jarShelf(jars, t0).longestDays], [2, 'b', 10]);
is('order: shut first (longest leading), then opened newest first', R.jarOrder(jars).map((j) => j.id), ['b', 'a', 'd', 'c']);

/* ── the train ─────────────────────────────────────────────────────────── */
const train = { cars: ['the electric bill', 'the ferry', 'that island', 'her postcard'], stationAt: null };
let r = R.trainRoute(train);
is('the route reads station-first', r.route, ['her postcard', 'that island', 'the ferry', 'the electric bill']);
is('end and start', [r.end, r.start, r.cars, r.atStation], ['the electric bill', 'her postcard', 4, false]);
is('the line while walking', R.trainLine(train), '4 cars so far.');
is('the line at the station', R.trainLine({ cars: train.cars, stationAt: t0 }), '4 cars from "her postcard" to "the electric bill".');
is('blank cars are dropped', R.trainRoute({ cars: ['a', '  ', 'b'] }).cars, 2);
is('one car', R.trainLine({ cars: ['x'] }), '1 car so far.');

/* ── the tower ─────────────────────────────────────────────────────────── */
const blocks = [
  { text: 'she said so', pulled: true, stood: false },
  { text: 'it fits', pulled: false, stood: true },
  { text: 'everyone knows', pulled: false, stood: null },
];
let tw = R.towerReport(blocks);
is('load-bearing / stands / untested', [tw.loadBearing.map((b) => b.text), tw.standsWithout.length, tw.untested.length, tw.total], [['she said so'], 1, 1, 3]);
is('the line', R.towerLine(blocks), 'Load-bearing: she said so. Stands without 1 block. 1 not pulled yet.');
is('every block tested, none load-bearing', R.towerLine([{ text: 'a', stood: true }, { text: 'b', stood: true }]), 'Stands without 2 blocks. No single block holds it up.');
is('an empty tower says nothing', R.towerLine([]), '');

/* ── luggage tags ──────────────────────────────────────────────────────── */
const tags = [
  { id: 1, opinion: 'oat milk is fine', from: 'Mom' },
  { id: 2, opinion: 'never buy a boat', from: 'dad' },
  { id: 3, opinion: 'cities are loud', from: 'mom ' },
  { id: 4, opinion: 'cats are better', from: '' },
  { id: 5, opinion: 'sleep more', from: 'Dad' },
  { id: 6, opinion: 'salt everything', from: 'MOM' },
];
const g = R.tagGroups(tags);
is('grouped by who, case- and space-insensitive, most first', g.map((x) => [x.name, x.count]), [['Mom', 3], ['dad', 2], ['no name', 1]]);
is('the first spelling is kept for display', g[0].name, 'Mom');
is('the line', R.tagLine(tags), '6 tags, 2 names. 3 carry Mom.');
is('ties go alphabetical, a real name before no name', R.tagGroups([{ from: '' }, { from: 'zed' }, { from: 'amy' }]).map((x) => x.name), ['amy', 'zed', 'no name']);

/* ── the built page ────────────────────────────────────────────────────── */
const html = build();
ok('the rules are inlined', html.includes('window.__headgamesRules') && !html.includes('__RULES__'));
ok('the chat is baked in', html.includes("var CHAT = 'mental-games-instrumental-beliefs'") && !html.includes('__CHAT__'));
ok('links the compare kit', /href="\/compare\.css"/.test(html) && /src="\/compare\.js"/.test(html));
ok('no .eyebrow above the title and no .sub line (the page-kit warnings)', !/class\s*=\s*["'][^"']*\b(eyebrow|sub)\b/i.test(html));
ok('no <video>', !/<video[\s>]/i.test(html));
ok('the page is tappable UI: the wrap carries data-nostop', /<div class="wrap" data-nostop>/.test(html));
ok('text boxes ship empty: no placeholder anywhere', !/placeholder=/i.test(html));
ok('no <textarea> ships with words in it', !/<textarea[^>]*>[^<]+<\/textarea>/.test(html));
ok('the script is one IIFE (no page-level let/const at top level)', !/\n(let|const) /.test(html.split('<script>').pop()));
ok('one h1', (html.match(/<h1[\s>]/g) || []).length === 1);

console.log(`headgames: ${pass} ok, ${fails.length} failed`);
for (const f of fails) console.log('FAIL ' + f);
process.exit(fails.length ? 1 : 0);
