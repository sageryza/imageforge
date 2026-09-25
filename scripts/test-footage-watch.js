#!/usr/bin/env node
/* THE SERVER KEEPS ASKING WHILE SHE IS AWAY (2026-09-25, Sophie: "if i come
 * back it says drawing 7 mins but it was only 2 mins · still doesn't show").
 *
 * The real footage module over an in-memory collection and a stub door, every
 * assertion a reading of what the door was really asked and what the doc
 * really holds afterwards: a job sent through startJob's own path is watched
 * with no page asking; the sweep picks up an unfinished job nobody here sent
 * and leaves a stale one alone; a finished job is let go and asked no more;
 * a done job with a video and no poster is handed to the poster bake; and an
 * idle tick reads nothing.
 *
 * Run: node scripts/test-footage-watch.js
 */
'use strict';
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };

// a small Firestore: docs by id, `where('status','in',…)`, `doc().get()`
const store = {};
const reads = { docs: 0, queries: 0 };
const coll = {
  doc: (id) => ({ get: async () => { reads.docs += 1; const d = store[id]; return { exists: !!d, data: () => d, id }; },
    set: async (p) => { store[id] = { ...(store[id] || {}), ...p }; } }),
  where: (f, op, list) => ({ get: async () => { reads.queries += 1;
    return { docs: Object.keys(store).filter((id) => list.includes(store[id][f])).map((id) => ({ id, data: () => store[id] })) }; } }),
};
const asked = [];
const door = {
  configured: () => true,
  pollVideo: async (id) => {
    asked.push(id);
    const d = store[id];
    if (d && d.finishOnPoll) { store[id] = { ...d, status: 'completed', video: 'https://x/' + id + '.mp4', doneAt: new Date().toISOString() }; return { id, status: 'completed', video: store[id].video, patch: { status: 'completed' } }; }
    return { id, status: 'processing', patch: null };
  },
};
delete process.env.RENDER_EXTERNAL_URL;     // never arm the real timer in a test
const F = require('../footage');
F.init({ atlascloud: door, coll, watch: false });
const bakes = [];

(async () => {
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  // 1. nothing watched, nothing swept yet → the first tick sweeps, reads nothing else
  store.fresh = { status: 'sent', door: 'atlascloud', sentAt: iso(now - 60000) };
  store.stale = { status: 'sent', door: 'atlascloud', sentAt: iso(now - 3 * 3600000) };
  store.done = { status: 'completed', door: 'atlascloud', sentAt: iso(now - 600000), video: 'https://x/done.mp4', poster: '' };
  let n = await F.watchTick(now);
  ok('the sweep picked up the unfinished job nobody here sent, and not the stale one — watching ' + n, n === 1);
  ok('and asked its door about it once — ' + asked.join(','), asked.length === 1 && asked[0] === 'fresh');
  // the door's per-job throttle (12s) is respected by pollOne itself
  // 2. a job sent by this process is watched at once
  F.watchJob('mine');
  store.mine = { status: 'sent', door: 'atlascloud', sentAt: iso(now) };
  asked.length = 0;
  n = await F.watchTick(now + 15000);
  ok('a job this process sent is watched with no page asking — ' + asked.sort().join(','), asked.includes('mine') && n === 2);
  ok('the sweep did not run again inside five minutes — ' + reads.queries, reads.queries === 1);
  // 3. when the door says finished, the job is let go on the next tick
  store.mine.finishOnPoll = true;
  await F.watchTick(now + 30000);
  ok('the poll finished it — the doc is completed with its video', store.mine.status === 'completed' && /mine\.mp4/.test(store.mine.video));
  asked.length = 0;
  n = await F.watchTick(now + 45000);
  ok('a finished job is let go and asked no more — watching ' + n + ', asked ' + asked.join(','), n === 1 && !asked.includes('mine'));
  // 4. an idle tick reads nothing
  store.fresh.finishOnPoll = true;
  await F.watchTick(now + 60000);
  await F.watchTick(now + 75000);
  const before = { ...reads };
  n = await F.watchTick(now + 90000);
  ok('with nothing watched a tick reads nothing — ' + JSON.stringify(reads), n === 0 && reads.docs === before.docs && reads.queries === before.queries);
  // 5. the source pins: the watcher is armed from init on Render, and startJob watches its job
  const src = require('fs').readFileSync(require.resolve('../footage'), 'utf8');
  ok('init arms the watcher only where RENDER_EXTERNAL_URL is set', /opts\.watch !== false && process\.env\.RENDER_EXTERNAL_URL\) armWatch\(\)/.test(src));
  ok('startJob watches the job it sent', /watchJob\(r\.jobId\);/.test(src));
  ok('the timer never holds the process open', /if \(watchT\.unref\) watchT\.unref\(\)/.test(src));
  ok('a done job with a video and no poster is handed to the bake', /if \(st === 'done' && d\.video && !d\.poster\) bakePoster\(id, d\.video\)/.test(src));

  if (fails.length) { console.log('FOOTAGE WATCH — ' + pass + ' passed, ' + fails.length + ' FAILED'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log('FOOTAGE WATCH — ' + pass + ' passed');
})().catch((e) => { console.error(e); process.exit(1); });
