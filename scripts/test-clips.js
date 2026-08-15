#!/usr/bin/env node
// test-clips.js — the Chunking library's pure functions. No network, no
// Firebase: the search matching, the sweep's skip decisions, the title
// fallback, and the her-edits-always-win merge.

const assert = require('assert');
const {
  parseClipQuery, matchClip, sweepVerdict, titleFromPath, mergeClip, clean,
  gatherFromMovies, gatherFromQuick, MAX_SWEEP_BYTES,
} = require('../clips');

let n = 0;
function t(name, fn) { fn(); n++; console.log(`  ok — ${name}`); }

const clip = (over = {}) => ({
  title: 'Jonas finds the crumbs', from: 'Jonas and the Cookie Crumbs',
  kind: 'scene', tags: ['kitchen', 'night'], prompt: 'slow zoom on the cookie jar, camera drifts left',
  note: null, ...over,
});
const match = (q, c) => matchClip(c, parseClipQuery(q));

console.log('search matching (the house grammar, clip-library rules):');

t('bare words AND within one clip, any order', () => {
  assert.ok(match('crumbs jonas', clip()));
  assert.ok(!match('crumbs witch', clip()));
});

t('OR takes either', () => {
  assert.ok(match('witch OR crumbs', clip()));
  assert.ok(!match('witch OR spell', clip()));
});

t('-word excludes', () => {
  assert.ok(!match('jonas -kitchen', clip()));
  assert.ok(match('jonas -witch', clip()));
});

t('"quoted phrase" needs adjacency, punctuation never decides', () => {
  assert.ok(match('"cookie jar"', clip()));
  assert.ok(!match('"jar cookie"', clip()));
  assert.ok(match('"drifts left"', clip({ prompt: 'camera DRIFTS — left!' })));
});

t('substring matching — dictation should not need exact word edges', () => {
  assert.ok(match('crumb', clip()));
});

t('fielded search: tag:/title:/from:/prompt:/kind:/note:', () => {
  assert.ok(match('tag:kitchen', clip()));
  assert.ok(!match('tag:jonas', clip()));           // jonas is a title, not a tag
  assert.ok(match('title:jonas', clip()));
  assert.ok(match('from:cookie', clip()));
  assert.ok(match('prompt:zoom', clip()));
  assert.ok(!match('prompt:kitchen', clip()));
  assert.ok(match('kind:scene', clip()));
  assert.ok(match('note:redo', clip({ note: 'redo this one darker' })));
});

t('an unknown prefix is literal text, not a silent field', () => {
  assert.ok(match('jam:cookie', clip({ title: 'jam cookie special' })));
  assert.ok(!match('jam:cookie', clip()));
});

t('fields combine with bare words', () => {
  assert.ok(match('kind:bridge waiting', clip({ kind: 'bridge', from: 'Dreams of Waiting' })));
  assert.ok(!match('kind:bridge waiting', clip({ from: 'Dreams of Waiting' })));
});

console.log('\nthe sweep skip list (measured 2026-08-15):');

t('non-clips are refused by prefix', () => {
  for (const name of [
    'drops/2026-07-27-0337/a.mp4',        // the Dump
    'nde-audio/rvfOUg4zVc0.webm',         // a whole interview
    'nde-episodes/proof-ep1-v4.mp4',      // a finished episode
    'movies/films/final.mp4',             // stitched films
    'movies/clips/s1.mp4',                // the Firestore half owns these
    'scratchpad/film-cache/beat3.mp4',    // the pad's still-encode cache
    'writing-notes/probe_c0.webm',        // voice notes
    'clip-library/posters/abc.mp4',       // our own folder
  ]) assert.ok(!sweepVerdict(name, 1000).sweep, name);
});

t('chats’ shorts sweep in', () => {
  for (const name of [
    'witch-shorts/believing-the-worst/cut1.mp4',
    'story-shorts/songs-aug-2/verse.mp4',
    'hospital-film/pairs/p3.mp4',
    'two-panel-gallery/clips/left-07.mp4',
    'dinner-party/takes/take-2.mov',
  ]) assert.ok(sweepVerdict(name, 1000).sweep, name);
});

t('only video extensions, and nothing over the size cap', () => {
  assert.ok(!sweepVerdict('witch-shorts/poster.webp', 1000).sweep);
  assert.ok(!sweepVerdict('witch-shorts/audio.mp3', 1000).sweep);
  assert.ok(!sweepVerdict('dinner-party/out/final.mp4', MAX_SWEEP_BYTES + 1).sweep);
  assert.ok(sweepVerdict('dinner-party/takes/t.mp4', MAX_SWEEP_BYTES - 1).sweep);
});

console.log('\ntitles:');

t('a readable basename becomes the name', () => {
  assert.strictEqual(titleFromPath('witch-shorts/believing-the-worst/final-cut.mp4', 0), 'final cut');
});

t('an opaque basename falls back to folder + date', () => {
  const made = Date.UTC(2026, 6, 30, 12);
  assert.strictEqual(titleFromPath('apiframe-video/1785822151895-aodp89.mp4', made), 'apiframe video · Jul 30');
  assert.strictEqual(titleFromPath('hoonie/a3f9c2d1b8e4.mov', made), 'hoonie · Jul 30');
});

console.log('\nher edits always win:');

t('an untouched title refreshes; a touched one never does', () => {
  const fresh = { title: 'scene 3', tags: [], from: 'Film', kind: 'scene', prompt: 'p' };
  const untouched = { title: 'old name', editedFields: [] };
  assert.strictEqual(mergeClip(untouched, fresh).title, 'scene 3');
  const touched = { title: 'the blue kitchen one', editedFields: ['title'] };
  assert.strictEqual(mergeClip(touched, fresh).title, undefined);
});

t('her tags survive a re-harvest; note and hidden are never the harvest’s', () => {
  const fresh = { title: 't', tags: ['auto'], from: 'F', kind: 'short', prompt: null, note: 'x', hidden: true };
  const hers = { tags: ['favorites'], note: 'keep', hidden: true, editedFields: ['tags'] };
  const patch = mergeClip(hers, fresh);
  assert.strictEqual(patch.tags, undefined);
  assert.ok(!('note' in patch) && !('hidden' in patch));
});

t('an identical re-harvest writes nothing', () => {
  const same = { title: 't', tags: ['a'], from: 'F', kind: 'scene', prompt: 'p', editedFields: [] };
  assert.deepStrictEqual(mergeClip(same, { title: 't', tags: ['a'], from: 'F', kind: 'scene', prompt: 'p' }), {});
});

t('PATCH whitelist: only title/tags/note/hidden, tags split on commas', () => {
  const out = clean({ title: 'x', tags: 'a, b,,c', note: 'n', hidden: 1, url: 'EVIL', seconds: 99 });
  assert.deepStrictEqual(out, { title: 'x', tags: ['a', 'b', 'c'], note: 'n', hidden: true });
});

console.log('\ngathering:');

t('movies yield scenes, kept re-rolls and bridges with their prompts', () => {
  const recs = gatherFromMovies([{
    title: 'Dreams of Waiting',
    scenes: [
      { id: 's1', title: 'The window', clip: { url: 'u1', promptUsed: 'rain drifts' }, clipHistory: [{ url: 'u0', promptUsed: 'old take' }] },
      { id: 's2', title: 'The door' },
    ],
    bridges: [{ toSceneId: 's2', clip: { url: 'u2', promptUsed: 'melt between' } }],
  }]);
  assert.strictEqual(recs.length, 3);
  assert.deepStrictEqual(recs.map((r) => r.kind), ['scene', 'reroll', 'bridge']);
  assert.strictEqual(recs[0].prompt, 'rain drifts');
  assert.strictEqual(recs[1].title, 'The window · earlier take 1');
  assert.strictEqual(recs[2].title, 'dream bridge — The door');
  assert.ok(recs.every((r) => r.from === 'Dreams of Waiting'));
});

t('quick-animates title themselves from their prompt', () => {
  const recs = gatherFromQuick([
    { clipUrl: 'q1', prompt: 'the cat slowly opens one eye and stares directly into the camera lens', createdAt: '2026-07-01T00:00:00Z' },
    { clipUrl: 'q2' },
    { prompt: 'no clip yet' },
  ]);
  assert.strictEqual(recs.length, 2);
  assert.strictEqual(recs[0].title, 'the cat slowly opens one eye and stares');
  assert.strictEqual(recs[1].title, 'quick animate');
});

console.log(`\nall ${n} passing`);
