// The TOOL door on the Atlas module — a lip-sync or an upscaler that takes a
// finished clip instead of drawing one (2026-09-17). Pure, no network.
const assert = require('assert');
const a = require('../atlascloud.js');

// which ids are tools
for (const id of ['veed/lipsync', 'sync/lipsync-v3', 'atlascloud/video-upscaler', 'byteplus/video/upscaler', 'tencent/video/upscaler']) {
  assert.ok(a.isTool(id), id + ' is a tool');
  assert.strictEqual(a.modelIdOf(id), id, id + ' passes through modelIdOf');
}
for (const id of ['minimax/h3/reference-to-video', 'alibaba/wan-3.0/reference-to-video', 'bytedance/seedance-2.0-mini/reference-to-video', 'lipsync', 'veed']) {
  assert.ok(!a.isTool(id), id + ' is not a tool');
}

// a lip-sync: the schema's own field names, no prompt needed
let r = a.buildRequest({ model: 'veed/lipsync', videoUrl: 'https://x/v.mp4', audioUrl: 'https://x/a.mp3' });
assert.deepStrictEqual(r.body, { model: 'veed/lipsync', video_url: 'https://x/v.mp4', audio_url: 'https://x/a.mp3' });
assert.deepStrictEqual(r.params, { video: 'https://x/v.mp4', audio: 'https://x/a.mp3' });
// the reference lists work as the same shape
r = a.buildRequest({ model: 'sync/lipsync-v3', referenceVideoUrls: ['https://x/v.mp4'], referenceAudioUrls: ['https://x/a.mp3'], syncMode: 'cut_off' });
assert.strictEqual(r.body.video_url, 'https://x/v.mp4');
assert.strictEqual(r.body.audio_url, 'https://x/a.mp3');
assert.strictEqual(r.body.sync_mode, 'cut_off');
// an upscaler: video + target_resolution, lowercased
r = a.buildRequest({ model: 'atlascloud/video-upscaler', videoUrl: 'https://x/v.mp4', resolution: '2K' });
assert.deepStrictEqual(r.body, { model: 'atlascloud/video-upscaler', video: 'https://x/v.mp4', target_resolution: '2k' });
r = a.buildRequest({ model: 'byteplus/video/upscaler', videoUrl: 'https://x/v.mp4' });
assert.deepStrictEqual(r.body, { model: 'byteplus/video/upscaler', video: 'https://x/v.mp4' });

// refusals name what is missing
assert.match(a.buildRequest({ model: 'veed/lipsync', videoUrl: 'https://x/v.mp4' }).error, /audioUrl/);
assert.match(a.buildRequest({ model: 'veed/lipsync', audioUrl: 'https://x/a.mp3' }).error, /videoUrl/);
assert.match(a.buildRequest({ model: 'atlascloud/video-upscaler' }).error, /videoUrl/);
// and a drawing model still needs its prompt
assert.match(a.buildRequest({ model: 'minimax/h3/reference-to-video' }).error, /prompt/);

console.log('test-atlascloud-tools: ok');
