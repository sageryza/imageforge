#!/usr/bin/env node
// HIDE-THE-✕'d AND ITS DEFAULT, PER SURFACE (2026-09-14, Sophie: "default to
// hide x"; 2026-09-15, "filter changed · change back · playground").
//
// It opened ON everywhere from #2399 and she took the PLAYGROUND back off a
// day later — that feed is her history, where a ✕ means "not that one" rather
// than "file it away", so a fresh page opened with runs missing. The other
// four kept the new default.
//
// SO THE DEFAULT IS A COLUMN IN THE TABLE BELOW, not a fact about the pattern.
// That is the whole reason this file survives the split: one page differing on
// purpose reads exactly like one page drifting, and only a table that names
// which is which can tell them apart.
//
// The ♥/✕ pair is ONE pattern ported across five feeds, and each feed keeps its
// own little reader because only three of the five load /feedkit.js — so
// nothing but this file would notice one of them drifting, and a filter that
// means two different things on two identical-looking controls is the drift
// this repo keeps getting burned by.
//
// Every check RUNS the real reader lifted out of the real page against a fake
// localStorage, rather than matching its text: a reader that reads perfectly
// and answers the old default looks exactly the same in the source.
//
//   node scripts/test-hide-x-default.js

const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (msg, cond) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) bad += 1; };

// The store the page really sees: absent is `null`, and her tap writes '1'
// (on) or '' (off) — never removes the key.
const store = (v) => ({ getItem: () => v, setItem: () => {} });

function lift(file, name) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');
  const line = src.split('\n').find((l) => new RegExp('function\\s+' + name + '\\s*\\(').test(l));
  if (!line) throw new Error(file + ': no ' + name + '() — did it move off its own line?');
  return line.trim();
}

// `call` is how that page asks its own reader for the hide-✕ answer, and
// `dflt` is what that page answers a phone that has never touched it.
const PAGES = [
  // THE ONE THAT OPENS OFF, at her word (2026-09-15) — see the note at the top.
  { file: 'promptlab.html', name: 'hideX', call: 'hideX()', liked: 'likedOnly()', likedName: 'likedOnly', key: 'promptlab_hidex', dflt: false },
  { file: 'footage.html', name: 'hideX', call: 'hideX()', liked: 'likedOnly()', likedName: 'likedOnly', key: 'footage_hidex', dflt: true },
  { file: 'freeform.html', name: 'hideX', call: 'hideX()', liked: 'likedOnly()', likedName: 'likedOnly', key: 'freeform_hidex', dflt: true },
  { file: 'voice.html', name: 'hideX', call: 'hideX()', liked: 'likedOnly()', likedName: 'likedOnly', key: 'voicelab_hidex', dflt: true },
  // Stitch reads both marks through ONE helper, so the default rides the CALL
  // (`markState('stitch_hidex', true)`) and hearts-only must not inherit it.
  { file: 'stitch.html', name: 'markState', call: "markState('stitch_hidex', true)", liked: "markState('stitch_liked')", likedName: 'markState', key: 'stitch_hidex', dflt: true },
];

console.log('\nTHE READER — each page\'s own default, and her tap over it');
for (const p of PAGES) {
  const fn = lift(p.file, p.name);
  const ask = (v) => new Function('localStorage', fn + '\n return ' + p.call + ';')(store(v));
  ok(p.file + ': a phone that never touched it answers ' + p.dflt, ask(null) === p.dflt);
  ok(p.file + ': her ON is still on', ask('1') === true);
  ok(p.file + ': and her OFF is still off — the default never comes back over her tap', ask('') === false);
}
// FOUR ON, ONE OFF — asserted as a COUNT so that "they all drifted back to
// off" can never pass as "the Playground is the exception".
ok('the split is exactly one page off and four on',
  PAGES.filter((p) => p.dflt === false).map((p) => p.file).join() === 'promptlab.html'
  && PAGES.filter((p) => p.dflt === true).length === 4);

console.log('\nTHE HEART IS UNTOUCHED — hearts-only is still OFF by default');
for (const p of PAGES) {
  const fn = lift(p.file, p.likedName);
  const ask = (v) => new Function('localStorage', fn + '\n return ' + p.liked + ';')(store(v));
  ok(p.file + ': a fresh page keeps every picture that is not crossed out', ask(null) === false);
  ok(p.file + ': and her ON is on', ask('1') === true);
}

console.log('\nTHE WRITE STILL STORES \'1\' AND \'\' — so the reader and the writer mean one thing');
for (const p of PAGES) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', p.file), 'utf8');
  // Either the page writes the pair inline, or it writes through a helper that
  // does; both spellings have to keep '1' for on and '' for off, because the
  // reader above tells them apart by exactly those two values.
  const inline = new RegExp("setItem\\('" + p.key + "',\\s*\\S+ \\? '' : '1'\\)").test(src);
  const helper = /function markSet\(k, v\) \{ try \{ localStorage\.setItem\(k, v \? '1' : ''\);/.test(src);
  // Voice Studio picks the key off the tapped box and writes through it, so
  // the pair is spelled once for both marks — the key still has to be there.
  const viaKey = /setItem\(key,\s*was \? '' : '1'\)/.test(src) && src.indexOf("'" + p.key + "'") >= 0;
  ok(p.file + ': on is \'1\', off is \'\'', inline || helper || viaKey);
}

console.log(bad ? '\nFAILED ' + bad : '\nAll good.');
process.exit(bad ? 1 : 0);
