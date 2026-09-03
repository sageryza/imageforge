#!/usr/bin/env node
// EVERY triangle card Sophie has hearted, ANYWHERE, as ONE 1-up swipe deck.
// Sophie, 2026-09-03: "gather all the triangle cards i've hearted everywhere
// i[n] ur assets tab and 1 up tinder quick toggle w good/bad · be thorough".
//
// THE FIRST VERSION (2026-09-01) MISSED MOST OF THEM, AND THE SHAPE OF THE
// MISS IS THE LESSON: it resolved a Compare page's ♥ by GUESSING what its
// item ids meant — a card's url stem, or a `subject` field. Measured
// 2026-09-03: `subject` does not exist on a single one of the 902 card docs,
// and across all 131 verdict docs exactly ONE of her 300 `true` marks
// resolved. Her compare pages use at least six id shapes (a slugified title,
// a subject slug, a card stem, a 12-char card-id prefix, `pl-<run>-<i>`,
// `<run>-<i>`), because each page was built by a different chat.
//
// So NOTHING IS GUESSED HERE. A page's own frozen JSON is the dictionary:
// `chat-pages/<id>.json` in Storage holds the items she actually marked, id →
// url, whatever the ids are called. That is the only reading that cannot go
// stale the next time a chat invents an id shape.
//
// FOUR DOORS A HEART COMES THROUGH, all swept:
//   1. an Assets-tab / Meta Assets ♥          (forge-asset-votes, vote:'like')
//   2. a ♥ or a "this one" pick on ANY Compare page   (forge-chat-verdicts,
//      resolved through that page's own JSON — every page, not the triset ones)
//   3. a per-image ♥ on a Playground run      (forge-promptlab, run.votes)
//   4. — and each of those may land on ANY of a card's urls: the pool card,
//      its current cut, an OLDER cut, a thumb-service link, or the
//      claude-deliveries copy. They are joined, so one card is one item.
//
// WHAT COUNTS AS A TRIANGLE CARD — evidence, never a vibe (the house rule
// playground-port.js is built on):
//   • it is a Similitude pool card            (forge-triset-cards)
//   • it is a Playground run on the Triangle tile, by its declared style OR
//     by its own fullPrompt matching the triangle clause (10 runs predate the
//     tile and declare nothing)
//   • it is a filed asset whose stored style half matches the triangle clause
//     (matchStyle in playground-port.js — the same stem that survives every
//     reword of the wording)
//
// Dry by default: prints the counts, the per-door breakdown and the first
// items. `--go` posts the page. Needs FIREBASE_SERVICE_ACCOUNT (Deck Factory).
//   node scripts/triangle-hearts-deck.js --chat <slug> [--go] [--title "…"]
'use strict';
const admin = require('firebase-admin');
const port = require('../public/playground-port.js');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const go = args.includes('--go');
const CHAT = flag('--chat', 'triangle-cards-tinder-toggle');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
const db = admin.firestore();

const ms = (t) => (t && t.toMillis ? t.toMillis() : (typeof t === 'string' ? Date.parse(t) || 0 : (t || 0)));

// ── ONE URL, MANY SPELLINGS ────────────────────────────────────────────────
// The same picture reaches this script as a bare Storage url, as a thumb
// (`/api/story/thumb?w=900&url=<encoded>`, absolute or root-relative), with a
// download token, or with an alt=media query. `key()` reduces all of them to
// `<bucket>/<object path>`, which is the only thing that identifies the bytes.
// A LONE `%` IN A REAL URL THROWS — measured 2026-09-03, decodeURIComponent
// raised "URI malformed" on one of her liked urls and took the whole sweep
// with it. A key that cannot be decoded is still a usable key undecoded.
const un = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
function key(u) {
  let s = String(u || '');
  for (let i = 0; i < 3 && s; i += 1) {
    const m = s.match(/[?&]url=([^&]+)/);
    if (!m) break;
    s = un(m[1]);
  }
  s = s.split('?')[0].split('#')[0];
  let m = s.match(/storage\.googleapis\.com\/([^/]+)\/(.+)$/);
  if (m) return `${m[1]}/${un(m[2])}`;
  m = s.match(/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/(.+)$/);
  if (m) return `${m[1]}/${un(m[2])}`;
  return s;
}
const thumb = (u) => `${BASE}/api/story/thumb?w=900&url=${encodeURIComponent(u)}`;
// the style half as it was really sent, for the evidence match
const styleHalf = (r) => {
  const full = r.fullPrompt || ''; const content = r.prompt || r.promptContent || '';
  if (r.promptStyle) return r.promptStyle;
  return full && content && full.includes(content) ? full.replace(content, '[content]') : full;
};
const isTriangleText = (styleText, caption) => {
  const m = port.matchStyle(styleText || '', caption || '');
  return m.matched && m.style === 'triangle';
};

// ── THE INDEX: every triangle picture we know, keyed to a CARD identity ────
function buildIndex({ cards, runs, assets }) {
  const byKey = new Map();          // url key → identity
  const cardOf = new Map();         // identity → the card record
  const put = (u, id) => { const k = key(u); if (k && !byKey.has(k)) byKey.set(k, id); };

  cards.forEach((c) => {
    const id = `ts-${c.id}`;
    cardOf.set(id, {
      id,
      kind: 'pool',
      docId: c.id,
      img: c.cut || c.url,
      url: c.url,
      label: c.title || c.promptContent || '',
      model: c.model || 'gpt-image-2',
      quality: c.quality || '',
      promptContent: c.promptContent || '',
      promptStyle: c.promptStyle || '',
      at: ms(c.createdAt),
      inDeal: c.edition === 'nature' && !c.hidden,
      hidden: !!c.hidden,
    });
    put(c.url, id); if (c.cut) put(c.cut, id);
  });
  // an OLDER cut — triset/cuts/<card doc id>.<version>.webp — is the same card
  const cardIds = new Set(cards.map((c) => c.id));

  runs.forEach((r) => {
    const declared = r.gptStyle === 'triangle';
    const evid = isTriangleText(styleHalf(r), '');
    if (!declared && !evid) return;
    (r.images || []).forEach((u, i) => {
      const id = `pl-${r.id}-${i}`;
      const content = r.prompt || '';
      const full = r.fullPrompt || '';
      cardOf.set(id, {
        id, kind: 'playground', img: u, url: u,
        label: content, model: 'gpt-image-2', quality: r.quality || '',
        promptContent: content,
        promptStyle: full && content && full.includes(content) ? full.replace(content, '[content]') : '',
        at: ms(r.createdAt), inDeal: false, hidden: false,
        runId: r.id, imgIndex: i, declared,
      });
      put(u, id);
    });
  });

  assets.forEach((a) => {
    if (!isTriangleText(a.promptStyle || '', a.prompt || '')) return;
    const k = key(a.url);
    const known = byKey.get(k);
    if (known) {                      // already a pool card / a run's output
      const c = cardOf.get(known);
      if (c && !c.label && a.description) c.label = a.description;
      return;
    }
    const id = `as-${a.md5 || k}`;
    if (!cardOf.has(id)) {
      cardOf.set(id, {
        id: `as-${(a.md5 || k).replace(/[^A-Za-z0-9_-]/g, '').slice(-16)}`,
        kind: 'asset', img: a.url, url: a.url,
        label: a.description || a.promptContent || '',
        model: '', quality: '',
        promptContent: a.promptContent || '', promptStyle: a.promptStyle || '',
        caption: a.prompt || '', at: ms(a.created), inDeal: false, hidden: false,
        chat: a.chat,
      });
    }
    put(a.url, id);
  });
  // ── THE md5 JOIN (the Assets tab's own union rule) ────────────────────
  // One picture can live at two Storage paths — where it was drawn, and the
  // `claude-deliveries/<random>` copy the hook files when the same image is
  // also sent as a chat file. Nothing in the NAME ties those together, so a ♥
  // left on the copy resolves to nothing. `forge-chat-assets` carries the
  // Storage object's own md5, which is exactly what asset-union.js joins on.
  const byMd5 = new Map();
  assets.forEach((a) => { if (a.md5 && byKey.has(key(a.url))) byMd5.set(a.md5, byKey.get(key(a.url))); });
  const md5Of = new Map();
  assets.forEach((a) => { if (a.md5) md5Of.set(key(a.url), a.md5); });
  return { byKey, cardOf, cardIds, byMd5, md5Of };
}

// a cut url whose stem is a card doc id belongs to that card
function resolve(u, idx) {
  const k = key(u);
  if (idx.byKey.has(k)) return idx.byKey.get(k);
  const m = k.match(/triset\/cuts\/([^./]+)\./);
  if (m && idx.cardIds.has(m[1])) return `ts-${m[1]}`;
  // the same bytes under another name (a claude-deliveries copy, a re-upload)
  const md5 = idx.md5Of.get(k);
  if (md5 && idx.byMd5.has(md5)) return idx.byMd5.get(md5);
  return null;
}

async function pageItems(bucket, pageId, cache) {
  if (cache.has(pageId)) return cache.get(pageId);
  let out = null;
  try {
    const [buf] = await bucket.file(`chat-pages/${pageId}.json`).download();
    const j = JSON.parse(buf.toString());
    const all = (j.items || []).concat(...(j.groups || []).map((g) => g.items || []));
    out = new Map(all.filter((i) => i && i.id).map((i) => [i.id, i]));
  } catch (e) { out = null; }
  cache.set(pageId, out);
  return out;
}

(async () => {
  const bucket = admin.storage().bucket();
  const [cardSnap, voteSnap, runSnap, verdictSnap, assetSnap] = await Promise.all([
    db.collection('forge-triset-cards').get(),
    db.collection('forge-asset-votes').get(),
    db.collection('forge-promptlab').get(),
    db.collection('forge-chat-verdicts').get(),
    db.collection('forge-chat-assets').get(),
  ]);
  const rows = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
  const cards = rows(cardSnap); const votes = rows(voteSnap);
  const runs = rows(runSnap); const verdicts = rows(verdictSnap); const assets = rows(assetSnap);
  const idx = buildIndex({ cards, runs, assets });

  // identity → { why:Set, voteUrl, at }
  const hearts = new Map();
  const doors = { asset: 0, verdict: 0, run: 0 };
  const heart = (id, why, voteUrl) => {
    if (!id) return false;
    const h = hearts.get(id) || { why: new Set(), voteUrl: '' };
    h.why.add(why);
    if (!h.voteUrl && voteUrl) h.voteUrl = voteUrl;
    hearts.set(id, h);
    doors[why.split(':')[0]] = (doors[why.split(':')[0]] || 0) + 1;
    return true;
  };

  // 1 — an Assets-tab ♥
  votes.filter((v) => v.vote === 'like').forEach((v) => heart(resolve(v.url, idx), 'asset', v.url));
  // 3 — a Playground run's per-image ♥
  runs.forEach((r) => Object.entries(r.votes || {}).forEach(([i, val]) => {
    if (val !== 'like') return;
    const u = (r.images || [])[Number(i)];
    if (u) heart(resolve(u, idx), 'run', u);
  }));
  // 2 — a ♥ or a "this one" pick on ANY Compare page, through that page's own JSON
  const cache = new Map();
  let pagesRead = 0, pagesMissing = 0;
  for (const v of verdicts) {
    const marks = Object.entries(v.items || {});
    if (!marks.length) continue;
    const m = String(v.sheet || '').match(/^page-(.+)$/);
    if (!m) continue;
    const items = await pageItems(bucket, m[1], cache);
    if (!items) { pagesMissing += 1; continue; }
    pagesRead += 1;
    const take = (itemId) => {
      const it = items.get(itemId); if (!it) return;
      for (const u of [it.url, it.full, it.img]) {
        const id = resolve(u, idx);
        if (id) { heart(id, 'verdict', it.url || it.full || u); return; }
      }
    };
    marks.forEach(([k, val]) => {
      if (val === true) { take(k); return; }
      // a spread's verdict IS the winning card's id — her "this one"
      if (typeof val === 'string' && k.startsWith('s:') && items.has(val)) take(val);
    });
  }

  const items = [...hearts.entries()]
    .map(([id, h]) => ({ c: idx.cardOf.get(id), h }))
    .filter((x) => x.c && x.c.img)
    .sort((a, b) => b.c.at - a.c.at);

  const WHY = { asset: 'assets', verdict: 'compare page', run: 'playground' };
  const deck = items.map(({ c, h }) => {
    const why = [...h.why].map((w) => WHY[w] || w);
    const where = c.kind === 'pool'
      ? (c.inDeal ? 'in the similitude deck' : (c.hidden ? 'not dealt' : 'pool card'))
      : (c.kind === 'playground' ? 'playground' : `assets · ${c.chat || ''}`);
    const it = {
      id: c.id.slice(0, 60),
      label: c.label || '',
      // THE HOUSE DISPLAY-COPY RULE — a card FACE is a derived thumb, never
      // the original. Measured 2026-09-03: a Playground triangle card is a
      // ~1.0MB lossless webp and its 900px thumb is ~82KB, and a pool cut
      // goes 142KB → 61KB. The thumb comes back VP8X, so the cut's
      // transparency outside the triangle survives — checked, not assumed.
      // `full` and `url` stay the ORIGINALS: the lightbox opens the real
      // picture and her ♥ lands on the real identity.
      img: thumb(c.img),
      // WHERE HER MARK LANDS. For a POOL card it is the card's own url, never
      // the old cut the heart happened to sit on — that url is what
      // triset.js's deck sync reads, so a ♥/✕ here really does put the card
      // into the Similitude deal or take it out (her rule, 2026-09-01:
      // "connect it to the deck so they flow in and out automatically").
      // Everything else keeps the url the heart is already on, so the deck
      // and the Assets tab agree.
      url: c.kind === 'pool' ? c.url : (h.voteUrl || c.url),
      eyebrow: `${where} · ♥ ${why.join(', ')}`.toUpperCase().slice(0, 200),
    };
    if (c.model) it.model = c.model;
    if (c.quality) it.quality = c.quality;
    if (c.promptContent) it.promptContent = c.promptContent;
    if (c.promptStyle) it.promptStyle = c.promptStyle;
    it.full = c.img;
    return it;
  });

  const kinds = {}; items.forEach(({ c }) => { kinds[c.kind] = (kinds[c.kind] || 0) + 1; });
  const inDeal = items.filter((x) => x.c.inDeal).length;
  console.log(`pages read ${pagesRead} (missing ${pagesMissing})`);
  console.log(`heart marks by door: ${JSON.stringify(doors)}`);
  const onlyVerdict = items.filter(({ h }) => h.why.size === 1 && h.why.has('verdict')).length;
  console.log(`reachable ONLY through a Compare page (the old script's blind spot): ${onlyVerdict}`);
  console.log(`${deck.length} distinct hearted triangle cards — ${JSON.stringify(kinds)} — ${inDeal} in the Similitude deal`);
  console.log(deck.slice(0, 6).map((d) => `  ${d.eyebrow} | ${d.label.slice(0, 60)}`).join('\n'));

  const title = flag('--title', `Every triangle card you've hearted (${deck.length})`);
  const body = {
    chat: CHAT,
    title,
    template: 'deck',
    data: {
      items: deck,
      aspect: 'square',
      browse: true,
      pace: 'quick',       // a ♥/✕ steps forward by itself
      voice: true,
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
