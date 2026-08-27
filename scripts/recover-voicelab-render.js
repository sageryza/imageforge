#!/usr/bin/env node
// PULL A KILLED VOICE STUDIO RENDER BACK OUT OF THE ELEVENLABS HISTORY.
//
// The server sweeps stuck renders by itself ten minutes after the kill; this
// is the hand crank, for a take that was already sitting there before the
// sweep existed and for checking a match before anything is written.
//
// It calls voicelab.js's OWN recoverRender — the same code the sweep runs — so
// a take repaired from here and a take repaired by the server are repaired
// identically. It costs nothing: the audio was paid for when it was generated.
//
//   node scripts/recover-voicelab-render.js            # every stuck take, DRY
//   node scripts/recover-voicelab-render.js --go       # write them
//   node scripts/recover-voicelab-render.js vlab12… --go
//
// Needs FIREBASE_SERVICE_ACCOUNT (deckfactory) and ELEVENLABS_API_KEY.
const admin = require('firebase-admin');

const go = process.argv.includes('--go');
const ids = process.argv.slice(2).filter((a) => /^vl[a-f0-9]{12}$/.test(a));

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) { console.error('FIREBASE_SERVICE_ACCOUNT is not set'); process.exit(1); }
if (!process.env.ELEVENLABS_API_KEY) { console.error('ELEVENLABS_API_KEY is not set'); process.exit(1); }
const sa = JSON.parse(raw);
admin.initializeApp({
  credential: admin.credential.cert(sa),
  storageBucket: `${sa.project_id}.firebasestorage.app`,
});

const { recoverRender } = require('../voicelab');

(async () => {
  let targets = ids;
  if (!targets.length) {
    const snap = await admin.firestore().collection('forge-voicelab')
      .orderBy('createdAt', 'desc').limit(120).get();
    targets = snap.docs.map((d) => d.data())
      .filter((r) => r.status === 'rendering' || (r.status === 'failed' && !r.url))
      .map((r) => r.id);
  }
  if (!targets.length) { console.log('nothing waiting to be recovered'); process.exit(0); }
  console.log(`${targets.length} take(s)${go ? '' : ' — DRY, nothing will be written'}\n`);
  for (const id of targets) {
    try {
      const out = await recoverRender(id, { dry: !go, force: true });
      console.log(id, JSON.stringify(out));
    } catch (e) {
      console.log(id, 'ERROR', e.message);
    }
  }
  process.exit(0);
})();
