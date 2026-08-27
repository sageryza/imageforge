#!/usr/bin/env node
// Upload the rendered reel, stamp it onto the pad as its film (the pad's own
// record shape), and pin it in the chat.
// Usage: node docs/science-reel/finish-film.js /tmp/science-reel/science-reel.mp4
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const admin = require('firebase-admin');
const ffmpeg = require('ffmpeg-static');

const HERE = __dirname;
const file = process.argv[2];
const pad = JSON.parse(fs.readFileSync(path.join(HERE, 'pad.json'), 'utf8')).pad;
const CHAT = 'science-memo-animated-reel';
const SESSION = '018u3dNQQpj5QquLBEAZGXNZ';
const DECK_SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const app = admin.initializeApp({ credential: admin.credential.cert(DECK_SA), storageBucket: 'deckfactory-43176.firebasestorage.app' });

(async () => {
  const dest = `scratchpad/films/${pad}-${Date.now()}.mp4`;
  const bucket = app.storage().bucket();
  await bucket.upload(file, { destination: dest, metadata: { contentType: 'video/mp4' } });
  await bucket.file(dest).makePublic();
  const url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
  let seconds = 0;
  try {
    const out = execFileSync(ffmpeg, ['-i', file], { stdio: 'pipe' });
  } catch (e) {
    const m = String(e.stderr).match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
    if (m) seconds = Math.round(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
  }
  await app.firestore().collection('forge-scratchpad').doc(pad).set({
    film: { status: 'done', url, seconds, at: Date.now(), pictures: 28, notes: 0, style: 'dreamy' },
    updatedAt: Date.now(),
  }, { merge: true });
  console.log('film stamped on pad:', url, seconds + 's');
  const mm = Math.floor(seconds / 60), ss = String(seconds % 60).padStart(2, '0');
  const pin = await fetch('https://imageforge-q125.onrender.com/api/chatfeed/pin', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, session: SESSION, url, title: `Science & Belief — the reel v1 (${mm}:${ss})`, kind: 'film' }),
  });
  console.log('pin:', await pin.text());
})().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
