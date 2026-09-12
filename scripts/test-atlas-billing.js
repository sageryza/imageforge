#!/usr/bin/env node
'use strict';
// scripts/test-atlas-billing.js — the Atlas Cloud BILLING reader (2026-09-12,
// Sophie: "I checked, and Atlas Cloud does have a proper Billing Public API")
// and the draw-time reader she asked for in the same breath ("also make it
// say the average time it has taken for things to draw at that exact size and
// length, etc.").
//
// EVERY ASSERTION IS A MEASUREMENT of what the reader really sends or really
// answers. A reader pointed at the GENERATION prefix, one that pages once and
// calls it the whole answer, and one that reports a median off a single clip
// of a different shape all look identical in the source.
//
// No network: `node-fetch` is replaced in the require cache by a recorder.

const path = require('path');
const Module = require('module');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); }
}
function eq(name, got, want) { ok(name, got === want, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }

// ── the fetch recorder ────────────────────────────────────────────────────
const calls = [];
let answers = [];
function fakeFetch(url, opts) {
  calls.push({ url: String(url), opts: opts || {} });
  const next = answers.shift();
  const body = next && next.body !== undefined ? next.body : {};
  return Promise.resolve({
    ok: next ? next.ok !== false : true,
    status: next && next.status ? next.status : 200,
    headers: { get: (k) => (next && next.headers ? next.headers[String(k).toLowerCase()] : null) },
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
}
const fetchPath = require.resolve('node-fetch');
require.cache[fetchPath] = new Module(fetchPath, null);
require.cache[fetchPath].filename = fetchPath;
require.cache[fetchPath].loaded = true;
require.cache[fetchPath].exports = fakeFetch;

process.env.ATLASCLOUD_API_KEY = process.env.ATLASCLOUD_API_KEY || 'apikey-test';
const atlas = require(path.join('..', 'atlascloud.js').replace('..', __dirname + '/..'));

(async () => {
  console.log('\nATLAS BILLING — the prefix, the range, the walk');

  // 1. THE PREFIX. Billing is /public/v1; generation is /api/v1. Pointing one
  //    at the other 404s every read, and the bug is invisible in the source.
  ok('billing base is the PUBLIC prefix, not the generation one',
    /\/public\/v1$/.test(atlas.BILL_BASE) && !/\/api\/v1/.test(atlas.BILL_BASE), atlas.BILL_BASE);

  // 2. /balance — money is a fixed six-decimal STRING in Atlas's answer, and
  //    nothing here may round her balance on the way past.
  calls.length = 0;
  answers = [{ body: { value: '125.500000', currency: 'usd' } }];
  const bal = await atlas.balance(true);
  eq('balance hits /public/v1/balance', calls[0].url, atlas.BILL_BASE + '/balance');
  eq('balance is a number', bal.left, 125.5);
  eq('the raw string is kept', bal.raw, '125.500000');
  ok('the bearer key rides', String((calls[0].opts.headers || {}).Authorization || (calls[0].opts.headers || {}).authorization || '').includes('apikey-'));

  // 3. THE RANGE IS CHECKED HERE, not at Atlas — free, and it names the rule.
  //    `end_date` is EXCLUSIVE, so "today" is start=today end=tomorrow.
  const today = atlas.rangePlan({});
  eq('no argument is ONE day', today.days, 1);
  ok('end is the day AFTER start (their end_date is exclusive)',
    Date.parse(today.end) - Date.parse(today.start) === 86400000, JSON.stringify(today));
  ok('over 180 days is refused locally', Boolean(atlas.rangePlan({ days: 400 }).error));
  ok('a backwards range is refused', Boolean(atlas.rangePlan({ start: '2026-09-10', end: '2026-09-01' }).error));
  ok('a malformed date is refused', Boolean(atlas.rangePlan({ start: 'yesterday', end: '2026-09-12' }).error));
  eq('days=7 walks back a week', atlas.rangePlan({ days: 7 }).days, 7);

  // 4. THE WALK PAGES. One read that stops at has_more is a short answer
  //    pretending to be the whole thing — the exact shape that would under-
  //    report what she has spent.
  calls.length = 0;
  answers = [
    { body: { data: [{ date: '2026-09-12', model: 'bytedance/seedance-2.0-mini', cost: '1.500000' }], has_more: true, next_page: 'p2' } },
    { body: { data: [{ date: '2026-09-12', model: 'bytedance/seedance-2.5', cost: '4.000000' }], has_more: false } },
  ];
  const sp = await atlas.spend({ fresh: true });
  eq('both pages were read', calls.length, 2);
  ok('the cursor from page one is sent back', calls[1].url.includes('page=p2'), calls[1].url);
  eq('the total is every page', sp.total, 5.5);
  eq('it buckets by model', sp.byModel.length, 2);
  eq('the dearest model leads', sp.byModel[0].model, 'bytedance/seedance-2.5');
  eq('it buckets by day', sp.byDay.length, 1);
  ok('start_date and end_date are sent', calls[0].url.includes('start_date=') && calls[0].url.includes('end_date='), calls[0].url);

  // 5. A MONEY STRING OR A NUMBER, and a key named something else must not
  //    silently total to zero.
  eq('a money string reads', atlas.costOf({ cost: '2.250000' }), 2.25);
  eq('a number reads', atlas.costOf({ cost: 2.25 }), 2.25);
  eq('total_cost reads', atlas.costOf({ total_cost: '3.000000' }), 3);
  eq('a row with no cost at all is null, never 0', atlas.costOf({ model: 'x' }), null);

  // 6. A 429 hands its Retry-After on rather than being retried here.
  calls.length = 0;
  answers = [{ ok: false, status: 429, headers: { 'retry-after': '30' }, body: { error: { message: 'slow down' } } }];
  let threw = null;
  try { await atlas.balance(true); } catch (e) { threw = e; }
  ok('a 429 throws', Boolean(threw));
  eq('its status rides', threw && threw.status, 429);
  eq('Retry-After rides', threw && threw.retryAfter, 30);

  // ── the draw-time reader ────────────────────────────────────────────────
  console.log('\nHOW LONG THIS SHAPE USUALLY TAKES');
  const f = require(__dirname + '/../footage.js');

  // THE MEDIAN, NOT THE MEAN — one clip that sat in a queue drags a mean
  // minutes off what the next tap will really do. This is the one deviation
  // from her word and it is what "usually" means.
  const b = new Map([['atlascloud|mini|480p|16:9|4', [60000, 70000, 80000, 900000]]]);
  const one = f.drawTimeFrom(b, { door: 'atlascloud', model: 'mini', res: '480p', ratio: '16:9', seconds: 4 });
  eq('the median ignores the stalled clip', one.ms, 75000);
  ok('the mean rides along, so nothing is hidden', one.mean > one.ms, JSON.stringify(one));
  eq('it says the shape was exact', one.basis, 'exact');
  eq('and how many clips it is off', one.n, 4);

  // THE LADDER LOOSENS ONE FACT AT A TIME AND SAYS WHICH RUNG ANSWERED — a
  // figure borrowed from a looser match, presented as this shape's time, is
  // the card lying.
  const b2 = new Map([
    ['atlascloud|mini|480p||4', [50000, 51000, 52000]],
    ['|mini|||4', [10000]],
  ]);
  eq('a different ratio falls to the ratio rung', f.drawTimeFrom(b2, { door: 'atlascloud', model: 'mini', res: '480p', ratio: '9:16', seconds: 4 }).basis, 'ratio');
  eq('a different door falls further', f.drawTimeFrom(b2, { door: 'openrouter', model: 'mini', res: '720p', ratio: '1:1', seconds: 4 }).basis, 'size');
  ok('a shape the log has never drawn answers NOTHING',
    f.drawTimeFrom(b2, { door: 'atlascloud', model: '2.5', res: '480p', ratio: '16:9', seconds: 15 }) === null);
  ok('no buckets at all answers nothing', f.drawTimeFrom(null, { model: 'mini', seconds: 4 }) === null);

  // A RUNG WITH TOO LITTLE ON IT IS SKIPPED FOR A FULLER ONE, and used only
  // when nothing better exists — one clip is not a "usually".
  const b3 = new Map([
    ['atlascloud|mini|480p|16:9|4', [900000]],
    ['atlascloud|mini|480p||4', [60000, 61000, 62000]],
  ]);
  eq('one clip on the exact rung yields to three on the next', f.drawTimeFrom(b3, { door: 'atlascloud', model: 'mini', res: '480p', ratio: '16:9', seconds: 4 }).basis, 'ratio');
  const b4 = new Map([['atlascloud|mini|480p|16:9|4', [900000]]]);
  eq('but one clip is still answered when it is all there is', f.drawTimeFrom(b4, { door: 'atlascloud', model: 'mini', res: '480p', ratio: '16:9', seconds: 4 }).n, 1);

  // THE MEDIAN ITSELF
  eq('median of an odd list', f.medianOf([3, 1, 2]), 2);
  eq('median of an even list', f.medianOf([1, 2, 3, 4]), 3);
  ok('median of nothing is null', f.medianOf([]) === null);

  // THE KEY READS THE LOG'S OWN FIELDS — a doc whose shape cannot be read
  // must be skipped, never bucketed under a guessed size.
  ok('a doc with no model is skipped', f.drawKeyOf({ params: { duration: 4, resolution: '480p' } }) === null);
  ok('a doc with no seconds is skipped', f.drawKeyOf({ model: 'bytedance/seedance-2.0-mini', params: { resolution: '480p' } }) === null);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
