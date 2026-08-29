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
const { swapArt, forgetArt } = require('../pad-art');

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

// ── THE CULL: taking one picture off a beat ─────────────────────────
// (2026-08-28, Sophie: "how to cull beat pictures".) swapArt never deletes,
// which is right for a swap and left no answer for a picture that landed on
// the wrong beat.
{
  const slot = {
    url: 'C', src: { prompt: 'c' },
    imageHistory: [{ url: 'A', at: 1, src: { prompt: 'a' } }, { url: 'B', at: 2 }],
  };
  const gone = forgetArt(slot, 'A');
  ok(gone && gone.url === 'A', 'it hands back what was taken off');
  ok(gone.src && gone.src.prompt === 'a', 'with the run that made it, so the trash can name it');
  ok(slot.url === 'C', 'an older picture leaves the beat\'s art alone');
  ok(urls(slot).join() === 'B', 'and comes out of the row (' + urls(slot).join() + ')');
}
{
  // The current one: "no, not that one" shows the previous one.
  const slot = {
    url: 'C', src: { prompt: 'c' }, gen: { id: 'g' },
    imageHistory: [{ url: 'A', at: 1 }, { url: 'B', at: 2, src: { prompt: 'b' } }],
  };
  const gone = forgetArt(slot, 'C');
  ok(gone.src && gone.src.prompt === 'c', 'culling the current one banks its own src');
  ok(slot.url === 'B', 'the NEWEST picture in the row takes its place');
  ok(slot.src && slot.src.prompt === 'b', 'carrying its own provenance, never the culled one\'s');
  ok(urls(slot).join() === 'A', 'and it is out of the row, so nothing shows twice');
  ok(slot.gen === undefined, 'a finished draw record cannot outlive the picture it drew');
}
{
  // The last picture: the side is simply left with none — a normal state.
  const slot = { url: 'A', src: { prompt: 'a' } };
  forgetArt(slot, 'A');
  ok(slot.url === undefined && slot.src === undefined, 'the last picture leaves the side empty');
  ok(slot.off === undefined, 'and NEVER `off` — that would take the beat off this side');
  ok(slot.imageHistory === undefined, 'with no empty history array left behind');
}
{
  // Provenance that would be a lie is dropped, exactly as swapArt drops it.
  const slot = { url: 'C', src: { prompt: 'c' }, imageHistory: [{ url: 'B', at: 2 }] };
  forgetArt(slot, 'C');
  ok(slot.url === 'B' && slot.src === undefined,
    'a promoted picture with no src of its own carries none');
}
{
  const slot = { url: 'C', imageHistory: [{ url: 'B', at: 1 }] };
  ok(forgetArt(slot, 'NOPE') === null, 'a picture this beat does not have is a no-op');
  ok(all(slot).join() === 'C,B', 'and nothing moved');
  ok(forgetArt(slot, '') === null, 'so is no url at all');
}
{
  // Defensive: a row must never be left showing what the cull was asked to
  // take off it, however it came to be in there twice.
  const slot = { url: 'X', imageHistory: [{ url: 'B', at: 1 }, { url: 'B', at: 2 }] };
  forgetArt(slot, 'B');
  ok(urls(slot).length === 0, 'every entry carrying that url goes, not just the first');
}
{
  const slot = { kind: 'clip', url: 'film.mp4', poster: 'p.jpg', seconds: 4 };
  ok(forgetArt(slot, 'film.mp4') === null, 'a clip is refused — removing one is the beat\'s own delete');
  ok(slot.url === 'film.mp4' && slot.kind === 'clip', 'and the slot is untouched');
}

console.log(failures ? '\n' + failures + ' FAILED' : '\nall good');
process.exit(failures ? 1 : 0);
