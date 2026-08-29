#!/usr/bin/env node
/**
 * find-gallery-uid.js — find the device anonymous-auth uid behind the iOS app's
 * "My Creations" gallery, so `post-to-gallery.js` has a `--uid` / `GALLERY_UID`
 * to write under.
 *
 * WHY THIS EXISTS
 * The gallery reads Firestore `users/{uid}/creations` in project `membry-df528`,
 * keyed to Sophie's device anonymous-auth uid. That uid is a personal
 * identifier, so it is deliberately NOT in this repo — and it CHANGES whenever
 * the app is reinstalled. CLAUDE.md has always documented the way back ("re-find
 * by scanning every user's creations"), but every chat that needed it wrote the
 * scan from scratch. This is that scan, once.
 *
 * WHAT IT DOES — read-only. Walks the `creations` collection group (every user's
 * creations at once), buckets the docs by their parent uid, and prints the uids
 * ranked by most-recent activity. The right one is obvious: the real device has
 * hundreds of creations and a recent timestamp, every other uid is a stray
 * test install with one or two.
 *
 * AUTH — needs the **membry-df528** Firebase Admin service account (NOT in the
 * repo), same as post-to-gallery.js, checked in this order:
 *   STORY_FIREBASE_SERVICE_ACCOUNT='<json>'  (the membry account — preferred), or
 *   FIREBASE_SERVICE_ACCOUNT='<json>'        (fallback / single-key setups), or
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json
 * In the standard two-key setup FIREBASE_SERVICE_ACCOUNT is DECK FACTORY, which
 * is the wrong project for the gallery — hence the preference order above.
 *
 * USAGE
 *   node scripts/find-gallery-uid.js              # top 10 candidates
 *   node scripts/find-gallery-uid.js --top 25     # show more
 *   node scripts/find-gallery-uid.js --scan 3000  # widen the doc scan
 *
 * Then put the winner in the environment as GALLERY_UID (never commit it).
 */

const admin = require('firebase-admin');

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

const TOP = Math.max(1, parseInt(arg('top', '10'), 10) || 10);
// THE SCAN CAP IS A TRAP AT 1000, MEASURED 2026-08-28: the collection-group
// read below is UNORDERED, so the cap takes an arbitrary 1000 docs — and on
// membry that window held the device's uid ZERO times while returning eleven
// strangers with 1-3 creations each. The closing line of this script says
// "the device is the one with many creations", so a chat reading that output
// would have filed her deliverables under a stranger's uid. At 3000 the
// device turned up immediately with 2,984. Default raised, and a truncated
// scan now says so out loud rather than presenting a partial count as a rank.
const SCAN = Math.max(50, parseInt(arg('scan', '5000'), 10) || 5000);

function credentials() {
  const raw =
    process.env.STORY_FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) return admin.credential.cert(JSON.parse(raw));
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return admin.credential.applicationDefault();
  console.error(
    'No service account. Set STORY_FIREBASE_SERVICE_ACCOUNT (membry-df528),\n' +
      'FIREBASE_SERVICE_ACCOUNT, or GOOGLE_APPLICATION_CREDENTIALS.'
  );
  process.exit(1);
}

(async () => {
  admin.initializeApp({ credential: credentials() });
  const projectId = admin.app().options.credential.projectId || '(unknown)';
  if (projectId && projectId !== 'membry-df528') {
    console.warn(
      `WARNING: connected to "${projectId}", but the gallery lives in membry-df528.\n` +
        'Set STORY_FIREBASE_SERVICE_ACCOUNT to the membry account.\n'
    );
  }

  // Collection-group read, unordered on purpose: an orderBy here would need a
  // collection-group index enabled for `createdAt`, and we only need the max
  // per uid, which is cheaper to fold in memory.
  const snap = await admin.firestore().collectionGroup('creations').limit(SCAN).get();

  const byUid = new Map();
  snap.forEach((doc) => {
    const uid = doc.ref.parent.parent && doc.ref.parent.parent.id;
    if (!uid) return;
    const created = doc.data().createdAt;
    const ms = created && typeof created.toMillis === 'function' ? created.toMillis() : 0;
    const cur = byUid.get(uid) || { count: 0, latest: 0 };
    cur.count += 1;
    if (ms > cur.latest) cur.latest = ms;
    byUid.set(uid, cur);
  });

  const rows = [...byUid.entries()].sort((a, b) => b[1].latest - a[1].latest);
  console.log(`project ${projectId} — scanned ${snap.size} creations, ${rows.length} uids\n`);
  if (snap.size >= SCAN) {
    console.log(
      `NOTE: the scan hit its ${SCAN}-doc cap, so these counts are a SAMPLE and the\n` +
        'device may be missing entirely (the read is unordered). Re-run with a\n' +
        `bigger --scan before trusting the ranking.\n`
    );
  }
  if (!rows.length) {
    console.log('No creations found. Wrong project, or the app has never written any.');
    process.exit(0);
  }
  for (const [uid, v] of rows.slice(0, TOP)) {
    const when = v.latest ? new Date(v.latest).toISOString() : 'no timestamp';
    console.log(`${uid}  creations=${String(v.count).padStart(4)}  latest=${when}`);
  }
  console.log('\nThe device is the one with many creations and a recent date.');
  console.log('Set it as GALLERY_UID in the environment (never commit it).');
  process.exit(0);
})().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
