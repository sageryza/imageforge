#!/usr/bin/env node
/*
 * test-responses-bg.js — the background draw that makes a panels sheet
 * survive a restart (2026-08-28, Sophie: a restart mid-generation lost 15
 * runs, about $1.75 of 4K medium sheets, in one evening). Pure: no network,
 * no API key, no browser.
 *
 *   1. THE SUBMIT CARRIES WHAT PANELS NEEDS — background+store (or the job
 *      cannot outlive this process, which is the entire point), the ARBITRARY
 *      sheet canvas verbatim, moderation low, lossless webp, a forced tool
 *      choice, and the references as input_image with the right mime read
 *      from the BYTES.
 *   2. THE PASS-THROUGH INSTRUCTION IS PRESENT AND SAYS BOTH THINGS. A router
 *      model chooses the tool's prompt argument; measured, it rewrites a short
 *      request into 1,200 characters of invented detail unless told not to,
 *      and it describes attached references as content unless told they are
 *      references. Both clauses are load-bearing.
 *   3. HER TEXT LEADS THE INPUT in both shapes — with references (a content
 *      array) and without (a bare string).
 *   4. readResponse's WHOLE DECISION TABLE, which is what the sweep leans on:
 *      pending stays pending (a live draw must never be marked failed),
 *      completed-with-no-image is a FAILURE not a pending (or the run polls
 *      forever), and failed/cancelled/incomplete each carry a reason.
 *   5. THE REWRITE IS DETECTED, and an UNKNOWN is not a rewrite. This is the
 *      house rule made structural: the record stores the text that actually
 *      drew the picture, and drift is countable rather than arguable.
 *   6. THE HANDOFF IS SHORTER THAN THE SWEEP'S CUTOFF. If this ever exceeded
 *      ten minutes the live poll and the sweep could both finish one run —
 *      banking, cutting and filing the same paid sheet twice.
 *
 *   node scripts/test-responses-bg.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const bg = require(path.join(__dirname, '..', 'responses-bg.js'));

let pass = 0; const fails = [];
const ok = (name, cond, extra) => { if (cond) pass++; else fails.push(name + (extra ? ` — ${extra}` : '')); };
const eq = (name, a, b) => ok(name, a === b, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);

const PNG = Buffer.concat([Buffer.from([0x89]), Buffer.from('PNG\r\n\x1a\n', 'latin1'), Buffer.alloc(16)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(16)]);
const WEBP = Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.alloc(4), Buffer.from('WEBP', 'latin1'), Buffer.alloc(16)]);

// ── 1 · the submit body ────────────────────────────────────────────────
const PROMPT = 'This page is a 2x2 grid of 4 separate panels.\nPanel 1 (top left): a red door';
const body = bg.buildSubmit({ prompt: PROMPT, refBuffers: [PNG, WEBP], quality: 'medium', size: '2336x3504' });
eq('background is true', body.background, true);
eq('store is true', body.store, true);
const tool = body.tools[0];
eq('one tool, image_generation', body.tools.length === 1 && tool.type, 'image_generation');
eq('the arbitrary sheet canvas rides verbatim', tool.size, '2336x3504');
eq('quality rides', tool.quality, 'medium');
eq('moderation low (the house setting)', tool.moderation, 'low');
eq('webp out', tool.output_format, 'webp');
ok('NO output_compression is ever sent', !('output_compression' in tool));
eq('the tool choice is forced', body.tool_choice && body.tool_choice.type, 'image_generation');

// ── 2 · the pass-through instruction ───────────────────────────────────
ok('instruction forbids rewriting', /CHARACTER FOR CHARACTER/.test(body.instructions));
ok('instruction names the attachments as references',
  /style references for the tool, never content to describe/.test(body.instructions));

// ── 3 · her text leads, in both shapes ─────────────────────────────────
const content = body.input[0].content;
eq('her text is first', content[0].type, 'input_text');
eq('her text is verbatim', content[0].text, PROMPT);
eq('both references ride', content.filter(c => c.type === 'input_image').length, 2);
ok('a png reference is declared png', content[1].image_url.startsWith('data:image/png;base64,'));
ok('a webp reference is declared webp', content[2].image_url.startsWith('data:image/webp;base64,'));
ok('a jpeg is read from the bytes, not a filename', bg.dataUrl(JPG).startsWith('data:image/jpeg;base64,'));
const bare = bg.buildSubmit({ prompt: PROMPT, refBuffers: [] });
eq('with no references the input is her text alone', bare.input, PROMPT);
eq('an absent refBuffers is the same', bg.buildSubmit({ prompt: PROMPT }).input, PROMPT);

// ── 4 · readResponse's decision table ──────────────────────────────────
const done = (over = {}) => ({
  status: 'completed', usage: { total_tokens: 9 },
  output: [Object.assign({ type: 'image_generation_call', status: 'completed',
    result: 'QUJD', revised_prompt: PROMPT, size: '2336x3504' }, over)],
});
eq('queued is pending', bg.readResponse({ status: 'queued', output: [] }, PROMPT).state, 'pending');
eq('in_progress is pending', bg.readResponse({ status: 'in_progress', output: [] }, PROMPT).state, 'pending');
eq('an unknown status is pending, never failed',
  bg.readResponse({ status: 'something_new', output: [] }, PROMPT).state, 'pending');
eq('completed is done', bg.readResponse(done(), PROMPT).state, 'done');
eq('the bytes come back', bg.readResponse(done(), PROMPT).b64, 'QUJD');
eq('the usage comes back', bg.readResponse(done(), PROMPT).usage.total_tokens, 9);
eq('a failed response fails', bg.readResponse({ status: 'failed', error: { message: 'boom' } }, PROMPT).state, 'failed');
eq('...with its reason', bg.readResponse({ status: 'failed', error: { message: 'boom' } }, PROMPT).error, 'boom');
eq('a cancelled response fails', bg.readResponse({ status: 'cancelled', output: [] }, PROMPT).state, 'failed');
eq('incomplete fails with its reason',
  bg.readResponse({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] }, PROMPT).error,
  'max_output_tokens');
eq('a top-level error fails', bg.readResponse({ error: { message: 'nope' } }, PROMPT).state, 'failed');
eq('a null body fails rather than throwing', bg.readResponse(null, PROMPT).state, 'failed');
// The one that would hang a run forever if it were read as pending.
eq('completed with NO image is a failure, not a pending',
  bg.readResponse({ status: 'completed', output: [{ type: 'message' }] }, PROMPT).state, 'failed');
eq('completed with a call but no bytes is a failure',
  bg.readResponse(done({ result: null }), PROMPT).state, 'failed');

// ── 5 · the rewrite check ──────────────────────────────────────────────
eq('a verbatim prompt is not a rewrite', bg.readResponse(done(), PROMPT).promptRewritten, false);
eq('the sent prompt comes back', bg.readResponse(done(), PROMPT).sentPrompt, PROMPT);
eq('a changed prompt IS a rewrite',
  bg.readResponse(done({ revised_prompt: PROMPT + ' in the style of a poster' }), PROMPT).promptRewritten, true);
eq('...and the record gets the text that really drew it',
  bg.readResponse(done({ revised_prompt: 'something else' }), PROMPT).sentPrompt, 'something else');
eq('an UNKNOWN is not a rewrite (null, never true)',
  bg.readResponse(done({ revised_prompt: undefined }), PROMPT).promptRewritten, null);
eq('...and reports no sent prompt to store',
  bg.readResponse(done({ revised_prompt: undefined }), PROMPT).sentPrompt, null);

// ── 6 · the handoff is shorter than the sweep's cutoff ─────────────────
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const cut = /const cutoff = Date\.now\(\) - (\d+) \* 60 \* 1000;/.exec(server);
ok('the sweep still has a readable cutoff', !!cut);
if (cut) {
  const sweepMs = Number(cut[1]) * 60 * 1000;
  ok('the poll hands off BEFORE the sweep can take the run',
    bg.HANDOFF_MS < sweepMs, `handoff ${bg.HANDOFF_MS}ms vs sweep ${sweepMs}ms`);
}
// The two properties the whole recovery rests on, read out of the real server.
ok('the id is banked before the first poll',
  server.indexOf('bgResponseId: id') < server.indexOf('responsesBg.bgAwait'),
  'the update must come first');
ok('a handed-off run is NOT marked failed',
  /if \(out\.state === 'pending'\) return;/.test(server));
ok('the sweep resumes a mid-draw orphan', /resumePanelsRun\(d\.ref, r\)/.test(server));
ok('panels is the ONLY path on the background draw',
  (server.match(/responsesBg\.bgSubmit\(/g) || []).length === 1);
ok('every other gpt path still calls the direct Images edit',
  server.includes('await openaiImageEditRefs('));

console.log(`${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
