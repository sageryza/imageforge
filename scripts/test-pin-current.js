#!/usr/bin/env node
// THE PINNED LINK — the two server rules behind it, run against the REAL code
// lifted out of chatfeed.js (no network, no Firestore).
//
//   1. pinKind()  — a missing `kind` is read off the url. This is what stops a
//      page pinned without a kind from being dropped into a <video> and
//      rendering a black box; a film pinned the old way must still say video.
//   2. pinBump()  — the "current" tag's whole life (Aug 2026, Sophie: "it only
//      says that if the chat updated the last turn that they finished"). The
//      count is finished replies SINCE the pin: 0 and 1 are current, 2 is not,
//      and once it is past current the count stops moving so the reply post
//      isn't writing the registry doc forever.
//
// Run: node scripts/test-pin-current.js
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'chatfeed.js'), 'utf8');
const from = src.indexOf('const PIN_KINDS');
const to = src.indexOf("router.post('/pin'");
if (from < 0 || to < 0 || to < from) {
  console.error('FAIL: could not find the pin block in chatfeed.js');
  process.exit(1);
}
const { pinKind, pinBump, PIN_CURRENT_TURNS } = new Function(
  src.slice(from, to) + '\nreturn { pinKind, pinBump, PIN_CURRENT_TURNS };')();

let fails = 0;
function ok(name, cond, extra) {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra !== undefined ? '\n       ' + JSON.stringify(extra) : ''));
}

console.log('pinKind — a missing kind is read off the url');
{
  const page = 'https://imageforge-q125.onrender.com/science';
  ok('a page with no kind is a LINK, not a video', pinKind(undefined, page) === 'link', pinKind(undefined, page));
  ok('…and so is one with a query string',
    pinKind('', 'https://imageforge-q125.onrender.com/chunking?tab=all') === 'link');
  ok('an .mp4 with no kind is a video',
    pinKind(undefined, 'https://storage.googleapis.com/x/films/evan-v6.mp4') === 'video');
  ok('…even behind a signed-url query',
    pinKind(undefined, 'https://storage.googleapis.com/x/a.mov?GoogleAccessId=1&Expires=2') === 'video');
  ok('an .m4a with no kind is audio',
    pinKind(undefined, 'https://storage.googleapis.com/x/ep3.m4a') === 'audio');
  ok('an explicit kind always wins',
    pinKind('link', 'https://storage.googleapis.com/x/evan.mp4') === 'link');
  ok('a junk kind falls through to the url, not to video',
    pinKind('movie', 'https://imageforge-q125.onrender.com/science') === 'link');
}

console.log('pinBump — the "current" tag ages by FINISHED turns');
{
  ok('nothing pinned → nothing to write', pinBump(null) === null);
  ok('a cleared pin → nothing to write', pinBump({ turns: 0 }) === null);

  const fresh = { url: 'https://x/science', kind: 'link', turns: 0 };
  const after1 = pinBump(fresh);
  ok('the turn that pinned it ends → count 1', after1 && after1.turns === 1, after1);
  ok('…and the pin itself is untouched', after1.url === fresh.url && after1.kind === 'link');
  ok('the ORIGINAL is not mutated', fresh.turns === 0);

  const after2 = pinBump(after1);
  ok('a second finished turn that left it alone → count 2', after2 && after2.turns === 2, after2);
  ok('after that the count stops moving (no more registry writes)', pinBump(after2) === null);

  // A pin written before this shipped carries no count at all.
  const legacy = pinBump({ url: 'https://x/old.mp4', kind: 'video' });
  ok('a pin with no count starts at 1 rather than throwing', legacy && legacy.turns === 1, legacy);
}

console.log('the client rule reads the same number');
{
  // pinCurrent() in public/chats.html is the other half; it must agree with the
  // cap the server counts to, or the tag lingers a turn too long (or blinks out
  // a turn early). Lifted the same way, so a change to either side is caught.
  const page = fs.readFileSync(path.join(__dirname, '..', 'public', 'chats.html'), 'utf8');
  const i = page.indexOf('function pinCurrent(');
  ok('chats.html still defines pinCurrent()', i > -1);
  if (i > -1) {
    let d = 0, end = i;
    for (let k = page.indexOf('{', i); k < page.length; k++) {
      if (page[k] === '{') d++;
      else if (page[k] === '}' && --d === 0) { end = k + 1; break; }
    }
    const pinCurrent = new Function(page.slice(i, end) + '\nreturn pinCurrent;')();
    ok('mid-turn (0) is current', pinCurrent({ turns: 0 }) === true);
    ok('the turn it was pinned in, finished (1), is current', pinCurrent({ turns: 1 }) === true);
    ok('a turn later (2) is NOT current', pinCurrent({ turns: 2 }) === false);
    ok('no count → no tag, never a guess', pinCurrent({ url: 'https://x/a' }) === false);
    ok('no pin → no tag', pinCurrent(null) === false);
    ok('client and server agree on where current stops',
      pinCurrent({ turns: PIN_CURRENT_TURNS }) === true
      && pinCurrent({ turns: PIN_CURRENT_TURNS + 1 }) === false);
  }
}

console.log(fails ? '\nFAILED (' + fails + ')' : '\nPASS: the pin reads its kind off the url and ages by finished turns');
process.exit(fails ? 1 : 0);
