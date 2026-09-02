#!/usr/bin/env node
// COMBINE SEVERAL DECK PAGES INTO ONE, CARRYING HER MARKS (2026-09-02, Sophie:
// "combine dream factory pics").
//
// The same set of pictures ends up split across pages — cut in two batches, or
// posted into two chats so both could see it — and then the Review Queue shows
// three rows of one thing, one of them a duplicate she would have to swipe
// again. This joins them into one page and moves every verdict, note and place
// across, then supersedes the sources.
//
// THE RULES, and each one is why this exists rather than a hand-written merge:
//  - AN ITEM'S ID IS ITS IDENTITY. A page's items keep the ids they were
//    posted with, so the union dedupes by id and a verdict follows its picture
//    with nothing to re-map. Two pages carrying the SAME id must carry the
//    same picture; the script refuses if their urls disagree.
//  - HER MARKS ARE THE POINT. items / texts / at are read off every source
//    verdict doc and unioned. LATER SOURCES WIN a contested id (pass them in
//    the order they were marked, oldest first). An id no longer in the
//    combined deck is dropped and named, never silently carried.
//  - NOTHING IS DESTROYED. The sources are SUPERSEDED, not deleted, and their
//    own verdict docs are left exactly as they are — so undoing this is
//    POST /page/:id/supersede {superseded:false} and nothing else.
//  - DRY BY DEFAULT. --go writes.
//
// Usage:
//   node scripts/combine-decks.js --chat <slug> --title "…" <pageId> <pageId> …
//   node scripts/combine-decks.js --chat … --title … <ids> --go
//
// Needs FIREBASE_SERVICE_ACCOUNT (Deck Factory).

const admin = require('firebase-admin');

const BUCKET = 'deckfactory-43176.firebasestorage.app';
const PAGES = 'forge-chat-pages';
const VERDICTS = 'forge-chat-verdicts';
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';

function args(argv) {
  const out = { ids: [], go: false, chat: '', title: '', keepSources: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--go') out.go = true;
    else if (a === '--keep-sources') out.keepSources = true;
    else if (a === '--chat') { i += 1; out.chat = argv[i] || ''; }
    else if (a === '--title') { i += 1; out.title = argv[i] || ''; }
    else if (!a.startsWith('--')) out.ids.push(a);
  }
  return out;
}

// The union, pure — the half worth testing without a network.
function combineItems(pages) {
  const seen = new Map();
  const items = [];
  const clashes = [];
  for (const p of pages) {
    for (const it of (p.items || [])) {
      const prev = seen.get(it.id);
      if (prev) {
        if ((prev.img || prev.url || '') !== (it.img || it.url || '')) {
          clashes.push({ id: it.id, a: prev.img || prev.url, b: it.img || it.url });
        }
        continue;
      }
      seen.set(it.id, it);
      items.push(it);
    }
  }
  return { items, clashes };
}

// Verdicts union. Sources in order, later wins.
function combineVerdicts(docs, ids) {
  const items = {}; const texts = {}; const dropped = [];
  for (const v of docs) {
    for (const k of Object.keys(v.items || {})) {
      if (ids.has(k)) items[k] = v.items[k]; else dropped.push(k);
    }
    for (const k of Object.keys(v.texts || {})) {
      if (ids.has(k)) texts[k] = v.texts[k];
    }
  }
  return { items, texts, dropped };
}

module.exports = { combineItems, combineVerdicts };

async function main() {
  const o = args(process.argv.slice(2));
  if (!o.chat || !o.title || o.ids.length < 2) {
    console.error('usage: node scripts/combine-decks.js --chat <slug> --title "…" <pageId> <pageId> … [--go]');
    process.exit(1);
  }
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    storageBucket: BUCKET,
  });
  const db = admin.firestore();
  const bkt = admin.storage().bucket();

  const srcs = [];
  for (const id of o.ids) {
    const doc = await db.collection(PAGES).doc(id).get();
    if (!doc.exists) throw new Error(`page ${id} not found`);
    const d = doc.data();
    if (d.template !== 'deck') throw new Error(`page ${id} is not a deck (template ${d.template})`);
    const data = JSON.parse((await bkt.file(d.path).download())[0].toString());
    const vd = await db.collection(VERDICTS).doc(`${d.chat}__page-${id}`).get();
    srcs.push({ id, chat: d.chat, title: d.title, data, verdict: vd.exists ? vd.data() : {} });
    console.log(`source ${id} · ${d.chat} · "${d.title}" · ${(data.items || []).length} items · ${Object.keys((vd.data() || {}).items || {}).length} marks`);
  }

  const { items, clashes } = combineItems(srcs.map((s) => s.data));
  if (clashes.length) {
    console.error('REFUSING — same item id, different picture:');
    for (const c of clashes) console.error(' ', c.id, '\n   ', c.a, '\n   ', c.b);
    process.exit(2);
  }
  const ids = new Set(items.map((i) => i.id));
  const { items: marks, texts, dropped } = combineVerdicts(srcs.map((s) => s.verdict), ids);
  const unmarked = items.filter((i) => !(i.id in marks)).map((i) => i.id);

  // The deck's own flags come from the FIRST source — they are how she asked to
  // read this set (voice notes, browse, pace) and joining must not change them.
  const first = srcs[0].data;
  const data = { items };
  for (const k of ['voice', 'browse', 'pace', 'look', 'states', 'stamp']) {
    if (first[k] !== undefined) data[k] = first[k];
  }

  console.log(`\ncombined: ${items.length} items · ${Object.keys(marks).length} marks · ${Object.keys(texts).length} notes`);
  if (dropped.length) console.log('dropped marks (id not in the combined deck):', dropped.join(', '));
  if (unmarked.length) console.log(`unmarked: ${unmarked.length}${unmarked.length <= 10 ? ' — ' + unmarked.join(', ') : ''}`);
  if (!o.go) { console.log('\nDRY — nothing written. Re-run with --go.'); return; }

  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: o.chat, title: o.title, template: 'deck', data }),
  });
  const posted = await r.json();
  if (!posted.ok) throw new Error('post failed: ' + JSON.stringify(posted));
  console.log('posted', posted.id, posted.sheet);

  const patch = {
    chat: o.chat, sheet: posted.sheet, items: marks,
    updatedAt: new Date().toISOString(),
  };
  if (Object.keys(texts).length) patch.texts = texts;
  await db.collection(VERDICTS).doc(`${o.chat}__${posted.sheet}`).set(patch, { merge: true });
  console.log('verdicts carried');

  // Deliberately NOT deleted: a superseded page keeps its own marks and comes
  // back with one call if the join was wrong.
  if (!o.keepSources) {
    for (const s of srcs) {
      await fetch(`${BASE}/api/chatfeed/page/${s.id}/supersede`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      console.log('superseded', s.id);
    }
  }
  console.log(`\n${BASE}/api/chatfeed/page/${posted.id}?clean=1`);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
