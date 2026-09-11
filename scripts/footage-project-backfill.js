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
 *   node scripts/footage-project-backfill.js --map sort.json --go          # {id: project}, EVERY chat, overwrites
 *
 * DRY BY DEFAULT and `--project` only ever fills a BLANK: a clip already
 * filed under a project is left alone and counted, so re-running is safe.
 * `--map` is the SORT: a file of {jobId: project} written by a chat that has
 * read the prompts, applied to the whole log (every chat, not only the
 * page's own clips) and OVERWRITING — '' takes a clip off its project. It
 * exists because the first run (2026-09-11, `--project ward` on the page's
 * 174) was WRONG for a third of them: the page had drawn the Jonathan and
 * Sean scenes, the witch commercials, the train and the house under the
 * same picker, and one word over a whole feed is a guess wearing a
 * measurement's clothes. A clip is sorted by its PROMPT, one at a time, and
 * the map is the record of that reading. Needs FIREBASE_SERVICE_ACCOUNT
 * (the Deck Factory one) in the environment.
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
const mapFile = String(arg('map', '') || '');
if (!project && !mapFile) { console.error('name the project: --project ward   (or --map sort.json)'); process.exit(2); }

const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!sa) { console.error('FIREBASE_SERVICE_ACCOUNT is not in the environment'); process.exit(2); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) });
const db = admin.firestore();
const slugOf = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

async function applyMap() {
  const map = JSON.parse(require('fs').readFileSync(mapFile, 'utf8'));
  const snap = await db.collection(videoLog.COLL).get();
  const counts = {};
  let same = 0, missing = 0;
  const todo = [];
  snap.docs.forEach((d) => {
    if (!(d.id in map)) { missing += 1; return; }
    const want = slugOf(map[d.id]);
    const have = slugOf(d.data().project);
    counts[want || '(none)'] = (counts[want || '(none)'] || 0) + 1;
    if (want === have) { same += 1; return; }
    todo.push({ ref: d.ref, project: want });
  });
  const unknown = Object.keys(map).filter((id) => !snap.docs.some((d) => d.id === id)).length;
  console.log(`${snap.size} clips on the log · ${Object.keys(map).length} in the map (${unknown} not on the log) · ${missing} on the log but not in the map, left alone · ${same} already right · ${todo.length} to write`);
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${k}: ${n}`));
  if (!go) { console.log('dry — add --go to write'); return; }
  let n = 0;
  while (todo.length) {
    const batch = db.batch();
    todo.splice(0, 400).forEach((t) => { batch.set(t.ref, { project: t.project }, { merge: true }); n += 1; });
    await batch.commit();
  }
  console.log(`wrote project on ${n} clips`);
}

(async () => {
  if (mapFile) return applyMap();
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
