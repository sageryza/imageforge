// test-crystal-split.js — the splitter's derivation, without Firebase.
//
// deriveStones is the whole point of the module: it turns "which photos start a
// new stone" into the stone list every downstream step reads (the numbered
// grid, the listing writer, the re-shoot list). Its edge cases are the ones
// that would put a wrong number on a grid, so they're pinned here.
//
//   node scripts/test-crystal-split.js

const { deriveStones } = require('../crystals.js');

let pass = 0, fail = 0;
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n       got  ' + g + '\n       want ' + w); }
}

const photos = (n) => Array.from({ length: n }, (_, i) => ({
  id: 'p' + i, url: 'u' + i, media: 'image', photoIndex: i,
}));
const shape = (stones) => stones.map((s) => [s.n, s.photos.map((p) => p.id).join('')]);

// No marks at all is ONE stone, not zero — the album's first photo starts a
// stone by definition, or "unsplit" and "one stone" would be the same state.
check('no marks → one stone',
  shape(deriveStones(photos(4), { marks: [], skip: [], names: {}, treatment: {} })),
  [[1, 'p0p1p2p3']]);

check('marks cut the run',
  shape(deriveStones(photos(6), { marks: ['p2', 'p4'], skip: [], names: {}, treatment: {} })),
  [[1, 'p0p1'], [2, 'p2p3'], [3, 'p4p5']]);

// A mark on the first photo is redundant, never a leading empty stone.
check('mark on photo 0 is harmless',
  shape(deriveStones(photos(3), { marks: ['p0'], skip: [], names: {}, treatment: {} })),
  [[1, 'p0p1p2']]);

// The one that would corrupt a grid: skipping a group shot from the MIDDLE of
// a stone's run must not break that run in two.
check('skip inside a run keeps it whole',
  shape(deriveStones(photos(4), { marks: [], skip: ['p1'], names: {}, treatment: {} })),
  [[1, 'p0p2p3']]);

check('skip a whole stone drops it and renumbers',
  shape(deriveStones(photos(4), { marks: ['p2'], skip: ['p2', 'p3'], names: {}, treatment: {} })),
  [[1, 'p0p1']]);

// Numbering is positional, so removing stone 1 makes the old stone 2 into 1 —
// which is why a grid must be re-rendered after any re-split, never patched.
check('numbering is positional after a skip',
  shape(deriveStones(photos(4), { marks: ['p2'], skip: ['p0', 'p1'], names: {}, treatment: {} })),
  [[1, 'p2p3']]);

// Videos ride along with their stone but never count toward the 5-photo bar.
{
  const p = photos(6);
  p[1].media = 'video';
  const s = deriveStones(p, { marks: [], skip: [], names: {}, treatment: {} })[0];
  check('videos counted separately', [s.photoCount, s.videoCount, s.enoughForOwnListing], [5, 1, true]);
  check('cover skips a leading video',
    deriveStones([{ id: 'v', url: 'uv', media: 'video' }, { id: 'a', url: 'ua', media: 'image' }],
      { marks: [], skip: [], names: {}, treatment: {} })[0].cover, 'ua');
}

// 4 photos is a grid slot, not its own listing — this is the re-shoot flag.
check('under five photos is not enough for its own listing',
  deriveStones(photos(4), { marks: [], skip: [], names: {}, treatment: {} })[0].enoughForOwnListing,
  false);

// Names/treatment key off the stone's FIRST photo id, so they survive a mark
// added later in the album.
{
  const split = { marks: ['p2'], skip: [], names: { p2: 'Big yellow one' }, treatment: { p2: 'own', p0: 'grid' } };
  const s = deriveStones(photos(4), split);
  check('labels follow the start id', [s[0].treatment, s[1].name, s[1].treatment], ['grid', 'Big yellow one', 'own']);
  const later = deriveStones(photos(6), { ...split, marks: ['p2', 'p4'] });
  check('a later mark does not move earlier labels',
    [later[0].treatment, later[1].name, later[2].name], ['grid', 'Big yellow one', '']);
}

// An unknown treatment string is dropped rather than passed through — the POST
// route whitelists, and the deriver must not trust a doc written before that.
check('unknown treatment is ignored',
  deriveStones(photos(2), { marks: [], skip: [], names: {}, treatment: { p0: 'nonsense' } })[0].treatment, '');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
