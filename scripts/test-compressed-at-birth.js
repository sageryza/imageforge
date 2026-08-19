#!/usr/bin/env node
/*
 * test-compressed-at-birth.js — the COMPRESSED AT BIRTH decision table, and the
 * one place the flag could silently go missing.
 *
 * Pure: no network, no credentials, no Firestore. It drives the real classify()
 * out of scripts/tag-compressed-at-birth.js and the real union out of
 * asset-union.js with fixture records, the same way
 * scripts/test-asset-hash-union.js does.
 *
 * WHAT IS ACTUALLY WORTH PINNING HERE. Two things, and neither is the happy
 * path:
 *
 *   1. THE POLICY ORDER. Reading the writer of every flagged prefix moved 519
 *      of 579 held-back pictures OUT of the write (2026-08-19) — her scanned
 *      drawings, her own uploads, and a derived page whose original art sits
 *      beside it. If NEVER ever stops beating the bpp screen, this script puts
 *      a confident false claim on 519 of Sophie's pictures, and nothing in the
 *      app would look wrong.
 *   2. THE UNION'S OR. The tag reaches a record by url or by md5, but a chat's
 *      Assets tab shows ONE tile per picture. If the flag did not survive the
 *      merge, a damaged picture whose labelled copy was tagged and whose twin
 *      was not would show up unmarked exactly half the time, depending on which
 *      record happened to seed the tile.
 *
 *   node scripts/test-compressed-at-birth.js
 */
'use strict';

const assert = require('assert');
const tagger = require('./tag-compressed-at-birth');
const { unionAssets, assetRecord, creationRecord } = require('../asset-union');

const DECK = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app';
const MEMBRY = 'https://storage.googleapis.com/membry-df528.firebasestorage.app';

let pass = 0;
const t = (name, fn) => {
  try { fn(); console.log('  ok  ', name); pass += 1; }
  catch (e) { console.error('  FAIL', name, '\n       ', e.message); process.exitCode = 1; }
};

// A full-size webp object. 1024x1536 clears FULL_PX; bpp is passed in.
const obj = (name, bpp) => ({ name, bpp, w: 1024, h: 1536, size: 1, md5: 'x' });

console.log('\nTHE DECISION TABLE\n');

t('a low-bpp generated picture is damaged', () => {
  assert.strictEqual(tagger.classify(obj('promptlab/runs/abc.webp', 1.4)), 'damaged');
});

t('a full-quality picture is clean', () => {
  assert.strictEqual(tagger.classify(obj('promptlab/runs/abc.webp', 11.2)), 'clean');
});

t('a small display copy is clean even at a terrible bpp', () => {
  // under FULL_PX on the long edge — a thumbnail, whose original is elsewhere
  assert.strictEqual(tagger.classify({ name: 'x/y.webp', bpp: 0.9, w: 480, h: 640 }), 'clean');
});

t('an unreadable header is clean, never a guess', () => {
  assert.strictEqual(tagger.classify({ name: 'x/y.webp', bpp: 0, w: 0, h: 0 }), 'clean');
});

console.log('\nNEVER BEATS THE SCREEN — the 519\n');

// Each of these encodes BELOW the cut and would be tagged by bits per pixel
// alone. Every one has a full-quality original somewhere else.
[
  ['refs-sheet/richard-scarry-1.webp', 'her reference images (originals committed in refs/)'],
  ['ingest/hospital-pj-photos/img_1.webp', 'her own photographs'],
  ['chat-feed/icons/star.webp', 'deliberate display chrome'],
  ['drops/dinner-party/3.webp', 'the Dump'],
  ['crystals/album-2/stone.webp', "her mom's crystals, photographed"],
  ['witch-tarot/the-fool.webp', "Wikimedia's 1909 Rider-Waite scans"],
  ['sagediagram/april_004.webp', 'her scanned drawings, re-encoded by the captioner'],
  ['story/evan-page-2.webp', 'sync-story.js uploads her local files verbatim'],
  ['storybook/marla/pages/p01.webp', 'the composed page; the art PNG sits beside it'],
].forEach(([name, why]) => {
  t(`never tagged — ${why}`, () => {
    assert.strictEqual(tagger.classify(obj(name, 1.2)), 'never');
  });
});

console.log('\nPROVEN BEATS THE SCREEN — provenance over bits per pixel\n');

t('the four dream-feed q80 files tag ABOVE the cut', () => {
  // measured 2.77–3.48 bpp: the screen alone would have called every one clean
  ['halloween-raw-dream', 'halloween-raw-sage', 'mountain-raw-dream', 'halloween-herline-sage']
    .forEach((n) => {
      assert.strictEqual(
        tagger.classify(obj(`dream-feed/raw-text/${n}.webp`, 3.48)), 'damaged',
        `${n} must be tagged on provenance, not on its bpp`);
    });
});

t('miracles/ tags whatever the bpp — its writer is .webp({quality: 82})', () => {
  assert.strictEqual(tagger.classify(obj('miracles/uid/id/a.webp', 9.9)), 'damaged');
});

t('PROVEN is a prefix list, so a whole prefix is covered', () => {
  assert.strictEqual(tagger.classify(obj('miracles/other-uid/z/deep.webp', 12.0)), 'damaged');
});

t('a NEVER prefix still wins over a low bpp inside it', () => {
  // storybook/marla/ is DERIVED; nothing about a bad bpp there makes it damaged
  assert.strictEqual(tagger.classify(obj('storybook/marla/pages/p09.webp', 0.7)), 'never');
});

console.log('\nA REPAIRED WRITER ONLY DAMAGED WHAT IT MADE BEFORE THE FIX\n');

t('an art-mason panel from before the fix is damaged', () => {
  // both renderers say .webp({lossless:true}) TODAY, but `lossless` landed in
  // eb5c981 at 2026-08-19 20:44Z and every one of those 80 objects was written
  // 08-02 to 08-10. Reading the writer alone would have cleared all 39.
  assert.strictEqual(tagger.classify({
    name: 'story-shorts/art-mason/v2/panel-1-v2.webp',
    bpp: 0.05, w: 1024, h: 1536, created: '2026-08-05T00:00:00.000Z',
  }), 'damaged');
});

t('…and one made AFTER the fix is clean, however small it encodes', () => {
  // flat panel art encodes far under the cut while being perfectly intact
  assert.strictEqual(tagger.classify({
    name: 'story-shorts/art-mason/v2/panel-9-v2.webp',
    bpp: 0.05, w: 1024, h: 1536, created: '2026-08-20T00:00:00.000Z',
  }), 'clean');
});

t('a prefix with no fix on record is judged by the screen as before', () => {
  assert.strictEqual(tagger.classify({
    name: 'promptlab/runs/x.webp', bpp: 1.4, w: 1024, h: 1536,
    created: '2026-08-20T00:00:00.000Z',
  }), 'damaged');
});

console.log('\nHOLD REPORTS, IT DOES NOT WRITE\n');

t('HOLD is empty now — every held prefix was resolved by reading its writer', () => {
  assert.deepStrictEqual(tagger.HOLD, [],
    'a prefix added back to HOLD must come with a reason in the header');
});

t('a held prefix would be reported, never tagged', () => {
  // drive the real classify with a temporary hold entry
  tagger.HOLD.push('unknown-thing/');
  try {
    assert.strictEqual(tagger.classify(obj('unknown-thing/a.webp', 1.1)), 'hold');
  } finally { tagger.HOLD.pop(); }
});

console.log('\nTHE FLAG SURVIVES THE UNION — one picture, one tile, one truth\n');

t('a tagged twin marks the labelled tile it folds into', () => {
  // The labelled original was tagged by url; its claude-deliveries copy was
  // tagged by md5. Either one alone must mark the tile.
  const labeled = assetRecord({
    url: `${DECK}/art/portrait.png`, description: 'The portrait', md5: 'aaaa',
    created: '2026-08-14T10:00:00.000Z',
  });
  const twin = assetRecord({
    url: `${MEMBRY}/claude-deliveries/9z.png`, md5: 'aaaa', compressedAtBirth: true,
    created: '2026-08-14T10:00:01.000Z',
  });
  const tiles = unionAssets([labeled, twin]);
  assert.strictEqual(tiles.length, 1, 'the twin must fold into one tile');
  assert.strictEqual(tiles[0].description, 'The portrait', 'the label must survive');
  assert.strictEqual(tiles[0].compressedAtBirth, true,
    'the flag must survive the merge — otherwise the mark shows only half the time');
});

t('…and in the other arrival order too', () => {
  const twin = assetRecord({
    url: `${MEMBRY}/claude-deliveries/9z.png`, md5: 'bbbb', compressedAtBirth: true,
    created: '2026-08-14T10:00:00.000Z',
  });
  const labeled = assetRecord({
    url: `${DECK}/art/portrait.png`, description: 'The portrait', md5: 'bbbb',
    created: '2026-08-14T10:00:01.000Z',
  });
  assert.strictEqual(unionAssets([twin, labeled])[0].compressedAtBirth, true);
});

t('an untagged picture is never marked by a neighbour', () => {
  const a = assetRecord({ url: `${DECK}/a/one.png`, md5: 'c1', created: '2026-08-14T10:00:00.000Z' });
  const b = assetRecord({ url: `${DECK}/b/two.png`, md5: 'c2', compressedAtBirth: true,
    created: '2026-08-14T10:00:01.000Z' });
  const tiles = unionAssets([a, b]).sort((x, y) => x.ms - y.ms);
  assert.strictEqual(tiles.length, 2, 'different md5 must stay two tiles');
  assert.strictEqual(tiles[0].compressedAtBirth, false, 'the clean picture stays clean');
  assert.strictEqual(tiles[1].compressedAtBirth, true);
});

t('a clean picture reads false, not undefined', () => {
  // the server emits the key only when true, so the tile must be explicit
  const tile = unionAssets([assetRecord({ url: `${DECK}/a/x.png`, created: '2026-08-14T10:00:00.000Z' })])[0];
  assert.strictEqual(tile.compressedAtBirth, false);
});

t('both record adapters carry the flag', () => {
  assert.strictEqual(assetRecord({ url: 'u', compressedAtBirth: true }).compressedAtBirth, true);
  assert.strictEqual(
    creationRecord({ url: 'u', compressedAtBirth: true, createdAt: { toMillis: () => 1 } }).compressedAtBirth,
    true, 'the iOS gallery leg is how a membry-only tag reaches the web tab');
});

console.log(`\n${pass} checks passed.\n`);
