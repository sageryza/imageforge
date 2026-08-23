// The video models' PARAMETER SHAPES — the thing that costs real money when it
// is wrong. A video model's input keys are not guessable from its id (the
// Science School animator found wan-2.7's by POSTing candidate shapes and
// submitted a 130-credit clip of the prompt "test"), and a wrong key does not
// fail loudly: the model ignores it and draws something unconditioned, so the
// bill arrives either way. So the table and the builder are pinned here.
//
//   node scripts/test-video-models.js      (pure — no network, no spend)

const assert = require('assert');
const { VIDEO_MODELS, videoInput } = require('../movies');

let pass = 0;
function check(name, fn) {
  try { fn(); console.log('  ok —', name); pass++; }
  catch (err) { console.log('  FAIL —', name, '\n     ', err.message); process.exitCode = 1; }
}

const START = 'https://example.com/a.png';
const END = 'https://example.com/b.png';

console.log('the model table:');

check('every tier names a shape, a version and a price', () => {
  for (const [tier, m] of Object.entries(VIDEO_MODELS)) {
    assert.ok(['wan22', 'wan27', 'kling'].includes(m.shape), `${tier} has no known shape`);
    assert.match(m.version, /^[0-9a-f]{64}$/, `${tier} has no pinned version`);
    assert.strictEqual(typeof m.costPerClip, 'function', `${tier} cannot price a clip`);
    assert.ok(m.name, `${tier} has no name`);
  }
});

check('the two wan-2.7 tiers are one model at two resolutions', () => {
  assert.strictEqual(VIDEO_MODELS.wan27.version, VIDEO_MODELS.wan27hd.version);
  assert.strictEqual(VIDEO_MODELS.wan27.resolution, '720p');
  assert.strictEqual(VIDEO_MODELS.wan27hd.resolution, '1080p');
});

check('wan-2.7 is priced per SECOND, so a longer clip costs more', () => {
  // Measured on the model page 2026-08-23: $0.10/s at 720p, $0.15/s at 1080p.
  assert.strictEqual(VIDEO_MODELS.wan27.costPerClip(5), 0.50);
  assert.strictEqual(VIDEO_MODELS.wan27.costPerClip(10), 1.00);
  assert.strictEqual(VIDEO_MODELS.wan27hd.costPerClip(5), 0.75);
});

check('wan-2.7 costs more than the draft tier it sits above', () => {
  assert.ok(VIDEO_MODELS.wan27.costPerClip(5) > VIDEO_MODELS.draft.costPerClip(81) * 3);
});

console.log('the parameter shapes:');

check('wan-2.2 takes `image`/`last_image` and counts frames', () => {
  const i = videoInput(VIDEO_MODELS.draft, { start: START, end: END, prompt: 'p', frames: 81 });
  assert.strictEqual(i.image, START);
  assert.strictEqual(i.last_image, END);
  assert.strictEqual(i.num_frames, 81);
  assert.strictEqual(i.resolution, '480p');      // a movie panel's default
  assert.ok(!('first_frame' in i) && !('start_image' in i));
});

check('wan-2.2 takes a per-call resolution (quick animate lets her pick)', () => {
  const i = videoInput(VIDEO_MODELS.draft, { start: START, prompt: 'p', frames: 81, resolution: '720p' });
  assert.strictEqual(i.resolution, '720p');
});

check('wan-2.7 takes `first_frame`/`last_frame` and counts seconds', () => {
  const i = videoInput(VIDEO_MODELS.wan27, { start: START, end: END, prompt: 'p', duration: 5 });
  assert.strictEqual(i.first_frame, START);
  assert.strictEqual(i.last_frame, END);
  assert.strictEqual(i.duration, 5);
  assert.ok(!('image' in i) && !('last_image' in i) && !('start_image' in i));
});

check('wan-2.7 carries its resolution from its TIER, never from the call', () => {
  // 2.7 has no 480p at all, so a caller asking for one must not reach the model.
  const i = videoInput(VIDEO_MODELS.wan27hd, { start: START, prompt: 'p', duration: 5, resolution: '480p' });
  assert.strictEqual(i.resolution, '1080p');
});

check('wan-2.7 never lets the model rewrite the prompt', () => {
  // `enable_prompt_expansion` defaults TRUE at Replicate — off here, or her
  // words are not the words the model drew from.
  const i = videoInput(VIDEO_MODELS.wan27, { start: START, prompt: 'p', duration: 5 });
  assert.strictEqual(i.enable_prompt_expansion, false);
});

check('kling takes `start_image`, and its end frame is pro-only', () => {
  const std = videoInput(VIDEO_MODELS.standard, { start: START, end: END, prompt: 'p', duration: 5 });
  assert.strictEqual(std.start_image, START);
  assert.strictEqual(std.mode, 'standard');
  assert.ok(!('end_image' in std), 'kling standard has no end-frame conditioning');
  const pro = videoInput(VIDEO_MODELS.pro, { start: START, end: END, prompt: 'p', duration: 5 });
  assert.strictEqual(pro.end_image, END);
  assert.strictEqual(pro.mode, 'pro');
});

check('no shape ever invents an end frame that was not asked for', () => {
  for (const m of Object.values(VIDEO_MODELS)) {
    const i = videoInput(m, { start: START, end: null, prompt: 'p', frames: 81, duration: 5 });
    assert.ok(!i.last_image && !i.last_frame && !i.end_image, `${m.name} added an end frame`);
  }
});

console.log(`\n${pass} checks passed.`);
