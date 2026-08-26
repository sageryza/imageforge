/*
 * send-match.js — match a picture being SENT to the Story Room against the
 * beats it might belong on (2026-08-26, Sophie: "if I'm in the playground and
 * I want to send a drawing to the story room then it does some sort of a
 * check to match it to the right beat and then asks me to confirm or choose a
 * different one").
 *
 * The signal is TEXT: the run's own typed prompt against each beat's words —
 * its drawing prompt where she has written one, else its caption (the same
 * fallback promptFor() draws by, because a beat's prompt IS its caption until
 * she tunes it). No model call, ever: this runs on a page open, and opening a
 * page must never spend money. It is a PROPOSAL — the room shows the ranked
 * candidates and nothing places without her tap, so a wrong guess costs her a
 * glance and a right one saves the whole shelf walk.
 *
 * The rules, each earned elsewhere in this repo:
 *  - THE GATE IS ≥3 SHARED DISTINCTIVE ROOTS (matchBlock's lesson: two is a
 *    coincidence — "owl"+"night" co-occur across half a shelf). A tiny text
 *    can never reach three, so a side of 1-2 roots qualifies only when it is
 *    wholly contained in the other and shares at least two.
 *  - SINGULAR AND PLURAL LAND ON ONE ROOT (bestParagraph's stem lesson:
 *    "images"→imag while "image"→image lost the match that mattered).
 *  - RANK BY SHARED ROOTS FIRST, Jaccard second — a longer caption must not
 *    bury a beat that matched every word she typed — and the pad's own
 *    recency last, so two equal beats prefer the story she is working in.
 *  - AN EXACT TEXT MATCH OUTRANKS EVERYTHING: she copied the beat's own
 *    prompt to the Playground, which is the round trip's whole shape.
 *
 * Pure and dependency-free so the rules have a test that needs no
 * node_modules (the pad-art.js pattern). scratchpad.js's GET /send-match is
 * the one caller.
 */
'use strict';

// Words that carry no aim: grammar, plus the handful of drawing words that
// sit in half the prompts on file ("a watercolor drawing of…") and would
// match every beat equally.
const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it', 'its', 'her',
  'hers', 'his', 'she', 'he', 'they', 'them', 'their', 'this', 'that',
  'these', 'those', 'for', 'from', 'as', 'by', 'into', 'onto', 'over',
  'under', 'up', 'down', 'out', 'off', 'no', 'not', 'very', 'while', 'then',
  'there', 'here', 'has', 'have', 'had', 'who', 'him', 'my', 'your', 'we',
  'you', 'i',
  'drawing', 'draw', 'drawn', 'illustration', 'picture', 'image', 'style',
  'scene', 'panel',
]);

const norm = (s) => String(s || '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// One root per word family — "lands"/"landing"/"landed" are one aim, and so
// are "smile"/"smiling" and "run"/"running". A porter-lite in five ordered
// strips (plural, ing/ed, mute e, doubled tail letter), each length-guarded
// so "ring", "red" and "dusk" survive whole. Deliberately no dictionary: a
// wrong fold costs a candidate she taps past, a missed one loses the match
// that mattered (the bestParagraph stem lesson).
const rootOf = (w) => {
  if (w.length > 3 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  if (w.length > 2 && w[w.length - 1] === w[w.length - 2]
    && !/[aeiou]/.test(w[w.length - 1])) w = w.slice(0, -1);
  return w;
};

function rootsOf(s) {
  const out = new Set();
  for (const w of norm(s).split(' ')) {
    if (!w || w.length < 3) continue;
    if (STOP.has(w)) continue;
    out.add(rootOf(w));
  }
  return out;
}

// Does this pair of texts qualify at all? (See the gate rule up top.)
function scorePair(promptRoots, text) {
  const tr = rootsOf(text);
  if (!promptRoots.size || !tr.size) return null;
  let inter = 0;
  for (const w of promptRoots) if (tr.has(w)) inter++;
  const small = Math.min(promptRoots.size, tr.size);
  const qualifies = inter >= 3 || (inter >= 2 && inter === small);
  if (!qualifies) return null;
  const union = promptRoots.size + tr.size - inter;
  return { inter, jaccard: union ? inter / union : 0 };
}

const MAX_CANDIDATES = 4;

/**
 * Rank every beat on the shelf against the picture's prompt.
 *
 * `pads` = [{ id, title, updatedAt, beats:[{ id, text?, prompt?, … }] }] —
 * the raw pad docs, exactly as Firestore holds them. Returns at most
 * MAX_CANDIDATES of { pad, beat, inter, jaccard, exact }, best first, and []
 * when nothing clears the gate — the caller falls back to the ordinary
 * pick-by-hand flow, unchanged.
 */
function matchBeats(prompt, pads) {
  const pr = rootsOf(prompt);
  const pnorm = norm(prompt);
  if (!pr.size || !pnorm) return [];
  const out = [];
  for (const pad of pads || []) {
    for (const beat of pad.beats || []) {
      // The beat's own drawing prompt is the strongest signal when she has
      // written one; the caption answers for every beat that has words at
      // all. Both are tried and the better one wins, because a tuned prompt
      // can drift from a caption she then sent to the Playground verbatim.
      let best = null;
      let exact = false;
      for (const t of [beat.prompt, beat.text]) {
        if (!t) continue;
        if (norm(t) === pnorm) exact = true;
        const s = scorePair(pr, t);
        if (s && (!best || s.inter > best.inter
          || (s.inter === best.inter && s.jaccard > best.jaccard))) best = s;
      }
      if (exact && !best) best = { inter: pr.size, jaccard: 1 };
      if (!best) continue;
      out.push({ pad, beat, inter: best.inter, jaccard: best.jaccard, exact });
    }
  }
  out.sort((a, b) => (b.exact - a.exact)
    || (b.inter - a.inter)
    || (b.jaccard - a.jaccard)
    || ((b.pad.updatedAt || 0) - (a.pad.updatedAt || 0)));
  return out.slice(0, MAX_CANDIDATES);
}

module.exports = { matchBeats, rootsOf, scorePair, norm, MAX_CANDIDATES };
