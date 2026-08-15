#!/usr/bin/env node
// harvest-clips.js — run the Chunking harvest directly, without the server.
//
// This is how a chat builds or refreshes the clip library from its own
// container: the Admin SDK talks straight to Firestore/Storage
// (googleapis.com — allowed on every network level), and the static ffmpeg
// binaries in node_modules cut the posters locally. Free — no model calls.
//
//   FIREBASE_SERVICE_ACCOUNT=<deckfactory json> node scripts/harvest-clips.js
//   node scripts/harvest-clips.js --dry      # gather + report, write nothing
//
// The deployed server exposes the same run as POST /api/clips/harvest
// (background job, poll GET /api/clips/harvest).

process.chdir(require('path').join(__dirname, '..'));
const admin = require('firebase-admin');

const svcRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!svcRaw) {
  console.error('FIREBASE_SERVICE_ACCOUNT (the deckfactory Admin JSON) is required.');
  process.exit(1);
}
const svc = JSON.parse(svcRaw);
admin.initializeApp({
  credential: admin.credential.cert(svc),
  storageBucket: `${svc.project_id}.firebasestorage.app`,
});

const clips = require('../clips');
const dry = process.argv.includes('--dry');

(async () => {
  let lastLine = '';
  const progress = (done, total, label) => {
    const line = total ? `[${done}/${total}] ${label}` : label;
    if (line !== lastLine) { console.log(line); lastLine = line; }
  };
  const summary = await clips.runHarvest(progress, { dry });
  console.log(dry ? '\nDRY RUN — nothing written. Would gather:' : '\nHarvest summary:');
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
})().catch((e) => { console.error('harvest failed:', e.message); process.exit(1); });
