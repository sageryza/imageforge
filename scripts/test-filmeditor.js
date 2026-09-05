#!/usr/bin/env node
// test-filmeditor.js — the Film Editor's pure pieces (no network), plus the
// static page contracts. Run: node scripts/test-filmeditor.js
//
// The pure half drives filmeditor.js's exported functions: the shape it
// re-exports from cut-model.js (pieces, stills, the split), the save rules
// (the stale check, a legacy one-track write against a sound lane, the
// patch), the mix graph (N sounds — a free one, one riding a shot after a
// reorder, a muted one left out, fades, gain; normalize=0 is load-bearing —
// amix's default halves every voice), the diff a chat reads, the shot map,
// and the still proxy bake.
// The page half asserts the contracts that keep shipping broken when skipped:
// the IIFE, the [hidden] rule, no gradients, the title once, empty boxes.

const fs = require('fs');
const path = require('path');

const fe = require('../filmeditor');
const CutModel = require('../cut-model');

let pass = 0;
let failCount = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ok — ' + name); }
  else { failCount++; console.log('  FAIL — ' + name); }
}
const U = (s) => 'https://storage.googleapis.com/x/' + s;

console.log('cleanPieces (cut-model, re-exported):');
{
  ok(fe.cleanPieces === CutModel.cleanPieces && fe.splitPiece === CutModel.splitPiece,
    'the piece rules are cut-model.js\'s own functions, never a second copy');
  const c = fe.cleanPieces([
    { key: 'a', url: 'https://x/y.mp4', seconds: 10, in: 0, out: 10, title: 't', poster: null },
    { key: 'b', url: 'https://x/y.mp4', seconds: 10, in: 2.5, out: 7.25 },
    { key: 'sliver', url: 'https://x/y.mp4', seconds: 10, in: 5, out: 5.05 },
    { key: 'nourl', url: 'ftp://nope', seconds: 5, in: 0, out: 5 },
    { key: '', url: 'https://x/z.mp4', seconds: 5, in: 0, out: 5 },
    { key: 'clamp', url: 'https://x/z.mp4', seconds: 8, in: -3, out: 99 },
    { key: 'unknown', url: 'https://x/w.mp4', seconds: null, in: 0, out: 6 },
    { key: 'still', kind: 'image', url: 'https://x/s.png', title: 'a card', hold: 2 },
  ]);
  ok(c.length === 5, 'keeps the valid pieces, drops sliver / bad url / no key');
  ok(c[0].out === 10 && c[1].in === 2.5 && c[1].out === 7.25, 'spans survive verbatim');
  ok(c[3].seconds === null, 'an unknown source length stays null, never a confident 0');
  const clamp = c.filter((p) => p.key === 'clamp')[0];
  ok(clamp.in === 0 && clamp.out === 8, 'in/out clamp to the source');
  const still = c[4];
  ok(still.kind === 'image' && still.in === 0 && still.out === 2 && still.mute === true,
    'a still piece cleans through the module: in 0, out = its hold, muted');
  ok(fe.cleanPieces(null).length === 0 && fe.cleanPieces('x').length === 0, 'garbage in, empty out');
}

console.log('pieceSeconds / totalSeconds:');
{
  ok(fe.pieceSeconds({ in: 2, out: 7.5 }) === 5.5, 'a piece is out minus in');
  ok(fe.totalSeconds([{ in: 0, out: 4 }, { in: 2, out: 5 }]) === 7, 'the cut is the sum of its pieces');
}

console.log('splitPiece:');
{
  const p = { key: 'a', kind: 'video', url: 'https://x/y.mp4', seconds: 10, in: 2, out: 8, title: 't', poster: null };
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

console.log('the stale-save rule:');
{
  ok(fe.staleSave(100, 200) === true, 'a base behind the doc is stale');
  ok(fe.staleSave('100', 200) === true, 'a base sent as a string is still read');
  ok(fe.staleSave(200, 200) === false, 'the base the doc carries passes');
  // A job older than the process is a job the old process died holding.
  {
    const boot = 1_000_000; const now = boot + 60_000;
    const run = (startedAt) => ({ kind: 'render', status: 'running', startedAt: new Date(startedAt).toISOString() });
    ok(fe.jobIsDead(run(boot + 10_000), now, boot) === false, 'a job this process started a minute ago is alive');
    ok(fe.jobIsDead(run(boot - 10_000), now, boot) === true, 'a job started before this process booted is dead — a deploy killed it');
    ok(fe.jobIsDead(run(boot + 10_000), boot + 10_000 + 21 * 60_000, boot) === true, 'a job this process lost is dead after twenty minutes');
    ok(fe.jobIsDead({ kind: 'render', status: 'done', startedAt: new Date(boot + 10_000).toISOString() }, now, boot) === true, 'a finished job never blocks');
    ok(fe.jobIsDead({ kind: 'render', status: 'running' }, now, boot) === true, 'a running job with no start is dead');
  }
  ok(fe.staleSave(undefined, 200) === false && fe.staleSave(null, 200) === false && fe.staleSave('', 200) === false,
    'no base at all (an older cached page) is let through, never refused');
  ok(fe.staleSave('nope', 200) === false, 'garbage is not a base');
}

console.log('savePatch (what a save writes):');
{
  const clips = [
    { key: 'a', url: U('a.mp4'), seconds: 3, in: 0, out: 3 },
    { key: 'b', url: U('b.mp4'), seconds: 3, in: 0, out: 3 },
  ];
  const sounds = [
    { key: 'v', url: U('v.wav'), name: 'voice', seconds: 6 },
    { key: 'r', url: U('r.wav'), name: 'ride', seconds: 2, anchor: { piece: 'b', offset: 0.5 } },
  ];
  const doc = { clips, sounds, audio: null, updatedAt: 5 };
  ok(fe.savePatch(doc, {}) === null && fe.savePatch(doc, { by: 'chat' }) === null, 'nothing sent → nothing to save');
  // reorder only: the anchored sound follows its shot, at is rewritten
  const p1 = fe.savePatch(doc, { clips: [clips[1], clips[0]] });
  ok(p1.clips.map((c) => c.key).join() === 'b,a', 'clips are written as sent');
  ok(p1.sounds.find((s) => s.key === 'r').at === 0.5 && p1.sounds.find((s) => s.key === 'v').at === 0,
    'the sound lane is re-normalized against the NEW clips — the anchored one moved with its shot');
  ok(p1.audio && p1.audio.url === U('v.wav'), 'the legacy mirror is rewritten on every save');
  // sounds only: clips left alone
  const p2 = fe.savePatch(doc, { sounds: [sounds[0]] });
  ok(!('clips' in p2) && p2.sounds.length === 1, 'a field left out is left alone; sounds:[] shapes are honored');
  ok(fe.savePatch(doc, { sounds: [] }).sounds.length === 0 && fe.savePatch(doc, { sounds: [] }).audio === null,
    'sounds:[] clears the lane and the mirror');
  // an anchor to a deleted shot is dropped, the sound keeps its resolved second
  const p3 = fe.savePatch(doc, { clips: [clips[0]] });
  const r3 = p3.sounds.find((s) => s.key === 'r');
  ok(r3.anchor === null && r3.at === 3.5, 'an anchor to a deleted shot is dropped; the sound keeps where it was');
  // sounds wins over a legacy audio sent beside it
  const p4 = fe.savePatch(doc, { sounds: [sounds[0]], audio: null });
  ok(p4.sounds.length === 1, 'legacy audio is ignored when sounds is present');
}

console.log('legacy audio against a sound lane:');
{
  const clips = [
    { key: 'a', url: U('a.mp4'), seconds: 3, in: 0, out: 3 },
    { key: 'b', url: U('b.mp4'), seconds: 3, in: 0, out: 3 },
  ];
  const cur = CutModel.normalize(clips, CutModel.cleanSounds([
    { key: 'v', url: U('v.wav'), name: 'voice', seconds: 6, gain: -3 },
    { key: 'r', url: U('r.wav'), name: 'ride', seconds: 2, anchor: { piece: 'b', offset: 0.5 } },
  ]));
  const same = fe.legacySounds({ url: U('v.wav'), name: 'voice', offset: 0 }, cur, clips);
  ok(same.length === 2 && same[0].gain === -3 && same[1].key === 'r',
    'the old page sending the mirrored track back unchanged touches nothing — gain and the other sounds survive');
  const moved = fe.legacySounds({ url: U('v.wav'), offset: 2 }, cur, clips);
  ok(moved[0].at === 2 && moved[0].gain === -3 && moved.length === 2, 'a moved offset moves ONLY the mirrored sound');
  const swapped = fe.legacySounds({ url: U('song.mp3'), name: 'song', offset: 1 }, cur, clips);
  ok(swapped[0].url === U('song.mp3') && swapped[0].at === 1 && swapped[1].key === 'r',
    'a different file replaces the first sound; the rest of the lane is kept');
  const cleared = fe.legacySounds(null, cur, clips);
  ok(cleared.length === 1 && cleared[0].key === 'r', 'audio:null clears the mirrored track and NOTHING else');
  ok(fe.legacySounds({ url: U('x.mp3') }, [], clips).length === 1, 'a first track on an empty lane lands');
  const p = fe.savePatch({ clips, sounds: cur, updatedAt: 1 }, { audio: null });
  ok(p.sounds.length === 1 && p.sounds[0].key === 'r' && p.audio && p.audio.url === U('r.wav'),
    'through savePatch: the mirror moves on to the next sound after a legacy clear');
}

console.log('withLanes / readDoc:');
{
  const d = fe.withLanes({ id: 'x', clips: [{ key: 'a', url: U('a.mp4'), seconds: 3 }], audio: { url: U('vo.m4a'), name: 'vo', offset: 2 } });
  ok(Array.isArray(d.sounds) && d.sounds.length === 1 && d.sounds[0].at === 2, 'an old doc reads with a sound lane derived from audio');
  ok(d.clips[0].kind === 'video' && d.clips[0].mute === false && d.clips[0].gain === 0, 'old pieces come back in the full shape');
  ok(d.audio && d.audio.url === U('vo.m4a') && d.id === 'x', 'the mirror and the rest of the doc ride along');
  ok(fe.withLanes({ clips: [], sounds: [] }).audio === null, 'no sounds → no mirror');
}

console.log('mixGraph:');
{
  const clips = fe.cleanPieces([
    { key: 'a', url: U('a.mp4'), seconds: 3, in: 0, out: 3 },
    { key: 'b', url: U('b.mp4'), seconds: 3, in: 0, out: 3 },
  ]);
  const sounds = CutModel.cleanSounds([
    { key: 'free', url: U('f.wav'), seconds: 2, at: 1, gain: -6, fadeIn: 0.5 },
    { key: 'ride', url: U('r.wav'), seconds: 3, anchor: { piece: 'b', offset: 0 } },
    { key: 'off', url: U('m.wav'), seconds: 2, mute: true },
  ]);
  const g = fe.mixGraph(sounds, clips, {});
  ok(g === '[2:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=-6dB,afade=t=in:st=0:d=0.5,adelay=1000|1000[s0];'
    + '[3:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=3000|3000[s1];'
    + '[1:a][s0][s1]amix=inputs=3:duration=first:dropout_transition=0:normalize=0[a]',
    'the exact graph: a free sound delayed to its clock with gain and a fade-in, an anchored one to its shot, the muted one absent');
  ok(g.indexOf('normalize=0') !== -1 && g.indexOf('duration=first') !== -1,
    'normalize=0 — amix must not halve every voice; duration=first — a long bed never lengthens the film');
  ok(fe.activeSounds(sounds, {}).map((s) => s.key).join() === 'free,ride', 'the inputs are the active sounds in lane order — what the render feeds as -i');
  // reorder the picture: the anchored sound moves, the free one does not
  // a MONO sound is upmixed at unity (pan), never through aformat's −3 dB matrix
  const gm = fe.mixGraph(sounds, clips, {}, { [sounds[0].key]: 1 });
  ok(gm.indexOf('[2:a]pan=stereo|c0=c0|c1=c0,aformat=') !== -1, 'a mono sound goes through pan before aformat');
  ok(fe.mixGraph(sounds, clips, {}, { [sounds[0].key]: 2 }).indexOf('pan=stereo') === -1, 'a stereo sound does not');
  ok(fe.mixGraph(sounds, clips, {}).indexOf('pan=stereo') === -1, 'unknown channels → treated as stereo');
  const g2 = fe.mixGraph(sounds, [clips[1], clips[0]], {});
  ok(g2.indexOf('[3:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=0|0[s1]') !== -1
    && g2.indexOf('adelay=1000|1000[s0]') !== -1,
    'after a reorder the anchored sound rides its shot to 0s and the free one stays at 1s');
  // fade-out is placed from the trimmed length — the doc's, else the probe's
  const fo = CutModel.cleanSounds([{ key: 'f', url: U('f.wav'), seconds: 4, fadeOut: 1 }]);
  ok(fe.mixGraph(fo, clips, {}).indexOf('afade=t=out:st=3:d=1,') !== -1, 'a fade-out starts at length minus the fade');
  const open = CutModel.cleanSounds([{ key: 'o', url: U('o.wav'), fadeOut: 2, in: 1 }]);
  ok(fe.mixGraph(open, clips, {}).indexOf('afade=t=out') === -1, 'an open sound of unknown length gets no fade-out placed…');
  ok(fe.mixGraph(open, clips, { o: 5 }).indexOf('afade=t=out:st=3:d=2,') !== -1, '…until the render probes its length');
  const shortFade = CutModel.cleanSounds([{ key: 's', url: U('s.wav'), seconds: 0.5, fadeOut: 2 }]);
  ok(fe.mixGraph(shortFade, clips, {}).indexOf('afade=t=out:st=0:d=0.5,') !== -1, 'a fade longer than the sound fades the whole sound');
  ok(fe.mixGraph([], clips, {}) === '' && fe.mixGraph(CutModel.cleanSounds([{ key: 'm', url: U('m.wav'), seconds: 1, mute: true }]), clips, {}) === '',
    'nothing active → no graph (the render muxes the picture lane straight)');
  ok(fe.mixGraph(CutModel.cleanSounds([{ key: 'z', url: U('z.wav'), seconds: 1, at: 0 }]), clips, {}).indexOf('adelay=0|0') !== -1,
    'a sound at 0 still delays by 0 — a valid graph');
}

console.log('the sound inputs and the piece PCM:');
{
  ok(fe.soundInputArgs({ in: 0, out: null }, '/f').join(' ') === '-i /f', 'an untrimmed sound is a bare input');
  ok(fe.soundInputArgs({ in: 1.5, out: 4 }, '/f').join(' ') === '-ss 1.500 -to 4.000 -i /f',
    'a trimmed sound is -ss/-to as INPUT options (measured: -to is the absolute in-file position)');
  ok(fe.soundInputArgs({ in: 0, out: 2 }, '/f').join(' ') === '-to 2.000 -i /f', 'no in-point → no -ss');
  ok(fe.segmentAudioFilter({ gain: 0 }) === 'apad' && fe.segmentAudioFilter({}) === 'apad', 'a piece at unity pads only');
  ok(fe.segmentAudioFilter({ gain: -4.5 }) === 'volume=-4.5dB,apad', 'a piece with a level rides volume before the pad');
}

console.log('diffSince (the route\'s shape):');
{
  const clips = fe.cleanPieces([
    { key: 'a', url: U('a.mp4'), title: 'boy', seconds: 3, in: 0, out: 3 },
    { key: 'b', url: U('b.mp4'), title: 'horror', seconds: 3, in: 0, out: 3 },
  ]);
  const sounds = CutModel.cleanSounds([{ key: 'r', url: U('r.wav'), name: 'screams', seconds: 2, anchor: { piece: 'b', offset: 0 } }]);
  const doc = { clips: [clips[1], clips[0]], sounds, updatedAt: 9, renders: [
    { at: 200, by: 'chat', cut: { clips, sounds } },
    { at: 100, by: 'sophie' },
  ] };
  const d = fe.diffSince(doc);
  ok(d.from === 200 && d.by === 'chat' && d.snapshot === true && d.updatedAt === 9, 'omitted from = the newest render');
  ok(Array.isArray(d.changes) && d.changes.some((c) => c.lane === 'picture' && c.kind === 'moved' && c.key === 'b'),
    'the picture move is in the changes');
  ok(d.changes.some((c) => c.lane === 'sound' && c.kind === 'moved' && c.key === 'r'),
    'the anchored sound is reported as moved — the chat should hear that it rode');
  ok(typeof d.text === 'string' && /horror earlier/.test(d.text), 'and in words: ' + d.text.split('\n')[0]);
  const old = fe.diffSince(doc, '100');
  ok(old.from === 100 && old.snapshot === false && old.changes.filter((c) => c.kind === 'added').length === 3,
    'a render from before snapshots diffs against an empty cut and says so');
  ok(fe.diffSince(doc, 999) === null, 'an unknown render → null (the route 404s)');
  const none = fe.diffSince({ clips, sounds, renders: [] });
  ok(none.from === null && none.snapshot === false && none.changes.length === 3, 'no render yet → everything is an add');
  ok(fe.diffSince({ clips, sounds, renders: [{ at: 1, by: 'sophie', cut: { clips, sounds } }] }).text === 'nothing changed',
    'an unchanged cut reads "nothing changed"');
}

console.log('the shot map from a cut:');
{
  const clips = fe.cleanPieces([
    { key: 'a', url: U('a.mp4'), title: 'boy', poster: U('a-poster.jpg'), seconds: 3, in: 0, out: 3 },
    { key: 's', kind: 'image', url: U('s.webp'), title: 'ant farm still', out: 2 },
    { key: 'b', url: U('b.mp4'), title: 'horror', seconds: 5, in: 1, out: 3 },
  ]);
  const shots = fe.shotsFromCut(clips);
  ok(shots.map((s) => s.at).join() === '0,3,5', 'every piece at its timeline second');
  ok(shots[1].url === U('s.webp') && shots[0].url === U('a-poster.jpg') && shots[2].url === U('b.mp4'),
    'a still IS its picture, a clip stands in by its poster, else its own url');
  ok(shots[1].title === 'ant farm still', 'the title rides along');
}

console.log('preview proxies:');
{
  ok(/^[0-9a-f]{40}$/.test(fe.proxyId('https://x/y.mp4')), 'the proxy id is a sha1 of the url');
  ok(fe.proxyId('https://x/a.mp4') !== fe.proxyId('https://x/b.mp4'), 'different urls, different ids');
  // her real case, measured 2026-08-22: 784x1168 at 19 Mbps stalls the player
  ok(fe.proxyNeeded({ seconds: 5.2, width: 784, height: 1168 }, 12336709) === true,
    'a 19 Mbps Midjourney export gets a proxy');
  ok(fe.proxyNeeded({ seconds: 5.2, width: 484, height: 720 }, 277669) === false,
    'a small light file streams as itself — no proxy');
  ok(fe.proxyNeeded({ seconds: 5.2, width: 3840, height: 2160 }, 1000000) === true,
    'a big frame needs shrinking even at a low bitrate');
  const args = fe.proxyArgs('/in', '/out.mp4', true).join(' ');
  ok(args.indexOf('force_original_aspect_ratio=decrease') !== -1
    && args.indexOf('+faststart') !== -1, 'the bake caps the frame and fronts the moov');
  ok(fe.proxyArgs('/in', '/o', false).join(' ').indexOf('-an') !== -1,
    'a silent source bakes a silent proxy');
  // a still's proxy: the picture looped as long as a hold can be, silent
  // every encode is capped in memory (the 512MB box; measured 2026-09-02)
  ok(/-threads 2 .*rc-lookahead=10:ref=1/.test(args), 'a clip proxy caps threads and lookahead');
  const sargs = fe.stillProxyArgs('/pic.png', '/o.mp4');
  ok(/-threads 2 .*rc-lookahead=10:ref=1/.test(sargs.join(' ')), 'a still proxy caps threads and lookahead');
  ok(/'-threads', '1', '-x264-params', 'rc-lookahead=10:ref=1'/.test(require('fs').readFileSync(__dirname + '/../filmeditor.js', 'utf8')), 'the render segment encodes on one thread');
  ok(sargs.indexOf('-loop') !== -1 && sargs[sargs.indexOf('-loop') + 1] === '1'
    && sargs[sargs.indexOf('-t') + 1] === String(CutModel.STILL_MAX) && sargs.indexOf('-loop') < sargs.indexOf('-i'),
    'a still bakes as a -loop 1 input held STILL_MAX seconds (the input options come before -i)');
  ok(sargs.indexOf('-an') !== -1 && sargs.join(' ').indexOf('force_original_aspect_ratio=decrease') !== -1
    && sargs.join(' ').indexOf('+faststart') !== -1, 'silent, capped to the proxy edge, moov up front');
  // The music track's own proxy (2026-08-23 — her real track was a 13.9MB
  // 480p VIDEO mp4 streamed through the <audio> element).
  ok(fe.audioProxyId('https://x/y.mp4') === fe.proxyId('https://x/y.mp4') + '-aud',
    'the audio proxy lives beside the video proxy, never over it');
  ok(fe.audioProxyNeeded({ hasVideo: true, hasAudio: true }, 500000) === true,
    'a VIDEO file used as a music track always gets an audio-only copy');
  ok(fe.audioProxyNeeded({ hasVideo: false, hasAudio: true }, 3 * 1024 * 1024) === false,
    'a small pure-audio file streams as itself');
  ok(fe.audioProxyNeeded({ hasVideo: false, hasAudio: true }, 40 * 1024 * 1024) === true,
    'a heavy audio file still gets shrunk');
  const aargs = fe.audioProxyArgs('/in', '/out.m4a').join(' ');
  ok(aargs.indexOf('-vn') !== -1 && aargs.indexOf('+faststart') !== -1,
    'the audio bake drops the video stream and fronts the moov');
}

console.log('lengths are facts, not edits (lanesDiffer / carrySeconds):');
{
  const clipsA = [
    { key: 'a', url: U('a.mp4'), title: 'a', seconds: 5, in: 0, out: 5 },
    { key: 'b', url: U('b.mp4'), title: 'b', seconds: null, in: 0, out: 4 },
  ];
  const soundsA = [
    { key: 'v', url: U('v.m4a'), name: 'voice', seconds: null, at: 0 },
    { key: 'r', url: U('r.wav'), name: 'ride', seconds: 2, anchor: { piece: 'b', offset: 0.5 } },
  ];
  const chatDoc = { clips: clipsA, sounds: soundsA };
  // the page learned the voice's length: seconds filled, and cleanSound fills out = seconds
  const learned = { clips: clipsA, sounds: [{ ...soundsA[0], seconds: 17.3 }, soundsA[1]] };
  ok(CutModel.lanesDiffer(chatDoc, learned) === false,
    'a sound that only learned its length (seconds and the open end it fills) is NOT a move');
  ok(CutModel.lanesDiffer(chatDoc, { ...chatDoc, clips: [{ ...clipsA[0] }, { ...clipsA[1], seconds: 4.2 }] }) === false,
    'a clip that only learned its length is not a move either');
  ok(CutModel.lanesDiffer(chatDoc, { ...chatDoc, clips: [clipsA[1], clipsA[0]] }) === true,
    'a reorder IS a move');
  ok(CutModel.lanesDiffer(chatDoc, { ...chatDoc, clips: [{ ...clipsA[0], out: 3 }, clipsA[1]] }) === true,
    'a trim is a move');
  ok(CutModel.lanesDiffer(chatDoc, { ...chatDoc, sounds: [{ ...soundsA[0], at: 2 }, soundsA[1]] }) === true,
    'a sound moved on the clock is a move');
  ok(CutModel.lanesDiffer(chatDoc, { ...chatDoc, sounds: [soundsA[0], { ...soundsA[1], gain: -6 }] }) === true,
    'a level change is a move');
  ok(CutModel.lanesDiffer(chatDoc, { ...chatDoc, sounds: [soundsA[0], { ...soundsA[1], anchor: { piece: 'a', offset: 0.5 } }] }) === true,
    'an anchor moved to another shot is a move');
  ok(CutModel.lanesDiffer(chatDoc, { ...chatDoc, sounds: [soundsA[0]] }) === true, 'a removed sound is a move');
  ok(CutModel.lanesDiffer(chatDoc, { ...chatDoc, clips: [{ ...clipsA[0], poster: U('p.jpg') }, clipsA[1]] }) === false,
    'a poster arriving on a clip is a fact about the file, not a move');
  // carrySeconds: a writer that knows no length never erases one the doc learned
  const carried = CutModel.carrySeconds(CutModel.cleanSounds(soundsA), CutModel.cleanSounds(learned.sounds), CutModel.cleanSound);
  ok(carried[0].seconds === 17.3 && carried[0].out === 17.3, 'a chat re-sending seconds:null keeps the 17.3 the page learned, open end filled');
  ok(carried[1].seconds === 2, 'a length the writer knows is untouched');
  const rept = CutModel.carrySeconds(CutModel.cleanSounds([{ ...soundsA[0], url: U('other.m4a') }]), CutModel.cleanSounds(learned.sounds), CutModel.cleanSound);
  ok(rept[0].seconds === null, 'a re-pointed sound (same key, new url) is a different file and carries nothing');
  // and savePatch runs through it
  const patch = fe.savePatch({ clips: clipsA, sounds: learned.sounds, updatedAt: 5 }, { sounds: soundsA });
  ok(patch.sounds[0].seconds === 17.3, 'savePatch carries the learned length into the write');
}

// The three async sections below finish before the footer counts.
const asyncSections = [];

console.log('saveCut (the transaction, against a fake store):');
{
  // A fake Firestore: one doc, the transaction runs the callback, and every
  // update is recorded so the test can read what really would be written.
  function fakeDb(doc) {
    const writes = [];
    const ref = {};
    return {
      writes,
      collection() { return { doc() { return ref; } }; },
      async runTransaction(fn) {
        const tx = {
          async get() { return { exists: !!doc, data: () => JSON.parse(JSON.stringify(doc)) }; },
          update(r, f) { writes.push(f); },
        };
        return fn(tx);
      },
    };
  }
  const run = async (doc, body, warm) => {
    const d = fakeDb(doc);
    const out = await fe.saveCut('cut1', body, { db: d, warm: warm || (() => {}) });
    return { out, writes: d.writes };
  };
  const clipsA = [
    { key: 'a', url: U('a.mp4'), title: 'a', seconds: 5, in: 0, out: 5 },
  ];
  const soundsA = [{ key: 'v', url: U('v.m4a'), name: 'voice', seconds: null, at: 0 }];
  const stored = { clips: clipsA, sounds: soundsA, audio: null, updatedAt: 500, lastEditBy: 'chat' };
  asyncSections.push((async () => {
    // A: a save enqueues exactly the NEW source urls
    {
      const warmed = [];
      const body = {
        by: 'chat', base: 500,
        clips: [clipsA[0], { key: 'b', url: U('b.mp4'), title: 'b', seconds: 3, in: 0, out: 3 },
          { key: 's', kind: 'image', url: U('s.png'), title: 'still', out: 2 }],
        sounds: [soundsA[0], { key: 'r', url: U('r.wav'), name: 'ride', seconds: 2, at: 1 }],
      };
      const { out } = await run(stored, body, (w) => warmed.push(w));
      ok(out.status === 200, 'a fresh save lands');
      ok(warmed.length === 1 && warmed[0].urls.join() === [U('b.mp4'), U('s.png')].join(),
        'the picture lane warms exactly the NEW clip and the new still — never the one already on the doc (' + JSON.stringify(warmed[0] && warmed[0].urls) + ')');
      ok(warmed[0].audio.join() === U('r.wav'), 'the sound lane warms exactly the new sound');
      const { out: out2, writes } = await run(stored, body, () => { throw new Error('proxy store down'); });
      ok(out2.status === 200 && writes.length === 1, 'a warm that throws never fails the save');
      const same = fe.newSourceUrls(stored, stored);
      ok(same.urls.length === 0 && same.audio.length === 0, 'a save that introduces nothing warms nothing');
    }
    // E + F: a stale base whose only change is a learned length is accepted, and it is not her edit
    {
      const body = { by: 'sophie', base: 100, sounds: [{ ...soundsA[0], seconds: 17.3 }] };
      const { out, writes } = await run(stored, body);
      ok(out.status === 200, 'a stale-base save that only learned a length is accepted, not 409');
      ok(writes.length === 1 && writes[0].lastEditBy === 'chat', 'and lastEditBy stays what it was — a learned length is nobody\'s edit');
      ok(writes.length === 1 && writes[0].sounds[0].seconds === 17.3 && writes[0].sounds[0].out === 17.3, 'the length is written');
      ok(writes.length === 1 && writes[0].updatedAt > 500, 'the edit clock still moves (the page needs a fresh base back)');
    }
    // E: a stale base with a real move still 409s
    {
      const body = { by: 'chat', base: 100, clips: [{ ...clipsA[0], out: 3 }] };
      const { out, writes } = await run(stored, body);
      ok(out.status === 409 && writes.length === 0, 'a stale-base save that MOVED something is still refused');
      ok(out.doc && out.doc.clips[0].out === 5, 'and the refusal carries her current doc');
    }
    // a current base with a real move writes the writer
    {
      const body = { by: 'sophie', base: 500, clips: [{ ...clipsA[0], out: 3 }] };
      const { out, writes } = await run(stored, body);
      ok(out.status === 200 && writes[0].lastEditBy === 'sophie', 'a real move on a current base writes who moved it');
    }
    // the carry: a chat re-sending seconds:null on a current base keeps the learned length
    {
      const learnedDoc = { ...stored, sounds: [{ ...soundsA[0], seconds: 17.3 }], updatedAt: 600 };
      const body = { by: 'chat', base: 600, sounds: [soundsA[0]] };
      const { out, writes } = await run(learnedDoc, body);
      ok(out.status === 200 && writes[0].sounds[0].seconds === 17.3, 'a chat that knows no length cannot erase the one the doc learned');
    }
    // a missing doc
    {
      const d = fakeDb(null);
      const out = await fe.saveCut('nope', { clips: [] }, { db: d, warm: () => {} });
      ok(out.status === 404, 'no such cut → 404');
    }
  })());
}

console.log('proxyStates answers poster beside status/proxyUrl:');
{
  function fakeProxyDb(docs) {
    return { collection() { return { doc(id) { return {
      async get() { return { exists: !!docs[id], data: () => docs[id] }; },
      async set(v) { docs[id] = { ...(docs[id] || {}), ...v }; },
    }; } }; } };
  }
  const a = U('a.mp4'), b = U('b.mp4'), s = U('s.png'), n = U('new.mp4');
  const docs = {};
  docs[fe.proxyId(a)] = { url: a, status: 'ready', proxyUrl: U('pa.mp4'), poster: U('pa-poster.jpg'), at: Date.now() };
  docs[fe.proxyId(b)] = { url: b, status: 'skip', proxyUrl: null, at: Date.now() };
  docs[fe.proxyId(s)] = { url: s, status: 'ready', proxyUrl: U('ps.mp4'), still: true, poster: s, at: Date.now() };
  const enqueued = [];
  asyncSections.push((async () => {
    const map = await fe.proxyStates([a, b, s, n], true, undefined, { db: fakeProxyDb(docs), enqueue: (u) => enqueued.push(u) });
    ok(map[a].status === 'ready' && map[a].poster === U('pa-poster.jpg'), 'a ready proxy answers its poster');
    ok(map[b].status === 'skip' && !('poster' in map[b]), 'a doc with no poster answers none — never a made-up one');
    ok(map[s].still === true && map[s].poster === s, 'a still\'s poster is the picture itself');
    ok(map[n].status === 'making' && enqueued.join() === n, 'a url with no doc is enqueued (through the injected enqueue) and answers making');
  })());
}

console.log('the poster frame:');
{
  const args = fe.posterArgs('/src', '/poster.jpg', 20);
  ok(args.indexOf('-ss') < args.indexOf('-i'), 'the seek is an INPUT option — ffmpeg seeks, it does not decode its way there');
  ok(args[args.indexOf('-ss') + 1] === '3.000', 'fifteen percent in (' + args[args.indexOf('-ss') + 1] + ')');
  ok(fe.posterAt(600) === 10, 'capped at ten seconds so a long master opens near its start');
  ok(fe.posterAt(0) === 0 && fe.posterAt(null) === 0, 'an unknown length seeks nowhere');
  ok(args.indexOf('-frames:v') !== -1 && args[args.indexOf('-frames:v') + 1] === '1', 'one frame');
  ok(args.join(' ').indexOf('min(' + fe.POSTER_W + ',iw)') !== -1, 'never wider than POSTER_W, never upscaled');
  ok(args[args.indexOf('-threads') + 1] === '1', 'on one thread — the 512MB box');
  ok(args.indexOf('-q:v') !== -1, 'a jpg at the Dump\'s own quality');
  const src = fs.readFileSync(path.join(__dirname, '..', 'filmeditor.js'), 'utf8');
  ok(/proxy\/\$\{proxyId\(url\)\}-poster\.jpg/.test(src), 'uploaded beside the proxy under the Dump\'s -poster.jpg name');
  ok(/poster: url,/.test(src.slice(src.indexOf('async function bakeProxy'))), 'a still\'s proxy doc carries the picture itself as its poster');
}

console.log('filmcut.js fills lengths and judges a 409 without them:');
{
  const cut = fs.readFileSync(path.join(__dirname, 'filmcut.js'), 'utf8');
  ok(/!M\.lanesDiffer\(hers, doc\)/.test(cut), 'the "same lanes?" check is CutModel.lanesDiffer — seconds ignored');
  ok(!/JSON\.stringify\(M\.readDoc\(hers\)\)/.test(cut), 'and the old whole-doc string compare is gone');
  ok(/fillSeconds\(M\.cleanSounds\(cut\.sounds\)/.test(cut) && /fillSeconds\(M\.cleanPieces\(cut\.clips\)/.test(cut),
    'set fills seconds on both lanes before saving');
  const { fillSeconds } = require('./filmcut.js');
  const probes = [];
  const probe = async (url) => { probes.push(url); if (/dead/.test(url)) throw new Error('nope'); return { seconds: 17.3 }; };
  asyncSections.push((async () => {
    const sounds = await fillSeconds(CutModel.cleanSounds([
      { key: 'v', url: U('v.m4a'), name: 'voice' },
      { key: 'v2', url: U('v.m4a'), name: 'voice again', in: 2 },
      { key: 'k', url: U('k.wav'), name: 'known', seconds: 4 },
      { key: 'd', url: U('dead.wav'), name: 'dead' },
    ]), CutModel.cleanSound, probe);
    ok(sounds[0].seconds === 17.3 && sounds[0].out === 17.3, 'an unknown sound is probed and its open end filled');
    ok(sounds[1].seconds === 17.3 && sounds[1].in === 2, 'a second reference to the same file keeps its own in-point');
    ok(probes.filter((u) => u === U('v.m4a')).length === 1, 'one probe per unique url');
    ok(sounds[2].seconds === 4 && !probes.includes(U('k.wav')), 'a known length is never probed');
    ok(sounds[3].seconds === null, 'a probe that fails leaves null, exactly as before');
    const clips = await fillSeconds(CutModel.cleanPieces([
      { key: 'c', url: U('c.mp4'), title: 'c', in: 0, out: 30, poster: U('c-poster.jpg') },
      { key: 's', kind: 'image', url: U('s.png'), title: 's', out: 3 },
    ]), CutModel.cleanPiece, probe);
    ok(clips[0].seconds === 17.3 && clips[0].out === 17.3, 'a clip asking past its end is clamped once the length is known');
    ok(clips[0].poster === U('c-poster.jpg'), 'a Dump poster named in cut.json rides through');
    ok(clips[1].seconds === null && !probes.includes(U('s.png')), 'a still is never probed');
  })());
}

console.log('trimmedCut:');
{
  const t = fe.trimmedCut({
    id: 'x', title: 'T',
    clips: [{ key: 'a', url: U('a.mp4'), in: 0, out: 4, poster: 'https://p', seconds: 4 }, { key: 'b', url: U('b.mp4'), in: 1, out: 3, seconds: 3 }],
    audio: { url: U('a.m4a') }, renders: [{}, {}], chat: 'ant-movie',
    job: { status: 'running', kind: 'render', label: 'l' }, updatedAt: 5,
  });
  ok(t.pieces === 2 && t.seconds === 6 && t.renders === 2, 'counts derive from the pieces');
  ok(t.hasAudio === true && t.sounds === 1 && t.poster === 'https://p', 'a legacy audio counts as one sound; first poster rides along');
  ok(t.chat === 'ant-movie' && t.job && t.job.kind === 'render', 'the chat and a running job show; a finished job would not');
  const s = fe.trimmedCut({ id: 'y', clips: [{ key: 's', kind: 'image', url: U('s.webp'), out: 3 }], sounds: [], updatedAt: 1 });
  ok(s.poster === U('s.webp') && s.hasAudio === false, 'a cut opening on a still shows the still');
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
  // TWO LANES (2026-09-02): one <audio> per sound, the one-track discipline
  // run per element — a sound starts the moment the playhead crosses ITS
  // start, and stops past its end.
  ok(/function soundTick/.test(html) && /if \(p\.at < 0\) return;/.test(html)
    && /a\.getAttribute\('data-src'\) !== audSrc\(s\)\) return;/.test(html)
    && /if \(a\.paused \|\| a\.__priming\) \{\s*\n\s*startSound\(s, a, p\.at\);/.test(html),
    'a sound starts when the playhead crosses its start mid-play (per element)');
  // 2026-09-05: the bank is LAZY — a sound's element opens with no src and
  // no bytes until its moment is near; the first tap on her 17-sound cut used
  // to start 17 fetches at once
  ok(/a\.preload = 'none'/.test(html) && /function primeAhead/.test(html) && /PRIME_MAX = 3/.test(html),
    'the sound bank opens preload:none and primes at most three at a time, most imminent first');
  ok(/function applyEdits/.test(fs.readFileSync(path.join(__dirname, '..', 'cut-model.js'), 'utf8'))
    && /CM\.applyEdits\(/.test(html) && /putPieces\(true\)/.test(html),
    'a stale save RE-APPLIES her edit onto the chat’s doc and saves once more; only the second refusal reloads');
  ok(/visibilitychange/.test(html) && /pagehide/.test(html) && /'freeze'/.test(html) && /function stopOnLeave/.test(html),
    'leaving the app stops playback — the audio elements no longer sound on behind a paused screen');
  // Her "fine for a while, then choppy at 3/4" (2026-08-23): joint holds
  // accumulate as music drift, and the old hard >0.5s reseek yanked the
  // track backward once the film had enough joints behind it. Paced now.
  ok(/function audioPace/.test(html) && /playbackRate/.test(html),
    'moderate music drift is PACED with a 4% rate lean, never seeked');
  ok(/Math\.abs\(dr\) > 2/.test(html),
    'only a drift past 2s — a broken state — is hard-resynced');
  ok(/function audSrc/.test(html) && /PROXY_AUD/.test(html),
    'the music track plays its audio-only baked copy when one exists');
  // The lag-and-leap playhead + the music chop, 2026-08-23: iOS batches the
  // quality counters, so the frame truth is rVFC where it exists, the
  // counter hold is capped, and a joint never seeks a running music track.
  ok(/requestVideoFrameCallback/.test(html) && /armFrameWatch/.test(html),
    'the frame truth is per PRESENTED frame (rVFC), not the batched counters');
  ok(/ts - frameAt > 350 && ts - frameAt < 1200/.test(html),
    'a flatlined frame counter can never hold the playhead forever');
  ok(/getVideoPlaybackQuality/.test(html),
    'the playhead holds when no new frame has been decoded (the waffle guard)');
  ok(!/a\.paused \|\| drift > 0\.35/.test(html),
    'a joint never yanks a RUNNING music track back to a lagging playhead');
  ok(/addEventListener\('canplay', reveal/.test(html),
    'the old frame stays up until the new source can paint (no black gap)');
  // The little-pauses chop, 2026-08-23: #1564 fixed seek-at-every-joint for
  // the AUDIO track only — the video half lived on. Pinned both ways.
  ok(/function warmNext/.test(html),
    'the idle element is PARKED on the next joint\'s frame, not merely loaded');
  ok(/seekless/.test(html),
    'an element already on the joint\'s frame is never re-seeked (the visible hiccup)');
  ok(/function srcOf/.test(html) && /askProxies/.test(html),
    'the player prefers the baked preview copy; the render keeps the original');
  // The music "starts late" + "keeps pausing about 3/4 of the way through"
  // (Sophie, 2026-08-23, round two): iOS treats preload=auto as a SUGGESTION
  // on <audio> exactly as on <video>, so the track's fetch began at her play
  // tap (the late start) and the buffer ran dry mid-film (the pause) — the
  // warmNext lesson, never applied to the audio element. Three pins:
  ok(/function primeAudio/.test(html) && /canplaythrough/.test(html),
    'the track is PRIMED — a muted play forces the fetch before the play tap');
  ok(/pointerdown', function \(\) \{ primeAudio\(\)/.test(html),
    'a refused no-gesture prime retries on her next tap');
  ok(/audEntry/.test(html) && /addEventListener\('playing'/.test(html),
    'the track re-aligns the moment it actually STARTS sounding (entry, never a joint)');
  ok(/if \(!a\.seeking\) \{\s*\n\s*a\.__audEntry = true;/.test(html),
    'a seek\'s own waiting echo never arms the entry realign (pacing owns a rolling track)');
  ok(/a\.seeking \|\| a\.readyState < 3/.test(html),
    'a stalled clock is not drift — pacing and the 2s resync skip a buffering track');
  // Round three (2026-08-23, on the phone): "lagging playhead … black
  // sometimes" survived every Chromium-verified fix. Device-shaped guards:
  ok(/el\.__frameAt && fAge > 350 && fAge < 1200/.test(html),
    'the rVFC playhead hold is CAPPED — an under-delivering rVFC cannot lag the playhead');
  ok(/el\.readyState >= 2 && \(el\.__frameAt \|\| !el\.__rvfc\)/.test(html),
    'a boundary reveals on a PRESENTED frame, not canplay (iOS paints later than Chromium)');
  ok((html.match(/el\.__frameAt = 0/g) || []).length >= 2,
    'the presented-frame mark is cleared on every src set (ensureSrc and warmNext)');
  ok(/var BUILD = 'fe-/.test(html) && /function telSend/.test(html) && /telSend\(\)/.test(html),
    'every play session posts a telemetry beacon — the device answers, not a guess');
  // The round-three FINDING (2026-08-23, measured): her play posted no beacon
  // while the route round-tripped — the iOS app keeps recent tools alive in a
  // ZStack, so the page loads once per app process and no deploy can reach a
  // page that never reloads. The page heals its own staleness.
  ok(/function buildCheck/.test(html) && /setInterval\(buildCheck/.test(html),
    'the page checks its own build against the server on an interval');
  ok(/if \(playing \|\| uploading\) return false;/.test(html)
    && /lastEditAt < 10000/.test(html) && /filmsSheet'\)\.hidden\) return false;/.test(html),
    'and reloads itself only while IDLE — never mid-play, mid-upload, mid-save or under a sheet');
  const mBuild = /var BUILD = '([^']+)'/.exec(html);
  ok(mBuild && fe.PAGE_BUILD === mBuild[1],
    'the server serves the SAME build id the page carries — one source, the html');
  ok(html.indexOf('id="msg"') > html.indexOf('</div>', html.indexOf('id="tools"')),
    'the progress line lives OUTSIDE the editor panel, visible on first upload');
}

console.log('one writer of a render record, and a chat renders in its own container:');
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'filmeditor.js'), 'utf8');
  const cut = fs.readFileSync(path.join(__dirname, 'filmcut.js'), 'utf8');
  ok(typeof fe.publishRender === 'function' && typeof fe.loadDoc === 'function' && typeof fe.patchDoc === 'function',
    'publishRender / loadDoc / patchDoc are exported for the container render');
  ok((src.match(/film-\$\{n\}\.mp4/g) || []).length === 1,
    'the film-<n> upload is written in ONE place (publishRender) — runRender goes through it');
  ok(/return await publishRender\(id, doc, r, by\)/.test(src),
    'the box job publishes through publishRender');
  ok(/if \(!has\('box'\) && process\.env\.FIREBASE_SERVICE_ACCOUNT\) return renderHere\(id\)/.test(cut),
    'filmcut.js render runs in the container by default; --box is the deliberate exception');
  ok(/fe\.publishRender\(id, doc, r, 'chat', 'container'\)/.test(cut),
    'and publishes through the same publishRender, marked by:chat · where:container');
  ok(/fe\.jobIsDead\(doc\.job, Date\.now\(\), bootAt\)/.test(cut),
    'a ghost box job is cleared only when jobIsDead says the process that started it is gone');
}

Promise.all(asyncSections).catch((e) => { failCount++; console.log('  FAIL — an async section crashed: ' + (e && e.stack || e)); }).then(() => {
  console.log('');
  console.log(pass + ' passed, ' + failCount + ' failed');
  process.exit(failCount ? 1 : 0);
});
