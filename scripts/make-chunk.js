#!/usr/bin/env node
// make-chunk.js — file + bake a CHUNK from a chat's own container.
//
// A chunk is a named, tagged section of a finished video — footage and
// voiceover together — that Sophie would reuse whole in a different video
// (the Sheldrake telepathy bridge, the manifestation trio). This does the
// same work as POST /api/clips/chunk, locally: Admin SDK download, accurate
// ffmpeg trim with 12ms audio edge fades, poster, doc. Free.
//
//   FIREBASE_SERVICE_ACCOUNT=<deckfactory json> node scripts/make-chunk.js \
//     --url "https://storage.googleapis.com/<bucket>/<finished-video>.mp4" \
//     --start 102 --end 151 \
//     --title "Sheldrake telepathy bridge" \
//     --tags "telepathy, sheldrake, bridge" \
//     --from "the Evan video" \
//     --vo "the exact voiceover text of the span, if you have it"
//
// Re-running with the same url+span converges on the same doc (safe retry).

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

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i].replace(/^--/, '');
  args[k] = process.argv[i + 1];
}

(async () => {
  let doc;
  try { doc = clips.buildChunkDoc(args); } catch (e) {
    console.error('refused:', e.message); process.exit(1);
  }
  const id = clips.chunkId(doc.source.url, doc.span.start, doc.span.end);
  const db = admin.firestore();
  const ref = db.collection(clips.COL).doc(id);
  const before = await ref.get();
  const now = Date.now();
  await ref.set({ ...doc, createdAt: (before.exists && before.get('createdAt')) || now, updatedAt: now },
    { merge: true });
  console.log(`chunk ${id} — baking "${doc.title}" (${doc.span.start}s → ${doc.span.end}s)…`);
  await clips.bakeChunk(id);
  const after = (await ref.get()).data();
  if (after.status === 'ready') {
    console.log(`ready — ${after.seconds}s, poster ${after.poster ? 'cut' : 'missing'}`);
    console.log(after.url);
  } else {
    console.error(`bake failed: ${after.bakeError}`); process.exit(1);
  }
  process.exit(0);
})().catch((e) => { console.error('failed:', e.message); process.exit(1); });
