#!/usr/bin/env node
// test-search-grammar.js — the Chats app's search grammar, pure. No network,
// no Firestore, no browser: `compileQuery`/`queryMatches`/`snippetAnchor` are
// the whole decision, so they can be tested directly.
//
// The case that prompted all of this (Sophie, Aug 2026): two words she knows
// shared ONE message, where one of the words appears in hundreds of others.
// Before this, the box searched the whole query as one literal phrase, so that
// search returned nothing at all.
//
//   node scripts/test-search-grammar.js

const assert = require('assert');
const { compileQuery, queryMatches, snippetAnchor } = require('../chatfeed');

let pass = 0;
const group = (name) => console.log(name);
const ok = (label, fn) => {
  try { fn(); pass++; console.log('  ok  ' + label); }
  catch (e) { console.log('  FAIL ' + label + '\n       ' + e.message); process.exitCode = 1; }
};
const hit = (q, text) => queryMatches(text, compileQuery(q));

// A message where "prompt" is everywhere and "raincoat" is the rare word —
// the shape of every search she described.
const MSG = [
  'Filed the prompt for every image. The prompt overlay opens on content now,',
  'and the prompt split is style / content. The picture is a woman in a yellow',
  'raincoat feeding crows.',
].join('\n');

group('two words, same message (the ask)');
ok('both words present, apart, in any order', () => {
  assert.ok(hit('prompt raincoat', MSG));
  assert.ok(hit('raincoat prompt', MSG));
});
ok('a message with only one of them does not match', () => {
  assert.ok(!hit('prompt raincoat', 'Filed the prompt for every image.'));
  assert.ok(!hit('prompt raincoat', 'a yellow raincoat, feeding crows'));
});
ok('three words all have to land', () => {
  assert.ok(hit('prompt raincoat crows', MSG));
  assert.ok(!hit('prompt raincoat bicycle', MSG));
});

group('the rest of the grammar');
ok('a quoted phrase is adjacent, the old behaviour', () => {
  assert.ok(hit('"prompt overlay"', MSG));
  assert.ok(!hit('"prompt raincoat"', MSG));
});
ok('a phrase still matches across a line break', () => {
  assert.ok(hit('"yellow raincoat"', MSG));
});
ok('-word excludes', () => {
  assert.ok(!hit('prompt -raincoat', MSG));
  assert.ok(hit('prompt -bicycle', MSG));
});
ok('OR takes either, and binds tighter than the implicit AND', () => {
  assert.ok(hit('raincoat OR bicycle', MSG));
  assert.ok(hit('bicycle OR raincoat', MSG));
  // prompt AND (bicycle OR raincoat)
  assert.ok(hit('prompt bicycle OR raincoat', MSG));
  assert.ok(!hit('bicycle raincoat OR crows', MSG));
});

group('what the old search got right, kept');
ok('a term is anchored at a word start', () => {
  assert.ok(!hit('aries', 'she wrote about boundaries'));
  assert.ok(hit('bound', 'she wrote about boundaries'));
});
ok('case never matters', () => {
  assert.ok(hit('RAINCOAT prompt', MSG));
});
ok('punctuation inside a term survives', () => {
  assert.ok(hit('gpt-image-2 medium', 'ran gpt-image-2 at medium quality'));
  assert.ok(hit('/api/gallery', 'POST /api/gallery filed it'));
});
ok('a single word behaves exactly as it always did', () => {
  assert.ok(hit('raincoat', MSG));
  assert.ok(!hit('raincoats', MSG));
});

group('nothing to search');
ok('an empty or operator-only query compiles to no groups', () => {
  assert.strictEqual(compileQuery('').length, 0);
  assert.strictEqual(compileQuery('   ').length, 0);
  assert.strictEqual(compileQuery('OR AND').length, 0);
});
ok('a query of pure punctuation never throws', () => {
  assert.doesNotThrow(() => compileQuery('*** ([') );
  assert.doesNotThrow(() => hit('*** ([', MSG));
});

group('the snippet opens on the RARE word');
ok('the common word is skipped for the one that found it', () => {
  const at = snippetAnchor(MSG, compileQuery('prompt raincoat'));
  assert.strictEqual(MSG.slice(at.i, at.i + at.len), 'raincoat');
});
ok('one word anchors on itself', () => {
  const at = snippetAnchor(MSG, compileQuery('crows'));
  assert.strictEqual(MSG.slice(at.i, at.i + at.len), 'crows');
});
ok('an excluded term never anchors the snippet', () => {
  const at = snippetAnchor(MSG, compileQuery('prompt -bicycle'));
  assert.strictEqual(MSG.slice(at.i, at.i + at.len).toLowerCase(), 'prompt');
});
ok('a term that is not in the text anchors nothing', () => {
  assert.strictEqual(snippetAnchor('nothing here', compileQuery('raincoat')), null);
});

group('the snippet opens on a WHOLE word, not a prefix');
// 2026-08-28, from her `red dress` search: `red` is anchored at a word start
// and nowhere else, so it legitimately matches "redraw" — and the window
// opened there, 2,000 characters from the only "dress", on a row that had
// matched BOTH her words. A rarity tie, broken by whichever she typed first.
const RED = "say so and I'll redraw the mother. " + 'x'.repeat(300) + ' She is in a red dress.';
// Her row exactly: ONE `red`, inside "redraw", and ONE `dress`, whole — a
// rarity tie, which the old rule broke by taking the term she typed first.
const TIE = "say so and I'll redraw the mother. " + 'x'.repeat(300) + ' She is wearing the dress.';
ok('a prefix hit loses to the whole word she typed', () => {
  const at = snippetAnchor(TIE, compileQuery('red dress'));
  assert.strictEqual(TIE.slice(at.i, at.i + at.len).toLowerCase(), 'dress');
});
ok('a term prefers its own whole-word hit over an earlier prefix one', () => {
  const at = snippetAnchor(RED, compileQuery('red'));
  assert.strictEqual(RED.slice(at.i - 1, at.i + at.len + 1).toLowerCase(), ' red ');
});
ok('a prefix hit still anchors when it is all there is', () => {
  const at = snippetAnchor('nothing but a redraw here', compileQuery('red'));
  assert.strictEqual(at.i, 14);
});

group('a window for each word she typed');
// 2026-08-28, the half the whole-word rule cannot reach: `red dress` on a row
// holding "redraw" 2,000 characters from "dressed" — NEITHER is a whole word,
// so no ordering of one window shows her both. She gets one each.
const { snippetOf, snippetWindows } = require('../chatfeed');
const FAR = "I'll redraw the mother. " + 'x'.repeat(400) + ' She is dressed for a party.';
ok('two words far apart get a window each', () => {
  const out = snippetOf(FAR, compileQuery('red dress'));
  assert.ok(/redraw/.test(out), 'the first word is missing: ' + out);
  assert.ok(/dressed/.test(out), 'the second word is missing: ' + out);
  assert.ok(/… …/.test(out), 'the two windows were not cut apart: ' + out);
  assert.ok(out.length < FAR.length / 2, 'the whole message came back: ' + out.length);
});
ok('the pair still fits the row', () => {
  assert.ok(snippetOf(FAR, compileQuery('red dress')).length <= 220);
});
ok('words NEAR each other stay one window, with one ellipsis pair', () => {
  const NEAR = 'x'.repeat(200) + ' she is in a red dress at the party ' + 'y'.repeat(200);
  const out = snippetOf(NEAR, compileQuery('red dress'));
  assert.strictEqual(snippetWindows(NEAR, compileQuery('red dress')).length, 1);
  assert.ok(/red dress/.test(out), out);
});
ok('one word is one window, exactly as before', () => {
  assert.strictEqual(snippetWindows(MSG, compileQuery('raincoat')).length, 1);
});
ok('an excluded term gets no window of its own', () => {
  assert.strictEqual(snippetWindows(MSG, compileQuery('prompt -bicycle')).length, 1);
});

console.log('\n' + pass + ' checks passed');
