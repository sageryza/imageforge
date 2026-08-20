// attach-shots-v2.js — writes the locally-shot live-action panels onto the
// v2 movie doc (the pipeline has no set-panel route, and its own renderer
// always attaches a drawn style ref), and points the movie's motion prompt
// wrapper at photography instead of illustration. Run AFTER shoot-v2.js and
// after `VIB_SPEC=spec-v2.json VIB_STATE=state-v2.json drive.js create`.
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const state = JSON.parse(fs.readFileSync(path.join(__dirname, process.env.VIB_STATE || 'state-v2.json'), 'utf8'));
const shots = JSON.parse(fs.readFileSync(path.join(__dirname, 'state-v2-shots.json'), 'utf8'));

const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(svc) });

(async () => {
  const ref = admin.firestore().collection(process.env.MOVIES_COLLECTION || 'forge-movies').doc(state.movieId);
  const doc = (await ref.get()).data();
  if (!doc) throw new Error('movie not found: ' + state.movieId);
  doc.scenes.forEach((s, i) => {
    const shot = shots[i];
    if (!shot?.url) throw new Error('missing shot ' + i);
    s.panel = { url: shot.url, quality: shot.quality, status: 'done', error: null, promptUsed: shot.promptUsed };
  });
  await ref.set({
    scenes: doc.scenes,
    motionStyle: 'The photographic look, faces, wardrobe and lighting are preserved exactly.',
    negativePrompt: 'cartoon, illustration, drawing, blurry, distorted face',
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  console.log(JSON.stringify({ ok: true, movie: state.movieId, panels: doc.scenes.length }));
})().catch(e => { console.error(e.message); process.exit(1); });
