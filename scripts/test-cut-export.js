#!/usr/bin/env node
// test-cut-export.js — a Film Editor cut handed to another editor
// (cut-export.js), pure. The fixture is a small cut with every shape the
// hospital cut has: a trimmed clip, a source cut into two pieces, a still,
// a muted clip, and sounds that overlap, ride a shot, and fade.
// Run: node scripts/test-cut-export.js
const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const E = require('../cut-export');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); n++; };
const U = (s) => 'https://storage.googleapis.com/x/' + s;

const doc = {
  title: 'The Ant Farm & the "kid"',
  clips: [
    { key: 'boy', url: U('boy.mp4'), title: 'Boy: the / opening?', seconds: 10, in: 2, out: 8 },
    { key: 's1', kind: 'image', url: U('card.png'), title: '3 · not shot yet — Card', out: 1 },
    { key: 'col1', url: U('colony.mp4'), title: 'colony, first half', seconds: 12, in: 0, out: 5 },
    { key: 'col2', url: U('colony.mp4'), title: 'colony, second half', seconds: 12, in: 5, out: 12, mute: true },
    { key: 'kid', url: U('kid.mp4'), title: 'kid horrified', seconds: 5, gain: 3 },
  ],
  sounds: [
    { key: 'vo', url: U('vo.m4a'), name: 'Sophie — VO', seconds: 9, at: 1 },
    { key: 'jazz', url: U('jazz.m4a'), name: 'jazz', seconds: 30, in: 0, out: 17.5, at: 0, gain: -10, fadeOut: 3.5 },
    { key: 'scream', url: U('scream.m4a'), name: 'scream', seconds: 2, anchor: { piece: 'kid', offset: 1.5 } },
  ],
};
const assets = {
  [U('boy.mp4')]: { seconds: 10, width: 560, height: 752, fps: 24, hasAudio: true, audioRate: 32000, channels: 2 },
  [U('colony.mp4')]: { seconds: 12, width: 560, height: 752, fps: 24, hasAudio: true, audioRate: 32000, channels: 2 },
  [U('kid.mp4')]: { seconds: 5, width: 560, height: 752, fps: 24, hasAudio: true, audioRate: 32000, channels: 2 },
  [U('card.png')]: { image: true, width: 1024, height: 1536 },
  [U('vo.m4a')]: { seconds: 9, hasAudio: true, hasVideo: false, audioRate: 44100, channels: 1 },
  [U('jazz.m4a')]: { seconds: 30, hasAudio: true, hasVideo: false, audioRate: 32000, channels: 2 },
  [U('scream.m4a')]: { seconds: 2, hasAudio: true, hasVideo: false, audioRate: 32000, channels: 2 },
};

// ── the names: timeline order, one file per source, nothing a file system refuses ──
const names = E.mediaNames(doc);
eq(names[U('boy.mp4')], '01 - Boy the opening.mp4', 'numbered by timeline position, slashes and ? gone');
eq(names[U('card.png')], '02 - 3 · not shot yet — Card.png', 'a card keeps its own words');
eq(names[U('colony.mp4')], '03 - colony, first half.mp4', 'a source cut in two is ONE file, named by its first piece');
eq(names[U('kid.mp4')], '05 - kid horrified.mp4', 'the number is the timeline slot, so the split source still counts as one slot each');
eq(names[U('vo.m4a')], 'S1 - Sophie — VO.m4a', 'sounds are S-numbered');
eq(Object.keys(names).length, 7, 'every url named once');
eq(new Set(Object.values(names).map((s) => s.toLowerCase())).size, 7, 'no two sources share a name');
const twins = E.mediaNames({ clips: [
  { key: 'a', url: U('a/x.mp4'), title: 'same', seconds: 3 },
  { key: 'b', url: U('b/x.mp4'), title: 'same', seconds: 3 },
] });
ok(twins[U('a/x.mp4')] !== twins[U('b/x.mp4')], 'two sources with one title never collide');
eq(E.slugTitle('a'.repeat(200)).length, 70, 'a name is capped');

// ── the cut sheet ────────────────────────────────────────────────────────
const sheet = E.cutSheet(doc, names);
ok(/^The Ant Farm & the "kid" — 0:24\.0/.test(sheet), 'title and total length lead');
ok(/0:00\.0 {2}0:06\.0 {2}01 - Boy the opening\.mp4 {2}trim 0:02\.0–0:08\.0 of 0:10\.0/.test(sheet), 'a trimmed clip says which part of the source plays');
ok(/0:06\.0 {2}0:01\.0 {2}02 - .*still, hold 1s/.test(sheet), 'a still says its hold');
ok(/0:12\.0 {2}0:07\.0 {2}03 - colony, first half\.mp4 {2}trim 0:05\.0–0:12\.0 of 0:12\.0 {2}muted/.test(sheet), 'the second piece of a split source names the SAME file with its own trim, and says muted');
ok(/05 - kid horrified\.mp4 {2}\+3dB/.test(sheet), 'a piece gain');
ok(/0:00\.0 {2}0:17\.5 {2}S2 - jazz\.m4a {2}trim 0:00\.0–0:17\.5 of 0:30\.0 {2}-10dB · fade out 3\.5s/.test(sheet), 'a sound with a trim, a level and a fade');
ok(/0:20\.5 {2}0:02\.0 {2}S3 - scream\.m4a {2}rides 05 \+1\.5s/.test(sheet), 'an anchored sound is placed at its resolved second and says which shot it rides');
ok(/0:01\.0 {2}0:09\.0 {2}S1 - Sophie — VO\.m4a$/m.test(sheet), 'a plain sound: start, length, file, nothing else');

// ── the FCPXML ───────────────────────────────────────────────────────────
const xml = E.fcpxml(doc, assets, { names });
ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.9">'), 'header');
let lint = null;
try { execFileSync('xmllint', ['--version'], { stdio: 'ignore' }); lint = 'xmllint'; } catch { /* not on this box */ }
if (lint) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fcpx-')), 't.fcpxml');
  fs.writeFileSync(f, xml);
  execFileSync(lint, ['--noout', f]);
  n++;
}
ok(/<format id="r1" name="FFVideoFormat752p24" frameDuration="100\/2400s" width="560" height="752"\/>/.test(xml), 'the sequence format is the sources\' own size and fps');
// every time value sits on the frame grid: N/2400s with N a multiple of 100
const times = [...xml.matchAll(/="(\d+)\/2400s"/g)].map((m) => Number(m[1]));
ok(times.length > 20 && times.every((t) => t % 100 === 0), 'every time is a whole frame');
ok(/<asset id="r\d+" name="01 - Boy the opening\.mp4" uid="[0-9A-F]{32}" start="0s" duration="24000\/2400s" hasVideo="1" hasAudio="1" format="r1" videoSources="1" audioSources="1" audioChannels="2" audioRate="32000"><media-rep kind="original-media" src="media\/01%20-%20Boy%20the%20opening\.mp4"\/><\/asset>/.test(xml), 'a video asset, with a RELATIVE media path');
ok(/<asset id="r\d+" name="02 - 3 · not shot yet — Card\.png" [^>]*duration="0s" hasVideo="1" videoSources="1" format="r\d+">/.test(xml), 'a still is a zero-length asset');
ok(/<format id="r\d+" name="FFVideoFormatRateUndefined" width="1024" height="1536"\/>/.test(xml), 'with its own size as its format');
ok(/<asset id="r\d+" name="S1 - Sophie — VO\.m4a" [^>]*hasVideo="0" hasAudio="1" audioSources="1" audioChannels="1" audioRate="44100">/.test(xml), 'an audio-only asset');
eq((xml.match(/<asset /g) || []).length, 7, 'one asset per source — the split source is one');
// the spine
const spine = xml.slice(xml.indexOf('<spine>'), xml.indexOf('</spine>'));
const tops = spine.match(/^ {10}<(asset-clip|video) /gm) || [];
eq(tops.length, 5, 'five pieces on the spine');
ok(/<asset-clip ref="r2" offset="0\/2400s" name="Boy: the \/ opening\?" start="4800\/2400s" duration="14400\/2400s" format="r1">/.test(spine), 'a trimmed clip: start is its in, duration its length; the name is the piece\'s own title');
ok(/<video ref="r\d+" offset="14400\/2400s" name="3 · not shot yet — Card" start="0s" duration="2400\/2400s">/.test(spine), 'a still is a <video> element holding for its hold');
ok(/name="colony, second half" start="12000\/2400s" duration="16800\/2400s" format="r1"><adjust-volume amount="-96dB"\/>/.test(spine), 'a muted piece is turned all the way down');
ok(/name="kid horrified" start="0\/2400s" duration="12000\/2400s" format="r1"><adjust-volume amount="\+3dB"\/>/.test(spine), 'a piece gain');
// connected sounds: under the shot each starts on, offset in the parent's own timeline
ok(/name="Boy: the \/ opening\?"[^>]*><asset-clip ref="r\d+" lane="-1" offset="4800\/2400s" name="jazz" start="0\/2400s" duration="42000\/2400s"><adjust-volume amount="-10dB"><param name="amount"><fadeOut type="easeOut" duration="8400\/2400s"\/><\/param><\/adjust-volume><\/asset-clip>/.test(spine),
  'jazz at 0:00 under the first shot: offset = the shot\'s in (2s) + 0, trimmed to 17.5s, -10dB with a 3.5s fade out');
ok(/lane="-2" offset="7200\/2400s" name="Sophie — VO" start="0\/2400s" duration="21600\/2400s">/.test(spine), 'the VO at 0:01 overlaps jazz, so it takes the next lane; offset = 2 + 1');
ok(/name="kid horrified"[^>]*><adjust-volume amount="\+3dB"\/><asset-clip ref="r\d+" lane="-1" offset="3600\/2400s" name="scream" start="0\/2400s" duration="4800\/2400s">/.test(spine), 'the anchored scream sits under the kid shot at its anchor offset (1.5s), back on lane -1 since nothing overlaps it there');
ok(/<sequence format="r1" duration="57600\/2400s"/.test(xml), 'the sequence runs the picture lane\'s length (24s)');
ok(/<event name="The Ant Farm &amp; the &quot;kid&quot;">/.test(xml), 'names are escaped');

// a cut with nothing known about its sources still writes from the doc's own numbers
const bare = E.fcpxml(doc, {});
ok(/frameDuration="100\/2400s" width="1080" height="1920"/.test(bare), 'no probes: 24fps, a portrait phone frame');
ok(/name="01 - Boy the opening\.mp4" [^>]*duration="24000\/2400s"/.test(bare), 'asset length from the doc\'s seconds');

console.log(`test-cut-export: ${n} checks passed${lint ? '' : ' (xmllint not on this box — the well-formedness check was skipped)'}`);
