#!/usr/bin/env node
'use strict';
// SEED THE DEPLOY LOG — ONCE (2026-09-16, Sophie: "can i have collapsed rows
// under, up to five, showing what rode in the last 5 deployed").
//
// waiting.js writes `forge-deploys` from the server's OWN BOOT, which needs no
// key and keeps itself current — but it only knows about deploys that happen
// after it ships, so the page would have opened empty and filled up over a
// week. This fills in the history that already happened.
//
// It reads Render's deploy API, which a CHAT'S CONTAINER has the key for
// (RENDER_API_KEY) and the live service does NOT — measured 2026-09-16, the
// service's whole env is ATLASCLOUD_API_KEY · FIREBASE_SERVICE_ACCOUNT ·
// MALLOC_ARENA_MAX · OPENAI_API_KEY · OPENROUTER_API_KEY · REPLICATE_API_TOKEN.
// That asymmetry is the whole reason the server records its own boot instead
// of asking Render: seeding is a one-off a chat can do from here, and the
// running answer must not depend on a secret nobody has put on the box.
//
// ONLY A DEPLOY THAT WAS ACTUALLY LIVE counts (`live` now, or `deactivated` —
// live once and since superseded). A build that failed or was canceled shipped
// nothing, so nothing rode in it.
//
//   node scripts/seed-deploy-log.js          says what it would write (dry)
//   node scripts/seed-deploy-log.js --go     writes it
//
// Needs RENDER_API_KEY and FIREBASE_SERVICE_ACCOUNT (Deck Factory). Free.
const admin = require('firebase-admin');
const SRV = process.env.RENDER_SERVICE_ID || 'srv-d660igvgi27c73a5u6eg';
const GO = process.argv.includes('--go');
const LI = process.argv.indexOf('--limit');
const LIMIT = Number(LI > 0 ? process.argv[LI + 1] : 0) || 12;
const SHIPPED = new Set(['live', 'deactivated']);

async function main() {
  const key = process.env.RENDER_API_KEY;
  if (!key) { console.error('RENDER_API_KEY is not set'); process.exit(2); }
  const r = await fetch(`https://api.render.com/v1/services/${SRV}/deploys?limit=${LIMIT}`,
    { headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' } });
  if (!r.ok) { console.error('render ' + r.status); process.exit(2); }
  const rows = (await r.json()).map((x) => x.deploy || x)
    .filter((d) => SHIPPED.has(String(d.status)) && d.commit && d.commit.id)
    // the moment it went live; a deploy still building has no finishedAt
    .map((d) => ({ sha: String(d.commit.id), at: String(d.finishedAt || d.updatedAt || d.createdAt || ''),
      title: String((d.commit.message || '').split('\n')[0]).slice(0, 70) }))
    .filter((d) => d.at);

  if (!GO) {
    rows.forEach((d) => console.log(d.sha.slice(0, 7), d.at, d.title));
    console.log(`\n${rows.length} deploys — re-run with --go to write them`);
    return;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) { console.error('FIREBASE_SERVICE_ACCOUNT is not set'); process.exit(2); }
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  const coll = admin.firestore().collection('forge-deploys');
  let wrote = 0, kept = 0;
  for (const d of rows) {
    const ref = coll.doc(d.sha.slice(0, 12));
    // NEVER overwrite what the server recorded for itself — its `at` is the
    // moment an instance really answered, which is the truer number.
    if ((await ref.get()).exists) { kept++; continue; }
    await ref.set({ sha: d.sha, at: d.at, seeded: true });
    wrote++;
  }
  console.log(`wrote ${wrote}, left ${kept} alone`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
