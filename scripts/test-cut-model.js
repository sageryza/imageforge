#!/usr/bin/env node
// test-cut-model.js — the one shape of a Film Editor cut (cut-model.js), pure.
// The ant movie is the fixture: 9 clips + 7 stills, four sounds, one of them
// riding the horror clip. Run: node scripts/test-cut-model.js
const assert = require('assert');
const M = require('../cut-model');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); n++; };
const U = (s) => 'https://storage.googleapis.com/x/' + s;

// ── pieces ────────────────────────────────────────────────────────────────
const clips = M.cleanPieces([
  { key: 'boy', url: U('boy.mp4'), title: 'boy', seconds: 5.2, in: 0, out: 5.2 },
  { key: 's1', kind: 'image', url: U('s1.webp'), title: 'ant farm still', out: 3.2 },
  { key: 'colony', url: U('colony.mp4'), title: 'colony', seconds: 5.2 },        // no in/out → whole
  { key: 's2', kind: 'image', url: U('s2.webp'), title: 'colonies still', hold: 18.5 }, // hold alias
  { key: 'horror', url: U('kid.mp4'), title: 'kid horrified', seconds: 5.06, gain: 3 },
  { key: 'bad1', url: 'http://not-https/x.mp4', seconds: 5 },                   // refused
  { key: 'bad2', url: U('tiny.mp4'), seconds: 5, in: 4.99, out: 5 },            // too short
  { key: '', url: U('nokey.mp4'), seconds: 5 },                                 // no key
]);
eq(clips.map((c) => c.key), ['boy', 's1', 'colony', 's2', 'horror'], 'refusals');
eq(clips[1], { key: 's1', kind: 'image', url: U('s1.webp'), title: 'ant farm still', poster: null, seconds: null, in: 0, out: 3.2, mute: true, gain: 0 }, 'a still: in 0, out = hold, muted');
eq(clips[3].out, 18.5, 'hold alias accepted');
eq(M.cleanPiece({ key: 'x', kind: 'image', url: U('a.png') }).out, M.STILL_DEFAULT, 'still default hold');
eq(M.cleanPiece({ key: 'x', kind: 'image', url: U('a.png'), out: 999 }).out, M.STILL_MAX, 'still capped');
eq(clips[2].out, 5.2, 'video with no out runs to its end');
eq(clips[4].gain, 3, 'piece gain kept');
eq(M.cleanPiece({ key: 'x', url: U('a.mp4'), seconds: 5, gain: 99 }).gain, M.GAIN_MAX, 'gain capped');
eq(M.totalSeconds(clips), 37.16, 'total');
eq(M.starts(clips).map((s) => s.start), [0, 5.2, 8.4, 13.6, 32.1], 'starts');
eq(M.shotAt(clips, 33).key, 'horror', 'shot under a second');
eq(M.shotAt(clips, 32.1).key, 'horror', 'boundary belongs to the next shot');

// ── splitting a piece (the one copy of the rule, for the server AND the page) ──
{
  const clip = { key: 'a', kind: 'video', url: U('y.mp4'), title: 't', poster: null, seconds: 10, in: 2, out: 8, mute: false, gain: 0 };
  const pair = M.splitPiece(clip, 2.5, 'newkey');
  ok(pair && pair[0].out === 4.5 && pair[1].in === 4.5, 'a clip splits where the two halves meet exactly at the cut');
  eq([pair[0].key, pair[1].key, pair[0].url === pair[1].url], ['a', 'newkey', true], 'the second half gets the new key; both reference ONE source');
  ok(Math.abs(M.pieceSeconds(pair[0]) + M.pieceSeconds(pair[1]) - M.pieceSeconds(clip)) < 1e-9, 'nothing is lost across a split');
  eq(M.splitPiece(clip, 0.05, 'k'), null, 'a split at the very start is refused');
  eq(M.splitPiece(clip, 5.95, 'k'), null, 'a split at the very end is refused');
  const still = M.cleanPiece({ key: 's', kind: 'image', url: U('s.webp'), out: 6 });
  const sp2 = M.splitPiece(still, 2, 's2');
  eq([sp2[0].in, sp2[0].out, sp2[1].in, sp2[1].out, sp2[1].kind], [0, 2, 0, 4, 'image'], 'a still splits into two stills whose holds add up, in stays 0');
}

// ── sounds ────────────────────────────────────────────────────────────────
const sounds = M.cleanSounds([
  { key: 'voice', url: U('voice.m4a'), name: 'voice', seconds: 108.1 },
  { key: 'imagine', url: U('scream.wav'), name: 'imagine', seconds: 7.7, gain: -6, fadeOut: 1.5 },
  { key: 'cello1', url: U('cello.mp3'), name: 'cello', in: 0, out: 20, at: 19, gain: -12, fadeIn: 3 },
  { key: 'screams', url: U('screams.mp3'), name: 'screams', seconds: 11, anchor: { piece: 'horror', offset: 0 }, at: 999 },
  { key: 'legacy', url: U('bed.mp3'), offset: 4 },                    // old field name
  { key: 'bad', url: U('b.mp3'), in: 5, out: 5.05 },                  // too short
  { key: 'nourl', name: 'x' },
]);
eq(sounds.map((s) => s.key), ['voice', 'imagine', 'cello1', 'screams', 'legacy'], 'sound refusals');
eq(sounds[0].out, 108.1, 'a known length closes out');
eq(M.soundSeconds(sounds[0]), 108.1, 'sound seconds');
eq(M.soundSeconds({ in: 0, out: null, seconds: null }), null, 'unknown length is null, never 0');
eq(sounds[1].fadeOut, 1.5, 'fade kept');
eq(sounds[2].at, 19, 'clock time kept');
eq(sounds[4].at, 4, 'legacy offset read as at');
eq(sounds[3].anchor, { piece: 'horror', offset: 0 }, 'anchor kept');
eq(M.soundStart(sounds[3], clips), 32.1, 'anchored sound resolves to its shot');
eq(M.soundStart(sounds[2], clips), 19, 'free sound resolves to its clock');
const norm = M.normalize(clips, sounds);
eq(norm[3].at, 32.1, 'normalize rewrites at to the resolved value');
eq(M.normalize(clips, [{ key: 'orphan', url: U('o.mp3'), at: 7, anchor: { piece: 'gone', offset: 1 } }])[0].anchor, null, 'an anchor to a missing shot is dropped, at kept');

// moving the horror clip earlier moves the screams with it, not the cello
const moved = clips.slice(); moved.splice(4, 1); moved.splice(2, 0, clips[4]);
eq(M.soundStart(sounds[3], moved), 8.4, 'screams ride the horror clip');
eq(M.soundStart(sounds[2], moved), 19, 'cello stays on its clock');

// her move keeps an anchored sound riding
const m1 = M.moveSound(sounds[3], clips, 33.6);
eq(m1.anchor, { piece: 'horror', offset: 1.5 }, 'moved anchored sound re-offsets on the same shot');
eq(m1.at, 33.6, 'and at follows');
const m2 = M.moveSound(sounds[2], clips, 10);
eq([m2.at, m2.anchor], [10, null], 'moved free sound just moves');
const a1 = M.anchorToShot(sounds[2], clips);
eq(a1.anchor, { piece: 's2', offset: 5.4 }, 'ride this shot anchors to the shot under the start');
const sp = M.splitSound(sounds[2], 8, 'cello2');
eq([sp[0].out, sp[1].in, sp[1].at, sp[1].key, sp[0].fadeOut, sp[1].fadeIn], [8, 8, 27, 'cello2', 0, 0], 'split a sound: second half starts where the first ends, no fade at the seam');
eq(M.splitSound(sounds[2], 19.95, 'x'), null, 'a split leaving a sliver is refused');
eq(M.splitSound({ key: 'u', url: U('u.mp3'), in: 0, out: null, seconds: null, at: 0 }, 2, 'x'), null, 'a sound of unknown length cannot be split');

// ── legacy audio ──────────────────────────────────────────────────────────
const legacy = M.readDoc({ clips: [{ key: 'a', url: U('a.mp4'), seconds: 3 }], audio: { url: U('vo.m4a'), name: 'vo', offset: 2.5 } });
eq(legacy.sounds, [{ key: 'audio', url: U('vo.m4a'), name: 'vo', seconds: null, in: 0, out: null, at: 2.5, gain: 0, fadeIn: 0, fadeOut: 0, mute: false, anchor: null }], 'old audio reads as the first sound');
eq(M.audioMirror(legacy.sounds), { url: U('vo.m4a'), name: 'vo', offset: 2.5 }, 'and mirrors back');
eq(M.audioMirror([]), null, 'no sounds → no mirror');
eq(M.readDoc({ clips: [], sounds: [], audio: { url: U('vo.m4a') } }).sounds, [], 'a sounds array wins over audio even when empty');
ok(Math.abs(M.db2lin(-6) - 0.501) < 0.001 && M.db2lin(0) === 1, 'dB to linear');

// ── diff, in words ────────────────────────────────────────────────────────
const before = { clips, sounds };
const after = {
  clips: moved.concat([{ key: 'star', kind: 'image', url: U('star.webp'), title: 'shooting star', out: 6 }]),
  sounds: [sounds[0], Object.assign({}, sounds[1], { gain: -3 }), Object.assign({}, sounds[2], { at: 15, fadeIn: 1 }), sounds[3]],
};
const d = M.diffCut(before, after);
const kinds = d.map((c) => c.lane + ':' + c.kind + ':' + c.key);
ok(kinds.includes('picture:moved:horror'), 'horror moved');
ok(kinds.includes('picture:added:star'), 'star added');
ok(kinds.includes('sound:level:imagine'), 'imagine level');
ok(kinds.includes('sound:moved:cello1') && kinds.includes('sound:fade:cello1'), 'cello moved + fade');
ok(kinds.includes('sound:moved:screams'), 'screams moved (they rode the clip) — the chat should hear that');
ok(kinds.includes('sound:removed:legacy'), 'legacy sound removed');
ok(!kinds.some((k) => k.startsWith('picture:trimmed')), 'no trims invented');
ok(/kid horrified earlier/.test(M.describeDiff(d)) && /shooting star added at 37.2s/.test(M.describeDiff(d)), 'words: ' + M.describeDiff(d).split('\n')[0]);
eq(M.diffCut(before, before), [], 'same cut → no changes');
eq(M.describeDiff([]), 'nothing changed', 'empty diff words');

// ── lengths are facts, not edits ──────────────────────────────────────────
{
  const chat = { clips, sounds: [{ key: 'vo', url: U('vo.m4a'), name: 'voice', at: 0 }, ...sounds] };
  const learned = { clips, sounds: [{ key: 'vo', url: U('vo.m4a'), name: 'voice', at: 0, seconds: 17.3 }, ...sounds] };
  eq(M.readDoc(learned).sounds[0].out, 17.3, 'the page learning a length fills the open end (the shape the rule has to see through)');
  eq(M.lanesDiffer(chat, learned), false, 'a learned length is not a move');
  eq(M.lanesDiffer(chat, chat), false, 'a doc against itself');
  eq(M.lanesDiffer(before, after), true, 'a real edit is a move');
  eq(M.lanesDiffer(chat, { ...chat, sounds: chat.sounds.slice(1) }), true, 'a dropped sound is a move');
  eq(M.lanesDiffer(chat, { ...chat, sounds: [{ ...chat.sounds[0], out: 9 }, ...sounds] }), true, 'a trim inside the file is a move');
  const carried = M.carrySeconds(M.cleanSounds(chat.sounds), M.cleanSounds(learned.sounds), M.cleanSound);
  eq(carried[0].seconds, 17.3, 'carrySeconds keeps a learned length a writer does not know');
  eq(M.carrySeconds(M.cleanPieces([{ key: 's1', kind: 'image', url: U('s1.webp'), out: 3 }]), clips, M.cleanPiece)[0].seconds, null, 'a still never carries a length');
}

// ── re-applying her edit onto the chat's fresher doc (a stale save) ───────
{
  const C = (key, url, secs, tIn, tOut) => ({ key, url: U(url), title: key, seconds: secs, in: tIn || 0, out: tOut == null ? secs : tOut });
  const base = { clips: [C('a', 'a.mp4', 5), C('b', 'b.mp4', 5), C('c', 'c.mp4', 5)],
    sounds: [{ key: 'v', url: U('v.m4a'), name: 'voice', seconds: 10, at: 1, gain: 0 },
      { key: 'w', url: U('w.m4a'), name: 'whoosh', seconds: null, at: 4, gain: -6, anchor: { piece: 'b', offset: 0 } }] };
  // the chat moved b first and added d; she trimmed a and levelled v
  const chat = { clips: [C('b', 'b.mp4', 5), C('a', 'a.mp4', 5), C('c', 'c.mp4', 5), C('d', 'd.mp4', 3)],
    sounds: [Object.assign({}, base.sounds[0]), Object.assign({}, base.sounds[1], { seconds: 2.5 })] };
  const hers = { clips: [C('a', 'a.mp4', 5, 1, 4), C('b', 'b.mp4', 5), C('c', 'c.mp4', 5)],
    sounds: [Object.assign({}, base.sounds[0], { gain: -3 }), Object.assign({}, base.sounds[1])] };
  const r = M.applyEdits(chat, base, hers);
  eq(r.clips.map((c) => c.key), ['b', 'a', 'c', 'd'], 'the chat’s move and its new piece are kept');
  eq([r.clips[1].in, r.clips[1].out], [1, 4], 'and her trim of a rides onto it');
  eq(r.sounds[0].gain, -3, 'her level on the voice is kept');
  eq(r.sounds[1].seconds, 2.5, 'the chat’s learned length is kept where hers knew none');
  eq(M.soundStart(r.sounds[1], r.clips), 0, 'an anchored sound follows its shot to where the chat put it');
  // she split b and deleted c; the chat only re-levelled the voice
  const sp2 = M.splitPiece(M.cleanPiece(base.clips[1]), 2, 'b2');
  const hers2 = { clips: [base.clips[0], sp2[0], sp2[1]], sounds: base.sounds };
  const chat2 = { clips: base.clips, sounds: [Object.assign({}, base.sounds[0], { gain: 4 }), base.sounds[1]] };
  const r2 = M.applyEdits(chat2, base, hers2);
  eq(r2.clips.map((c) => c.key), ['a', 'b', 'b2'], 'her split lands beside its first half and her delete holds');
  eq([r2.clips[1].out, r2.clips[2].in], [2, 2], 'the split halves keep their cut point');
  eq(r2.sounds[0].gain, 4, 'and the chat’s level, which she never touched, is kept');
  // she reordered (c first); the chat added d at the end and deleted a
  const hers3 = { clips: [base.clips[2], base.clips[0], base.clips[1]], sounds: base.sounds };
  const chat3 = { clips: [C('b', 'b.mp4', 5), C('c', 'c.mp4', 5), C('d', 'd.mp4', 3)], sounds: base.sounds };
  eq(M.applyEdits(chat3, base, hers3).clips.map((c) => c.key), ['c', 'b', 'd'], 'her relative order over the keys both still hold; the chat’s piece keeps its slot');
  // she moved the whoosh off its shot; a learned length is not a trim
  const hers4 = { clips: base.clips, sounds: [Object.assign({}, base.sounds[0], { seconds: 10, out: 10 }),
    Object.assign({}, base.sounds[1], { anchor: null, at: 7.5, seconds: 2.5, out: 2.5 })] };
  const r4 = M.applyEdits(base, base, hers4);
  eq([r4.sounds[1].anchor, r4.sounds[1].at], [null, 7.5], 'a sound she moved off its shot stays where she put it');
  eq(r4.sounds[1].seconds, 2.5, 'its learned length rides along');
  const chat5 = { clips: base.clips, sounds: [Object.assign({}, base.sounds[0], { in: 0, out: 8 }), base.sounds[1]] };
  eq(M.applyEdits(chat5, base, hers4).sounds[0].out, 8, 'an out that only closed onto the learned length is not a trim — the chat’s real trim stands');
  const hers6 = { clips: base.clips, sounds: [Object.assign({}, base.sounds[0], { out: 6 }), base.sounds[1]] };
  eq(M.applyEdits(chat5, base, hers6).sounds[0].out, 6, 'but a trim of hers wins over the chat’s');
  eq(M.applyEdits(base, base, base).clips.map((c) => c.key), ['a', 'b', 'c'], 'no edit → the fresh doc, untouched');
  eq(M.applyEdits(chat, base, base).clips.map((c) => c.key), ['b', 'a', 'c', 'd'], 'no edit of hers → exactly the chat’s doc');
}

console.log(`test-cut-model: ${n} checks passed`);
