#!/usr/bin/env node
// THE ORDER SHE TYPED THEM COMES FIRST (Aug 2026, Sophie: "typing `maybe
// never` finds … the chats where those words appear in the same order as typed
// should appear at the top and the ones where they appear anywhere should
// appear underneath").
//
// Bare words AND anywhere in the message, in any order — that is the grammar,
// and it is what she asked for. So this changes NOTHING about which messages
// come back; it only orders them. Her real search is the fixture: `maybe never`
// was answering with "maybe $3-5 a month" above the message that actually says
// "maybe never", and quoting it to fix that is a tax on every multi-word search.
//
// Pure — no network, no browser, no Firestore.
//
//   node scripts/test-search-order-rank.js
const { compileQuery, queryMatches, rankGroups, phraseRegex, orderRank } = require('../chatfeed.js');

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
  return orderRank(text, pos, phraseRegex(pos));
}
// The route's own sort, so the assertions are about the ORDER she sees.
function order(q, msgs) {
  const groups = compileQuery(q);
  const pos = rankGroups(groups);
  const phraseRe = pos.length > 1 ? phraseRegex(pos) : null;
  return msgs
    .filter((m) => queryMatches(m.text, groups))
    .map((m) => ({ m, rank: pos.length > 1 ? orderRank(m.text, pos, phraseRe) : 0 }))
    .sort((a, b) => a.rank - b.rank
      || (a.m.created < b.m.created ? 1 : a.m.created > b.m.created ? -1 : 0))
    .map((r) => r.m.id);
}

// ---- 1. the three tiers -------------------------------------------------
is('the phrase, adjacent and in her order', rank('maybe never', 'so "maybe never" drops it out'), 0);
is('in her order, words in between', rank('maybe never', 'maybe you will never know'), 1);
is('her words, the other way round', rank('maybe never', 'never mind. Or maybe not'), 2);

// ---- 2. HER ACTUAL SEARCH, ordered --------------------------------------
// The five results from her screenshot, newest first as the old sort left
// them: the message that literally says "maybe never" was FIFTH.
const HERS = [
  { id: 'dream-feed', created: '2026-08-19T08:00:00Z',
    text: 'your ~39 builds a day to ~24 at most, saving maybe $3-5 a month, but every chat needs it' },
  { id: 'dreams-ui', created: '2026-08-18T21:00:00Z',
    text: 'should take me back to the feed, I guess. Or maybe not. Never mind. Actually, yeah' },
  { id: 'pill-ad', created: '2026-08-18T16:00:00Z',
    text: 'so I do not know why it would be low quality. Maybe you just made it that way, never mind' },
  { id: 'date-moments', created: '2026-08-17T12:00:00Z',
    text: 'original discussion which was about dreams and maybe cats, never two phones' },
  { id: 'update-button', created: '2026-08-16T12:00:00Z',
    text: 'starred lift a chat, "come back to" sinks it, "maybe never" drops it out' },
  { id: 'backwards', created: '2026-08-19T09:00:00Z',
    text: 'never again, and maybe not even then' },
];
// `dream-feed` carries "maybe" and no "never", so it was never a hit at all —
// the top result on her screenshot came from the OLD sort being nothing but
// recency. `backwards` is the newest message here and has both words the wrong
// way round, which is the tier that has to sink.
is('the phrase leads, then her order, then the wrong order — newest-first inside each',
  order('maybe never', HERS),
  ['update-button', 'dreams-ui', 'pill-ad', 'date-moments', 'backwards']);
is('nothing was filtered out — only reordered',
  order('maybe never', HERS).length,
  HERS.filter((m) => /maybe/i.test(m.text) && /never/i.test(m.text)).length);
// What the OLD sort did with the same five, so this file says out loud what
// regressing would look like: recency alone, and the one message that actually
// says "maybe never" comes LAST.
const byRecency = HERS
  .filter((m) => queryMatches(m.text, compileQuery('maybe never')))
  .sort((a, b) => (a.created < b.created ? 1 : -1)).map((m) => m.id);
is('the old sort really did bury it (recency only)',
  byRecency, ['backwards', 'dreams-ui', 'pill-ad', 'date-moments', 'update-button']);

// ---- 3. the adjacent pair further along still wins ----------------------
// The left-to-right walk takes the earliest "maybe" and would call this tier 1.
// The phrase regex is a separate pass for exactly this message.
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
  rank('tag:film never', 'a film, and never'), 2);

// ---- 6. it cannot change what matches ----------------------------------
const groups = compileQuery('maybe never');
is('a message missing a word is not a hit at any rank',
  queryMatches('maybe so', groups), false);
is('a prefix still matches at a word start — the house rule, unchanged',
  queryMatches('maybe nevertheless', compileQuery('maybe never')), true);
is('aries still does not match inside boundaries',
  queryMatches('the boundaries here', compileQuery('aries')), false);

if (!failed) console.log('PASS: her order ranks first — phrase, then in-order, then anywhere; nothing is filtered');
process.exit(failed ? 1 : 0);
