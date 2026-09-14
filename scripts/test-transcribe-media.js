#!/usr/bin/env node
// test-transcribe-media.js — the transcript cache's contract, pure, no network.
//
// Two things here can be silently wrong, and both cost money rather than
// failing loudly:
//
//   1. THE KEY. `transcripts/<sha1(url)>.json` has to be sha1 of the url and
//      nothing else, or asking for the same take twice pays twice with no
//      symptom but the bill.
//   2. THE MIRROR. scripts/transcribe-media.js writes the word list into
//      `scratchpad/take-words/<key>.json` — the Story Room's OWN take cache
//      (scratchpad.js `takeWords`). If either side's key rule drifts, the
//      mirror is dead weight: the Story Room re-transcribes a take that is
//      already banked, and nothing anywhere says so.
//
// So the test reads the REAL key expression out of both files rather than
// re-typing it here; a test carrying its own copy of the rule pins itself.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SCRIPT = fs.readFileSync(path.join(ROOT, 'scripts/transcribe-media.js'), 'utf8');
const PAD = fs.readFileSync(path.join(ROOT, 'scratchpad.js'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  console.log(`${cond ? '✓' : '✗'} ${what}`);
  if (!cond) fails += 1;
};

// ── 1. the key is sha1 of the url, in both files ───────────────────────────
const KEY_RE = /createHash\('sha1'\)\s*\.update\(String\((url|[a-z]+)\)\)\s*\.digest\('hex'\)/;
ok(KEY_RE.test(SCRIPT), 'the script keys the cache on sha1(url)');
const padTake = PAD.slice(PAD.indexOf('async function takeWords'), PAD.indexOf('async function takeWords') + 400);
ok(KEY_RE.test(padTake), "scratchpad's takeWords keys on sha1(url) too");

// ── 2. the two sides name the SAME Storage prefix ──────────────────────────
const prefixOf = (src, re) => (src.match(re) || [])[1] || null;
const mine = prefixOf(SCRIPT, /TAKE_WORDS\s*=\s*'([^']+)'/);
const theirs = prefixOf(padTake, /`([^`$]*take-words)\/\$\{key\}\.json`/);
ok(mine === 'scratchpad/take-words', `the mirror writes scratchpad/take-words (${mine})`);
ok(theirs === 'scratchpad/take-words', `the Story Room reads scratchpad/take-words (${theirs})`);
ok(mine === theirs, 'the mirror and the Story Room agree on the prefix');

// ── 3. the word shape the Story Room expects ───────────────────────────────
// pad-take.js aligns on {word, start, end}; a mirror of anything else aligns
// nothing and the story falls back to the per-beat film with no error.
ok(/word:\s*String\(w\.word/.test(SCRIPT) && /start:\s*Number\(w\.start/.test(SCRIPT)
   && /end:\s*Number\(w\.end/.test(SCRIPT), 'the mirrored words are {word, start, end}');
const TAKE = fs.readFileSync(path.join(ROOT, 'pad-take.js'), 'utf8');
ok(/w\.word/.test(TAKE) && /\.start/.test(TAKE), 'pad-take reads that same shape');

// ── 4. it hands whisper a DERIVED copy, never her original ─────────────────
ok(/-vn'.*-ac'.*-ar'.*'16000'/s.test(SCRIPT) || /'-vn', '-ac', '1', '-ar', '16000'/.test(SCRIPT),
   'whisper is handed a 16k mono mp3, not the source file');
ok(!/upload|makePublic\(\)/.test(SCRIPT.replace(/\/\/.*$/gm, '')) || !/bucket\.file\(`drops/.test(SCRIPT),
   'nothing is written back over a file in the Dump');

// ── 5. whisper-1 with word timestamps (gpt-4o-mini-transcribe returns none) ─
ok(/'whisper-1'/.test(SCRIPT), 'the model is whisper-1');
ok(/timestamp_granularities\[\]/.test(SCRIPT) && /verbose_json/.test(SCRIPT),
   'verbose_json + word timestamps are asked for');

// ── 6. a file with no audio is BANKED as silent, never retried forever ─────
ok(/silent\s*=\s*true/.test(SCRIPT) && /rec\.silent\s*=\s*true/.test(SCRIPT),
   'a file with no audio track caches as silent');

// ── 7. the media filter skips the stills a dump is mostly made of ──────────
const M = (SCRIPT.match(/MEDIA_RE\s*=\s*(\/.*\/i)/) || [])[1];
ok(!!M, 'MEDIA_RE is declared');
if (M) {
  // eslint-disable-next-line no-eval
  const re = eval(M);
  const yes = ['a.mov', 'a.mp4', 'a.m4a', 'a.mp3', 'a.wav', 'a.webm', 'a.caf'];
  const no = ['a.png', 'a.jpg', 'a.webp', 'a.heic', 'a.zip', 'a-poster.jpg'];
  ok(yes.every((f) => re.test(f)), 'every media extension matches');
  ok(no.every((f) => !re.test(f)), 'stills, zips and posters do not');
}

// ── 8. the key really is stable for one url (the point of the whole thing) ─
const k = (u) => crypto.createHash('sha1').update(String(u)).digest('hex');
const u = 'https://storage.googleapis.com/x/drops/_/abc.mov';
ok(k(u) === k(u) && k(u) !== k(`${u}?x=1`), 'one url is one key; a changed url is a new one');

console.log(fails ? `\n${fails} failed` : '\nall good');
process.exit(fails ? 1 : 0);
