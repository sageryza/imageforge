'use strict';
// test-atlascloud-wan.js — Wan 3.0 on the Atlas door: the short names, the
// body Atlas's Wan schema takes (one mixed `refers` array, `audio`, `ratio`,
// none of Seedance's keys), the limits, the log's shared vocabulary — and
// that the Seedance branch did not move. Pure, no network.
const a = require('../atlascloud');
let fails = 0;
function ok(n, c, x) { if (c) console.log('  ok   ' + n); else { fails++; console.log('  FAIL ' + n + (x ? '\n       ' + x : '')); } }
console.log('atlascloud — wan 3.0');

const WAN = 'alibaba/wan-3.0/reference-to-video';
ok('short names land on the plain Wan id', ['wan', 'wan-3.0', 'wan3', 'Wan 3.0', 'alibaba/wan-3.0'].every((s) => a.modelIdOf(s) === WAN));
ok('the full id and the -prime id pass through as given', a.modelIdOf(WAN) === WAN && a.modelIdOf('alibaba/wan-3.0-prime/reference-to-video') === 'alibaba/wan-3.0-prime/reference-to-video');
ok('isWan tells the two families apart', a.isWan(WAN) && !a.isWan(a.DEFAULT_MODEL) && !a.isWan('alibaba/wan-2.6/reference-to-video'));
ok('WAN_MODEL is exported and is the plain id', a.WAN_MODEL === WAN);

const base = { prompt: 'sophie is the woman in Video 1.', model: 'wan-3.0', duration: 15, resolution: '480p', aspectRatio: '16:9',
  referenceImageUrls: ['https://x/i1.png', 'https://x/i2.png'], referenceVideoUrls: ['https://x/v1.mp4'], referenceAudioUrls: ['https://x/a1.mp3'] };
const r = a.buildRequest(base);
ok('a Wan body builds on the Wan id', !r.error && r.model === WAN && r.body.model === WAN);
ok('the prompt rides verbatim', r.body.prompt === base.prompt);
ok('seconds, resolution, RATIO and AUDIO ride under Wan\'s names', r.body.duration === 15 && r.body.resolution === '480p' && r.body.ratio === '16:9' && r.body.audio === true);
ok('references ride as ONE refers array — pictures, then videos, then audio — each {url, type}',
  JSON.stringify(r.body.refers) === JSON.stringify([
    { url: 'https://x/i1.png', type: 'image' }, { url: 'https://x/i2.png', type: 'image' },
    { url: 'https://x/v1.mp4', type: 'video' }, { url: 'https://x/a1.mp3', type: 'audio' }]));
ok('none of Seedance\'s keys are sent', ['generate_audio', 'bitrate_mode', 'watermark', 'return_last_frame', 'reference_images', 'reference_videos', 'reference_audios', 'aspect_ratio'].every((k) => !(k in r.body)));
ok('the LOG keeps the shared vocabulary (params read like APIFRAME\'s)', r.params.duration === 15 && r.params.aspect_ratio === '16:9' && r.params.generate_audio === true
  && JSON.stringify(r.params.reference_image_urls) === JSON.stringify(base.referenceImageUrls) && r.params.reference_video_urls[0] === 'https://x/v1.mp4' && r.params.reference_audio_urls[0] === 'https://x/a1.mp3');
ok('every clip carries a seed, inside Atlas\'s range, on body and log alike', Number.isInteger(r.body.seed) && r.body.seed >= 1 && r.params.seed === r.body.seed);
ok('a caller\'s seed wins', a.buildRequest({ ...base, seed: 7 }).body.seed === 7);
ok('audio off is honoured', a.buildRequest({ ...base, generateAudio: false }).body.audio === false);
ok('no references → no refers key', !('refers' in a.buildRequest({ prompt: 'p', model: 'wan' }).body));
ok('480p is this door\'s default, not Atlas\'s 1080p', a.buildRequest({ prompt: 'p', model: 'wan' }).body.resolution === '480p');
ok('1080p and the esr tiers ride; a Seedance-only tier is refused', a.buildRequest({ prompt: 'p', model: 'wan', resolution: '1080p' }).body.resolution === '1080p'
  && a.buildRequest({ prompt: 'p', model: 'wan', resolution: '4k-esr' }).body.resolution === '4k-esr' && /resolution/.test(a.buildRequest({ prompt: 'p', model: 'wan', resolution: '720p-SR' }).error));
ok('2s and 30s ride, -1 rides, 1s and 31s are refused', a.buildRequest({ prompt: 'p', model: 'wan', duration: 2 }).body.duration === 2 && a.buildRequest({ prompt: 'p', model: 'wan', duration: 30 }).body.duration === 30
  && a.buildRequest({ prompt: 'p', model: 'wan', duration: -1 }).body.duration === -1 && /2-30/.test(a.buildRequest({ prompt: 'p', model: 'wan', duration: 1 }).error) && /2-30/.test(a.buildRequest({ prompt: 'p', model: 'wan', duration: 31 }).error));
ok('adaptive rides; 21:9 (Seedance\'s) is refused here', a.buildRequest({ prompt: 'p', model: 'wan', aspectRatio: 'adaptive' }).body.ratio === 'adaptive' && /aspectRatio/.test(a.buildRequest({ prompt: 'p', model: 'wan', aspectRatio: '21:9' }).error));
ok('ten pictures ride, eleven are refused', !a.buildRequest({ prompt: 'p', model: 'wan', referenceImageUrls: Array(10).fill('https://x/i.png') }).error && /at most 10/.test(a.buildRequest({ prompt: 'p', model: 'wan', referenceImageUrls: Array(11).fill('https://x/i.png') }).error));
ok('five videos ride, six are refused', !a.buildRequest({ prompt: 'p', model: 'wan', referenceVideoUrls: Array(5).fill('https://x/v.mp4') }).error && /at most 5/.test(a.buildRequest({ prompt: 'p', model: 'wan', referenceVideoUrls: Array(6).fill('https://x/v.mp4') }).error));
ok('the full twenty (10 + 5 + 5) ride together', !a.buildRequest({ prompt: 'p', model: 'wan', referenceImageUrls: Array(10).fill('https://x/i.png'), referenceVideoUrls: Array(5).fill('https://x/v.mp4'), referenceAudioUrls: Array(5).fill('https://x/a.mp3') }).error);
const f = a.buildRequest({ prompt: 'p', model: 'wan', fileUrl: 'https://x/script.md' });
ok('a script file rides as `file` with thinking on, and on the log', f.body.file === 'https://x/script.md' && f.body.enable_thinking === true && f.params.file_url === 'https://x/script.md');
ok('no file → no thinking mode', !('enable_thinking' in r.body) && !('file' in r.body));
ok('a non-https file is refused', /fileUrl/.test(a.buildRequest({ prompt: 'p', model: 'wan', fileUrl: 'script.md' }).error));
ok('an empty prompt is still refused', a.buildRequest({ prompt: ' ', model: 'wan' }).error === 'prompt is required');

// the Seedance branch did not move
const s = a.buildRequest({ prompt: 'p', duration: 4, referenceImageUrls: ['https://x/i.png'], referenceVideoUrls: ['https://x/v.mp4'] });
ok('a Mini body is byte-for-byte the Seedance shape (no refers, its own keys)', s.body.model === a.DEFAULT_MODEL && !('refers' in s.body) && !('audio' in s.body)
  && s.body.generate_audio === true && s.body.return_last_frame === false && s.body.reference_images[0] === 'https://x/i.png' && s.body.reference_videos[0] === 'https://x/v.mp4');
ok('Seedance still refuses 16 seconds and a Wan tier', /4-15/.test(a.buildRequest({ prompt: 'p', duration: 16 }).error) && /resolution/.test(a.buildRequest({ prompt: 'p', resolution: '4k-esr' }).error));
ok('the unknown-model refusal now names wan-3.0 as a way in', /wan-3\.0/.test(a.buildRequest({ prompt: 'p', model: '2.5' }).error));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed'); process.exit(fails ? 1 : 0);
