#!/usr/bin/env node
/* gen-story-timeline.js — build Sophie's story timeline Compare page from
   docs/story-timeline/beats.json.
     node scripts/gen-story-timeline.js            # write the html
     node scripts/gen-story-timeline.js --post     # write it AND post the page
     node scripts/gen-story-timeline.js --order    # print the order she saved

   THE UNIT IS WHAT MOVES (v2, Sophie: "have the sequences just have one number
   since they will stay together"). A unit is ONE moment or ONE whole sequence,
   and only units carry a number — the moments inside a sequence do not. The
   character reference is a numbered unit like any other (she numbered it
   herself when she restored the wording).

   THE ORDER LIVES ON THE SERVER, NOT IN THIS FILE. She re-orders on the page
   (type a number, or the arrows) and it saves to the chat's verdict doc under
   ORDER_SHEET — so a rebuild of this page never overwrites what she arranged,
   and `--order` prints it back for folding into beats.json when it settles.

   Ids are stable to the TEXT, not the position (`b7` is the belly button
   forever, `s-b3` is the sequence that starts with the lilac), so neither her
   notes nor her saved order slide onto a different moment when the JSON moves.

   A NEW VERSION IS A NEW PAGE: bump `title` and post again; supersede the old
   one rather than deleting it. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'docs/story-timeline/beats.json');
const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s) => esc(s).replace(/"/g, '&quot;');

/* blocks → units. A `seq` block becomes ONE unit holding its beats. */
const units = data.blocks.map((b) => {
  if (b.kind === 'seq') return { id: 's-' + b.beats[0].id, kind: 'seq', beats: b.beats };
  if (b.kind === 'ref') return { id: b.id, kind: 'ref', beats: [b] };
  return { id: b.id, kind: 'beat', beats: [b] };
});

// Lucide chevron-up / chevron-down, inlined (house rule: line icons, no emoji)
const CHEV = (d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
  + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
const UP = CHEV('m18 15-6-6-6 6');
const DOWN = CHEV('m6 9 6 6 6-6');

function card(b) {
  if (b.kind === 'ref') {
    return `<div class="mcard cast" data-item="${attr(b.id)}">`
      + `<span class="reflab">${esc(b.label)}</span>`
      + `<span class="say">${esc(b.text)}</span></div>`;
  }
  const tag = b.tag ? ` <span class="x">${esc(b.tag)}</span>` : '';
  return `<div class="mcard" data-item="${attr(b.id)}">`
    + `<span class="say">${esc(b.text)}${tag}</span></div>`;
}

function unit(u) {
  // the character reference is numbered too — she numbered it herself (29 in
  // her Aug 2026 list), so it is a place in the order like any other card
  const gut = '<input class="no" type="text" inputmode="numeric" aria-label="its place in the order">';
  return `      <li class="unit${u.kind === 'seq' ? ' seq' : ''}${u.kind === 'ref' ? ' refu' : ''}" data-unit="${attr(u.id)}">\n`
    + `        <div class="gut">${gut}</div>\n`
    + `        <div class="cards">${u.beats.map(card).join('')}</div>\n`
    + `        <div class="mv"><button class="up" type="button" aria-label="move it up">${UP}</button>`
    + `<button class="dn" type="button" aria-label="move it down">${DOWN}</button></div>\n`
    + `      </li>`;
}

const html = `<!doctype html>
<!-- Built by scripts/gen-story-timeline.js from docs/story-timeline/beats.json.
     Edit the JSON and rebuild; never hand-edit this file. Her ARRANGEMENT is
     not in here — it lives on the server (see ORDER_SHEET below). -->
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(data.title)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  /* layout only — every colour is a /compare.css token */
  .tl { list-style: none; margin-top: 14px; }
  .tl li::before { content: none; }

  /* A UNIT: its number, its card(s), its arrows. Units are spaced apart; the
     cards INSIDE a sequence unit are not (Sophie: sequences "attached like
     right next to each other", the loose ones with "a little space"). */
  .unit {
    display: grid; grid-template-columns: 34px 1fr 22px;
    gap: 9px; align-items: start; margin-bottom: 14px;
  }
  .mcard {
    position: relative; background: var(--surface);
    border: 1px solid var(--line); border-radius: 6px;
    padding: 10px 30px 10px 11px;
  }
  .say { font-size: 16px; line-height: 1.45; }
  .x {
    font: 700 10px/1 -apple-system, sans-serif; letter-spacing: .06em;
    color: var(--gold); border: 1px solid #e0d6c4; background: #f6f0e4;
    border-radius: 6px; padding: 3px 5px; margin-left: 5px; white-space: nowrap;
  }
  /* the sequence stack — one block, hairlines shared, only the outer corners
     rounded, and a gold edge so it still reads as one thing while scrolling */
  .seq .mcard { border-radius: 0; margin-top: -1px; border-left: 3px solid var(--gold); }
  .seq .mcard:first-child { border-top-left-radius: 6px; border-top-right-radius: 6px; margin-top: 0; }
  .seq .mcard:last-child { border-bottom-left-radius: 6px; border-bottom-right-radius: 6px; }

  /* the number — a text box she can type a new place into */
  .no {
    width: 34px; height: 30px; text-align: center;
    font: 700 16px/1 -apple-system, 'Helvetica Neue', sans-serif;
    color: var(--ink2); background: var(--surface);
    border: 1px solid var(--line); border-radius: 6px; padding: 0;
    -webkit-text-size-adjust: 100%;   /* iOS must not zoom the page on focus */
  }
  .no:focus { outline: none; border-color: var(--gold); color: var(--gold); }
  .seq .no { border-color: #e0d6c4; background: #f6f0e4; color: var(--gold); }

  /* the arrows */
  .mv { display: flex; flex-direction: column; gap: 4px; }
  .mv button {
    width: 22px; height: 22px; padding: 0; display: flex;
    align-items: center; justify-content: center;
    border: 1px solid var(--line); border-radius: 6px;
    background: var(--surface); color: var(--ink2);
  }
  .mv button svg { width: 14px; height: 14px; display: block; }
  .mv button:disabled { opacity: .28; }

  .cast { border-style: dashed; }
  .reflab {
    display: block; font: 700 10px/1 -apple-system, 'Helvetica Neue', sans-serif;
    letter-spacing: .16em; text-transform: uppercase;
    color: var(--ink2); padding-bottom: 6px;
  }
  .cast .say { color: var(--ink2); font-size: 15px; }
</style>

<div class="wrap">
  <h1>${esc(data.title)}</h1>
  <ol class="tl" id="tl">
${units.map(unit).join('\n')}
  </ol>
</div>

<script src="/compare.js"></script>
<script>
(function () {
  var CHAT = '${data.chat}', SHEET = '${data.sheet}', ORDER = '${data.order}';
  var tl = document.getElementById('tl');

  // The DOM nodes are MOVED, never rebuilt — re-rendering would throw away the
  // note boxes /compare.js hangs off each card (and her half-typed note in one).
  var nodes = {}, order = [];
  Array.prototype.forEach.call(tl.children, function (li) {
    var id = li.getAttribute('data-unit');
    nodes[id] = li; order.push(id);
  });

  function paint() {
    var n = 0;
    order.forEach(function (id, i) {
      var li = nodes[id];
      tl.appendChild(li);                       // appendChild MOVES an existing node
      var box = li.querySelector('.no');
      if (box) { n++; if (document.activeElement !== box) box.value = n; }
      li.querySelector('.up').disabled = i === 0;
      li.querySelector('.dn').disabled = i === order.length - 1;
    });
  }

  var saveT = null;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      fetch('/api/chatfeed/verdict', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: CHAT, sheet: ORDER, item: 'order', text: order.join(',') }),
      }).catch(function () { /* offline — the arrangement is still on screen */ });
    }, 400);
  }

  function moveTo(id, to) {
    var from = order.indexOf(id);
    if (from < 0 || to < 0 || to > order.length - 1 || to === from) return paint();
    order.splice(from, 1);
    order.splice(to, 0, id);
    paint(); save();
  }

  tl.addEventListener('click', function (e) {
    var b = e.target.closest('.up, .dn');
    if (!b) return;
    var id = b.closest('.unit').getAttribute('data-unit');
    var i = order.indexOf(id);
    moveTo(id, b.classList.contains('up') ? i - 1 : i + 1);
  });

  // typing a number moves it to that place. Only NUMBERED units count toward a
  // place, so the unnumbered character card is stepped over rather than landed on.
  // It is PULLED OUT FIRST and the place counted in what is left — counting in
  // the list it is still sitting in lands it one short of what she typed.
  function commit(box) {
    var id = box.closest('.unit').getAttribute('data-unit');
    var want = parseInt(box.value, 10);
    if (!want || want < 1) return paint();
    var rest = order.slice();
    rest.splice(rest.indexOf(id), 1);
    var seen = 0, to = rest.length;              // past the end = last place
    for (var i = 0; i < rest.length; i++) {
      if (!nodes[rest[i]].querySelector('.no')) continue;
      if (seen === want - 1) { to = i; break; }
      seen++;
    }
    rest.splice(to, 0, id);
    order = rest; paint(); save();
  }
  tl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.classList.contains('no')) { e.preventDefault(); e.target.blur(); }
  });
  tl.addEventListener('blur', function (e) {
    if (e.target.classList && e.target.classList.contains('no')) commit(e.target);
  }, true);

  // her saved arrangement wins over the order in the file
  fetch('/api/chatfeed/verdict?chat=' + encodeURIComponent(CHAT) + '&sheet=' + encodeURIComponent(ORDER))
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; })
    .then(function (d) {
      var saved = d && d.texts && d.texts.order;
      if (saved) {
        var keep = saved.split(',').filter(function (id) { return nodes[id]; });
        order.forEach(function (id) { if (keep.indexOf(id) < 0) keep.push(id); });
        order = keep;
      }
      paint();
    });
  paint();

  window.__compareNotes({ chat: CHAT, sheet: SHEET });
  window.__compareHelp({ html: '<b>Type a number to send a moment there, or nudge it '
    + 'with the arrows.</b> It saves as you go. A sequence is the stack of cards '
    + 'under one number — it moves whole. The + on any card leaves a note.' });
})();
</script>
`;

const v = data.title.match(/\bv(\d+)\b/);
const out = path.join(ROOT, 'docs/story-timeline', (v ? 'timeline-v' + v[1] : 'timeline') + '.html');
fs.writeFileSync(out, html);
console.log('wrote ' + path.relative(ROOT, out) + '  ('
  + units.length + ' numbered units, ' + html.length + ' bytes)');

if (process.argv.includes('--order')) {
  fetch(BASE + '/api/chatfeed/verdict?chat=' + encodeURIComponent(data.chat)
        + '&sheet=' + encodeURIComponent(data.order))
    .then((r) => r.json())
    .then((d) => console.log((d.texts && d.texts.order) || '(nothing saved yet)'));
}

if (process.argv.includes('--post')) {
  fetch(BASE + '/api/chatfeed/page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: data.chat, title: data.title, html }),
  }).then((r) => r.json()).then((d) => console.log(JSON.stringify(d, null, 2)));
}
