#!/usr/bin/env node
// WHICH PROJECT A CHAT IS ON — project-words.js, pure, no network.
// (2026-09-02, Sophie: "projects could auto group themselves, like all the
// triset chats".)
//
// The fixture is shaped like her live registry the day this shipped: slugs the
// harness named subject-first, a fallback slug carrying only her display name,
// a renamed chat the sorter filed, an archived sibling and a deleted one.
//
//   node scripts/test-project-words.js

const P = require('../project-words');

let pass = 0; const fails = [];
function is(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  fails.push(`${name}\n    want ${w}\n    got  ${g}`);
}

const CHATS = {
  'triset-nature-classification': {},
  'triset-color-edition': { archived: true },
  'triset-chat-triangle-border': { labels: ['bug fix'] },
  'triset-multilevel-patterns': {},
  'triangle-playground-style': {},
  'triangle-card-cut': {},
  'triangle-x': {},
  'playground-a': {}, 'playground-b': {}, 'playground-c': {},
  'playground-back-to-top-01k54v': {},
  // a fallback slug with her name on it — joins by the NAME
  'chat-9cac7ca2': { displayName: 'playground arrow — stale page' },
  // a fallback slug with nothing — joins nothing
  'new-session-56f2b0': {},
  // renamed since; the sorter filed it
  'similitude-rules': { project: 'triset', projectBy: 'auto' },
  // deleted — never counted, never grouped
  'triset-binned': { deletedAt: '2026-09-01T00:00:00.000Z' },
  // a tombstone
  'triset-moved': { movedTo: 'triset-color-edition' },
  // words the harness leads with that are not projects
  'remove-thing': {}, 'remove-other': {}, 'missing-a': {}, 'missing-b': {},
  'lonely-chat-about-cats': {},
  // a style chat — leads 2, so a project of its own, but not one a mid-slug
  // "style" makes anyone else a member of
  'style-alpha': {}, 'style-beta': {},
};
const v = P.vocab(CHATS);

// ── the fold and the shapes ─────────────────────────────────────────────────
is('plurals fold', ['panels', 'reels', 'chats'].map(P.fold), ['panel', 'reel', 'chat']);
is('…but not -ss/-us/-is/-as', ['status', 'canvas', 'class', 'this'].map(P.fold), ['status', 'canvas', 'class', 'this']);
is('a fallback slug is one', ['chat-9cac7ca2', 'new-session-56f2b0', 'new-session', 'session'].map(P.isFallbackSlug), [true, true, true, true]);
is('a real slug is not', ['chat-icons', 'triset-color-edition'].map(P.isFallbackSlug), [false, false]);
is('a session tail is noise', P.tokens('playground-back-to-top-01k54v', {}), ['playground', 'back', 'top']);
is('a fallback slug contributes nothing, her name does', P.tokens('chat-9cac7ca2', CHATS['chat-9cac7ca2']), ['playground', 'arrow', 'stale']);

// ── the vocabulary ──────────────────────────────────────────────────────────
is('a word leading 2+ slugs is a project', [v.triset.project, v.triangle.project, v.playground.project], [true, true, true]);
is('the lead counts are the live ones', [v.triset.lead, v.triangle.lead, v.playground.lead], [4, 3, 4]);
is('a stop word never is', [v.remove, v.missing], [undefined, undefined]);
is('a lone lead word is not a group', v.lonely && v.lonely.project, false);
is('a filed project is in the vocabulary', v.triset.filed, 1);
is('deleted and tombstoned slugs are not counted', v.triset.lead, 4);
is('known projects, most used first', P.knownProjects(CHATS, v).slice(0, 3), ['triset', 'playground', 'triangle']);

// ── which projects a chat is on ─────────────────────────────────────────────
is('subject first', P.projectsOf('triset-chat-triangle-border', {}, v), ['triset', 'triangle']);
is('a two-project chat lists both, lead first', P.projectsOf('triangle-playground-style', {}, v), ['triangle', 'playground']);
is('a mid-slug word joins only an ESTABLISHED project', P.projectsOf('triangle-x', {}, v), ['triangle']);
is('…so "style" (lead 2) makes nobody else a member', P.projectsOf('triangle-playground-style', {}, v).indexOf('style'), -1);
is('…but leads its own two', P.projectsOf('style-alpha', {}, v), ['style']);
is('her name carries a fallback slug in', P.projectsOf('chat-9cac7ca2', CHATS['chat-9cac7ca2'], v), ['playground']);
is('a filed project leads', P.projectsOf('similitude-rules', CHATS['similitude-rules'], v), ['triset']);
is('a bare fallback slug is on nothing', P.projectsOf('new-session-56f2b0', {}, v), []);

// ── the group ───────────────────────────────────────────────────────────────
is('the triset group — slug leads, the filed one, the archived one; never the deleted or the tombstone',
  P.groupFor('triset', CHATS, v).sort(),
  ['similitude-rules', 'triset-chat-triangle-border', 'triset-color-edition', 'triset-multilevel-patterns', 'triset-nature-classification']);
is('the playground group — three leads, the tail-slug one, the fallback by name, the two-project chat',
  P.groupFor('playground', CHATS, v).sort(),
  ['chat-9cac7ca2', 'playground-a', 'playground-b', 'playground-back-to-top-01k54v', 'playground-c', 'triangle-playground-style']);
is('the button needs a group behind it', P.projectsWithGroups('lonely-chat-about-cats', CHATS, v), []);
is('…and gets each project with its size', P.projectsWithGroups('triangle-playground-style', CHATS, v).map((p) => p.key + ':' + p.chats.length), ['triangle:4', 'playground:6']);

// ── the sorter's answer → a key ─────────────────────────────────────────────
is('an answer folds to the key', ['Playground', 'the playground', 'playground chats', 'Panels'].map(P.keyOf), ['playground', 'playground', 'playground chat', 'panel']);
is('none is empty', ['none', '', null, 'N/A'].map(P.keyOf), ['', '', '', '']);
is('two words at most', P.keyOf('story room shelf thing'), ['story', 'room'].join(' '));

if (fails.length) { console.error('project words: ' + fails.length + ' FAILED\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('project words: ' + pass + ' checks passed');
