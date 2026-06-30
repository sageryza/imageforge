// config-loader.js — hydrate pipeline API keys from a Firestore document.
//
// ImageForge already connects to Firebase (for image Storage), so we can keep
// all the pipeline secrets in ONE Firestore doc instead of setting each one as
// a host env var. At boot, loadConfig() reads that doc and copies any keys it
// finds into process.env — but only for keys NOT already set. So the precedence
// is: host env var WINS over Firestore. That means you can keep using Render env
// vars, move everything to Firestore, or mix — whatever's already in the
// environment is never overwritten.
//
// This mirrors how the sibling repo (memory-library-react) stores keys in
// locked-down Firestore `config/*` docs. It no-ops gracefully when Firebase
// isn't initialized or the doc doesn't exist, so nothing breaks without it.
//
// The doc defaults to `config/pipeline`; override with PIPELINE_CONFIG_DOC
// (e.g. "config/imageforge"). Fields are plain string values keyed by env name:
//   config/pipeline = {
//     ETSY_API_KEY: "…", ETSY_SHARED_SECRET: "…",
//     PRINTIFY_API_KEY: "…", PRINTFUL_API_KEY: "…",
//     LULU_API_KEY: "…", LULU_API_SECRET: "…"
//   }

const admin = require('firebase-admin');

// Document holding the keys, as "<collection>/<docId>".
const CONFIG_PATH = process.env.PIPELINE_CONFIG_DOC || 'config/pipeline';

// Env names we're willing to hydrate from Firestore. (Anything else in the doc
// is ignored — this is the allow-list.)
const MANAGED_KEYS = [
  'ETSY_API_KEY', 'ETSY_SHARED_SECRET', 'ETSY_REDIRECT_URI',
  'PRINTIFY_API_KEY', 'PRINTIFY_SHOP_ID',
  'PRINTFUL_API_KEY', 'PRINTFUL_STORE_ID',
  'LULU_API_KEY', 'LULU_API_SECRET', 'LULU_SANDBOX', 'LULU_API_BASE',
  'OPENAI_API_KEY', 'REPLICATE_API_TOKEN',
];

// Read the Firestore config doc and populate process.env for any managed key
// that isn't already set. Returns a small summary for logging. Never throws —
// on any problem it falls back to "env vars only".
async function loadConfig() {
  if (!admin.apps.length) {
    console.log('config-loader: Firebase not initialized — using host env vars only');
    return { source: 'env', loaded: [] };
  }
  let snap;
  try {
    const slash = CONFIG_PATH.indexOf('/');
    const col = CONFIG_PATH.slice(0, slash);
    const docId = CONFIG_PATH.slice(slash + 1);
    snap = await admin.firestore().collection(col).doc(docId).get();
  } catch (err) {
    console.warn(`config-loader: Firestore read of ${CONFIG_PATH} failed — ${err.message}. Using env vars only.`);
    return { source: 'env', loaded: [], error: err.message };
  }
  if (!snap.exists) {
    console.log(`config-loader: no Firestore doc at ${CONFIG_PATH} — using host env vars only`);
    return { source: 'env', loaded: [] };
  }
  const data = snap.data() || {};
  const loaded = [];
  const skipped = [];
  for (const key of MANAGED_KEYS) {
    const val = data[key];
    if (val == null || String(val).length === 0) continue;
    if (process.env[key]) { skipped.push(key); continue; } // env wins
    process.env[key] = String(val);
    loaded.push(key);
  }
  console.log(
    `config-loader: hydrated ${loaded.length} key(s) from ${CONFIG_PATH}` +
    (loaded.length ? ` [${loaded.join(', ')}]` : '') +
    (skipped.length ? ` (env already set: ${skipped.join(', ')})` : '')
  );
  return { source: 'firestore', path: CONFIG_PATH, loaded, skipped };
}

module.exports = { loadConfig, MANAGED_KEYS, CONFIG_PATH };
