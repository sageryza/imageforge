#!/usr/bin/env node
// witch-coincidences.js — read Sophie's Suspicious coincidence book out of the
// Secretly a Witch app and print it, or print the deck payload for her Compare
// tab. Sophie, 2026-08-31: "go to find all my suspicious coincidences" →
// "i meant from secretly a witch app".
//
// WHERE THE BOOK LIVES. witch.html keeps the Book of Shadows in localStorage and
// mirrors it to membry Firestore `users/{uid}` under a `data` blob, one key per
// localStorage key (WITCH_KEYS). The coincidences are `witch_sync_archive`
// — [{ id, dateISO, ts, slot, url, desc, label }] — plus `witch_coin_done`,
// today's three Home boxes before the midnight rollover files them.
//
// HER BOOK IS SPLIT ACROSS TWO SIGN-INS (measured 2026-08-31), so this reads
// EVERY user doc that carries a witch_sync_archive and merges them. No uid is
// hardcoded: they are personal identifiers and this repo is public.
//
// AN ENTRY'S `id` IS UNIQUE INSIDE ONE ACCOUNT AND NOWHERE ELSE — measured, and
// it is the trap this whole merge is shaped around. The midnight fold stamps
// `coin_<today>_<slot>`, so both sign-ins folding their own three Home boxes on
// 2026-07-25 produced the SAME three ids for SIX different coincidences. Over her
// real book, 3 of 47 ids collide and every collision is two unrelated entries.
// So the id pass is keyed `<uid>|<id>`: deduping by bare id across accounts
// silently deletes real coincidences, and which ones depends only on the order
// Firestore hands back the user docs. (First-wins looked right here purely by
// luck; longest-wins on a bare id lost her caterpillar and her 201 wraps.)
//
// THE SECOND PASS is normalised `desc`, keeping the LONGEST telling — she
// re-writes an entry rather than editing it, so the longer one is the later
// thought. That is what collapses the same entry synced under both sign-ins.
//
// A SECOND TELLING WITH A DIFFERENT ID AND DIFFERENT WORDS IS FLAGGED, NEVER
// MERGED — the house rule for near-variants, and here it is measured rather than
// assumed. Over her real book: the two tellings of the kitten dream, which ARE
// one event, score **0.19**; "Richard is being crazy today" and "Richard and
// Mason both tried Claude today", which are two different coincidences, score
// **0.25**; and her two tellings of the trip gossip share so few words that no
// string measure sees them at all. So there is no threshold that catches the
// real duplicates without eating a real coincidence. `--pairs` reports what it
// can see and `--drop=<n,…>` records the human's call in the command, where it
// can be read back, instead of leaving it to luck.
//
// THE WORDS ON A CARD ARE HERS VERBATIM. `label` is the app's own generated
// title, carried because it is what her Book of Shadows shows — never presented
// as something she wrote.
//
//   node scripts/witch-coincidences.js            # list them
//   node scripts/witch-coincidences.js --pairs    # near-duplicate report
//   node scripts/witch-coincidences.js --deck > page.json
//   curl -X POST https://imageforge-q125.onrender.com/api/chatfeed/page \
//        -H 'content-type: application/json' --data-binary @page.json
//
// A NEW VERSION IS A NEW PAGE, never a re-post of an old id — her verdicts are
// keyed to the sheet name, so rebuilding in place re-points them at different
// cards. Supersede the one it replaces (POST /page/:id/supersede).
//
// Needs STORY_FIREBASE_SERVICE_ACCOUNT (membry-df528). Reads only; costs nothing.

const admin = require('firebase-admin');

const ARGS = process.argv.slice(2);
const DECK = ARGS.includes('--deck');
const PAIRS = ARGS.includes('--pairs');
const CHAT = (ARGS.find((a) => a.startsWith('--chat=')) || '').split('=')[1] || 'suspicious-coincidences';
// 1-based indexes from the plain listing, dropped as second tellings of an entry
// that is already in the list. See THE MERGE above for why this is a hand call.
const DROP = new Set(((ARGS.find((a) => a.startsWith('--drop=')) || '').split('=')[1] || '')
  .split(',').map((n) => parseInt(n, 10)).filter(Boolean));
const SESSION = (ARGS.find((a) => a.startsWith('--session=')) || '').split('=')[1] || '';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function when(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}` : String(iso || '');
}

// Jaccard over the distinctive words — the sync.js lesson: intersection/min
// calls every short entry a duplicate of every long one.
function jaccard(a, b) {
  const A = new Set(norm(a).split(' ').filter((w) => w.length > 3));
  const B = new Set(norm(b).split(' ').filter((w) => w.length > 3));
  if (!A.size || !B.size) return 0;
  let hit = 0; A.forEach((w) => { if (B.has(w)) hit++; });
  return hit / (A.size + B.size - hit);
}

async function main() {
  const raw = process.env.STORY_FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('STORY_FIREBASE_SERVICE_ACCOUNT is not set (membry-df528)');
  const sa = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
  const db = admin.firestore();

  const snap = await db.collection('users').get();
  const all = [];
  let books = 0;
  snap.forEach((doc) => {
    const data = (doc.data() || {}).data || {};
    const arch = data.witch_sync_archive;
    if (!Array.isArray(arch) || !arch.length) return;
    books++;
    arch.forEach((e) => all.push({ ...e, _acct: doc.id }));
    // today's boxes: drawn but not yet rolled over into the archive
    const done = data.witch_coin_done || {};
    Object.keys(done).forEach((k) => {
      const st = done[k]; const url = st && st.v && st.v[st.i];
      if (!st || !st.desc) return;
      all.push({ _acct: doc.id, id: `live_${doc.id}_${k}`, dateISO: data.witch_coin_day || null, ts: Date.now(), desc: st.desc, label: st.label || null, url: url || null });
    });
  });

  const byId = new Map();
  for (const e of all) {
    const k = e.id ? `${e._acct}|${e.id}` : norm(e.desc); if (!k) continue;
    const cur = byId.get(k);
    if (!cur || String(e.desc || '').length > String(cur.desc || '').length) byId.set(k, e);
  }
  const byDesc = new Map();
  for (const e of byId.values()) {
    const k = norm(e.desc); if (!k) continue;
    const cur = byDesc.get(k);
    if (!cur || String(e.desc).length > String(cur.desc).length) byDesc.set(k, e);
  }
  const ordered = [...byDesc.values()].sort(
    (a, b) => String(a.dateISO || '').localeCompare(String(b.dateISO || '')) || (a.ts || 0) - (b.ts || 0)
  );
  const items = ordered.filter((_, i) => !DROP.has(i + 1));
  if (DROP.size) console.error(`dropped ${ordered.length - items.length} as second tellings: ${[...DROP].join(', ')}`);

  if (PAIRS) {
    console.log(`${books} book(s), ${all.length} raw → ${items.length} unique. Near-duplicates left standing:`);
    console.log('(a score here is a HINT, not a verdict — see THE MERGE at the top of this file)');
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const s = jaccard(items[i].desc, items[j].desc);
        if (s >= 0.18) console.log(`  ${s.toFixed(2)}  ${items[i].dateISO} "${String(items[i].desc).slice(0, 60)}"\n         ${items[j].dateISO} "${String(items[j].desc).slice(0, 60)}"`);
      }
    }
    return;
  }

  if (!DECK) {
    console.log(`${books} book(s), ${all.length} raw → ${items.length} unique`);
    items.forEach((e, i) => console.log(`${i + 1}\t${e.dateISO}\t${e.url ? 'drawn' : 'NO PICTURE'}\t${e.label || ''}\n\t${e.desc}`));
    return;
  }

  const cards = items.filter((e) => String(e.desc || '').trim()).map((e) => {
    const label = String(e.label || '').trim();
    const it = { label: label || String(e.desc).slice(0, 60), eyebrow: when(e.dateISO), text: String(e.desc).trim(), aspect: 'square' };
    if (label) it.who = label;
    if (e.url) it.img = e.url;
    return it;
  });
  const first = cards[0] && cards[0].eyebrow, last = cards[cards.length - 1] && cards[cards.length - 1].eyebrow;
  const body = {
    chat: CHAT,
    title: `Your coincidences from Secretly a Witch — ${cards.length}, ${String(first).replace(/,.*/, '')} to ${String(last).replace(/,.*/, '')}`,
    template: 'deck',
    data: {
      items: cards, voice: true, browse: true, aspect: 'square',
      help: "Every coincidence you wrote into the Suspicious coincidence box on the Witch app's Home screen, "
        + 'newest last, with the drawing it made. The words are yours exactly as you typed them; the title above '
        + 'them is the one the app wrote. Two sign-ins had separate books — this is both, merged. '
        + 'Heart the ones worth keeping.',
    },
  };
  if (SESSION) body.session = SESSION;
  console.log(JSON.stringify(body));
}

main().catch((e) => { console.error('failed:', e.message); process.exit(1); });
