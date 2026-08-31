#!/usr/bin/env node
/* Collect HER Triset marks and build the hearts pages (2026-08-31, Sophie:
   "collect all my notes and hearts / new page w just hearts" → "just triset"
   · "not 3, 1 at a time" · "separate page for retired ones" · "put low and
   medium that i hearted both after one and other").

   Reads forge-asset-votes joined to forge-triset-cards (hidden ones too — a
   heart on a retired generation is still a heart, and 40% of hers are on
   one), writes docs/triset/hearts.json as the durable collection, and emits
   two pages to /tmp:
     hearts-current.html — hearts on cards live in the pool
     hearts-retired.html — hearts on generations that were redrawn away
   ONE PICTURE AT A TIME, full width, her note under it. When she hearted
   BOTH the low and the medium of one subject, they sit BACK TO BACK in
   quality order (low then medium) so the pair reads as one comparison
   rather than two strangers separated by twenty cards.
   THE NATURE SPLIT WAS REDONE AND THIS SCRIPT OWNS BOTH HALVES NOW
   (2026-08-31, Sophie: "they did a bad job of deciding what's nature and
   what's not. redo. things like castle, bridge yes nature, hail roof").
   The first cut was read off another chat's pages and drew the line at pure
   wilderness; her rule is the OUTDOOR WORLD — landscapes, weather, sky,
   animals, plants, and man-made things sitting out in it. The corrected
   list (with the moved subjects named) is docs/triset/nature-slugs.json.
   Because that other chat's pages are frozen with the wrong split, this
   script owns FOUR pages — nature current/retired AND no-nature
   current/retired — same pair rules on both sides, and the partition is
   still verified on every run (every heart in exactly one pile, or it
   REFUSES to build).

   THEY ARE STOCK TEMPLATE PAGES, NOT HAND-BUILT HTML (2026-08-31, Sophie:
   "they shud be in the tinder compare sheets"). It POSTs `template:'grid'`
   with `start:'swipe'`, so each page opens as the Tinder deck and the
   scrolling wall is one tap away — and the shape is what earns the grid:
   a subject she hearted at BOTH qualities is a GROUP of two, which the deck
   view draws as ONE two-up card (low beside medium, her own comparison as
   one card), and a single is a group of one, which is an ordinary card.
   Posted as a deck of items, that pair would be two strangers in a row.
   `stamp:false` because a page built out of her hearts arrives fully marked
   and every card would wear the GOOD IDEA stamp over the picture; `voice`
   for the mic. Nothing here writes a verdict — the deck reads her ♥ off the
   Assets tab by itself, which is the rule (a chat never writes verdicts into
   her deck).

   --post  actually posts the four pages (and supersedes the ones this
           script posted last time, read back from docs/triset/hearts.json —
           a new version is a NEW page, never an edit of the old one).

   Env: FIREBASE_SERVICE_ACCOUNT. Costs nothing — two reads, no model call. */
const fs = require('fs');
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

const NATURE = new Set(JSON.parse(fs.readFileSync(__dirname + '/../docs/triset/nature-slugs.json', 'utf8')).slugs);
const QORDER = { low: 0, medium: 1, high: 2 };
const thumb = (u) => '/api/story/thumb?w=900&url=' + encodeURIComponent(u);
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = 'triset-nature-classification';
const SESSION = process.env.FORGE_SESSION || '01C9mCVCNtkDN5URMUQ1kX2N';

/* One GROUP per subject. A subject she hearted at more than one quality is a
   group of several — a two-up card in the deck, a row in the wall — and the
   item labels are the quality words, because that is the only thing that
   differs between them. A single is a group of ONE, and there the TITLE is
   the item's label: a group label as well would print the same words twice
   in the wall, and the deck reads a one-card group's name off the item. */
function groups(list) {
  const bySlug = {}; const order = [];
  list.forEach((c) => {
    if (!bySlug[c.slug]) { bySlug[c.slug] = []; order.push(c.slug); }
    bySlug[c.slug].push(c);
  });
  let pairs = 0;
  const out = order.map((slug) => {
    const g = bySlug[slug].slice().sort((a, b) => (QORDER[a.q] ?? 9) - (QORDER[b.q] ?? 9));
    const many = g.length > 1;
    if (many) pairs += 1;
    return {
      label: many ? g[0].t : '',
      items: g.map((c) => ({
        // the picture is the DERIVED thumb and `full` is the original — the
        // house webp rule; `url` must be set explicitly BECAUSE of that,
        // since the item's Assets identity otherwise defaults to `img`, and
        // a thumb url is not the picture the votes and notes are filed under
        img: thumb(c.u), full: c.u, url: c.u,
        label: many ? (c.q || 'this one') : c.t,
        model: 'gpt-image-2', quality: c.q || '',
        promptStyle: c.ps || '', promptContent: c.pc || '',
      })),
    };
  });
  return { groups: out, n: list.length, pairs };
}

async function post(body) {
  const r = await fetch(BASE + '/api/chatfeed/page', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) throw new Error('post failed: ' + r.status + ' ' + JSON.stringify(j).slice(0, 300));
  return j;
}

async function supersede(id, by) {
  if (!id) return;
  await fetch(`${BASE}/api/chatfeed/page/${id}/supersede`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, session: SESSION, by }),
  }).catch(() => {});
}

(async () => {
  const cards = {};
  (await db.collection('forge-triset-cards').get()).forEach((d) => {
    const c = d.data() || {};
    if (!c.url) return;
    const m = String(c.url).match(/cards\/([a-z0-9]+)-(.+)\.webp$/);
    cards[c.url] = { title: c.title || '', hidden: !!c.hidden, quality: c.quality || '',
      slug: m ? m[2] : String(c.url), promptStyle: c.promptStyle || '', promptContent: c.promptContent || '',
      createdAt: c.createdAt || 0 };
  });

  const hearts = [];
  const notesAll = [];
  (await db.collection('forge-asset-votes').get()).forEach((d) => {
    const v = d.data() || {};
    const card = cards[v.url];
    if (!card) return;                                 // triset only
    const th = (v.thread || []).filter((m) => m && m.text);
    if (!th.length && v.note) th.push({ from: 'sophie', text: String(v.note) });
    if (th.some((m) => m.from === 'sophie')) {
      notesAll.push({ url: v.url, title: card.title, chat: v.chat || '', hidden: card.hidden,
        quality: card.quality, thread: th });
    }
    if (v.vote !== 'like') return;
    hearts.push({ u: v.url, t: card.title, slug: card.slug, q: card.quality,
      cap: card.quality ? 'gpt-image-2 · ' + card.quality + ' · 1K' : '',
      ps: card.promptStyle, pc: card.promptContent, chat: v.chat || '', th,
      hidden: card.hidden, at: card.createdAt });
  });
  // ONE ROW PER PICTURE: the same url can carry two vote docs (two chats
  // filed the same picture — the asset-union case), and without this she
  // sees it twice. Keep the record that has her words on it.
  const byUrl = {};
  hearts.forEach((h) => {
    const prev = byUrl[h.u];
    if (!prev || ((h.th || []).length > (prev.th || []).length)) byUrl[h.u] = h;
  });
  hearts.length = 0;
  Object.keys(byUrl).forEach((u) => hearts.push(byUrl[u]));
  hearts.sort((a, b) => (b.at || 0) - (a.at || 0));

  // A PAIR SHE KEPT BOTH OF STAYS TOGETHER, and that decides the split
  // (measured: 18 of her 23 multi-hearted subjects are exactly low+medium,
  // and the plain hidden/visible cut tore every one of them in half — which
  // is the thing she asked for by name). So "retired" means a heart that
  // exists ONLY on a redrawn-away generation; a retired picture that is the
  // other half of a pair she deliberately kept rides the main page beside
  // its partner, where the comparison is the point.
  // THE PARTITION IS CHECKED, NOT ASSUMED — but the invariant is about HER
  // HEARTS, not about the other chat's list. Asking "does every nature
  // subject still have a heart?" fails on a card she has since un-hearted
  // (measured: their retired page still shows the nightingale, the sleeping
  // swan and the zebra, and live she has ✕'d two of them and cleared the
  // third — their page is stale, nothing is wrong here). What must hold is
  // that every heart she has lands in exactly one of the two piles.
  const natureHearts = hearts.filter((h) => NATURE.has(h.slug));
  const beforeNature = hearts.length;
  for (let i = hearts.length - 1; i >= 0; i -= 1) if (NATURE.has(hearts[i].slug)) hearts.splice(i, 1);
  if (hearts.length + natureHearts.length !== beforeNature) throw new Error('the split lost a card');
  if (hearts.some((h) => NATURE.has(h.slug))) throw new Error('a nature card stayed on my pages');

  const splitPile = (list) => {
    const bySlug = {};
    list.forEach((h) => { (bySlug[h.slug] = bySlug[h.slug] || []).push(h); });
    const paired = (h) => bySlug[h.slug].length > 1;
    return { current: list.filter((h) => !h.hidden || paired(h)),
      retired: list.filter((h) => h.hidden && !paired(h)) };
  };
  const { current, retired } = splitPile(hearts);
  const { current: natCurrent, retired: natRetired } = splitPile(natureHearts);

  fs.writeFileSync('docs/triset/hearts.json', JSON.stringify({
    _what: 'Her Triset marks, collected 2026-08-31 (nature split REDONE the same day on her rule: '
      + 'the outdoor world, man-made-in-landscape included). hearts = every ♥ she cast on a triset '
      + 'card, split nature / no-nature (current = still in the pool, retired = a generation '
      + 'redrawn away); notes = every picture she wrote on, her words verbatim.',
    counts: { hearts: hearts.length, current: current.length, retired: retired.length,
      natureHearts: natureHearts.length, natureCurrent: natCurrent.length, natureRetired: natRetired.length,
      noted: notesAll.length, allHearts: beforeNature },
    current, retired, natureCurrent: natCurrent, natureRetired: natRetired, notes: notesAll,
  }, null, 1));

  const PAGES = [
    { key: 'nature', title: 'Triset hearts — nature v2', list: natCurrent,
      help: 'Every NATURE card you hearted that is still in the pool — nature by your rule: the '
        + 'outdoor world, castles and bridges and hail on a roof included. Newest first. Where you '
        + 'kept BOTH the low and the medium of one subject they are ONE card, side by side, low '
        + 'first — tap "this one" to pick the keeper. Tap a picture for the full-res original with '
        + 'its prompt and its note thread; ♥/✕ and notes sync with the chat that made it. '
        + 'Compare shows the whole wall. The retired generations are their own page.' },
    { key: 'natureRetired', title: 'Triset nature hearts — retired v2', list: natRetired,
      help: 'Nature cards you hearted whose generation was later redrawn away and that you did NOT '
        + 'also heart at another quality — the picture is still here, it is just no longer the one '
        + 'in the pool. Where you kept both a low and a medium, that pair is on the main nature '
        + 'page instead, as one card.' },
    { key: 'noNature', title: 'Triset hearts — no nature v2', list: current,
      help: 'Every Triset card you hearted that is still in the pool, minus the nature ones — those '
        + 'are on the nature v2 page, so between the two you see every card once. Newest first. '
        + 'A subject you kept at BOTH qualities is one card, low beside medium. Tap a picture for '
        + 'the full-res original with its prompt and note thread. Compare shows the whole wall.' },
    { key: 'noNatureRetired', title: 'Triset hearts — retired v2', list: retired,
      help: 'Cards you hearted whose generation was later redrawn away and that you did NOT also '
        + 'heart at another quality. Where you kept BOTH a low and a medium, that pair is on the '
        + 'main hearts page instead, as one card.' },
  ];

  const built = {}; const out = {};
  PAGES.forEach((pg) => { built[pg.key] = groups(pg.list); });

  if (process.argv.includes('--post')) {
    // a new version is a NEW page, never an edit of the old one — so the
    // previous run's ids are superseded rather than overwritten
    let prev = {};
    try { prev = (JSON.parse(fs.readFileSync('docs/triset/hearts.json', 'utf8')).pages) || {}; } catch (e) { /* first run */ }
    for (const pg of PAGES) {
      const g = built[pg.key];
      const r = await post({ chat: CHAT, session: SESSION, title: pg.title, template: 'grid',
        data: { groups: g.groups, help: pg.help, start: 'swipe', stamp: false, voice: true } });
      if (r.warnings) throw new Error('page came back with warnings: ' + JSON.stringify(r.warnings));
      await supersede(prev[pg.key] && prev[pg.key].id, r.id);
      out[pg.key] = { id: r.id, sheet: r.sheet || ('page-' + r.id), title: pg.title,
        cards: g.n, groups: g.groups.length, pairs: g.pairs,
        url: BASE + '/api/chatfeed/page/' + r.id };
    }
  }

  const doc = JSON.parse(fs.readFileSync('docs/triset/hearts.json', 'utf8'));
  if (Object.keys(out).length) doc.pages = out;
  fs.writeFileSync('docs/triset/hearts.json', JSON.stringify(doc, null, 1));

  console.log(JSON.stringify({ allHearts: beforeNature, noted: notesAll.length,
    nature: { hearts: natureHearts.length, current: natCurrent.length, retired: natRetired.length,
      currentPairs: built.nature.pairs },
    noNature: { hearts: hearts.length, current: current.length, retired: retired.length,
      currentPairs: built.noNature.pairs },
    posted: Object.keys(out).length ? out : 'dry (pass --post)' }, null, 1));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
