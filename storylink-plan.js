// storylink-plan.js — the Story Link's pure half: deciding which of her rooms
// are looking at the SAME story, and what a pull or a re-order would do.
//
// It lives apart from storylink.js for the reason timeline-parse.js does:
// NOTHING IN HERE NEEDS A DEPENDENCY, so scripts/test-storylink.js drives the
// real matcher and the real planners in any checkout, with no express and no
// Firebase admin present. storylink.js re-exports everything here.
//
// See storylink.js's header for what a link is and why the rooms stay
// room-local. The two rules this file exists to keep honest:
//
//   A PLAN IS ALWAYS COMPUTED BEFORE IT IS APPLIED, and the same function
//   computes both — the dry run and the write cannot disagree about what is
//   about to happen, because there is one of them.
//
//   NOTHING HERE EVER PROPOSES A DELETE. `planPull` only ever adds, and
//   `planOrder` only ever permutes. A beat she made that matches nothing in
//   the timeline is reported as `extra` and left exactly where it is — the
//   counts across her rooms have drifted for real (measured 2026-08-26: "The
//   house" is 30 moments against 11 beats), and the drift is usually work,
//   not an error.

/* ------------------------------------------------------------- matching */

// Words that say which ROOM a copy lives in rather than which STORY it is.
// Her real titles across the three rooms are the source of these: "Spellcasting"
// / "Spellcasting VO", "PROOF — reel beats" / "PROOF — reel cut (no Nancy)".
// Dropping them is what lets those pairs find each other; keeping the
// distinctive nouns is what stops everything matching everything.
const ROOM_WORDS = new Set([
  'vo', 'voiceover', 'narration', 'cut', 'cuts', 'recut', 'precise',
  'beats', 'beat', 'timeline', 'story', 'pad', 'draft', 'final', 'copy',
  'version', 'take', 'edit', 'rough', 'the', 'and', 'for', 'a', 'an', 'of',
]);

function normTitle(s) {
  return String(s || '').toLowerCase()
    .replace(/[‘’“”]/g, '')      // smart quotes
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// A version tail — "v2", "v14" — is not part of the name.
const VERSION = /^v\d+$/;

function tokens(s) {
  const out = new Set();
  for (const w of normTitle(s).split(' ')) {
    if (!w || w.length < 2) continue;
    if (ROOM_WORDS.has(w)) continue;
    if (VERSION.test(w)) continue;
    out.add(w);
  }
  return out;
}

// JACCARD (intersection / UNION), never intersection/min — sync.js learned
// this against Etsy titles and the failure is the same shape here: the min
// denominator makes "Charlie" match "Charlie — as it used to be" AND every
// other story whose one distinctive word happens to be shared.
function similarity(a, b) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  const union = ta.size + tb.size - inter;
  return union ? inter / union : 0;
}

// A score of 1 means "the same story as far as the title can say" — the
// DISTINCTIVE words are identical, which covers both the five of her six
// timeline stories that carry their pad's title character for character AND
// the pairs that differ only by which room they live in ("Spellcasting" /
// "Spellcasting VO"). Telling those two cases apart with separate scores was
// tried and dropped: nothing consumes the difference, and the clamp it needed
// meant an exact match on room words scored 0.999 instead of 1.
const THRESHOLD = 0.5;

function score(a, b) {
  if (!normTitle(a) || !normTitle(b)) return 0;
  if (normTitle(a) === normTitle(b)) return 1;
  return similarity(a, b);
}

/**
 * Group the rooms' docs into candidate stories by title.
 *
 * `rooms` is { timeline:[{id,title}], pad:[…], blocks:[…] } — whatever subset
 * is present. Returns one entry per group that spans MORE THAN ONE ROOM,
 * because a story living in one room needs no link; a single-room group is a
 * story that simply has not been started anywhere else yet.
 *
 * Deliberately greedy and one-pass rather than clustered: a candidate is a
 * proposal Sophie confirms, so a near-miss costs her a tap, and a clever
 * clusterer that silently merges two of her stories costs her much more.
 */
function matchRooms(rooms, opts) {
  const min = (opts && typeof opts.threshold === 'number') ? opts.threshold : THRESHOLD;
  const order = ['timeline', 'pad', 'blocks'];
  const lead = (rooms && rooms.timeline && rooms.timeline.length) ? 'timeline' : null;
  // The timeline leads when there is one: its titles are the ones she dictated
  // the story under. With no timeline present the pads lead, then blocks.
  const anchorRoom = lead || order.find((r) => rooms && rooms[r] && rooms[r].length) || null;
  if (!anchorRoom) return [];

  const taken = {};                                     // room -> Set(docId)
  order.forEach((r) => { taken[r] = new Set(); });
  const groups = [];

  for (const anchor of (rooms[anchorRoom] || [])) {
    if (!anchor || !anchor.id) continue;
    if (taken[anchorRoom].has(anchor.id)) continue;
    const members = [{ room: anchorRoom, doc: anchor.id, title: anchor.title || '', score: 1 }];
    taken[anchorRoom].add(anchor.id);

    for (const room of order) {
      if (room === anchorRoom) continue;
      let best = null;
      for (const cand of (rooms[room] || [])) {
        if (!cand || !cand.id || taken[room].has(cand.id)) continue;
        const s = score(anchor.title, cand.title);
        if (s >= min && (!best || s > best.score)) best = { room, doc: cand.id, title: cand.title || '', score: s };
      }
      if (best) { taken[room].add(best.doc); members.push(best); }
    }

    if (members.length > 1) groups.push({ title: anchor.title || '', members });
  }
  return groups;
}

/* ------------------------------------------------------------- the pull */

// A beat carries `fromMoment` once a pull has brought it across. That one
// additive field is the whole join — nothing else about a beat changes, so a
// pad that has never been pulled into is byte-for-byte what it was.
function momentOrder(units, moments) {
  const seen = new Set();
  const out = [];
  for (const u of (units || [])) {
    for (const id of (Array.isArray(u) ? u : [u])) {
      const key = String(id);
      if (!key || seen.has(key)) continue;
      if (moments && !moments[key]) continue;           // a unit may name a deleted moment
      seen.add(key);
      out.push(key);
    }
  }
  // A moment in `moments` but in NO UNIT has been DELETED — that is exactly
  // what the Story Timeline's delete does (it drops the id out of `units` and
  // leaves the words behind so a mis-tap costs an undo, never her words). An
  // earlier cut of this file appended those last as "still hers", which would
  // have resurrected a line she had taken out: her Science story carries one
  // ("But here's where things get tricky."), found the first time this ran
  // against her real data. The arrangement is the story; `moments` is the
  // undo buffer behind it.
  return out;
}

function momentText(m) {
  if (m == null) return '';
  if (typeof m === 'string') return m;
  return String(m.text || m.words || '').trim();
}

/* ---- coverage: WHICH MOMENTS A BEAT IS ---------------------------------
   The join is `fromMoments`, an ARRAY, and that is the whole mechanism. The
   first cut of this file made it singular and it was wrong in a way that
   showed up immediately in her hands: a beat that is four moments joined got
   stamped with the FIRST of them, the other three were added as new beats,
   and the parent's caption went on carrying all four sentences — so her pad
   said the same words twice. Not cosmetic: `ttsFor` in scratchpad.js speaks
   `beat.text`, so a repeated caption is a repeated line in the film.

   A BEAT'S CAPTION IS DERIVED FROM THE MOMENTS IT COVERS, and derived is the
   fix — the house *nothing stands between the source and the output* rule.
   Split a beat's moments in the timeline and its coverage shrinks to what it
   still owns, its caption follows, and the freed moments become beats of
   their own. Nothing can drift because there is one source, and nothing is
   repeated because coverage is a partition: every moment sits under exactly
   one beat.

   HER OWN EDIT ALWAYS WINS, by the pad's own precedent (`drawablePrompt` /
   `promptFor`: a beat's prompt is stored as NOTHING while it still matches
   its words, so the beat keeps following them). A caption that is still
   exactly its moments' text is UNTOUCHED and may be re-derived; one she has
   reworded is hers, is never rewritten, and is reported instead. */

function normWords(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** The moment ids a beat covers. `fromMoment` is the legacy singular. */
function coverageOf(beat) {
  if (!beat) return [];
  if (Array.isArray(beat.fromMoments)) return beat.fromMoments.map(String).filter(Boolean);
  return beat.fromMoment ? [String(beat.fromMoment)] : [];
}

/** What a beat's caption SHOULD say for the moments it covers. */
function derivedText(ids, moments) {
  return (ids || [])
    .map((id) => momentText((moments || {})[id]))
    .filter(Boolean)
    .join(' ')
    .trim();
}

/** Has she reworded this caption, or is it still its moments' own text? */
function isDerived(beat, ids, moments) {
  return normWords(beat && beat.text) === normWords(derivedText(ids, moments));
}

/** How far ahead a beat may look for its moments. A line she has edited in
    one room leaves a hole, and without a lookahead the walk stalls on it and
    every beat after it fails too — measured on her Spellcasting pad, where ONE
    reworded moment cost the last SIX beats their match and would have added
    all six as duplicates. Bounded, because the two lists are the same story in
    the same order and a match found far away is more likely wrong than right. */
const LOOKAHEAD = 8;

/** Word-overlap of two passages, for telling an EDIT from a new line. */
function closeness(a, b) {
  const ta = new Set(normWords(a).split(' ').filter(Boolean));
  const tb = new Set(normWords(b).split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / (ta.size + tb.size - inter);
}
const DIVERGED = 0.6;

/** Try to consume a run of moments starting exactly at `from` whose joined
    text IS this beat's caption. Returns the run, or null. */
function runAt(want, order, moments, from) {
  let acc = '';
  const got = [];
  for (let i = from; i < order.length; i++) {
    const next = normWords(momentText(moments[order[i]]));
    if (!next) continue;
    const cand = acc ? `${acc} ${next}` : next;
    if (!want.startsWith(cand)) return null;
    acc = cand;
    got.push(order[i]);
    if (acc === want) return got;
  }
  return null;
}

/**
 * Align a pad's beats to a timeline's moments by their words — the FIRST pull
 * only, when no beat carries a coverage yet.
 *
 * ORDER-PRESERVING and greedy: the two lists are the same story in the same
 * order, so consuming them in step is both the cheapest rule and the one that
 * cannot cross-match two moments that happen to share their wording. A beat
 * that lines up with nothing within LOOKAHEAD matches NOTHING and does not
 * advance the walk — half a match would strand the moments it swallowed.
 */
function alignByText(order, moments, beats) {
  const held = new Map();
  let mi = 0;
  for (const b of beats) {
    if (!b || !b.id) continue;
    held.set(b.id, []);
    const want = normWords(b.text);
    if (!want) continue;
    const limit = Math.min(order.length, mi + LOOKAHEAD + 1);
    for (let from = mi; from < limit; from++) {
      const got = runAt(want, order, moments, from);
      if (got) { held.set(b.id, got); mi = order.indexOf(got[got.length - 1]) + 1; break; }
    }
  }
  return held;
}

/**
 * Is this beat's caption exactly a contiguous run of the timeline's moments
 * beginning at the moment it covers? Returns the run, or null when the words
 * are hers.
 */
function staleRun(beat, first, order, moments) {
  const at = order.indexOf(first);
  if (at < 0) return null;
  const want = normWords(beat && beat.text);
  if (!want) return null;
  let acc = '';
  const run = [];
  for (let i = at; i < order.length; i++) {
    const next = normWords(momentText(moments[order[i]]));
    if (!next) continue;
    const cand = acc ? `${acc} ${next}` : next;
    if (!want.startsWith(cand)) return null;
    acc = cand;
    run.push(order[i]);
    if (acc === want) return run;
  }
  return null;
}

/**
 * What a pull from a timeline into a pad would do.
 *
 *   seed    — beats to stamp with the coverage they already have. Words, art,
 *             colour and position untouched.
 *   keep    — of a split beat's moments, the one it goes on covering (its
 *             FIRST). The rest leave it and become beats of their own.
 *   retext  — captions to re-derive, because the beat no longer covers every
 *             moment its words are saying. `{beat, from, to}`. A caption she
 *             has reworded is NEVER in here.
 *   held    — captions that WOULD have been re-derived but are hers now, so a
 *             caller can say so rather than silently leaving a repeat.
 *   add     — moments with no beat, each inserted DIRECTLY AFTER the beat
 *             holding the moment before it. Never appended to the end: the
 *             three beats split out of a beat belong beside it, not twenty-
 *             five places away.
 *   extra   — beats covering no moment. Left exactly where they are.
 *
 * NOTHING IS EVER DELETED and no beat is ever moved.
 */
function planPull(story, beats) {
  const moments = (story && story.moments) || {};
  const units = (story && story.units) || [];
  const list = (Array.isArray(beats) ? beats : []).filter((b) => b && b.id);
  const order = momentOrder(units, moments);
  const live = new Set(order);

  // An existing coverage wins outright over a text match: once a beat is
  // joined, her caption is free to drift and a text match would quietly
  // disagree with the join that is on the doc.
  const held = new Map();
  const spoken = new Set();
  for (const b of list) {
    const cov = coverageOf(b).filter((id) => live.has(id));
    held.set(b.id, cov);
    cov.forEach((id) => spoken.add(id));
  }
  // The beats that carry NO coverage are still matched by their words —
  // against the moments no joined beat has claimed. A pad is very often part
  // joined and part not (a pull that was interrupted, or beats she added by
  // hand afterwards), and an all-or-nothing rule there proposed to add every
  // unjoined beat's moment a second time. Both lists keep their order with
  // the claimed entries removed from each side, so the greedy walk still
  // lines up.
  const loose = list.filter((b) => !(held.get(b.id) || []).length);
  if (loose.length) {
    const free = order.filter((id) => !spoken.has(id));
    for (const [id, got] of alignByText(free, moments, loose)) held.set(id, got);
  }

  // COVERAGE IS A PARTITION: a moment may sit under exactly one beat, so a
  // duplicate claim is dropped rather than allowed to render twice.
  const claimed = new Set();
  for (const b of list) {
    const cov = (held.get(b.id) || []).filter((id) => !claimed.has(id));
    cov.forEach((id) => claimed.add(id));
    held.set(b.id, cov);
  }

  const seed = [];
  const keep = [];
  const retext = [];
  const heldBack = [];
  const matched = [];
  const beatOf = new Map();

  for (const b of list) {
    const cov = held.get(b.id) || [];
    if (!cov.length) continue;
    const mine = [cov[0]];                             // what it goes on covering
    const freed = cov.slice(1);                        // split out into their own beats
    beatOf.set(cov[0], b.id);
    matched.push({ moment: cov[0], beat: b.id });

    const already = coverageOf(b);
    // Re-stamp when the ids differ OR when the beat still carries the LEGACY
    // singular `fromMoment` — otherwise a pad joined before coverage became
    // an array keeps that field for ever, and two spellings of the same fact
    // is exactly what this rewrite exists to end.
    const same = Array.isArray(b.fromMoments)
      && already.length === mine.length && already.every((x, i) => x === mine[i]);
    if (!same) seed.push({ beat: b.id, moments: mine.slice() });
    if (freed.length) keep.push({ beat: b.id, keeps: cov[0], frees: freed.slice() });

    // The caption has to stop saying the words that are other beats now.
    const want = derivedText(mine, moments);
    if (normWords(b.text) !== normWords(want)) {
      // A caption is STALE FROM A SPLIT when it is exactly a contiguous run of
      // the timeline's moments starting at the one this beat still covers —
      // whether the split happened just now or in an earlier pull that only
      // narrowed the coverage. Anything else is her own wording and is never
      // rewritten. Asking the question this way rather than "did I free
      // something in THIS plan" is what catches a beat left mid-migration:
      // the live pad had exactly two, and a plan that only looked at the
      // current split reported nothing to do while her pad still said the
      // same lines twice.
      const run = staleRun(b, cov[0], order, moments);
      if (run) retext.push({ beat: b.id, from: String(b.text || ''), to: want, was: run.slice() });
      else heldBack.push({ beat: b.id, text: String(b.text || ''), to: want });
    }
  }

  const add = [];
  let anchor = null;
  for (const id of order) {
    if (beatOf.has(id)) { anchor = beatOf.get(id); continue; }
    add.push({ moment: id, text: momentText(moments[id]), after: anchor });
  }

  const spare = list.filter((b) => !(held.get(b.id) || []).length);
  const extra = spare.map((b) => b.id);

  // DIVERGED: a moment with no beat that is nearly a beat she already has is
  // the SAME line edited in one room, not a new one — so adding it would put
  // two versions of one line in her pad, which is the repeat this rewrite
  // exists to end. It is reported for her to settle instead, because only she
  // knows which wording is the one she means. Measured on Spellcasting: one
  // moment reworded in the timeline against the pad's older copy of it.
  const diverged = [];
  const keptAdds = [];
  for (const a of add) {
    const near = spare
      .map((b) => ({ beat: b.id, text: String(b.text || ''), score: closeness(a.text, b.text) }))
      .filter((x) => x.score >= DIVERGED)
      .sort((x, y) => y.score - x.score)[0];
    if (near) diverged.push({ moment: a.moment, text: a.text, beat: near.beat, beatText: near.text, score: near.score });
    else keptAdds.push(a);
  }

  return { seed, keep, retext, heldBack, add: keptAdds, diverged, matched, extra };
}

/**
 * Apply a plan's `add` list to a beat array, using a caller-supplied factory
 * for the new beat (the router mints Firestore ids; the test uses its own).
 * PURE and additive: the existing objects are never touched, and every one of
 * them comes out.
 *
 * Insertion is anchored to the beat id, resolved against the CURRENT array, so
 * a beat added between the plan and the write cannot shift anything into the
 * wrong place.
 */
function applyAdds(beats, add, make) {
  const out = (Array.isArray(beats) ? beats : []).slice();
  // Group by anchor, keeping each group in the timeline's own order, then
  // splice each group in one go — inserting one at a time would reverse them.
  const groups = new Map();
  for (const a of (add || [])) {
    const key = a.after || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }
  for (const [key, items] of groups) {
    const made = items.map((a) => make(a));
    if (!key) { out.unshift(...made); continue; }
    const at = out.findIndex((b) => b && b.id === key);
    if (at < 0) out.push(...made);                     // anchor gone: the end is honest
    else out.splice(at + 1, 0, ...made);
  }
  return out;
}

/* ---------------------------------------------------------- the re-order */

/**
 * The timeline's order applied to the beats that came from it. PERMUTES ONLY —
 * every beat in, every beat out, nothing added and nothing dropped.
 *
 * AN UNLINKED BEAT RIDES WITH THE LINKED BEAT ABOVE IT. That is the rule that
 * makes this safe to tap: a picture she added by hand between two moments is
 * about the moment it follows, so it travels with it rather than being
 * stranded at one end of the pad. Beats before the first linked one keep the
 * front of the pad.
 *
 * Returns the new array of beats (the same objects, re-ordered).
 */
function planOrder(story, beats) {
  const moments = (story && story.moments) || {};
  const units = (story && story.units) || [];
  const list = Array.isArray(beats) ? beats : [];

  const rank = new Map();
  momentOrder(units, moments).forEach((id, i) => rank.set(id, i));

  const head = [];                                      // before any linked beat
  const groups = [];                                    // { beat, rank, trail:[] }
  let cur = null;
  for (const b of list) {
    const from = coverageOf(b)[0] || '';
    if (from && rank.has(from)) {
      cur = { beat: b, rank: rank.get(from), trail: [] };
      groups.push(cur);
    } else if (cur) cur.trail.push(b);
    else head.push(b);
  }

  // Stable by rank: two beats pulled from one moment (only possible if a doc
  // was edited by hand) keep the order the pad already had.
  groups.sort((a, b) => (a.rank - b.rank));

  const out = head.slice();
  for (const g of groups) { out.push(g.beat); for (const t of g.trail) out.push(t); }
  return out;
}

/** Did a re-order actually change anything? Cheap, so a no-op can say so. */
function sameOrder(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if ((a[i] && a[i].id) !== (b[i] && b[i].id)) return false;
  }
  return true;
}

module.exports = {
  normTitle, tokens, similarity, score, matchRooms,
  momentOrder, momentText, normWords, coverageOf, derivedText, isDerived,
  alignByText, staleRun, closeness, runAt, planPull, applyAdds,
  planOrder, sameOrder, LOOKAHEAD, DIVERGED,
  ROOM_WORDS, THRESHOLD,
};
