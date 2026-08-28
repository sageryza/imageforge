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
// "Leave unfiled" is an ANSWER, and the category field cannot hold it — an
// empty folder looks identical to never having been asked.
is('she said leave it unfiled, so it stays unfiled',
  s.shouldAutoSort({ catNone: true }, many).why, 'hers-unfiled');

// ── When a filed chat is looked at again ────────────────────────────────────
// A tag names the chat's NEWEST work now that the vocabulary is mostly kinds
// (bug fix · new feature), and a kind turns over in hours — the week-long rest
// let an active chat wear yesterday's tag for six more days (2026-08-28, found
// live: "none of my recent bug fix chats are in that tab"). So: a day's rest
// AND eight new messages, both, before a re-ask.
const NOW = Date.UTC(2026, 7, 15, 12);
const ago = (days) => new Date(NOW - days * 86400 * 1000).toISOString();
const filed = (days, msgs) => ({ category: 'meta', catBy: 'auto', catSortedAt: ago(days), catMsgs: msgs });

is('sorted an hour ago, not re-asked however much it grew',
  s.shouldAutoSort(filed(1 / 24, 4), { messages: 500, now: NOW }).why, 'already-sorted');
is('a day on but barely grown, still left alone',
  s.shouldAutoSort(filed(1.5, 40), { messages: 45, now: NOW }).why, 'not-grown');
// …the feature chat that became a bug-fix chat overnight, her live case.
is('a day on and eight new messages, looked at again',
  s.shouldAutoSort(filed(1.5, 40), { messages: 48, now: NOW }).why, 're-sort');
ok('a thin early filing re-asks once there is real material',
  s.shouldAutoSort(filed(1.5, 4), { messages: 12, now: NOW }).sort);

// A wrap-up is the best description of a chat that will ever exist, and it
// means the work is finished — so it reopens the question immediately, once.
is('a wrap-up written after the filing reopens it, rest period or not',
  s.shouldAutoSort({ ...filed(1, 400), wrapUpAt: ago(0) }, { messages: 401, now: NOW }).why,
  'wrapped-up');
// The pin here is that the OLD wrap-up does not fire 'wrapped-up' — rest and
// growth answer for themselves.
is('a wrap-up written BEFORE the filing is old news',
  s.shouldAutoSort({ ...filed(1.5, 400), wrapUpAt: ago(30) }, { messages: 401, now: NOW }).why,
  'not-grown');

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

// ── WHAT THE WORK IS BEATS WHERE IT HAPPENED (2026-08-24, Sophie) ───────────
// "if it's in the story room but it's just a bug fix for the story room then
// they shouldn't tag it story, they should just tag it bug fix — and that
// applies to all the other categories obviously."
const KCATS = s.sortableCategories(
  { categories: ['story', 'witch', 'meta', 'bug fix', 'new feature', 'research',
    'to read', 'come back to'] }, {});
is('her kind words are marked, her subjects are not',
  s.workKinds(KCATS), ['bug fix', 'new feature', 'research']);
is('a WHEN word is never a kind', s.isWorkKind('to read'), false);
is('a subject is never a kind', s.isWorkKind('story'), false);

is('a bug fix in the Story Room files as a bug fix',
  s.pickCategory({ category: 'story', kind: 'bug fix' }, KCATS), 'bug fix');
is('…and the same in the witch app',
  s.pickCategory({ category: 'witch', kind: 'bug fix' }, KCATS), 'bug fix');
is('the subject wins when the work IS the subject',
  s.pickCategory({ category: 'story', kind: 'none' }, KCATS), 'story');
is('an old answer with no kind field at all is unchanged',
  s.pickCategory({ category: 'story' }, KCATS), 'story');
// The rule must not be invertible through its own slot: a SUBJECT answered as
// a kind is ignored, or the field built to beat subjects would carry one.
is('a subject smuggled into the kind slot is ignored',
  s.pickCategory({ category: 'bug fix', kind: 'story' }, KCATS), 'bug fix');
is('a kind she does not have is refused like any other invented folder',
  s.pickCategory({ category: 'story', kind: 'refactor' }, KCATS), 'story');
// Sure what it did, unsure where — "bug fix" is still the honest answer to the
// question that pile exists to answer.
is('a kind with no subject beside it still files',
  s.pickCategory({ category: 'none', kind: 'new feature' }, KCATS), 'new feature');

// The prompt has to SAY which is which, or the model is guessing.
const kp = s.buildSortPrompt({ name: 'x', reg: {}, msgs: [], cats: KCATS, examples: {} });
ok('the folder list marks the kinds', /- bug fix \[what the work IS\]/.test(kp.user));
ok('…and leaves the subjects alone', /- story —/.test(kp.user));
ok('the rule is stated in the system prompt', /BEATS WHERE IT HAPPENED/.test(kp.system));
ok('and the kind has its own field', /"kind"/.test(kp.system));

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

// ── Is this chat finished? (Sophie: "flag which ones should be archived") ───
// The question she forgot to answer OUTRANKS everything — that is the case she
// named first, and a finished feature with her question hanging in it is a chat
// to answer, not one to put away.
is('a question she never answered beats a finished feature',
  s.archiveHint({ state: 'done', pendingAsk: 'Want the long version?' }), 'needs you');
is('…and beats being mid-work too',
  s.archiveHint({ state: 'mid', pendingAsk: 'Which palette?' }), 'needs you');
is('built and settled, nothing owed → archive',
  s.archiveHint({ state: 'done', pendingAsk: '' }), 'archive');
is('it stopped on something that could not be done',
  s.archiveHint({ state: 'blocked', pendingAsk: '' }), 'dead end');
is('still in the middle → keep', s.archiveHint({ state: 'mid', pendingAsk: '' }), 'keep');

// ── The question SHE forgot to answer — the chat asked, she never came back ──
// The first version looked for questions of HERS with no reply and flagged 0
// of 86 chats: a chat always answers, so that pairing can only come up empty.
// Her sentence is the other direction, and it is provable — her answer would
// be a message from her AFTER the question.
const ask = (msgs) => s.pendingAsk(msgs);
is('the chat asked and she never came back',
  ask([{ from: 'sophie', text: 'do it' },
       { from: 'claude', text: 'Shipped it. Want me to run the backfill too?' }]),
  'Want me to run the backfill too?');
is('she answered, so nothing is owed',
  ask([{ from: 'claude', text: 'Want me to run it?' }, { from: 'sophie', text: 'yes go' }]), '');
is('a finished report with no question owes nothing',
  ask([{ from: 'sophie', text: 'hi' }, { from: 'claude', text: 'Shipped it and merged.' }]), '');
is('a draft has not asked her anything yet',
  ask([{ from: 'sophie', text: 'hi' },
       { from: 'claude', text: 'Should I use A or B?', working: true }]), '');
// isQuestion is tuned for HER dictation, which often carries no "?" — so a
// leading auxiliary is enough there and "Did all the work here." trips it.
// A chat writes markdown and always punctuates.
is('a chat sentence that merely opens with "did" is not an ask',
  ask([{ from: 'sophie', text: 'go' }, { from: 'claude', text: 'Did all the work here.' }]), '');
// Only the CLOSING counts: a question buried above a wall of work narration is
// something it already answered itself, not something she owes.
is('a question far above the closing is not owed',
  ask([{ from: 'sophie', text: 'go' },
       { from: 'claude', text: 'Should I use A?  ' + 'x'.repeat(2000) + '  All done.' }]), '');
// `tail` is a raw offset and lands mid-word, so the split is by sentence.
is('the closing boundary never cuts a question in half',
  ask([{ from: 'sophie', text: 'hi' },
       { from: 'claude', text: 'Which one do you want?  ...work...  Ready for the next batch?', tail: 38 }]),
  'Ready for the next batch?');
is('an empty thread owes nothing', ask([]), '');
// A url's query string ends in "?" and splits off as its own sentence — three
// of the first fourteen live flags were exactly this.
is('a url is not a question',
  ask([{ from: 'sophie', text: 'go' },
       { from: 'claude', text: 'Filed it. See https://imageforge-q125.onrender.com/news/?' }]), '');
is('nothing known at all is not an invitation to archive', s.archiveHint({}), 'keep');

// An unreadable or missing state must never read as "done" — that is the value
// that would send a live chat to the archive pile.
is('a state the model invented falls back to mid', s.pickState({ state: 'finished' }), 'mid');
is('no state at all falls back to mid', s.pickState({}), 'mid');
is('a real state reads', s.pickState({ state: 'BLOCKED' }), 'blocked');

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
ok('a folder she just made is offered by name, never suppressed',
  /a new folder, nothing filed in it yet/.test(p.user));
ok('the model is asked whether the work finished', /"state"/.test(p.system));
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
