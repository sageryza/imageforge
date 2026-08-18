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
  'LULU_API_KEY', 'LULU_API_SECRET', 'LULU_BASE64', 'LULU_SANDBOX', 'LULU_API_BASE',
  'SHOPIFY_STORE', 'SHOPIFY_ADMIN_TOKEN', 'SHOPIFY_API_VERSION',
  'SHOPIFY_CLIENT_ID', 'SHOPIFY_CLIENT_SECRET',
  'OPENAI_API_KEY', 'REPLICATE_API_TOKEN', 'ANTHROPIC_API_KEY',
  // APNs — the Chats app's push notifications (push.js). The .p8 auth key +
  // its ids; like everything here, Render env wins and Firestore fills gaps.
  'APNS_KEY', 'APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_TOPIC',
  // ElevenLabs — Sophie's cloned/narration voices (Episode Editor narration
  // cards, video voiceovers). Without it narration cards fail the render with
  // a clear job error rather than silently dropping out of the episode.
  'ELEVENLABS_API_KEY',
  'BREVO_API_KEY', 'BREVO_FROM_EMAIL', 'BREVO_FROM_NAME',
  // APIFRAME (Midjourney deck art + Seedance video) — was env-only, which left
  // the live server unconfigured; manage it so the Firestore doc can carry it.
  'APIFRAME_KEY',
  'GOOGLE_DRIVE_CLIENT_ID', 'GOOGLE_DRIVE_CLIENT_SECRET', 'GOOGLE_DRIVE_REDIRECT_URI',
  'YOUTUBE_API_KEY',
  'STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_TRIAL_DAYS',
  // secretlyawitch.com front door: where old store URLs 301 to (default
  // cod-god-inc.myshopify.com) and the site's public origin (default
  // https://secretlyawitch.com). Rarely need setting — they exist so e.g. a
  // future shop.secretlyawitch.com can take over without a code change.
  'WITCH_STORE_ORIGIN', 'WITCH_SITE_ORIGIN',
  // Chat wake-up (chat-wake.js): one switchboard routine per Claude account.
  // The trigger ids are not credentials (an id can't be fired without its
  // token); the tokens are, and only Sophie can mint them (claude.ai routines
  // UI → the routine → API trigger → Generate token).
  'WAKE_TRIGGER_1', 'WAKE_TRIGGER_2', 'WAKE_FIRE_TOKEN_1', 'WAKE_FIRE_TOKEN_2',
];

// The Anthropic key already lives in its OWN Firestore doc (`config/anthropic`,
// field `key`) shared with the sibling repos, so we also read it from there
// instead of forcing a duplicate into config/pipeline. Field name → env name.
// Env vars still win (checked in loadExtraDoc). Same shape as `config/openai`
// etc. that the games app uses.
const EXTRA_DOCS = [
  { path: 'config/anthropic', fields: { key: 'ANTHROPIC_API_KEY' } },
];

// Read one extra Firestore doc and map its fields onto env names (gap-fill only).
async function loadExtraDoc(spec, loaded) {
  try {
    const slash = spec.path.indexOf('/');
    const snap = await admin.firestore().collection(spec.path.slice(0, slash)).doc(spec.path.slice(slash + 1)).get();
    if (!snap.exists) return;
    const data = snap.data() || {};
    for (const [field, envName] of Object.entries(spec.fields)) {
      const val = data[field];
      if (val == null || String(val).length === 0) continue;
      if (process.env[envName]) continue; // env wins
      process.env[envName] = String(val);
      loaded.push(envName);
    }
  } catch (err) {
    console.warn(`config-loader: read of ${spec.path} failed — ${err.message}`);
  }
}

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
  const loaded = [];
  const skipped = [];
  if (snap.exists) {
    const data = snap.data() || {};
    for (const key of MANAGED_KEYS) {
      const val = data[key];
      if (val == null || String(val).length === 0) continue;
      if (process.env[key]) { skipped.push(key); continue; } // env wins
      process.env[key] = String(val);
      loaded.push(key);
    }
  } else {
    console.log(`config-loader: no Firestore doc at ${CONFIG_PATH}`);
  }
  // Pull keys that live in their own sibling-repo docs (e.g. config/anthropic).
  for (const spec of EXTRA_DOCS) await loadExtraDoc(spec, loaded);
  console.log(
    `config-loader: hydrated ${loaded.length} key(s) from ${CONFIG_PATH}` +
    (loaded.length ? ` [${loaded.join(', ')}]` : '') +
    (skipped.length ? ` (env already set: ${skipped.join(', ')})` : '')
  );
  return { source: 'firestore', path: CONFIG_PATH, loaded, skipped };
}

module.exports = { loadConfig, MANAGED_KEYS, CONFIG_PATH };
