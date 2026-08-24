#!/usr/bin/env node
// PICKING AN OLDER PICTURE BACK — pad-art.js, pure, no node_modules needed.
// (Sophie, 2026-08-24: "make the past picture thumbnails so that I can
// actually pick one".)
//
// The two rules the past-pictures row lives or dies by:
//   1. the picture LEAVING is kept — nothing here ever deletes one,
//   2. the picture ARRIVING comes OUT of the history — a url in both places
//      draws TWICE in that row, once ringed as current and once as older,
//      which is exactly the bug a naive pick ships.
// Plus: provenance follows the picture, and a clip slot becomes a picture
// slot rather than rendering an image url as a film.
//
//   node scripts/test-pad-art.js
const { swapArt } = require('../pad-art');

let failures = 0;
function ok(cond, name) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}
const urls = (slot) => (slot.imageHistory || []).map((h) => h.url);
const all = (slot) => [slot.url].concat(urls(slot));

// ── she picks the oldest of three back ──────────────────────────────
{
  const slot = {
    url: 'C', src: { prompt: 'c' },
    imageHistory: [{ url: 'A', at: 1, src: { prompt: 'a' } }, { url: 'B', at: 2 }],
  };
  swapArt(slot, 'A', null, 10);
  ok(slot.url === 'A', 'the one she picked is the current picture');
  ok(urls(slot).indexOf('A') < 0, 'and it is no longer in the past pictures');
  ok(urls(slot).indexOf('C') >= 0, 'the one it replaced is kept');
  ok(all(slot).length === 3, 'still three pictures in total — nothing was deleted');
  ok(new Set(all(slot)).size === 3, 'and none of them shows twice');
  ok(slot.src && slot.src.prompt === 'a', 'its own prompt came back with it');
  const cKept = (slot.imageHistory || []).find((h) => h.url === 'C');
  ok(Boolean(cKept && cKept.src && cKept.src.prompt === 'c'),
    'the picture that stepped aside was banked WITH its prompt');
}

// ── picking one that was banked before src was stored ────────────────
{
  const slot = { url: 'C', src: { prompt: 'c' }, imageHistory: [{ url: 'B', at: 2 }] };
  swapArt(slot, 'B', null, 10);
  ok(slot.src === undefined,
    'an unknown provenance is DROPPED, never the previous picture\'s');
}

// ── a fresh draw ────────────────────────────────────────────────────
{
  const slot = { url: 'C', src: { prompt: 'c' } };
  swapArt(slot, 'D', { prompt: 'd' }, 10);
  ok(slot.url === 'D' && slot.src.prompt === 'd', 'the new picture and its own run');
  ok(urls(slot).join() === 'C', 'the one it replaced is now the only past picture');
}

// ── re-picking what is already current changes nothing ──────────────
{
  const slot = { url: 'C', imageHistory: [{ url: 'B', at: 2 }] };
  swapArt(slot, 'C', null, 10);
  ok(slot.url === 'C' && urls(slot).join() === 'B',
    'picking the current picture neither duplicates it nor grows the row');
}

// ── picking the same one twice ───────────────────────────────────────
{
  const slot = { url: 'C', imageHistory: [{ url: 'B', at: 2 }] };
  swapArt(slot, 'B', null, 10);
  swapArt(slot, 'B', null, 11);
  ok(all(slot).length === 2 && new Set(all(slot)).size === 2,
    'a double tap is idempotent — two pictures, no twins');
}

// ── a slot with no history at all ───────────────────────────────────
{
  const slot = {};
  swapArt(slot, 'A', null, 10);
  ok(slot.url === 'A' && slot.imageHistory === undefined,
    'an empty slot takes a picture and grows no empty history array');
}

// ── a clip slot becomes a picture slot ──────────────────────────────
{
  const slot = { kind: 'clip', url: 'film.mp4', poster: 'p.jpg', seconds: 4, title: 't', clipId: 'x', off: true };
  swapArt(slot, 'A', null, 10);
  ok(slot.kind === undefined && slot.poster === undefined && slot.clipId === undefined,
    'every clip field is gone — an image url can never render as a film');
  ok(slot.url === 'A', 'the picture is in');
  ok(!slot.imageHistory, 'and the film was never banked as a past PICTURE');
  ok(slot.off === undefined, 'art here again un-deletes this side');
}

// ── a junk entry cannot break the row ───────────────────────────────
{
  const slot = { url: 'C', imageHistory: [null, { url: 'B', at: 1 }, {}] };
  swapArt(slot, 'B', null, 10);
  ok(urls(slot).filter(Boolean).join() === 'C', 'empty entries are swept, not carried');
}

console.log(failures ? '\n' + failures + ' FAILED' : '\nall good');
process.exit(failures ? 1 : 0);
