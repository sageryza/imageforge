#!/usr/bin/env node
// The three-a-day allowances, pure — no network, no Firestore, no browser.
//
// Sophie, 2026-08-19: "let's just let people illustrate three dreams a day,
// and we'll change it later" (with a pop-up past it), and "you can share
// three dreams a day if you want." Both counters read the DOCS, not the
// in-memory rate limiter, because a server restart must not hand anyone a
// fresh allowance. This pins what counts:
//   - a draw counts only on the day it was STARTED, and only if it landed
//     (panels) or is still landing (a live drawJob) — a FAILED draw is free
//     to retry;
//   - a share counts by publicOn, so flipping the audience of a dream already
//     out spends nothing.
//
//   node scripts/test-dreamapp-limits.js
//
// dreamapp.js pulls in movies.js (and its deps) at require time, so the module
// is loaded with a stub in front of that — the rules under test touch none of it.
const Module = require('module');

const realResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req === './movies' || req === 'firebase-admin' || req === 'express') return req;
  return realResolve.call(this, req, ...rest);
};
require.cache['./movies'] = { id: './movies', filename: './movies', loaded: true, exports: { makeDreamImage: () => {}, transcribeAudio: () => {} } };
require.cache['firebase-admin'] = { id: 'firebase-admin', filename: 'firebase-admin', loaded: true, exports: { apps: [], firestore: () => null } };
require.cache.express = {
  id: 'express', filename: 'express', loaded: true,
  exports: Object.assign(() => ({}), {
    Router: () => new Proxy({}, { get: () => () => {} }),
    json: () => () => {},
    raw: () => () => {},
  }),
};

const { drawsToday, sharesToday, streakOf } = require('../dreamapp.js');
Module._resolveFilename = realResolve;

const fails = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) fails.push(name);
};

const TODAY = '2026-08-19';
const panel = { i: 0, url: 'u', public: false };

// ── the ink allowance ──
const docs = [
  // landed today — counts
  { drawnOn: TODAY, panels: [panel], drawJob: null },
  // still drawing right now — counts (or a restart mid-job would refund it)
  { drawnOn: TODAY, panels: [], drawJob: { status: 'drawing' } },
  // FAILED today — free to retry, does not count
  { drawnOn: TODAY, panels: [], drawJob: { status: 'failed', error: 'x' } },
  // drawn yesterday — yesterday's ink
  { drawnOn: '2026-08-18', panels: [panel], drawJob: null },
  // written today, never drawn — writing is never rationed
  { drawnOn: null, panels: [], drawJob: null },
];
check('a landed drawing counts', drawsToday([docs[0]], TODAY) === 1);
check('a drawing still in flight counts', drawsToday([docs[1]], TODAY) === 1);
check('a FAILED drawing does not count — retrying is free', drawsToday([docs[2]], TODAY) === 0);
check("yesterday's ink is not today's", drawsToday([docs[3]], TODAY) === 0);
check('an undrawn dream spends nothing', drawsToday([docs[4]], TODAY) === 0);
check('the day sums to two of the three', drawsToday(docs, TODAY) === 2, String(drawsToday(docs, TODAY)));

// ── the share allowance ──
const shared = [
  { publicOn: TODAY },
  { publicOn: TODAY },
  { publicOn: '2026-08-18' },
  { publicOn: null },
];
check('shares count by publicOn, today only', sharesToday(shared, TODAY) === 2, String(sharesToday(shared, TODAY)));
check('a private dream spends nothing', sharesToday([{ publicOn: null }], TODAY) === 0);

// ── the streak still reads as before ──
check('a streak counts back from today', streakOf(['2026-08-19', '2026-08-18', '2026-08-17'], TODAY) === 3);
check("this morning's unwritten night does not break it",
  streakOf(['2026-08-18', '2026-08-17'], TODAY) === 2);
check('a gap ends it', streakOf(['2026-08-19', '2026-08-17'], TODAY) === 1);
check('nothing recent is no streak', streakOf(['2026-08-10'], TODAY) === 0);

console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
process.exit(fails.length ? 1 : 0);
