#!/usr/bin/env node
'use strict';
// FIVE CHANGES WAITING (2026-09-14, Sophie: "I would like a notification when
// there are five changes undeployed").
//
// The half that can silently be wrong is the MARK: a push that lands without
// one buzzes her every hour, and a mark written for the wrong commit makes a
// deploy fail to reset the count. So the store is a fake Firestore driven
// against the real push.js, and every assertion is a reading of what really
// landed in it.
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL ' + m); } };

// ── a fake Firestore, one doc ──────────────────────────────────────────
let doc = {};
const snap = () => ({ exists: Object.keys(doc).length > 0, get: (k) => doc[k], data: () => doc });
const fakeDb = {
  doc: () => ({
    get: async () => snap(),
    set: async (patch) => { Object.assign(doc, patch); },
  }),
  collection: () => ({ get: async () => ({ docs: [] }) }),
};
Object.defineProperty(admin, 'firestore', { configurable: true, get() { return () => fakeDb; } });
Object.defineProperty(admin, 'apps', { configurable: true, get() { return [{}]; } });

const push = require(path.join(ROOT, 'push.js'));

// ── the rule, pure ─────────────────────────────────────────────────────
const plan = (a, l) => push.behindPlan(a, l);
ok(push.BEHIND_STEP === 5, 'the rung is five — her number');
ok(plan(0, 0).push === false, 'nothing merged says nothing');
ok(plan(4, 0).push === false, 'four is under the rung');
ok(plan(5, 0).push === true && plan(5, 0).rung === 5, 'five buzzes');
ok(plan(6, 5).push === false, 'six after five says nothing — one buzz per rung, not one per tick');
ok(plan(9, 5).push === false, 'nine after five still says nothing');
ok(plan(10, 5).push === true && plan(10, 5).rung === 10, 'ten buzzes again — a number that keeps climbing is worth hearing');
ok(plan(15, 10).push === true, 'and fifteen');
ok(plan(3, 10).push === false, 'a count that went DOWN (a deploy landed) says nothing');

// ── readBehind ─────────────────────────────────────────────────────────
(async () => {
  let asked = null;
  const gh = (n) => async (url) => { asked = url; return { ok: true, status: 200, json: async () => ({ ahead_by: n }) }; };
  let r = await push.readBehind(gh(7), 'abc123');
  ok(r && r.ahead === 7, 'it reads ahead_by off the compare');
  ok(/compare\/abc123\.\.\.main/.test(asked), 'it compares THIS commit against main');
  ok(await push.readBehind(gh(3), '') === null, 'no commit to compare against answers null, never a guess');
  let blew = null;
  try { await push.readBehind(async () => ({ ok: false, status: 403 }), 'abc'); } catch (e) { blew = e; }
  ok(blew && /403/.test(blew.message), 'a refused read throws rather than reading as zero');

  // ── the whole check against the fake store ───────────────────────────
  doc = {};
  let r1 = await push.behindCheck({ fetch: gh(5), sha: 'sha-A' });
  ok(r1.pushed === true && r1.ahead === 5, 'five undeployed pushes');
  ok(doc.behindSha === 'sha-A' && doc.behindRung === 5, 'the rung is MARKED, keyed by the commit');

  let r2 = await push.behindCheck({ fetch: gh(6), sha: 'sha-A' });
  ok(r2.pushed === false && r2.why === 'said', 'the next hour at six says nothing');

  let r3 = await push.behindCheck({ fetch: gh(11), sha: 'sha-A' });
  ok(r3.pushed === true && r3.ahead === 11, 'past ten it buzzes again');
  ok(doc.behindRung === 10, 'and the mark moves up to the rung it said');

  // A DEPLOY RESETS IT BY CONSTRUCTION — the new instance is built from a
  // newer commit, so the mark it finds is not its own.
  let r4 = await push.behindCheck({ fetch: gh(5), sha: 'sha-B' });
  ok(r4.pushed === true, 'a new instance starts its own count from zero');
  ok(doc.behindSha === 'sha-B', 'and marks under its own commit');

  // never throws
  const bad = await push.behindCheck({ fetch: async () => { throw new Error('offline'); }, sha: 'sha-B' });
  ok(bad.pushed === false && /offline/.test(bad.why), 'a GitHub hiccup is an answer, never a crash');

  // ── the wirings, by source ───────────────────────────────────────────
  const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  ok(/behindCheck\(\)/.test(srv), 'the server ticks it');
  ok(/setInterval\(behindTick, 60 \* 60 \* 1000\)/.test(srv), 'hourly — a free GitHub read, not a poll');
  const blk = srv.slice(srv.indexOf('const behindTick'));
  ok(srv.indexOf('const behindTick') > srv.indexOf("if (process.env.RENDER_EXTERNAL_URL)"),
    'gated on Render — a dev container must not eat her notification');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
