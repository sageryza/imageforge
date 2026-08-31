// Assemble the all-cards Compare page from /tmp/tricards.json + the shell rules.
const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('/tmp/tricards.json', 'utf8'));
const chats = [...new Set(cards.map(c => c.chat).filter(Boolean))];
const data = cards.map(c => ({
  id: c.id.slice(0, 12), t: c.title, u: c.url, cut: c.cut || '', chat: c.chat, q: c.quality, f: c.flip ? 1 : 0,
}));
const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Triset cards — all chats</title>
<link rel="stylesheet" href="/compare.css">
<style>
/* filter row: three rounded squares (house 6px), 64px reserved for the pill */
#filt{position:sticky;top:0;z-index:5;background:var(--paper);display:flex;gap:10px;
  padding:8px 64px 8px 0;align-items:center}
#filt button{width:34px;height:34px;border:1px solid var(--line,#d8d2c6);border-radius:6px;
  background:var(--paper);color:var(--ink);display:flex;align-items:center;justify-content:center;padding:0}
#filt button svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8}
#filt #fheart.on{background:var(--rose,#c46a6a);border-color:var(--rose,#c46a6a);color:#fff}
#filt #fheart.on svg{fill:#fff}
#filt #fx.on{background:#8a857c;border-color:#8a857c;color:#fff}
#filt #fnotes.on{background:var(--ink);border-color:var(--ink);color:var(--paper)}
#count{font-size:12px;color:var(--ink2,#7a7466);margin-left:2px}
#wall{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 10px;align-items:start}
.tcell{min-width:0}
.tcell img{width:100%;display:block;cursor:pointer}
.tcell img.flip{transform:rotate(180deg)}
.tt{font-size:11.5px;line-height:1.3;margin-top:4px;color:var(--ink)}
.tq{font-size:10px;color:var(--ink2,#9a9488);text-transform:uppercase;letter-spacing:.04em}
.tacts{display:flex;gap:6px;margin-top:4px;align-items:center}
.tacts button{width:28px;height:28px;border:1px solid var(--line,#d8d2c6);border-radius:6px;
  background:var(--paper);color:var(--ink);display:flex;align-items:center;justify-content:center;padding:0}
.tacts button svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.8}
.tacts .v-like.on{background:var(--rose,#c46a6a);border-color:var(--rose,#c46a6a);color:#fff}
.tacts .v-like.on svg{fill:#fff}
.tacts .v-x.on{background:#8a857c;border-color:#8a857c;color:#fff}
.tacts .addn{margin-left:auto;font-size:16px;line-height:1}
.tnotes{margin-top:4px;font-size:11px;line-height:1.35;color:var(--ink)}
.tnotes .nm{margin-bottom:2px}
.tnotes .nm b{font-weight:600;color:var(--ink2,#7a7466)}
.tnotes textarea{width:100%;box-sizing:border-box;border:1px solid var(--line,#d8d2c6);border-radius:6px;
  background:#fff;font:inherit;font-size:12px;padding:6px;min-height:44px}
body.noNotes .tnotes{display:none}
[hidden]{display:none !important}
</style>
<div class="wrap">
  <h1>Triset cards — all chats</h1>
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
  var CARDS = ${JSON.stringify(data)};
  var votes = {};   // url -> {vote, thread:[{from,text}]}
  var HEART_SVG = document.getElementById('fheart').innerHTML;
  var X_SVG = document.getElementById('fx').innerHTML;
  var st = {};
  try { st = JSON.parse(localStorage.getItem('trisetAllFilters') || '{}'); } catch (e) {}
  var fHeart = !!st.h, fX = !!st.x, fNotes = !!st.n;

  function save() { try { localStorage.setItem('trisetAllFilters', JSON.stringify({ h: fHeart, x: fX, n: fNotes })); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var wall = document.getElementById('wall');
  CARDS.forEach(function (c) {
    var cell = document.createElement('div');
    cell.className = 'tcell'; cell.dataset.url = c.u;
    cell.innerHTML =
      '<img loading="lazy" src="' + esc(c.cut || c.u) + '" alt="' + esc(c.t) + '"' + (c.f ? ' class="flip"' : '') + '>' +
      '<div class="tt">' + esc(c.t) + '</div>' +
      '<div class="tq">' + esc(c.q || '') + '</div>' +
      (c.chat ? '<div class="tacts">' +
        '<button class="v-like" aria-label="Heart">' + HEART_SVG + '</button>' +
        '<button class="v-x" aria-label="Cross out">' + X_SVG + '</button>' +
        '<button class="addn" aria-label="Add a note">+</button></div>' : '') +
      '<div class="tnotes"></div>';
    cell._card = c;
    wall.appendChild(cell);
    var like = cell.querySelector('.v-like'), x = cell.querySelector('.v-x'), addn = cell.querySelector('.addn');
    if (like) like.onclick = function () { cast(cell, c, 'like'); };
    if (x) x.onclick = function () { cast(cell, c, 'dislike'); };
    if (addn) addn.onclick = function () { openNote(cell, c); };
  });

  function voteOf(u) { return (votes[u] || {}).vote || null; }
  function paintCell(cell) {
    var v = voteOf(cell.dataset.url);
    var like = cell.querySelector('.v-like'), x = cell.querySelector('.v-x');
    if (like) like.classList.toggle('on', v === 'like');
    if (x) x.classList.toggle('on', v === 'dislike');
    var th = (votes[cell.dataset.url] || {}).thread || [];
    var box = cell.querySelector('.tnotes');
    if (box && !box.querySelector('textarea')) {
      box.innerHTML = th.map(function (m) {
        return '<div class="nm"><b>' + esc(m.from === 'sophie' ? 'you' : 'chat') + ':</b> ' + esc(m.text || '') + '</div>';
      }).join('');
    }
  }
  function applyFilters() {
    var shown = 0;
    document.body.classList.toggle('noNotes', !fNotes);
    Array.prototype.forEach.call(wall.children, function (cell) {
      var v = voteOf(cell.dataset.url);
      var hide = (fHeart && v !== 'like') || (fX && v === 'dislike');
      cell.hidden = hide; if (!hide) shown++;
    });
    document.getElementById('count').textContent = shown + ' of ' + CARDS.length;
    document.getElementById('fheart').classList.toggle('on', fHeart);
    document.getElementById('fx').classList.toggle('on', fX);
    document.getElementById('fnotes').classList.toggle('on', fNotes);
  }
  document.getElementById('fheart').onclick = function () { fHeart = !fHeart; save(); applyFilters(); };
  document.getElementById('fx').onclick = function () { fX = !fX; save(); applyFilters(); };
  document.getElementById('fnotes').onclick = function () { fNotes = !fNotes; save(); applyFilters(); };

  function cast(cell, c, v) {
    var cur = voteOf(c.u), next = (cur === v) ? null : v;
    votes[c.u] = votes[c.u] || {}; votes[c.u].vote = next;
    paintCell(cell); applyFilters();
    fetch('/api/gallery/assets/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: c.chat, url: c.u, vote: next }) }).catch(function () {});
  }
  // a note goes onto the ASSET THREAD (it rings the chat that made the card),
  // never this page's verdict doc — one pile of notes per picture, not two
  function openNote(cell, c) {
    fNotes = true; save(); applyFilters();
    var box = cell.querySelector('.tnotes');
    if (box.querySelector('textarea')) return;
    var ta = document.createElement('textarea');
    var send = document.createElement('button'); send.textContent = 'Send'; send.className = 'btn';
    box.appendChild(ta); box.appendChild(send); ta.focus();
    send.onclick = function () {
      var t = (ta.value || '').trim(); if (!t) { ta.remove(); send.remove(); return; }
      fetch('/api/gallery/assets/note', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: c.chat, url: c.u, text: t, from: 'sophie' }) })
        .then(function () {
          votes[c.u] = votes[c.u] || {}; votes[c.u].thread = (votes[c.u].thread || []).concat([{ from: 'sophie', text: t }]);
          ta.remove(); send.remove(); paintCell(cell);
        }).catch(function () { send.textContent = 'Failed — tap again'; });
    };
  }

  // live votes + note threads from each chat's Assets tab, merged by url (and alts)
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
    Array.prototype.forEach.call(wall.children, paintCell);
    applyFilters();
  });
  applyFilters();

  window.__compareHelp({ html: '<b>Every visible Triset card, all chats, newest first.</b> '
    + 'Heart keeps favorites, ✕ crosses one out — both sync with each chat\\u2019s Assets tab. '
    + 'The three toggles: hearted only \\u00b7 hide the crossed-out \\u00b7 show notes. '
    + '+ on a card writes a note to the chat that made it.' });
})();
</script>`;
fs.writeFileSync('/tmp/tripage.html', html);
console.log('html bytes:', html.length, 'cards:', data.length, 'chats:', chats.join(', '));
