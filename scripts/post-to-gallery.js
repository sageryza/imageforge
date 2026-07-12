#!/usr/bin/env node
/**
 * post-to-gallery.js — drop a finished deliverable into the iOS app's
 * "My Creations" gallery (the grid in CreationsView).
 *
 * WHY THIS EXISTS
 * The in-app gallery reads Firestore `users/{uid}/creations` in project
 * `membry-df528`, ordered by `createdAt` DESC. Those docs are normally written
 * by the app's own Cloud Functions under the device's anonymous-auth uid — so
 * an image made OUTSIDE the app (e.g. by Claude in a chat, via the web
 * generator, or any pipeline) never shows up there on its own. This script
 * writes the creation doc directly with the Admin SDK so any deliverable lands
 * in the gallery.
 *
 * CHRONOLOGY ACROSS CHATS
 * Several chats may post at once. Always order by real make-time: pass
 * `--created <ms>` with the moment the image was actually generated (defaults
 * to now). The app sorts by `createdAt`, so accurate timestamps interleave
 * everyone's work correctly. Do NOT backfill an old/skewed server clock if you
 * want a fresh batch to sit at the top — use the true generation time.
 *
 * AUTH — needs the membry-df528 Firebase Admin service account (NOT in the
 * repo). Provide it one of two ways:
 *   FIREBASE_SERVICE_ACCOUNT='<json>'   (same env var server.js uses), or
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json
 *
 * IMAGES MUST BE AT A PUBLIC URL the app can fetch. Firebase Storage in either
 * project works (make the object public). Temporary Replicate/OpenAI URLs
 * expire — upload to Storage first.
 *
 * TARGET UID — the gallery is keyed to Sophie's device anonymous-auth uid. It is
 * a personal identifier, so it is NOT stored in this repo. Provide it per-run
 * via `--uid` or the `GALLERY_UID` env var (set in Render / a local .env, never
 * committed). If she reinstalls the app the uid changes — re-find it by listing
 * every user's creations (collectionGroup) and picking the device with recent,
 * real activity.
 *
 * USAGE
 *   GALLERY_UID=<deviceUid> node scripts/post-to-gallery.js \
 *     --url https://…/image.png \
 *     --prompt "Kitchen Witchery — hero image (watercolor)" \
 *     [--type image] [--style "Watercolor Drawings"] \
 *     [--uid <deviceUid>] [--created 1783823417742] [--source claude]
 */
const admin = require('firebase-admin');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    const sa = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  } else {
    console.error('No credentials: set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS.');
    process.exit(1);
  }
}

async function main() {
  const url = arg('url');
  const prompt = arg('prompt', '');
  if (!url) { console.error('Missing --url'); process.exit(1); }

  const type = arg('type', 'image');
  const style = arg('style');
  const uid = arg('uid', process.env.GALLERY_UID);
  if (!uid) { console.error('Missing gallery uid: pass --uid or set GALLERY_UID.'); process.exit(1); }
  const source = arg('source', 'claude');
  const createdMs = Number(arg('created', String(Date.now())));

  initAdmin();
  const db = admin.firestore();
  const doc = {
    type,
    url,
    prompt,
    stickers: null,
    createdAt: admin.firestore.Timestamp.fromMillis(createdMs),
    source,
  };
  if (style) doc.style = style;

  const ref = await db.collection('users').doc(uid).collection('creations').add(doc);
  console.log(`gallery doc ${ref.id} → users/${uid}/creations  @ ${new Date(createdMs).toISOString()}`);
  process.exit(0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
