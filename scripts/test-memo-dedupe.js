// test-memo-dedupe.js — the Voice Memo dedupe layers, no network, no keys.
//
//     node scripts/test-memo-dedupe.js
//
// Guards the two rules that let repeat memos through before (Aug 2026): that a
// re-shared recording must fingerprint the SAME even though its bytes differ,
// and that the transcript backstop must not mistake one of Sophie's re-takes
// for a duplicate.
const assert = require('assert');
const { audioHash, transcriptTwin } = require('../memos');

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.error('  ✕ ' + name + '\n    ' + e.message); process.exitCode = 1; }
};

// A stand-in for a Voice Memos m4a: the three dated boxes, one of them a
// second (embedded) copy the way iOS really writes them, around some audio.
function box(type, size, version, date, extra) {
  const b = Buffer.alloc(size);
  b.writeUInt32BE(size, 0);
  b.write(type, 4, 'latin1');
  b[8] = version;
  const w = version === 1 ? 8 : 4;
  if (version === 1) { b.writeBigUInt64BE(BigInt(date), 12); b.writeBigUInt64BE(BigInt(date), 12 + w); }
  else { b.writeUInt32BE(date, 12); b.writeUInt32BE(date, 12 + w); }
  if (extra) b.write(extra, size - extra.length, 'latin1');
  return b;
}
function fakeM4a(date, audio) {
  return Buffer.concat([
    Buffer.from('....ftyp', 'latin1'),
    box('mvhd', 108, 0, date), box('tkhd', 92, 0, date), box('mdhd', 32, 0, date),
    audio,
    box('mvhd', 108, 0, date), box('tkhd', 92, 0, date), box('mdhd', 32, 0, date), // the moov copy
  ]);
}
const AUDIO = Buffer.alloc(4096, 7);

console.log('\naudio fingerprint');
test('a re-shared recording fingerprints the same', () => {
  // Same audio, filed two days apart — the only difference is the dates.
  const a = fakeM4a(0x95000000, AUDIO), b = fakeM4a(0x95028f00, AUDIO);
  assert.notStrictEqual(a.toString('hex'), b.toString('hex'), 'fixture bytes should differ');
  assert.strictEqual(audioHash(a), audioHash(b));
});
test('different audio fingerprints differently', () => {
  const other = Buffer.alloc(4096, 7); other[2000] = 9;
  assert.notStrictEqual(audioHash(fakeM4a(0x95000000, AUDIO)), audioHash(fakeM4a(0x95000000, other)));
});
test('64-bit (version 1) date boxes are zeroed too', () => {
  const mk = (d) => Buffer.concat([box('mvhd', 120, 1, d), AUDIO]);
  assert.strictEqual(audioHash(mk(1)), audioHash(mk(999999)));
});
test('a box whose declared size is wrong is left alone', () => {
  // The four letters appearing inside audio data must not be treated as a box.
  const junk = Buffer.concat([Buffer.alloc(64, 3), Buffer.from('mvhd'), Buffer.alloc(64, 3)]);
  assert.strictEqual(audioHash(junk), null);
});
test('a non-container file has no fingerprint', () => {
  assert.strictEqual(audioHash(Buffer.from('this is not an mp4 at all')), null);
});

console.log('\ntranscript backstop');
const words = (n, seed = 'alpha') => Array.from({ length: n }, (_, i) => seed + i).join(' ');
const memo = (id, dur, transcript) => ({ id, dur, transcript });

test('the same recording, transcribed twice, is caught', () => {
  const first = memo('a', 329, words(60));
  // Whisper drifts a little between runs — a few words differ, not the rest.
  const again = words(60).replace('alpha3 ', 'alphaX ').replace('alpha7 ', 'alphaY ');
  assert.strictEqual(transcriptTwin([first], { dur: 329, transcript: again }).id, 'a');
});
test('a re-take one second longer is NOT a duplicate', () => {
  // Sophie re-records the same line constantly; those takes land 1-2s apart.
  assert.strictEqual(transcriptTwin([memo('a', 50, words(60))], { dur: 52, transcript: words(60) }), null);
});
test('a short clip repeated verbatim is NOT a duplicate', () => {
  // An 8-second line said twice really is word-for-word identical.
  assert.strictEqual(transcriptTwin([memo('a', 8, words(17))], { dur: 8, transcript: words(17) }), null);
});
test('a different recording of the same length is NOT a duplicate', () => {
  assert.strictEqual(transcriptTwin([memo('a', 100, words(60))], { dur: 100, transcript: words(60, 'beta') }), null);
});
test('a record with no transcript is never a twin', () => {
  assert.strictEqual(transcriptTwin([memo('a', 100, null)], { dur: 100, transcript: words(60) }), null);
});

console.log(`\n${passed} passed${process.exitCode ? ' — SOME FAILED' : ''}\n`);
