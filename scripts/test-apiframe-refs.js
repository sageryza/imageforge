#!/usr/bin/env node
// The Seedance 2.x reference lists reach APIFRAME's body under the catalogue's
// own names, nested in `seedanceParams`, and are never sent when absent.
// Pure: express / node-fetch / firebase-admin are stubbed through Module._load,
// so this runs in a container with no node_modules and spends nothing.
const Module = require('module');
const assert = require('assert');
const calls = [];
const load = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'express') return { Router: () => ({ get() {}, post() {}, use() {} }) };
  if (req === 'firebase-admin') return { apps: [], initializeApp() {}, credential: { cert() {} }, storage() { return { bucket() { return null; } }; } };
  if (req === 'https-proxy-agent') return { HttpsProxyAgent: function () {} };
  if (req === 'node-fetch') return async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return { ok: true, status: 200, text: async () => '{"jobId":"j1"}' }; };
  return load.call(this, req, ...rest);
};
process.env.APIFRAME_KEY = process.env.APIFRAME_KEY || 'afk_test';
const { seedanceVideo } = require('../apiframe.js');
(async () => {
  const refs = ['https://x/1.webp', 'https://x/2.webp', 'https://x/3.webp'];
  await seedanceVideo('[Image1] a [Image2] b [Image3] c', { model: 'seedance-2-mini', resolution: '480p', duration: 4, generateAudio: false, referenceImageUrls: refs, referenceAudioUrls: [] });
  const p = calls[0].body.seedanceParams;
  assert.deepStrictEqual(p.reference_image_urls, refs, 'the image list rides under the catalogue name');
  assert.ok(!('reference_audio_urls' in p), 'an empty list is not sent');
  assert.ok(!('reference_video_urls' in p), 'an absent list is not sent');
  assert.strictEqual(calls[0].body.model, 'seedance-2-mini');
  assert.strictEqual(p.duration, 4);
  await seedanceVideo('plain', { model: 'seedance-1.5-pro', imageUrl: 'https://x/a.webp' });
  const q = calls[1].body.seedanceParams;
  assert.strictEqual(q.start_image, 'https://x/a.webp');
  assert.ok(!Object.keys(q).some((k) => k.startsWith('reference_')), 'a 1.x call carries no reference key');
  console.log('test-apiframe-refs: ok');
})().catch((e) => { console.error(e); process.exit(1); });
