#!/usr/bin/env node
// EVERY triangle card Sophie has hearted, ANYWHERE, as ONE 1-up swipe deck.
// Sophie, 2026-09-03: "gather all the triangle cards i've hearted everywhere
// … and 1 up tinder quick toggle w good/bad · be thorough".
//
// The gather itself — the three heart doors, the evidence rule and the url
// join — is scripts/lib/triangle-hearts.js, shared with the Assets-tab filer
// so the deck and the tab can never disagree about what the set is. Read that
// file's header for why nothing here is guessed.
//
// Dry by default (prints the counts and the first items). `--go` posts the
// page. Needs FIREBASE_SERVICE_ACCOUNT (Deck Factory).
//   node scripts/triangle-hearts-deck.js --chat <slug> [--go] [--title "…"]
'use strict';
const admin = require('firebase-admin');
const { gather } = require('./lib/triangle-hearts.js');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const go = args.includes('--go');
const CHAT = flag('--chat', 'triangle-cards-tinder-toggle');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });

// THE HOUSE DISPLAY-COPY RULE — a card FACE is a derived thumb, never the
// original. Measured 2026-09-03: a Playground triangle card is a ~1.0MB
// lossless webp and its 900px thumb is ~82KB, and a pool cut goes 142KB →
// 61KB. The thumb comes back VP8X, so the cut's transparency outside the
// triangle survives — checked, not assumed. `full` and `url` stay the
// ORIGINALS: the lightbox opens the real picture and her ♥ lands on the real
// identity.
const thumb = (u) => `${BASE}/api/story/thumb?w=900&url=${encodeURIComponent(u)}`;

const WHY = { asset: 'assets', verdict: 'compare page', run: 'playground' };

(async () => {
  const { items, stats } = await gather({ db: admin.firestore(), bucket: admin.storage().bucket() });

  const deck = items.map((c) => {
    const where = c.kind === 'pool'
      ? (c.inDeal ? 'in the similitude deck' : (c.hidden ? 'not dealt' : 'pool card'))
      : (c.kind === 'playground' ? 'playground' : `assets · ${c.chat || ''}`);
    const it = {
      id: c.id.slice(0, 60),
      label: c.label || '',
      img: thumb(c.img),
      full: c.img,
      url: c.url,
      eyebrow: `${where} · ♥ ${c.why.map((w) => WHY[w] || w).join(', ')}`.toUpperCase().slice(0, 200),
    };
    for (const k of ['model', 'quality', 'promptContent', 'promptStyle']) if (c[k]) it[k] = c[k];
    return it;
  });

  console.log(`pages read ${stats.pagesRead} (missing ${stats.pagesMissing})`);
  console.log(`heart marks by door: ${JSON.stringify(stats.doors)}`);
  console.log(`${deck.length} distinct hearted triangle cards — ${JSON.stringify(stats.kinds)} — ${stats.inDeal} in the Similitude deal`);
  console.log(deck.slice(0, 5).map((d) => `  ${d.eyebrow} | ${d.label.slice(0, 60)}`).join('\n'));

  const body = {
    chat: CHAT,
    title: flag('--title', `Every triangle card you've hearted (${deck.length})`),
    template: 'deck',
    data: {
      items: deck, aspect: 'square', browse: true, pace: 'quick', voice: true,
      help: 'Every triangle card you have hearted anywhere — the Assets tab, Meta Assets, '
        + 'a Compare page, or the Playground — joined so one card appears once, newest first. '
        + 'Tap the left or right edge (or swipe) to move; ♥ or ✕ moves you on by itself. '
        + 'The small line on each card says where it lives and where the heart came from. '
        + 'Tap the picture for the prompt, the note thread and the Playground button.',
    },
  };
  if (!go) {
    require('fs').writeFileSync('/tmp/triangle-deck.json', JSON.stringify(body, null, 1));
    console.log('(dry — body written to /tmp/triangle-deck.json; add --go to post)');
    return;
  }
  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  console.log(await r.text());
})().catch((e) => { console.error(e); process.exit(1); });
