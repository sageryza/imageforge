// search-grammar.js — the ONE query grammar every search box in this app speaks.
//
// Sophie's ask (Aug 2026): "sometimes I want to narrow it down by finding two
// words I know were in the same message but aren't in any other message, but
// one of the words might appear tons of times." A box that treats everything
// typed into it as one literal phrase cannot answer that — `witch keywords`
// only ever found the two words back to back — so every box speaks a small
// boolean grammar instead:
//
//   witch keywords     → BOTH words, anywhere in the message, in any order
//   witch OR spell     → either one
//   witch -blog        → witch, but not where blog also appears
//   "book of shadows"  → the phrase, whole, words adjacent (the old behaviour)
//   tag:movie          → a named field, where the calling module defines fields
//
// OR binds tighter than the implicit AND (`a b OR c` = a AND (b OR c)) — the
// convention every search box she already uses follows. There are deliberately
// no parentheses: a search bar on a phone is not a place to balance brackets,
// and every query she has described is expressible without them.
//
// THIS MODULE PARSES ONLY. Matching stays with each caller, because they
// disagree about what a match is and both are right: the clip library
// normalises to lowercase alphanumerics and matches substrings (a few hundred
// short records, where her punctuation should never decide a hit), while the
// chat feed anchors each term at a word START against raw text — so "aries"
// still does not find "boundaries", and a term like `gpt-image-2` survives
// with its hyphens intact.

// The default term cleaner: case and runs of whitespace flattened, everything
// else kept. A caller with its own idea of sameness passes `normalize`.
const plain = (s) => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();

// Parse a query into AND-ed groups of OR-ed terms, plus negations. Each group
// is `{ neg, terms:[{ field, value, phrase }] }`; a message matches when every
// positive group has at least one matching term and no negative group matches.
//
// `fields` maps a typed prefix to a field name ({ tag:'tag', from:'source' });
// an unknown prefix is NOT a field and is kept as literal text, so a stray
// colon never silently deletes half of what she typed.
function parseQuery(q, opts = {}) {
  const fields = opts.fields || {};
  const normalize = opts.normalize || plain;
  const groups = [];
  const re = /(-|!)?(?:([a-zA-Z]+):)?(?:"([^"]*)"|(\S+))/g;
  let pendingOr = false;
  let pendingNot = false;
  let m;
  while ((m = re.exec(String(q || '')))) {
    const quoted = m[3] !== undefined;
    const raw = quoted ? m[3] : m[4];
    const bare = !m[1] && !m[2] && !quoted;
    if (bare && /^or$/i.test(raw)) { pendingOr = true; continue; }
    if (bare && /^and$/i.test(raw)) { continue; }
    if (bare && /^not$/i.test(raw)) { pendingNot = true; continue; }
    const value = normalize(raw);
    if (!value) continue;
    const term = {
      field: m[2] ? (fields[m[2].toLowerCase()] || '') : '',
      value,
      phrase: quoted,
    };
    if (m[2] && !fields[m[2].toLowerCase()]) term.value = normalize(`${m[2]} ${raw}`);
    const neg = !!m[1] || pendingNot;
    const last = groups[groups.length - 1];
    if (pendingOr && last && !last.neg && !neg) last.terms.push(term);
    else groups.push({ neg, terms: [term] });
    pendingOr = false;
    pendingNot = false;
  }
  return groups;
}

// ── THE FEED'S MATCHER ──────────────────────────────────────────────────────
// This module parses only, BECAUSE its callers disagree about what a match is
// (see the header) — but three of them agree exactly: the chat feed, the
// Playground and Panels all anchor each term at a word START against raw text,
// so "aries" never finds "boundaries" and `gpt-image-2` keeps its hyphens.
// That shared rule lives here now rather than being hand-copied a fourth time.
// Still-unmigrated copies, kept only because a test lifts their source by
// name: `plCompileQuery`/`plSearchRuns` in server.js, `compileQuery` in
// chatfeed.js, and meta-assets.js's own. The clip library is NOT one of these
// — it normalises and matches substrings on purpose.
function compileFeed(q) {
  return parseQuery(q).map((g) => ({
    neg: g.neg,
    terms: g.terms.map((t) => {
      const v = t.value;
      try {
        return new RegExp((/^[a-z0-9]/i.test(v) ? '\\b' : '')
          + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'), 'i');
      } catch (e) { return null; }
    }).filter(Boolean),
  })).filter((g) => g.terms.length);
}
function feedMatches(hay, groups) {
  const s = String(hay == null ? '' : hay);
  return groups.every((g) => (g.terms.some((rx) => rx.test(s)) ? !g.neg : g.neg));
}

module.exports = { parseQuery, plain, compileFeed, feedMatches };
