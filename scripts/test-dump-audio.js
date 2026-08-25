#!/usr/bin/env node
'use strict';

// THE DUMP TAKES AUDIO (2026-08-24).
//
// It was offered as a fix on 2026-08-11 — "the Dump still can't take audio.
// Want me to fix that last part?" — and the offer was never answered, so the
// gap sat there until the audit of unanswered fix offers found it again.
//
// The machinery was always generic: content-addressed bytes, md5 dedupe,
// albums, folders. Only three type tables and one field said images and video.
// These are the rules that make a dumped recording land as itself, plus the
// two readers that would otherwise draw it as a picture.
//
// Pure — no Firestore, no network, no bytes.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const drop = require('../dropbox.js');

const ROOT = path.join(__dirname, '..');
let pass = 0;
const t = (name, fn) => {
  try { fn(); pass += 1; console.log('  ok  ' + name); } catch (e) {
    console.error('  FAIL ' + name + '\n       ' + e.message);
    process.exitCode = 1;
  }
};

console.log('\na recording arrives as audio');

t('the shapes off her phone are all audio', () => {
  for (const n of ['memo.m4a', 'song.mp3', 'take.wav', 'old.aiff', 'ios.caf',
    'master.flac', 'thing.opus']) {
    assert.strictEqual(drop.mediaKind(drop.ctForName(n)), 'audio', n);
  }
});

t('pictures and video are untouched', () => {
  for (const n of ['a.png', 'b.JPG', 'c.heic', 'd.webp']) {
    assert.strictEqual(drop.mediaKind(drop.ctForName(n)), 'image', n);
  }
  for (const n of ['e.mov', 'f.mp4', 'g.m4v', 'h.webm']) {
    assert.strictEqual(drop.mediaKind(drop.ctForName(n)), 'video', n);
  }
});

// THE TRAP THIS WHOLE FILE EXISTS FOR: an .m4a's content type is `audio/mp4`,
// so a table that asks about the CONTAINER before the KIND files every voice
// recording as a video — a real file with a real poster job and a ▶ on its
// tile.
t('an .m4a is audio/mp4, and that is NOT a video', () => {
  assert.strictEqual(drop.ctForName('memo.m4a'), 'audio/mp4');
  assert.strictEqual(drop.isVideoCT('audio/mp4'), false);
  assert.strictEqual(drop.isAudioCT('audio/mp4'), true);
});

t('…and it is stored with an .m4a extension, never .mp4', () => {
  assert.strictEqual(drop.extFor('audio/mp4'), 'm4a');
  assert.strictEqual(drop.extFor('video/mp4'), 'mp4');
});

t('every audio type round-trips name → content type → extension', () => {
  const want = { 'a.m4a': 'm4a', 'a.mp3': 'mp3', 'a.wav': 'wav', 'a.aiff': 'aiff',
    'a.caf': 'caf', 'a.flac': 'flac', 'a.ogg': 'ogg' };
  for (const [n, ext] of Object.entries(want)) {
    assert.strictEqual(drop.extFor(drop.ctForName(n)), ext, n);
  }
});

t('an unknown name still falls back to a picture, as it always did', () => {
  assert.strictEqual(drop.ctForName('mystery'), 'image/png');
  assert.strictEqual(drop.mediaKind(drop.ctForName('mystery')), 'image');
});

t('a zip carrying recordings is accepted by the same list', () => {
  assert.ok(drop.AUDIO_RE.test('Voice Memos/2026-08-01.m4a'));
  assert.ok(!drop.AUDIO_RE.test('cover.png'));
  assert.ok(!drop.VIDEO_RE.test('take.m4a'));   // ← the same container trap, by name
});

console.log('\nnothing draws a recording as a picture');

// Every reader written before audio existed asks `=== 'video'` and calls the
// rest an image. Each of these is a place that would have drawn an <img> at a
// url with no picture behind it.
t('the Assembly import SKIPS audio rather than importing a silent still', () => {
  const asm = require('../assembly.js');
  const files = [
    { id: 'a', url: 'https://x/1.jpg', media: 'image', photoIndex: 0 },
    { id: 'b', url: 'https://x/2.m4a', media: 'audio', photoIndex: 1 },
    { id: 'c', url: 'https://x/3.mp4', media: 'video', photoIndex: 2 },
  ];
  const items = asm.itemsFromDrops(files, 'Dinner party');
  assert.deepStrictEqual(items.map((i) => i.id), ['a', 'c']);
  assert.deepStrictEqual(items.map((i) => i.kind), ['image', 'video']);
});

t('/dump gives audio its own tile instead of an <img>', () => {
  const page = fs.readFileSync(path.join(ROOT, 'public', 'dump.html'), 'utf8');
  assert.ok(/media==='audio'/.test(page), "the tile asks for audio by name");
  assert.ok(/class="f aud"/.test(page), 'and draws its own kind of tile');
  assert.ok(/<audio id="lbaud"/.test(page), 'and the lightbox can play one');
});

console.log('\n' + pass + ' passed\n');
