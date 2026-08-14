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
  ['laura-deck-factory-test', 'Playground v4 — Watercolor + Hoonie styles', 'styles'],
  ['icon-swaps-playground', 'Witch School style — three switches, six combinations', 'styles'],
  ['laura-deck-factory-test', 'Three people — LoRA scale 1 / 1.1 / 1.2 (Aug 2)', 'lora scale'],
  ['laura-deck-factory-test', 'Sundress — LoRA scale 1 / 1.1 / 1.2 (Aug 2)', 'lora scale'],
  ['laura-deck-factory-test', 'Sundress — same-seed rows, scale by scale (Aug 2)', 'lora scale'],
  ['netlify-site-review', '4x4 vs 5x5 — the same subjects at two cell sizes', 'sheet grid'],
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
  console.log('\n' + (DRY ? 'would shelve ' : 'shelved ') + on
    + ', already there ' + already + ', not found ' + missing);
})().catch((e) => { console.error(e.message); process.exit(1); });
