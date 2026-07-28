#!/usr/bin/env node
// drop-heic-fix.js — convert the HEICs already sitting in the Dump to JPEG.
//
// `normalize()` was calling sharp without `unlimited`, and libheif's default
// security limit rejects an iPhone HEIC outright (dozens of entries in its iref
// box: depth map, thumbnails, HDR gain map). Every one of those photos hit the
// catch and was stored AS HEIC — which Etsy refuses, Replicate can't read, and
// no non-Apple browser will display. The server no longer does that; this
// converts what it already wrote.
//
// Bytes are shared between albums, so the work is per unique hash, not per doc.
// The doc's `hash` is the hash of the ORIGINAL upload and does NOT change —
// that's what dedupe is keyed on, so a re-dump still recognises the photo.
//
//   node scripts/drop-heic-fix.js --dry-run
//   node scripts/drop-heic-fix.js [--limit 50]

const admin = require('firebase-admin');
const sharp = require('sharp');
const heicConvert = require('heic-convert');

const COL = 'forge-drops';
const DRY = process.argv.includes('--dry-run');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  return i > -1 ? Number(process.argv[i + 1]) : Infinity;
})();
const PARALLEL = 4;

function init() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('set FIREBASE_SERVICE_ACCOUNT (Deck Factory)');
  const cred = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(cred),
    storageBucket: `${cred.project_id}.firebasestorage.app`,
  });
}

async function main() {
  init();
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  const snap = await db.collection(COL).get();
  const heic = snap.docs
    .map((d) => ({ id: d.id, ref: d.ref, ...d.data() }))
    .filter((d) => /\.heic$/i.test(d.storagePath || ''));

  // One conversion per distinct object, however many albums point at it.
  const byPath = new Map();
  heic.forEach((d) => {
    const e = byPath.get(d.storagePath) || [];
    e.push(d);
    byPath.set(d.storagePath, e);
  });
  const jobs = [...byPath.entries()].slice(0, LIMIT);
  console.log(`${heic.length} HEIC files across ${byPath.size} objects; converting ${jobs.length}`
    + (DRY ? ' (dry run)' : ''));
  if (DRY) return;

  let done = 0;
  let failed = 0;
  let saved = 0;
  const queue = jobs.slice();

  async function worker() {
    while (queue.length) {
      const [oldPath, docs] = queue.shift();
      try {
        const [buf] = await bucket.file(oldPath).download();
        // Same two-decoder path as the server: sharp first, and when this
        // libheif build dies with "bad seek" on a tiled iPhone HEIC, the wasm
        // decoder reads it at full resolution.
        let jpg;
        try {
          jpg = await sharp(buf, { unlimited: true }).jpeg({ quality: 95 }).toBuffer();
        } catch {
          jpg = await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.95 });
        }
        const newPath = `drops/_/${docs[0].hash}.jpg`;
        const file = bucket.file(newPath);
        await file.save(jpg, { metadata: { contentType: 'image/jpeg' } });
        await file.makePublic();
        const url = `https://storage.googleapis.com/${bucket.name}/${newPath}`;
        for (const d of docs) {
          await d.ref.update({ url, storagePath: newPath, bytes: jpg.length, updatedAt: Date.now() });
        }
        if (oldPath !== newPath) {
          try { await bucket.file(oldPath).delete(); } catch { /* already gone */ }
        }
        saved += buf.length - jpg.length;
        done++;
      } catch (e) {
        failed++;
        console.log(`  FAILED ${oldPath}: ${e.message.slice(0, 100)}`);
      }
      if ((done + failed) % 25 === 0) {
        console.log(`  ${done + failed}/${jobs.length} (${failed} failed)`);
      }
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));

  console.log(`\nconverted ${done} objects, ${failed} failed, `
    + `${saved > 0 ? 'saved' : 'grew by'} ~${Math.abs(saved / 1e6).toFixed(0)} MB`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
