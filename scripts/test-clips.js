#!/usr/bin/env node
// test-clips.js — the Chunking library's pure half, against fixtures. No
// network, no Firebase, no ffmpeg: this drives the search grammar, the naming
// rules and the sweep's skip list, which are the parts that decide what Sophie
// can find and what ends up on her shelf.
//
//   node scripts/test-clips.js

const assert = require('assert');
const clips = require('../clips');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (err) { console.error(`  FAIL ${name}\n       ${err.message}`); process.exitCode = 1; }
}

// A small library that looks like the real one: a movie's scenes, a
// quick-animate, and a chat's hand-built short swept out of Storage.
const LIB = [
  {
    id: 'a1', url: 'https://x/a1.mp4', title: 'Jonas finds the crumbs',
    tags: ['movie'], text: 'a boy in a striped jumper crouching over cookie crumbs on a kitchen floor',
    notes: '', source: { kind: 'movie', id: 'jonas-cookie-crumbs', title: 'Jonas and the Cookie Crumbs' },
    seconds: 5, createdAt: 300, poster: 'https://x/a1.webp',
  },
  {
    id: 'a2', url: 'https://x/a2.mp4', title: 'Jonas at the window',
    tags: ['movie', 'alt'], text: 'the same boy looking out at rain, wide shot',
    notes: 'too dark', source: { kind: 'movie', id: 'jonas-cookie-crumbs', title: 'Jonas and the Cookie Crumbs' },
    seconds: 5, createdAt: 200, poster: 'https://x/a2.webp',
  },
  {
    id: 'b1', url: 'https://x/b1.mp4', title: 'Crow on a bench',
    tags: ['quick'], text: 'a crow hopping along a park bench at dusk',
    notes: '', source: { kind: 'quick', id: 'q1', title: 'Quick animate' },
    seconds: 4, createdAt: 400, poster: null,
  },
  {
    id: 'c1', url: 'https://x/c1.mp4', title: 'Hospital Corridor',
    tags: ['hospital-film', 'pairs'], text: '',
    notes: 'use this one for the opening', source: { kind: 'storage', id: 'hospital-film/pairs', title: 'hospital-film' },
    seconds: 6, createdAt: 500, poster: 'https://x/c1.webp', hidden: false,
  },
  {
    id: 'd1', url: 'https://x/d1.mp4', title: 'An old take', tags: ['movie'], text: '',
    notes: '', source: { kind: 'movie', id: 'm2', title: 'The Worm Sickle' },
    seconds: 9, createdAt: 100, hidden: true,
  },
];
const find = (q, opts = {}) => clips.searchClips(LIB, { q, ...opts }).clips.map((c) => c.id);

console.log('search grammar');
t('bare terms are ANDed', () => {
  assert.deepStrictEqual(find('jonas jumper'), ['a1']);
  assert.deepStrictEqual(find('jonas'), ['a1', 'a2']);
  assert.deepStrictEqual(find('jonas hospital'), []);
});
t('a bare term reaches the source, so the film name finds its scenes', () => {
  // Both scenes came out of "Jonas and the Cookie Crumbs", so a bare "crumbs"
  // finds the pair even though only one of them draws crumbs. That is the
  // point of searching the source — `title:crumbs` is how you narrow it.
  assert.deepStrictEqual(find('crumbs').sort(), ['a1', 'a2']);
  assert.deepStrictEqual(find('title:crumbs'), ['a1']);
});
t('OR binds tighter than the implicit AND', () => {
  // jonas AND (jumper OR rain) — one Jonas clip each, and nothing else.
  assert.deepStrictEqual(find('jonas jumper OR rain').sort(), ['a1', 'a2']);
  assert.deepStrictEqual(find('jumper OR crow').sort(), ['a1', 'b1']);
  assert.deepStrictEqual(find('jumper OR nothinghere'), ['a1']);
});
t('-term and NOT exclude', () => {
  assert.deepStrictEqual(find('jonas -window'), ['a1']);
  assert.deepStrictEqual(find('jonas NOT window'), ['a1']);
  assert.deepStrictEqual(find('-jonas').sort(), ['b1', 'c1']);
});
t('"quoted phrases" stay whole', () => {
  assert.deepStrictEqual(find('"park bench"'), ['b1']);
  assert.deepStrictEqual(find('"bench park"'), []);
});
t('tag: searches only the tags', () => {
  assert.deepStrictEqual(find('tag:movie').sort(), ['a1', 'a2']);
  assert.deepStrictEqual(find('tag:alt'), ['a2']);
  // "quick" is a tag on b1 and appears nowhere else — as a tag: term it must
  // not pick up a clip that merely mentions the word.
  assert.deepStrictEqual(find('tag:quick'), ['b1']);
});
t('title: searches only the title', () => {
  // "crow" is in b1's title AND its prompt; "rain" is only in a2's prompt, so
  // title:rain must find nothing.
  assert.deepStrictEqual(find('title:crow'), ['b1']);
  assert.deepStrictEqual(find('title:rain'), []);
  assert.deepStrictEqual(find('rain'), ['a2']);
});
t('from: is the film it came out of', () => {
  assert.deepStrictEqual(find('from:cookie').sort(), ['a1', 'a2']);
  assert.deepStrictEqual(find('from:hospital'), ['c1']);
});
t('prompt: and note: reach the other two fields', () => {
  assert.deepStrictEqual(find('prompt:jumper'), ['a1']);
  assert.deepStrictEqual(find('note:opening'), ['c1']);
  assert.deepStrictEqual(find('note:crow'), []);
});
t('an unknown prefix is treated as text, not dropped', () => {
  // "colour:crow" is not a field — the whole token searches as words, so the
  // crow clip still comes back rather than the query silently matching nothing.
  assert.deepStrictEqual(find('colour:crow'), []);
  assert.deepStrictEqual(find('hospital:corridor'), ['c1']);
});
t('substring matching finds the word inside a longer one', () => {
  assert.deepStrictEqual(find('cook').sort(), ['a1', 'a2']);
});
t('an empty query returns the library, newest first', () => {
  assert.deepStrictEqual(find(''), ['c1', 'b1', 'a1', 'a2']);
});

console.log('ranking');
t('a title hit outranks a prompt hit', () => {
  // "crow" is b1's title and nothing else's; add a term that hits a1's prompt
  // only, and b1 must still lead on its own.
  const [first] = find('crow');
  assert.strictEqual(first, 'b1');
});
t('a query ranks by score, not by date', () => {
  // c1 is the newest clip, but "jonas" does not touch it at all.
  assert.ok(!find('jonas').includes('c1'));
  // Both Jonas clips match "jonas"; the one whose TITLE also hits leads over
  // the one that only hits in its prompt, whichever is newer.
  assert.strictEqual(find('jonas window')[0], 'a2');
});
t('sort=new overrides ranking, sort=short/long use the clock', () => {
  assert.deepStrictEqual(clips.searchClips(LIB, { q: 'jonas', sort: 'new' }).clips.map((c) => c.id), ['a1', 'a2']);
  assert.deepStrictEqual(clips.searchClips(LIB, { sort: 'long' }).clips.map((c) => c.id)[0], 'c1');
  assert.deepStrictEqual(clips.searchClips(LIB, { sort: 'short' }).clips.map((c) => c.id)[0], 'b1');
});

console.log('filters, hiding and paging');
t('hidden clips stay out unless asked for', () => {
  assert.ok(!find('').includes('d1'));
  assert.ok(clips.searchClips(LIB, { q: '', hidden: true }).clips.map((c) => c.id).includes('d1'));
});
t('tag= and source= filter alongside the query', () => {
  assert.deepStrictEqual(clips.searchClips(LIB, { tag: 'movie' }).clips.map((c) => c.id), ['a1', 'a2']);
  assert.deepStrictEqual(clips.searchClips(LIB, { tag: 'movie,alt' }).clips.map((c) => c.id), ['a2']);
  assert.deepStrictEqual(clips.searchClips(LIB, { source: 'hospital-film' }).clips.map((c) => c.id), ['c1']);
});
t('total counts the whole result, not the page', () => {
  const r = clips.searchClips(LIB, { q: '', limit: 2 });
  assert.strictEqual(r.clips.length, 2);
  assert.strictEqual(r.total, 4);
  assert.strictEqual(clips.searchClips(LIB, { q: '', limit: 2, offset: 2 }).clips.length, 2);
});
t('facets count tags and sources, biggest first', () => {
  const f = clips.facetsOf(LIB);
  assert.strictEqual(f.tags[0].name, 'movie');
  assert.strictEqual(f.tags[0].count, 2);
  assert.ok(f.sources.some((s) => s.name === 'Jonas and the Cookie Crumbs' && s.count === 2));
  // A hidden clip's tags must not inflate the chips.
  assert.ok(!clips.facetsOf(LIB).tags.some((x) => x.count > 2));
});
t('the internal haystack never leaks into a response', () => {
  const [c] = clips.searchClips(LIB, { q: 'crow' }).clips;
  assert.ok(!('__hay' in c));
  assert.ok(JSON.stringify(c).indexOf('__hay') === -1);
});

console.log('naming a swept file');
t('a readable filename becomes the title', () => {
  assert.strictEqual(clips.titleFromPath('witch-shorts/rules-review-room/opening-shot.mp4'), 'Opening Shot');
  assert.strictEqual(clips.titleFromPath('exile-film/clips/scene_03_river.mp4'), 'Scene 03 River');
});
t('a hash filename falls back to the folder and the date', () => {
  const title = clips.titleFromPath('hospital-film/pairs/9f3a1c22b7de44aa91cc.mp4', Date.parse('2026-07-27T12:00:00Z'));
  assert.ok(/^Pairs · Jul 27$/.test(title), title);
});
t('the folders become tags, so "which film" filters for free', () => {
  assert.deepStrictEqual(clips.tagsFromPath('hospital-film/pairs/x.mp4'), ['hospital-film', 'pairs']);
  assert.deepStrictEqual(clips.tagsFromPath('a.mp4'), []);
});
t('tags are normalised and capped', () => {
  assert.deepStrictEqual(clips.cleanTags([' Movie ', 'movie', 'Two Words', '']), ['movie', 'two-words']);
  assert.strictEqual(clips.cleanTags(Array.from({ length: 40 }, (_, i) => `t${i}`)).length, 24);
});

console.log('the sweep skip list');
t('finished films, renders, the Dump and the encode cache are not clips', () => {
  for (const p of [
    'movies/films/x.mp4', 'scratchpad/films/x.mp4', 'scratchpad/film-cache/abc.mp4',
    'nde-clips/supercuts/x.mp4', 'cutmarks/x.mp4', 'drops/2026-07-27-0337/IMG_1.MOV',
    'witch-shorts/combined/x.mp4', 'clips/posters/x.mp4',
  ]) assert.ok(clips.sweepSkips(p), `should skip ${p}`);
});
t('a real clip prefix is swept', () => {
  for (const p of [
    'exile-film/clips/01.mp4', 'hospital-film/pairs/x.mp4', 'movies/clips/x.mp4',
    'witch-shorts/believing-the-worst/a.mp4', 'nde-anim/pastel/b.mp4',
  ]) assert.ok(!clips.sweepSkips(p), `should sweep ${p}`);
});
t('a non-video is never swept', () => {
  assert.ok(clips.sweepSkips('exile-film/clips/01.png'));
  assert.ok(clips.sweepSkips('exile-film/clips/01.mp3'));
});

console.log('what a PATCH may change');
t('only Sophie\'s fields survive cleanPatch', () => {
  const p = clips.cleanPatch({ title: 'New name', tags: ['A'], notes: 'hi', hidden: true, url: 'https://evil', seconds: 99, poster: 'x' });
  assert.deepStrictEqual(Object.keys(p).sort(), ['hidden', 'notes', 'tags', 'title']);
  assert.deepStrictEqual(p.tags, ['a']);
});
t('a title is capped rather than refused', () => {
  assert.strictEqual(clips.cleanPatch({ title: 'x'.repeat(500) }).title.length, 140);
});

console.log(`\n${passed} checks passed`);
