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
              <asset-clip ref="r4" lane="-1" offset="2s" name="jazz" start="30s" duration="40s">
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
// the connected audio: at = timeline offset, in/out source, gain and fades read
assert.strictEqual(r.sounds.length, 1);
const s = r.sounds[0];
assert.strictEqual(s.url, 'https://x/jazz.mp3'); assert.strictEqual(s.at, 2); assert.strictEqual(s.in, 30); assert.strictEqual(s.out, 70);
assert.strictEqual(s.gain, -9); assert.strictEqual(s.fadeIn, 1); assert.strictEqual(s.fadeOut, 2.5);

// the result is a valid cut-model doc: every piece and sound survives cleaning
const CutModel = require('../cut-model');
const clean = CutModel.cleanPieces ? CutModel.cleanPieces(r.clips) : null;
if (clean) assert.strictEqual(clean.length, 3, 'cut-model kept every piece');
const cs = CutModel.cleanSounds ? CutModel.cleanSounds(r.sounds) : null;
if (cs) assert.strictEqual(cs.length, 1, 'cut-model kept the sound');

// a document with no spine is refused, never an empty cut
assert.throws(() => fcpxmlToCut('<fcpxml version="1.8"><resources/></fcpxml>', {}), /spine/);
console.log('test-fcpxml-to-cut: ok');
