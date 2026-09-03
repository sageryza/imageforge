#!/usr/bin/env node
// FILE EVERY HEARTED TRIANGLE CARD INTO ONE ASSETS TAB. Sophie, 2026-09-03,
// asked for the gather in two places — "i[n] ur assets tab and 1 up tinder
// quick toggle w good/bad" — so this is the tab half of the deck's own set.
//
// It uses THE SAME gather as scripts/triangle-hearts-deck.js
// (scripts/lib/triangle-hearts.js), so the tab and the deck can never disagree
// about what the set is, and both mark the same url — a ♥ in either shows in
// the other, and on a pool card it moves the card in and out of the Similitude
// deal.
//
// THE FULL HOUSE RITUAL, and nothing is invented (the deliver-images rules):
//   • a real LABEL — the card's own title / the words that drew it, never a slug
//   • the MODEL · QUALITY · SIZE caption, with SIZE as the TIER (1K/2K/4K),
//     derived by size-tier.js from what the record really carries. An ABSENT
//     slot is left out rather than guessed; measured 2026-09-03, all 166 of
//     these carry all three, so nothing files short.
//   • both halves of the EXACT prompt, character for character, as they were
//     sent — never a paraphrase and never a reconstruction.
// Nothing is generated: this is three POSTs per picture and no model call.
//
// Dry by default. `--go` files. Needs FIREBASE_SERVICE_ACCOUNT (Deck Factory).
//   node scripts/triangle-hearts-file.js --chat <slug> [--go]
'use strict';
const admin = require('firebase-admin');
const { gather, captionOf } = require('./lib/triangle-hearts.js');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const go = args.includes('--go');
const CHAT = flag('--chat', 'triangle-cards-tinder-toggle');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });

const post = (path, body) => fetch(BASE + path, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}).then((r) => r.json().catch(() => ({ ok: false, status: r.status })));

// FIVE AT A TIME, not 166 at once — the box is 512MB and each filing reads the
// Storage object's md5 for the Assets tab's own union.
async function pool(list, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < list.length) { const k = i; i += 1; out[k] = await fn(list[k]); }
  }));
  return out;
}

(async () => {
  const { items, stats } = await gather({ db: admin.firestore(), bucket: admin.storage().bucket() });
  console.log(`${items.length} hearted triangle cards — ${JSON.stringify(stats.kinds)} — ${stats.inDeal} in the Similitude deal`);
  const caps = {}; items.forEach((i) => { const c = captionOf(i) || '(none)'; caps[c] = (caps[c] || 0) + 1; });
  console.log('captions:', JSON.stringify(caps));
  const short = items.filter((i) => !i.label || !captionOf(i) || !i.promptContent);
  console.log(`filing short of the ritual: ${short.length}`);
  console.log(items.slice(0, 3).map((i) => `  ${captionOf(i)} | ${i.label.slice(0, 60)}`).join('\n'));

  if (!go) { console.log(`(dry — would file ${items.length} into "${CHAT}"; add --go)`); return; }

  const filed = await pool(items, 5, (it) => post('/api/gallery', {
    assetsOnly: true, chat: CHAT, url: it.url,
    description: it.label, prompt: captionOf(it),
  }).catch((e) => ({ ok: false, err: String(e) })));
  console.log('filed ok:', filed.filter((r) => r && r.ok).length, 'of', items.length);
  const bad = filed.map((r, i) => (r && r.ok ? null : `${items[i].url} → ${JSON.stringify(r)}`)).filter(Boolean);
  if (bad.length) console.log('failed:\n ' + bad.slice(0, 8).join('\n '));

  // the prompt halves ride in batches of 40 — one call per batch, per-item ok back
  const withPrompt = items.filter((i) => i.promptContent || i.promptStyle);
  for (let i = 0; i < withPrompt.length; i += 40) {
    const chunk = withPrompt.slice(i, i + 40);
    const r = await post('/api/gallery/assets/prompt', {
      chat: CHAT,
      items: chunk.map((it) => ({ url: it.url, style: it.promptStyle, content: it.promptContent })),
    });
    // the route answers `results`, not `items` — reading the wrong key made
    // a batch that fully succeeded print "0 ok"
    const okn = (r.results || []).filter((x) => x && x.ok).length;
    console.log(`prompts ${i + 1}-${i + chunk.length}: ${okn} ok${r.error ? ' — ' + r.error : ''}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
