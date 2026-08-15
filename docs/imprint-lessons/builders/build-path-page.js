#!/usr/bin/env node
/* build-path-page.js — THE LESSONS AS A PATH (Aug 2026, Sophie's ask).
 *
 * "Right now each lesson is its own square. What I want is a step-up header
 *  of lesson CATEGORIES, so you click on that — you know that app Imprint? —
 *  and find the S curve we made for the pipeline: match that S curve and make
 *  it a path, so you can see all the lessons that are coming up, but you can
 *  only do the most current one and the others are locked."
 *
 * Three screens in ONE page (nothing about a lesson is fetched — the copy is
 * embedded, same data the chapters page reads):
 *   1. the CATEGORIES        — the step up, five rows
 *   2. the PATH              — the pipeline's S, one node per lesson
 *   3. the LESSON            — its cards, and the button that unlocks the next
 *
 * THE S IS THE PIPELINE'S S, not a new one. `roadPath()` below is the v8 road
 * from `s-curve-content-pipeline` verbatim in shape: bowls joined on a centre
 * line, tangent horizontal at every join, LEFT TO RIGHT (it starts top-left
 * and sweeps right over the top, so it reads the way she reads), stroked
 * twice — edges under surface — so it has a road's width. The only thing this
 * page varies is HOW MANY bowls, because a category holds 3-6 lessons where
 * the pipeline holds 13 stops. Do not redraw it from memory: the sweep flags
 * alternate, and getting one wrong bends the S backwards (that is what the
 * pipeline's v7 mirror was about).
 *
 * PROGRESS is per CATEGORY and lives in localStorage — the current lesson is
 * the first one in that path she has not finished, everything after it is
 * locked, everything before it stays open to re-read. Nothing is on a server:
 * the page is static HTML in Storage like every Compare page.
 *
 *   node docs/imprint-lessons/builders/build-path-page.js            # write it
 *   node docs/imprint-lessons/builders/build-path-page.js --post     # + post it
 *
 * Data: docs/imprint-lessons/specs/lessons-path.json — the 21 lessons' copy
 * (lifted from the live "The lessons, in your words" chapters page) plus the
 * five categories, which are the h2s off the bookmarked "The Lessons" page.
 */
const fs = require('fs');
const path = require('path');

const SPEC = path.join(__dirname, '..', 'specs', 'lessons-path.json');
const OUT = path.join(__dirname, '..', 'built', 'lessons-path.html');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
/* The page is built PER CHAT, because the chat is baked into it: her notes on
   a category go to whichever chat the page belongs to. Default is her Imprint
   chat; `--chat <slug>` posts the same page into another one. */
const argChat = process.argv.indexOf('--chat');
const CHAT = (argChat !== -1 && process.argv[argChat + 1])
  || process.env.FORGE_CHAT || 'deck-factory-story-room';
const V = 'v2';
const TITLE = 'The Lessons — the path ' + V;
/* The sheet keys her notes, so it carries the version: v2 is a different set
   of items only in that it is a different page, and a note left on v1 belongs
   to v1. */
const SHEET = 'lessons-path-' + V;

const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));

/* the data the page carries. `</script>` inside her words would end the block
   early, so the one sequence that can do that is escaped and nothing else is
   touched — the copy stays verbatim. */
const DATA = JSON.stringify(spec).replace(/<\//g, '<\\/');

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${TITLE}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  /* the title row — the back chevron is a circular icon button, which is the
     one shape the no-pills rule exempts. The pill owns the top-RIGHT corner,
     so nothing goes there (compare.css already reserves 56px on the h1). */
  .hd { display: flex; align-items: center; gap: 9px; margin-bottom: 16px; }
  .hd h1 { margin: 0; }
  /* a lesson's own title is a whole sentence — at the masthead's 26px it eats
     three lines before the first card */
  .hd.deep h1 { font-size: 19px; line-height: 1.3; }
  .backb {
    flex: none; width: 32px; height: 32px; border-radius: 50%;
    border: 1px solid var(--line); background: var(--surface); color: var(--ink);
    display: flex; align-items: center; justify-content: center; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .backb svg { width: 18px; height: 18px; }

  /* 1 — THE CATEGORIES. A row is the lesson's own drawing, its name, and how
     far in she is; the count is the only text that isn't a name. */
  .cats { display: flex; flex-direction: column; gap: 8px; }
  .cat {
    display: flex; align-items: center; gap: 12px;
    background: var(--surface); border: 1px solid var(--line); border-radius: 6px;
    padding: 11px 12px 11px 11px; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .cat img { flex: none; width: 46px; height: 46px; border-radius: 8px; object-fit: cover; }
  .cat .nm {
    flex: 1; min-width: 0;
    font: 700 13px/1.3 -apple-system, 'Helvetica Neue', sans-serif;
    letter-spacing: .1em; text-transform: uppercase;
  }
  /* the count sits left of x=326: the pill owns the top-right corner and the
     first row is under it (a chevron there was invisible on row one) */
  .cat .ct { font: 400 12px/1 -apple-system, sans-serif; color: var(--ink2); padding-right: 26px; }

  /* 2 — THE PATH. The board is the pipeline's board: one flat colour, the
     road drawn on it, nothing else. */
  .board {
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 6px; padding: 6px 2px 8px;
  }
  .board svg { display: block; width: 100%; height: auto; }

  /* 3 — THE LESSON. The card shape is the chapters page's copy level, so a
     lesson reads here exactly as it reads there. */
  .legend {
    font: 400 11px/1.5 -apple-system, sans-serif; letter-spacing: .05em;
    color: var(--ink2); margin-bottom: 4px;
  }
  .cp { display: flex; gap: 12px; padding: 13px 0; border-bottom: 1px solid var(--line); }
  .cp:last-child { border-bottom: 0; }
  .cpimg { flex: none; width: 72px; height: 72px; border-radius: 8px; object-fit: cover; }
  .cptxt { flex: 1; min-width: 0; }
  .cpk {
    font: 400 9px/1.4 -apple-system, sans-serif; letter-spacing: .12em;
    text-transform: uppercase; color: var(--ink2); margin: 0 0 1px;
  }
  .cph { font: 700 15px/1.35 Georgia, serif; margin: 0 0 4px; }
  .cpb { font-size: 14.5px; line-height: 1.55; margin: 0; white-space: pre-wrap; }
  .mine { color: var(--rose); }
  .mine:before { content: "\\2731"; font-size: 8px; vertical-align: super; margin-right: 1px; }
  /* a button is only as wide as its words */
  .endrow { display: flex; padding: 18px 0 4px; }
  .donebtn {
    border: 1px solid var(--chg); border-radius: 6px; background: var(--chg);
    color: #fffdf8; padding: 9px 18px; cursor: pointer;
    font: 700 12px/1 -apple-system, sans-serif; letter-spacing: .12em; text-transform: uppercase;
  }
  .donebtn.was { background: var(--surface); color: var(--ink2); border-color: var(--line); }
</style>

<div class="wrap">
  <div class="hd">
    <button class="backb" id="back" type="button" aria-label="back" hidden></button>
    <h1 id="title">The Lessons</h1>
  </div>

  <!-- taps in here navigate, so they may PAUSE the autoscroll but must never
       start it (the embedded-in-the-app contract) -->
  <div class="cats" id="v-cats" data-nostop></div>

  <div id="v-path" data-nostop hidden>
    <div class="board"><svg id="road" role="img" aria-label="the lessons in this category"></svg></div>
  </div>

  <div id="v-lesson" data-nostop hidden></div>
</div>

<script src="/compare.js"></script>
<script id="lsdata" type="application/json">${DATA}</script>
<script>
/* IIFE — the injected pill runs in global scope and declares var raf / var I /
   var playing; a page-level let would kill its script at parse time. */
(function () {
  var SVGNS = 'http://www.w3.org/2000/svg';
  var D = JSON.parse(document.getElementById('lsdata').textContent);
  var BY = {};
  D.lessons.forEach(function (l) { BY[l.id] = l; });

  var KEY = 'imprint-lessons-done-v1';
  function doneSet() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { return []; }
  }
  function isDone(id) { return doneSet().indexOf(id) !== -1; }
  function markDone(id) {
    var d = doneSet();
    if (d.indexOf(id) === -1) { d.push(id); }
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  }
  // the CURRENT lesson of a category = the first one in it she hasn't finished
  function currentOf(cat) {
    for (var i = 0; i < cat.lessons.length; i++) if (!isDone(cat.lessons[i])) return i;
    return cat.lessons.length;   // the whole path is walked
  }

  function el(n, a) {
    var e = document.createElementNS(SVGNS, n);
    for (var k in a) e.setAttribute(k, a[k]);
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  /* [[words]] = words that are MINE, not hers — red with a small star, the
     chapters page's marker, kept so nothing of mine can pass as hers. */
  function copyLine(s) {
    return esc(s)
      .replace(/\\[\\[([^\\]]+)\\]\\]/g, '<span class="mine">$1</span>')
      .replace(/\\*\\*([^*]+)\\*\\*/g, '<b>$1</b>');
  }

  /* ── the road ──────────────────────────────────────────────────────────
     THE S, take two (Sophie, on v1: "it isn't an S curve, it's zigzags and
     then at the end it gets really small in the corner"). She was right about
     both, and both came from copying the pipeline's construction — a chain of
     half-ellipse ARCS — without copying its proportions:

     - the ZIGZAG. An arc bowl has a VERTICAL tangent at its extreme, so its
       radius of curvature there is ry²/rx — 43px at the sizes this page uses.
       That is a hairpin: the road ran out flat, whipped around, and ran back,
       which reads as switchbacks, not as a letter S. The pipeline gets away
       with it because its bowls are 280x100 and its stops are half this size.
     - the CORNER. The pipeline's road ends with a quarter arc onto the right
       edge, correct for its FOUR bowls. With an odd number the last bowl ends
       pointing the other way, so that quarter doubled back — the little tail
       that "gets really small in the corner". A shape that is only right for
       even counts has no business being generated for any count.

     So the road is a SINE serpentine of cubic beziers now: it flows through
     its extremes instead of turning at them, it starts at the top left and
     ends ON the last stop with nothing trailing past it, and it is the
     pipeline's flat-and-wide proportion (280 across, 138 down per half turn),
     which is the S she was pointing at. */
  var CX = 200, A = 140, ROW = 138, Y0 = 70, R = 30;
  function roadPath(rows) {
    var d = 'M' + (CX - A) + ' ' + Y0, x = CX - A, y = Y0;
    for (var r = 0; r < rows; r++) {
      var x1 = (r % 2 === 0) ? CX + A : CX - A, y1 = y + ROW;
      // control points straight above/below each end: the tangent is vertical
      // at the joins and the curve stays symmetric, which is what makes it
      // read as one continuous S rather than a stack of separate curves
      d += 'C' + x + ' ' + (y + ROW * 0.55) + ' ' + x1 + ' ' + (y1 - ROW * 0.55)
        + ' ' + x1 + ' ' + y1;
      x = x1; y = y1;
    }
    return d;
  }
  /* half turns per path. Two is the floor — one is a shallow diagonal, not an
     S — and after that it is one more per lesson, which keeps the stops about
     as far apart as the pipeline keeps its own. */
  function bowls(n) { return Math.max(2, n - 2); }

  // SVG has no text wrapping: a long name is split by words into two lines
  function wrap2(s, per) {
    var words = String(s).split(' '), lines = [''], i;
    for (i = 0; i < words.length; i++) {
      var t = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + words[i] : words[i];
      if (t.length > per && lines[lines.length - 1]) lines.push(words[i]);
      else lines[lines.length - 1] = t;
    }
    return lines.slice(0, 2);
  }

  var LOCK = 'M4.5 10.5h11a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-11'
           + 'A1.5 1.5 0 0 1 3 17v-5a1.5 1.5 0 0 1 1.5-1.5zM6.4 10.5V7.2a3.6 3.6 0 0 1 7.2 0v3.3';
  var TICK = 'M4 10.5l4.2 4.4L16 6.6';

  function badge(g, x, y, kind) {
    g.appendChild(el('circle', { cx: x, cy: y, r: 10,
      fill: kind === 'done' ? 'var(--green)' : '#efe9dc',
      stroke: 'var(--surface)', 'stroke-width': 2 }));
    g.appendChild(el('path', {
      d: kind === 'done' ? TICK : LOCK,
      transform: 'translate(' + (x - 6) + ' ' + (y - 6) + ') scale(0.6)',
      fill: 'none', stroke: kind === 'done' ? '#fffdf8' : 'var(--ink2)',
      'stroke-width': kind === 'done' ? 2.6 : 2,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }));
  }

  function drawPath(cat) {
    var svg = document.getElementById('road');
    var ids = cat.lessons, N = ids.length, n = bowls(N);
    var H = Y0 + n * ROW + 78;   // + the last stop's node and its two label lines
    svg.setAttribute('viewBox', '0 0 400 ' + H);
    svg.textContent = '';

    var d = roadPath(n);
    // the road: edges under surface, the pipeline's two strokes
    svg.appendChild(el('path', { d: d, fill: 'none', stroke: '#ded2bd',
      'stroke-width': 27, 'stroke-linecap': 'round' }));
    svg.appendChild(el('path', { d: d, fill: 'none', stroke: 'var(--paper)',
      'stroke-width': 22, 'stroke-linecap': 'round' }));

    var track = el('path', { d: d, fill: 'none', stroke: 'none' });
    svg.appendChild(track);
    var L = track.getTotalLength(), PAD = 16;
    var cur = currentOf(cat);

    ids.forEach(function (id, i) {
      var ls = BY[id];
      var p = track.getPointAtLength(N === 1 ? L / 2 : PAD + i * (L - 2 * PAD) / (N - 1));
      var state = i < cur ? 'done' : (i === cur ? 'now' : 'locked');
      var g = el('g', state === 'locked' ? {} : { 'data-open': id });
      if (state !== 'locked') g.style.cursor = 'pointer';

      g.appendChild(el('rect', {
        x: p.x - R, y: p.y - R, width: R * 2, height: R * 2, rx: 9,
        fill: state === 'locked' ? '#f2ede3' : 'var(--surface)',
        stroke: state === 'now' ? 'var(--chg)' : 'var(--line)',
        'stroke-width': state === 'now' ? 3 : 1.5,
      }));
      var img = el('image', {
        href: ls.icon, x: p.x - R + 6, y: p.y - R + 6, width: R * 2 - 12, height: R * 2 - 12,
        preserveAspectRatio: 'xMidYMid meet',
      });
      // she asked to SEE what is coming — a locked lesson keeps its drawing,
      // faint, rather than being replaced by a blank
      if (state === 'locked') img.setAttribute('opacity', '0.3');
      g.appendChild(img);
      if (state === 'done') badge(g, p.x + R - 5, p.y + R - 5, 'done');
      if (state === 'locked') badge(g, p.x + R - 5, p.y + R - 5, 'lock');
      svg.appendChild(g);

      // the label, clamped so a long name slides inward instead of clipping
      var lx = Math.max(58, Math.min(342, p.x));
      wrap2(ls.short, 22).forEach(function (line, k) {
        var t = el('text', {
          x: lx, y: p.y + R + 15 + k * 12, 'text-anchor': 'middle',
          fill: state === 'locked' ? 'var(--ink2)' : 'var(--ink)',
          'paint-order': 'stroke', stroke: 'var(--surface)', 'stroke-width': 3,
        });
        t.style.font = (state === 'now' ? '700 ' : '400 ') + '10.5px -apple-system, sans-serif';
        t.textContent = line;
        svg.appendChild(t);
      });
    });
  }

  /* ── the three screens ─────────────────────────────────────────────── */
  var vCats = document.getElementById('v-cats');
  var vPath = document.getElementById('v-path');
  var vLesson = document.getElementById('v-lesson');
  var hTitle = document.getElementById('title');
  var back = document.getElementById('back');
  back.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    + 'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="m15 18-6-6 6-6"/></svg>';

  var openCat = null;

  function paintCats() {
    vCats.textContent = '';
    D.cats.forEach(function (cat) {
      var done = cat.lessons.filter(isDone).length;
      var row = document.createElement('div');
      row.className = 'cat';
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.setAttribute('data-item', 'cat-' + cat.id);
      row.innerHTML =
        '<img src="' + esc(BY[cat.lessons[0]].icon) + '" alt="">' +
        '<span class="nm">' + esc(cat.name) + '</span>' +
        '<span class="ct">' + done + ' of ' + cat.lessons.length + '</span>';
      // the row is the whole tap target, so the note box compare.js hangs
      // inside it has to be carved out or writing a note opens the category
      row.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('.cmp-note')) return;
        showPath(cat);
      });
      vCats.appendChild(row);
    });
    if (window.__compareNotes) {
      window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(SHEET)} });
    }
  }

  function show(which) {
    document.querySelector('.hd').classList.toggle('deep', which === 'lesson');
    vCats.hidden = which !== 'cats';
    vPath.hidden = which !== 'path';
    vLesson.hidden = which !== 'lesson';
    back.hidden = which === 'cats';
    window.scrollTo(0, 0);
  }

  function showCats() {
    openCat = null;
    hTitle.textContent = 'The Lessons';
    paintCats();
    show('cats');
  }

  function showPath(cat) {
    openCat = cat;
    hTitle.textContent = cat.name;
    show('path');
    drawPath(cat);
  }

  function showLesson(id) {
    var ls = BY[id];
    hTitle.textContent = ls.title;
    var h = '<div data-item="lesson-' + esc(id) + '">' +
      '<div class="legend">your words in ink &middot; ' +
      '<span class="mine">red&nbsp;=&nbsp;a word that is mine, not yours</span></div>';
    ls.cards.forEach(function (c) {
      h += '<div class="cp">' +
        (c.img ? '<img class="cpimg" src="' + esc(c.img) + '" alt="">' : '') +
        '<div class="cptxt">' +
        (c.kicker ? '<p class="cpk">' + copyLine(c.kicker) + '</p>' : '') +
        (c.h ? '<p class="cph">' + copyLine(c.h) + '</p>' : '') +
        '<p class="cpb">' + copyLine(c.body || '') + '</p>' +
        '</div></div>';
    });
    h += '</div><div class="endrow"><button class="donebtn' + (isDone(id) ? ' was' : '') +
      '" id="donebtn" type="button">' + (isDone(id) ? 'Back to the path' : 'Done') + '</button></div>';
    vLesson.innerHTML = h;
    document.getElementById('donebtn').addEventListener('click', function () {
      markDone(id);
      showPath(openCat);
    });
    show('lesson');
    if (window.__compareNotes) {
      window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(SHEET)} });
    }
  }

  // a tap on an unlocked stop opens it — a locked one carries no data-open,
  // so it is simply not a target
  document.getElementById('road').addEventListener('click', function (e) {
    var g = e.target && e.target.closest ? e.target.closest('[data-open]') : null;
    if (g) showLesson(g.getAttribute('data-open'));
  });

  back.addEventListener('click', function () {
    if (!vLesson.hidden) showPath(openCat);
    else showCats();
  });
  // the app's own chevron asks the page first
  window.__navBack = function () {
    if (!vCats.hidden) return false;
    if (!vLesson.hidden) showPath(openCat); else showCats();
    return true;
  };

  showCats();

  if (window.__compareHelp) {
    window.__compareHelp({ html:
      '<p>A category opens its path. You can open the lesson with the gold ring ' +
      'and any lesson behind it; the ones ahead unlock as you finish them ' +
      '&mdash; <b>Done</b> at the end of a lesson moves the ring on.</p>' });
  }
})();
</script>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log('wrote ' + OUT + ' (' + html.length + ' bytes)');

if (process.argv.indexOf('--post') !== -1) {
  fetch(BASE + '/api/chatfeed/page', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title: TITLE, html: html }),
  }).then(function (r) { return r.json(); }).then(function (d) {
    console.log(JSON.stringify(d, null, 1));
    if (d && d.id) console.log(BASE + '/api/chatfeed/page/' + d.id);
  }).catch(function (e) { console.error(e); process.exit(1); });
}
