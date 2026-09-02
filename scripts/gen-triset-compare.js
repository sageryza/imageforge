#!/usr/bin/env node
/* Emit the "Triset — versions compared" page from /tmp/tricards.json (run
   gen-triset-compare-data.js first). Each subject is one card: its
   generations side by side, quality tags on top, thumbs in the grid
   (`/api/story/thumb`) with the ORIGINAL behind the lightbox via data-full —
   a quality comparison zoomed on a thumb would be a lie. Three toggles at
   the top (Sophie's ask): hearted only / hide the crossed-out / show notes;
   the NEWEST generation's vote is the group's verdict for filtering.
   Votes and notes ride each card's own chat's Assets thread (both ways).
   Tapping a picture opens THE shared Assets lightbox (/asset-lightbox.js,
   2026-08-31, Sophie: "i need lightbox view") — never compare.js's bare
   zoom and never a hand copy: full-res original, the caption, the Prompt
   door (both filed halves), ♥/✕ and the note box, `who` naming the owning
   chat, and the invisible step zones walking the VISIBLE figures in page
   order, the prompt door's half riding each step (the house rules).
   Post via POST /api/chatfeed/page — a re-post is a NEW page version.
   Test: node scripts/test-triset-compare.js */
const fs = require('fs');
const groups = JSON.parse(fs.readFileSync('/tmp/tricards.json', 'utf8'));
const chats = [...new Set(groups.flatMap(g => g.versions.map(v => v.chat)).filter(Boolean))];
// the style half is the same dreamy wrapper on nearly every card — store the
// unique strings once and reference by index, or the page triples in size
const PS = []; const psIdx = t => { if (!t) return -1; let i = PS.indexOf(t); if (i < 0) { PS.push(t); i = PS.length - 1; } return i; };
const data = groups.map(g => ({
  slug: g.slug, t: g.title,
  vs: g.versions.map((v, i) => {
    let tag = v.quality || '?';
    if (i > 0 && v.promptContent && v.promptContent !== g.versions[0].promptContent) tag += ' · new prompt';
    else if (g.versions.slice(0, i).some(p => p.quality === v.quality)) tag += ' · redo';
    return { u: v.url, chat: v.chat, tag, q: v.quality || '', ps: psIdx(v.promptStyle || ''), pc: v.promptContent || '' };
  }),
}));
const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Triset — versions compared</title>
<link rel="stylesheet" href="/compare.css">
<style>
#filt{position:sticky;top:0;z-index:5;background:var(--paper);display:flex;gap:10px;
  padding:8px 64px 8px 0;align-items:center}
#filt button{width:34px;height:34px;border:1px solid var(--line,#d8d2c6);border-radius:6px;
  background:var(--paper);color:var(--ink);display:flex;align-items:center;justify-content:center;padding:0}
#filt button svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8}
#filt #fheart.on{background:var(--rose,#c46a6a);border-color:var(--rose,#c46a6a);color:#fff}
#filt #fheart.on svg{fill:#fff}
#filt #fx.on{background:#8a857c;border-color:#8a857c;color:#fff}
#filt #fnotes.on{background:var(--ink);border-color:var(--ink);color:var(--paper)}
#count{font-size:12px;color:var(--ink2,#7a7466)}
.grp h2{font-size:15px;margin:0 0 6px}
.vrow{display:flex;flex-wrap:wrap;gap:10px}
.vrow figure{margin:0;flex:0 0 calc(50% - 5px);min-width:0}
.vrow .tag{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;
  color:var(--ink2,#7a7466);margin-bottom:3px}
.vrow img{width:100%;display:block;cursor:pointer}
.vacts{display:flex;gap:6px;margin-top:4px;align-items:center}
.vacts button{width:28px;height:28px;border:1px solid var(--line,#d8d2c6);border-radius:6px;
  background:var(--paper);color:var(--ink);display:flex;align-items:center;justify-content:center;padding:0}
.vacts button svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.8}
.vacts .v-like.on{background:var(--rose,#c46a6a);border-color:var(--rose,#c46a6a);color:#fff}
.vacts .v-like.on svg{fill:#fff}
.vacts .v-x.on{background:#8a857c;border-color:#8a857c;color:#fff}
.vacts .addn{margin-left:auto;font-size:16px;line-height:1}
.vnotes{margin-top:4px;font-size:11px;line-height:1.35;color:var(--ink)}
.vnotes .nm b{font-weight:600;color:var(--ink2,#7a7466)}
.vnotes textarea{width:100%;box-sizing:border-box;border:1px solid var(--line,#d8d2c6);border-radius:6px;
  background:#fff;font:inherit;font-size:12px;padding:6px;min-height:44px}
body.noNotes .vnotes{display:none}
[hidden]{display:none !important}
</style>
<div class="wrap">
  <h1>Triset — versions compared</h1>
  <div id="filt">
    <button id="fheart" aria-label="Hearted only" title="Hearted only"><svg viewBox="0 0 24 24"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2C10.5 3.5 9.3 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/></svg></button>
    <button id="fx" aria-label="Hide the crossed-out" title="Hide the crossed-out"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    <button id="fnotes" aria-label="Show notes" title="Show notes"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>
    <span id="count"></span>
  </div>
  <div id="wall"></div>
</div>
<script src="/compare.js"></script>\n<script src="/asset-lightbox.js"></script>
<script>
(function () {
  var GROUPS = ${JSON.stringify(data)};
  var PS = ${JSON.stringify(PS)};
  var votes = {};
  var HEART_SVG = document.getElementById('fheart').innerHTML;
  var X_SVG = document.getElementById('fx').innerHTML;
  var st = {};
  try { st = JSON.parse(localStorage.getItem('trisetCmpFilters') || '{}'); } catch (e) {}
  var fHeart = !!st.h, fX = !!st.x, fNotes = !!st.n;
  function save() { try { localStorage.setItem('trisetCmpFilters', JSON.stringify({ h: fHeart, x: fX, n: fNotes })); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function thumb(u) { return '/api/story/thumb?w=640&url=' + encodeURIComponent(u); }

  var wall = document.getElementById('wall');
  GROUPS.forEach(function (g) {
    var card = document.createElement('div');
    card.className = 'card grp'; card._g = g;
    card.innerHTML = '<h2>' + esc(g.t) + '</h2><div class="vrow"></div>';
    var row = card.querySelector('.vrow');
    g.vs.forEach(function (v) {
      var f = document.createElement('figure');
      f.dataset.url = v.u; f._v = v; f._t = g.t;
      f.innerHTML = '<span class="tag">' + esc(v.tag) + '</span>' +
        '<img loading="lazy" src="' + esc(thumb(v.u)) + '" data-full="' + esc(v.u) + '" alt="' + esc(g.t + ' — ' + v.tag) + '">' +
        (v.chat ? '<div class="vacts">' +
          '<button class="v-like" aria-label="Heart">' + HEART_SVG + '</button>' +
          '<button class="v-x" aria-label="Cross out">' + X_SVG + '</button></div>' : '') +
        '<div class="vnotes"></div>';
      var like = f.querySelector('.v-like'), x = f.querySelector('.v-x');
      if (like) like.onclick = function () { cast(f, v, 'like'); };
      if (x) x.onclick = function () { cast(f, v, 'dislike'); };
      f.querySelector('img').onclick = function () { openLb(f); };
      row.appendChild(f);
    });
    wall.appendChild(card);
  });

  function voteOf(u) { return (votes[u] || {}).vote || null; }
  function paintFig(f) {
    var v = voteOf(f.dataset.url);
    var like = f.querySelector('.v-like'), x = f.querySelector('.v-x');
    if (like) like.classList.toggle('on', v === 'like');
    if (x) x.classList.toggle('on', v === 'dislike');
    var th = (votes[f.dataset.url] || {}).thread || [];
    var box = f.querySelector('.vnotes');
    if (box && !box.querySelector('textarea')) {
      box.innerHTML = th.map(function (m) {
        return '<div class="nm"><b>' + esc(m.from === 'sophie' ? 'you' : 'chat') + ':</b> ' + esc(m.text || '') + '</div>';
      }).join('');
    }
  }
  function applyFilters() {
    var shown = 0;
    document.body.classList.toggle('noNotes', !fNotes);
    Array.prototype.forEach.call(wall.children, function (card) {
      // the NEWEST generation's vote is the group's verdict
      var g = card._g, newest = g.vs[g.vs.length - 1], v = voteOf(newest.u);
      var hide = (fHeart && v !== 'like') || (fX && v === 'dislike');
      card.hidden = hide; if (!hide) shown++;
      if (!hide) Array.prototype.forEach.call(card.querySelectorAll('figure'), paintFig);
    });
    document.getElementById('count').textContent = shown + ' of ' + GROUPS.length;
    document.getElementById('fheart').classList.toggle('on', fHeart);
    document.getElementById('fx').classList.toggle('on', fX);
    document.getElementById('fnotes').classList.toggle('on', fNotes);
  }
  document.getElementById('fheart').onclick = function () { fHeart = !fHeart; save(); applyFilters(); };
  document.getElementById('fx').onclick = function () { fX = !fX; save(); applyFilters(); };
  document.getElementById('fnotes').onclick = function () { fNotes = !fNotes; save(); applyFilters(); };

  function cast(f, v, kind) {
    var cur = voteOf(v.u), next = (cur === kind) ? null : kind;
    votes[v.u] = votes[v.u] || {}; votes[v.u].vote = next;
    paintFig(f); applyFilters();
    fetch('/api/gallery/assets/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: v.chat, url: v.u, vote: next }) }).catch(function () {});
  }
  // THE SHARED ASSETS LIGHTBOX — one view everywhere (the house rule). The
  // step zones walk the VISIBLE figures in document order, so the top
  // filters narrow the walk by themselves; the prompt door's half rides a
  // step and a fresh open starts shut on content.
  function visibleFigs() {
    return Array.prototype.filter.call(document.querySelectorAll('.grp:not([hidden]) figure'), function (x) { return x._v; });
  }
  function openLb(f, doorSide, doorOpen) {
    var v = f._v, seq = visibleFigs(), i = seq.indexOf(f);
    var rec = votes[v.u] || {};
    var a = {
      description: f._t + ' \u2014 ' + v.tag,
      prompt: v.q ? 'gpt-image-2 \u00b7 ' + v.q + ' \u00b7 1K' : '',
      promptStyle: v.ps >= 0 ? PS[v.ps] : '', promptContent: v.pc,
      vote: rec.vote || null, thread: rec.thread || [],
      who: v.chat || '',
      nav: {
        prev: i > 0 ? function () { openLb(seq[i - 1], a.promptSide, a.promptOpen); } : null,
        next: i < seq.length - 1 ? function () { openLb(seq[i + 1], a.promptSide, a.promptOpen); } : null,
      },
    };
    if (doorSide !== undefined) { a.promptSide = doorSide; a.promptOpen = doorOpen; }
    if (v.chat) {
      a._cast = function (kind) {
        var cur = (votes[v.u] || {}).vote || null, next = (cur === kind) ? null : kind;
        votes[v.u] = votes[v.u] || {}; votes[v.u].vote = next; a.vote = next;
        paintFig(f); applyFilters();
        fetch('/api/gallery/assets/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat: v.chat, url: v.u, vote: next }) }).catch(function () {});
      };
      a._noteSend = function (text, cb) {
        fetch('/api/gallery/assets/note', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat: v.chat, url: v.u, text: text, from: 'sophie' }) })
          .then(function () {
            votes[v.u] = votes[v.u] || {};
            votes[v.u].thread = (votes[v.u].thread || []).concat([{ from: 'sophie', text: text }]);
            a.thread = votes[v.u].thread; paintFig(f); if (cb) cb();
          }).catch(function () { if (cb) cb(); });
      };
    }
    window.__assetLightbox(v.u, a);
  }

  var CHATS = ${JSON.stringify(chats)};
  Promise.all(CHATS.map(function (ch) {
    return fetch('/api/gallery/assets?chat=' + encodeURIComponent(ch) + '&limit=500')
      .then(function (r) { return r.json(); }).catch(function () { return { assets: [] }; });
  })).then(function (all) {
    all.forEach(function (res) {
      (res.assets || []).forEach(function (a) {
        var rec = { vote: a.vote || null, thread: a.thread || (a.note ? [{ from: 'sophie', text: a.note }] : []) };
        [a.url].concat(a.alts || []).forEach(function (u) { if (u) votes[u] = rec; });
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.vrow figure'), paintFig);
    applyFilters();
  });
  applyFilters();

  window.__compareHelp({ html: '<b>Every Triset subject drawn more than once — its generations side by side.</b> '
    + 'Oldest left, newest right; the tag says the quality. Tap a picture for the FULL-RES original. '
    + '\\u2665 and \\u2715 mark one generation and sync with that chat\\u2019s Assets tab; '
    + 'the top toggles filter by the NEWEST generation\\u2019s mark (hearted only \\u00b7 hide the crossed-out) '
    + 'and show the notes. Inside the lightbox: step left/right by tapping the picture\\u2019s edges, '\n    + 'PROMPT shows the exact filed halves, and the note box writes to the chat that made that version.' });
})();
</script>`;
fs.writeFileSync('/tmp/tripage.html', html);
console.log('html bytes:', html.length, 'groups:', data.length, 'chats:', chats.join(', '));
