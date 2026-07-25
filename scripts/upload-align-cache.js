// upload-align-cache.js — publish the forced-alignment word-timestamp caches to
// Firebase Storage so the live Episode Editor can reuse them.
//
// The precise supercut work built these on a laptop/session disk:
//   ~/align-cache/<videoId>_<winStart>.json      (80s windows)
//   ~/align-cache-150/<videoId>_<winStart>.json  (150s windows)
// Each file is a bare array of {word, start, end} whose times are RELATIVE to
// winStart. They're the drift-repaired (aligned) timings — much better than raw
// Whisper — and they cost money/CPU to rebuild, so they belong in Storage where
// every render can hit them instead of dying with the session container.
//
// Uploaded to  nde-align-cache/<videoId>_<winStart>.json  as
//   { videoId, winStart, winDur, words:[…] }
// so editor.js knows how much audio each window covers. Later directories in
// the list win on a path collision, so pass the 80s cache first and the 150s
// cache second (the 150s window is a superset of the 80s one).
//
// Usage:
//   FIREBASE_SERVICE_ACCOUNT='<json>' node scripts/upload-align-cache.js \
//     ~/align-cache:80 ~/align-cache-150:150
// Defaults to those two directories when no arguments are given.

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const PREFIX = process.env.EDITOR_ALIGN_PREFIX || 'nde-align-cache/';
const BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'deckfactory-43176.firebasestorage.app';

function die(msg) { console.error(msg); process.exit(1); }

let serviceAccount;
try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}'); }
catch { die('FIREBASE_SERVICE_ACCOUNT is not valid JSON.'); }
if (!serviceAccount.project_id) die('FIREBASE_SERVICE_ACCOUNT not set.');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), storageBucket: BUCKET });

const args = process.argv.slice(2);
const dirs = (args.length ? args : [
  `${process.env.HOME}/align-cache:80`,
  `${process.env.HOME}/align-cache-150:150`,
]).map(spec => {
  const i = spec.lastIndexOf(':');
  return { dir: spec.slice(0, i), winDur: Number(spec.slice(i + 1)) || 150 };
});

(async () => {
  const bucket = admin.storage().bucket();
  let uploaded = 0;
  let skipped = 0;
  for (const { dir, winDur } of dirs) {
    if (!fs.existsSync(dir)) { console.warn(`skip ${dir} (missing)`); continue; }
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const name of files) {
      const base = name.replace(/\.json$/, '');
      const us = base.lastIndexOf('_');
      const videoId = base.slice(0, us);
      const winStart = Number(base.slice(us + 1));
      if (!videoId || !Number.isFinite(winStart)) { skipped++; continue; }
      let words;
      try { words = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); }
      catch { skipped++; continue; }
      if (!Array.isArray(words) || !words.length) { skipped++; continue; }
      const payload = JSON.stringify({ videoId, winStart, winDur, words });
      const file = bucket.file(`${PREFIX}${videoId}_${winStart}.json`);
      await file.save(Buffer.from(payload), { metadata: { contentType: 'application/json' } });
      await file.makePublic();
      uploaded++;
      if (uploaded % 20 === 0) console.log(`  …${uploaded} uploaded`);
    }
    console.log(`${dir} (${winDur}s windows): ${files.length} file(s)`);
  }
  console.log(`Done — ${uploaded} uploaded to ${PREFIX}, ${skipped} skipped.`);
  process.exit(0);
})().catch(err => die('upload failed: ' + err.message));
