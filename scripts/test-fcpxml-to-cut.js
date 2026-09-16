#!/usr/bin/env node
// test-fcpxml-to-cut.js — the FCPXML reader against a fixture in the shape
// LumaFusion writes (fcpxml 1.8: format + asset resources with file:// srcs, a
// project/sequence/spine of asset-clips with rational times, a connected audio
// clip on lane -1 with a volume and fades, a gap, a still). Pure, no network.
const assert = require('assert');
const { fcpxmlToCut, secs, basename } = require('./fcpxml-to-cut');

assert.strictEqual(secs('3003/24000s'), 0.125125);
assert.strictEqual(secs('12s'), 12);
assert.strictEqual(secs('0s'), 0);
assert.strictEqual(secs('bogus'), null);
assert.strictEqual(basename('file:///private/var/mobile/Imported/06%2036b%20part%201%20(30s).mp4'), '06 36b part 1 (30s).mp4');

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.8">
  <resources>
    <format id="r1" name="FFVideoFormatRateUndefined" frameDuration="1/24s" width="540" height="720"/>
    <asset id="r2" name="05 clip A v2" src="file:///private/var/Imported/05%20clip%20A%20v2%20-%20no%20wince%20(30s).mp4" start="0s" duration="30042/1000s" hasVideo="1" hasAudio="1" format="r1"/>
    <asset id="r3" name="06 36b part 1" src="file:///private/var/Imported/06%2036b%20part%201%20-%20ghosts%20and%20goblins%20(30s).mp4" start="0s" duration="30042/1000s" hasVideo="1" hasAudio="1" format="r1"/>
    <asset id="r4" name="jazz" src="file:///private/var/Imported/jazz.mp3" start="0s" duration="120s" hasVideo="0" hasAudio="1"/>
    <asset id="r5" name="card" src="file:///private/var/Imported/card-37.png" start="0s" duration="0s" hasVideo="1" hasAudio="0" uti="public.png"/>
    <asset id="r6" name="lost" src="file:///private/var/Imported/not-in-the-map.mp4" start="0s" duration="10s" hasVideo="1" hasAudio="1" format="r1"/>
  </resources>
  <library>
    <event name="My project">
      <project name="My project">
        <sequence format="r1" duration="60s" tcStart="0s">
          <spine>
            <asset-clip ref="r2" offset="0s" name="05 clip A v2" start="12/1s" duration="18s" format="r1">
              <asset-clip ref="r4" lane="-1" offset="14s" name="jazz" start="30s" duration="40s">
                <adjust-volume amount="-9dB"/>
                <audio-fade><fade-in duration="1s"/><fade-out duration="2500/1000s"/></audio-fade>
              </asset-clip>
            </asset-clip>
            <gap name="Gap" offset="18s" duration="2s"/>
            <asset-clip ref="r6" offset="20s" name="lost" start="0s" duration="5s"/>
            <asset-clip ref="r3" offset="25s" name="06 36b part 1" start="6006/1000s" duration="20s" enabled="1">
              <adjust-volume amount="-3dB"/>
            </asset-clip>
            <video ref="r5" offset="45s" name="card" start="0s" duration="3s"/>
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;

const MEDIA = {
  '05 clip A v2 - no wince (30s).mp4': { url: 'https://x/a2.mp4', seconds: 30.042, poster: 'https://x/a2.jpg' },
  '06 36b part 1 - ghosts and goblins (30s).mp4': { url: 'https://x/b1.mp4', seconds: 30.042 },
  'jazz.mp3': { url: 'https://x/jazz.mp3', seconds: 120 },
  'card-37.png': { url: 'https://x/card.png' },
};

const r = fcpxmlToCut(XML, MEDIA);
// three pieces in timeline order; the unmapped one skipped, the gap dropped and named
assert.deepStrictEqual(r.clips.map((c) => c.key), ['p1', 'p2', 'p3']);
assert.deepStrictEqual(r.clips.map((c) => c.url), ['https://x/a2.mp4', 'https://x/b1.mp4', 'https://x/card.png']);
// in/out are SOURCE times: start is the in point, duration the length
assert.strictEqual(r.clips[0].in, 12); assert.strictEqual(r.clips[0].out, 30); assert.strictEqual(r.clips[0].seconds, 30.042);
assert.strictEqual(r.clips[0].poster, 'https://x/a2.jpg');
assert.strictEqual(r.clips[1].in, 6.006); assert.strictEqual(r.clips[1].out, 26.006); assert.strictEqual(r.clips[1].gain, -3);
// a still holds for its duration
assert.strictEqual(r.clips[2].kind, 'image'); assert.strictEqual(r.clips[2].out, 3);
assert.strictEqual(r.total, 41);
assert.deepStrictEqual(r.gaps, [{ at: 18, seconds: 2 }]);
assert.strictEqual(r.skipped.length, 1); assert.strictEqual(r.skipped[0].file, 'not-in-the-map.mp4');
// the connected audio: its offset (14s) is in the PARENT's local time, whose
// first frame is the parent's start (12s) — so it lands 2s into the timeline,
// anchored to the piece it rode in on; in/out source, gain and fades read
assert.strictEqual(r.sounds.length, 1);
const s = r.sounds[0];
assert.strictEqual(s.url, 'https://x/jazz.mp3'); assert.strictEqual(s.at, 2); assert.strictEqual(s.in, 30); assert.strictEqual(s.out, 70);
assert.deepStrictEqual(s.anchor, { piece: 'p1', offset: 2 });
assert.strictEqual(s.gain, -9); assert.strictEqual(s.fadeIn, 1); assert.strictEqual(s.fadeOut, 2.5);

// DETACHED AUDIO (2026-09-16, her second LumaFusion export): the clip is a
// <video> plus its own <audio> on a lane — the sound lane carries it, at the
// parent's timeline second, and the picture is muted so it never plays twice.
// A sound connected to a spine asset-clip with start=0 lands at offset + at.
const DETACHED = `<?xml version="1.0"?><!DOCTYPE fcpxml><fcpxml version="1.8"><resources>
  <format id="r1" frameDuration="1/24s" width="720" height="1280"/>
  <asset id="a" name="one.mp4" src="./one.mp4" format="r1" hasVideo="1" hasAudio="1" start="0s" duration="15s"/>
  <asset id="b" name="two.mp4" src="./two.mp4" format="r1" hasVideo="1" hasAudio="1" start="0s" duration="15s"/>
  <asset id="v" name="vo.mp3" src="./vo.mp3" hasAudio="1" start="0s" duration="5s"/>
</resources><library><event name="e"><project name="p"><sequence format="r1"><spine>
  <clip name="one" offset="10s" start="5s" duration="3s" format="r1">
    <video offset="0s" ref="a" duration="15s"/>
    <audio name="one" offset="6s" start="6s" duration="4s" ref="a" lane="-1"/>
  </clip>
  <asset-clip name="two" offset="13s" start="0s" duration="8s" ref="b" format="r1">
    <asset-clip name="vo" offset="4s" start="1s" duration="2s" ref="v" lane="-1"/>
  </asset-clip>
</spine></sequence></project></event></library></fcpxml>`;
const d = fcpxmlToCut(DETACHED, { 'one.mp4': { url: 'https://x/one.mp4', seconds: 15 }, 'two.mp4': { url: 'https://x/two.mp4', seconds: 15 }, 'vo.mp3': { url: 'https://x/vo.mp3', seconds: 5 } });
assert.strictEqual(d.clips.length, 2);
assert.strictEqual(d.clips[0].in, 5); assert.strictEqual(d.clips[0].out, 8); assert.strictEqual(d.clips[0].mute, true, 'a clip whose audio is detached is muted');
assert.notStrictEqual(d.clips[1].mute, true);
assert.strictEqual(d.sounds.length, 2);
// one's audio: 1s into the clip (offset 6 against start 5), source 6-10, anchored to p1 at +1
assert.strictEqual(d.sounds[0].at, 11); assert.strictEqual(d.sounds[0].in, 6); assert.strictEqual(d.sounds[0].out, 10);
assert.deepStrictEqual(d.sounds[0].anchor, { piece: 'p1', offset: 1 });
// the vo: 4s into a clip that starts at 0, on a piece at 13s → 17s, source 1-3
assert.strictEqual(d.sounds[1].at, 17); assert.strictEqual(d.sounds[1].in, 1); assert.strictEqual(d.sounds[1].out, 3);
assert.deepStrictEqual(d.sounds[1].anchor, { piece: 'p2', offset: 4 });

// the result is a valid cut-model doc: every piece and sound survives cleaning
const CutModel = require('../cut-model');
const clean = CutModel.cleanPieces ? CutModel.cleanPieces(r.clips) : null;
if (clean) assert.strictEqual(clean.length, 3, 'cut-model kept every piece');
const cs = CutModel.cleanSounds ? CutModel.cleanSounds(r.sounds) : null;
if (cs) assert.strictEqual(cs.length, 1, 'cut-model kept the sound');

// a document with no spine is refused, never an empty cut
assert.throws(() => fcpxmlToCut('<fcpxml version="1.8"><resources/></fcpxml>', {}), /spine/);
// BY FINGERPRINT (2026-09-16, her first real export): a clip the app saved as
// `clip-<random>.mp4` joins by length + shape — when exactly ONE clip has them.
const { shapeOf, shapeOfCard, fingerprintMatch } = require('./fcpxml-to-cut.js');
assert.strictEqual(shapeOf(496, 864), '480p portrait');
assert.strictEqual(shapeOf(720, 1280), '720p portrait');
assert.strictEqual(shapeOf(864, 496), '480p landscape');
assert.strictEqual(shapeOfCard('480p', '9:16'), '480p portrait');
assert.strictEqual(shapeOfCard('720p', '16:9'), '720p landscape');
const REAL = `<?xml version="1.0"?><!DOCTYPE fcpxml><fcpxml version="1.8"><resources>
  <format id="f1" frameDuration="25/600s" width="720" height="1280"/>
  <format id="r0" frameDuration="512/12288s" width="496" height="864"/>
  <format id="r1" frameDuration="512/12288s" width="720" height="1280"/>
  <asset id="p1" name="clip-AAAA.mp4" src="./clip-AAAA.mp4" format="r1" hasVideo="1" hasAudio="1" start="0s" duration="2900/600s"/>
  <asset id="p2" name="clip-BBBB.mp4" src="./clip-BBBB.mp4" format="r0" hasVideo="1" hasAudio="1" start="0s" duration="184832/12288s"/>
  <asset id="p3" name="clip-CCCC.mp4" src="./clip-CCCC.mp4" format="r0" hasVideo="1" hasAudio="1" start="0s" duration="49664/12288s"/>
</resources><library><event name="e"><project name="p"><sequence format="f1"><spine>
  <asset-clip name="a" offset="0s" start="0s" duration="1525/600s" ref="p1"/>
  <asset-clip name="b" offset="1525/600s" start="0s" duration="2s" ref="p2"/>
  <asset-clip name="c" offset="3s" start="0s" duration="2s" ref="p3"/>
</spine></sequence></project></event></library></fcpxml>`;
const LOG = {
  'trim1.mp4': { url: 'https://x/trim1.mp4', file: 'trim1.mp4', seconds: 4.833, shape: '720p portrait', id: 'j1 trim', project: 'witch', folder: 'xmas' },
  'full1.mp4': { url: 'https://x/full1.mp4', file: 'full1.mp4', seconds: 15, shape: '720p portrait', id: 'j1', project: 'witch', folder: 'xmas' },
  'm1.mp4': { url: 'https://x/m1.mp4', file: 'm1.mp4', seconds: 15, shape: '480p portrait', id: 'j2', project: 'witch', folder: 'xmas' },
  'm2.mp4': { url: 'https://x/m2.mp4', file: 'm2.mp4', seconds: 15, shape: '480p portrait', id: 'j3', project: 'ward', folder: '' },
  'm3.mp4': { url: 'https://x/m3.mp4', file: 'm3.mp4', seconds: 4, shape: '480p portrait', id: 'j4', project: 'witch', folder: 'xmas' },
  'm4.mp4': { url: 'https://x/m4.mp4', file: 'm4.mp4', seconds: 4, shape: '480p portrait', id: 'j5', project: 'witch', folder: 'xmas' },
};
// the trim's own length wins over the job's nominal 15 for the same shape
assert.deepStrictEqual(fingerprintMatch({ seconds: 4.8333, w: 720, h: 1280 }, LOG).map((m) => m.id), ['j1 trim']);
const rr = fcpxmlToCut(REAL, LOG);
// p1: one 4.833s 720p clip → matched. p2: two 15s 480p clips, but the sure
// match sits in `witch`, so the ward one drops and j2 is it. p3: two 4s
// clips in the SAME folder → still ambiguous, never guessed, both named.
assert.strictEqual(rr.clips.length, 2);
assert.strictEqual(rr.clips[0].url, 'https://x/trim1.mp4');
assert.strictEqual(rr.clips[1].url, 'https://x/m1.mp4');
assert.strictEqual(rr.skipped.length, 1);
assert.ok(/2 clips are 4\.042s 480p portrait/.test(rr.skipped[0].why), rr.skipped[0].why);
assert.ok(/j4 · j5/.test(rr.skipped[0].why));
// a name that IS in the map still wins over any fingerprint
const named = fcpxmlToCut(REAL.replace('clip-AAAA.mp4', 'full1.mp4').replace('./clip-AAAA.mp4', './full1.mp4'), LOG);
assert.strictEqual(named.clips[0].url, 'https://x/full1.mp4');
// A FULL-MEDIA ZIP SETTLES A TIE BY md5: the zip's bytes are the originals,
// so the Storage object with the same md5 is the clip, whatever it is named.
const { settleByHash } = require('./fcpxml-to-cut.js');
(async () => {
  const media = Object.assign({}, LOG);
  const tie = fcpxmlToCut(REAL, media);
  assert.strictEqual(tie.ambiguous.length, 1);
  assert.strictEqual(tie.ambiguous[0].file, 'clip-CCCC.mp4');
  const heads = { 'https://x/m3.mp4': 'AAA=', 'https://x/m4.mp4': 'BBB=' };
  const n = await settleByHash(tie, media, { 'clip-CCCC.mp4': 'BBB=' }, async (u) => heads[u] || null);
  assert.strictEqual(n, 1);
  assert.strictEqual(media['clip-CCCC.mp4'].url, 'https://x/m4.mp4');
  const done = fcpxmlToCut(REAL, media);
  assert.strictEqual(done.clips.length, 3);
  assert.strictEqual(done.clips[2].url, 'https://x/m4.mp4');
  assert.strictEqual(done.skipped.length, 0);
  // an md5 nothing matches settles nothing and guesses nothing
  const m2 = Object.assign({}, LOG);
  assert.strictEqual(await settleByHash(fcpxmlToCut(REAL, m2), m2, { 'clip-CCCC.mp4': 'ZZZ=' }, async () => 'AAA='), 0);
  assert.strictEqual(fcpxmlToCut(REAL, m2).clips.length, 2);
  // BY FILE SIZE (2026-09-16, her Files screenshot): the size the Files app
  // shows — decimal MB, one decimal, or a whole number under 10MB — narrows
  // the candidates by a HEAD of each; one hit settles, several narrow.
  const { settleBySize } = require('./fcpxml-to-cut.js');
  const m3 = Object.assign({}, LOG);
  const r3 = fcpxmlToCut(REAL, m3);
  const before = r3.ambiguous.length;
  assert.ok(before >= 1, 'the fixture has an ambiguous clip');
  const amb = r3.ambiguous[0];
  const cands = amb.candidates.map((c) => c.url);
  // "1.2 MB" settles on the one candidate within 50KB of it
  const sizes = {}; sizes[amb.file] = '1.2';
  const fake = async (u) => (u === cands[0] ? 1234567 : 5000000);
  assert.strictEqual(await settleBySize(r3, m3, sizes, fake), 1);
  assert.strictEqual(m3[amb.file].url, cands[0]);
  // "9 MB" (a whole number) is ±0.5MB, so two candidates at 8.9 and 8.95 both hit → narrowed, not settled
  const m4 = Object.assign({}, LOG);
  const r4 = fcpxmlToCut(REAL, m4);
  const amb4 = r4.ambiguous[0];
  const sizes4 = {}; sizes4[amb4.file] = 9;
  const two = amb4.candidates.slice(0, 2).map((c) => c.url);
  const fake4 = async (u) => (u === two[0] ? 8900000 : u === two[1] ? 8950000 : 100);
  assert.strictEqual(await settleBySize(r4, m4, sizes4, fake4), 0);
  assert.strictEqual(m4[amb4.file], undefined);
  assert.deepStrictEqual(amb4.candidates.map((c) => c.url), two, 'narrowed to the two that fit');
  // no size given → nothing touched, nothing guessed
  const m5 = Object.assign({}, LOG);
  assert.strictEqual(await settleBySize(fcpxmlToCut(REAL, m5), m5, {}, async () => 1), 0);
  console.log('test-fcpxml-to-cut: ok');
})().catch((e) => { console.error(e); process.exit(1); });
