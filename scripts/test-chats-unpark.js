#!/usr/bin/env node
// A PARK IS CLEARED BY A FINISHED REPLY THAT LANDED AFTER IT (Aug 2026).
//
// Sophie: chats "end up in the hidden and then they never come out of it so I
// never know when they're done and I forget about them."
//
// The park stamps (`hiddenAt`, `filedAt`) are written when something LANDS, but
// the rule compared them against a message's `created` — and a turn's doc is
// created by its FIRST LIVE DRAFT, so `created` is when the chat started
// writing. Anything parking a chat mid-turn therefore out-stamped the very
// reply that answers it, and the chat could never come back on its own.
// Measured live 2026-08-14: 30 chats stuck, two of them holding full replies
// she had never seen ("Baby gets a boost": reply at 04:47:01, park at
// 04:48:18, permanently buried).
//
// Her call on the other half, asked directly: "only when it's finished" — a
// live draft keeps the chat parked, so it returns when it is done rather than
// the moment it starts typing.
//
// The functions are lifted out of chats.html and RUN, so this tests the real
// rule rather than a copy of it, and needs no browser.
// Run: node scripts/test-chats-unpark.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'public/chats.html'), 'utf8');

let fails = 0;
function ok(name, cond, extra) {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra ? '\n       ' + extra : ''));
}

function lift(name) {
  const i = html.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('chats.html has no ' + name + '()');
  let d = 0;
  for (let k = html.indexOf('{', i); k < html.length; k++) {
    if (html[k] === '{') d++;
    else if (html[k] === '}' && --d === 0) return html.slice(i, k + 1);
  }
  throw new Error('unbalanced ' + name);
}

// `chats` is the page's registry map; the lifted functions close over it.
let chats = {};
const scope = { chats: () => chats };
const src = 'var PARK_LEASH=3*60*1000;\n'
  + lift('unparked') + '\n' + lift('parkTripped') + '\n' + lift('chatHidden') + '\n' + lift('chatBack')
  + '\nreturn { unparked: unparked, parkTripped: parkTripped, chatHidden: chatHidden, chatBack: chatBack };';
// eslint-disable-next-line no-new-func
const api = new Function('getChats', 'var chats; ' + src.replace(/\bchats\b(?=\s*&&|\s*\[)/g, 'getChats()'))(scope.chats);

const PARK = '2026-08-14T04:48:18.855Z';
const before = { created: '2026-08-14T04:47:01.375Z', postedAt: '2026-08-14T04:48:19.712Z' };
const older = { created: '2026-08-14T04:00:00.000Z', postedAt: '2026-08-14T04:10:00.000Z' };
const draft = { created: '2026-08-14T04:47:01.375Z', postedAt: '2026-08-14T04:49:00.000Z', working: true };

console.log('the bug she reported');
{
  // the real "Baby gets a boost" numbers
  chats = { baby: { hiddenAt: PARK } };
  ok('a reply that STARTED before the park but LANDED after it un-parks the chat',
    api.chatHidden('baby', before) === false,
    'created=' + before.created + ' postedAt=' + before.postedAt + ' park=' + PARK);
  ok('the old created-based rule would have kept it hidden',
    before.created < PARK, 'this is why the chat was buried');
}

console.log('parking still works');
{
  chats = { c: { hiddenAt: PARK } };
  ok('a park with nothing since keeps the chat hidden', api.chatHidden('c', null) === true);
  ok('a reply that landed BEFORE the park keeps it hidden',
    api.chatHidden('c', older) === true);
  // /reply writes her message's postedAt BEFORE stamping hiddenAt, so the stamp
  // is always strictly later — her own message must never un-park the chat.
  const hers = { from: 'sophie', created: '2026-08-14T04:48:18.000Z', postedAt: '2026-08-14T04:48:18.400Z' };
  ok('her own message never un-parks the chat it just parked',
    api.chatHidden('c', hers) === true,
    'postedAt=' + hers.postedAt + ' park=' + PARK);
  ok('an unparked chat is not hidden at all', api.chatHidden('nope', before) === false);
}

console.log('only when it is FINISHED (her call)');
{
  chats = { c: { hiddenAt: PARK } };
  ok('a live draft keeps the chat parked', api.chatHidden('c', draft) === true);
  const done = Object.assign({}, draft, { working: false });
  ok('…and it returns once the draft finishes', api.chatHidden('c', done) === false);
}

console.log('filing pops back the same way');
{
  chats = { s: { filedAt: PARK } };
  ok('a filed chat comes back when its reply lands after the filing',
    api.chatBack('s', before) === true);
  ok('a filed chat stays filed while it is still writing',
    api.chatBack('s', draft) === false);
  ok('a filed chat stays filed when nothing newer landed',
    api.chatBack('s', older) === false);
  ok('HER message never pops a filed chat back out',
    api.chatBack('s', { from: 'sophie', postedAt: '2026-08-14T09:00:00Z' }) === false);
  chats = { s: {} };
  ok('a chat that was never filed never "comes back"',
    api.chatBack('s', before) === false);
}

console.log('fallbacks');
{
  chats = { c: { hiddenAt: PARK } };
  ok('a doc with no postedAt falls back to created',
    api.chatHidden('c', { created: '2026-08-14T05:00:00.000Z' }) === false);
  ok('…and an old created still keeps it hidden',
    api.chatHidden('c', { created: '2026-08-14T04:00:00.000Z' }) === true);
}

console.log('the leash (Aug 2026: "could it just be like three minutes")');
{
  const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();
  const MIN = 60000;
  // an automatic park (workingAt == hiddenAt) with no life since → tripped
  chats = { c: { hiddenAt: iso(10 * MIN), workingAt: iso(10 * MIN) } };
  ok('a dead automatic park trips after 3 minutes',
    api.chatHidden('c', { created: iso(60 * MIN), postedAt: iso(60 * MIN) }) === false);
  // the same park with a draft that grew 30s ago → alive, still hidden
  ok('a growing draft is a sign of life — still hidden',
    api.chatHidden('c', { created: iso(9 * MIN), postedAt: iso(30000), working: true }) === true);
  // a park younger than the leash → still hidden even with no life yet
  chats = { c: { hiddenAt: iso(MIN), workingAt: iso(MIN) } };
  ok('a fresh automatic park has its 3 minutes',
    api.chatHidden('c', { created: iso(60 * MIN), postedAt: iso(60 * MIN) }) === true);
  // her hand hide (no workingAt) never trips, however old
  chats = { c: { hiddenAt: iso(2 * 24 * 60 * MIN) } };
  ok('a hand hide never trips the leash',
    api.chatHidden('c', { created: iso(60 * 60 * MIN), postedAt: iso(60 * 60 * MIN) }) === true);
  // she hid it by hand mid-turn (hiddenAt newer than workingAt) — her hand wins
  chats = { c: { workingAt: iso(20 * MIN), hiddenAt: iso(19 * MIN) } };
  ok('a mid-turn hand hide (hiddenAt newer than workingAt) never trips',
    api.chatHidden('c', { created: iso(20 * MIN), postedAt: iso(20 * MIN), working: true }) === true);
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
