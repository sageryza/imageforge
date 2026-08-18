// Delete the rejected evan-charlie voice-clone leftovers from Storage.
// Sophie's call, relayed through the handoff doc: the clone was rejected and
// deleted ("it doesn't sound like me"); she asked this chat to settle the
// leftovers question. Everything under voice-clones/evan-charlie/ is a test
// render or the derived training sample — all reproducible from the source
// memo (safe in the memo library) plus the repo's prep script, and the
// why-it-failed record lives in docs/voice-cloning.md.
const admin = require('firebase-admin');
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const app = admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: sa.project_id + '.firebasestorage.app' });
app.storage().bucket().getFiles({ prefix: 'voice-clones/evan-charlie/' }).then(async ([files]) => {
  for (const f of files) { await f.delete(); console.log('deleted', f.name); }
  const [check] = await app.storage().bucket().getFiles({ prefix: 'voice-clones/evan-charlie/' });
  console.log('remaining:', check.length);
  process.exit(0);
}).catch((e) => { console.error(e.message); process.exit(1); });
