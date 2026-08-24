#!/usr/bin/env node
/*
 * test-asset-guard.js — the decision behind POST /api/gallery's assetsOnly
 * branch: may this background catch become a new tile, and what does it wear?
 *
 * WHY THIS IS THE PART PINNED. The hook's raw-activity scan is a safety net
 * that cannot tell an image a chat MADE from one it merely LOOKED AT, and both
 * arrive as the same POST. Everything separating them is one pure function, so
 * one wrong branch here either fills Sophie's Assets tab with other chats'
 * pictures or silently loses a deliverable — and the second failure is
 * invisible until she goes looking for something that was never filed. Every
 * case below is a rule someone asked for, in her words where they exist.
 *
 * Runs the REAL guard with fixture filings. No network, no credential, no key.
 *
 *     node scripts/test-asset-guard.js
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const G = require('../asset-guard');

const DECK = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app';
const MEMBRY = 'https://storage.googleapis.com/membry-df528.firebasestorage.app';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  ok  ${name}`); };

/** The hook's background catch: assetsOnly, "from <chat>", no description. */
const caught = (url, extra) => Object.assign(
  { chat: 'moon-milk', url, wip: true, prompt: 'from moon-milk' }, extra || {});

/* ─── the shape of a background catch ─────────────────────────────────────── */

t('a PROSE delivery is never judged, labeled or not', () => {
  // Scan 1 posts without assetsOnly and takes the full gallery path; it does
  // not reach this branch at all. Pinned because keying the rules on "no
  // label" alone would have refused deliveries a chat made on purpose.
  for (const f of [
    { chat: 'a', url: `${DECK}/thumbs/abc.webp`, wip: false },
    { chat: 'a', url: `${DECK}/drops/_/deadbeef.jpg` },
  ]) {
    const v = G.guardFiling(f);
    assert.strictEqual(v.block, false);
    assert.strictEqual(v.reason, 'prose-delivery');
  }
});

t('a description or a curated caption marks a filing deliberate', () => {
  assert.strictEqual(G.isBackgroundCatch(caught(`${DECK}/x/y.png`)), true);
  assert.strictEqual(G.isBackgroundCatch(caught(`${DECK}/x/y.png`,
    { description: 'Penny — the blue Kleenex' })), false);
  assert.strictEqual(G.isBackgroundCatch(caught(`${DECK}/x/y.png`,
    { prompt: 'gpt-image-2 · medium' })), false);
  // Whitespace is not a label, and the hook's own caption is not curated.
  assert.strictEqual(G.isBackgroundCatch(caught(`${DECK}/x/y.png`,
    { description: '   ' })), true);
  assert.strictEqual(G.isBackgroundCatch(caught(`${DECK}/x/y.png`,
    { prompt: 'from some-other-chat' })), true);
});

/* ─── (d) the safety net survives: a picture labeled NOWHERE files ────────── */

t('a url labeled in no chat files normally — nothing a chat makes is lost', () => {
  const v = G.guardFiling(caught(`${DECK}/movies/panels/jonas_e04.png`, { others: [] }));
  assert.strictEqual(v.block, false);
  assert.strictEqual(v.reason, 'new');
});

/* ─── (a) THE POLAROID SHEET ──────────────────────────────────────────────── */

t('the polaroid-sheet case: an unlabeled SOURCE SHEET still files', () => {
  // A chat draws one big sheet, never labels it, then labels each cut-out tile
  // — different urls. The sheet is labeled nowhere, so the net still catches
  // it for the chat that made it. This is the case that must never regress:
  // it is indistinguishable from a stray except by what else is on file.
  const sheet = `${DECK}/polaroids/sheet-2026-08-14.png`;
  const others = [
    // the cut-outs ARE labeled, in this same chat, at their own urls
    { chat: 'moon-milk', description: 'Polaroid 1 — the kitchen', url: `${DECK}/polaroids/cut-01.png` },
  ].filter((r) => r.url === sheet);
  assert.deepStrictEqual(others, [], 'the sheet is its own url');
  const v = G.guardFiling(caught(sheet, { others }));
  assert.strictEqual(v.block, false, 'the making chat keeps its source sheet');
  assert.strictEqual(v.reason, 'new');
});

/* ─── (b) a LABELED filing is untouchable ─────────────────────────────────── */

t('a LABELED filing files anywhere — "it can be in two places"', () => {
  const url = `${DECK}/nde-styles/pastel/09-gabe.png`;
  const others = [{ chat: 'anthony-chene', description: 'Gabe in the column of light' }];
  for (const extra of [
    { description: 'Gabe — the version I want', others },
    { prompt: 'gpt-image-2 · medium', others },
  ]) {
    const v = G.guardFiling(caught(url, extra));
    assert.strictEqual(v.block, false, 'a deliberate filing is never refused');
    assert.strictEqual(v.reason, 'labeled');
  }
});

t('a LABELED filing of a Dump photo files, keeping HER words', () => {
  // Sophie's own review workflow, done properly: a chat curating a phone photo
  // into its tab with a real label must keep working, and its label must not
  // be replaced by Rule 3's generated one.
  const v = G.guardFiling(caught(`${DECK}/drops/_/aa11bb22cc33dd44.jpg`, {
    description: 'the tablecloth she means — third from the left',
  }));
  assert.strictEqual(v.block, false);
  assert.strictEqual(v.reason, 'labeled');
  assert.strictEqual(v.description, undefined, 'no auto-label over a real one');
});

/* ─── (e) RULE 1: labeled in another chat → refused ───────────────────────── */

t('the block case: labeled in chat A, background catch in chat B is refused', () => {
  const url = `${DECK}/movies/panels/jonas_e04_teeth_low.png`;
  const v = G.guardFiling(caught(url, {
    others: [{ chat: 'jonas', description: 'Jonas — the toothy cookie' }],
  }));
  assert.strictEqual(v.block, true);
  assert.strictEqual(v.reason, 'labeled-elsewhere');
  assert.strictEqual(v.chat, 'jonas', 'the verdict names where it is really filed');
});

t("chat A's own record is only READ — the guard never asks for a delete", () => {
  const v = G.guardFiling(caught(`${DECK}/a.png`, {
    others: [{ chat: 'jonas', description: 'Jonas — the toothy cookie' }],
  }));
  assert.deepStrictEqual(Object.keys(v).sort(), ['block', 'chat', 'reason']);
  assert.ok(!('delete' in v) && !('remove' in v));
});

t('an UNLABELED copy elsewhere does not block — neither is anybody\'s deliverable', () => {
  const v = G.guardFiling(caught(`${DECK}/a.png`, {
    others: [{ chat: 'jonas', description: '' }, { chat: 'evan-film' }],
  }));
  assert.strictEqual(v.block, false);
});

t('this chat\'s OWN labeled record never blocks its own filing', () => {
  // The route converges on an existing same-chat record upstream of the guard;
  // if one ever reaches here it must not read as "someone else owns this".
  const v = G.guardFiling(caught(`${DECK}/a.png`, {
    others: [{ chat: 'moon-milk', description: 'mine, labeled earlier' }],
  }));
  assert.strictEqual(v.block, false);
});

/* ─── RULE 1's md5 extension ──────────────────────────────────────────────── */

t('a RENAMED copy of a labeled deliverable is refused too (md5 match)', () => {
  // The caller's second query is by md5, so `others` can hold a record whose
  // url differs entirely. Same bytes, same picture, already labeled elsewhere.
  const v = G.guardFiling(caught(`${MEMBRY}/claude-deliveries/1755-7f3e9a.png`, {
    others: [{ chat: 'portraits', description: 'Gabe in the column of light' }],
  }));
  assert.strictEqual(v.block, true);
  assert.strictEqual(v.reason, 'labeled-elsewhere');
});

/* ─── (f) RULE 2: the server's own derived copies ─────────────────────────── */

t('a thumbs/ url is refused even though it is labeled nowhere', () => {
  // Rule 1 can never catch this: a thumbnail is not a labeled asset anywhere.
  // Investigating the first stray printed its thumb url into the same tab.
  const v = G.guardFiling(caught(
    `${DECK}/thumbs/597235f0e4c68229ced680a17e7749dae29ad0ee.webp`, { others: [] }));
  assert.strictEqual(v.block, true);
  assert.strictEqual(v.reason, 'derived-copy');
  assert.strictEqual(v.prefix, 'thumbs/');
});

t('a drops/_thumb/ crystal thumb is refused, so only the real photo tiles', () => {
  const v = G.guardFiling(caught(`${DECK}/drops/_thumb/abc123.webp`));
  assert.strictEqual(v.block, true);
  assert.strictEqual(v.reason, 'derived-copy');
  assert.strictEqual(v.prefix, 'drops/_thumb/', 'checked BEFORE the Dump rule');
});

t('the derived list is narrow, and matched as a PATH prefix', () => {
  assert.deepStrictEqual(G.DERIVED_PREFIXES, ['thumbs/', 'drops/_thumb/']);
  // not the bucket's own name, not a folder that merely contains the word
  assert.strictEqual(G.derivedPrefix(`${DECK}/nde/thumbs-notes/x.png`), null);
  assert.strictEqual(G.derivedPrefix(`${DECK}/a/thumbs/x.webp`), null);
  assert.strictEqual(G.derivedPrefix('https://example.com/thumbs/x.webp'), null,
    'not a Storage url at all');
});

/* ─── RULE 3: a Dump photo is LABELED, never refused ──────────────────────── */

t('pulled in for review — the dinner-party case: a Dump photo FILES', () => {
  // Measured 2026-08-14: all 18 drops/_ photos in that chat arrived as
  // background catches, and Sophie reviewed them in its Assets tab. A refusal
  // would have deleted a workflow she uses, so the rule labels instead.
  const v = G.guardFiling(caught(`${DECK}/drops/_/aa11bb22cc33dd44ee55.jpg`, {
    dump: { bundleName: 'Dinner party', photoIndex: 3, hash: 'aa11bb22cc33dd44ee55' },
  }));
  assert.strictEqual(v.block, false, 'never refused');
  assert.strictEqual(v.reason, 'dump-photo');
  assert.strictEqual(v.description, 'Dump — Dinner party #3');
});

t('a Dump photo with no record found still files, with a fallback label', () => {
  const v = G.guardFiling(caught(`${DECK}/drops/_/ff00ff00ff00ff00.png`, { dump: null }));
  assert.strictEqual(v.block, false);
  assert.strictEqual(v.reason, 'dump-photo');
  assert.strictEqual(v.description, 'Dump photo',
    'a label missing detail beats a photo missing');
});

t('the Dump label uses the record\'s own field names', () => {
  assert.strictEqual(G.dumpLabel({ bundleName: 'Pink quartz', photoIndex: 0 }),
    'Dump — Pink quartz #0');
  assert.strictEqual(G.dumpLabel({ name: 'the chair' }), 'Dump — the chair');
  assert.strictEqual(G.dumpLabel({}), 'Dump photo');
  assert.strictEqual(G.dumpLabel(null), 'Dump photo');
  assert.ok(G.dumpLabel({ bundleName: 'x'.repeat(600) }).length <= 300,
    'the description field caps at 300');
});

t('a LOOSE share-sheet file falls back to its FOLDER, and drops the #0', () => {
  // Shaped on the real records behind the dinner-party photos (read
  // 2026-08-14): bundle/bundleName null, photoIndex 0 on every one, and the
  // only thing that says anything is `track`, the Dump's folder field. "#0" on
  // every loose photo is noise, so the number rides with an album or not at all.
  const loose = { bundle: null, bundleName: null, photoIndex: 0, name: null,
    track: 'style references', media: 'image' };
  assert.strictEqual(G.dumpLabel(loose), 'Dump — style references');
  assert.strictEqual(G.dumpLabel({ ...loose, track: null }), 'Dump photo');
});

t('the Dump record is found by the content address in the filename', () => {
  assert.strictEqual(G.dumpHash(`${DECK}/drops/_/aa11bb22cc33dd44.jpg`), 'aa11bb22cc33dd44');
  assert.strictEqual(G.dumpHash(`${DECK}/drops/_/AA11BB22CC33DD44.JPG`), 'aa11bb22cc33dd44');
  // a video's poster frame belongs to the same record
  assert.strictEqual(G.dumpHash(`${DECK}/drops/_/aa11bb22cc33dd44-poster.jpg`), 'aa11bb22cc33dd44');
  // and everything that is not one
  assert.strictEqual(G.dumpHash(`${DECK}/drops/_thumb/aa11bb22cc33dd44.webp`), null);
  assert.strictEqual(G.dumpHash(`${DECK}/crystals/b/x.jpg`), null);
  assert.strictEqual(G.dumpHash(`${DECK}/drops/_/nested/aa11bb22cc33dd44.jpg`), null);
});

t('BOTH Dump layouts are found, each by the right field', () => {
  // Counted live 2026-08-14 across the Assets tabs: 28 records in today's
  // content-addressed layout and 61 in the pre-2026-07-28 one, which is not
  // hashed and is found by its url (a field on the drops doc; 8 of 8 sampled
  // resolved). Dropping the legacy half would leave the older Dump photos
  // nameless for no reason.
  assert.deepStrictEqual(G.dumpLookup(`${DECK}/drops/_/aa11bb22cc33dd44.jpg`),
    { by: 'hash', value: 'aa11bb22cc33dd44' });
  const legacy = `${DECK}/drops/2026-07-27-0337/style-references-for-ai/3-37-ms3asln.jpg`;
  assert.deepStrictEqual(G.dumpLookup(legacy), { by: 'url', value: legacy });
  // and neither for things that aren't Dump photos
  assert.strictEqual(G.dumpLookup(`${DECK}/drops/_thumb/abc.webp`), null, 'derived, not a photo');
  assert.strictEqual(G.dumpLookup(`${DECK}/drops/loose.jpg`), null, 'too shallow to be one');
  assert.strictEqual(G.dumpLookup(`${DECK}/movies/panels/a.png`), null);
});

t('only a Dump filing pays for the drops lookup', () => {
  assert.strictEqual(G.needsDumpRecord(caught(`${DECK}/drops/_/aa11bb22cc33dd44.jpg`)), true);
  assert.strictEqual(G.needsDumpRecord(caught(`${DECK}/drops/_thumb/a.webp`)), false);
  assert.strictEqual(G.needsDumpRecord(caught(`${DECK}/movies/panels/a.png`)), false);
  assert.strictEqual(G.needsDumpRecord(
    caught(`${DECK}/drops/_/aa11bb22cc33dd44.jpg`, { description: 'hers' })), false);
});

/* ─── the source-library list, shared with the sweep ──────────────────────── */

t('the source-library list is the one both readers use', () => {
  assert.deepStrictEqual(G.SOURCE_LIBRARY_PREFIXES, ['drops/', 'crystals/', 'ingest/']);
  assert.strictEqual(G.sourceLibraryPrefix(`${DECK}/drops/_/a.jpg`), 'drops/');
  assert.strictEqual(G.sourceLibraryPrefix(`${DECK}/crystals/aug/pink/1-0-x.jpg`), 'crystals/');
  assert.strictEqual(G.sourceLibraryPrefix(`${DECK}/ingest/batch/kw__1-2-3.png`), 'ingest/');
  // audio/ is deliberately NOT one: the Cutting Room writes real deliverables
  // into audio/cutting-room/.
  assert.strictEqual(G.sourceLibraryPrefix(`${DECK}/audio/cutting-room/01-clip.m4a`), null);
});

t('the sweep reads the guard\'s list rather than keeping its own copy', () => {
  const src = fs.readFileSync(path.join(__dirname, 'sweep-asset-captions.js'), 'utf8');
  assert.ok(/require\(['"]\.\.\/asset-guard['"]\)/.test(src),
    'sweep-asset-captions.js must require the shared prefix list');
  assert.ok(!/['"]drops\//.test(src.replace(/\/drops\/_\//g, '')),
    'the sweep must not hand-copy a prefix');
});

/* ─── the queries the caller is asked to pay for ──────────────────────────── */

t('only an undecided filing pays for the labeled-elsewhere query', () => {
  const q = (f) => G.needsElsewhereQuery(f);
  assert.strictEqual(q(caught(`${DECK}/movies/panels/a.png`)), true, 'the only unknown');
  assert.strictEqual(q(caught(`${DECK}/thumbs/a.webp`)), false, 'already refused');
  assert.strictEqual(q(caught(`${DECK}/drops/_/aa11bb22cc33dd44.jpg`)), false, 'already labeled');
  assert.strictEqual(q(caught(`${DECK}/a.png`, { description: 'hers' })), false, 'deliberate');
  assert.strictEqual(q({ chat: 'a', url: `${DECK}/a.png` }), false, 'prose delivery');
});

/* ─── THE ORDERING LIMIT, pinned as documentation-of-behaviour ────────────── */

t('ORDERING: catch first, deliberate filing second — BOTH exist, by design', () => {
  const url = `${DECK}/movies/panels/jonas_e04.png`;
  // 1. the background catch lands while nothing is labeled anywhere: allowed.
  const first = G.guardFiling(caught(url, { others: [] }));
  assert.strictEqual(first.block, false, 'nothing to see yet — it files');
  // 2. chat `jonas` then files it deliberately, with a label: always allowed.
  const second = G.guardFiling({
    chat: 'jonas', url, wip: true, description: 'Jonas — the toothy cookie',
    others: [{ chat: 'moon-milk', description: '' }],
  });
  assert.strictEqual(second.block, false);
  // So the stray survives, and the guard offers NOTHING to clean it up. That
  // is the honest limit: collapsing identical bytes is asset-union.js's job
  // and naming what is left is the sweep's. A strong net, not a proof.
  assert.strictEqual(first.reason, 'new');
});

/* ─── junk in, no throw out ───────────────────────────────────────────────── */

t('a malformed filing is judged, never thrown on', () => {
  for (const junk of [undefined, null, {}, { wip: true }, { wip: true, url: 42 },
    { wip: true, url: `${DECK}/a.png`, others: 'nope', description: 7 }]) {
    const v = G.guardFiling(junk);
    assert.strictEqual(typeof v.block, 'boolean');
    assert.strictEqual(typeof v.reason, 'string');
  }
});

/* ─── the route really calls it, on the create path only ──────────────────── */

t('POST /api/gallery consults the guard before adding a wip asset', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const branch = src.slice(src.indexOf('if (assetsOnly) {'));
  const call = branch.indexOf('assetGuard.guardFiling(');
  const add = branch.indexOf('acol.add(wipDoc)');
  assert.ok(call > 0 && add > call, 'the verdict is taken BEFORE the tile is created');
  assert.ok(branch.slice(call, add).includes('verdict.block'),
    'and a blocking verdict returns instead of writing');
  // The converge-on-an-existing-record path must stay upstream of all of it:
  // re-filing a url this chat already holds is never a new tile and never a
  // refusal (case c).
  assert.ok(branch.indexOf('const existing = await findChatAsset(') < call);
});

/* ─── a url that was never expanded ────────────────────────────────────────
 * 2026-08-19: a chat looping over real images printed `.../${slug}-dream.webp`
 * and `.../$u.webp` into its terminal output, and the background scan filed
 * BOTH as tiles — nameless, promptless, and pointing at nothing. Storage
 * object names cannot contain `$` or `{`, so the url's shape alone settles it.
 * This is the one refusal that does not depend on what else is on file, and it
 * applies to a LABELED filing too: a broken url is broken either way. */
t('an unexpanded ${var} in the path is refused, catch or not', () => {
  const shapes = [`${DECK}/dream-feed/raw-text/\${slug}-dream.webp`,
                  `${DECK}/dream-feed/followups/$u.webp`,
                  `${DECK}/a/{{id}}.png`];
  for (const url of shapes) {
    assert.ok(G.unresolvedUrl(url), `spotted as unresolved: ${url}`);
    const v = G.guardFiling(caught(url));
    assert.strictEqual(v.block, true, `refused: ${url}`);
    assert.strictEqual(v.reason, 'unresolved-url');
    // and a deliberate, labeled filing of the same broken url is refused too
    const labeled = G.guardFiling({ chat: 'moon-milk', url, wip: true,
      description: 'a real label', prompt: 'gpt-image-2 · medium' });
    assert.strictEqual(labeled.block, true, `labeled is refused too: ${url}`);
  }
});

t('a real storage url is never mistaken for one', () => {
  for (const url of [`${DECK}/dream-feed/raw-text/monkey-minimal-dream.webp`,
                     `${MEMBRY}/memo-audio/x.m4a`,
                     'https://example.com/whatever.png', '', null]) {
    assert.strictEqual(G.unresolvedUrl(url), false, String(url));
  }
  // and the ordinary verdict still comes back unchanged
  assert.deepStrictEqual(
    G.guardFiling(caught(`${DECK}/dream-feed/raw-text/monkey-minimal-dream.webp`)),
    { block: false, reason: 'new' });
});


// ---------------------------------------------------------------------------
// captionUpgrade — what a later filing may do to the caption already on file.
// The bug this pins (found live 2026-08-23): a caption could be SET but never
// CORRECTED, so re-POSTing a fix answered ok:true and changed nothing.
// ---------------------------------------------------------------------------

t('a curated caption CORRECTS another curated one', () => {
  // the exact case that found this: a cut panel captioned with its own pixels
  assert.strictEqual(
    G.captionUpgrade('gpt-image-2 · medium · 1168x1752', 'gpt-image-2 · medium · 1/4 (4K)'),
    'gpt-image-2 · medium · 1/4 (4K)');
  // and the whole pre-tier backlog: a raw canvas correcting to its rung
  assert.strictEqual(
    G.captionUpgrade('gpt-image-2 · medium · 1568x2352', 'gpt-image-2 · medium · 2K'),
    'gpt-image-2 · medium · 2K');
  // a mistyped quality is not permanent either
  assert.strictEqual(
    G.captionUpgrade('gpt-image-2 · high', 'gpt-image-2 · medium'), 'gpt-image-2 · medium');
});

t('it still lands on a blank or a generic record', () => {
  for (const old of ['', null, undefined, '   ', 'from playground-image-resolution']) {
    assert.strictEqual(G.captionUpgrade(old, 'gpt-image-2 · low · 1K'), 'gpt-image-2 · low · 1K',
      `over ${JSON.stringify(old)}`);
  }
});

t("the hook's generic catch NEVER overwrites anything", () => {
  // the case the old rule existed to stop, and the half that is kept
  assert.strictEqual(G.captionUpgrade('gpt-image-2 · medium · 2K', 'from some-other-chat'), null);
  assert.strictEqual(G.captionUpgrade('', 'from some-other-chat'), null);
  assert.strictEqual(G.captionUpgrade('from a', 'from b'), null);
});

t('nothing offered, or nothing new, is not a write', () => {
  assert.strictEqual(G.captionUpgrade('gpt-image-2 · medium', ''), null);
  assert.strictEqual(G.captionUpgrade('gpt-image-2 · medium', null), null);
  assert.strictEqual(G.captionUpgrade('gpt-image-2 · medium', undefined), null);
  // identical, including around whitespace — no pointless Firestore write
  assert.strictEqual(G.captionUpgrade('gpt-image-2 · medium', 'gpt-image-2 · medium'), null);
  assert.strictEqual(G.captionUpgrade('gpt-image-2 · medium', '  gpt-image-2 · medium  '), null);
});

t('server.js asks the shared helper, and keeps no copy of the rule', () => {
  // The condition used to be inline in server.js. If a future edit re-inlines
  // it, the three tests above go on passing while the live route does whatever
  // the copy says — which is exactly how this shipped wrong.
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.ok(/assetGuard\.captionUpgrade\(existing\.data\(\)\.prompt, prompt\)/.test(src),
    'the assetsOnly branch calls captionUpgrade');
  assert.ok(!/\/\^from \/\.test\(old\)/.test(src),
    'the old blank-only condition is gone from server.js');
});

console.log(`\n${n} checks passed.\n`);
