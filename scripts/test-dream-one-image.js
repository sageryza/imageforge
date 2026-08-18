#!/usr/bin/env node
// The dream app draws ONE SQUARE PICTURE at medium quality (Sophie, Aug 2026):
// "the images shud default to square and medium quality and just one image.
//  prompt shud say 'pick one strong image,' and embellish it w the other
//  details of the dream, rather than comic book style."
//
// Runs makeDreamImage for real against a stubbed node-fetch — so the size, the
// quality, the number of images and both prompts are read off the requests
// that would have gone to OpenAI, not off the source. Storage is not
// configured here, so the picture comes back as a data: URL by design.
//
//   node scripts/test-dream-one-image.js
const assert = require('assert');
const path = require('path');

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

// A one-pixel webp, so the "image" that comes back is real bytes.
const PIX = Buffer.from(
  'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64').toString('base64');

const calls = [];
const fake = async (url, opts = {}) => {
  calls.push({ url, opts });
  if (url.includes('/chat/completions')) {
    return { json: async () => ({ choices: [{ message: { content: JSON.stringify({
      image: 'A woman stands in a lift whose walls are open sky; a red barn and a kitten '
        + 'from earlier in the night are visible through the doors.',
    }) } }] }) };
  }
  if (url.includes('/images/')) return { json: async () => ({ data: [{ b64_json: PIX }] }) };
  throw new Error('unexpected call: ' + url);
};
// node-fetch is required at module load, so it has to be in the cache BEFORE
// movies.js is — there is no seam to inject through afterwards.
const nf = require.resolve('node-fetch');
require.cache[nf] = { id: nf, filename: nf, loaded: true, exports: fake };

const M = require(path.join(__dirname, '..', 'movies.js'));

const fails = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) fails.push(name);
};

(async () => {
  const dream = { id: 'd1', dreamText: 'I dreamt Ian was recruiting me to build a barn, and then '
    + 'later Sage and I kept ending up in a time-travelling elevator.' };
  const steps = [];
  const page = await M.makeDreamImage(dream, undefined, async (done, total, label) => {
    steps.push(label);
  });

  const images = calls.filter((c) => c.url.includes('/images/'));
  check('exactly ONE picture is drawn', images.length === 1, `${images.length} image calls`);
  check('and the dream carries exactly one page', (dream.pages || []).length === 1);

  // The edits endpoint takes multipart, so the fields are read off the form.
  const img = images[0];
  const form = img.opts.body;
  const fields = {};
  if (form && typeof form.getBuffer === 'function') {
    const raw = form.getBuffer().toString('latin1');
    for (const key of ['size', 'quality', 'model', 'output_format']) {
      const m = raw.match(new RegExp(`name="${key}"\\r\\n\\r\\n([^\\r]*)`));
      if (m) fields[key] = m[1];
    }
  } else {
    Object.assign(fields, JSON.parse(String(form || '{}')));
  }
  check('it is SQUARE', fields.size === '1024x1024', String(fields.size));
  check('at MEDIUM quality by default', fields.quality === 'medium', String(fields.quality));
  check('on gpt-image-2', fields.model === 'gpt-image-2', String(fields.model));

  // ── the planner: pick one, then fold the rest of the dream into it ──
  const plan = calls.find((c) => c.url.includes('/chat/completions'));
  const sys = JSON.parse(plan.opts.body).messages[0].content;
  check('the planner is told to PICK ONE STRONG IMAGE', /PICK ONE STRONG IMAGE/.test(sys));
  check('and to embellish it with the rest of the dream',
    /EMBELLISH IT WITH THE OTHER DETAILS OF THE DREAM/.test(sys));
  check('and that it is not a comic',
    /NOT a comic/.test(sys) && /no panels/.test(sys) && /no caption boxes/.test(sys));

  // ── the render prompt: the plan, the context, and no comic anywhere ──
  const prompt = String(page.promptUsed || '');
  check('the picture is drawn from the planned image', /time-travelling elevator|open sky/.test(prompt));
  check('the rest of the dream rides as context only',
    /for context only/.test(prompt) && /do not draw a second scene/.test(prompt));
  check('the render prompt forbids panels and lettering',
    /Not a comic/.test(prompt) && /no panels/.test(prompt) && /no lettering/.test(prompt),
    prompt.slice(0, 90) + '…');
  check('nothing asks for a comic page or a page number',
    !/page \d+ of \d+/i.test(prompt) && !/hand-drawn comic/i.test(prompt));
  check('no captions are planned or lettered', (page.captions || []).length === 0);

  // ── the money ──
  check('a dream costs one square medium picture', dream.spend === 0.053, String(dream.spend));
  check('the job reports what it is doing', steps.length >= 2, steps.join(' → '));

  console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
