'use strict';

// MuAPI's OpenAI-compatible image door. The adapter is intentionally small:
// ImageForge's existing routes own storage and My Creations filing, while this
// module owns only the provider contract and its response validation.
function defaultFetch(...args) {
  // The target already depends on node-fetch, but keeping this lookup lazy
  // lets the pure contract test run from a fresh checkout on Node 18+.
  try { return require('node-fetch')(...args); }
  catch { return globalThis.fetch(...args); }
}

const BASE_URL = (process.env.MUAPI_BASE_URL || 'https://api.muapi.ai/v1').replace(/\/$/, '');
const ENDPOINT = '/images/generations';
const DEFAULT_MODEL = 'flux-schnell';
const MODELS = [
  { id: DEFAULT_MODEL, name: 'FLUX Schnell (MuAPI)' },
];
const MODEL_IDS = new Set(MODELS.map((model) => model.id));
const SIZES = new Set(['1024x1024', '1792x1024', '1024x1792']);

class MuapiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'MuapiError';
    this.status = status;
  }
}

// Pure request construction keeps the provider shape testable without a
// credential, a running server, or a billable image request.
function buildRequest(input = {}) {
  const prompt = String(input.prompt || '').trim();
  if (!prompt) return { error: 'prompt is required' };

  const model = String(input.model || DEFAULT_MODEL).trim();
  if (!MODEL_IDS.has(model)) return { error: `unknown MuAPI model "${model}"` };

  const size = String(input.size || '1024x1024');
  if (!SIZES.has(size)) {
    return { error: 'size must be 1024x1024, 1792x1024, or 1024x1792' };
  }

  return {
    body: { model, prompt, n: 1, size, response_format: 'url' },
    model,
    prompt,
    size,
  };
}

function responseMessage(data, fallback) {
  const error = data && data.error;
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error && typeof error.message === 'string' && error.message.trim()) return error.message.trim();
  for (const key of ['detail', 'message']) {
    if (data && typeof data[key] === 'string' && data[key].trim()) return data[key].trim();
  }
  return fallback;
}

async function jsonOrEmpty(response) {
  try { return await response.json(); } catch { return {}; }
}

async function generate(body, { apiKey = process.env.MUAPI_API_KEY, fetchImpl = defaultFetch, baseUrl = BASE_URL } = {}) {
  if (!apiKey) throw new MuapiError('MUAPI_API_KEY not set on the server', 503);

  let response;
  try {
    response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}${ENDPOINT}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      timeout: 120000,
    });
  } catch (err) {
    throw new MuapiError(`MuAPI request failed: ${String(err.message || err).slice(0, 240)}`);
  }

  const data = await jsonOrEmpty(response);
  if (!response.ok) {
    const status = response.status >= 400 && response.status < 500 ? response.status : 502;
    throw new MuapiError(`MuAPI ${response.status}: ${responseMessage(data, 'image generation failed')}`, status);
  }
  return data;
}

// The compatibility endpoint promises URL output. Refuse anything else so a
// provider envelope, prediction URL, or opaque value is never filed as media.
function imageUrls(data) {
  if (!Array.isArray(data && data.data)) return [];
  return data.data
    .map((item) => item && item.url)
    .filter((url) => typeof url === 'string' && /^https:\/\//i.test(url));
}

module.exports = {
  BASE_URL,
  DEFAULT_MODEL,
  ENDPOINT,
  MODELS,
  SIZES: [...SIZES],
  MuapiError,
  buildRequest,
  generate,
  imageUrls,
};
