#!/usr/bin/env node
'use strict';
// THE ONE REGISTER OF WORK A RESTART WOULD KILL (2026-09-14, Sophie: "make
// sure the deploy guard waits for footage sends and anything else that would
// cause a problem").
//
// Every assertion here is a MEASUREMENT of what the register really holds, or
// a reading of what a stub server really received — a `track` call that never
// increments, one that leaks a phantom on a throw, and a guard that reads the
// count and ignores it all look identical in the source.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL ' + m); } };
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

(async () => {
  // ── the register ─────────────────────────────────────────────────────
  const inflight = require(path.join(ROOT, 'inflight.js'));
  ok(inflight.total() === 0, 'starts empty');

  let release;
  const held = new Promise((r) => { release = r; });
  const p = inflight.track('footage-send', () => held);
  ok(inflight.total() === 1, 'a tracked call counts while it runs');
  ok(inflight.counts()['footage-send'] === 1, 'counted under its own name');
  const p2 = inflight.track('footage-send', () => held);
  ok(inflight.total() === 2, 'two of a kind count twice');
  release(7);
  ok(await p === 7, 'the answer rides back untouched');
  await p2;
  ok(inflight.total() === 0, 'clears when the work ends');
  ok(!('footage-send' in inflight.counts()), 'an empty name leaves no entry');

  // A THROW MUST NOT LEAVE A PHANTOM — a phantom holds a deploy for ever.
  let threw = null;
  try { await inflight.track('x', async () => { throw new Error('boom'); }); } catch (e) { threw = e; }
  ok(threw && threw.message === 'boom', 'the throw rides back untouched');
  ok(inflight.total() === 0, 'a throw leaves nothing in the register');

  const end = inflight.begin('manual');
  ok(inflight.total() === 1, 'begin() counts');
  end(); end();
  ok(inflight.total() === 0, 'end() is idempotent — a double call cannot go negative');

  // ── the guard reads it ───────────────────────────────────────────────
  const guard = require(path.join(ROOT, 'scripts/deploy-guard.js'));
  const stub = (body) => async () => ({ ok: true, status: 200, json: async () => body });
  let st = await guard.readState(stub({ drawing: [], cutting: [], work: { 'footage-send': 1 } }));
  ok(st.busy === 1, 'a footage send alone makes the guard busy');
  ok(st.working === 1, 'and is reported as work');
  st = await guard.readState(stub({ drawing: ['a'], cutting: [], work: { render: 2, icons: 1 } }));
  ok(st.busy === 4, 'draws and work add up');
  // AN OLDER SERVER SAYS NOTHING ABOUT `work` AND MUST READ AS CLEAR — never
  // a hold on a box that cannot answer.
  st = await guard.readState(stub({ drawing: [], cutting: [] }));
  ok(st.busy === 0 && st.working === 0, 'no `work` key reads as nothing to wait for');
  st = await guard.readState(stub({ drawing: [], cutting: [], work: 'nonsense' }));
  ok(st.busy === 0, 'a `work` that is not an object is ignored, never thrown on');

  // the guard really HOLDS on work alone
  let reads = 0;
  const busyThenClear = async (url, opts) => {
    if (String(url).includes('/pause')) return { ok: true };
    reads++;
    return { ok: true, status: 200, json: async () => ({ drawing: [], cutting: [], work: reads < 3 ? { 'footage-send': 1 } : {} }) };
  };
  const r = await guard.waitForClear({ fetch: busyThenClear, wait: async () => {}, log: () => {} });
  ok(r.ok && r.reason === 'clear', 'the guard lets go once the send is done');
  ok(reads >= 3, `the guard really waited on the send (${reads} reads)`);

  // ── the wirings, by source ───────────────────────────────────────────
  const f = read('footage.js');
  ok(/async function startJob\(b\) \{ return inflight\.track\('footage-send'/.test(f),
    'a footage SEND is registered — the one piece of work here that spends her money before it writes anything down');
  ok(/inflight\.track\('footage-bake', fn\)/.test(f), 'a trim/frame bake is registered');
  // through the one-decode queue since 2026-09-14, and `gateTrim` is what tracks it
  ok(/bakePoster\(id, videoUrl\) \{ return gateTrim\(/.test(f) && /const run = \(\) => inflight\.track\('footage-bake', fn\)/.test(f), 'a poster bake is registered');
  // the check lives in startJobInner since 2026-09-14, so a chat calling startJob meets it too
  ok(/if \(pausedNow\(\)\) await refuse\(PAUSED_WORDS, 'paused'/.test(f), 'a send during the deploy pause is refused, not drawn');
  // THE WORDS ARE THIS PAGE'S OWN — the Playground's note promises the tap
  // "will draw on its own in about a minute", which is false here: nothing
  // queues a video job, and a message promising a clip that never comes is
  // worse than no message.
  ok(/nothing was sent or charged/.test(f), 'and it says nothing was sent or charged');
  ok(!/pause\.note/.test(f), "it never borrows the Playground's queued-tap note");

  const srv = read('server.js');
  ok(/work: inflight\.counts\(\), working: inflight\.total\(\)/.test(srv), '/inflight reports the register');
  ok(/busy: \(\) => drawingNow\.size \+ cuttingNow\.size \+ inflight\.total\(\)/.test(srv), 'SIGTERM holds for it too');
  ok(/require\('\.\/footage'\)\.init\(\{ paused:/.test(srv), 'footage is handed the pause reader');

  for (const [file, label] of [['filmeditor.js', 'Film Editor'], ['stitch.js', 'Stitch'], ['assembly.js', 'Assembly']]) {
    ok(/track\('render', \(\) => fn\(progress\)\)/.test(read(file)), `${label} renders are registered`);
  }
  ok((read('movies.js').match(/track\('movies'/g) || []).length === 2, 'both Movies job runners are registered');
  ok(/track\('voice'.*renderJobInner/.test(read('voicelab.js')), 'a Voice Studio render is registered');
  ok(/track\('voice'.*changeJobInner/.test(read('voicelab.js')), 'a Voice Studio conversion is registered');
  ok(/track\('render', \(\) => runFilmJobInner/.test(read('scratchpad.js')), "a pad's film is registered");
  ok(/track\('icons', \(\) => runSweepInner/.test(read('chaticons.js')), 'the chat-icons sweep is registered');
  ok(/working/.test(read('scripts/render-deploy.js')), 'the hand deploy reads the register too');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
