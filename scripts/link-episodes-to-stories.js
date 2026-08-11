// link-episodes-to-stories.js — connect the Episode Editor's NDE montage
// episodes to their Story Room stories (Aug 2026, Sophie: "we combined clips
// from interviews and put them together — in the story room they should be
// connected to their stories so I can listen to them when I go to their
// story. It's under the tag NDE.").
//
// The shelf's NDE category holds one story per montage ("NDE · Telepathy",
// "NDE · PROOF", …) and forge-editor holds the episode of the same name; this
// stamps `episodes: [episodeId]` on each story doc (the field the story
// page's listen rows read — see scratchpad.js episodeAudios). The
// "NDE · all the supercuts" story gets EVERY montage, in the montage order
// the docs use, PROOF first.
//
// Idempotent — it writes the exact computed list, so re-running changes
// nothing. Deliberately does NOT bump updatedAt (linking audio is not a
// story edit; the shelf order and the film's freshness stay put).
//
// Usage: node scripts/link-episodes-to-stories.js [--dry-run]
// Needs FIREBASE_SERVICE_ACCOUNT (Deck Factory — both collections live there).

const admin = require('firebase-admin');

const DRY = process.argv.includes('--dry-run');

// The supercuts pad's order: PROOF leads, then the montage order of record
// (the "one episode per montage" list in CLAUDE.md / seed-editor-montages).
const SUPERCUT_ORDER = [
  'PROOF', 'Realer Than Real', 'Telepathy', 'Not My Body', 'The Colors',
  'Universal Knowledge', 'The Music', 'Life Review', 'Welcomed Home',
  'Deceased Loved Ones', 'The Grass',
];

function cred() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) { console.error('FIREBASE_SERVICE_ACCOUNT is not set'); process.exit(1); }
  return admin.credential.cert(JSON.parse(raw));
}

(async () => {
  admin.initializeApp({ credential: cred() });
  const db = admin.firestore();

  const [pads, eps] = await Promise.all([
    db.collection('forge-scratchpad').get(),
    db.collection('forge-editor').get(),
  ]);
  const epByTitle = new Map();
  eps.forEach((d) => epByTitle.set((d.data().title || '').trim().toLowerCase(), d.id));

  let wrote = 0;
  for (const d of pads.docs) {
    const v = d.data() || {};
    if (v.category !== 'nde') continue;
    const title = (v.title || '').trim();
    const name = title.replace(/^NDE\s*·\s*/i, '').trim();

    let ids;
    if (/^all the supercuts$/i.test(name)) {
      ids = SUPERCUT_ORDER
        .map((t) => epByTitle.get(t.toLowerCase()))
        .filter(Boolean);
    } else {
      const id = epByTitle.get(name.toLowerCase());
      ids = id ? [id] : [];
    }

    const cur = Array.isArray(v.episodes) ? v.episodes : [];
    const same = cur.length === ids.length && cur.every((x, i) => x === ids[i]);
    console.log(`${title.padEnd(28)} → ${ids.length ? ids.join(', ') : '(no matching episode)'}${same ? '  (already linked)' : ''}`);
    if (!ids.length || same) continue;
    if (!DRY) {
      await d.ref.set({ episodes: ids }, { merge: true });
      wrote += 1;
    }
  }
  console.log(DRY ? 'dry run — nothing written' : `done — ${wrote} stories linked`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
