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

/* ---- seeding: what a pad's EXISTING beats already are -------------------
   A `fromMoment` only exists once a pull has run, so the FIRST pull into a pad
   she has been working in by hand has nothing to join on — and a pull that
   joins on nothing proposes to add every moment, i.e. to write her whole story
   into the pad a second time. Found before it ever ran, against her real
   "Reflections on Science and Belief": 31 moments, 27 beats, not one of them
   linked, and every one of the 27 already saying what a moment says.

   So the first pull READS THE WORDS. Walking both lists in order, a beat is
   matched to the run of moments whose text it is — which also finds the thing
   she actually asked for: a beat that is SEVERAL moments joined together is a
   beat she has since split in the timeline, and its extra moments are the
   beats she wants to put pictures on.

   Deliberately ORDER-PRESERVING and greedy rather than a fuzzy best-match:
   these two lists are the same story in the same order, so consuming them in
   step is both the cheapest rule and the one that cannot cross-match two
   moments that happen to share their wording. A beat that does not line up
   simply goes unmatched, which is the safe direction — it stays exactly where
   it is and nothing is added on its behalf. */

function normWords(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Align a pad's beats to a timeline's moments by their words.
 * Returns a Map of beat id → [moment ids it already holds], in order.
 */
function alignByText(order, moments, beats) {
  const held = new Map();
  let mi = 0;
  for (const b of beats) {
    if (!b || !b.id) continue;
    const want = normWords(b.text);
    held.set(b.id, []);
    if (!want) continue;
    let acc = '';
    const got = [];
    while (mi < order.length) {
      const next = normWords(momentText(moments[order[mi]]));
      if (!next) { mi++; continue; }
      const cand = acc ? `${acc} ${next}` : next;
      if (!want.startsWith(cand)) break;
      acc = cand;
      got.push(order[mi]);
      mi++;
      if (acc === want) break;
    }
    // Only a WHOLE beat counts. A partial consume means the two lists have
    // drifted apart here, and half a match is worse than none: it would strand
    // the moments it swallowed and add the rest in the wrong place.
    if (acc === want && got.length) held.set(b.id, got);
    else mi -= got.length;
  }
  return held;
}

/**
 * What a pull from a timeline into a pad would do. ADDITIVE ONLY.
 *
 *   seed    — existing beats to stamp with the moment they already are. Their
 *             words, art, colour and position are untouched; `fromMoment` is
 *             the one field written, so a pad is joined to its timeline
 *             without a single visible change.
 *   add     — moments with no beat. Each becomes an EMPTY beat carrying the
 *             moment's words, inserted DIRECTLY AFTER the beat holding the
 *             moment before it (`after`) — never appended to the end. That is
 *             the whole point when a beat has been split in the timeline: the
 *             three new beats belong beside the one they came out of, not
 *             twenty-five places away where she would have to walk them back.
 *   split   — beats holding more than one moment, i.e. exactly the beats she
 *             has separated in the timeline since. Reported so a caller can
 *             say so; the beat itself is never reworded.
 *   matched — moments that already have a beat of their own.
 *   extra   — beats matching no moment. Left exactly where they are.
 */
function planPull(story, beats) {
  const moments = (story && story.moments) || {};
  const units = (story && story.units) || [];
  const list = (Array.isArray(beats) ? beats : []).filter((b) => b && b.id);
  const order = momentOrder(units, moments);

  // Already-linked beats win outright: once a pull has stamped a beat, her
  // caption is free to drift from the moment's words and a text match would
  // quietly disagree with the join that is on the doc.
  const held = new Map();
  const claimed = new Set();
  let anyLink = false;
  for (const b of list) {
    const from = b.fromMoment ? String(b.fromMoment) : '';
    if (from) anyLink = true;
    held.set(b.id, from && moments[from] ? [from] : []);
    if (from && moments[from]) claimed.add(from);
  }
  if (!anyLink) {
    const text = alignByText(order, moments, list);
    for (const [id, got] of text) {
      held.set(id, got);
      for (const g of got) claimed.add(g);
    }
  }

  const seed = [];
  const split = [];
  const matched = [];
  const beatOf = new Map();                            // moment id → beat id
  for (const b of list) {
    const got = held.get(b.id) || [];
    if (!got.length) continue;
    beatOf.set(got[0], b.id);
    if (!b.fromMoment) seed.push({ beat: b.id, moment: got[0] });
    matched.push({ moment: got[0], beat: b.id });
    if (got.length > 1) split.push({ beat: b.id, moments: got.slice(), keeps: got[0] });
  }

  // Walk the timeline's order; anything with no beat of its own is added, and
  // its anchor is the beat carrying the nearest moment BEFORE it.
  const add = [];
  let anchor = null;
  for (const id of order) {
    if (beatOf.has(id)) { anchor = beatOf.get(id); continue; }
    // A moment swallowed by a split beat anchors the ones after it too, so a
    // run of three splits out in its own order rather than reversed.
    add.push({ moment: id, text: momentText(moments[id]), after: anchor });
  }

  const extra = list.filter((b) => !(held.get(b.id) || []).length).map((b) => b.id);
  return { seed, add, split, matched, extra };
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
    const from = b && b.fromMoment ? String(b.fromMoment) : '';
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
  momentOrder, momentText, normWords, alignByText, planPull, applyAdds,
  planOrder, sameOrder,
  ROOM_WORDS, THRESHOLD,
};
