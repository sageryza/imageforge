#!/usr/bin/env node
// Put the reference comparisons that ALREADY EXIST on the reference shelf
// (Aug 2026 — the one-time seed for the shelf; see the REFERENCE SHELF note in
// chatfeed.js).
//
// Why a seed at all: the shelf is a new field, so on the day it shipped it was
// empty, and an empty shelf reads as a broken feature rather than a new one.
// Measured 2026-08-14 across all 333 Compare pages on file, ~34 carry a
// comparison title and the genuinely reusable ones are scattered over a dozen
// unrelated chats — the quality ladders in `hospital-story-images` and
// `netlify-site-review`, the style sets in `chatgpt-image-style-reference` and
// `icon-swaps-playground`, the LoRA scale rungs in `laura-deck-factory-test`.
// Nothing but a list could have gathered those: only 4 of the 333 had ever
// been bookmarked.
//
// Everything here is a page that answers a question which keeps getting asked
// again — deliberately NOT one-off decisions ("which cut", "old tracer vs
// new", a voice A/B that was settled). Each is reversible with one tap on its
// row in the app, and the write never touches the page's content, its chat, or
// its Current/Superseded state.
//
// Idempotent: a page already on the shelf is skipped.
//
//   node scripts/mark-reference-pages.js [--dry-run] [--base <url>]
//
// ---------------------------------------------------------------------------
// THE SURVEY PASS (2026-08-14, Sophie asked for "a comprehensive survey of
// compare pages… to see if we can pull anything out that is actually serving
// as a good compare page"). The seed above was built from TITLES ALONE. This
// pass OPENED all 336 pages' worth of candidates — every page whose title is
// comparison-shaped (57 of them), fetched, its structure read and its media
// HEAD-checked. What that changed:
//
//   • ONE seeded page does not survive being opened. "Playground v4 —
//     Watercolor + Hoonie styles" is a UI PROTOTYPE of the Playground page
//     (its <h1> is "Playground", it has a Generate button and a LoRA-scale
//     control) and contains ZERO images. Nothing is compared on it. It is in
//     DROP below — the title said "styles" and the page does not.
//   • EIGHT pages that no title-scan could have ranked are added, because
//     what makes them reusable is inside them (see each comment).
//
// Also measured, and worth not re-measuring: every image and audio URL on
// every candidate answered 200. Nothing on the shelf is rotting.
// ---------------------------------------------------------------------------

const BASE = (() => {
  const i = process.argv.indexOf('--base');
  return (i > 0 && process.argv[i + 1]) || process.env.FORGE_BASE
    || 'https://imageforge-q125.onrender.com';
})();
const DRY = process.argv.includes('--dry-run');
const TOKEN = process.env.STUDIO_TOKEN || '';

// chat + the page's exact title + what it files under. The topic is the
// question it answers, kept plain and reusable — it is what groups the shelf.
const WANT = [
  ['hospital-story-images', 'Quality ladder — low vs medium vs high', 'image quality'],
  ['netlify-site-review', '3x3 sheet — low vs medium vs high', 'image quality'],
  ['deck-factory-image-gen', 'Monsters — full-size cards, quality ladder v1', 'image quality'],
  ['nde-precision-cutting-doc', 'Art Mason — watercolor high vs medium (side by side)', 'image quality'],
  ['chatgpt-image-style-reference', 'Style tests — side by side (v1)', 'styles'],
  ['chatgpt-image-style-reference', 'Style-ref tests v1–v4 vs the original scan', 'styles'],
  // (The seed's 'Playground v4 — Watercolor + Hoonie styles' sat here until
  //  the survey pass opened it and moved it to DROP.)
  ['icon-swaps-playground', 'Witch School style — three switches, six combinations', 'styles'],
  ['laura-deck-factory-test', 'Three people — LoRA scale 1 / 1.1 / 1.2 (Aug 2)', 'lora scale'],
  ['laura-deck-factory-test', 'Sundress — LoRA scale 1 / 1.1 / 1.2 (Aug 2)', 'lora scale'],
  ['laura-deck-factory-test', 'Sundress — same-seed rows, scale by scale (Aug 2)', 'lora scale'],
  ['netlify-site-review', '4x4 vs 5x5 — the same subjects at two cell sizes', 'sheet grid'],

  // --- added by the survey pass, 2026-08-14 -------------------------------
  // The reference sheet itself: every style reference we own, each shown
  // beside the pictures it produced (Evan/ChatGPT, Scarry, Pastel, Hoonies,
  // Movies & dreams, the zine). This is the page to open before asking which
  // reference does what — and the one nobody could find.
  ['references-render-plan', 'Every reference, and what it feeds', 'references'],
  // Why gpt-image-2 draws rather than photographs: the same subject at two
  // scales against two wordings, portrait and full figure. The answer to
  // "why did this come back looking like a photo", which recurs constantly.
  ['hospital-story-images', 'What actually made it a drawing — scale vs wording', 'styles'],
  // OUR tracer against the outside world — the standing benchmark behind
  // "should we just use the free tool", which gets asked again every time
  // someone meets the vector pipeline. Each drawing carries its measured %
  // deviation from the source, so rebuilding means re-tracing AND re-measuring.
  // ('Old tracer vs new — twelve of the same drawings' is deliberately NOT
  //  here: same chat, same shape, but it settled which tracer we ship and the
  //  doc names that exact page as a one-off. Left for her keep-tap.)
  ['netlify-site-review', 'Three tracers, four drawings — ours vs the off-the-shelf ones', 'vector tracing'],
  ['netlify-site-review', 'Recolouring, and the free tool measured against ours', 'vector tracing'],
  // The voice grid — three clones (old professional, retrained, instant)
  // against every setting, with the whole film rendered once per version.
  // The one page that answers "what do the settings actually do to her
  // voice", and it cost four rounds of ElevenLabs renders to make.
  ['anthony-chene-nde-pipeline', 'Voice test v4 — EVERYTHING: 3 voices x every setting, + all 4 films', 'voice'],
  // Every prompt beside the picture it made, in the order it was sent — 352
  // pieces of media. The worked example of how a prompt is built here.
  ['deck-factory-story-room', 'How a prompt is built v2 — in the order it was sent', 'prompts'],
  // The same hero image square and landscape, 76 of them. The aspect-ratio
  // question for anything that has to sit in a post or a listing.
  ['witchcraft-blog-content', 'Blog Heroes — Square vs Landscape', 'image size'],
];

// TAKEN OFF the shelf by the survey pass — a page whose TITLE reads like a
// comparison and whose CONTENT is not one. Removing is the same one-field
// write in reverse; the page, its chat and its Current state are untouched.
const DROP = [
  // A mockup of the Playground screen, not a comparison of the two styles.
  ['laura-deck-factory-test', 'Playground v4 — Watercolor + Hoonie styles'],
  // Shelved by an earlier run of this pass and taken back off: it is the
  // "old tracer vs new" the doc names as the example of a settled one-off.
  ['netlify-site-review', 'Old tracer vs new — twelve of the same drawings'],
];

const headers = Object.assign({ 'Content-Type': 'application/json' },
  TOKEN ? { 'x-studio-token': TOKEN } : {});

async function pagesOf(chat) {
  const r = await fetch(BASE + '/api/chatfeed/pages?chat=' + encodeURIComponent(chat), { headers });
  if (!r.ok) throw new Error(chat + ': HTTP ' + r.status);
  return (await r.json()).pages || [];
}

(async () => {
  const cache = {};
  let on = 0, already = 0, missing = 0;
  for (const [chat, title, topic] of WANT) {
    if (!cache[chat]) cache[chat] = await pagesOf(chat);
    const p = cache[chat].find((x) => x.title === title);
    if (!p) { missing++; console.log('  MISSING  ' + chat + ' :: ' + title); continue; }
    if (p.reference) { already++; console.log('  already  ' + title); continue; }
    if (DRY) { on++; console.log('  would be ' + topic.padEnd(14) + ' ' + title); continue; }
    const r = await fetch(BASE + '/api/chatfeed/page/' + p.id + '/reference',
      { method: 'POST', headers, body: JSON.stringify({ reference: true, topic }) });
    const d = await r.json().catch(() => ({}));
    if (!d.ok) { console.log('  FAILED   ' + title + ' — ' + JSON.stringify(d)); continue; }
    on++; console.log('  shelved  ' + topic.padEnd(14) + ' ' + title);
  }
  let off = 0;
  for (const [chat, title] of DROP) {
    if (!cache[chat]) cache[chat] = await pagesOf(chat);
    const p = cache[chat].find((x) => x.title === title);
    if (!p) { missing++; console.log('  MISSING  ' + chat + ' :: ' + title); continue; }
    if (!p.reference) { console.log('  not on   ' + title); continue; }
    if (DRY) { off++; console.log('  would drop     ' + title); continue; }
    const r = await fetch(BASE + '/api/chatfeed/page/' + p.id + '/reference',
      { method: 'POST', headers, body: JSON.stringify({ reference: false, topic: '' }) });
    const d = await r.json().catch(() => ({}));
    if (!d.ok) { console.log('  FAILED   ' + title + ' — ' + JSON.stringify(d)); continue; }
    off++; console.log('  dropped        ' + title);
  }

  console.log('\n' + (DRY ? 'would shelve ' : 'shelved ') + on
    + ', already there ' + already + ', ' + (DRY ? 'would drop ' : 'dropped ') + off
    + ', not found ' + missing);
})().catch((e) => { console.error(e.message); process.exit(1); });
