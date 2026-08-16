#!/usr/bin/env node
/* gen-story-timeline.js — build Sophie's story timeline Compare page from
   docs/story-timeline/beats.json.
     node scripts/gen-story-timeline.js            # write the html
     node scripts/gen-story-timeline.js --post     # write it AND post the page
     node scripts/gen-story-timeline.js --order    # print back everything she changed

   THE CARD IS THE ATOM, THE UNIT IS WHAT MOVES. A unit is one moment or a
   whole sequence of them, and a unit carries ONE number (Sophie, v2: "have the
   sequences just have one number since they will stay together"). She builds
   the units herself — the mark in the gap joins two into one, the one under a
   number breaks one apart — so the grouping is HERS, not the JSON's.

   EVERYTHING SHE CHANGES LIVES ON THE SERVER, NOT IN THIS FILE, on the chat's
   verdict doc under `data.order`. Three kinds of record, so a rebuild of this
   page can never overwrite her work:
     order      `b1|b2|b3,b4,b5`  — `|` between units, `,` inside one
     t:<id>     the words of one moment, when she has edited it or added it
     gone       the ids she deleted, so they are not resurrected on load
   The older order format (unit ids joined by commas, a sequence written
   `s-b3`) is still read, so an arrangement from v3 carries over.

   Ids are stable to the TEXT, not the position (`b7` is the belly button
   forever; a moment she adds gets its own `n…` id at birth), so neither her
   notes nor her arrangement slide onto a different moment when the JSON moves.

   THE JSON IS THE STARTING POINT, NOT THE TRUTH, once she has touched a page:
   fold her `--order` output back into beats.json before changing the source
   text of a moment she has edited, or her version silently wins and the two
   drift apart.

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

/* blocks → the STARTING units. A `seq` block starts life as one unit. */
const units = data.blocks.map((b) => (b.kind === 'seq'
  ? { kind: 'seq', beats: b.beats }
  : { kind: b.kind, beats: [b] }));

// The "2x" tag sits OUTSIDE .say on purpose: .say holds nothing but the words,
// so editing a moment can read and write its text without eating the tag.
function card(b) {
  const lab = b.kind === 'ref' ? `<span class="reflab">${esc(b.label)}</span>` : '';
  const tag = b.tag ? `<span class="x">${esc(b.tag)}</span>` : '';
  return `<div class="mcard${b.kind === 'ref' ? ' cast' : ''}" data-item="${attr(b.id)}">`
    + `${lab}<span class="say">${esc(b.text)}</span>${tag}</div>`;
}

// The server paints the STARTING arrangement; the page script harvests the
// cards out of it and builds every unit shell itself from then on. So the page
// still reads as a plain list if the script never runs.
const start = units.map((u) => `      <li class="unit${u.beats.length > 1 ? ' seq' : ''}">`
  + `<div class="cards">${u.beats.map(card).join('')}</div></li>`).join('\n');

const html = `<!doctype html>
<!-- Built by scripts/gen-story-timeline.js from docs/story-timeline/beats.json.
     Edit the JSON and rebuild; never hand-edit this file. Her arrangement, her
     edits and her deletions are NOT in here — they live on the server. -->
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(data.title)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  /* layout only — every colour is a /compare.css token */
  .tl { list-style: none; margin-top: 12px; }
  .tl li::before { content: none; }

  /* A UNIT: its number, its card(s), its arrows. The cards INSIDE a unit are
     attached; the space BETWEEN units is the gap strip below (Sophie:
     sequences "attached like right next to each other", the loose ones with
     "a little space"). */
  .unit {
    /* minmax(0,1fr), never plain 1fr: a folded middle sets white-space nowrap,
       and a plain 1fr track grows to its min-content — so the whole sequence
       (the untrimmed ends with it) shot off the right of the screen instead of
       ellipsising. */
    display: grid; grid-template-columns: 30px minmax(0, 1fr) 43px;
    gap: 8px; align-items: start;
  }
  .cards { min-width: 0; }
  .mcard {
    position: relative; background: var(--surface);
    border: 1px solid var(--line); border-radius: 6px;
    padding: 8px 28px 8px 10px;
  }
  .say { font-size: 14px; line-height: 1.42; }
  .x {
    font: 700 9px/1 -apple-system, sans-serif; letter-spacing: .06em;
    color: var(--gold); border: 1px solid #e0d6c4; background: #f6f0e4;
    border-radius: 6px; padding: 2px 4px; margin-left: 4px; white-space: nowrap;
  }
  /* a unit holding more than one card — hairlines shared, only the outer
     corners rounded, one gold edge so it reads as a single thing */
  .seq .mcard { border-radius: 0; margin-top: -1px; border-left: 3px solid var(--gold); }
  .seq .mcard:first-child { border-top-left-radius: 6px; border-top-right-radius: 6px; margin-top: 0; }
  .seq .mcard:last-child { border-bottom-left-radius: 6px; border-bottom-right-radius: 6px; }

  /* the number — a text box she can type a new place into. 16px because
     anything smaller makes iOS zoom the page when she taps it. */
  .no {
    width: 30px; height: 28px; text-align: center;
    font: 700 16px/1 -apple-system, 'Helvetica Neue', sans-serif;
    color: var(--ink2); background: var(--surface);
    border: 1px solid var(--line); border-radius: 6px; padding: 0;
    -webkit-text-size-adjust: 100%;
  }
  .no:focus { outline: none; border-color: var(--gold); color: var(--gold); }
  .seq .no { border-color: #e0d6c4; background: #f6f0e4; color: var(--gold); }

  /* left column = all the way, right column = one step */
  .mv { display: grid; grid-template-columns: 20px 20px; gap: 3px; }
  .mv button, .split, .gap button {
    padding: 0; display: flex; align-items: center; justify-content: center;
    border: 1px solid var(--line); border-radius: 6px;
    background: var(--surface); color: var(--ink2);
  }
  .mv button { width: 20px; height: 20px; }
  .mv button svg { width: 13px; height: 13px; display: block; }
  .mv button:disabled { opacity: .25; }
  .split { width: 30px; height: 20px; margin-top: 4px; }
  .split svg { width: 13px; height: 13px; display: block; }

  /* THE GAP between two units holds the things that act BETWEEN moments —
     join these two, add one here. It IS the gap, so they cost no height. */
  .gap {
    display: flex; align-items: center; justify-content: center;
    gap: 10px; height: 17px; margin: 0;
  }
  .gap button {
    width: 30px; height: 15px; border-color: transparent;
    background: transparent; color: #cfc4ae;
  }
  .gap button svg { width: 13px; height: 13px; display: block; }
  .gap button:hover { color: var(--gold); }

  /* a LONG unit folds: first and last whole, the middles one line each */
  .long:not(.open) .mcard.trim { padding-top: 4px; padding-bottom: 4px; }
  .long:not(.open) .mcard.trim .say {
    display: block; white-space: nowrap; overflow: hidden;
    text-overflow: ellipsis; color: var(--ink2);
  }
  .long:not(.open) .mcard.trim .pencil { display: none; }

  /* EDITING happens in the card, behind a pencil — never on a tap on the
     words themselves, or every stray thumb on the way down the page opens an
     editor. Deleting and dividing live INSIDE the open editor for the same
     reason: neither is ever one stray tap away. */
  .pencil {
    position: absolute; bottom: 7px; right: 33px; z-index: 2;
    width: 22px; height: 22px; padding: 0;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid var(--line); border-radius: 6px;
    background: var(--paper); color: var(--ink2);
  }
  .pencil svg { width: 12px; height: 12px; display: block; }
  .pencil:hover { color: var(--gold); border-color: var(--gold); }
  .edit { display: none; }
  .mcard.editing .say, .mcard.editing .x,
  .mcard.editing .pencil, .mcard.editing .cmp-note { display: none; }
  .mcard.editing .edit { display: block; }
  .etext {
    width: 100%; display: block;
    font: 16px/1.42 Georgia, 'Times New Roman', serif;   /* 16 or iOS zooms */
    color: var(--ink); background: var(--paper);
    border: 1px solid var(--gold); border-radius: 6px;
    padding: 7px 8px; resize: vertical;
    -webkit-text-size-adjust: 100%;
  }
  .etext:focus { outline: none; }
  .erow { display: flex; gap: 6px; margin-top: 6px; align-items: center; }
  .erow button {
    width: auto; font: 600 12px/1 -apple-system, 'Helvetica Neue', sans-serif;
    border: 1px solid var(--line); border-radius: 6px;
    background: var(--surface); color: var(--ink2); padding: 7px 9px;
  }
  .erow .del { color: var(--rose); border-color: #eccfc5; }
  .erow .del svg { width: 13px; height: 13px; display: block; }

  .cast { border-style: dashed; }
  .reflab {
    display: block; font: 700 9px/1 -apple-system, 'Helvetica Neue', sans-serif;
    letter-spacing: .16em; text-transform: uppercase;
    color: var(--ink2); padding-bottom: 5px;
  }
  .cast .say { color: var(--ink2); font-size: 13px; }
</style>

<div class="wrap">
  <h1>${esc(data.title)}</h1>
  <ol class="tl" id="tl">
${start}
  </ol>
</div>

<script src="/compare.js"></script>
<script>
(function () {
  var CHAT = '${data.chat}', SHEET = '${data.sheet}', ORDER = '${data.order}';
  var tl = document.getElementById('tl');

  // Lucide, inlined: single = one step, double = all the way, converging =
  // join these two, diverging = break this one apart, plus = add one here
  var GLYPH = {
    up: 'm18 15-6-6-6 6',
    dn: 'm6 9 6 6 6-6',
    top: 'm17 11-5-5-5 5|m17 18-5-5-5 5',
    bot: 'm7 6 5 5 5-5|m7 13 5 5 5-5',
    join: 'm7 20 5-5 5 5|m7 4 5 5 5-5',
    split: 'm7 15 5 5 5-5|m7 9 5-5 5 5',
    add: 'M12 5v14|M5 12h14',
    pencil: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
    trash: 'M3 6h18|M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  };
  function svg(k, px) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (px || 2) + '" '
      + 'stroke-linecap="round" stroke-linejoin="round">'
      + GLYPH[k].split('|').map(function (d) { return '<path d="' + d + '"/>'; }).join('')
      + '</svg>';
  }

  // THE CARDS ARE HARVESTED ONCE and never rebuilt — a rebuilt card loses the
  // note box /compare.js hung off it (and anything half-typed in one). Only the
  // unit shells around them are made and remade.
  var CARDS = {}, startArr = [];
  Array.prototype.forEach.call(tl.querySelectorAll('.unit'), function (li) {
    var g = [];
    Array.prototype.forEach.call(li.querySelectorAll('.mcard'), function (c) {
      var id = c.getAttribute('data-item'); CARDS[id] = c; g.push(id);
    });
    if (g.length) startArr.push(g);
  });
  var arr = startArr.map(function (g) { return g.slice(); });
  var gone = {}, edited = {};

  function words(id) {
    var s = CARDS[id] && CARDS[id].querySelector('.say');
    return s ? s.textContent : '';
  }
  function setWords(id, t) {
    var s = CARDS[id] && CARDS[id].querySelector('.say');
    if (s) s.textContent = t;
  }
  function newCard(id, text) {
    var d = document.createElement('div');
    d.className = 'mcard';
    d.setAttribute('data-item', id);
    d.innerHTML = '<span class="say"></span>';
    d.querySelector('.say').textContent = text || '';
    CARDS[id] = d;
    return d;
  }
  var madeAt = 0;
  function freshId() {                       // unique, and stable once written
    madeAt = Math.max(madeAt + 1, Date.now());
    return 'n' + madeAt.toString(36);
  }

  // A LONG SEQUENCE FOLDS (Sophie: "once a sequence gets to be really long …
  // it just shows the first and last moment and in between it just shows the
  // first line of each"). Tapping a folded middle opens the whole unit, and it
  // stays open across a move — keyed by the unit's first card, since indexes
  // shift under it.
  var LONG = 5, opened = {};

  function shell(group, i, n) {
    var li = document.createElement('li');
    var long = group.length >= LONG;
    li.className = 'unit' + (group.length > 1 ? ' seq' : '')
      + (long ? ' long' : '') + (long && opened[group[0]] ? ' open' : '');
    li.innerHTML = '<div class="gut">'
      + '<input class="no" type="text" inputmode="numeric" aria-label="its place in the order" value="' + (i + 1) + '">'
      + (group.length > 1 ? '<button class="split" type="button" aria-label="break this one apart">' + svg('split') + '</button>' : '')
      + '</div><div class="cards"></div><div class="mv">'
      + '<button class="top" type="button" aria-label="send it to the top">' + svg('top') + '</button>'
      + '<button class="up" type="button" aria-label="move it up one">' + svg('up') + '</button>'
      + '<button class="bot" type="button" aria-label="send it to the bottom">' + svg('bot') + '</button>'
      + '<button class="dn" type="button" aria-label="move it down one">' + svg('dn') + '</button>'
      + '</div>';
    var cards = li.querySelector('.cards');
    group.forEach(function (id, k) {                                 // MOVES the card
      var c = CARDS[id] || newCard(id, '');
      c.classList.toggle('trim', long && k > 0 && k < group.length - 1);
      if (!c.querySelector('.pencil')) {
        var p = document.createElement('button');
        p.type = 'button'; p.className = 'pencil';
        p.setAttribute('aria-label', 'change the words');
        p.innerHTML = svg('pencil', 1.8);
        c.appendChild(p);
      }
      cards.appendChild(c);
    });
    li.querySelector('.top').disabled = li.querySelector('.up').disabled = i === 0;
    li.querySelector('.bot').disabled = li.querySelector('.dn').disabled = i === n - 1;
    return li;
  }

  function gapRow(at, joinable) {
    var li = document.createElement('li');
    li.className = 'gap';
    li.innerHTML = (joinable
      ? '<button class="joinb" type="button" data-after="' + (at - 1) + '" aria-label="join these two into one">' + svg('join') + '</button>'
      : '')
      + '<button class="addb" type="button" data-at="' + at + '" aria-label="add a moment here">' + svg('add') + '</button>';
    return li;
  }

  function paint() {
    var rows = [];
    arr.forEach(function (g, i) {
      rows.push(gapRow(i, i > 0));
      rows.push(shell(g, i, arr.length));
    });
    rows.push(gapRow(arr.length, false));
    tl.replaceChildren.apply(tl, rows);
    // wire notes only when some card hasn't got one yet (a fetch on every arrow
    // tap would be a request per move)
    var needs = Array.prototype.some.call(tl.querySelectorAll('.mcard'), function (c) {
      return !c.querySelector(':scope > .cmp-note');
    });
    if (needs && window.__compareNotes) window.__compareNotes({ chat: CHAT, sheet: SHEET });
  }

  /* ---- saving. Three records, all on the ORDER sheet ---- */
  var timers = {};
  function post(item, text) {
    clearTimeout(timers[item]);
    timers[item] = setTimeout(function () {
      fetch('/api/chatfeed/verdict', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: CHAT, sheet: ORDER, item: item, text: text }),
      }).catch(function () { /* offline — it is all still on screen */ });
    }, 400);
  }
  function save() { post('order', arr.map(function (g) { return g.join(','); }).join('|')); }
  function saveText(id) { edited[id] = 1; post('t:' + id, words(id)); }
  function saveGone() { post('gone', Object.keys(gone).join(',')); }

  /* ---- moving ---- */
  function move(from, to) {
    if (from < 0 || to < 0 || to > arr.length - 1 || to === from) return paint();
    arr.splice(to, 0, arr.splice(from, 1)[0]);
    paint(); save();
  }
  function idxOf(li) { return Array.prototype.indexOf.call(tl.querySelectorAll('.unit'), li); }
  function where(id) {                        // [unit index, index within it]
    for (var i = 0; i < arr.length; i++) {
      var k = arr[i].indexOf(id);
      if (k >= 0) return [i, k];
    }
    return [-1, -1];
  }

  /* ---- editing one moment ---- */
  function openEditor(c) {
    if (c.querySelector('.edit')) return;
    var wrap = document.createElement('div');
    wrap.className = 'edit';
    wrap.innerHTML = '<textarea class="etext" rows="3"></textarea>'
      + '<div class="erow"><button class="divide" type="button">divide here</button>'
      + '<button class="del" type="button" aria-label="delete this moment">' + svg('trash', 1.8) + '</button></div>';
    var box = wrap.querySelector('.etext');
    box.value = words(c.getAttribute('data-item'));
    c.appendChild(wrap);
    c.classList.add('editing');
    box.style.height = Math.max(56, box.scrollHeight + 4) + 'px';
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }
  function closeEditor(c, keep) {
    var wrap = c.querySelector('.edit');
    if (!wrap) return;
    var id = c.getAttribute('data-item');
    if (keep !== false) {
      var v = wrap.querySelector('.etext').value;
      if (v !== words(id)) { setWords(id, v); saveText(id); }
    }
    c.classList.remove('editing');
    wrap.remove();
  }
  function closeAll(except) {
    Array.prototype.forEach.call(tl.querySelectorAll('.mcard.editing'), function (c) {
      if (c !== except) closeEditor(c);
    });
  }

  function addAt(at) {
    var id = freshId();
    newCard(id, '');
    arr.splice(at, 0, [id]);
    paint(); save(); saveText(id);
    var c = CARDS[id];
    if (c) { openEditor(c); c.scrollIntoView({ block: 'center' }); }
  }

  function divide(c) {
    var id = c.getAttribute('data-item');
    var box = c.querySelector('.etext');
    var cut = box.selectionStart;
    var all = box.value;
    if (cut <= 0 || cut >= all.length) return;          // nothing to divide
    var head = all.slice(0, cut).replace(/\\s+$/, '');
    var tail = all.slice(cut).replace(/^\\s+/, '');
    if (!head || !tail) return;
    closeEditor(c, false);
    setWords(id, head); saveText(id);
    var nid = freshId();
    newCard(nid, tail);
    var at = where(id);
    // inside a sequence the second half stays in that sequence; a moment on its
    // own divides into two moments on their own (her default)
    if (arr[at[0]].length > 1) arr[at[0]].splice(at[1] + 1, 0, nid);
    else arr.splice(at[0] + 1, 0, [nid]);
    paint(); save(); saveText(nid);
  }

  function remove(c) {
    var id = c.getAttribute('data-item');
    var at = where(id);
    if (at[0] < 0) return;
    closeEditor(c, false);
    arr[at[0]].splice(at[1], 1);
    if (!arr[at[0]].length) arr.splice(at[0], 1);
    delete CARDS[id];
    gone[id] = 1;
    paint(); save(); saveGone();
  }

  /* ---- one click handler for the lot ---- */
  tl.addEventListener('click', function (e) {
    if (e.target.closest('.cmp-note')) return;        // the note box is its own thing
    var b = e.target.closest('button');
    var card = e.target.closest('.mcard');

    if (b && b.classList.contains('addb')) { closeAll(); return addAt(+b.dataset.at); }
    if (b && b.classList.contains('joinb')) {
      closeAll();
      var j = +b.dataset.after;
      arr[j] = arr[j].concat(arr[j + 1]);
      arr.splice(j + 1, 1);
      paint(); save(); return;
    }
    if (b && b.classList.contains('pencil')) { closeAll(card); return openEditor(card); }
    if (b && b.classList.contains('divide')) return divide(card);
    if (b && b.classList.contains('del')) return remove(card);
    if (card && card.classList.contains('editing')) return;   // taps inside the editor

    if (!b) {                                        // a tap on a folded middle opens it
      var host = card && card.closest('.unit.long');
      if (!host) return;
      var head = host.querySelector('.mcard').getAttribute('data-item');
      opened[head] = host.classList.toggle('open');
      return;
    }

    var li = b.closest('.unit');
    if (!li) return;
    closeAll();
    var i = idxOf(li);
    if (b.classList.contains('split')) {
      arr.splice.apply(arr, [i, 1].concat(arr[i].map(function (id) { return [id]; })));
      paint(); save(); return;
    }
    if (b.classList.contains('up')) return move(i, i - 1);
    if (b.classList.contains('dn')) return move(i, i + 1);
    if (b.classList.contains('top')) return move(i, 0);
    if (b.classList.contains('bot')) return move(i, arr.length - 1);
  });

  // typing a number sends it to that place; the editor saves on the way out
  tl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.classList.contains('no')) { e.preventDefault(); e.target.blur(); }
  });
  tl.addEventListener('blur', function (e) {
    var t = e.target;
    if (t.classList && t.classList.contains('no')) {
      var i = idxOf(t.closest('.unit'));
      var want = parseInt(t.value, 10);
      return (!want || want < 1) ? paint() : move(i, Math.min(want, arr.length) - 1);
    }
    if (t.classList && t.classList.contains('etext')) {
      var c = t.closest('.mcard');
      // a tap on divide/delete blurs the box first, and those two close it
      // themselves — so hold only for a BUTTON in this same card. Holding for
      // anything inside the card meant a blur that left focus on the box (no
      // new focus target) never saved what she had typed.
      setTimeout(function () {
        var a = document.activeElement;
        var held = a && a.tagName === 'BUTTON' && a.closest && a.closest('.mcard') === c;
        if (!held) closeEditor(c);
      }, 120);
    }
  }, true);

  /* ---- load what she has already done ---- */
  function parse(saved) {
    var groups = saved.indexOf('|') >= 0
      ? saved.split('|').map(function (g) { return g.split(','); })
      // the older format: unit ids, a sequence written s-<its first beat>
      : saved.split(',').map(function (t) {
        if (t.indexOf('s-') !== 0) return [t];
        var head = t.slice(2), hit = null;
        startArr.forEach(function (g) { if (g[0] === head) hit = g; });
        return hit ? hit.slice() : [head];
      });
    var seen = {}, out = [];
    groups.forEach(function (g) {
      var keep = g.filter(function (id) {
        if (!CARDS[id] || seen[id] || gone[id]) return false;
        seen[id] = 1; return true;
      });
      if (keep.length) out.push(keep);
    });
    // nothing is ever dropped by an incomplete saved string — except what she
    // deleted on purpose
    Object.keys(CARDS).forEach(function (id) { if (!seen[id] && !gone[id]) out.push([id]); });
    return out;
  }

  fetch('/api/chatfeed/verdict?chat=' + encodeURIComponent(CHAT) + '&sheet=' + encodeURIComponent(ORDER))
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; })
    .then(function (d) {
      var t = (d && d.texts) || {};
      (t.gone || '').split(',').forEach(function (id) { if (id) gone[id] = 1; });
      Object.keys(t).forEach(function (k) {                 // her words win over the file
        if (k.indexOf('t:') !== 0) return;
        var id = k.slice(2);
        if (gone[id]) return;
        edited[id] = 1;
        if (CARDS[id]) setWords(id, t[k]); else newCard(id, t[k]);
      });
      Object.keys(gone).forEach(function (id) { delete CARDS[id]; });
      arr = parse(t.order || arr.map(function (g) { return g.join(','); }).join('|'));
      paint();
    });
  paint();

  window.__compareHelp({ html: '<b>Type a number to send a moment there.</b> Single '
    + 'arrows move it one place, double ones send it all the way up or down. In the '
    + 'gap between two moments: join them into one, or add a new one there. The mark '
    + 'under a number breaks a joined one apart. The pencil on a card changes its '
    + 'words — and while it is open you can divide the moment at the cursor or delete '
    + 'it. A long sequence folds to its first and last; tap it to see the whole thing. '
    + 'It all saves as you go.' });
})();
</script>
`;

const v = data.title.match(/\bv(\d+)\b/);
const out = path.join(ROOT, 'docs/story-timeline', (v ? 'timeline-v' + v[1] : 'timeline') + '.html');
fs.writeFileSync(out, html);
console.log('wrote ' + path.relative(ROOT, out) + '  ('
  + units.length + ' starting units, ' + html.length + ' bytes)');

if (process.argv.includes('--order')) {
  fetch(BASE + '/api/chatfeed/verdict?chat=' + encodeURIComponent(data.chat)
        + '&sheet=' + encodeURIComponent(data.order))
    .then((r) => r.json())
    .then((d) => {
      const t = (d && d.texts) || {};
      console.log('order: ' + (t.order || '(nothing saved yet)'));
      if (t.gone) console.log('deleted: ' + t.gone);
      Object.keys(t).filter((k) => k.indexOf('t:') === 0)
        .forEach((k) => console.log(k.slice(2) + ': ' + JSON.stringify(t[k])));
    });
}

if (process.argv.includes('--post')) {
  fetch(BASE + '/api/chatfeed/page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: data.chat, title: data.title, html }),
  }).then((r) => r.json()).then((d) => console.log(JSON.stringify(d, null, 2)));
}
