#!/usr/bin/env node
// THE TWO RULE WORDS, SPELLED THE SAME IN THREE FILES ------------------------
// `waiting for a response` and `to be reviewed` are Sophie's, and each says
// something only she knows — that she owes a chat a reply, that a deliverable
// is waiting on her eye. So the auto-sorter is forbidden from filing into
// either, and the page, the server and the sorter have to agree on the exact
// strings or a word she applies means nothing on the other side.
//
// THE UPDATE TAB IS GONE (2026-09-14, Sophie: "get rid of the updates tab in
// chats") and it took most of this file with it — the pin at the top of that
// tab, the Review door and its ⌄, and dismissing a review chat from the fold
// (which is what used to WRITE `reviewHoldAt`). What survives of the two
// rules is real and is covered elsewhere: the `waiting for a response`
// wristwatch is `test-chats-waiting-mark.js`, and `reviewHeld` suppressing
// the pop-out is `test-chats-unpark.js`.
//
// This is the vocabulary check that was assertion 8. Pure — no browser.
//
//   node scripts/test-tag-rules.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PIN = 'waiting for a response';
const REVIEW = 'to be reviewed';

let failed = 0;
const fail = (m) => { console.error('FAIL: ' + m); failed++; process.exitCode = 1; };
const ok = (m) => console.log('  ok   ' + m);

const feed = require(path.join(ROOT, 'chatfeed.js'));
const sort = require(path.join(ROOT, 'chat-sort.js'));
const page = fs.readFileSync(path.join(ROOT, 'public', 'chats.html'), 'utf8');

if (feed.PIN_LABEL !== PIN) fail('chatfeed PIN_LABEL is "' + feed.PIN_LABEL + '"');
if (feed.REVIEW_LABEL !== REVIEW) fail('chatfeed REVIEW_LABEL is "' + feed.REVIEW_LABEL + '"');

const table = /var TAG_RULES\s*=\s*\[([\s\S]*?)\];/.exec(page);
if (!table) fail('no TAG_RULES table in chats.html');
else {
  if (table[1].indexOf("'" + PIN + "'") < 0) fail('TAG_RULES does not carry ' + PIN);
  if (table[1].indexOf('REVIEW_LABEL') < 0) fail('TAG_RULES does not carry the review word');
}

// The sorter must never file into either: both say something only she knows,
// and a guess would light a mark she never asked for or hide a chat she was
// watching.
[PIN, REVIEW].forEach((w) => {
  if (sort.TRIAGE.indexOf(w) < 0) fail('the auto-sorter may still file into "' + w + '"');
  if (sort.sortableCategories({ categories: [w, 'witch'] }, {}).indexOf(w) > -1) {
    fail('"' + w + '" is still offered to the sorter as a folder');
  }
});

if (!failed) ok('the two rule words match across the page, the server and the sorter');
console.log(failed ? '\n' + failed + ' failed' : '\nall good');
