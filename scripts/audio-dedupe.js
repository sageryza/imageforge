#!/usr/bin/env node
// Repair: remove cross-batch duplicate recordings from the audio drop
// (forge-audio). The dedupe used to be per-batch, and the share sheet stamps
// a new batch per share — so the same recording sent in two separate shares
// was stored twice (verified live by Sophie, Aug 2026; storeOne now checks
// the hash globally). Keeps the OLDEST doc per md5 hash, deletes the newer
// docs AND their storage objects (exact byte-duplicates only — nothing that
// isn't the same file is ever touched). Same spirit as scripts/drop-dedupe.js.
//
//   node scripts/audio-dedupe.js --dry-run   # print the plan
//   node scripts/audio-dedupe.js             # delete the duplicates
//
// Needs FIREBASE_SERVICE_ACCOUNT (deckfactory-43176) in the environment.

const admin = require('firebase-admin');

const DRY = process.argv.includes('--dry-run');

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) { console.error('FIREBASE_SERVICE_ACCOUNT not set'); process.exit(1); }
const sa = JSON.parse(raw);
admin.initializeApp({ credential: admin.credential.cert(sa) });

(async () => {
  const db = admin.firestore();
  let bucket = admin.storage().bucket(sa.project_id + '.appspot.com');
  if (!(await bucket.exists())[0]) bucket = admin.storage().bucket(sa.project_id + '.firebasestorage.app');

  const snap = await db.collection('forge-audio').get();
  const byHash = new Map();
  snap.forEach((d) => {
    const v = d.data();
    if (!v.hash) return;
    if (!byHash.has(v.hash)) byHash.set(v.hash, []);
    byHash.get(v.hash).push({ id: d.id, ref: d.ref, ...v });
  });

  let removed = 0, bytes = 0;
  for (const [hash, docs] of byHash) {
    if (docs.length < 2) continue;
    docs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const keep = docs[0];
    for (const extra of docs.slice(1)) {
      console.log(`${DRY ? '[dry] ' : ''}duplicate "${extra.name}" (${extra.batch}/${extra.id})`
        + ` — keeping "${keep.name}" (${keep.batch}/${keep.id}), hash ${hash.slice(0, 8)}…`);
      if (!DRY) {
        await extra.ref.delete();
        if (extra.storagePath) {
          try { await bucket.file(extra.storagePath).delete(); } catch { /* already gone */ }
        }
      }
      removed++; bytes += Number(extra.bytes) || 0;
    }
  }
  console.log(`\n${removed} duplicate(s) ${DRY ? 'found (dry run — nothing deleted)' : 'removed'}`
    + `, ~${(bytes / 1024 / 1024).toFixed(1)} MB${DRY ? ' reclaimable' : ' reclaimed'}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
