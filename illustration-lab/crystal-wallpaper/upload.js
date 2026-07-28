#!/usr/bin/env node
/**
 * Upload the wallpaper tiles/proofs to Firebase Storage and print public
 * URLs, so the pattern can be viewed tiled in the Chats app rather than
 * only as flat images. Uses the Deck Factory service account, same as
 * server.js.
 *
 *   node upload.js out/v1-full-spectrum-tile.png [...]
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(sa),
  storageBucket: `${sa.project_id}.firebasestorage.app`,
});
const bucket = admin.storage().bucket();

(async () => {
  for (const file of process.argv.slice(2)) {
    const dest = `crystal-wallpaper/${path.basename(file)}`;
    await bucket.upload(file, { destination: dest, metadata: { contentType: 'image/png' } });
    await bucket.file(dest).makePublic();
    console.log(`${path.basename(file)}\thttps://storage.googleapis.com/${bucket.name}/${dest}`);
  }
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
