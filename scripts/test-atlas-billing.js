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

  // 5b. THE LIVE ANSWER DID NOT USE THE DOCUMENTED KEY (measured 2026-09-12:
  //     the deployed reader answered left:null against a 200). So the money
  //     field is hunted by name, one level into a wrapper, and the whole body
  //     rides back — a null balance must be readable rather than a shrug.
  calls.length = 0;
  answers = [{ body: { data: { credits: '12.340000', currency: 'usd' } } }];
  const wrapped = await atlas.balance(true);
  eq('a wrapped balance under another key still reads', wrapped.left, 12.34);
  eq('and keeps its raw string', wrapped.raw, '12.340000');
  ok('the whole body rides back so a new shape is readable', Boolean(wrapped.body), JSON.stringify(wrapped));

  eq('a cost under cost_usd reads', atlas.costOf({ cost_usd: '0.600000' }), 0.6);
  eq('a wrapped cost reads', atlas.costOf({ data: { amount: 2 } }), 2);

  // 5c. ROWS NOBODY COULD PRICE RIDE BACK. A total of zero beside rows that
  //     really came back would read as "she spent nothing" — the one wrong
  //     answer this must never give quietly.
  calls.length = 0;
  answers = [{ body: { data: [{ date: '2026-09-12', model: 'x', mystery_field: '1.0' }], has_more: false } }];
  const blind = await atlas.spend({ fresh: true, start: '2026-09-11', end: '2026-09-12' });
  eq('rows came back', blind.rows, 1);
  eq('none of them priced', blind.priced, 0);
  ok('and the unpriced row is handed back whole', Array.isArray(blind.unpriced) && blind.unpriced.length === 1, JSON.stringify(blind.unpriced));

  // 5d. THE REAL SHAPES, LIFTED FROM HER OWN LIVE ANSWER (2026-09-12). Both
  //     differ STRUCTURALLY from Atlas's published examples, not just by a
  //     key name, and each wrong reading answered a confident zero:
  //       · a balance is nested money OBJECTS in named pockets
  //       · a cost row is a DAY BUCKET holding results[], never a charge
  //     These fixtures are her body verbatim, so a vendor reshape fails HERE
  //     rather than on the page as "you spent nothing".
  calls.length = 0;
  answers = [{ body: {
    object: 'balance', scope: 'account',
    account: { id: '01a0882d-cdc2-7e20-86c2-471cde219f2f', name: '', type: 'personal' },
    available: { value: '23.555722', currency: 'usd' },
    cash: { value: '23.555722', currency: 'usd' },
    bonus: { value: '0.000000', currency: 'usd' },
    frozen: { value: '0.000000', currency: 'usd' },
    credit_grant: { status: 'normal', granted: { value: '0.000000', currency: 'usd' } },
  } }];
  const live = await atlas.balance(true);
  eq('the live balance reads AVAILABLE, the pocket she can spend', live.left, 23.555722);
  eq('and keeps its six-decimal string', live.raw, '23.555722');
  ok('never the object stringified', live.raw !== '[object Object]', String(live.raw));

  eq('a money OBJECT reads as a number', atlas.costOf({ amount: { value: '13.825576', currency: 'usd' } }), 13.825576);

  // A DAY BUCKET, exactly as /model-costs sends one — five models in one row.
  calls.length = 0;
  answers = [{ body: { data: [{
    object: 'model_cost.bucket', date: '2026-09-12',
    start_at: '2026-09-12T00:00:00Z', end_at: '2026-09-13T00:00:00Z',
    covered_until: '2026-09-12T22:33:34Z', partial: true,
    results: [
      { model: { id: 'ms-336e5a4bb8d0', name: 'bytedance/seedance-2.0-mini/reference-to-video', type: 'video' }, amount: { value: '13.825576', currency: 'usd' } },
      { model: { id: 'ms-5eed25000003', name: 'bytedance/seedance-2.5/reference-to-video', type: 'video' }, amount: { value: '4.020324', currency: 'usd' } },
      { model: { id: 'ms-6350aeabcf37', name: 'bytedance/seedance-2.0/reference-to-video', type: 'video' }, amount: { value: '1.353659', currency: 'usd' } },
      { model: { id: 'ms-336e5a4bb8d0', name: 'bytedance/seedance-2.0-mini/image-to-video', type: 'video' }, amount: { value: '0.595622', currency: 'usd' } },
      { model: { id: 'ms-aaaa', name: 'bytedance/seedance-2.0-fast/reference-to-video', type: 'video' }, amount: { value: '0.325103', currency: 'usd' } },
    ],
  }], has_more: false } }];
  const day = await atlas.spend({ fresh: true, start: '2026-09-12', end: '2026-09-13' });
  eq('one bucket came back', day.rows, 1);
  eq('but FIVE charges were priced out of it', day.priced, 5);
  eq('the day totals her real spend', Math.round(day.total * 1000000) / 1000000, 20.120284);
  eq('the dearest model leads', day.byModel[0].model, 'bytedance/seedance-2.0-mini/reference-to-video');
  eq('and carries its own figure', day.byModel[0].cost, 13.825576);
  eq('the day is one bucket', day.byDay.length, 1);
  eq('and the whole day is under it', day.byDay[0].cost, 20.120284);
  ok('a partial day says so', day.partial === true);
  eq('and how far it really reaches', day.coveredUntil, '2026-09-12T22:33:34Z');
  ok('nothing is left unpriced', !day.unpriced, JSON.stringify(day.unpriced));

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
