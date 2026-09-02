#!/usr/bin/env node
'use strict';
// THE PAUSE BEFORE A DEPLOY — a source pin over server.js (2026-09-02). The
// pause only works if EVERY gpt-image run the Playground can start honours
// it: the doc is written `queued` and the job is not started. A fourth run
// shape added beside the three must fail here until it does the same.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
let pass = 0, fail = 0;
const is = (g, w, what) => { if (g === w) { pass++; return; } fail++; console.log(`FAIL ${what}\n  got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); };

// the POST /api/promptlab gpt branch, up to the Replicate branch
const a = src.indexOf("app.post('/api/promptlab', async");
const b = src.indexOf("const known = MODELS.replicate.find", a);
is(a > 0 && b > a, true, 'the run route is found');
const route = src.slice(a, b);
// every gpt-image run doc is written with the pause's own status
const hard = (route.match(/status: 'running', engine: 'gptimage'/g) || []).length;
is(hard, 0, 'no gpt run doc is written running outright — all go through queuedFields()');
const soft = (route.match(/\.\.\.queuedFields\(\), engine: 'gptimage'/g) || []).length;
is(soft, 3, 'the three run shapes (panels, story, single) all write queuedFields()');
// every job start is guarded, and every response says whether it queued
const starts = (route.match(/run(PromptLabGptJob|PromptLabPanelsJob)\(docRef/g) || []).length;
const guarded = (route.match(/if \(!pausedNow\(\)\) run(PromptLabGptJob|PromptLabPanelsJob)\(docRef/g) || []).length;
is(starts, 3, 'three job starts in the route');
is(guarded, starts, 'every job start is behind pausedNow()');
const replies = (route.match(/\.\.\.queuedReply\(\)/g) || []).length;
is(replies, 3, 'every start reply carries queued/note when paused');
// the pause is bounded and the queue is drained on the new instance
is(/const PAUSE_MAX_S = (\d+);/.test(src) && Number(RegExp.$1) <= 300, true, 'a pause is capped at five minutes');
is(src.includes("where('status', '==', 'queued')"), true, 'the new instance drains queued runs');
is(src.includes('setTimeout(startQueuedRuns'), true, '…soon after boot');
is(src.includes("app.post('/api/promptlab/pause'"), true, 'the guard has a pause route');
// the pause route stays above the :id route
is(src.indexOf("app.post('/api/promptlab/pause'") < src.indexOf("app.get('/api/promptlab/:id'"), true, '/pause is registered above /:id');
// the stuck sweep never judges a queued run (it reads running + ready only)
const sw = src.slice(src.indexOf('async function sweepStuckPromptlabRuns'), src.indexOf('setTimeout(sweepStuckPromptlabRuns'));
is(sw.includes("'queued'"), false, 'the stuck sweep leaves queued runs alone');
// the page shows the note on the card and in the toast
const page = fs.readFileSync(path.join(__dirname, '..', 'public', 'promptlab.html'), 'utf8');
is(page.includes("esc(p.queued || 'drawing…')"), true, 'the waiting card wears the note');
is((page.match(/confirmStarted\(d\);/g) || []).length, 3, 'all three starters hand the reply to the toast');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
