const admin = require('firebase-admin');
const fs = require('fs');
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
const db = admin.firestore(); const b = admin.storage().bucket();
const OUT='/tmp/claude-0/-home-user/9a67f47a-9ba4-5529-a3f9-de888e6c3a69/scratchpad/horns';
(async () => {
  for (const id of ['IJZVNv5O6rA','wwQcSKbqfoQ']) {
    const snap = await db.collection('forge-nde-videos').doc(id).get();
    if (!snap.exists) { console.log(id, 'MISSING'); continue; }
    const v = snap.data();
    console.log(id, 'title:', v.title, '| keys:', Object.keys(v).join(','));
    let t = v.transcript || {};
    console.log('  transcript keys:', Object.keys(t).join(','), 'segments:', (t.segments||[]).length, 'storage:', t.storage);
    if (t.storage && !(t.segments||[]).length) {
      const [buf] = await b.file(t.storage).download();
      t = { ...t, ...JSON.parse(buf.toString('utf8')) };
      console.log('  inflated segments:', (t.segments||[]).length, 'words:', (t.words||[]).length);
    }
    fs.writeFileSync(`${OUT}/${id}.json`, JSON.stringify(t));
  }
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
