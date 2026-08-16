// timeline-parse.js — the Story Timeline's pure half: turning a pasted
// dictation into moments, and keeping what the page sends back in shape.
//
// It lives apart from timeline.js for one reason: NOTHING IN HERE NEEDS A
// DEPENDENCY, so scripts/test-timeline.js drives the real parser and the real
// validators in any checkout, with no express and no Firebase admin present.
// timeline.js re-exports everything here; see its header for what a moment and
// a unit are and why the arrangement is ids rather than words.

const crypto = require('crypto');

/* ---------------------------------------------------------------- parsing */

// A header is a short ALL-CAPS line — "SEQUENCE", "ENDING SEQUENCE",
// "CHARACTER REFERENCE". Digits and punctuation are allowed so "ACT 2" reads as
// one; a long shouted line is prose, not a header.
const HEADER = /^[^a-z]{2,40}$/;
const ENDER = /^END\b/i;
// "1." / "1)" / "12 -" at the front of a line is the number she dictated, not
// part of the moment. Her numbers get thrown away on purpose: the page numbers
// the units itself, and hers stop matching the moment she moves anything.
const LEAD_NUM = /^\s*\d{1,3}\s*[.)\]:-]\s*/;
// straight and smart quotes wrapped round the whole line
const WRAPPED = /^["'‘’“”]([\s\S]*)["'‘’“”]$/;

function tidy(line) {
  let s = String(line).replace(LEAD_NUM, '').trim();
  const m = s.match(WRAPPED);
  if (m) s = m[1].trim();
  return s;
}

let seq = 0;
function mint() {
  seq += 1;
  return 'm' + Date.now().toString(36) + seq.toString(36)
    + crypto.randomBytes(2).toString('hex');
}

/** A pasted dictation → { moments, units }. Pure: no clock beyond the id, no
 *  network. Exported so scripts/test-timeline.js can drive it. */
function parseStory(text) {
  const moments = {};
  const units = [];
  let group = null;                 // the open sequence, if a header opened one
  let label = null;                 // a header that labels the next moment

  const push = (id) => {
    if (group) group.push(id);
    else units.push([id]);
  };

  String(text || '').split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line) { group = null; return; }              // a blank line closes it
    if (ENDER.test(line)) { group = null; return; }
    if (HEADER.test(line)) {
      // A header both closes whatever was open and opens a new group. It also
      // rides along as the LABEL of the first moment under it, so "CHARACTER
      // REFERENCE" is not silently thrown away.
      group = [];
      units.push(group);
      label = line.replace(/\s+/g, ' ');
      return;
    }
    const say = tidy(line);
    if (!say) return;
    const id = mint();
    moments[id] = label ? { text: say, label } : { text: say };
    label = null;
    push(id);
  });

  // a header with nothing under it leaves an empty unit behind
  return { moments, units: units.filter((u) => u.length) };
}

/* ------------------------------------------------------------------ shape */

function cleanMoments(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out = {};
  Object.keys(v).slice(0, 2000).forEach((k) => {
    const m = v[k];
    if (!m || typeof m !== 'object') return;
    const one = { text: String(m.text == null ? '' : m.text).slice(0, 4000) };
    if (m.label) one.label = String(m.label).slice(0, 120);
    if (m.tag) one.tag = String(m.tag).slice(0, 40);
    out[String(k).slice(0, 64)] = one;
  });
  return out;
}

function cleanUnits(v, moments) {
  if (!Array.isArray(v)) return null;
  const seen = {};
  const out = [];
  v.slice(0, 2000).forEach((u) => {
    if (!Array.isArray(u)) return;
    const keep = u.map(String).filter((id) => {
      if (seen[id]) return false;                      // a card is in ONE place
      if (moments && !moments[id]) return false;
      seen[id] = 1;
      return true;
    });
    if (keep.length) out.push(keep);
  });
  return out;
}

function view(doc) {
  const d = doc.data() || {};
  return {
    id: doc.id,
    title: d.title || 'Untitled',
    moments: d.moments || {},
    units: d.units || [],
    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || null,
  };
}

function countMoments(units) {
  return (units || []).reduce((n, u) => n + u.length, 0);
}

/* ---- storing an arrangement --------------------------------------------
   FIRESTORE REFUSES A NESTED ARRAY ("Nested arrays are not allowed"), and
   `units` is an array of arrays by nature — so it is PACKED on the way to the
   database and unpacked on the way out: one string per unit, its moment ids
   joined by commas. The API shape never changes; only the stored one does.
   Found the moment the first real story was written, not by reasoning. */

function packUnits(units) {
  return (units || []).map((u) => (Array.isArray(u) ? u.join(',') : String(u)))
    .filter((s) => s.length);
}

function unpackUnits(rows) {
  return (rows || []).map((r) => (Array.isArray(r) ? r.slice() : String(r).split(',')))
    .map((u) => u.filter(Boolean))
    .filter((u) => u.length);
}

module.exports = {
  parseStory, cleanMoments, cleanUnits, countMoments, packUnits, unpackUnits,
};
