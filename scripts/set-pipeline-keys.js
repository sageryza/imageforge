// set-pipeline-keys.js — write the pipeline API keys into the Firestore config
// doc the server reads at boot (config/pipeline by default).
//
// Run this ONCE from any machine that has the Firebase service account AND the
// key values in its environment (your laptop, or a Render shell). It reads each
// managed key from process.env and writes the ones that are set into Firestore
// with a merge, so you can run it repeatedly to add/update keys.
//
// Usage:
//   export FIREBASE_SERVICE_ACCOUNT='<single-line service account JSON>'
//   export ETSY_API_KEY=…  ETSY_SHARED_SECRET=…  PRINTIFY_API_KEY=…  (etc.)
//   node scripts/set-pipeline-keys.js
//
// Override the target doc with PIPELINE_CONFIG_DOC (default "config/pipeline").
// Nothing is printed except key NAMES — secret values are never logged.

const admin = require('firebase-admin');
const { MANAGED_KEYS, CONFIG_PATH } = require('../config-loader');

function die(msg) { console.error(msg); process.exit(1); }

let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
} catch (e) {
  die('FIREBASE_SERVICE_ACCOUNT is not valid JSON.');
}
if (!serviceAccount.project_id) {
  die('FIREBASE_SERVICE_ACCOUNT not set (or missing project_id). Set it and retry.');
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// Collect the managed keys that are present in the environment.
const payload = {};
const present = [];
for (const key of MANAGED_KEYS) {
  if (process.env[key]) { payload[key] = String(process.env[key]); present.push(key); }
}
if (!present.length) {
  die('No managed keys found in the environment. Set e.g. ETSY_API_KEY and retry.\nManaged keys: ' + MANAGED_KEYS.join(', '));
}

const slash = CONFIG_PATH.indexOf('/');
const col = CONFIG_PATH.slice(0, slash);
const docId = CONFIG_PATH.slice(slash + 1);

admin.firestore().collection(col).doc(docId).set(payload, { merge: true })
  .then(() => {
    console.log(`Wrote ${present.length} key(s) to ${CONFIG_PATH}: ${present.join(', ')}`);
    console.log('Done. Redeploy / restart the server to pick them up.');
    process.exit(0);
  })
  .catch(err => die('Firestore write failed: ' + err.message));
