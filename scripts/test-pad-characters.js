#!/usr/bin/env node
// CHARACTER REFERENCES ON A STORY — pad-characters.js, pure, no node_modules
// needed (2026-08-26, Sophie: "attach one or more character references …
// I pick one or multiple of the characters that are for the story so it's
// two taps to add a character instead of one, and there's only one button
// not multiple").
//
// What lives or dies here:
//   1. with NOTHING picked every prompt is byte-for-byte what it was —
//      charLine([]) must be the empty string;
//   2. the disclosed line says "NOT a style reference" — the pastel prefix
//      claims every attached image as a style reference and the dreamy
//      suffix re-asserts its own, so the carve-out must be explicit;
//   3. the pick keeps the STORY's order, dedupes, drops unknown ids (a
//      stale page after a remove must not fail a draw), and is capped;
//   4. an unnamed character still gets a stable fallback name.
//
//   node scripts/test-pad-characters.js
const fs = require('fs');
const path = require('path');
const {
  MAX_CHARACTERS, MAX_PICKED, normalizeCharacters, pickCharacters, charLine,
} = require('../pad-characters');

let failures = 0;
function ok(cond, name) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}

// ── charLine ────────────────────────────────────────────────────────
ok(charLine([]) === '', 'no characters → an EMPTY line, so untouched draws are byte-for-byte');
ok(charLine(null) === '', 'and a missing list is the same empty line');

const one = charLine([{ id: 'a', name: 'Mason', url: 'https://x/a.png' }]);
ok(one.startsWith(' '), 'the line leads with a space — it appends to a prefix or suffix');
ok(one.includes('NOT a style reference'), 'one character: carves itself out of the style claim explicitly');
ok(one.includes('Mason'), 'and names the character');
ok((one.match(/Mason/g) || []).length >= 2, 'the name is said twice — once as the label, once as the drawing rule');

const two = charLine([
  { id: 'a', name: 'Mason', url: 'https://x/a.png' },
  { id: 'b', name: 'Penny', url: 'https://x/b.png' },
]);
ok(two.includes('2 attached images'), 'two characters: the line counts them');
ok(two.includes('Mason, Penny'), 'and names them IN ORDER — the order they attach in');
ok(two.includes('NOT style references'), 'plural carve-out too');

const unnamed = charLine([{ id: 'a', name: '', url: 'https://x/a.png' }]);
ok(unnamed.includes('character 1'), 'an unnamed character gets a stable fallback, never an empty name');

// ── normalizeCharacters ─────────────────────────────────────────────
ok(normalizeCharacters(null).length === 0, 'no list → empty, never a throw');
ok(normalizeCharacters([{ id: 'a', url: 'notaurl' }]).length === 0, 'a record with no http(s) url is dropped');
ok(normalizeCharacters([{ url: 'https://x/a.png' }]).length === 0, 'a record with no id is dropped');
{
  const n = normalizeCharacters([{ id: 1, name: 42, url: 'https://x/a.png' }])[0];
  ok(n.id === '1' && n.name === '42', 'id and name come out as strings whatever went in');
}
{
  const big = Array.from({ length: MAX_CHARACTERS + 10 }, (_, i) => ({ id: `c${i}`, url: 'https://x/a.png' }));
  ok(normalizeCharacters(big).length === MAX_CHARACTERS, `the cast is capped at ${MAX_CHARACTERS}`);
}
{
  const long = normalizeCharacters([{ id: 'a', name: 'x'.repeat(200), url: 'https://x/a.png' }])[0];
  ok(long.name.length === 60, 'a name is capped at 60 characters');
}

// ── pickCharacters ──────────────────────────────────────────────────
const cast = [
  { id: 'a', name: 'Mason', url: 'https://x/a.png' },
  { id: 'b', name: 'Penny', url: 'https://x/b.png' },
  { id: 'c', name: 'Evan', url: 'https://x/c.png' },
];
{
  const p = pickCharacters(cast, ['c', 'a']);
  ok(p.length === 2 && p[0].id === 'a' && p[1].id === 'c',
    'the pick keeps the STORY’s order, not the tap order');
}
ok(pickCharacters(cast, ['a', 'a', 'a']).length === 1, 'a doubled id picks once');
ok(pickCharacters(cast, ['ghost']).length === 0, 'an id the story doesn’t know is dropped — a stale page never fails a draw');
ok(pickCharacters(cast, []).length === 0 && pickCharacters(cast, null).length === 0,
  'nothing picked → nothing rides');
{
  const big = Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, url: 'https://x/a.png' }));
  const p = pickCharacters(big, big.map((c) => c.id));
  ok(p.length === MAX_PICKED, `a draw carries at most ${MAX_PICKED} — every reference is paid input tokens`);
}

// ── the wiring is real, not assumed (source pins) ───────────────────
const srv = fs.readFileSync(path.join(__dirname, '..', 'scratchpad.js'), 'utf8');
ok(srv.includes("require('./pad-characters')"), 'scratchpad.js reads the ONE copy of these rules');
ok(srv.includes('characters: normalizeCharacters(v.characters)'), 'readPad serves the cast to the page');
ok(/charLine\(picked\)/.test(srv), 'runArtJob discloses the picked characters in the sent prompt');
ok(/\.concat\(await charRefs\(picked\)\)/.test(srv), 'and attaches them LAST, behind the style refs');
ok(srv.includes("router.post('/character'"), 'the add/rename route exists');
ok(srv.includes("router.post('/character/remove'"), 'and the remove route');

const page = fs.readFileSync(path.join(__dirname, '..', 'public', 'scratchpad.html'), 'utf8');
ok(page.includes('id="dchars"'), 'the draw row carries the ONE picker button');
ok((page.match(/id="dchars"/g) || []).length === 1, 'and only one — her rule');
ok(page.includes('id="charsheet"'), 'the Characters sheet exists');
ok(page.includes('id="charsbtn"'), 'and its door at the top of the story');
ok(page.includes('characters:pickedChars'), 'the draw POST carries the picked ids');
ok(page.includes("api('/drop/upload-file'") === false, 'sanity: the page uploads through /api/drop/upload-file directly');
ok(page.includes("/api/drop/upload-file"), 'character bytes ride the Dump’s upload route — never a second upload path');

console.log(failures ? `\n${failures} FAILED` : '\nall good');
process.exit(failures ? 1 : 0);
