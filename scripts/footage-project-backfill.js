#!/usr/bin/env node
/* FILE THE CLIPS ALREADY ON THE LOG UNDER A PROJECT (2026-09-11, the plan's
 * step 5 — docs/footage-projects-plan.md). Every clip drawn before the
 * picker existed carries no `project`; this stamps one word on the ones that
 * carry none and touches nothing else on the doc.
 *
 *   node scripts/footage-project-backfill.js --project ward          # dry: counts, names
 *   node scripts/footage-project-backfill.js --project ward --go     # writes
 *   node scripts/footage-project-backfill.js --project ward --since 2026-09-09 --go
 *   node scripts/footage-project-backfill.js --project ward --ids a,b,c --go
 *
 * DRY BY DEFAULT and it only ever fills a BLANK: a clip already filed under
 * a project is left alone and counted, so re-running is safe and moving a
 * clip is a different, deliberate act (POST /api/footage/jobs/:id/project).
 * Needs FIREBASE_SERVICE_ACCOUNT (the Deck Factory one) in the environment.
 * The first run, 2026-09-11: every clip on the log was the ward's — one
 * film on the shelf, three days of one draft — so `--project ward` alone.
 */
const admin = require('firebase-admin');
const videoLog = require('../video-log');

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i < 0 ? dflt : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true);
}
const go = process.argv.includes('--go');
const project = String(arg('project', '') || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const since = String(arg('since', '') || '');
const ids = String(arg('ids', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!project) { console.error('name the project: --project ward'); process.exit(2); }

const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!sa) { console.error('FIREBASE_SERVICE_ACCOUNT is not in the environment'); process.exit(2); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) });
const db = admin.firestore();

(async () => {
  const snap = await db.collection(videoLog.COLL).where('chat', '==', 'footage').get();
  let blank = 0, filed = 0, skipped = 0;
  const todo = [];
  snap.docs.forEach((d) => {
    const x = d.data();
    if (ids.length && !ids.includes(d.id)) { skipped += 1; return; }
    if (since && String(x.sentAt || '') < since) { skipped += 1; return; }
    if (x.project) { filed += 1; return; }
    blank += 1;
    todo.push(d);
  });
  console.log(`${snap.size} footage clips · ${filed} already filed · ${skipped} outside the ask · ${blank} with no project → "${project}"`);
  if (!go) { console.log('dry — add --go to write'); return; }
  let n = 0;
  while (todo.length) {
    const batch = db.batch();
    todo.splice(0, 400).forEach((d) => { batch.set(d.ref, { project }, { merge: true }); n += 1; });
    await batch.commit();
  }
  console.log(`wrote project="${project}" on ${n} clips`);
})().catch((e) => { console.error(e.message); process.exit(1); });
