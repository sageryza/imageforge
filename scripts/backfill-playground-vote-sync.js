#!/usr/bin/env node
/*
 * backfill-playground-vote-sync.js — carry the Playground ♥/✕ already on file
 * across to the Assets tabs, once (Aug 2026 — votes cast before the two-way
 * sync shipped lived only on their run docs; measured the day the sync was
 * built, 21 of the 22 hearted Playground pictures in the newest 100 runs sat
 * unhearted in Meta Assets).
 *
 * No credentials needed: it pages the whole run history through the public
 * feed API and RE-POSTS each existing vote through the live vote route — the
 * same value back onto the same doc, which is a no-op there, and the deployed
 * route's own sync then writes the Assets side exactly the way a fresh tap
 * would. Run it AFTER the sync is live or it re-writes votes for nothing.
 *
 * Dry by default — prints what it would send. Re-running with --go is safe
 * (idempotent both sides).
 *
 *   node scripts/backfill-playground-vote-sync.js          # dry run
 *   node scripts/backfill-playground-vote-sync.js --go     # actually post
 *   FORGE_BASE=http://localhost:3001 …                     # another server
 */
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const GO = process.argv.includes('--go');

(async () => {
  const runs = [];
  let before = 0;
  for (let page = 0; page < 40; page++) {          // 40 × 100 ≫ the whole history
    const url = BASE + '/api/promptlab?limit=100' + (before ? '&before=' + before : '');
    const d = await (await fetch(url)).json();
    const got = d.runs || [];
    runs.push(...got);
    const oldest = got.map((r) => r.createdAt).filter(Boolean).sort((a, b) => a - b)[0];
    if (!d.more || !oldest) break;
    before = oldest;
  }
  const votes = [];
  runs.forEach((r) => Object.entries(r.votes || {}).forEach(([i, v]) => {
    if (v === 'like' || v === 'dislike') votes.push({ id: r.id, image: Number(i), vote: v });
  }));
  console.log(runs.length + ' runs read, ' + votes.length + ' votes on file');
  if (!GO) {
    votes.forEach((v) => console.log('  would re-post ' + v.vote + ' on ' + v.id + ' image ' + v.image));
    console.log('\nDRY RUN — nothing sent. Re-run with --go once the sync is deployed.');
    return;
  }
  let okN = 0, failN = 0;
  for (const v of votes) {                          // serial on purpose — gentle on the 512MB box
    try {
      const r = await fetch(BASE + '/api/promptlab/' + v.id + '/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: v.image, vote: v.vote }),
      });
      const d = await r.json();
      if (d.ok) okN++; else { failN++; console.log('  failed: ' + v.id + ' — ' + (d.error || r.status)); }
    } catch (e) { failN++; console.log('  failed: ' + v.id + ' — ' + e.message); }
  }
  console.log('re-posted ' + okN + ' votes' + (failN ? ', ' + failN + ' failed' : ''));
})().catch((e) => { console.error(e); process.exit(1); });
