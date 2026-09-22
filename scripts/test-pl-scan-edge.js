#!/usr/bin/env node
// THE LIVE EDGE OF THE PLAYGROUND'S SCAN CACHE (2026-09-22, "missing lion").
// pl-scan-edge.js is pure: `plan` names what to re-read (the cached runs still
// drawing, and everything since the scan) and `apply` folds the fresh docs
// back into the cached array in place. Plus a source pin: promptlabScan in
// server.js really walks it, and does so on the CACHED path — a rule that runs
// only on the fresh read is no rule at all.
//   node scripts/test-pl-scan-edge.js
const fs = require('fs');
const path = require('path');
const edge = require('../pl-scan-edge');

let fails = 0;
const ok = (c, m) => { if (c) console.log('  ok   ' + m); else { console.log('  FAIL ' + m); fails++; } };

const T = 1790000000000;
const runs = [
  { id: 'new', status: 'running', createdAt: T - 5000 },
  { id: 'mid', status: 'done', createdAt: T - 60000 },
  { id: 'zombie', status: 'running', createdAt: T - 3 * 60 * 60 * 1000 },
  { id: 'old', status: 'failed', createdAt: T - 90000 },
];

console.log('plan');
const p = edge.plan(runs, T - 1000, T);
ok(p.ids.length === 1 && p.ids[0] === 'new', 'only the cached run still drawing is re-read');
ok(p.since === T - 1000 - edge.SINCE_MARGIN_MS, 'newer runs are asked for from a little before the scan');
ok(edge.plan([], 0, T).ids.length === 0, 'an empty cache plans nothing');
ok(edge.plan(runs, T, T).ids.indexOf('zombie') < 0, 'a run unfinished for hours is left alone');

console.log('apply');
const added = edge.apply(runs, [
  { id: 'new', status: 'done', createdAt: T - 5000, images: ['x'] },   // it landed
  { id: 'newer', status: 'done', createdAt: T - 500 },                // created since the scan
  { id: 'mid', status: 'done', createdAt: T - 60000 },                // the same, again — no dupe
]);
ok(added === 1, 'one run was new to the cache');
ok(runs.length === 5, 'and nothing was duplicated');
ok(runs.find((r) => r.id === 'new').status === 'done', 'the drawing run is now its finished copy');
ok(runs[0].id === 'newer' && runs[1].id === 'new', 'a new run is inserted by date, newest first');
ok(edge.apply(runs, [{ id: 'new', status: 'done', createdAt: T - 5000 }]) === 0, 'replacing adds nothing');
ok(edge.apply(null, []) === 0 && edge.apply(runs, null) === 0, 'bad input is a no-op');

console.log('the server walks it on the CACHED path');
const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const i = src.indexOf('async function promptlabScan(');
const body = src.slice(i, src.indexOf('\n}\n', i));
ok(/require\('\.\/pl-scan-edge'\)/.test(src), 'server.js requires the rule');
ok(/plScanEdge\.plan\(/.test(body) && /plScanEdge\.apply\(/.test(body), 'promptlabScan plans and applies the edge');
ok(!/if \(plScan\.runs && Date\.now\(\) - plScan\.at < 60000\) return plScan\.runs;/.test(body),
  'and the cached branch no longer returns before it');
ok(/getAll\(/.test(body) && /where\('createdAt', '>'/.test(body), 'a doc read for the stale ids and a ranged query for the new');

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
