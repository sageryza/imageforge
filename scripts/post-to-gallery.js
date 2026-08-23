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
 * AUTH — needs the **membry-df528** Firebase Admin service account (NOT in the
 * repo). Provide it one of these ways (checked in order):
 *   STORY_FIREBASE_SERVICE_ACCOUNT='<json>'  (the membry account — preferred;
 *                                             same name server.js uses for it), or
 *   FIREBASE_SERVICE_ACCOUNT='<json>'         (fallback / older single-key setups), or
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json
 * NOTE: the gallery lives in membry-df528, but FIREBASE_SERVICE_ACCOUNT is the
 * DECK FACTORY (deckfactory-43176) account in the standard two-key setup — so
 * this script prefers STORY_FIREBASE_SERVICE_ACCOUNT to hit the right project.
 *
 * IMAGES MUST BE AT A PUBLIC URL the app can fetch. Firebase Storage in either
 * project works (make the object public). Temporary Replicate/OpenAI URLs
 * expire — upload to Storage first. Pass `--file ./local.png` and this script
 * uploads it to membry Storage (`claude-deliveries/`), makes it public, and
 * uses that URL — so a chat can generate → post in ONE command, no separate
 * upload step. (`--url` still works for an already-hosted image.)
 *
 * TARGET UID — the gallery is keyed to Sophie's device anonymous-auth uid. It is
 * a personal identifier, so it is NOT stored in this repo. Provide it per-run
 * via `--uid` or the `GALLERY_UID` env var (set in Render / a local .env, never
 * committed). If she reinstalls the app the uid changes — re-find it by listing
 * every user's creations (collectionGroup) and picking the device with recent,
 * real activity.
 *
 * USAGE
 *   # one-command: upload a local image AND post it
 *   GALLERY_UID=<deviceUid> node scripts/post-to-gallery.js \
 *     --file ./image.png --prompt "Kitchen Witchery — hero image" \
 *     [--type image] [--style "Lavender Witch"] [--uid <deviceUid>] [--source claude]
 *     [--model gpt-image-2] [--quality medium]
 *   # or post an already-hosted URL
 *   GALLERY_UID=<deviceUid> node scripts/post-to-gallery.js --url https://…/image.png --prompt "…"
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

// The gallery is in membry-df528; prefer the membry account
// (STORY_FIREBASE_SERVICE_ACCOUNT), falling back to FIREBASE_SERVICE_ACCOUNT.
function membryRaw() {
  return process.env.STORY_FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
}
function projectId() {
  const raw = membryRaw();
  if (raw) { try { return JSON.parse(raw).project_id; } catch {} }
  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')).project_id; } catch {} }
  return process.env.GOOGLE_CLOUD_PROJECT || null;
}

function initAdmin() {
  if (admin.apps.length) return;
  const pid = projectId();
  const opts = pid ? { storageBucket: `${pid}.firebasestorage.app` } : {};
  const raw = membryRaw();
  if (raw) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)), ...opts });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault(), ...opts });
  } else {
    console.error('No credentials: set STORY_FIREBASE_SERVICE_ACCOUNT (the membry account), FIREBASE_SERVICE_ACCOUNT, or GOOGLE_APPLICATION_CREDENTIALS.');
    process.exit(1);
  }
}

// Upload a local file to membry Storage under claude-deliveries/, make it
// public, and return its URL. Lets `--file` be a one-step generate→post.
async function uploadFile(file, createdMs) {
  const bucket = admin.storage().bucket();
  const ext = path.extname(file) || '.png';
  const dest = `claude-deliveries/${createdMs}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const contentType = ext === '.webp' ? 'image/webp' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  await bucket.upload(file, { destination: dest, metadata: { contentType } });
  await bucket.file(dest).makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${dest}`;
}

async function main() {
  const prompt = arg('prompt', '');
  const file = arg('file');
  let url = arg('url');
  if (!url && !file) { console.error('Missing --url or --file'); process.exit(1); }

  const type = arg('type', 'image');
  const style = arg('style');
  // Opening a creation shows MODEL · QUALITY at the top of its caption, read
  // from these two fields (CLAUDE.md); `style` is only the legacy single-label
  // fallback for docs written before they existed. Without a way to pass them
  // here, everything filed by a chat landed with the fallback or nothing.
  const model = arg('model');
  const quality = arg('quality');
  // THE THIRD SLOT (Aug 2026, Sophie: "1K 2K 4K should be a third slot in the
  // model/quality required tagging"). gpt-image-2 draws any canvas, so a
  // caption without it no longer says what the picture is. Nothing derives it,
  // and like the other two it can never be recovered later by a chat that did
  // not make the image.
  // Pass the real canvas ("1568x2352") — the TIER is what the caption shows
  // ("2K", her correction: "i asked for it to say 1k 2k or 4k") and the canvas
  // is kept beside it, because 2K portrait and 2K square are different
  // canvases at different prices. A tier passed directly is taken as given.
  const canvas = arg('size');
  const size = require('../size-tier').captionSize(canvas);
  const uid = arg('uid', process.env.GALLERY_UID);
  if (!uid) { console.error('Missing gallery uid: pass --uid or set GALLERY_UID.'); process.exit(1); }
  const source = arg('source', 'claude');
  const createdMs = Number(arg('created', String(Date.now())));

  initAdmin();
  if (file) url = await uploadFile(file, createdMs);
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
  if (model) doc.model = model;
  if (quality) doc.quality = quality;
  if (size) doc.size = size;
  if (canvas && canvas !== size) doc.canvas = canvas;

  const ref = await db.collection('users').doc(uid).collection('creations').add(doc);
  console.log(`gallery doc ${ref.id} → users/${uid}/creations  @ ${new Date(createdMs).toISOString()}`);
  process.exit(0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
