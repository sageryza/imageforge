'use strict';
// video-seed.js — every 2.x Seedance clip carries a seed, minted when the
// caller did not pass one, on BOTH doors. Pure, no network.
const fs = require('fs');
const seed = require('../video-seed');
const o = require('../openrouter');
let fails = 0;
function ok(n, c, x) { if (c) console.log('  ok   ' + n); else { fails++; console.log('  FAIL ' + n + (x ? '\n       ' + x : '')); } }
console.log('video seed');

// ── the rule itself
const many = Array.from({ length: 400 }, () => seed.randomSeed());
ok('a minted seed is an integer in 1…2^31-1', many.every((n) => Number.isInteger(n) && n >= 1 && n <= 2147483647));
ok('never zero — several APIs read 0 as "unset"', !many.includes(0));
ok('a fresh one per call, not a house constant', new Set(many).size > 390);
ok("the caller's seed always wins", seed.seedFor(7) === 7 && seed.seedFor(2147483647) === 2147483647);
ok('an unusable seed is replaced, never sent', [null, undefined, 'x', 1.5, 0, -3, 2147483648, NaN]
  .every((v) => { const n = seed.seedFor(v); return Number.isInteger(n) && n >= 1 && n <= 2147483647 && n !== v; }));
ok('the 2.x family takes a seed, under either spelling',
  seed.takesSeed('seedance-2.0-mini') && seed.takesSeed('bytedance/seedance-2.5')
  && seed.takesSeed('SEEDANCE-2.0') && seed.takesSeed(' seedance-2.0-fast '));
ok('the 1.x models are left alone — APIFRAME refuses an unknown param rather than ignoring it',
  !seed.takesSeed('seedance-1-lite') && !seed.takesSeed('seedance-1.5-pro') && !seed.takesSeed('wan-2.7') && !seed.takesSeed(undefined));

// ── the OpenRouter door, driven for real
const a = o.buildRequest({ prompt: 'p', model: '2.0-mini', duration: 4 });
const b = o.buildRequest({ prompt: 'p', model: '2.0-mini', duration: 4 });
ok('an unseeded OpenRouter job is minted one', Number.isInteger(a.body.seed) && Number.isInteger(b.body.seed));
ok('two unseeded jobs do not share a seed', a.body.seed !== b.body.seed);
ok('the seed reaches the LOG params too, not just the wire', a.params.seed === a.body.seed);
ok("a caller's seed rides untouched", o.buildRequest({ prompt: 'p', seed: 7 }).body.seed === 7);
ok('2.5 is seeded as well as Mini', Number.isInteger(o.buildRequest({ prompt: 'p' }).body.seed));

// ── the APIFRAME door, by source (its sender needs a key and a network)
const af = fs.readFileSync(__dirname + '/../apiframe.js', 'utf8');
ok('APIFRAME mints through the shared rule',
  /videoSeed\.takesSeed\(opts\.model\)\) params\.seed = videoSeed\.seedFor\(opts\.seed\)/.test(af));
ok('APIFRAME hands the seed back on the 202 so a chat can report it', /seed: sentParams\.seed/.test(af));
const or = fs.readFileSync(__dirname + '/../openrouter.js', 'utf8');
// Math.random is fine for a storage FILENAME; what must not exist is a
// second way to make a SEED, which is how the two doors would drift apart.
const seedLine = (src) => src.split('\n').some((l) => /seed/i.test(l) && /Math\.random|Date\.now\(\)/.test(l));
ok('neither door mints a seed of its own', !seedLine(or) && !seedLine(af));

// ── the measurement that says what a seed is worth, kept where it was made
const doc = fs.readFileSync(__dirname + '/../video-seed.js', 'utf8');
ok('video-seed.js records that a seed reproduces the OPENING and then drifts',
  /33\.2/.test(doc) && /reproduces the opening/i.test(doc.replace(/\s+/g, ' ')));
ok('and that it does not survive a changed prompt or a resolution change',
  /16\.8/.test(doc) && /16\.2/.test(doc));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed'); process.exit(fails ? 1 : 0);
