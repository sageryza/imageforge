#!/usr/bin/env node
// WHICH VERDICTS MOVE A CHAT, on an archive-review deck (`applyArchive`).
//
// Pure — the decision is `archiveActionFor` and nothing else, so this needs no
// Firestore and no server. It exists because the first version got the most
// dangerous case wrong: in browse mode judge.js turns a second tap on the LIT
// chip into `ok:null` — "no verdict" — and reading that as "not archive" meant
// a stray tap on a card silently pulled a chat back out of the archive. On a
// 74-card sweep that is 74 chances to undo the work without noticing.
//
//   node scripts/test-archive-verdict.js

const assert = require('assert');

// chatfeed.js pulls in express/firebase-admin at require time; the decision is
// pure, so read it out of the source rather than dragging the server in.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'chatfeed.js'), 'utf8');
const m = /function archiveActionFor\(ok\) \{[\s\S]*?\n\}/.exec(src);
if (!m) { console.error('archiveActionFor not found in chatfeed.js'); process.exit(1); }
// eslint-disable-next-line no-new-func
const archiveActionFor = new Function(`${m[0]}; return archiveActionFor;`)();

let n = 0;
function ok(name, fn) { fn(); n += 1; console.log(`PASS: ${name}`); }

ok('an explicit archive verdict archives', () => {
  assert.strictEqual(archiveActionFor('archive'), true);
});

ok('an explicit other verdict takes it back out — Keep is the undo', () => {
  assert.strictEqual(archiveActionFor('keep'), false);
});

ok('CLEARING a mark does nothing — undecided is not "not archived"', () => {
  // this is the tap that used to un-archive: browse mode sends null when she
  // taps the chip that is already lit
  assert.strictEqual(archiveActionFor(null), null);
  assert.strictEqual(archiveActionFor(undefined), null);
});

ok('a note-only write never reaches the decision at all', () => {
  // POST /verdict only calls this when `ok` was sent; a text-only body leaves
  // it undefined, and undefined must be inert even if it ever gets through
  assert.strictEqual(archiveActionFor(undefined), null);
});

ok('the stock ♥/✕ booleans are explicit verdicts, and neither is "archive"', () => {
  assert.strictEqual(archiveActionFor(true), false);
  assert.strictEqual(archiveActionFor(false), false);
});

console.log(`all ${n} checks passed`);
