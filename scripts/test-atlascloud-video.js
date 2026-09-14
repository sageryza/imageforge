'use strict';
// atlascloud.js — the third Seedance door: the request shape, the limits,
// the status map, the refusal, and the source pins. Pure, no network.
const fs = require('fs');
const a = require('../atlascloud');
let fails = 0;
function ok(n, c, x) { if (c) console.log('  ok   ' + n); else { fails++; console.log('  FAIL ' + n + (x ? '\n       ' + x : '')); } }
console.log('atlascloud video door');

const base = { prompt: 'her words', duration: 4, resolution: '480p', aspectRatio: '16:9',
  referenceImageUrls: ['https://x/i1.png', 'https://x/i2.png'], referenceAudioUrls: ['https://x/a.mp3'] };
const r = a.buildRequest(base);
ok('a good body builds on the one id on file', !r.error && r.model === a.DEFAULT_MODEL && r.body.model === 'bytedance/seedance-2.0-mini/reference-to-video');
ok('the prompt rides verbatim', r.body.prompt === 'her words');
ok('seconds, resolution, RATIO (Atlas\'s field name) and audio ride', r.body.duration === 4 && r.body.resolution === '480p' && r.body.ratio === '16:9' && r.body.generate_audio === true && !('aspect_ratio' in r.body));
ok('references ride as Atlas\'s three arrays, in list order', JSON.stringify(r.body.reference_images) === JSON.stringify(base.referenceImageUrls) && r.body.reference_audios[0] === 'https://x/a.mp3' && !('reference_videos' in r.body));
ok('the log params read like APIFRAME\'s seedanceParams', r.params.duration === 4 && r.params.aspect_ratio === '16:9' && JSON.stringify(r.params.reference_image_urls) === JSON.stringify(base.referenceImageUrls) && r.params.reference_audio_urls[0] === 'https://x/a.mp3');
ok('every clip carries a seed, inside Atlas\'s range', Number.isInteger(r.body.seed) && r.body.seed >= 1 && r.body.seed <= 4294967295 && r.params.seed === r.body.seed);
ok('a caller\'s seed wins', a.buildRequest({ ...base, seed: 7 }).body.seed === 7);
ok('no watermark, standard bitrate, no last frame', r.body.watermark === false && r.body.bitrate_mode === 'standard' && r.body.return_last_frame === false);
const v = a.buildRequest({ ...base, referenceVideoUrls: ['https://x/v.mp4'] });
ok('a reference video rides as reference_videos', !v.error && v.body.reference_videos[0] === 'https://x/v.mp4' && v.params.reference_video_urls[0] === 'https://x/v.mp4');
ok('no references → none of the three keys', (() => { const b = a.buildRequest({ prompt: 'p' }).body; return !('reference_images' in b) && !('reference_videos' in b) && !('reference_audios' in b); })());
ok('an empty prompt is refused', a.buildRequest({ prompt: '  ' }).error === 'prompt is required');
ok('audio alone is refused (Atlas\'s own rule)', /reference audio needs/.test(a.buildRequest({ prompt: 'p', referenceAudioUrls: ['https://x/a.mp3'] }).error));
ok('ten pictures are refused', /at most 9/.test(a.buildRequest({ prompt: 'p', referenceImageUrls: Array(10).fill('https://x/i.png') }).error));
ok('four videos are refused', /at most 3/.test(a.buildRequest({ prompt: 'p', referenceVideoUrls: Array(4).fill('https://x/v.mp4') }).error));
ok('16 seconds is refused, -1 rides', /4-15/.test(a.buildRequest({ prompt: 'p', duration: 16 }).error) && a.buildRequest({ prompt: 'p', duration: -1 }).body.duration === -1);
// THE RANGE IS PER MODEL (2026-09-11): 2.5 takes 4-30 on Atlas's own schema,
// so a 30s 2.5 job rides and 31 is refused; Mini still stops at 15.
{
  const m25 = 'bytedance/seedance-2.5/reference-to-video';
  ok('30 seconds rides on 2.5', a.buildRequest({ prompt: 'p', model: m25, duration: 30 }).body.duration === 30);
  ok('31 seconds is refused on 2.5, naming 4-30', /4-30/.test(a.buildRequest({ prompt: 'p', model: m25, duration: 31 }).error || ''));
  ok('16 seconds is still refused on Mini', /4-15/.test(a.buildRequest({ prompt: 'p', duration: 16 }).error || ''));
}
ok('an unknown resolution is refused, 720p-SR rides', /resolution/.test(a.buildRequest({ prompt: 'p', resolution: '4k' }).error) && a.buildRequest({ prompt: 'p', resolution: '720p-SR' }).body.resolution === '720p-SR');
ok('an unknown ratio is refused, adaptive rides', /aspectRatio/.test(a.buildRequest({ prompt: 'p', aspectRatio: '2:3' }).error) && a.buildRequest({ prompt: 'p', aspectRatio: 'adaptive' }).body.ratio === 'adaptive');
ok('audio off is honoured', a.buildRequest({ prompt: 'p', generateAudio: false }).body.generate_audio === false);

ok('Mini\'s short names map onto the one id on file', a.modelIdOf('mini') === a.DEFAULT_MODEL && a.modelIdOf('seedance-2.0-mini') === a.DEFAULT_MODEL && a.modelIdOf('bytedance/seedance-2.0-mini') === a.DEFAULT_MODEL);
ok('a full Atlas id is passed through as given (unmeasured, Atlas decides)', a.modelIdOf('bytedance/seedance-2.5/reference-to-video') === 'bytedance/seedance-2.5/reference-to-video');
ok('another short name is refused, never guessed into an id', a.modelIdOf('2.5') === null && a.modelIdOf('seedance-1-lite') === null && /unknown model/.test(a.buildRequest({ prompt: 'p', model: '2.5' }).error));
ok('no model → Mini', a.modelIdOf(undefined) === a.DEFAULT_MODEL);

ok('statuses map onto the log\'s vocabulary', a.apiframeStatus('processing') === 'PROCESSING' && a.apiframeStatus('completed') === 'COMPLETED' && a.apiframeStatus('succeeded') === 'COMPLETED' && a.apiframeStatus('failed') === 'FAILED' && a.apiframeStatus('timeout') === 'FAILED');
ok('ByteDance\'s content refusal is told apart from a shape error',
  a.refusalKind('InputImageSensitiveContentDetected.PrivacyInformation') === 'content'
  && a.refusalKind('the output video may be related to copyright restrictions') === 'output'
  && a.refusalKind('Total duration of all reference videos must not exceed 15.2 seconds.') === 'shape'
  && a.refusalKind('x', 1012006) === 'output'
  && a.refusalKind('reference_images: invalid url') === 'shape' && a.refusalKind('boom') === 'other');

const src = fs.readFileSync(__dirname + '/../atlascloud.js', 'utf8');
ok('POST /video files the shared log through video-log', /videoLog\.sentRecord\(/.test(src) && /provider: 'atlascloud'/.test(src));
ok('GET /video-job patches the outcome through video-log', /videoLog\.finishPatch\(/.test(src));
ok('the poll reads the log before downloading again', /logDoc\(id\)\.get\(\)/.test(src));
ok('the poll files tokens and never invents a dollar cost', /patch\.tokens = tokens/.test(src) && !/patch\.cost/.test(src));
ok('the key is never sent to the CDN host', /fetch\(src, \{ agent: proxyAgent \|\| undefined \}\)/.test(src));
ok('a content refusal names APIFRAME as the door for a person', /hint = kind === 'content'[^\n]*APIFRAME_ROUTE/.test(src));
ok('a refusal is never retried or reshaped', !/retry/i.test(src.replace(/\/\/.*$/gm, '')));
const server = fs.readFileSync(__dirname + '/../server.js', 'utf8');
ok('mounted at /api/atlascloud inside loadConfig', /app\.use\('\/api\/atlascloud', atlascloud\.router\)/.test(server));
const cfg = fs.readFileSync(__dirname + '/../config-loader.js', 'utf8');
ok('ATLASCLOUD_API_KEY is a managed key', /'ATLASCLOUD_API_KEY'/.test(cfg));
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed'); process.exit(fails ? 1 : 0);
