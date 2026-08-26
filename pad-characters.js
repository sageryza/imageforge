// ── CHARACTER REFERENCES ON A STORY (2026-08-26, Sophie: "add a way to
// attach one or more character references into the story room when I'm
// making images in there … the characters could exist at the top of the
// story and then there could be like an add character card button and then
// through there I pick one or multiple of the characters that are for the
// story so it's two taps to add a character instead of one, and there's
// only one button not multiple").
//
// The pure rules — no Firestore, no network — so they have a test that runs
// with no node_modules (the pad-art pattern). scratchpad.js holds the
// routes and the draw; the page holds the sheet and the one picker button.
//
// A character is {id, name, url}: a reference image the story keeps (the
// bytes ride the Dump's upload-file route, never a second upload path) and
// the NAME a drawing prompt calls them by. A draw picks ids; the picked
// cards ride the gpt-image-2 edit as the LAST attached images, behind the
// style reference (and, on watercolor, behind the Sophie card), and the
// prompt discloses them with charLine() below.

const MAX_CHARACTERS = 30; // per story — a cast, not a library
// Per draw. Every reference is paid input tokens (~1.2c each at any
// quality, measured on the Playground's refs), so a draw carries a few
// characters, never the whole cast.
const MAX_PICKED = 6;

// The pad doc's list, normalized on every read — an old or hand-written
// record can never break a draw. Order is kept: it is the order she added
// them, and the order the picked ones attach in.
function normalizeCharacters(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((c) => c && typeof c === 'object' && /^https?:\/\//.test(String(c.url || '')))
    .map((c) => ({
      id: String(c.id || ''),
      name: String(c.name || '').slice(0, 60),
      url: String(c.url),
      at: Number(c.at) || 0,
    }))
    .filter((c) => c.id)
    .slice(0, MAX_CHARACTERS);
}

// Resolve the ids a draw picked to the story's own records — in the
// story's order, deduped, capped. An id the story doesn't know is simply
// dropped (a stale page after a remove must not fail the draw).
function pickCharacters(padChars, ids) {
  const want = new Set((Array.isArray(ids) ? ids : []).map(String));
  return normalizeCharacters(padChars)
    .filter((c) => want.has(c.id))
    .slice(0, MAX_PICKED);
}

// The disclosed prompt line for the picked characters — the whole prompt is
// stored (house rule), so this line is exactly what rides. "NOT a style
// reference" is load-bearing: the pastel prefix claims "the attached images
// ONLY as a STYLE reference" and the dreamy suffix re-asserts its own, so
// the character line must carve its images out explicitly rather than argue
// by implication. Leading space on purpose — it appends to a prefix or a
// suffix the way ART.characterLine always has.
function charLine(chars) {
  const list = Array.isArray(chars) ? chars.filter(Boolean) : [];
  if (!list.length) return '';
  const names = list.map((c, i) => String(c.name || '').trim() || `character ${i + 1}`);
  if (list.length === 1) {
    const n = names[0];
    return ' The last attached image is NOT a style reference — it is a ' +
      `CHARACTER reference. That character is named ${n}. Whenever the ` +
      `prompt mentions ${n}, draw them as the character shown in that ` +
      'image, keeping their look consistent.';
  }
  return ` The last ${list.length} attached images are NOT style references — ` +
    `they are CHARACTER references, in this order: ${names.join(', ')}. ` +
    'Whenever the prompt mentions one of those names, draw that character ' +
    'as shown in their own image, keeping their look consistent.';
}

module.exports = { MAX_CHARACTERS, MAX_PICKED, normalizeCharacters, pickCharacters, charLine };
