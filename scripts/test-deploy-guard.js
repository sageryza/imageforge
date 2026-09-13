#!/usr/bin/env node
'use strict';
// The stop guard before a deploy — pure, no network.
const { waitForClear } = require('./deploy-guard');
let pass = 0, fail = 0;
const is = (g, w, what) => { if (g === w) { pass++; return; } fail++; console.log(`FAIL ${what}\n  got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); };
const answer = (drawing, cutting) => ({ ok: true, json: async () => ({ drawing, cutting, memory: { rss: 300 * 1048576 } }) });
(async () => {
  let t = 0; const now = () => t; const wait = async (ms) => { t += ms; }; const quiet = () => {};
  // idle server: clear at once
  let r = await waitForClear({ fetch: async () => answer([], []), wait, now, log: quiet });
  is(r.ok && r.reason === 'clear' && r.waited === 0, true, 'an idle box is clear to deploy at once');
  // a draw that finishes after 50s: held, then clear
  t = 0; r = await waitForClear({ fetch: async () => answer(t < 50000 ? ['r1'] : [], []), wait, now, tickMs: 10000, log: quiet });
  is(r.ok, true, 'a draw is waited out');
  is(r.waited >= 50000 && r.waited < 70000, true, `held for the draw (${r.waited}ms)`);
  // a cut counts too
  t = 0; r = await waitForClear({ fetch: async () => answer([], t < 20000 ? ['c1'] : []), wait, now, tickMs: 10000, log: quiet });
  is(r.ok && r.waited >= 20000, true, 'a cut holds the deploy too');
  // busy past the cap: the deploy is REFUSED
  t = 0; r = await waitForClear({ fetch: async () => answer(['r1'], []), wait, now, tickMs: 10000, capMs: 60000, log: quiet });
  is(r.ok, false, 'still busy at the cap: not deployed');
  is(r.reason, 'busy', 'and it says why');
  // an old server with no /inflight: nothing to wait for
  t = 0; r = await waitForClear({ fetch: async () => ({ ok: false, status: 404 }), wait, now, tickMs: 1000, log: quiet });
  is(r.ok && r.reason === 'unreadable', true, 'a 404 (old build) does not hold the deploy');
  // a box mid-restart (fetch throws): same
  t = 0; r = await waitForClear({ fetch: async () => { throw new Error('ECONNRESET'); }, wait, now, tickMs: 1000, log: quiet });
  is(r.ok && r.reason === 'unreadable', true, 'an unreachable box does not hold the deploy');
  // one bad read in the middle of a real wait does not release it
  t = 0; let n = 0;
  r = await waitForClear({ fetch: async () => { n++; if (n === 2) throw new Error('blip'); return answer(t < 30000 ? ['r1'] : [], []); }, wait, now, tickMs: 10000, log: quiet });
  is(r.ok && r.reason === 'clear' && r.waited >= 30000, true, 'one blip mid-wait does not release the hold');
  // --- the pause before the swap ------------------------------------------
  // clean: the guard pauses, re-reads, lets go — and the pause is ON when it does
  const posts = [];
  const rec = (busyFn) => async (url, opts) => {
    if (/\/pause$/.test(url)) { posts.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({}) }; }
    return answer(busyFn() ? ['r1'] : [], []);
  };
  t = 0; posts.length = 0;
  r = await waitForClear({ fetch: rec(() => false), wait, now, log: quiet });
  is(r.ok && r.paused === true, true, 'a clean box is paused before the deploy goes on');
  is(posts.length === 2 && posts.every((p) => p.on === true && p.seconds > 60), true, 'two pause POSTs, both on, long enough for the swap');
  is(typeof posts[0].note === 'string' && posts[0].note.length > 10, true, 'the pause carries an explanatory note');
  // THE DEPLOY FLAG IS THE PUSH, AND IT RIDES THE SECOND ONE ONLY (2026-09-13,
  // Sophie: "can i get a notification when deploy starts and ends"). The first
  // pause is provisional — the re-read after it can still send the guard back
  // to waiting — so buzzing her there would buzz her for a deploy that has not
  // gone. Only the re-affirm, after the box has proved clean twice, carries it.
  is(posts[0].deploy === false, true, 'the provisional pause does NOT buzz her');
  is(posts[1].deploy === true, true, 'the re-affirm once the swap is going does');
  is(r.buzzed === true, true, 'and the guard reports that it buzzed');
  // a tap lands between the read and the pause: lifted, and the wait resumes
  t = 0; posts.length = 0; let reads = 0;
  r = await waitForClear({ fetch: async (url, opts) => {
    if (/\/pause$/.test(url)) { posts.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({}) }; }
    reads++;
    // read 1 clean, read 2 (after the pause) busy, read 3 clean, read 4 clean
    return answer(reads === 2 ? ['sneaky'] : [], []);
  }, wait, now, tickMs: 1000, log: quiet });
  is(r.ok, true, 'a draw that snuck in is waited out');
  is(posts.map((p) => p.on).join(','), 'true,false,true,true', 'pause → lifted for the sneak → paused → re-affirmed before letting go');
  // the run that was called off must not have buzzed her
  is(posts.filter((p) => p.deploy).length === 1, true, 'a sneak-in deploy buzzes her ONCE, at the end');
  // refused at the cap: the pause is lifted
  t = 0; posts.length = 0;
  r = await waitForClear({ fetch: rec(() => true), wait, now, tickMs: 10000, capMs: 60000, log: quiet });
  is(r.ok === false && posts.length === 1 && posts[0].on === false, true, 'a refused deploy lifts any pause');
  is(posts.some((p) => p.deploy), false, 'and a refused deploy never buzzes her');
  // the pause route missing (old server): the deploy still goes on, honestly marked
  t = 0;
  r = await waitForClear({ fetch: async (url) => (/\/pause$/.test(url) ? { ok: false, status: 404 } : answer([], [])), wait, now, log: quiet });
  is(r.ok && r.paused === false, true, 'no pause route: deploys anyway and says it could not pause');
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
