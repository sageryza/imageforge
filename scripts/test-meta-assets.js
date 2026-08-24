#!/usr/bin/env node
// META ASSETS — the aggregation rules, pure, no network.
//   1. every chat's filings appear, ordered by when they were filed (newest
//      first), interleaved across chats;
//   2. two copies of one picture INSIDE one chat collapse to one row (the
//      same union its own tab does), keeping the labeled url;
//   3. the same picture filed in TWO chats stays TWO rows — a vote is keyed
//      chat+url, so each row must belong to exactly one tab;
//   4. equal timestamps page deterministically (a batch filed in one turn);
//   5. a doc with no chat or no url is dropped, never a phantom row.
//
//   node scripts/test-meta-assets.js
'use strict';
const assert = require('assert');
const { buildMetaAssets, searchMetaAssets, noteKey } = require('../meta-assets');

const iso = (n) => new Date(1700000000000 + n * 1000).toISOString();

// 1 + 2 + 3 together: three chats, one in-chat duplicate, one cross-chat twin.
const rows = buildMetaAssets([
  { chat: 'witch-school', url: 'https://x/a.png', created: iso(10), description: 'Moon lesson card' },
  { chat: 'dating-book', url: 'https://x/b.png', created: iso(30), md5: 'mm1' },
  // the hook's claude-deliveries copy of b.png — same chat, same bytes
  { chat: 'dating-book', url: 'https://x/999-r4nd0m.png', created: iso(31), md5: 'mm1',
    description: 'Penny — the blue Kleenex' },
  { chat: 'evan-film', url: 'https://x/c.png', created: iso(20) },
  // the SAME picture as a.png, filed in a different chat — stays its own row
  { chat: 'evan-film', url: 'https://x/a.png', created: iso(40) },
  { chat: '', url: 'https://x/orphan.png', created: iso(50) },   // no chat → dropped
  { chat: 'witch-school', url: '', created: iso(50) },           // no url → dropped
]);

assert.strictEqual(rows.length, 4, 'four rows: dup collapsed, twin kept, strays dropped');
// newest first, interleaved across chats
assert.deepStrictEqual(rows.map((r) => r.chat),
  ['evan-film', 'dating-book', 'evan-film', 'witch-school'], 'filing order across chats');
// the in-chat duplicate folded onto ONE row carrying the label
const b = rows.find((r) => r.chat === 'dating-book');
assert.strictEqual(b.description, 'Penny — the blue Kleenex', 'label survives the fold');
assert.ok(b.alts.indexOf('https://x/b.png') >= 0, 'the other path rides along as an alt');
// the cross-chat twin is two rows, one per chat, so votes stay unambiguous
assert.strictEqual(rows.filter((r) => r.url === 'https://x/a.png').length, 2,
  'same url in two chats = two rows');

// 6: app-made creations join as the my-creations bucket; hook copies and
// urls a chat already filed stay out.
const withApp = buildMetaAssets(
  [{ chat: 'evan-film', url: 'https://x/shared.png', created: iso(10) }],
  [
    // app-made sticker sheet — joins, prompt becomes the label, made caption fills the caption slot
    { url: 'https://x/sticker.png', prompt: 'seven woodland stickers', type: 'sticker',
      model: 'gpt-image-2', quality: 'medium', size: '1568x2352', ms: 5000 },
    // in-app plain image — prompt also lands in promptContent (Playground/PROMPT work)
    { url: 'https://x/drawn.png', prompt: 'a fox in a yellow raincoat', type: 'image',
      style: 'ChatGPT · medium', ms: 4000 },
    { url: 'https://x/hook.png', prompt: 'from evan-film', ms: 3000 },     // hook copy → out
    { url: 'https://x/shared.png', prompt: 'also filed by a chat', ms: 2000 }, // chat has it → out
  ]);
assert.strictEqual(withApp.length, 3, 'chat row + two app rows');
const stick = withApp.find((r) => r.url === 'https://x/sticker.png');
assert.strictEqual(stick.chat, 'my-creations', 'app rows live in the my-creations bucket');
assert.ok(stick.app, 'app rows are marked');
assert.strictEqual(stick.description, 'seven woodland stickers', 'prompt is the label');
// MODEL · QUALITY · SIZE — the size became a required third slot in Aug 2026
// (Sophie: "1K 2K 4K should be a third slot in the model/quality required
// tagging"), because gpt-image-2 draws any canvas and the first two stopped
// saying what a picture is.
// …and the third slot is the TIER, not the pixels ("i asked for it to say 1k
// 2k or 4k"). Normalised on READ, so a record filed with the raw canvas before
// her correction still displays the rung and needs no backfill.
// …and the STYLE leads it since 2026-08-24 (Sophie: "there's no style clause
// in Meta assets"). It was on every Playground creation all along and this
// builder read it only as a fallback, so it was fetched and dropped.
assert.strictEqual(stick.prompt, 'gpt-image-2 · medium · 2K',
  'a record with no style keeps model·quality·size');
{
  const styled = buildMetaAssets([], [{ url: 'https://x/dre.png', prompt: 'a red door', type: 'image',
    style: 'Dreamy', model: 'gpt-image-2', quality: 'medium', size: '1568x2352', ms: 8 }])[0];
  assert.strictEqual(styled.prompt, 'Dreamy · gpt-image-2 · medium · 2K',
    'the style leads the caption — which recipe drew it, before how well and how big');
  // The style is a LABEL and belongs in the caption, never in the PROMPT
  // overlay's style half: a creation doc stores the style's NAME, never the
  // prefix/suffix actually sent, so filing it there would be a reconstruction.
  assert.strictEqual(styled.promptStyle || '', '',
    'the prompt overlay’s style half stays empty rather than carrying a label');
  // A Replicate run files model === styleLabel, so the two must not double up.
  const lora = buildMetaAssets([], [{ url: 'https://x/wtr.png', prompt: 'a crow', type: 'image',
    style: 'WTR', model: 'WTR', quality: 'medium', ms: 7 }])[0];
  assert.strictEqual(lora.prompt, 'WTR · medium',
    'a LoRA run whose model IS its style reads once, not twice');
  // THE STYLE SLOT IS ITSELF COMPOUND — the Playground files it as
  // `${label} · ${quality}`, so a whole-slot de-dupe cannot catch the repeat.
  // Found live off the deploy: "Dreamy · low · gpt-image-2 · low · 1K".
  const dbl = buildMetaAssets([], [{ url: 'https://x/dbl.png', prompt: 'p', type: 'image',
    style: 'Dreamy · low', model: 'gpt-image-2', quality: 'low', size: '1024x1536', ms: 6 }])[0];
  assert.strictEqual(dbl.prompt, 'Dreamy · gpt-image-2 · low · 1K',
    'a quality already inside the style slot is not said twice');
  // A style whose parts say nothing the other slots say is kept WHOLE — the
  // Scratch Pad files "Scratch Pad · dreamy · medium" and carries no other
  // fields, so nothing may be trimmed out of it.
  const pad = buildMetaAssets([], [{ url: 'https://x/pad.png', prompt: 'p', type: 'image',
    style: 'Scratch Pad · dreamy · medium', ms: 5 }])[0];
  assert.strictEqual(pad.prompt, 'Scratch Pad · dreamy · medium',
    'a compound style with nothing to de-dupe survives whole');
}
// An absent slot is LEFT OUT, never guessed — nothing on a record filed before
// the field existed says how big it is, exactly as with quality.
{
  const older = buildMetaAssets([], [{ url: 'https://x/old.png', prompt: 'a fox', type: 'image',
    model: 'gpt-image-2', quality: 'medium', ms: 9 }])[0];
  assert.strictEqual(older.prompt, 'gpt-image-2 · medium',
    'a record with no size keeps the two-slot caption rather than inventing one');
}
assert.strictEqual(stick.promptContent, '', 'a sticker sheet is not a plain image — no overlay half');
const drawn = withApp.find((r) => r.url === 'https://x/drawn.png');
assert.strictEqual(drawn.prompt, 'ChatGPT · medium', 'old single style label is the caption fallback');
assert.strictEqual(drawn.promptContent, 'a fox in a yellow raincoat', 'plain image prompt reaches the overlay');

// 4: a same-second batch pages the same way every build.
const batch = [
  { chat: 'zeta', url: 'https://x/2.png', created: iso(0) },
  { chat: 'alpha', url: 'https://x/3.png', created: iso(0) },
  { chat: 'alpha', url: 'https://x/1.png', created: iso(0) },
];
const once = buildMetaAssets(batch).map((r) => r.chat + '|' + r.url);
const again = buildMetaAssets(batch.slice().reverse()).map((r) => r.chat + '|' + r.url);
assert.deepStrictEqual(once, again, 'equal timestamps order deterministically');

console.log('test-meta-assets: all good —', rows.length, 'rows from 7 docs, order + union + twin rules hold');

// 7: SEARCH runs over the full built list, server-side (Aug 2026 — she
// searched "yarn" and the page, filtering only loaded tiles, found nothing).
// Same grammar and word-start anchoring as the page's own box.
const pool = buildMetaAssets([
  { chat: 'knitting', url: 'https://x/y1.png', created: iso(1), description: 'a ball of yarn on the table' },
  { chat: 'evan-film', url: 'https://x/y2.png', created: iso(2), description: 'boundaries of the frame' },
  { chat: 'witch-school', url: 'https://x/y3.png', created: iso(3), prompt: 'gpt-image-2 · medium' },
  { chat: 'dating-book', url: 'https://x/y4.png', created: iso(4), promptContent: 'a woman feeding crows' },
]);
assert.strictEqual(searchMetaAssets(pool, 'yarn').length, 1, 'finds by label');
assert.strictEqual(searchMetaAssets(pool, 'aries').length, 0, 'word-start anchored — aries never finds boundaries');
assert.strictEqual(searchMetaAssets(pool, 'boundaries').length, 1, 'the whole word still hits');
assert.strictEqual(searchMetaAssets(pool, 'gpt-image-2').length, 1, 'caption matches, hyphens intact');
assert.strictEqual(searchMetaAssets(pool, 'crows feeding').length, 1, 'bare words AND, any order');
assert.strictEqual(searchMetaAssets(pool, 'yarn OR crows').length, 2, 'OR takes either');
assert.strictEqual(searchMetaAssets(pool, 'a -yarn').length, 1, 'negation excludes (only the crows row keeps a bare "a")');
assert.strictEqual(searchMetaAssets(pool, 'crows -woman').length, 0, 'negation kills its own row');
assert.strictEqual(searchMetaAssets(pool, '"yarn on the table"').length, 1, 'phrase adjacent');
assert.strictEqual(searchMetaAssets(pool, '"table yarn"').length, 0, 'phrase respects order');
assert.strictEqual(searchMetaAssets(pool, '').length, 4, 'empty query = everything');
// the chat slug, its display name, and the note thread are all haystack
assert.strictEqual(searchMetaAssets(pool, 'witch').length, 1, 'chat slug matches');
assert.strictEqual(searchMetaAssets(pool, 'Knitting Corner', { names: { knitting: 'Knitting Corner' } }).length, 1,
  'display name matches');
const notes = new Map([[noteKey('dating-book', 'https://x/y4.png'), ['redo the sky please']]]);
assert.strictEqual(searchMetaAssets(pool, 'redo the sky', { notes }).length, 1, 'note thread matches');
// my-creations rows match their bucket name
const appPool = buildMetaAssets([], [{ url: 'https://x/app.png', prompt: 'a fox', ms: 1 }]);
assert.strictEqual(searchMetaAssets(appPool, 'creations').length, 1, 'app rows match My Creations');

console.log('meta-assets search: all assertions passed');
