#!/usr/bin/env node
/**
 * upload-file.js — put one local file in Firebase Storage and print its public url.
 *
 *   node scripts/upload-file.js ./film.mp4 films/daddy-flying-v1.mp4
 *   node scripts/upload-file.js ./film.mp4 films/x.mp4 --membry
 *
 * Deck Factory (FIREBASE_SERVICE_ACCOUNT) by default; --membry uses
 * STORY_FIREBASE_SERVICE_ACCOUNT. Uploads resumable in 8MB chunks — Sophie's
 * home uplink stalls on a single request over ~1MB, and this script runs on her
 * Mac too. Prints the url on stdout and nothing else, so it pipes.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const membry = args.includes('--membry');
const [local, dest] = args.filter(a => !a.startsWith('--'));
if (!local || !dest) {
  console.error('usage: upload-file.js <local> <storage/path> [--membry]');
  process.exit(1);
}

const raw = membry
  ? process.env.STORY_FIREBASE_SERVICE_ACCOUNT
  : (process.env.FIREBASE_SERVICE_ACCOUNT || process.env.STORY_FIREBASE_SERVICE_ACCOUNT);
if (!raw) {
  console.error('upload-file: no service account in env');
  process.exit(1);
}
const cred = JSON.parse(raw);
admin.initializeApp({
  credential: admin.credential.cert(cred),
  storageBucket: `${cred.project_id}.firebasestorage.app`,
});

const TYPES = {
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
  '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.json': 'application/json',
};

(async () => {
  const bucket = admin.storage().bucket();
  const contentType = TYPES[path.extname(local).toLowerCase()] || 'application/octet-stream';
  await bucket.upload(local, {
    destination: dest,
    resumable: true,
    chunkSize: 8 * 1024 * 1024,
    metadata: { contentType, cacheControl: 'public, max-age=31536000' },
  });
  await bucket.file(dest).makePublic();
  console.log(`https://storage.googleapis.com/${bucket.name}/${dest}`);
  process.exit(0);
})().catch(e => { console.error('upload-file:', e.message); process.exit(1); });
