#!/usr/bin/env node
// Sync the story-board projects (images + structure) to Firebase so the iOS
// app and /api/story can read them. Idempotent: images are content-addressed
// by filename, docs are overwritten wholesale.
//
//   FIREBASE_SERVICE_ACCOUNT=... node scripts/sync-story.js manifest.json
//   (or FIREBASE_KEY_FILE=/path/to/key.json)
//
// The manifest is JSON: [{ id, title, order, beats: [{ vo, cards: [{ label,
// status, file }] }] }] with `file` paths relative to the manifest. Written
// docs live in the `forge-story` collection, one doc per project, each beat
// card getting a public Storage URL in place of its local file path.
//
// Story docs can also carry fields Sophie sets herself in the Story Room —
// `text` (the prose), `voiceover` ({url,text}), `summary` (the key-moments
// strip), `inbox`, `archived`. A sync
// PRESERVES those unless the manifest explicitly provides them, so a board
// re-sync never wipes her story or voiceover. (The manifest may include
// `text`/`voiceover` too, e.g. when a chat builds a whole story.)
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

async function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath) throw new Error('usage: sync-story.js <manifest.json>');
  const svc = process.env.FIREBASE_KEY_FILE
    ? JSON.parse(fs.readFileSync(process.env.FIREBASE_KEY_FILE, 'utf8'))
    : JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (!svc.project_id) throw new Error('no Firebase credentials');
  admin.initializeApp({
    credential: admin.credential.cert(svc),
    storageBucket: `${svc.project_id}.firebasestorage.app`,
  });
  const bucket = admin.storage().bucket();
  const db = admin.firestore();

  const base = path.dirname(path.resolve(manifestPath));
  const projects = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const uploaded = {}; // local file -> public URL

  async function upload(file) {
    if (uploaded[file]) return uploaded[file];
    const abs = path.resolve(base, file);
    const ext = path.extname(abs).slice(1) || 'png';
    const name = `story/${path.basename(abs, path.extname(abs))}.${ext}`;
    const f = bucket.file(name);
    await f.save(fs.readFileSync(abs), {
      metadata: { contentType: ext === 'jpg' ? 'image/jpeg' : `image/${ext}` },
    });
    await f.makePublic();
    uploaded[file] = `https://storage.googleapis.com/${bucket.name}/${name}`;
    console.log('uploaded', name);
    return uploaded[file];
  }

  for (const p of projects) {
    if (p.cover_file) {
      p.cover = await upload(p.cover_file);
      delete p.cover_file;
    }
    for (const beat of p.beats) {
      for (const card of beat.cards) {
        if (card.file) {
          card.url = await upload(card.file);
          delete card.file;
        }
      }
    }
    // Carry over the Story Room's own fields when the manifest doesn't set them.
    const prev = (await db.collection('forge-story').doc(p.id).get()).data() || {};
    for (const keep of ['text', 'description', 'descriptionAudio', 'voiceover', 'summary', 'inbox', 'archived', 'createdAt']) {
      if (p[keep] === undefined && prev[keep] !== undefined) p[keep] = prev[keep];
    }
    await db.collection('forge-story').doc(p.id).set({
      ...p,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('wrote project', p.id, `(${p.beats.length} beats)`);
  }
  console.log('done:', Object.keys(uploaded).length, 'images,', projects.length, 'projects');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
