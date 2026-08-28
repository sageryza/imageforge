/**
 * THE BACKGROUND DRAW — a panels SHEET submitted as an OpenAI Responses job,
 * so the money survives a server restart.
 * (2026-08-28, Sophie, after 15 panels runs — about $1.75 of 4K medium sheets
 * — died in one evening: a Render restart landing mid-generation kills the
 * pending HTTPS request, and `/v1/images/edits` has no result tracking, so a
 * sheet billed when requested is simply gone.)
 *
 * THE WHOLE POINT IS THE ID. `/v1/images/edits` is synchronous: the only
 * handle on the work is the open socket, and a restart takes it. A Responses
 * job with `background:true` answers in about a third of a second with an id,
 * that id goes on the run doc immediately, and any later process — the one
 * that boots after the deploy — can fetch the finished bytes with
 * `GET /v1/responses/{id}`. The banked-sheet recovery already covered a kill
 * AFTER the sheet arrived; this covers the 60-180s it was in the air.
 *
 * MEASURED BEFORE ANY OF THIS WAS WRITTEN (2026-08-28, four probe calls,
 * ~2.2c all in) — every one of these was a real question with a real chance
 * of killing the migration:
 *  - AN ARBITRARY CANVAS WORKS. The tool takes `size:"1568x2352"` and the
 *    bytes really come back 1568x2352, so the 2K and 4K tiers survive. The
 *    documented preset list is not the limit.
 *  - REFERENCE IMAGES WORK, and the call reports `action:"edit"` — the same
 *    engine `/v1/images/edits` reaches, not a text-only generation.
 *  - `moderation:"low"` is accepted and echoed back, so the house setting
 *    (see openaiImageEditRefs) is unchanged.
 *  - THE BYTES ARE LOSSLESS. The tool echoes back an output-compression
 *    field of its own at 100 that nobody asked for, which reads exactly like
 *    the lossy setting the house no-generation-compression rule forbids — but
 *    the fourth chunk id of the real answer is VP8L, i.e. lossless webp.
 *    CHECKED, not assumed, because a lossy original cannot be undone later,
 *    only re-drawn. Nothing here ever sends that field (the test pins it);
 *    read the chunk id again if the tool's defaults ever move.
 *  - THERE IS NO ASYNC DOOR ON THE IMAGES API. `background` there is the
 *    picture's own background ('transparent'/'opaque'/'auto') and refuses a
 *    boolean. The Responses API is the only way to get an id.
 *
 * THE ONE REAL COST, AND WHY THE PASS-THROUGH INSTRUCTION IS LOAD-BEARING.
 * The Responses API puts a MAINLINE MODEL between her words and gpt-image-2:
 * that model chooses the tool's `prompt` argument. Asked conversationally it
 * rewrote a nine-word request into 1,200 characters of invented hex colours,
 * percentages and corner radii — and wrote "1024x1024 PNG" into a prompt that
 * drew a 1568x2352 webp. Given the pass-through instruction below it copied
 * the real grid sentence back BYTE FOR BYTE, with and without reference
 * images attached. So the instruction is what keeps the house rule (*nothing
 * stands between the source and the output*) true, and:
 *
 *   IT IS A MODEL BEHAVIOUR, NOT A CONTRACT — SO IT IS MEASURED IN CODE.
 * This repo's own rule is that a prompt instruction about something that
 * matters is a hope, and a thing that matters gets checked in code. Nothing
 * can un-spend a sheet that was drawn from a paraphrase, so the check cannot
 * PREVENT one; what it can do is refuse to lie about it. `readResponse`
 * returns the prompt that actually reached gpt-image-2, the caller stores THAT
 * as `fullPrompt` (the hard rule: the whole prompt is stored wherever an image
 * is made, and it is the literal text sent), and a run whose text was rewritten
 * is stamped `promptRewritten` so the drift is countable over real runs instead
 * of argued about. If that stamp ever starts appearing, this migration is the
 * thing to revisit.
 *
 * TWO HONEST RESIDUALS, neither of them fixable here:
 *  - THE WINDOW IS SMALLER, NOT GONE. A restart in the ~0.3s between the POST
 *    leaving and the id arriving still loses the sheet, because nothing on our
 *    side ever learned the id. That is ~0.3s of exposure against the 60-180s
 *    it replaces. It cannot be swept up afterwards either: `GET /v1/responses`
 *    (the list endpoint) refuses an API key — "must be made with a session
 *    key" — so an orphaned job cannot be found by metadata or any other means.
 *  - THE ROUTER MODEL IS AN ADDED DEPENDENCY. Measured on this key the same
 *    day: `gpt-4o` and `gpt-4.1` answer 403 "your organization must be
 *    verified", while `gpt-5-mini` works — so the default below is not a
 *    preference, it is the model this account can actually reach. Its tokens
 *    are a fraction of a cent against a 20-47c sheet, but they are new.
 *
 * Pure and dependency-free on purpose — `buildSubmit` and `readResponse` are
 * plain functions over plain objects, so the test needs neither a network nor
 * an API key.
 */
'use strict';

const ENDPOINT = 'https://api.openai.com/v1/responses';

// The model that carries the image_generation tool. NOT a writing model and
// not a choice about quality: its only job is to hand the prompt through
// unchanged, and it is `gpt-5-mini` because that is what this account is
// verified for (see the header). Override with OPENAI_BG_ROUTER_MODEL.
const ROUTER_MODEL = process.env.OPENAI_BG_ROUTER_MODEL || 'gpt-5-mini';

// THE PASS-THROUGH INSTRUCTION. Measured to work with and without reference
// images; see the header for why it is checked afterwards rather than trusted.
// Naming the attachments matters: without that clause the model reads them as
// content to describe and folds a description of her scan into the prompt.
const PASS_THROUGH = 'Call the image_generation tool exactly ONCE. Its `prompt` '
  + 'argument must be the user\'s text copied CHARACTER FOR CHARACTER — do not '
  + 'rewrite, expand, summarise, translate, reorder, or add a single word. Any '
  + 'attached images are style references for the tool, never content to '
  + 'describe. Reply with nothing else.';

function dataUrl(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
  let type = 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) type = 'image/jpeg';
  else if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF'
    && b.toString('latin1', 8, 12) === 'WEBP') type = 'image/webp';
  return `data:${type};base64,${b.toString('base64')}`;
}

// The request body. `store:true` is required for background mode — the job
// has to outlive our process to be worth anything.
function buildSubmit({ prompt, refBuffers = [], quality = 'low', size = '1024x1024',
  moderation = 'low', model = 'gpt-image-2', router = ROUTER_MODEL } = {}) {
  const refs = (refBuffers || []).filter(Boolean);
  return {
    model: router,
    background: true,
    store: true,
    instructions: PASS_THROUGH,
    // With no references the input is her text and nothing else; with them it
    // has to be a content array, and her text leads it either way.
    input: refs.length
      ? [{ role: 'user', content: [
        { type: 'input_text', text: prompt },
        ...refs.map(b => ({ type: 'input_image', image_url: dataUrl(b) })),
      ] }]
      : prompt,
    tools: [{
      type: 'image_generation',
      model,
      size,
      quality,
      moderation,
      output_format: 'webp',
    }],
    // Forced, so a router that decides the request needs no picture cannot
    // quietly return prose and leave the run with nothing.
    tool_choice: { type: 'image_generation' },
  };
}

// Normalise a fetched response into the three answers the caller has: still
// working, here it is, or it died. Kept separate from the fetch so the whole
// decision table is testable without a network.
//
// A COMPLETED RESPONSE WITH NO IMAGE IS A FAILURE, not a pending one — the
// router answered without drawing, and polling it forever would park the run
// on 'running' until the stuck sweep gave up on it hours later.
function readResponse(j, sentPrompt) {
  if (!j || j.error) {
    return { state: 'failed', error: (j && j.error && (j.error.message || String(j.error))) || 'no response' };
  }
  const call = (j.output || []).find(o => o && o.type === 'image_generation_call');
  const status = j.status;
  if (status === 'queued' || status === 'in_progress') return { state: 'pending', status };
  if (status === 'failed' || status === 'cancelled' || status === 'canceled') {
    return { state: 'failed', error: (j.error && j.error.message) || `response ${status}` };
  }
  if (status === 'incomplete') {
    return { state: 'failed', error: (j.incomplete_details && j.incomplete_details.reason) || 'response incomplete' };
  }
  if (status !== 'completed') return { state: 'pending', status };
  if (!call || !call.result) {
    return { state: 'failed', error: 'the response finished without an image' };
  }
  // What ACTUALLY reached gpt-image-2. The caller stores this as fullPrompt,
  // so the record can never claim words that did not draw the picture.
  const sent = typeof call.revised_prompt === 'string' ? call.revised_prompt : null;
  return {
    state: 'done',
    b64: call.result,
    sentPrompt: sent,
    // null when the API told us nothing — an unknown is not a rewrite.
    promptRewritten: sent == null || sentPrompt == null ? null : sent !== sentPrompt,
    size: call.size || null,
    usage: j.usage || null,
  };
}

// THE FETCH HAS TO BE node-fetch, AND THAT IS NOT A STYLE CHOICE. server.js
// shadows the global with node-fetch, whose `timeout` option is the only thing
// standing between a hung submit and a job that never returns — Node's own
// global fetch accepts the option and IGNORES it, so falling through to it
// would silently remove the timeout from the one path built for reliability.
// Required lazily so buildSubmit/readResponse stay pure and the test needs no
// install; the global is the last resort, never the first.
let nodeFetch;
function theFetch(given) {
  if (given) return given;
  if (!nodeFetch) { try { nodeFetch = require('node-fetch'); } catch (e) { nodeFetch = fetch; } }
  return nodeFetch;
}

async function bgSubmit(opts, { fetchImpl, key = process.env.OPENAI_API_KEY, timeout = 60000 } = {}) {
  const f = theFetch(fetchImpl);
  const res = await f(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildSubmit(opts)),
    timeout,
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || 'responses submit failed');
  if (!j.id) throw new Error('responses submit returned no id');
  return { id: j.id, status: j.status };
}

async function bgFetch(id, { fetchImpl, key = process.env.OPENAI_API_KEY, timeout = 60000 } = {}) {
  const f = theFetch(fetchImpl);
  const res = await f(`${ENDPOINT}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${key}` },
    timeout,
  });
  return res.json();
}

// Poll to completion. Nothing here needs to report the id back — the caller
// banks it BEFORE the first poll, which is the whole safety property.
//
// THE DEADLINE IS A HANDOFF, NOT A FAILURE, AND IT IS SHORTER THAN THE STUCK
// SWEEP'S CUTOFF ON PURPOSE. Two things can finish one run — this poll and the
// sweep that resumes orphans — and if both ever did, the sheet would be banked
// twice, cut twice and filed twice. Giving up at nine minutes against the
// sweep's ten means exactly one of them owns a run at any moment: this poll
// from 0-9 minutes, the sweep from 10 on. So a timeout returns PENDING and the
// caller simply stops, leaving the doc 'running' with its id for the sweep to
// collect — a paid sheet must never be marked failed by a clock on our side.
const HANDOFF_MS = 9 * 60 * 1000;
async function bgAwait(id, sentPrompt, opts = {}) {
  const { every = 3000, deadline = HANDOFF_MS } = opts;
  const until = Date.now() + deadline;
  for (;;) {
    const out = readResponse(await bgFetch(id, opts), sentPrompt);
    if (out.state !== 'pending') return out;
    if (Date.now() > until) return { state: 'pending', handoff: true };
    await new Promise(r => setTimeout(r, every));
  }
}

module.exports = { ENDPOINT, ROUTER_MODEL, PASS_THROUGH, HANDOFF_MS, dataUrl, buildSubmit, readResponse, bgSubmit, bgFetch, bgAwait };
