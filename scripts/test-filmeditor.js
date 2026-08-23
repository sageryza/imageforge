#!/usr/bin/env node
// test-filmeditor.js — the Film Editor's pure pieces (no network), plus the
// static page contracts. Run: node scripts/test-filmeditor.js
//
// The pure half drives filmeditor.js's exported functions: the piece
// normalizer (clamping, sliver-dropping, unknown lengths staying null), the
// split arithmetic (two references into one source, refusal near the edges),
// the audio-track normalizer, and the mix graph (normalize=0 is load-bearing
// — amix's default halves both voices).
// The page half asserts the contracts that keep shipping broken when skipped:
// the IIFE, the [hidden] rule, no gradients, the title once, empty boxes.

const fs = require('fs');
const path = require('path');

const fe = require('../filmeditor');

let pass = 0;
let failCount = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ok — ' + name); }
  else { failCount++; console.log('  FAIL — ' + name); }
}

console.log('cleanPieces:');
{
  const c = fe.cleanPieces([
    { key: 'a', url: 'https://x/y.mp4', seconds: 10, in: 0, out: 10, title: 't', poster: null },
    { key: 'b', url: 'https://x/y.mp4', seconds: 10, in: 2.5, out: 7.25 },
    { key: 'sliver', url: 'https://x/y.mp4', seconds: 10, in: 5, out: 5.05 },
    { key: 'nourl', url: 'ftp://nope', seconds: 5, in: 0, out: 5 },
    { key: '', url: 'https://x/z.mp4', seconds: 5, in: 0, out: 5 },
    { key: 'clamp', url: 'https://x/z.mp4', seconds: 8, in: -3, out: 99 },
    { key: 'unknown', url: 'https://x/w.mp4', seconds: null, in: 0, out: 6 },
  ]);
  ok(c.length === 4, 'keeps the valid pieces, drops sliver / bad url / no key');
  ok(c[0].out === 10 && c[1].in === 2.5 && c[1].out === 7.25, 'spans survive verbatim');
  ok(c[3].seconds === null, 'an unknown source length stays null, never a confident 0');
  const clamp = c.filter((p) => p.key === 'clamp')[0];
  ok(clamp.in === 0 && clamp.out === 8, 'in/out clamp to the source');
  ok(fe.cleanPieces(null).length === 0 && fe.cleanPieces('x').length === 0, 'garbage in, empty out');
}

console.log('pieceSeconds / totalSeconds:');
{
  ok(fe.pieceSeconds({ in: 2, out: 7.5 }) === 5.5, 'a piece is out minus in');
  ok(fe.totalSeconds([{ in: 0, out: 4 }, { in: 2, out: 5 }]) === 7, 'the cut is the sum of its pieces');
}

console.log('splitPiece:');
{
  const p = { key: 'a', url: 'https://x/y.mp4', seconds: 10, in: 2, out: 8, title: 't', poster: null };
  const pair = fe.splitPiece(p, 2.5, 'newkey');
  ok(!!pair, 'a mid-piece split works');
  ok(pair[0].out === 4.5 && pair[1].in === 4.5, 'the two halves meet exactly at the cut');
  ok(pair[0].key === 'a' && pair[1].key === 'newkey', 'the second half gets the new key');
  ok(pair[0].url === pair[1].url, 'both halves reference the SAME source');
  ok(Math.abs(fe.pieceSeconds(pair[0]) + fe.pieceSeconds(pair[1]) - fe.pieceSeconds(p)) < 1e-9,
    'nothing is lost across a split');
  ok(fe.splitPiece(p, 0.05, 'k') === null, 'a split at the very start is refused');
  ok(fe.splitPiece(p, 5.95, 'k') === null, 'a split at the very end is refused');
}

console.log('cleanAudio:');
{
  const a = fe.cleanAudio({ url: 'https://x/a.mp3', name: 'song', offset: 3.2 });
  ok(a && a.offset === 3.2 && a.name === 'song', 'a real track survives');
  ok(fe.cleanAudio({ url: 'https://x/a.mp3', offset: -4 }).offset === 0, 'a negative offset lands on 0');
  ok(fe.cleanAudio(null) === null && fe.cleanAudio({ url: 'nope' }) === null, 'no track is null');
}

console.log('mixGraph:');
{
  const g = fe.mixGraph(2.5);
  ok(g.indexOf('adelay=2500|2500') !== -1, 'the offset lands as milliseconds on both channels');
  ok(g.indexOf('normalize=0') !== -1, 'normalize=0 — amix must not halve both voices');
  ok(fe.mixGraph(0).indexOf('adelay=0|0') !== -1, 'offset 0 still builds a valid graph');
}

console.log('trimmedCut:');
{
  const t = fe.trimmedCut({
    id: 'x', title: 'T',
    clips: [{ in: 0, out: 4, poster: 'https://p' }, { in: 1, out: 3 }],
    audio: { url: 'https://a' }, renders: [{}, {}],
    job: { status: 'running', kind: 'render', label: 'l' }, updatedAt: 5,
  });
  ok(t.pieces === 2 && t.seconds === 6 && t.renders === 2, 'counts derive from the pieces');
  ok(t.hasAudio === true && t.poster === 'https://p', 'audio flag + first poster ride along');
  ok(t.job && t.job.kind === 'render', 'a running job shows; a finished one would not');
}

console.log('the page contracts (static):');
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'filmeditor.html'), 'utf8');
  ok(/\(function \(\)/.test(html), 'the page script is wrapped in an IIFE (the injected-pill rule)');
  ok(/\[hidden\]\{ display:none !important; \}/.test(html), '[hidden] wins over author display rules');
  ok(!/gradient/i.test(html), 'NO gradients — anywhere (the prototype had three)');
  ok((html.match(/tool-eyebrow/g) || []).length === 1, 'the title appears once (?embed=1 hides it)');
  ok(!/placeholder=/.test(html), 'no placeholder text in any box she writes in');
  ok(/pointer-events:none/.test(html), 'dimmed tools are inert, never tappable ghosts');
  ok(/overflow-x:auto/.test(html), 'the timeline scrolls instead of running off the screen');
  ok(/id="vA"/.test(html) && /id="vB"/.test(html), 'two video elements — a source boundary must not flash');
  ok(/window\.__navBack/.test(html), 'the native chevron can walk open → shelf');
  ok(/helpcard/.test(html), 'the instructions live behind the "?"');
  // Sophie's live bugs, 2026-08-22 — all three were object-identity or
  // stale-clock mistakes in the playback engine. Pinned so they stay dead.
  ok(/next\.c\.key === seg\.c\.key/.test(html),
    'end-of-film compares KEYS, not object identity (the last-clip loop)');
  ok(!/next === seg/.test(html), 'the identity comparison is gone outright');
  ok((html.match(/lastTs = null/g) || []).length >= 3,
    'the tick clock resets on every play AND stop (the instant-skip bug)');
  ok(/Math\.min\(0\.1, \(ts - lastTs\)/.test(html),
    'a late frame nudges the playhead, never flings it');
  ok(!/var cur = segAt\(playhead\)/.test(html),
    'the strip finds the current piece in its OWN array (the invisible playhead)');
  ok(/a\.paused && a\.getAttribute\('data-src'\)/.test(html),
    'the audio track starts when the playhead crosses its offset mid-play');
}

console.log('');
console.log(pass + ' passed, ' + failCount + ' failed');
process.exit(failCount ? 1 : 0);
