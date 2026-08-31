#!/usr/bin/env node
/* Emit the "Triset — versions compared" page from /tmp/tricards.json (run
   gen-triset-compare-data.js first). Each subject is one card: its
   generations side by side, quality tags on top, thumbs in the grid
   (`/api/story/thumb`) with the ORIGINAL behind the lightbox via data-full —
   a quality comparison zoomed on a thumb would be a lie. Three toggles at
   the top (Sophie's ask): hearted only / hide the crossed-out / show notes;
   the NEWEST generation's vote is the group's verdict for filtering.
   Votes and notes ride each card's own chat's Assets thread (both ways).
   Post via POST /api/chatfeed/page — a re-post is a NEW page version.
   Test: node scripts/test-triset-compare.js */
const fs = require('fs');
const groups = JSON.parse(fs.readFileSync('/tmp/tricards.json', 'utf8'));
const chats = [...new Set(groups.flatMap(g => g.versions.map(v => v.chat)).filter(Boolean))];
const data = groups.map(g => ({
  slug: g.slug, t: g.title,
  vs: g.versions.map((v, i) => {
    let tag = v.quality || '?';
    if (i > 0 && v.promptContent && v.promptContent !== g.versions[0].promptContent) tag += ' · new prompt';
    else if (g.versions.slice(0, i).some(p => p.quality === v.quality)) tag += ' · redo';
    return { u: v.url, chat: v.chat, tag };
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
<script src="/compare.js"></script>
<script>
(function () {
  var GROUPS = ${JSON.stringify(data)};
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
      f.dataset.url = v.u;
      f.innerHTML = '<span class="tag">' + esc(v.tag) + '</span>' +
        '<img loading="lazy" src="' + esc(thumb(v.u)) + '" data-full="' + esc(v.u) + '" alt="' + esc(g.t + ' — ' + v.tag) + '">' +
        (v.chat ? '<div class="vacts">' +
          '<button class="v-like" aria-label="Heart">' + HEART_SVG + '</button>' +
          '<button class="v-x" aria-label="Cross out">' + X_SVG + '</button>' +
          '<button class="addn" aria-label="Add a note">+</button></div>' : '') +
        '<div class="vnotes"></div>';
      var like = f.querySelector('.v-like'), x = f.querySelector('.v-x'), addn = f.querySelector('.addn');
      if (like) like.onclick = function () { cast(f, v, 'like'); };
      if (x) x.onclick = function () { cast(f, v, 'dislike'); };
      if (addn) addn.onclick = function () { openNote(f, v); };
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
  // notes go onto the ASSET THREAD (rings the chat that made the card) —
  // one pile of notes per picture, never a second verdict pile
  function openNote(f, v) {
    fNotes = true; save(); applyFilters();
    var box = f.querySelector('.vnotes');
    if (box.querySelector('textarea')) return;
    var ta = document.createElement('textarea');
    var send = document.createElement('button'); send.textContent = 'Send'; send.className = 'btn';
    box.appendChild(ta); box.appendChild(send); ta.focus();
    send.onclick = function () {
      var t = (ta.value || '').trim(); if (!t) { ta.remove(); send.remove(); return; }
      fetch('/api/gallery/assets/note', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: v.chat, url: v.u, text: t, from: 'sophie' }) })
        .then(function () {
          votes[v.u] = votes[v.u] || {}; votes[v.u].thread = (votes[v.u].thread || []).concat([{ from: 'sophie', text: t }]);
          ta.remove(); send.remove(); paintFig(f);
        }).catch(function () { send.textContent = 'Failed — tap again'; });
    };
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
    + 'and show the notes. + writes a note to the chat that made that version.' });
})();
</script>`;
fs.writeFileSync('/tmp/tripage.html', html);
console.log('html bytes:', html.length, 'groups:', data.length, 'chats:', chats.join(', '));
