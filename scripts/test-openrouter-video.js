'use strict';
// openrouter.js — the second Seedance door: the request shape, the video
// refusal, the status map, and the source pins. Pure, no network.
const fs = require('fs');
const o = require('../openrouter');
let fails = 0;
function ok(n, c, x) { if (c) console.log('  ok   ' + n); else { fails++; console.log('  FAIL ' + n + (x ? '\n       ' + x : '')); } }
console.log('openrouter video door');

const base = { prompt: 'her words', duration: 4, resolution: '480p', aspectRatio: '3:4',
  referenceImageUrls: ['https://x/i1.png', 'https://x/i2.png'], referenceAudioUrls: ['https://x/a.mp3'] };
const r = o.buildRequest(base);
ok('a good body builds', !r.error && r.model === 'bytedance/seedance-2.5');
ok('the prompt rides verbatim', r.body.prompt === 'her words');
ok('seconds, resolution, ratio and audio ride', r.body.duration === 4 && r.body.resolution === '480p' && r.body.aspect_ratio === '3:4' && r.body.generate_audio === true);
ok('references are typed image_url then audio_url, in list order',
  JSON.stringify(r.body.input_references.map((x) => x.type)) === '["image_url","image_url","audio_url"]'
  && r.body.input_references[0].image_url.url === 'https://x/i1.png' && r.body.input_references[2].audio_url.url === 'https://x/a.mp3');
ok('the log params carry every reference by kind', JSON.stringify(r.params.reference_image_urls) === JSON.stringify(base.referenceImageUrls) && r.params.reference_audio_urls[0] === 'https://x/a.mp3');
ok('the log params read like APIFRAME\'s seedanceParams', r.params.duration === 4 && r.params.resolution === '480p' && r.params.aspect_ratio === '3:4' && r.params.generate_audio === true);

const v = o.buildRequest({ ...base, referenceVideoUrls: ['https://x/v.mp4'] });
ok('A REFERENCE VIDEO IS REFUSED and the answer names APIFRAME', v.error && v.refused === 'video' && v.error.includes(o.APIFRAME_ROUTE));
ok('an empty prompt is refused', o.buildRequest({ prompt: '  ' }).error === 'prompt is required');
ok('no references → no input_references key', !('input_references' in o.buildRequest({ prompt: 'p' }).body));
ok('audio off is honoured', o.buildRequest({ prompt: 'p', generateAudio: false }).body.generate_audio === false);

ok('short model names map onto OpenRouter ids', o.modelIdOf('seedance-2.0-mini') === 'bytedance/seedance-2.0-mini' && o.modelIdOf('2.5') === 'bytedance/seedance-2.5' && o.modelIdOf('bytedance/seedance-2.0-fast') === 'bytedance/seedance-2.0-fast');
ok('an unknown model is refused, not guessed', o.modelIdOf('seedance-1-lite') === null && /unknown model/.test(o.buildRequest({ prompt: 'p', model: 'seedance-1-lite' }).error));
ok('no model → 2.5', o.modelIdOf(undefined) === o.DEFAULT_MODEL);

ok('statuses map onto the log\'s vocabulary', o.apiframeStatus('pending') === 'PROCESSING' && o.apiframeStatus('in_progress') === 'PROCESSING' && o.apiframeStatus('completed') === 'COMPLETED' && o.apiframeStatus('failed') === 'FAILED' && o.apiframeStatus('expired') === 'FAILED');
ok('ByteDance\'s content refusal is told apart from a shape error',
  o.refusalKind('{"error":{"code":"InputVideoSensitiveContentDetected.PrivacyInformation","message":"may contain real person"}}') === 'content'
  && o.refusalKind('{"name":"ZodError","message":"invalid_union"}') === 'shape' && o.refusalKind('boom') === 'other');

const src = fs.readFileSync(__dirname + '/../openrouter.js', 'utf8');
ok('POST /video files the shared log through video-log', /videoLog\.sentRecord\(/.test(src) && /provider: 'openrouter'/.test(src));
ok('GET /video-job patches the outcome through video-log', /videoLog\.finishPatch\(/.test(src));
ok('the poll reads the log before downloading again', /logDoc\(id\)\.get\(\)/.test(src));
ok('a refusal is never retried or reshaped', !/for \(const .* of shapes\)/.test(src) && !/retry/i.test(src.replace(/\/\/.*$/gm, '')));
const server = fs.readFileSync(__dirname + '/../server.js', 'utf8');
ok('mounted at /api/openrouter inside loadConfig', /app\.use\('\/api\/openrouter', openrouter\.router\)/.test(server));
const cfg = fs.readFileSync(__dirname + '/../config-loader.js', 'utf8');
ok('OPENROUTER_API_KEY is a managed key', /'OPENROUTER_API_KEY'/.test(cfg));
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed'); process.exit(fails ? 1 : 0);
