#!/usr/bin/env node
// Tests for auto-sorting chats into Sophie's folders (chat-sort.js) — pure,
// no network, no Firestore, no API key.
//
// The three rules the whole feature rests on, each one a case below:
//   1. her filing is final          — `catBy`
//   2. "none" is a real answer      — and it locks nothing
//   3. never invent a folder        — the vocabulary is hers
// Plus the one that is easy to get wrong and expensive when you do: the
// `filedAt` stamp, which is what stops a chat from swallowing the very reply
// that triggered its sort.
//
//   node scripts/test-chat-sort.js

const s = require('../chat-sort');

let pass = 0; const fails = [];
function is(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  fails.push(`${name}\n    want ${w}\n    got  ${g}`);
}
const ok = (name, got) => is(name, !!got, true);

// Her real vocabulary, measured off the live registry 2026-08-15.
const SETTINGS = { categories: ['look at', 'stories', 'come back to', 'witch', 'tech',
  'xi', 'just for fun', 'weird games', 'meta'] };
const CHATS = {
  'secretly-a-witch': { category: 'witch', displayName: 'secretly A Witch app' },
  'witch-blog': { category: 'witch' },
  imprint: { category: 'stories', displayName: 'imprint' },
  'chat-archive-labels-tags': { category: 'meta' },
  'archived-chats-section': { category: 'meta' },
  crystals: { category: 'look at' },
  'a-guess': { category: 'meta', catBy: 'auto' },   // the sorter's own answer
  'dead-one': { category: 'stories', deletedAt: '2026-08-01T00:00:00.000Z' },
  loose: {},
};

// ── The vocabulary is hers, minus the two WHEN folders ──────────────────────
const cats = s.sortableCategories(SETTINGS, CHATS);
is('her folders, triage removed', cats,
  ['stories', 'witch', 'tech', 'xi', 'just for fun', 'weird games', 'meta']);
is('"look at" is never on offer', cats.indexOf('look at'), -1);
is('"come back to" is never on offer', cats.indexOf('come back to'), -1);

// A folder in use but never registered in settings still counts — she can file
// from select mode faster than a name reaches __settings.
is('a name in use joins the vocabulary',
  s.sortableCategories({}, { x: { category: 'dreams' } }), ['dreams']);
is('the same name twice is one folder',
  s.sortableCategories({ categories: ['Tech'] }, { x: { category: 'tech' } }), ['Tech']);

// ── The folders are taught by HER filing, never by the sorter's own ─────────
const ex = s.examplesFor(CHATS, cats);
is('witch is taught by the chats she put there', ex.witch,
  ['secretly A Witch app', 'witch-blog']);
is('the sorter\'s own answers never become the definition', ex.meta,
  ['chat-archive-labels-tags', 'archived-chats-section']);
is('a deleted chat teaches nothing', ex.stories, ['imprint']);
is('an empty folder has no examples', ex.xi, []);

// ── Rule 1: her filing is final ─────────────────────────────────────────────
const many = { messages: 40 };
is('a chat SHE filed is never re-sorted',
  s.shouldAutoSort({ category: 'stories' }, many).why, 'hers');
is('…and explicitly hers is just as final',
  s.shouldAutoSort({ category: 'stories', catBy: 'sophie' }, many).why, 'hers');
is('a chat the sorter just filed is left alone too',
  s.shouldAutoSort({ category: 'meta', catBy: 'auto', catSortedAt: new Date().toISOString() },
    many).why, 'already-sorted');
ok('an unfiled chat with a real thread is sortable', s.shouldAutoSort({}, many).sort);

// ── When a filed chat is looked at again (Sophie: "how often would a chat
// need to be refiled once it's filed … maybe it could ask again") ───────────
// The risk is a chat filed EARLY: 3 messages in it looks like whatever it
// opened with. So the signal is growth, not a clock.
const NOW = Date.UTC(2026, 7, 15, 12);
const ago = (days) => new Date(NOW - days * 86400 * 1000).toISOString();
const filed = (days, msgs) => ({ category: 'meta', catBy: 'auto', catSortedAt: ago(days), catMsgs: msgs });

is('filed yesterday, not re-asked however much it grew',
  s.shouldAutoSort(filed(1, 4), { messages: 500, now: NOW }).why, 'already-sorted');
is('a week on but barely grown, still left alone',
  s.shouldAutoSort(filed(9, 40), { messages: 55, now: NOW }).why, 'not-grown');
is('a week on and tripled, looked at again',
  s.shouldAutoSort(filed(9, 40), { messages: 130, now: NOW }).why, 're-sort');
// The floor: tripling 4 messages is 12, which is still nothing to judge on.
is('a thin early filing does not re-ask at 3x alone',
  s.shouldAutoSort(filed(9, 4), { messages: 12, now: NOW }).why, 'not-grown');
ok('…but it does once there is real material',
  s.shouldAutoSort(filed(9, 4), { messages: 26, now: NOW }).sort);

// A wrap-up is the best description of a chat that will ever exist, and it
// means the work is finished — so it reopens the question immediately, once.
is('a wrap-up written after the filing reopens it, rest period or not',
  s.shouldAutoSort({ ...filed(1, 400), wrapUpAt: ago(0) }, { messages: 401, now: NOW }).why,
  'wrapped-up');
is('a wrap-up written BEFORE the filing is old news',
  s.shouldAutoSort({ ...filed(1, 400), wrapUpAt: ago(30) }, { messages: 401, now: NOW }).why,
  'already-sorted');

// And the rule that outranks all of it: a chat SHE filed is never revisited,
// however old, however much it grew, wrap-up or no.
is('her filing is never re-checked on age',
  s.shouldAutoSort({ category: 'stories', catBy: 'sophie', catSortedAt: ago(400), catMsgs: 1 },
    { messages: 900, now: NOW }).why, 'hers');
is('…nor on a wrap-up',
  s.shouldAutoSort({ category: 'stories', wrapUpAt: ago(0), catSortedAt: ago(400) },
    { messages: 900, now: NOW }).why, 'hers');

// ── Rule 2: "none" locks nothing, but it does rest ──────────────────────────
const t = (h) => new Date(Date.UTC(2026, 7, 15, 12) - h * 3600 * 1000).toISOString();
is('asked an hour ago, not asked again',
  s.shouldAutoSort({ catTriedAt: t(1) },
    { ...many, now: Date.UTC(2026, 7, 15, 12) }).why, 'cooling-off');
ok('asked yesterday, asked again',
  s.shouldAutoSort({ catTriedAt: t(25) },
    { ...many, now: Date.UTC(2026, 7, 15, 12) }).sort);
is('a thin thread is not about anything yet',
  s.shouldAutoSort({}, { messages: 2 }).why, 'too-thin');

// The rows she is not looking at, and the kill switch.
is('a deleted chat is never sorted', s.shouldAutoSort({ deletedAt: t(1) }, many).why, 'deleted');
is('an archived chat is finished', s.shouldAutoSort({ archived: true }, many).why, 'archived');
is('the off switch stops everything',
  s.shouldAutoSort({}, { ...many, enabled: false }).why, 'off');

// ── Rule 3: never invent a folder ───────────────────────────────────────────
is('her spelling comes back, not the model\'s', s.pickCategory({ category: 'Meta' }, cats), 'meta');
is('whitespace is forgiven', s.pickCategory({ category: '  witch \n' }, cats), 'witch');
is('none is empty', s.pickCategory({ category: 'none' }, cats), '');
is('a folder she does not have is refused', s.pickCategory({ category: 'dreams' }, cats), '');
is('a triage folder can never be picked', s.pickCategory({ category: 'come back to' }, cats), '');
is('no answer at all is empty', s.pickCategory(null, cats), '');
is('a bare string still reads', s.pickCategory('tech', cats), 'tech');

// ── The filedAt stamp — the reply that triggered the sort must still show ───
// A live sort runs at the END of a turn. Stamped NOW, the chat would file
// itself the instant it finished answering her and drop off the main list with
// the answer inside it. Stamped at her last message, the reply is newer than
// the filing and the app pops the chat straight back out — in the folder AND
// on the list, which is the round trip she designed for manual filing.
const HER = '2026-08-15T18:00:00.000Z';
const REPLY = '2026-08-15T18:04:00.000Z';
const stamp = s.filedStamp({ lastHerAt: HER });
is('filed as of when she last spoke', stamp, HER);
ok('so the reply it just wrote still pops the chat back out', REPLY > stamp);
ok('a chat she has never spoken in is filed before everything',
  s.filedStamp({}) < REPLY);
ok('…and that stamp is a real one, never an empty field', s.filedStamp({}).length > 10);

// ── The prompt carries what it needs, and only what it needs ────────────────
const msgs = [
  { from: 'sophie', text: 'can you make the archive rows show a summary' },
  { from: 'claude', text: 'built the wrap-up freeze' },
  { from: 'claude', text: 'x'.repeat(5000) },
  { from: 'sophie', text: 'the tags should be fixed vocabulary' },
  { from: 'claude', text: 'shipped the tag chips' },
];
const p = s.buildSortPrompt({
  name: 'archive-tags',
  reg: { displayName: 'archive tags', sophieNote: 'chats app stuff', statusDoing: 'tag chips' },
  msgs, cats, examples: ex,
});
ok('the folders are listed', /- meta —/.test(p.user));
ok('each folder is taught by her own chats', /secretly A Witch app/.test(p.user));
ok('an empty folder says so rather than pretending', /not filed anything here yet/.test(p.user));
ok('her note is in there — it is what she calls the thing', /chats app stuff/.test(p.user));
ok('the status card rides along', /tag chips/.test(p.user));
ok('the opening of the thread is there', /archive rows show a summary/.test(p.user));
ok('and the closing', /shipped the tag chips/.test(p.user));
ok('but not the whole long middle', p.user.length < 3000);
ok('the model is told none is the ordinary answer', /Answer "none" whenever it is not clear/.test(p.system));

// The digest must survive junk without throwing — it runs over real threads.
is('an empty thread digests to nothing', s.digestOf([]), '');
is('a message with no text is skipped', s.digestOf([{ from: 'claude' }]), '');
ok('a huge thread is capped', s.digestOf(
  Array.from({ length: 400 }, (_, i) => ({ from: 'claude', text: 'line ' + i + ' '.repeat(50) }))
).length <= 4000);

if (fails.length) {
  console.error(`\n${fails.length} FAILED (${pass} passed)\n`);
  for (const f of fails) console.error('  ✗ ' + f + '\n');
  process.exit(1);
}
console.log(`chat sort: ${pass} checks passed`);
