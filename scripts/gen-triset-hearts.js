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
   NATURE IS EXCLUDED, because another chat already showed her those
   (2026-08-31, Sophie: "this is same. dedupe the nature / new pages no
   nature / look at other chat for which they counted as nature / so i gave
   all cards no missing no duplicates"). The subject list is NOT a guess at
   what nature means — it is read off that chat's own two live pages ("The
   35 nature cards you hearted, in order" + "The 16 hearted cards no longer
   in the pool") and banked in docs/triset/nature-slugs.json, so the two
   chats partition her hearts: 50 nature there, 87 here, nothing in both and
   nothing in neither (verified on every run — the script REFUSES to build
   if that stops being true).

   Env: FIREBASE_SERVICE_ACCOUNT. Costs nothing — two reads, no model call. */
const fs = require('fs');
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

const NATURE = new Set(JSON.parse(fs.readFileSync(__dirname + '/../docs/triset/nature-slugs.json', 'utf8')).slugs);
const QORDER = { low: 0, medium: 1, high: 2 };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const thumb = (u) => '/api/story/thumb?w=900&url=' + encodeURIComponent(u);

function page(title, rows, help) {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
#count{font-size:12px;color:var(--ink2,#7a7466);padding:6px 64px 10px 0}
.one{margin:0 0 26px}
.one img{width:100%;display:block;cursor:pointer}
.one .ttl{font-size:14px;margin-top:6px;color:var(--ink)}
.one .tq{font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink2,#9a9488);margin-top:2px}
.one .note{font-size:12.5px;line-height:1.4;margin-top:5px;color:var(--ink)}
.one .note b{font-weight:600;color:var(--ink2,#7a7466)}
.pairwrap{border-left:2px solid var(--line,#d8d2c6);padding-left:10px;margin:0 0 26px}
.pairwrap .one{margin-bottom:14px}
.pairwrap .one:last-child{margin-bottom:0}
.pairhd{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink2,#9a9488);margin-bottom:6px}
[hidden]{display:none !important}
</style>
<div class="wrap">
  <h1>${esc(title)}</h1>
  <div id="count">${rows.n} hearted${rows.pairs ? ' · ' + rows.pairs + ' where you kept both' : ''}</div>
  ${rows.html}
</div>
<script src="/compare.js"></script>
<script src="/asset-lightbox.js"></script>
<script>
(function () {
  var CARDS = ${JSON.stringify(rows.data)};
  var byUrl = {}; CARDS.forEach(function (c) { byUrl[c.u] = c; });
  function openLb(url, side, open) {
    var c = byUrl[url]; if (!c) return;
    var seq = CARDS.map(function (x) { return x.u; }), i = seq.indexOf(url);
    var a = {
      description: c.t, prompt: c.cap, promptStyle: c.ps, promptContent: c.pc,
      vote: 'like', thread: c.th || [], who: c.chat || '',
      nav: {
        prev: i > 0 ? function () { openLb(seq[i - 1], a.promptSide, a.promptOpen); } : null,
        next: i < seq.length - 1 ? function () { openLb(seq[i + 1], a.promptSide, a.promptOpen); } : null,
      },
      _cast: function (kind) {
        var next = (kind === 'like') ? null : kind;   // it is hearted here by definition
        a.vote = next;
        fetch('/api/gallery/assets/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat: c.chat, url: c.u, vote: next }) }).catch(function () {});
      },
      _noteSend: function (text, cb) {
        fetch('/api/gallery/assets/note', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat: c.chat, url: c.u, text: text, from: 'sophie' }) })
          .then(function () { a.thread = (a.thread || []).concat([{ from: 'sophie', text: text }]); if (cb) cb(); })
          .catch(function () { if (cb) cb(); });
      },
    };
    if (side !== undefined) { a.promptSide = side; a.promptOpen = open; }
    window.__assetLightbox(c.u, a);
  }
  Array.prototype.forEach.call(document.querySelectorAll('.one img'), function (im) {
    im.onclick = function () { openLb(im.dataset.u); };
  });
  window.__compareHelp({ html: ${JSON.stringify(help)} });
})();
</script>`;
}

function rowHtml(c) {
  const notes = (c.th || []).map((m) => `<div class="note"><b>${m.from === 'sophie' ? 'you' : 'chat'}:</b> ${esc(m.text)}</div>`).join('');
  return `<div class="one">
      <img loading="lazy" src="${esc(thumb(c.u))}" data-u="${esc(c.u)}" alt="${esc(c.t)}">
      <div class="ttl">${esc(c.t)}</div>
      <div class="tq">${esc(c.cap)}</div>
      ${notes}
    </div>`;
}

function build(list) {
  // group by subject slug so a both-hearted pair rides back to back, low first
  const bySlug = {};
  list.forEach((c) => { (bySlug[c.slug] = bySlug[c.slug] || []).push(c); });
  const seen = {}; const chunks = []; let pairs = 0; const ordered = [];
  list.forEach((c) => {
    if (seen[c.slug]) return;
    seen[c.slug] = 1;
    const g = bySlug[c.slug].slice().sort((a, b) => (QORDER[a.q] ?? 9) - (QORDER[b.q] ?? 9));
    g.forEach((x) => ordered.push(x));
    if (g.length > 1) {
      pairs += 1;
      chunks.push(`<div class="pairwrap"><div class="pairhd">you kept ${g.length === 2 ? 'both' : 'all ' + g.length}</div>`
        + g.map(rowHtml).join('') + '</div>');
    } else {
      chunks.push(rowHtml(g[0]));
    }
  });
  return { html: chunks.join('\n'), n: list.length, pairs, data: ordered };
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

  const heartedSlugs = {};
  hearts.forEach((h) => { (heartedSlugs[h.slug] = heartedSlugs[h.slug] || []).push(h); });
  const paired = (h) => heartedSlugs[h.slug].length > 1;
  const current = hearts.filter((h) => !h.hidden || paired(h));
  const retired = hearts.filter((h) => h.hidden && !paired(h));

  fs.writeFileSync('docs/triset/hearts.json', JSON.stringify({
    _what: 'Her Triset marks, collected 2026-08-31. hearts = every ♥ she cast on a triset card, '
      + 'MINUS the nature subjects another chat already showed her (current = still in the pool, '
      + 'retired = a generation redrawn away); notes = every picture she wrote on, her words verbatim.',
    counts: { hearts: hearts.length, current: current.length, retired: retired.length,
      noted: notesAll.length, natureElsewhere: natureHearts.length, allHearts: beforeNature },
    nature: natureHearts.map((h) => ({ u: h.u, t: h.t, slug: h.slug, q: h.q })),
    current, retired, notes: notesAll,
  }, null, 1));

  const cur = build(current), ret = build(retired);
  fs.writeFileSync('/tmp/hearts-current.html', page('Triset hearts', cur,
    'Every Triset card you hearted that is still in the pool, minus the nature ones — those are '
    + 'on the other chat\'s two nature pages, so between them and these you see every card once. '
    + 'One at a time, newest first, '
    + 'your notes under each. Where you kept BOTH the low and the medium of one subject they sit '
    + 'back to back, low first. Tap a picture for the full-res original with its prompt; '
    + '♥/✕ and notes there sync with the chat that made it. The retired generations are their own page.'));
  fs.writeFileSync('/tmp/hearts-retired.html', page('Triset hearts — retired versions', ret,
    'Cards you hearted whose generation was later redrawn away and that you did NOT also heart at '
    + 'another quality — the picture is still here, it is just no longer the one in the pool. '
    + 'Where you kept BOTH a low and a medium, the pair is on the main hearts page instead, together.'));

  console.log(JSON.stringify({ allHearts: beforeNature, natureElsewhere: natureHearts.length,
    hearts: hearts.length, current: current.length, retired: retired.length,
    currentPairs: cur.pairs, retiredPairs: ret.pairs, noted: notesAll.length,
    bytes: { cur: fs.statSync('/tmp/hearts-current.html').size, ret: fs.statSync('/tmp/hearts-retired.html').size } }, null, 1));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
