#!/usr/bin/env node
/**
 * THE AUTO-COMPARE POKE — leading edge as well as trailing.
 *
 * Sophie, 2026-08-24: "it should automatically be a compare sheet for low and
 * medium". It already was; it was just 45 seconds late. The poke was
 * trailing-only, so a batch of filings left the page stale for the whole
 * debounce and she looked inside that window.
 *
 * The second reason this matters is not about her patience: the timer lives in
 * the server PROCESS, and a Render deploy restarts the box — twice on the day
 * this was written it landed inside a running job. A deploy inside the window
 * drops the pending poke and nothing re-runs it.
 *
 * Pure: reads the source, no network, no Firestore.
 *
 *   node scripts/test-auto-compare-poke.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let n = 0;
const ok = (name) => { n++; console.log('  ok  ' + name); };
const SRC = fs.readFileSync(path.join(__dirname, '..', 'chatfeed.js'), 'utf8');
const POKE = /function autoComparePoke\(chat\) \{[\s\S]*?\n\}/.exec(SRC);

console.log('\nauto-compare poke\n');

assert.ok(POKE, 'found autoComparePoke');
const body = POKE[0];

assert.ok(/const pending = autoTimers\.get\(slug\)/.test(body),
  'it reads whether something was already queued');
assert.ok(/if \(!pending\) \{[\s\S]*?runAutoCompare\(slug\)/.test(body),
  'and runs immediately when nothing was');
ok('the FIRST filing of a batch rebuilds the pages at once');

// the trailing half must survive — it is what coalesces a batch of filings
assert.ok(/setTimeout\(\(\) => \{[\s\S]*?runAutoCompare\(slug\)[\s\S]*?\}, AUTO_DEBOUNCE_MS\)/.test(body),
  'the trailing run is still scheduled');
assert.ok(/clearTimeout\(pending\)/.test(body), 'and each filing still resets it');
ok('the trailing run still coalesces the rest of the batch');

// a pending poke must never hold the process open
assert.ok(/if \(t\.unref\) t\.unref\(\)/.test(body), 'the timer is unref-ed');
ok('a queued poke cannot hold the process open');

// both runs must be caught — an unhandled rejection here would take the
// server down, and this is called from inside a filing request
const catches = body.match(/\.catch\(/g) || [];
assert.strictEqual(catches.length, 2, `both runs catch their own failure (${catches.length})`);
ok('neither run can reject into a filing request');

// it stays FREE — the whole point is that this can run twice per batch
const RUN = /async function runAutoCompare\(chat\)[\s\S]*?\n\}/.exec(SRC);
assert.ok(RUN, 'found runAutoCompare');
for (const paid of ['anthropicChat', 'openai', 'chatJSON', 'gpt-image']) {
  assert.ok(!RUN[0].includes(paid),
    `runAutoCompare spends nothing — no ${paid} (it now runs twice per batch)`);
}
ok('running it twice costs nothing — no model call in it');

console.log(`\n${n} checks passed.\n`);
