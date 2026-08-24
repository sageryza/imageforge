#!/usr/bin/env node
// HOW THE SEARCH ORDERS WHAT IT FOUND — two tiers, one row per chat.
//
// Sophie, 2026-08-19: "also i noticed typing: maybe never finds / The chats
// were those words appear in the same order as typed should appear at the top
// and the ones where they appear anywhere should appear underneath."
//
// That sentence describes TWO buckets. It shipped on 2026-08-21 as THREE,
// because the build read "in the same order as typed" as a rung of its own,
// separate from the phrase — so "maybe you'll never" was lifted above a newer,
// plainer message. She retired that middle rung on 2026-08-24: "you mentioned
// if it's there but there are words between it vs. different order. that's
// stupid … only if no words moves it up."
//
// And the same day: "if the same word is found in the same chat, only show the
// most recent result" — one row per chat, so a chat that has said her word
// twenty times stops filling the whole first screen with itself.
//
// Pure — no network, no browser, no Firestore.
//
//   node scripts/test-search-rank.js
const {
  compileQuery, queryMatches, rankGroups, phraseRegex, phraseRank, bestPerChat,
} = require('../chatfeed.js');

let failed = 0;
const is = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { console.error(`FAIL: ${label}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); failed++; }
};

// The one function under test, as the route calls it.
function rank(q, text) {
  const groups = compileQuery(q);
  const pos = rankGroups(groups);
  if (pos.length < 2) return 0;
  return phraseRank(text, phraseRegex(pos));
}
// The route's own pipeline, so the assertions are about the ORDER she sees.
function order(q, msgs) {
  const groups = compileQuery(q);
  const pos = rankGroups(groups);
  const phraseRe = pos.length > 1 ? phraseRegex(pos) : null;
  const ranked = msgs
    .filter((m) => queryMatches(m.text, groups))
    .map((m) => ({ m, rank: phraseRe ? phraseRank(m.text, phraseRe) : 0 }));
  return ranked
    .sort((a, b) => a.rank - b.rank
      || (a.m.created < b.m.created ? 1 : a.m.created > b.m.created ? -1 : 0))
    .map((r) => r.m.id);
}
// …and with the per-chat dedupe in, which is what the route actually serves.
function rows(q, msgs) {
  const groups = compileQuery(q);
  const pos = rankGroups(groups);
  const phraseRe = pos.length > 1 ? phraseRegex(pos) : null;
  const ranked = msgs
    .filter((m) => queryMatches(m.text, groups))
    .map((m) => ({ m, rank: phraseRe ? phraseRank(m.text, phraseRe) : 0 }));
  return bestPerChat(ranked)
    .sort((a, b) => a.rank - b.rank
      || (a.m.created < b.m.created ? 1 : a.m.created > b.m.created ? -1 : 0))
    .map((r) => r.m.id);
}

// ---- 1. TWO tiers, and only adjacency lifts -----------------------------
is('the phrase, adjacent and in her order', rank('maybe never', 'so "maybe never" drops it out'), 0);
// THE RETIRED RUNG. Both of these used to be tiers 1 and 2; they are one tier
// now, and neither jumps ahead of a newer message.
is('in her order with words between is NOT lifted', rank('maybe never', 'maybe you will never know'), 1);
is('her words the other way round is the same tier', rank('maybe never', 'never mind. Or maybe not'), 1);

// ---- 2. HER ACTUAL SEARCH, ordered --------------------------------------
// The five results from her screenshot. The message that literally says
// "maybe never" was FIFTH under the old recency-only sort.
const HERS = [
  { id: 'dream-feed', chat: 'a', created: '2026-08-19T08:00:00Z',
    text: 'your ~39 builds a day to ~24 at most, saving maybe $3-5 a month, but every chat needs it' },
  { id: 'dreams-ui', chat: 'b', created: '2026-08-18T21:00:00Z',
    text: 'should take me back to the feed, I guess. Or maybe not. Never mind. Actually, yeah' },
  { id: 'pill-ad', chat: 'c', created: '2026-08-18T16:00:00Z',
    text: 'so I do not know why it would be low quality. Maybe you just made it that way, never mind' },
  { id: 'date-moments', chat: 'd', created: '2026-08-17T12:00:00Z',
    text: 'original discussion which was about dreams and maybe cats, never two phones' },
  { id: 'update-button', chat: 'e', created: '2026-08-16T12:00:00Z',
    text: 'starred lift a chat, "come back to" sinks it, "maybe never" drops it out' },
  { id: 'backwards', chat: 'f', created: '2026-08-19T09:00:00Z',
    text: 'never again, and maybe not even then' },
];
// `dream-feed` carries "maybe" and no "never", so it was never a hit at all.
// THE PHRASE STILL LEADS — that half is what she asked for and is untouched —
// and everything under it is now plain recency, so `backwards` (the newest of
// the rest) sits second instead of last.
is('the phrase leads, then newest-first, with no middle rung',
  order('maybe never', HERS),
  ['update-button', 'backwards', 'dreams-ui', 'pill-ad', 'date-moments']);
is('nothing was filtered out — only reordered',
  order('maybe never', HERS).length,
  HERS.filter((m) => /maybe/i.test(m.text) && /never/i.test(m.text)).length);
// What the OLD three-tier sort did, so this file says out loud what regressing
// would look like: `pill-ad` and `dreams-ui` scattered-in-order, lifted above
// the newer `backwards`.
is('the retired middle rung really did lift them',
  ['update-button', 'dreams-ui', 'pill-ad', 'backwards', 'date-moments'].join() !==
    order('maybe never', HERS).join(), true);

// ---- 3. the adjacent pair further along still wins ----------------------
// A left-to-right walk takes the earliest "maybe" and would miss this; the
// phrase regex is a separate pass for exactly this message.
is('a later adjacent pair is still the phrase',
  rank('maybe never', 'maybe so, and never mind, but maybe never in the end'), 0);

// ---- 4. one word, and quoting, are untouched ----------------------------
is('a single word has nothing to rank', rank('never', 'never mind, maybe'), 0);
is('a quoted phrase still ranks as the phrase', rank('"maybe never"', 'so maybe never happens'), 0);

// ---- 5. the operators keep working -------------------------------------
is('OR ranks on whichever side matched', rank('maybe OR perhaps never', 'perhaps never at all'), 0);
is('an excluded word does not join the phrase', rank('maybe never -blog', 'maybe never here'), 0);
// The chat feed defines NO fields, so `tag:film` is literal text by design (an
// unknown prefix is kept rather than silently dropped — search-grammar.js).
// The field guard in phraseRegex is there for the callers that do define them.
is('an unknown prefix stays literal and simply does not match a colon-free line',
  rank('tag:film never', 'a film, and never'), 1);

// ---- 6. ONE ROW PER CHAT ------------------------------------------------
// "if the same word is found in the same chat, only show the most recent
// result" — a chat that said her word twenty times used to fill the whole
// first screen with itself, pushing every other chat off the answer.
const REPEATS = [
  { id: 'loud-1', chat: 'loud', created: '2026-08-20T10:00:00Z', text: 'the image doc, again' },
  { id: 'loud-2', chat: 'loud', created: '2026-08-21T10:00:00Z', text: 'still the image doc' },
  { id: 'loud-3', chat: 'loud', created: '2026-08-22T10:00:00Z', text: 'one more about the image doc' },
  { id: 'quiet-1', chat: 'quiet', created: '2026-08-19T10:00:00Z', text: 'a single image doc mention' },
];
is('a chat gets ONE row, and it is its newest', rows('image doc', REPEATS), ['loud-3', 'quiet-1']);
is('and the quiet chat is no longer pushed off the answer',
  rows('image doc', REPEATS).includes('quiet-1'), true);
// Without the dedupe the loud chat owned three of the four rows.
is('the un-deduped list really was three-quarters one chat',
  order('image doc', REPEATS), ['loud-3', 'loud-2', 'loud-1', 'quiet-1']);

// THE ONE PLACE IT IS NOT SIMPLY "NEWEST": a chat holding the exact phrase in
// an older message and a loose scatter in a newer one keeps the phrase, because
// opening it on the newer row would land her on something that is not what she
// searched for. Everywhere else the tiers tie and this IS "most recent".
const MIXED = [
  { id: 'old-phrase', chat: 'one', created: '2026-08-10T10:00:00Z', text: 'so maybe never, then' },
  { id: 'new-loose', chat: 'one', created: '2026-08-22T10:00:00Z', text: 'never mind, maybe later' },
];
is('the exact phrase keeps the row over a newer loose match',
  rows('maybe never', MIXED), ['old-phrase']);
is('but with no phrase anywhere, it is simply the newest',
  rows('maybe never', MIXED.map((m) => ({ ...m, text: m.text.replace('maybe never', 'maybe or never') }))),
  ['new-loose']);

// bestPerChat on its own, including the shapes that must not throw.
is('an empty list is an empty list', bestPerChat([]), []);
is('a missing created still picks a winner rather than crashing',
  bestPerChat([
    { rank: 1, m: { chat: 'x', id: 'no-date' } },
    { rank: 1, m: { chat: 'x', id: 'dated', created: '2026-08-01T00:00:00Z' } },
  ]).map((r) => r.m.id), ['dated']);

// ---- 7. it cannot change what matches ----------------------------------
const groups = compileQuery('maybe never');
is('a message missing a word is not a hit at any rank',
  queryMatches('maybe so', groups), false);
is('a prefix still matches at a word start — the house rule, unchanged',
  queryMatches('maybe nevertheless', compileQuery('maybe never')), true);
is('aries still does not match inside boundaries',
  queryMatches('the boundaries here', compileQuery('aries')), false);

if (!failed) console.log('PASS: the phrase leads and nothing else jumps the queue; one row per chat, its newest');
process.exit(failed ? 1 : 0);
