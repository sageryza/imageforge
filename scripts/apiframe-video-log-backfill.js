#!/usr/bin/env node
'use strict';
// File a Seedance/APIFRAME job's exact prompt and references into
// forge-video-jobs — for clips made BEFORE the route logged them, or drawn
// outside the route. Reads each job back from APIFRAME itself (the literal
// input as received), so nothing is reconstructed.
//
//   node scripts/apiframe-video-log-backfill.js --chat <slug> [--dry] \
//     <jobId>[:scene[:title]] …
//   node scripts/apiframe-video-log-backfill.js --file jobs.json   # [{job,chat,scene,title,note,clip}]
//
// Needs APIFRAME_KEY and FIREBASE_SERVICE_ACCOUNT (Deck Factory) in the env.
// Dry by default prints the docs; --go writes. Re-running is safe (merge by job id).
const fs = require('fs');
const fetch = require('node-fetch');
const admin = require('firebase-admin');
const videoLog = require('../video-log');
const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const go = args.includes('--go');
const chat = flag('--chat') || '';
let entries = [];
if (flag('--file')) entries = JSON.parse(fs.readFileSync(flag('--file'), 'utf8'));
else entries = args.filter((a) => !a.startsWith('--') && a !== chat).map((a) => {
  const [job, scene, title] = a.split(':'); return { job, chat, scene, title };
});
if (!entries.length) { console.error('no job ids'); process.exit(1); }
const KEY = process.env.APIFRAME_KEY; if (!KEY) { console.error('APIFRAME_KEY missing'); process.exit(1); }
let agent; try { const { HttpsProxyAgent } = require('https-proxy-agent'); if (process.env.HTTPS_PROXY) agent = new HttpsProxyAgent(process.env.HTTPS_PROXY); } catch (e) { /* no proxy */ }
const BASE = process.env.APIFRAME_BASE || 'https://api.apiframe.ai/v2';
async function job(id) {
  const r = await fetch(`${BASE}/jobs/${id}`, { headers: { 'X-API-Key': KEY, Accept: 'application/json', 'User-Agent': 'imageforge/1.0' }, agent });
  if (!r.ok) throw new Error(`APIFRAME ${r.status} for ${id}`);
  return r.json();
}
(async () => {
  if (go) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  for (const e of entries) {
    const j = await job(e.job);
    const doc = videoLog.fromJob(j, e);
    if (e.clip) doc.video = e.clip;
    console.log((go ? 'WRITE ' : 'dry   ') + e.job, doc.status, (doc.chat || '-') + '/' + (doc.scene || '-'),
      'refs', doc.references.videos.length + 'v', doc.references.images.length + 'i', JSON.stringify(doc.prompt).slice(0, 60));
    if (go) await admin.firestore().collection(videoLog.COLL).doc(String(e.job)).set(doc, { merge: true });
  }
  console.log(go ? 'done' : 'dry run — add --go to write');
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
