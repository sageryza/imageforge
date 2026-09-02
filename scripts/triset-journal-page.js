#!/usr/bin/env node
/* Build (and post) the JOURNAL EDITION of Similitude as a Compare page —
   2026-09-01, Sophie: "seed them into a separate version of the triangle set
   game / so exact code copy, but different cards / no render deploy, just a
   compare page".

   THE GAME IS public/triset.html, BYTE FOR BYTE. Not a port, not a fork: the
   file is read and posted as it stands, with the same `__STUDIO_TOKEN__`
   substitution serveGated performs (the token is off, so the live page ships
   the empty string too). Two lines are added and NEITHER is game code:

     1. <meta name="forge-pill" content="off"> — the live tool is served
        without a pill (one screen, never scrolls) and a Compare page is
        served WITH one appended, which would sit in the corner the gear is
        in. The meta is the house opt-out, so the copy looks like the tool.

     2. a PRELUDE script, above the page's own, that owns exactly one thing:
        WHERE THE CARDS COME FROM. It also namespaces localStorage, because a
        Compare page is served from the same origin as /similitude and the
        two would otherwise share her place, her sets, her opponent and her
        edition — one game clobbering the other every time she opened it.

   WHY THE DECK IS EMBEDDED RATHER THAN FETCHED. The journal cards are seeded
   `hidden:true` (scripts/seed-triset-journal.js), which is what keeps her
   live nature game exactly as it is: GET /api/triset/cards is the only route
   that filters hidden, so the live pool never grows an edition chip and never
   deals a journal drawing. Everything else — /found, /opponent, /challenge,
   /card/:id — reads cards BY DOC ID with no hidden filter, so the copy keeps
   every server feature with no deploy.

   A CARD THE GAME MAKES IS REMEMBERED AND HIDDEN. A found set draws a real
   venn card (~2c, her tap); its id is kept in this page's own localStorage
   and hydrated on the next open, so the game still feeds itself even though
   a Compare page is frozen — and the card is PATCHed hidden the moment it is
   made, so it never turns up in her live deck either.

   Run:  node scripts/triset-journal-page.js            (writes the html, dry)
         node scripts/triset-journal-page.js --go       (posts it)
   Env:  FIREBASE_SERVICE_ACCOUNT (deckfactory, reads the cards)             */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const ROOT = path.join(__dirname, '..');
const GO = process.argv.includes('--go');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const argOf = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const CHAT = argOf('chat', 'triangle-game-journal-drawings');
const TITLE = argOf('title', 'Similitude · the journal edition');
const OUT = argOf('out', path.join(ROOT, 'out', 'triset-journal.html'));

// The prelude. `DECK` is spliced in as JSON — everything else is literal.
const PRELUDE = (deckJson) => `<script>
/* ── THE JOURNAL EDITION: the deck, and nothing else ──────────────────────
   Everything below this block is public/triset.html unchanged. This script
   owns two things and no game rule:

   1. localStorage — a Compare page shares an origin with /similitude, so
      every \`triset.*\` key this copy writes is filed under \`journalset.*\`
      instead. Her live game's place, sets, opponent and edition are hers.

   2. the cards — GET /api/triset/cards is answered from the embedded deck
      (her 316 journal drawings, seeded hidden so the live pool never deals
      one) plus any card THIS game has made. A made card's id is kept here
      and hydrated from /api/triset/card/<id> on the next open, because a
      Compare page is frozen the day it is posted; it is also PATCHed hidden
      so it stays out of her live deck. /found, /opponent and /challenge are
      untouched — they read cards by doc id, which works for a hidden card. */
(function(){
  var NS = 'journalset.', MADE = NS + 'made', PRE = 'triset.';
  var real = window.localStorage;

  // ── 1. the namespace ───────────────────────────────────────────────────
  var key = function(k){ k = String(k); return k.indexOf(PRE) === 0 ? NS + k.slice(PRE.length) : k; };
  var shim = {
    getItem: function(k){ return real.getItem(key(k)); },
    setItem: function(k, v){ return real.setItem(key(k), v); },
    removeItem: function(k){ return real.removeItem(key(k)); },
    clear: function(){ return real.clear(); },
    key: function(i){ return real.key(i); },
    get length(){ return real.length; }
  };
  try { Object.defineProperty(window, 'localStorage', { configurable: true, get: function(){ return shim; } }); }
  catch (e) { /* a browser that refuses the override shares her keys — the
                 game still plays; only the two saves collide */ }

  // ── 2. the deck ────────────────────────────────────────────────────────
  var DECK = ${deckJson};
  var of = window.fetch.bind(window);
  var read = function(){ try { return JSON.parse(real.getItem(MADE) || '[]') || []; } catch (e) { return []; } };
  var write = function(a){ try { real.setItem(MADE, JSON.stringify(a.slice(-200))); } catch (e) {} };

  function remember(id){
    var ids = read();
    if (ids.indexOf(id) > -1) return;
    ids.push(id); write(ids);
    // out of her live deck the moment it exists — /cards is the only route
    // that reads \`hidden\`, so nothing else about the card changes
    of('/api/triset/card/' + encodeURIComponent(id), {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden: true })
    }).catch(function(){});
  }

  function cards(){
    var ids = read();
    return Promise.all(ids.map(function(id){
      return of('/api/triset/card/' + encodeURIComponent(id))
        .then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
    })).then(function(rows){
      // EVERY status rides, not just ready: load() looks a pending draw up in
      // this same list to pick it back up after a reload, and the page's own
      // filter is what decides pool membership
      var made = rows.filter(Boolean).map(function(c){
        return { id: c.id, title: c.title || '', url: c.url || '', cut: c.cut || '',
          hex: c.hex || null, flip: !!c.flip, edition: 'journal',
          status: c.status || 'ready', createdAt: c.createdAt || 0, from: c.from || null };
      });
      return new Response(JSON.stringify({ ok: true, cards: made.concat(DECK) }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
  }

  window.fetch = function(input, init){
    var u = typeof input === 'string' ? input : (input && input.url) || '';
    if (u.indexOf('/api/triset/cards') === 0) return cards();
    var p = of(input, init);
    if (u.indexOf('/api/triset/found') === 0) {
      p = p.then(function(res){
        try { res.clone().json().then(function(d){ if (d && d.id) remember(d.id); }).catch(function(){}); }
        catch (e) {}
        return res;
      });
    }
    return p;
  };
})();
</script>
`;

async function main() {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const snap = await admin.firestore().collection('forge-triset-cards')
    .where('edition', '==', 'journal').get();
  const deck = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(c => c.status === 'ready' && (c.cut || c.url) && c.source === 'journal')
    .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    .map(c => ({ id: c.id, title: c.title || '', url: c.url, cut: c.cut || '',
      edition: 'journal', status: 'ready', createdAt: c.createdAt || 0 }));
  const nocut = deck.filter(c => !c.cut).length;
  console.log(`deck: ${deck.length} journal cards${nocut ? ` · ${nocut} still without a die-cut` : ''}`);
  if (!deck.length) throw new Error('no journal cards — run scripts/seed-triset-journal.js --go first');

  let html = fs.readFileSync(path.join(ROOT, 'public', 'triset.html'), 'utf8');
  // the substitution serveGated makes for the live page (the token is off)
  html = html.replace('__STUDIO_TOKEN__', '');
  // the live tool is served with no pill; a Compare page is served with one
  // appended, and it would land in the gear's corner
  html = html.replace('<meta name="robots"',
    '<meta name="forge-pill" content="off">\n<meta name="robots"');
  html = html.replace('<script>', PRELUDE(JSON.stringify(deck)) + '<script>');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  console.log(`wrote ${OUT} · ${(html.length / 1024).toFixed(0)}KB`);
  if (!GO) { console.log('(dry — pass --go to post it)'); return; }

  const res = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title: TITLE, html,
      session: (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, '') }),
  });
  const out = await res.json();
  console.log(JSON.stringify(out, null, 1));
  if (out.id) console.log(`\n${BASE}/api/chatfeed/page/${out.id}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
