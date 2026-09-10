#!/usr/bin/env node
'use strict';
// HOW LONG EACH CLIP TOOK, FILLED IN ON THE ONES ALREADY DRAWN (2026-09-10,
// Sophie: "can you make it say the number of seconds or minutes each clip
// took to draw on the clip?").
//
// The poll writes `drewMs` from the door's own record from here on, but a
// clip drawn before that carries nothing — and a shipped fix to a WRITE path
// leaves the existing records wrong (/wrapup/rehers' lesson). Every door
// keeps its finished predictions, so this reads the figure back rather than
// reconstructing one:
//
//   node scripts/footage-drew-backfill.js            # dry — says what it would write
//   node scripts/footage-drew-backfill.js --go
//   node scripts/footage-drew-backfill.js --chat footage --limit 200
//
// FREE — a read per job on the door, no model call, and it writes ONE field.
// Re-running is safe (merge, and a job that already has the figure is skipped).
// A job the door no longer knows, or one whose record does not say, is COUNTED
// and left alone: nothing invents a number, and sentAt→doneAt is never used —
// doneAt is when the poll NOTICED, which can be hours after the draw ended.
const admin = require('firebase-admin');
const videoLog = require('../video-log');

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const go = args.includes('--go');
const chat = flag('--chat', 'footage');
const limit = Math.min(Number(flag('--limit', 500)) || 500, 2000);

if (!process.env.FIREBASE_SERVICE_ACCOUNT) { console.error('FIREBASE_SERVICE_ACCOUNT missing'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });

const doors = { atlascloud: () => require('../atlascloud'), openrouter: () => require('../openrouter'), apiframe: () => require('../apiframe') };
const raws = {
  atlascloud: async (id) => { const j = await doors.atlascloud().api(`/model/prediction/${encodeURIComponent(id)}`); return (j && j.data) || null; },
  openrouter: async (id) => doors.openrouter().api(`/videos/${encodeURIComponent(id)}`),
  apiframe: async (id) => doors.apiframe().job(id),
};

(async () => {
  const snap = await admin.firestore().collection(videoLog.COLL).where('chat', '==', chat).get();
  const rows = snap.docs.map((d) => ({ id: d.id, d: d.data() }))
    .filter((x) => !Number.isFinite(Number(x.d.drewMs)))
    .filter((x) => ['completed', 'done', 'failed'].includes(String(x.d.status || '').toLowerCase()))
    .sort((a, b) => String(b.d.sentAt || '').localeCompare(String(a.d.sentAt || '')))
    .slice(0, limit);
  console.log(`${snap.size} jobs in "${chat}" · ${rows.length} finished with no draw time`);
  let wrote = 0, silent = 0, gone = 0;
  for (const x of rows) {
    const door = x.d.door || x.d.provider || 'atlascloud';
    const read = raws[door];
    if (!read) { gone++; continue; }
    let ms = null;
    try { ms = videoLog.drewMsOf(await read(x.id)); } catch { gone++; continue; }
    if (ms == null) { silent++; continue; }
    console.log(`  ${x.id}  ${Math.round(ms / 1000)}s  ${x.d.sentAt || ''}`);
    if (go) await admin.firestore().collection(videoLog.COLL).doc(x.id).set({ drewMs: ms }, { merge: true });
    wrote++;
  }
  console.log(`${go ? 'wrote' : 'would write'} ${wrote} · door did not say ${silent} · unreadable ${gone}`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
