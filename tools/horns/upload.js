// Upload a finished local file to Storage under horns-passages/ and print its url.
const admin = require('firebase-admin');
const path = require('path');
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
const b = admin.storage().bucket();
(async () => {
  for (const f of process.argv.slice(2)) {
    const dest = `horns-passages/${path.basename(f)}`;
    await b.upload(f, { destination: dest, metadata: { contentType: 'audio/mpeg', cacheControl: 'public, max-age=31536000, immutable' } });
    await b.file(dest).makePublic();
    console.log(`https://storage.googleapis.com/${b.name}/${dest}`);
  }
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
