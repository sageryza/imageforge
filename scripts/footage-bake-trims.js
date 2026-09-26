#!/usr/bin/env node
/*
 * footage-bake-trims.js — bake a Footage clip's FAILED (or never-finished)
 * parts from a chat's own container, with the module's own cut.
 *
 * 2026-09-26, Sophie, after six trims were refused by the live server's room
 * guard ("the server is too full to trim right now"): "can u redo mine :(".
 * The fix (2669) was merged and not yet live, and the live box would have
 * refused them again — so the bake runs HERE: footage.js's own `trimPlan` +
 * `bakeTrim` (the same ffmpeg recipe, the same content-addressed Storage
 * path under footage/trims/, the same patch-by-key onto the clip's doc), so
 * what lands is byte-for-byte what the server would have made. Her clip is
 * never touched; a part that already baked is a HEAD and no encode.
 *
 *   node scripts/footage-bake-trims.js --failed            # every failed/stale part, dry
 *   node scripts/footage-bake-trims.js --failed --go
 *   node scripts/footage-bake-trims.js <jobId> [<jobId>…] --go
 *
 * Needs FIREBASE_SERVICE_ACCOUNT (Deck Factory) and ffmpeg-static (npm ci).
 * Free: ffmpeg on this box, no model call, no door.
 */
const admin = require('firebase-admin');
const args = process.argv.slice(2);
const go = args.includes('--go');
const allFailed = args.includes('--failed');
const ids = args.filter((a) => !a.startsWith('--'));
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!sa.project_id) { console.error('FIREBASE_SERVICE_ACCOUNT is not set'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
const F = require('../footage');
const videoLog = require('../video-log');

(async () => {
  const coll = admin.firestore().collection(videoLog.COLL);
  let docs;
  if (ids.length) docs = (await Promise.all(ids.map((id) => coll.doc(id).get()))).filter((s) => s.exists);
  else if (allFailed) docs = (await coll.get()).docs;
  else { console.error('say which: --failed, or job ids'); process.exit(1); }
  const work = [];
  for (const s of docs) {
    const d = s.data();
    for (const t of F.trimsOf(d)) {
      const again = t.status === 'failed' || F.bakeStale(t);
      if (!again && !ids.length) continue;
      if (t.status === 'ready') continue;
      const plan = F.trimPlan(d, { start: t.start, end: t.end });
      if (plan.error) { console.log(`${s.id} ${t.start}-${t.end}: cannot — ${plan.error}`); continue; }
      if (plan.key !== t.key) { console.log(`${s.id} ${t.start}-${t.end}: key differs from the doc's — left alone`); continue; }
      work.push({ id: s.id, t, plan });
    }
  }
  console.log(`${work.length} part(s) to bake${go ? '' : ' (dry — add --go)'}`);
  for (const w of work) console.log(`  ${w.id.slice(0, 8)} ${w.t.start}–${w.t.end}s  was: ${w.t.status}${w.t.error ? ' — ' + w.t.error.slice(0, 60) : ''}`);
  if (!go) return;
  for (const w of work) {
    const t0 = Date.now();
    await F.bakeTrim(w.id, w.plan);
    const after = F.trimsOf((await coll.doc(w.id).get()).data()).find((x) => x.key === w.plan.key) || {};
    console.log(`  ${w.id.slice(0, 8)} ${w.t.start}–${w.t.end}s → ${after.status}${after.error ? ' — ' + after.error : ''} ${after.url || ''} (${Math.round((Date.now() - t0) / 1000)}s)`);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
