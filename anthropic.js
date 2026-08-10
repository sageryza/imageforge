// anthropic.js — ONE Claude client for the service modules.
//
// Why this exists: the "call Claude" fetch had already been hand-copied three
// times (server.js's anthropicChat, movies.js's anthropicChatJSON,
// character.js's askClaude) before anything else needed it. That is the exact
// pattern that has bitten this repo repeatedly — a fix lands in one copy and
// silently misses the others. So every NEW Claude caller goes through here.
// (The three existing copies are left alone deliberately: they work, they are
// well-tested, and rewiring them is churn with real regression risk. Don't add
// a fourth — import this instead.)
//
// WHICH MODEL, AND WHY (Aug 2026, Sophie's rule: "my brains are really
// important"): anything whose OUTPUT IS WORDS A HUMAN READS runs on Claude —
// blog posts and the keyword research behind them, Etsy listing copy, the shop
// advice she makes decisions from, the witch app's spells and horoscopes.
// Bulk mechanical extraction over hundreds of documents (NDE moment mining,
// memo titling) deliberately stays on gpt-4o-mini: it is 20-25x cheaper and the
// job is "pull the fields out", not "write something worth reading".
//
// Cost sanity, since the ratio looks alarming: Sonnet 5 is $2/Mtok in and
// $10/Mtok out (introductory through 2026-08-31, then $3/$15) against mini's
// $0.15/$0.60. But these calls are SMALL — a blog post is ~1.5k output tokens,
// so ~1.5¢ against ~0.1¢. A cent and a half for the words on her shop's blog is
// not the line item worth optimizing. Verified against Anthropic's pricing page
// 2026-08-07; re-check before quoting numbers, they move.
//
// The key comes from ANTHROPIC_API_KEY, hydrated by config-loader.js from
// Firestore `config/anthropic` when it isn't already in the environment.

const KEY = () => process.env.ANTHROPIC_API_KEY || '';

// Default for reader-facing prose. Dateless ids from the 4.6 generation on are
// already pinned snapshots — do NOT append a date suffix.
const WRITING_MODEL = process.env.CLAUDE_WRITING_MODEL || 'claude-sonnet-5';

function available() { return Boolean(KEY()); }

/**
 * One Claude call. Returns the assistant's text.
 *
 * There is deliberately NO silent fallback to OpenAI. A quiet downgrade is how
 * you end up shipping mini's words for months without noticing — the same
 * reasoning as movies.js's dream breakdown. Callers that can live without the
 * result should catch and degrade VISIBLY (etsy-report surfaces advice_error).
 */
async function chat({ system, user, messages, model = WRITING_MODEL,
                      maxTokens = 2000, temperature } = {}, retries = 2) {
  const key = KEY();
  if (!key) throw new Error('ANTHROPIC_API_KEY not set — this text runs on Claude; add the key to enable it');
  const body = {
    model,
    max_tokens: maxTokens,
    messages: messages || [{ role: 'user', content: String(user || '') }],
  };
  if (system) body.system = String(system);
  // `temperature` is DEPRECATED on the Claude 5 models and the API hard-errors
  // on it ("temperature is deprecated for this model" — hit live 2026-08-07 on
  // claude-sonnet-5, which is why callers still pass one). Accept the argument
  // so call sites read naturally and stay portable, but only forward it to the
  // older models that still take it. Don't "simplify" this by deleting the
  // parameter from the callers — the next model may want it again.
  if (temperature != null && /^claude-(opus-4|sonnet-4|haiku-4)/.test(model)) {
    body.temperature = temperature;
  }

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          // Same dropped-keep-alive guard the OpenAI helpers carry.
          'Connection': 'close',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'anthropic error');
      if (!res.ok) throw new Error(`anthropic ${res.status}`);
      const text = (data.content || [])
        .filter(b => b.type === 'text').map(b => b.text).join('').trim();
      if (!text) throw new Error('anthropic returned no text');
      return text;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/**
 * Claude call that must return a JSON object.
 *
 * Claude has no `response_format: json_object`, so the contract is carried in
 * the prompt and the reply is parsed defensively here.
 *
 * An assistant-turn PREFILL ("{") is the classic trick for this and it does NOT
 * work on the Claude 5 models — the API rejects it outright: "This model does
 * not support assistant message prefill. The conversation must end with a user
 * message." (Hit live 2026-08-07.) Don't reintroduce it. Probed against the
 * real API instead: given the instruction below, claude-sonnet-5 returns bare,
 * fence-free JSON. The extraction is belt and braces for the days it doesn't.
 */
async function chatJSON({ system, user, messages, model = WRITING_MODEL,
                          maxTokens = 4000, temperature } = {}, retries = 2) {
  const turns = messages || [{ role: 'user', content: String(user || '') }];
  const text = await chat({
    system: [system, 'Reply with STRICT JSON only — no prose, no code fences, no explanation before or after.']
      .filter(Boolean).join('\n\n'),
    messages: turns,
    model, maxTokens, temperature,
  }, retries);
  return parseJSON(text);
}

/** Pull a JSON value out of a model reply that may be wrapped or annotated. */
function parseJSON(text) {
  const raw = String(text || '')
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try { return JSON.parse(raw); } catch { /* fall through */ }
  // Widest {...} or [...] span in the reply — handles a leading "Here you go:"
  // or a trailing note without tripping over braces inside string values.
  for (const [open, close] of [['{', '}'], ['[', ']']]) {
    const a = raw.indexOf(open), b = raw.lastIndexOf(close);
    if (a >= 0 && b > a) {
      try { return JSON.parse(raw.slice(a, b + 1)); } catch { /* try the other */ }
    }
  }
  throw new Error(`Claude did not return parseable JSON (got: ${raw.slice(0, 120)})`);
}

module.exports = { available, chat, chatJSON, parseJSON, WRITING_MODEL };
