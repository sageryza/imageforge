'use strict';

// Pure contract checks for the MuAPI image door. No credential, server, or
// billable provider request is needed.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const muapi = require('../muapi-image');

let failures = 0;
function ok(name, condition, detail) {
  if (condition) console.log('  ok   ' + name);
  else {
    failures += 1;
    console.log('  FAIL ' + name + (detail ? '\n       ' + detail : ''));
  }
}

console.log('MuAPI image door');

const defaultRequest = muapi.buildRequest({ prompt: '  a paper boat at sunrise  ' });
ok('default request uses FLUX Schnell', defaultRequest.model === 'flux-schnell');
ok('prompt is trimmed once at the adapter boundary', defaultRequest.prompt === 'a paper boat at sunrise');
ok('request uses the documented OpenAI image shape',
  JSON.stringify(defaultRequest.body) === JSON.stringify({
    model: 'flux-schnell', prompt: 'a paper boat at sunrise', n: 1,
    size: '1024x1024', response_format: 'url',
  }));
ok('documented landscape size is accepted', muapi.buildRequest({ prompt: 'p', size: '1792x1024' }).body.size === '1792x1024');
ok('documented portrait size is accepted', muapi.buildRequest({ prompt: 'p', size: '1024x1792' }).body.size === '1024x1792');
ok('empty prompt is refused', muapi.buildRequest({ prompt: '  ' }).error === 'prompt is required');
ok('unknown model is refused instead of guessed', /unknown MuAPI model/.test(muapi.buildRequest({ prompt: 'p', model: 'unknown' }).error || ''));
ok('unknown size is refused', /size must be/.test(muapi.buildRequest({ prompt: 'p', size: '512x512' }).error || ''));

ok('only HTTPS URL fields become image outputs',
  JSON.stringify(muapi.imageUrls({ data: [
    { url: 'https://cdn.muapi.ai/image.webp' },
    { url: 'http://not-secure.test/image.webp' },
    { prediction: 'https://api.muapi.ai/predictions/abc' },
  ] })) === JSON.stringify(['https://cdn.muapi.ai/image.webp']));
ok('missing output is an empty result', muapi.imageUrls({ data: [] }).length === 0);

(async () => {
  const calls = [];
  const response = await muapi.generate(defaultRequest.body, {
    apiKey: 'test-key', baseUrl: 'https://provider.test/v1',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ data: [{ url: 'https://cdn.muapi.ai/result.webp' }] }) };
    },
  });
  ok('generation posts to the compatibility endpoint', calls[0].url === 'https://provider.test/v1/images/generations');
  ok('generation uses Bearer authentication', calls[0].options.headers.Authorization === 'Bearer test-key');
  ok('generation sends the adapter body unchanged', JSON.parse(calls[0].options.body).model === 'flux-schnell');
  ok('generation returns the provider envelope for route filing', muapi.imageUrls(response)[0] === 'https://cdn.muapi.ai/result.webp');
  ok('generation sets a bounded request timeout', calls[0].options.timeout === 120000);

  let missingKey;
  try {
    await muapi.generate(defaultRequest.body, { apiKey: '' });
  } catch (err) { missingKey = err; }
  ok('missing key fails before a network call', missingKey && missingKey.status === 503 && /MUAPI_API_KEY/.test(missingKey.message));

  let providerFailure;
  try {
    await muapi.generate(defaultRequest.body, {
      apiKey: 'test-key',
      fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'rate limited' } }) }),
    });
  } catch (err) { providerFailure = err; }
  ok('provider status and message are surfaced',
    providerFailure && providerFailure.status === 429 && /rate limited/.test(providerFailure.message));

  const root = path.join(__dirname, '..');
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const config = fs.readFileSync(path.join(root, 'config-loader.js'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const testPage = fs.readFileSync(path.join(root, 'public/test.html'), 'utf8');
  ok('server exposes a separate MuAPI route', /app\.post\('\/api\/generate\/muapi'/.test(server));
  ok('server publishes a pinned MuAPI model row', /muapi: muapiImage\.MODELS/.test(server));
  ok('deck and style-test proxy branches stay provider-specific',
    (server.match(/provider === 'muapi'/g) || []).length >= 2);
  ok('the key can be hydrated from the existing config document', /'MUAPI_API_KEY'/.test(config));
  ok('main picker renders and calls the MuAPI provider', /models\.muapi/.test(index) && /\/api\/generate\/muapi/.test(index));
  ok('Test Station renders and calls the MuAPI provider', /models\.muapi/.test(testPage) && /\/api\/generate\/muapi/.test(testPage));
  ok('the public docs link only to official MuAPI references',
    /https:\/\/muapi\.ai\/ai-image-api/.test(fs.readFileSync(path.join(root, 'docs/modules/pictures.md'), 'utf8')));
  ok('source remains whitespace-clean', require('child_process').execFileSync('git', ['diff', '--check'], { cwd: root }).toString() === '');

  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(1); });
