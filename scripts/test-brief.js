#!/usr/bin/env node
// Tests for the update button's ranking (brief.js) — pure, no network, no
// Firestore. `buildBrief` takes plain objects for exactly this reason.
//
// Every case here is a rule the brief has to keep, written as the registry
// fields and message docs the server really sees:
//   • the loudest thing is a chat BLOCKED on her, and unseen beats seen
//   • the ✓ in the Chats app (`notifSeenAt`) is the ONE floor — checking a chat
//     off there empties its card here, and anything newer brings it back
//   • her own filing wins (pinTop / starred lift, 'later' sinks, 'never' drops)
//   • her messages and live drafts are never "the news"
//   • pictures and Compare pages land on the chat that made them
//
//   node scripts/test-brief.js

const { buildBrief } = require('../brief');

let pass = 0; const fails = [];
function is(name, got, want) {
  // JSON, not ===, so an expected list of chat names compares by its contents.
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fails.push(`${name}\n    want ${JSON.stringify(want)}\n    got  ${JSON.stringify(got)}`);
}
function ok(name, cond) { is(name, Boolean(cond), true); }

// A readable clock: minutes past an arbitrary hour, as ISO strings.
const t = (min) => new Date(Date.UTC(2026, 7, 17, 18, min, 0)).toISOString();
const NOW = Date.parse(t(60));

/** Run the brief over one scenario, with sane empty defaults. */
function run(o) {
  return buildBrief({
    chats: o.chats || {}, messages: o.messages || [],
    pages: o.pages || [], assets: o.assets || [],
    now: o.now || NOW, top: o.top || 5, more: o.more == null ? 12 : o.more,
  });
}
const names = (b) => (b.top || []).map((c) => c.chat);

// ── A need outranks a new reply, and unseen outranks seen ──────────────────
{
  const b = run({
    chats: {
      asks:   { statusNeed: 'pick a palette, 10 seconds' },
      asksold:{ statusNeed: 'listen to two cuts', notifSeenAt: t(50) },
      talks:  {},
    },
    messages: [
      { chat: 'asks', created: t(40), tldr: 'palette options are up' },
      { chat: 'asksold', created: t(41), tldr: 'two cuts rendered' },
      { chat: 'talks', created: t(42), tldr: 'the sheet is stitched' },
    ],
  });
  is('a need she has not seen leads', names(b)[0], 'asks');
  is('a need she HAS seen still beats a plain new reply', names(b)[1], 'asksold');
  is('and the plain reply is third', names(b)[2], 'talks');
  is('the ask is the line', b.top[0].line, 'pick a palette, 10 seconds');
  is('the chip says so', b.top[0].why, 'needs you');
  is('counts add up', b.counts.needs, 2);
}

// ── The ✓ is the floor: checked off and nothing newer → no card ────────────
{
  const b = run({
    chats: { done: { notifSeenAt: t(45) }, live: { notifSeenAt: t(30) } },
    messages: [
      { chat: 'done', created: t(40), tldr: 'finished' },
      { chat: 'live', created: t(40), tldr: 'finished' },
    ],
  });
  is('a chat checked off after its last reply is gone', names(b), ['live']);
}
// …and anything newer brings it straight back, with no ✓ to undo.
{
  const b = run({
    chats: { done: { notifSeenAt: t(45) } },
    messages: [
      { chat: 'done', created: t(40), tldr: 'finished' },
      { chat: 'done', created: t(50), tldr: 'one more thing' },
    ],
  });
  is('a newer reply un-checks it by itself', names(b), ['done']);
  is('the newest reply is the line', b.top[0].line, 'one more thing');
}

// ── A live `need` keeps the card even with nothing new ────────────────────
// The ask is still open; that is the whole point of the field.
{
  const b = run({
    chats: { waiting: { statusNeed: 'which cover?', notifSeenAt: t(50), statusAt: t(20) } },
    messages: [{ chat: 'waiting', created: t(20), tldr: 'two covers up' }],
  });
  is('an open ask survives being checked off', names(b), ['waiting']);
}

// ── Off every list ────────────────────────────────────────────────────────
{
  const b = run({
    chats: {
      gone:   { deletedAt: t(10) },
      filed:  { archived: true },
      never:  { newsQueue: 'never' },
      moved:  { movedTo: 'somewhere' },
      __settings: { appAccount: '1' },
      here:   {},
    },
    messages: ['gone', 'filed', 'never', 'moved', '__settings', 'here']
      .map((c) => ({ chat: c, created: t(40), tldr: 'something' })),
  });
  is('trash, archive, "maybe never", a tombstone and the settings doc are all out',
    names(b), ['here']);
}

// ── Hidden is "not now", and it self-clears ───────────────────────────────
{
  const b = run({
    chats: { hid: { hiddenAt: t(45) }, popped: { hiddenAt: t(35) } },
    messages: [
      { chat: 'hid', created: t(40), tldr: 'quiet' },
      { chat: 'popped', created: t(40), tldr: 'answered her' },
    ],
  });
  is('hidden with nothing newer stays hidden', names(b), ['popped']);
}

// ── Her own messages and live drafts are never the news ───────────────────
{
  const b = run({
    chats: { c: {} },
    messages: [
      { chat: 'c', created: t(50), from: 'sophie', text: 'can you redo the blue one' },
      { chat: 'c', created: t(52), working: true, text: 'still writing…' },
      { chat: 'c', created: t(40), tldr: 'blue one redone' },
    ],
  });
  is('the card reads the last REPLY, not her message or a draft',
    b.top[0].line, 'blue one redone');
  is('and only real replies are counted as new', b.top[0].news, 1);
}

// ── The line: need → the Update card's `did` → the reply ───────────────────
{
  const b = run({
    chats: { c: { updDid: 'cut the sheet into 12 stickers' } },
    messages: [{ chat: 'c', created: t(40), tldr: 'sheet cut' }],
  });
  is('the Update card is the line when nothing is needed',
    b.top[0].line, 'cut the sheet into 12 stickers');
  is('and the whole card rides along', b.top[0].update.did, 'cut the sheet into 12 stickers');
}
{
  // Her question repeated verbatim in bold is the FIRST line of every answer
  // (the answering rule) — it is her sentence, so it must never come back as
  // the update. Same rule the push body follows.
  const b = run({
    chats: { c: {} },
    messages: [{ chat: 'c', created: t(40),
      text: '**Can you make the crow bigger?**\nBigger crow, three versions up.' }],
  });
  is('her own bolded question is not the update',
    b.top[0].line, 'Bigger crow, three versions up.');
}

// ── Pictures and pages land on the right card ─────────────────────────────
{
  const b = run({
    chats: { art: { notifSeenAt: t(20) }, plain: {} },
    messages: [
      { chat: 'art', created: t(30), tldr: 'six lesson cards' },
      { chat: 'plain', created: t(31), tldr: 'notes tidied' },
    ],
    assets: [
      { chat: 'art', url: 'https://storage.googleapis.com/b/a.png', created: t(40),
        description: 'Penny — the blue Kleenex', prompt: 'gpt-image-2 · medium', md5: 'AAA' },
      // the hook's own copy of the same bytes under a random name: ONE picture
      { chat: 'art', url: 'https://storage.googleapis.com/b/claude-deliveries/x.png',
        created: t(41), prompt: 'from art', md5: 'AAA' },
      { chat: 'art', url: 'https://storage.googleapis.com/b/song.m4a', created: t(42), kind: 'audio' },
      { chat: 'art', url: 'https://storage.googleapis.com/b/b.webp', created: t(43),
        description: 'Penny — v2' },
    ],
    pages: [
      { id: 'p1', chat: 'art', title: 'Lesson cards v3', created: t(44) },
      { id: 'p2', chat: 'art', title: 'Lesson cards v2', created: t(10), superseded: true },
    ],
  });
  const art = b.top.find((c) => c.chat === 'art');
  const penny = art.images.find((i) => /\/a\.png$/.test(i.url));
  is('the same bytes under two names are one picture', art.images.length, 2);
  is('the strip is newest first', art.images[0].label, 'Penny — v2');
  ok('the LABELED url is the one the merge keeps, not the hook\'s copy', penny);
  is('so the label survives', penny && penny.label, 'Penny — the blue Kleenex');
  is('the MODEL · QUALITY caption comes along', penny && penny.caption, 'gpt-image-2 · medium');
  is('audio is not a picture', art.images.filter((i) => /m4a/.test(i.url)).length, 0);
  is('a superseded page is not news', art.pages.map((p) => p.id).join(), 'p1');
  is('the page link is the one the app opens', art.pages[0].url, '/api/chatfeed/page/p1');
  ok('a chat with a new page outranks a chat with only a reply',
    names(b)[0] === 'art');
  is('the chip names the page', art.why, 'new page');
  is('the counts see them', `${b.counts.pages}/${b.counts.images}`, '1/2');
}

// ── Her filing wins ───────────────────────────────────────────────────────
{
  const b = run({
    chats: {
      pinned:  { pinTop: true }, starred: { starred: true },
      plain:   {}, later: { newsQueue: 'later' },
    },
    messages: ['pinned', 'starred', 'plain', 'later']
      .map((c) => ({ chat: c, created: t(40), tldr: 'something' })),
  });
  is('pinned to the top leads, then starred, and "come back to" sinks',
    names(b), ['pinned', 'starred', 'plain', 'later']);
}

// ── Five at the top, the rest underneath ──────────────────────────────────
{
  const chats = {}; const messages = [];
  for (let i = 0; i < 9; i++) {
    chats['c' + i] = {};
    messages.push({ chat: 'c' + i, created: t(20 + i), tldr: 'reply ' + i });
  }
  const b = run({ chats, messages, more: 3 });
  is('top is five', b.top.length, 5);
  is('more is capped where asked', b.more.length, 3);
  is('and nothing is in both', b.top.filter((c) => b.more.some((m) => m.chat === c.chat)).length, 0);
  is('the count is every card, not just the shown ones', b.counts.chats, 9);
}

// ── One of the five is held for something to LOOK at ──────────────────────
// Measured against her real data: 24 of 33 cards carried an open ask, so a
// pure score sort filled all five with them and the pictures and pages never
// reached the top of the page.
{
  const chats = {}; const messages = [];
  for (let i = 0; i < 8; i++) {
    chats['ask' + i] = { statusNeed: 'a thing, 10 seconds' };
    messages.push({ chat: 'ask' + i, created: t(30 + i), tldr: 'asked' });
  }
  chats.quiet = { notifSeenAt: t(10) };
  messages.push({ chat: 'quiet', created: t(20), tldr: 'drew six cards' });
  const b = run({ chats, messages, assets: [
    { chat: 'quiet', url: 'https://storage.googleapis.com/b/q.png', created: t(21),
      description: 'card 1' },
  ] });
  is('the fifth slot goes to the one with something to look at',
    names(b)[4], 'quiet');
  is('the first four are still whatever scored highest',
    names(b).slice(0, 4).every((n) => /^ask/.test(n)), true);
  is('and it is not also down in the quieter list',
    b.more.some((c) => c.chat === 'quiet'), false);
}
// With nothing to look at, nothing is reserved — a quiet week reads as before.
{
  const chats = {}; const messages = [];
  for (let i = 0; i < 7; i++) {
    chats['ask' + i] = { statusNeed: 'a thing' };
    messages.push({ chat: 'ask' + i, created: t(30 + i), tldr: 'asked' });
  }
  const b = run({ chats, messages });
  is('no pictures anywhere → the plain score order', b.top.length, 5);
  is('and nothing was dropped on the way', b.top.length + b.more.length, 7);
}

// ── A pinned deliverable rides along while it is current ──────────────────
{
  const b = run({
    chats: { film: { pinned: { url: 'https://x/f.mp4', title: 'Evan v6', kind: 'film', turns: 1 } },
             old:  { pinned: { url: 'https://x/g.mp4', title: 'old cut', kind: 'film', turns: 4 } } },
    messages: [
      { chat: 'film', created: t(40), tldr: 'new cut up' },
      { chat: 'old', created: t(41), tldr: 'notes' },
    ],
  });
  is('a fresh pin is current', b.top.find((c) => c.chat === 'film').pinned.current, true);
  is('a stale one is not', b.top.find((c) => c.chat === 'old').pinned.current, false);
}

// ── Nothing at all is a clean empty, not a crash ──────────────────────────
{
  const b = run({});
  is('empty stays empty', `${b.top.length}/${b.more.length}/${b.counts.chats}`, '0/0/0');
}

// ── Report ────────────────────────────────────────────────────────────────
if (fails.length) {
  console.error(`\n${fails.length} FAILED (${pass} passed)\n`);
  fails.forEach((f) => console.error('  ✕ ' + f + '\n'));
  process.exit(1);
}
console.log(`brief: ${pass} passed`);
