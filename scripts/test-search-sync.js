#!/usr/bin/env node
// test-search-sync.js — the rules that keep the Search index current.
//
//   node scripts/test-search-sync.js
//
// Pure: no Firestore, no Storage, no OpenAI key. Everything under test
// (planSync / applyPlan / countIndex / vectorState / rankByVector) takes the
// index and the libraries as plain objects, which is exactly why the append
// rules are written that way — the load-bearing one is that POSITIONS ARE
// NEVER RENUMBERED, and that is invisible in an end-to-end test.
//
// What it pins, and why each one is real:
//   · a new recording is appended, and every existing chunk keeps its position
//     (renumbering would silently re-point every embedding already paid for)
//   · a recording gone from the archive loses its SOURCE, never its slots
//   · an archive that can't be read is NOT an emptied archive (a wrong prune
//     removes real recordings from every result, silently)
//   · a memo with no transcript yet is skipped, and picked up later
//   · an interview doc with no transcript yet adds no source (or it would be
//     "already indexed" forever after)
//   · vectors are valid as a PREFIX, so a just-filed memo can't break meaning
//     search for the whole library
//   · a chunk with no vector yet, and a chunk whose source was dropped, are
//     never scored
//   · a stale vector file is named STALE and not "nothing embedded" — they
//     report the same count, and the page acts on which one it is

process.env.SEARCH_EMBED_MODEL = process.env.SEARCH_EMBED_MODEL || 'text-embedding-3-small';
const search = require('../search');

let failed = 0;
function ok(name, cond, extra) {
  if (cond) { console.log('  ✓', name); return; }
  failed++;
  console.log('  ✗', name, extra === undefined ? '' : `\n      ${JSON.stringify(extra)}`);
}
const eq = (name, a, b) => ok(name, a === b, { got: a, want: b });

// ── fixtures ────────────────────────────────────────────────────────
// An index as it looks after a build: two memos and one interview, positions
// 0..N assigned once.
function fixtureIndex() {
  const sources = {
    'm:2026-01-01_0900': { k: 'memo', id: '2026-01-01_0900', title: 'the first one', date: '2026-01-01' },
    'm:2026-01-02_0900': { k: 'memo', id: '2026-01-02_0900', title: 'the second one', date: '2026-01-02' },
    'v:vid1': { k: 'nde', id: 'vid1', title: 'an interview' },
  };
  const chunks = [
    { s: 'm:2026-01-01_0900', t: null, x: 'the first recording says this' },
    { s: 'm:2026-01-02_0900', t: null, x: 'the second recording says this' },
    { s: 'v:vid1', t: 0, x: 'and the interview says this' },
  ];
  chunks.forEach((c, i) => { c.i = i; });
  const index = { version: 1, builtAt: '2026-08-01T00:00:00.000Z', sources, chunks };
  index.counts = search.countIndex(index);
  return index;
}

const memoRecord = (id, transcript, extra = {}) => ({
  id, date: id.slice(0, 10), title: `memo ${id}`, dur: 60, transcript, ...extra,
});

const archive = () => [
  memoRecord('2026-01-01_0900', 'the first recording says this'),
  memoRecord('2026-01-02_0900', 'the second recording says this'),
];

// ── appending ───────────────────────────────────────────────────────
console.log('appending what the index is missing');
{
  const index = fixtureIndex();
  const before = index.chunks.map((c) => ({ i: c.i, s: c.s, x: c.x }));
  const memos = [...archive(), memoRecord('2026-08-11_1200', 'the one she recorded last week about the ocean')];

  const plan = search.planSync({ index, memos, ndeIds: ['vid1'] });
  eq('one new source', Object.keys(plan.sources).length, 1);
  ok('it is the new memo', !!plan.sources['m:2026-08-11_1200']);
  ok('it brought chunks', plan.chunks.length >= 1, plan.chunks.length);
  eq('nothing dropped', plan.drop.length, 0);
  eq('the first new position continues the index', plan.chunks[0].i, before.length);

  search.applyPlan(index, plan);
  const kept = before.every((b) => index.chunks[b.i] && index.chunks[b.i].x === b.x && index.chunks[b.i].s === b.s);
  ok('EVERY existing chunk kept its position (this is what keeps the vectors valid)', kept);
  eq('counts follow', index.counts.chunks, before.length + plan.chunks.length);
  eq('memo sources counted', index.counts.memo, 3);
  eq('nothing dead yet', index.counts.dead, 0);
  ok('the sync is stamped', !!index.syncedAt && index.syncs === 1);

  // Running it again with the same libraries must be a no-op — otherwise every
  // check would append the whole archive over again.
  const second = search.planSync({ index, memos, ndeIds: ['vid1'] });
  eq('a second pass adds nothing', second.chunks.length, 0);
  eq('a second pass drops nothing', second.drop.length, 0);
}

console.log('a recording with no words yet');
{
  const index = fixtureIndex();
  const memos = [...archive(), memoRecord('2026-08-12_1200', null)];
  const plan = search.planSync({ index, memos, ndeIds: ['vid1'] });
  eq('skipped while it has no transcript', Object.keys(plan.sources).length, 0);
  eq('and not dropped either', plan.drop.length, 0);

  // …and picked up once the enrich retry lands its words.
  const later = search.planSync({
    index,
    memos: [...archive(), memoRecord('2026-08-12_1200', 'the words arrived on a retry')],
    ndeIds: ['vid1'],
  });
  ok('picked up when the words arrive', !!later.sources['m:2026-08-12_1200']);
}

console.log('a new interview');
{
  const index = fixtureIndex();
  const withWords = {
    id: 'vid2',
    doc: { title: 'a second interview', experiencerName: 'Darius', transcript: { segments: [{ start: 0, text: 'he starts talking' }, { start: 31, text: 'and keeps going' }] } },
  };
  const empty = { id: 'vid3', doc: { title: 'downloaded but not transcribed yet' } };
  const plan = search.planSync({ index, memos: archive(), ndeIds: ['vid1', 'vid2', 'vid3'], ndeDocs: [withWords, empty] });
  ok('the transcribed one is added', !!plan.sources['v:vid2']);
  ok('the untranscribed one adds NO source (or it is "indexed" forever)', !plan.sources['v:vid3']);
  ok('its chunks carry the source key', plan.chunks.every((c) => c.s === 'v:vid2'));
  eq('nothing dropped', plan.drop.length, 0);
}

// ── pruning ─────────────────────────────────────────────────────────
console.log('a recording that is gone');
{
  const index = fixtureIndex();
  const plan = search.planSync({
    index,
    memos: [memoRecord('2026-01-01_0900', 'the first recording says this')],
    ndeIds: ['vid1'],
  });
  eq('the missing one is dropped', plan.drop.length, 1);
  eq('by source key', plan.drop[0], 'm:2026-01-02_0900');
  eq('nothing appended', plan.chunks.length, 0);

  const positions = index.chunks.map((c) => c.i);
  search.applyPlan(index, plan);
  ok('its source is gone', !index.sources['m:2026-01-02_0900']);
  ok('its chunk is STILL in place — dropping a source never renumbers',
    index.chunks.map((c) => c.i).join() === positions.join());
  eq('and it counts as dead', index.counts.dead, 1);
  eq('the live chunk count is unchanged', index.counts.chunks, 3);
}

console.log('an archive that could not be read is not an empty archive');
{
  const index = fixtureIndex();
  const plan = search.planSync({ index, memos: null, ndeIds: null });
  eq('nothing dropped when the manifest read failed', plan.drop.length, 0);
  const plan2 = search.planSync({ index, memos: [], ndeIds: [] });
  eq('nothing dropped on an empty answer either', plan2.drop.length, 0);
}

console.log('a restamped recording');
{
  // restampRecord gives a record a new id; to an id-keyed index that is one
  // gone and one arrived, and both halves have to happen in ONE pass.
  const index = fixtureIndex();
  const plan = search.planSync({
    index,
    memos: [
      memoRecord('2026-01-01_0900', 'the first recording says this'),
      memoRecord('2021-05-04_1830', 'the second recording says this', { restampedFrom: '2026-01-02_0900' }),
    ],
    ndeIds: ['vid1'],
  });
  eq('the old id is dropped', plan.drop[0], 'm:2026-01-02_0900');
  ok('the new id is added', !!plan.sources['m:2021-05-04_1830']);
}

// ── vectors ─────────────────────────────────────────────────────────
console.log('what the vector file is worth');
{
  const index = fixtureIndex();
  const base = { model: 'text-embedding-3-small', dims: 512, builtAt: index.builtAt };
  eq('none when there is no vector file', search.vectorState(index, null).state, 'none');
  eq('current when it covers every chunk', search.vectorState(index, { ...base, chunks: 3 }).state, 'current');

  const partial = search.vectorState(index, { ...base, chunks: 2 });
  eq('partial when the sync appended past it', partial.state, 'partial');
  eq('and it says how many are waiting', partial.pending, 1);
  eq('and how many are usable', partial.embedded, 2);

  eq('stale after a rebuild moved every position',
    search.vectorState(index, { ...base, chunks: 3, builtAt: '2026-07-01T00:00:00.000Z' }).state, 'stale');
  eq('stale if the model changed under them',
    search.vectorState(index, { ...base, chunks: 3, model: 'something-else' }).state, 'stale');
  eq('stale if the dimensions changed',
    search.vectorState(index, { ...base, chunks: 3, dims: 256 }).state, 'stale');
}

console.log('what meaning search says when it cannot answer');
{
  const index = fixtureIndex();
  const base = { model: 'text-embedding-3-small', dims: 512, builtAt: index.builtAt };
  const codeFor = (meta) => {
    const err = search.meaningBlock(search.vectorState(index, meta));
    return err ? err.code : null;
  };
  eq('nothing embedded', codeFor(null), 'no-vectors');
  // A stale file reports embedded:0 just like a missing one, so asking "is it
  // empty" before "is it stale" turns every rebuild into 'no-vectors' and the
  // page stops being able to tell her the passages moved.
  eq('stale is named as stale, not as missing',
    codeFor({ ...base, chunks: 3, builtAt: '2026-07-01T00:00:00.000Z' }), 'stale-vectors');
  eq('a partial file answers', codeFor({ ...base, chunks: 2 }), null);
  eq('a complete one answers', codeFor({ ...base, chunks: 3 }), null);
}

console.log('ranking only scores what really has a vector');
{
  const DIMS = 512;
  const index = fixtureIndex();
  // Chunk 0 points one way, chunks 1 and 2 the other. If the ranker read past
  // `embedded` it would score chunk 2 out of untouched zero bytes.
  const data = new Int8Array(index.chunks.length * DIMS);
  for (let c = 0; c < index.chunks.length; c++) data[c * DIMS + (c === 0 ? 0 : 1)] = 127;
  const qv = new Float32Array(DIMS); qv[0] = 1;

  const all = search.rankByVector(index, qv, data, { embedded: 3 });
  eq('every embedded chunk is scored', all.length, 3);
  eq('the closest one wins', all[0].c.i, 0);

  const partial = search.rankByVector(index, qv, data, { embedded: 2 });
  eq('the unembedded tail is left out', partial.length, 2);
  ok('and it is the tail that is missing', !partial.some((s) => s.c.i === 2));

  const filtered = search.rankByVector(index, qv, data, { embedded: 3, kind: 'memo' });
  eq('the kind filter still applies', filtered.length, 2);

  delete index.sources['m:2026-01-01_0900'];
  const pruned = search.rankByVector(index, qv, data, { embedded: 3 });
  eq('a dropped source is unreachable', pruned.length, 2);
  ok('including the one that would have ranked first', !pruned.some((s) => s.c.i === 0));
}

console.log(failed ? `\n${failed} failed` : '\nall good');
process.exit(failed ? 1 : 0);
