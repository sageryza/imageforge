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
ok('status opens as sent with a time', d.status === 'sent' && /^\d{4}-/.test(d.sentAt));
ok('a running job patches nothing', v.finishPatch({ status: 'PROCESSING' }, null) === null);
const f = v.finishPatch({ status: 'COMPLETED' }, 'https://storage/x.mp4');
ok('a finished job patches status + the permanent url', f.status === 'completed' && f.video === 'https://storage/x.mp4');
const e = v.finishPatch({ status: 'FAILED', error: 'audio copyright' }, null);
ok('a failed job keeps the error', e.status === 'failed' && e.error === 'audio copyright' && !e.video);
const fj = v.fromJob({ id: 'j2', status: 'COMPLETED', createdAt: '2026-09-07T00:00:00Z', input: { model: 'seedance-2.5', prompt: 'p', seedanceParams: params } }, { chat: 'c' });
ok('the backfill rebuilds the same shape from APIFRAME\'s record', fj.job === 'j2' && fj.prompt === 'p' && fj.references.videos.length === 1 && fj.status === 'completed' && fj.sentAt === '2026-09-07T00:00:00Z');
const src = fs.readFileSync(__dirname + '/../apiframe.js', 'utf8');
ok('POST /video files the record through video-log', /videoLog\.sentRecord\(/.test(src) && /lastSentParams\.set\(String\(id\), params\)/.test(src));
ok('GET /video-job patches the outcome', /videoLog\.finishPatch\(j,/.test(src));
ok('GET /video-log exists', /router\.get\('\/video-log'/.test(src));
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed'); process.exit(fails ? 1 : 0);
