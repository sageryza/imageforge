#!/usr/bin/env node
// The night rules, pure — no network, no Firestore, no browser.
//
// Sophie, Aug 2026: "generally people only have one dream per night, or the
// ones they had are basically one dream — they shouldn't be separate entries.
// They should be the same entry, so it only shows pictures for one and you can
// see the rest. People can decide to feature a photo if they don't like the one
// that's chronologically first, but that's the default."
//
// So this pins the four things that sentence asks for: a night groups by person
// AND day, its dreams read oldest-first, the default cover is the first picture
// of the night, and a featured one wins — unless it has since been unshared, in
// which case the entry falls back rather than showing a hole.
//
//   node scripts/test-dreamapp-nights.js
//
// dreamapp.js pulls in movies.js (and its deps) at require time, so the module
// is loaded with a stub in front of that — the rules under test touch none of it.
const Module = require('module');
const path = require('path');

const realResolve = Module._resolveFilename;
const STUB = path.join(__dirname, '..', 'movies.js');
Module._resolveFilename = function (req, ...rest) {
  if (req === './movies' || req === 'firebase-admin' || req === 'express') return req;
  return realResolve.call(this, req, ...rest);
};
require.cache.movies = { id: 'movies', filename: 'movies', loaded: true, exports: { makeDreamPagesV2: () => {} } };
require.cache['./movies'] = require.cache.movies;
require.cache['firebase-admin'] = { id: 'firebase-admin', filename: 'firebase-admin', loaded: true, exports: { apps: [], firestore: () => null } };
require.cache.express = {
  id: 'express', filename: 'express', loaded: true,
  exports: Object.assign(() => ({}), {
    Router: () => new Proxy({}, { get: () => () => {} }),
    json: () => () => {},
  }),
};

const { nightsFrom, nightPanels, coverOf, spineOf } = require('../dreamapp.js');
Module._resolveFilename = realResolve;

const fails = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) fails.push(name);
};

const at = (n) => new Date(1786000000000 + n * 60000).toISOString();
const panel = (i, pub = true) => ({ i, url: `u${i}`, captions: [], public: pub });

// Sage dreamt twice on the 8th; Evan once. Deliberately handed over in the
// wrong order, because the feed's own sort must not be what fixes it.
const DOCS = [
  { id: 'b', uid: 'sage', publicOn: '2026-08-08', createdAt: at(5), title: 'Second', panels: [panel(0)] },
  { id: 'e', uid: 'evan', publicOn: '2026-08-08', createdAt: at(9), title: 'Evan', panels: [] },
  { id: 'a', uid: 'sage', publicOn: '2026-08-08', createdAt: at(1), title: 'First', panels: [panel(0), panel(1)] },
  { id: 'old', uid: 'sage', publicOn: '2026-08-07', createdAt: at(-900), title: 'Before', panels: [] },
];

const nights = nightsFrom(DOCS);
check('one night per person per day', nights.length === 3, `${nights.length} nights`);

const sage = nights.find((g) => g[0].uid === 'sage' && g[0].publicOn === '2026-08-08');
check('a person\'s two dreams from one night are ONE entry', sage.length === 2);
check('and they read oldest first', sage.map((d) => d.id).join(',') === 'a,b', sage.map((d) => d.id).join(','));
check('the spine is the chronologically first', spineOf(sage).id === 'a', spineOf(sage).id);
check('a different DAY is a different night',
  nights.some((g) => g[0].publicOn === '2026-08-07' && g.length === 1));
check('a different PERSON is a different night',
  nights.some((g) => g[0].uid === 'evan' && g.length === 1));

// Newest night first, judged by its latest dream — Evan's 9-minute mark beats
// Sage's 5, even though Sage started the night earlier.
check('nights sort newest first by their latest dream',
  nights[0][0].uid === 'evan', nights.map((g) => g[0].uid).join(','));

const panels = nightPanels(sage);
check('the night\'s pictures gather across its dreams', panels.length === 3, `${panels.length}`);
check('each picture knows which dream it came from',
  panels.map((p) => p.dreamId).join(',') === 'a,a,b', panels.map((p) => p.dreamId).join(','));
check('and they are in the night\'s own order',
  panels.map((p) => p.url).join(',') === 'u0,u1,u0');

check('the default cover is the first picture of the night',
  coverOf(sage, panels).dreamId === 'a' && coverOf(sage, panels).i === 0);

// Featured wins.
const featured = [{ ...sage[0], coverPanel: { dreamId: 'b', i: 0 } }, sage[1]];
check('a featured picture wins over the first',
  coverOf(featured, nightPanels(featured)).dreamId === 'b');

// …unless it has since been made private, which would otherwise be a hole.
const gone = [{ ...sage[0], coverPanel: { dreamId: 'b', i: 7 } }, sage[1]];
check('a featured picture that is no longer shared falls back',
  coverOf(gone, nightPanels(gone)).dreamId === 'a');

// A night whose pictures are all private has no cover at all — not a broken one.
const dark = [{ ...sage[0], panels: [panel(0, false)] }];
check('a night with nothing shared has no cover', coverOf(dark, nightPanels(dark)) === null);

// THE NIGHT IS WHEN IT WAS WRITTEN, not when it was published — otherwise two
// dreams from one night shared on different days read as two separate entries,
// and "share the whole night" has nothing to refer to before publication.
const split = nightsFrom([
  { id: 'x', uid: 'sage', night: '2026-08-08', publicOn: '2026-08-08', createdAt: at(1), panels: [] },
  { id: 'y', uid: 'sage', night: '2026-08-08', publicOn: '2026-08-09', createdAt: at(3), panels: [] },
]);
check('two dreams from one night stay one entry even if shared on different days',
  split.length === 1 && split[0].length === 2, `${split.length} nights`);

// A dream written before the field existed carries no `night` — it must group
// exactly as it did, off its publication day, never vanish into its own entry.
const old = nightsFrom([
  { id: 'o1', uid: 'sage', publicOn: '2026-08-01', createdAt: at(-2000), panels: [] },
  { id: 'o2', uid: 'sage', publicOn: '2026-08-01', createdAt: at(-1990), panels: [] },
]);
check('dreams with no night field still group by the day they were shared',
  old.length === 1 && old[0].length === 2, `${old.length} nights`);

console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
process.exit(fails.length ? 1 : 0);
