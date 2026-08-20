// attach-shots-v3.js — assembles the v3 movie doc's panels and clips:
// kept scenes copy their panel AND clip straight off the v2 movie doc
// (keepPanel / keepClip = v2 scene index), shot scenes take their photo from
// state-v3-shots.json, and fitSpeed rides onto the scene for the local
// stitch (a morph clip is speed-fitted to its window so it always completes,
// never trimmed mid-transformation). Run AFTER shoot-v3.js and after
// `VIB_SPEC=spec-v3.json VIB_STATE=state-v3.json drive.js create`.
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'spec-v3.json'), 'utf8'));
const state = JSON.parse(fs.readFileSync(path.join(__dirname, 'state-v3.json'), 'utf8'));
const v2state = JSON.parse(fs.readFileSync(path.join(__dirname, 'state-v2.json'), 'utf8'));
const shots = JSON.parse(fs.readFileSync(path.join(__dirname, 'state-v3-shots.json'), 'utf8'));

const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(svc) });

(async () => {
  const col = admin.firestore().collection(process.env.MOVIES_COLLECTION || 'forge-movies');
  const v2 = (await col.doc(v2state.movieId).get()).data();
  const ref = col.doc(state.movieId);
  const doc = (await ref.get()).data();
  if (!v2 || !doc) throw new Error('movie doc missing');

  doc.scenes.forEach((s, i) => {
    const sp = spec.scenes[i];
    if (typeof sp.keepPanel === 'number') {
      const src = v2.scenes[sp.keepPanel];
      s.panel = { url: src.panel.url, quality: src.panel.quality, status: 'done', error: null, promptUsed: src.panel.promptUsed };
      if (typeof sp.keepClip === 'number' && v2.scenes[sp.keepClip].clip?.url) {
        const c = v2.scenes[sp.keepClip].clip;
        s.clip = { url: c.url, tier: c.tier, status: 'done', error: null, frames: c.frames || null, cost: 0, promptUsed: c.promptUsed };
      }
    } else if (sp.shoot) {
      const shot = shots[i];
      if (!shot?.url) throw new Error('missing v3 shot ' + i);
      s.panel = { url: shot.url, quality: shot.quality, status: 'done', error: null, promptUsed: shot.promptUsed };
    } else {
      throw new Error(`scene ${i} has neither keepPanel nor shoot`);
    }
    if (sp.fitSpeed) s.fitSpeed = true;
  });

  await ref.set({
    scenes: doc.scenes,
    motionStyle: 'The photographic look, faces, wardrobe and lighting are preserved exactly.',
    negativePrompt: 'cartoon, illustration, drawing, blurry, distorted face',
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  const panels = doc.scenes.filter(s => s.panel?.url).length;
  const clips = doc.scenes.filter(s => s.clip?.url).length;
  console.log(JSON.stringify({ ok: true, movie: state.movieId, panels, clipsKept: clips }));
})().catch(e => { console.error(e.message); process.exit(1); });
