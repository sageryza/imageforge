'use strict';
/*
 * EVERY TRIANGLE CARD SOPHIE HAS HEARTED, ANYWHERE — the one gather, shared by
 * the swipe deck and the Assets-tab filer, so the two can never disagree about
 * what the set is. Sophie, 2026-09-03: "gather all the triangle cards i've
 * hearted everywhere i[n] ur assets tab and 1 up tinder quick toggle w
 * good/bad · be thorough".
 *
 * THE FIRST VERSION (2026-09-01) MISSED MOST OF THEM, AND THE SHAPE OF THE
 * MISS IS THE LESSON: it resolved a Compare page's ♥ by GUESSING what its item
 * ids meant — a card's url stem, or a `subject` field. Measured 2026-09-03:
 * `subject` does not exist on a single one of the 902 card docs, and across
 * all 131 verdict docs exactly ONE of her 300 `true` marks resolved. Her
 * compare pages use at least six id shapes (a slugified title, a subject slug,
 * a card stem, a 12-char card-id prefix, `pl-<run>-<i>`, `<run>-<i>`), because
 * each page was built by a different chat.
 *
 * So NOTHING IS GUESSED HERE. A page's own frozen JSON is the dictionary:
 * `chat-pages/<id>.json` in Storage holds the items she actually marked, id →
 * url, whatever the ids are called. That is the only reading that cannot go
 * stale the next time a chat invents an id shape.
 *
 * THREE DOORS A HEART COMES THROUGH, all swept:
 *   1. an Assets-tab / Meta Assets ♥          (forge-asset-votes, vote:'like')
 *   2. a ♥ or a "this one" pick on ANY Compare page   (forge-chat-verdicts,
 *      resolved through that page's own JSON — every page, not the triset ones)
 *   3. a per-image ♥ on a Playground run      (forge-promptlab, run.votes)
 * …and each may land on ANY of a card's urls: the pool card, its current cut,
 * an OLDER cut, a thumb-service link, or a re-encoded copy. They are joined,
 * so one card is one item.
 *
 * WHAT COUNTS AS A TRIANGLE CARD — evidence, never a vibe (the house rule
 * playground-port.js is built on):
 *   • it is a Similitude pool card                     (forge-triset-cards)
 *   • it is a Playground run on the Triangle tile, by its declared style OR by
 *     its own fullPrompt matching the triangle clause (10 runs predate the
 *     tile and declare nothing)
 *   • it is a filed asset whose stored style half matches the triangle clause
 *
 * Reads only — no model call anywhere.
 */
const port = require('../../public/playground-port.js');
const sizeTier = require('../../size-tier.js');

const ms = (t) => (t && t.toMillis ? t.toMillis() : (typeof t === 'string' ? Date.parse(t) || 0 : (t || 0)));

// A LONE `%` IN A REAL URL THROWS — measured 2026-09-03, decodeURIComponent
// raised "URI malformed" on one of her liked urls and took the whole sweep
// with it. A key that cannot be decoded is still a usable key undecoded.
const un = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };

// ── ONE URL, MANY SPELLINGS ────────────────────────────────────────────────
// The same picture arrives as a bare Storage url, as a thumb
// (`/api/story/thumb?w=900&url=<encoded>`, absolute or root-relative), with a
// download token, or with an alt=media query. `key()` reduces all of them to
// `<bucket>/<object path>`, the only thing that identifies the bytes.
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

// the style half as it was really sent, for the evidence match
const styleHalf = (r) => {
  if (r.promptStyle) return r.promptStyle;
  const full = r.fullPrompt || ''; const content = r.prompt || r.promptContent || '';
  return full && content && full.includes(content) ? full.replace(content, '[content]') : full;
};
const isTriangleText = (styleText, caption) => {
  const m = port.matchStyle(styleText || '', caption || '');
  return m.matched && m.style === 'triangle';
};

// ── THE INDEX: every triangle picture we know, keyed to a CARD identity ────
function buildIndex({ cards, runs, assets }) {
  const byKey = new Map();          // url key → identity
  const cardOf = new Map();         // identity → the record
  const put = (u, id) => { const k = key(u); if (k && !byKey.has(k)) byKey.set(k, id); };

  cards.forEach((c) => {
    const id = `ts-${c.id}`;
    cardOf.set(id, {
      id, kind: 'pool', img: c.cut || c.url, url: c.url,
      label: c.title || c.promptContent || '',
      model: c.model || 'gpt-image-2', quality: c.quality || '',
      size: sizeTier.captionSize(c.size || c.canvas || ''),
      promptContent: c.promptContent || '', promptStyle: c.promptStyle || '',
      at: ms(c.createdAt),
      inDeal: c.edition === 'nature' && !c.hidden, hidden: !!c.hidden,
    });
    put(c.url, id); if (c.cut) put(c.cut, id);
  });
  const cardIds = new Set(cards.map((c) => c.id));

  runs.forEach((r) => {
    if (r.gptStyle !== 'triangle' && !isTriangleText(styleHalf(r), '')) return;
    (r.images || []).forEach((u, i) => {
      const id = `pl-${r.id}-${i}`;
      const content = r.prompt || ''; const full = r.fullPrompt || '';
      cardOf.set(id, {
        id, kind: 'playground', img: u, url: u, label: content,
        model: 'gpt-image-2', quality: r.quality || '',
        size: sizeTier.runSize(r),
        promptContent: content,
        promptStyle: full && content && full.includes(content) ? full.replace(content, '[content]') : '',
        at: ms(r.createdAt), inDeal: false, hidden: false,
      });
      put(u, id);
    });
  });

  assets.forEach((a) => {
    if (!isTriangleText(a.promptStyle || '', a.prompt || '')) return;
    const k = key(a.url);
    if (byKey.has(k)) {                         // already a pool card / a run's output
      const c = cardOf.get(byKey.get(k));
      if (c && !c.label && a.description) c.label = a.description;
      return;
    }
    const id = `as-${String(a.md5 || k).replace(/[^A-Za-z0-9_-]/g, '').slice(-16)}`;
    if (!cardOf.has(id)) {
      cardOf.set(id, {
        id, kind: 'asset', img: a.url, url: a.url,
        label: a.description || a.promptContent || '',
        model: '', quality: '', size: '',
        promptContent: a.promptContent || '', promptStyle: a.promptStyle || '',
        at: ms(a.created), inDeal: false, hidden: false, chat: a.chat,
      });
    }
    put(a.url, id);
  });

  // ── THE md5 JOIN (the Assets tab's own union rule) ──────────────────────
  // One picture can live at two Storage paths — where it was drawn, and the
  // `claude-deliveries/<random>` copy the hook files when the same image is
  // also sent as a chat file. Nothing in the NAME ties those together, so a ♥
  // on the copy resolves to nothing. `forge-chat-assets` carries the Storage
  // object's own md5, which is what asset-union.js joins on.
  const byMd5 = new Map(); const md5Of = new Map();
  assets.forEach((a) => {
    if (!a.md5) return;
    const k = key(a.url);
    md5Of.set(k, a.md5);
    if (byKey.has(k)) byMd5.set(a.md5, byKey.get(k));
  });
  return { byKey, cardOf, cardIds, byMd5, md5Of };
}

// a cut url whose stem is a card doc id belongs to that card
function resolve(u, idx) {
  const k = key(u);
  if (idx.byKey.has(k)) return idx.byKey.get(k);
  const m = k.match(/triset\/cuts\/([^./]+)\./);
  if (m && idx.cardIds.has(m[1])) return `ts-${m[1]}`;
  const md5 = idx.md5Of.get(k);
  if (md5 && idx.byMd5.has(md5)) return idx.byMd5.get(md5);
  return null;
}

/**
 * gather({ db, bucket }) → { items, stats }
 * `items` are newest first, each { id, kind, img, url, label, model, quality,
 * size, promptStyle, promptContent, inDeal, why:[…] }.
 */
async function gather({ db, bucket }) {
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

  const hearts = new Map();
  const doors = { asset: 0, verdict: 0, run: 0 };
  const heart = (id, why, voteUrl) => {
    if (!id) return;
    const h = hearts.get(id) || { why: new Set(), voteUrl: '' };
    h.why.add(why);
    if (!h.voteUrl && voteUrl) h.voteUrl = voteUrl;
    hearts.set(id, h);
    doors[why] += 1;
  };

  votes.filter((v) => v.vote === 'like').forEach((v) => heart(resolve(v.url, idx), 'asset', v.url));
  runs.forEach((r) => Object.entries(r.votes || {}).forEach(([i, val]) => {
    if (val !== 'like') return;
    const u = (r.images || [])[Number(i)];
    if (u) heart(resolve(u, idx), 'run', u);
  }));

  const cache = new Map();
  let pagesRead = 0; let pagesMissing = 0;
  for (const v of verdicts) {
    const marks = Object.entries(v.items || {});
    if (!marks.length) continue;
    const m = String(v.sheet || '').match(/^page-(.+)$/);
    if (!m) continue;
    let items = cache.get(m[1]);
    if (items === undefined) {
      try {
        const [buf] = await bucket.file(`chat-pages/${m[1]}.json`).download();
        const j = JSON.parse(buf.toString());
        const all = (j.items || []).concat(...(j.groups || []).map((g) => g.items || []));
        items = new Map(all.filter((i) => i && i.id).map((i) => [i.id, i]));
      } catch (e) { items = null; }
      cache.set(m[1], items);
    }
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
    .map(([id, h]) => {
      const c = idx.cardOf.get(id);
      if (!c || !c.img) return null;
      return Object.assign({}, c, {
        why: [...h.why],
        // WHERE HER MARK LANDS. For a POOL card it is the card's own url, never
        // the old cut the heart happened to sit on — that url is what
        // triset.js's deck sync reads, so a ♥/✕ really does put the card into
        // the Similitude deal or take it out. Everything else keeps the url the
        // heart is already on, so every surface agrees.
        url: c.kind === 'pool' ? c.url : (h.voteUrl || c.url),
      });
    })
    .filter(Boolean)
    .sort((a, b) => b.at - a.at);

  const kinds = {};
  items.forEach((i) => { kinds[i.kind] = (kinds[i.kind] || 0) + 1; });
  return {
    items,
    stats: { pagesRead, pagesMissing, doors, kinds, inDeal: items.filter((i) => i.inDeal).length },
  };
}

// "gpt-image-2 · medium · 2K" — only the slots the record really carries. An
// ABSENT slot is left out, never guessed: a caption a later chat invents is
// worse than a blank one (the house rule, measured over 1,938 images).
function captionOf(it) {
  return [it.model, it.quality, it.size].filter(Boolean).join(' · ');
}

module.exports = { gather, captionOf, key, resolve, buildIndex };
