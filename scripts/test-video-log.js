'use strict';
// video-log.js — every clip's exact prompt and references, filed by the route.
const fs = require('fs');
const v = require('../video-log');
let fails = 0;
function ok(n, c, x) { if (c) console.log('  ok   ' + n); else { fails++; console.log('  FAIL ' + n + (x ? '\n       ' + x : '')); } }
console.log('video-log');
const params = { duration: 4, resolution: '480p', aspect_ratio: '3:4', generate_audio: true,
  reference_video_urls: ['https://x/v.mp4'], reference_image_urls: ['https://x/i.jpg'] };
const d = v.sentRecord({ jobId: 'j1', prompt: 'her words', model: 'seedance-2.5', params, tag: { chat: 'c', scene: 'b1', title: 't', ignored: 'x' } });
ok('the literal prompt and the exact params ride the doc', d.prompt === 'her words' && d.params === params && d.model === 'seedance-2.5');
ok('every reference is pulled out by kind', d.references.videos[0] === 'https://x/v.mp4' && d.references.images[0] === 'https://x/i.jpg' && d.references.audio.length === 0);
ok('the tag is whitelisted', d.chat === 'c' && d.scene === 'b1' && d.title === 't' && !('ignored' in d));
// THE TWO KEYFRAMES ARE ON FILE TOO (2026-09-11) — `start_image` / `end_image`
// is the ONE vocabulary every door writes into `params`, whatever it calls
// them on the wire (Atlas `image`/`last_image`, OpenRouter `frame_images`,
// APIFRAME `start_image`/`end_image`), so the 1080p redo can re-send a
// chained clip exactly as it was drawn. A clip with no keyframe files the
// empty string, exactly as it always has.
const kf = v.sentRecord({ jobId: 'j3', prompt: 'p', model: 'seedance-2.5',
  params: { ...params, start_image: 'https://x/first.png', end_image: 'https://x/last.png' } });
ok('a first and last frame ride the doc as startImage / endImage',
  kf.references.startImage === 'https://x/first.png' && kf.references.endImage === 'https://x/last.png');
ok('and the exact params keep them as they were sent',
  kf.params.start_image === 'https://x/first.png' && kf.params.end_image === 'https://x/last.png');
ok('a clip with no keyframe files empty strings, not undefined',
  d.references.startImage === '' && d.references.endImage === '');
// every door must put them in `params` under those names, or the log records
// a clip whose first frame nothing can find
for (const [name, file, re] of [
  ['Atlas Cloud', 'atlascloud.js', /params\.start_image = kf\.first/],
  ['OpenRouter', 'openrouter.js', /params\.start_image = url1/],
  ['APIFRAME', 'apiframe.js', /params\.start_image = first/]]) {
  ok(name + ' writes the first frame into params under the log\'s own name',
    re.test(fs.readFileSync(__dirname + '/../' + file, 'utf8')));
}
ok('status opens as sent with a time', d.status === 'sent' && /^\d{4}-/.test(d.sentAt));
ok('a running job patches nothing', v.finishPatch({ status: 'PROCESSING' }, null) === null);
const f = v.finishPatch({ status: 'COMPLETED' }, 'https://storage/x.mp4');
ok('a finished job patches status + the permanent url', f.status === 'completed' && f.video === 'https://storage/x.mp4');
const e = v.finishPatch({ status: 'FAILED', error: 'audio copyright' }, null);
ok('a failed job keeps the error', e.status === 'failed' && e.error === 'audio copyright' && !e.video);
// HOW LONG THE DRAW TOOK — read off the door's own record, never sentAt→doneAt
ok('Atlas\'s own latency is the figure', v.drewMsOf({ latency_ms: 153626 }) === 153626);
ok('a pair of timestamps is the fallback',
  v.drewMsOf({ created_at: '2026-09-10T09:02:30.346Z', completed_at: '2026-09-10T09:05:03.972Z' }) === 153626);
ok('seconds are read as seconds', v.drewMsOf({ startTime: 1757496150, endTime: 1757496303 }) === 153000);
ok('a door that says nothing gives nothing', v.drewMsOf({ status: 'COMPLETED' }) === null && v.drewMsOf(null) === null);
ok('a backwards or absurd span is refused rather than guessed',
  v.drewMsOf({ created_at: '2026-09-10T09:05:00Z', completed_at: '2026-09-10T09:02:00Z' }) === null
  && v.drewMsOf({ latency_ms: 9 * 60 * 60 * 1000 }) === null && v.drewMsOf({ latency_ms: 0 }) === null);
const fd = v.finishPatch({ status: 'COMPLETED' }, 'https://storage/x.mp4', { latency_ms: 153626 });
ok('the finish patch carries it', fd.drewMs === 153626);
ok('and leaves it off when the door did not say', !('drewMs' in v.finishPatch({ status: 'COMPLETED' }, 'https://storage/x.mp4', {})));
for (const [name, file] of [['Atlas Cloud', 'atlascloud.js'], ['OpenRouter', 'openrouter.js'], ['APIFRAME', 'apiframe.js']]) {
  const s2 = fs.readFileSync(__dirname + '/../' + file, 'utf8');
  ok(name + ' hands its raw record to finishPatch', /videoLog\.finishPatch\([^;]*,[^;]*,\s*[a-z]\)/.test(s2));
}
const fj = v.fromJob({ id: 'j2', status: 'COMPLETED', createdAt: '2026-09-07T00:00:00Z', input: { model: 'seedance-2.5', prompt: 'p', seedanceParams: params } }, { chat: 'c' });
ok('the backfill rebuilds the same shape from APIFRAME\'s record', fj.job === 'j2' && fj.prompt === 'p' && fj.references.videos.length === 1 && fj.status === 'completed' && fj.sentAt === '2026-09-07T00:00:00Z');
const src = fs.readFileSync(__dirname + '/../apiframe.js', 'utf8');
ok('POST /video files the record through video-log', /videoLog\.sentRecord\(/.test(src) && /lastSentParams\.set\(String\(id\), params\)/.test(src));
ok('GET /video-job patches the outcome', /videoLog\.finishPatch\(j,/.test(src));
ok('GET /video-log exists', /router\.get\('\/video-log'/.test(src));
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed'); process.exit(fails ? 1 : 0);
