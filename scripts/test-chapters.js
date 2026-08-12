#!/usr/bin/env node
/* Tests the CHAPTERS page (public/chapters.js) — the catalog of a long chat —
 * the way a served page actually runs (real pill injected).
 *
 *   node scripts/test-chapters.js
 *
 * Checks the contract, both of Sophie's axes:
 *   1. every chapter is a row; opening one shows its body
 *   2. opening another COLLAPSES the first ("when I open one, the rest of
 *      them collapse") and tapping the open one closes it
 *   3. the horizontal axis: 1 gist → 2 deeper → 3 raw as the account-tabs
 *      hairline (a sliding line, no chips), and each level shows what it
 *      promises (level 3 = the real messages, both sides, in the chat style)
 *   3b. OPENING A CHAPTER DOES NOT MOVE THE PAGE (Sophie's v2 pain point:
 *      "I don't like how it jumps around when I open and close a tab")
 *   4. a message reaches the page VERBATIM — a chapter's raw text is the
 *      transcript slice, never a summary of it
 *   5. an attachment path renders as a chip carrying the real filename
 *   6. every chapter carries a note box (the standing rule)
 *   7. tapping the PROSE toggles the autoscroll like any other page, while
 *      every control is exempt — the row buttons, the level bar and the note
 *      box by the shared PILL_SKIP list, a long message by its own
 *      [data-nostop] (its expander is a .onclick property, which PILL_SKIP
 *      cannot see). The toggle itself only exists in the app's embedded
 *      viewer, so it is proven in scripts/test-page-embed.js; here we pin the
 *      MARKUP that decides it.
 *
 * Same harness as test-judge.js: headless Chromium, tiny server, the page
 * reports its verdict over HTTP. Skips with exit 0 if no Chromium.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const PUB = path.join(__dirname, '..', 'public');
const CANDIDATES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].filter(Boolean);
const chrome = CANDIDATES.find((p) => { try { fs.accessSync(p); return true; } catch (_) { return false; } })
  || (() => {
    try {
      const dir = '/opt/pw-browsers';
      const hit = fs.readdirSync(dir).find((d) => d.startsWith('chromium-'));
      const p = hit && path.join(dir, hit, 'chrome-linux', 'chrome');
      return p && fs.existsSync(p) ? p : null;
    } catch (_) { return null; }
  })();

if (!chrome) { console.log('no Chromium found — skipping (set CHROME_PATH to run)'); process.exit(0); }

const PAGE = `<!doctype html><meta charset="utf-8"><title>chapters test</title>
<link rel="stylesheet" href="/compare.css">
<div class="wrap">
  <div class="eyebrow">TEST</div><h1>Chapters</h1><div class="sub">a tagline</div>
  <div id="chapters"></div>
  <div id="chapters2"></div>
  <div id="chapters3"></div>
  <div id="chapters4"></div>
  <div id="chapters5"></div>
</div>
<script src="/compare.js"></script>
<script src="/chapters.js"></script>
__PILL__
<script>
window.addEventListener('error', function(e){
  fetch('/result?r=' + encodeURIComponent('FAIL: page error — ' + e.message + ' @' + (e.filename||'') + ':' + (e.lineno||'')));
});
</script>
<script>
(function(){
  var L=[];
  function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  var VERBATIM = "it's the genes — <not> a spectrum";
  window.__chapters({ chat:'t', sheet:'chapters', chapters:[
    { id:'a', title:'The research', when:'Jul 28', kind:'research',
      l1:'the gist of it', l2:['a **decided** thing','a shipped thing'],
      msgs:[ { who:'sophie', at:'2026-07-28T18:25:00Z', text:VERBATIM },
             { who:'claude', at:'2026-07-28T18:26:00Z', text:'the reply' } ] },
    { id:'b', title:'The astrology one', when:'Jul 28', kind:'lesson',
      l1:'second gist', l2:['another line'],
      msgs:[ { who:'sophie', at:'2026-07-28T21:12:00Z',
               text:'here it is @"/root/.claude/uploads/sid/abc123def-IMG_8170.png" have a look' } ] },
  ]});
  setTimeout(function(){
    var m=document.getElementById('chapters');
    var rows=m.querySelectorAll('.cx-ch');
    function body(i){ return rows[i].querySelector('.cx-body'); }
    // ONE bar for the page (v3) — it lives on the mount, not inside a body
    function bar(){ return m.querySelector(':scope > .cx-lv'); }
    function lvl(i,n){ bar().querySelector('button[data-lv="'+n+'"]').click(); }

    // 1 — rows, and the vertical axis
    ok(rows.length===2 && body(0).hidden && body(1).hidden, 'every chapter is a row, all closed to start');
    // v5, Sophie: "only the pill works to scroll — add tapping back, just
    // exempt the places to open and close things". The blanket opt-out on the
    // whole list is what made the pill the only way to start it.
    ok(!m.hasAttribute('data-nostop'),
       'the list is NOT blanket data-nostop, so a tap on the prose can scroll');
    ok(!!m.querySelector('.cx-head') && m.querySelector('.cx-head').tagName === 'BUTTON',
       'a chapter row is a real <button>, so the shared exempt list covers it');

    rows[0].querySelector('.cx-head').click();
    ok(!body(0).hidden && rows[0].classList.contains('on'), 'tapping a chapter opens it');

    // 2 — one at a time
    rows[1].querySelector('.cx-head').click();
    ok(body(0).hidden && !body(1).hidden, 'opening another collapses the first');
    rows[1].querySelector('.cx-head').click();
    ok(body(1).hidden, 'tapping the open one closes it');

    // 3 — the horizontal axis
    rows[0].querySelector('.cx-head').click();
    var b0=body(0);
    ok(!!b0.querySelector('.cx-l1') && !b0.querySelector('.cx-l2') && !b0.querySelector('.cx-msg'),
       'level 1 is the gist alone');
    ok(bar().getAttribute('data-on')==='1',
       'the hairline underline sits on the open level');
    ok(!bar().querySelector('button .cx-num'), 'the level switch is tabs, not numbered chips');
    ok(bar().querySelector('button[data-lv="1"]').classList.contains('on'),
       'a chapter opens at level 1');
    ok(!b0.querySelector('.cx-lv') && m.querySelectorAll('.cx-lv').length===1,
       'the level switch is ONE bar for the whole page, not a copy per chapter');
    lvl(0,2); b0=body(0);
    var lis=b0.querySelectorAll('.cx-l2 li');
    ok(lis.length===2 && !!lis[0].querySelector('b'), 'level 2 is the detail lines');
    // v5 — every level shows something DIFFERENT, so 2 does not repeat the gist
    ok(!b0.querySelector('.cx-l1'),
       'level 2 drops the one-sentence gist rather than restating it above the detail');
    lvl(0,3); b0=body(0);
    ok(bar().getAttribute('data-on')==='3', 'the line slides to level 3');
    var msgs=b0.querySelectorAll('.cx-msg');
    ok(msgs.length===2 && msgs[0].classList.contains('me') && msgs[1].classList.contains('them'),
       'level 3 is the real messages, both sides');
    ok(b0.querySelector('.cx-count').textContent.indexOf('2 messages')===0, 'level 3 counts them');

    // 4 — verbatim, and safely (a < in her words is text, never markup)
    ok(msgs[0].querySelector('.cx-text').textContent===VERBATIM,
       'a message reaches the page verbatim, escaped not interpreted');
    ok(!!msgs[0].querySelector('.cx-mhead .cx-who') && !!msgs[0].querySelector('.cx-prev'),
       'level 3 wears the chat message shape (head + preview + full)');
    ok(!msgs[0].classList.contains('long'), 'a short message is not collapsed');

    // 5 — an attachment renders as a chip carrying the real filename
    rows[1].querySelector('.cx-head').click(); lvl(1,3);
    var att=body(1).querySelector('.cx-att');
    var txt=body(1).querySelector('.cx-text').textContent;
    ok(att && att.textContent==='IMG_8170.png', 'an attachment path renders as a named chip');
    ok(txt.indexOf('here it is')===0 && txt.indexOf('have a look')>0 && txt.indexOf('/root/')<0,
       'the words around the attachment are untouched');

    // 5b — with NO icons supplied, the kind falls back to the colour dot
    ok(rows[0].querySelector('.cx-dot.cx-k-research') && rows[1].querySelector('.cx-dot.cx-k-lesson'),
       'with no icons supplied the kind falls back to its colour dot');

    // 5c — a page CAN supply a drawing per kind, and then it replaces the dot
    // (Sophie: "replace the little dots in different colors with the icons")
    window.__chapters({ chat:'t', sheet:'chapters2', mount:'#chapters2',
      icons:{ research:'/icon-magnifier.webp', lesson:'/icon-snake.webp' },
      chapters:[
        { id:'x', title:'With icons', when:'Jul 28', kind:'research', l1:'g', l2:['a'],
          msgs:[{ who:'sophie', at:'2026-07-28T18:25:00Z', text:'hi' }] },
        { id:'y', title:'Also icons', when:'Jul 28', kind:'lesson', l1:'g', l2:['a'],
          msgs:[{ who:'claude', at:'2026-07-28T18:26:00Z', text:'yo' }] },
      ]});
    var r2 = document.querySelectorAll('#chapters2 .cx-ch');
    var ico = r2[0] && r2[0].querySelector('.cx-ico');
    ok(!!ico && /icon-magnifier/.test(ico.getAttribute('src')),
       'a supplied icon replaces the dot, and it is the one for that kind');
    ok(!r2[0].querySelector('.cx-dot'), 'the coloured dot is gone when an icon is shown');
    ok(/icon-snake/.test(r2[1].querySelector('.cx-ico').getAttribute('src')),
       'each kind gets its own icon');

    // 5d — a chapter's OWN icon beats the per-kind one, so every row can differ
    window.__chapters({ chat:'t', sheet:'chapters3', mount:'#chapters3',
      icons:{ lesson:'/icon-snake.webp' },
      chapters:[
        { id:'p', title:'Its own', when:'Jul 28', kind:'lesson', icon:'/li-08-astrology.webp',
          l1:'g', l2:['a'], msgs:[
            { who:'sophie', at:'2026-07-28T18:25:00Z', text:'x'.repeat(300) },
            { who:'sophie', at:'2026-07-28T18:26:00Z', text:'hi' }] },
        { id:'q', title:'Falls back', when:'Jul 28', kind:'lesson',
          l1:'g', l2:['a'], msgs:[{ who:'sophie', at:'2026-07-28T18:26:00Z', text:'ho' }] },
      ]});
    var r3 = document.querySelectorAll('#chapters3 .cx-ico');
    ok(/li-08-astrology/.test(r3[0].getAttribute('src')),
       "a chapter's own icon wins over the kind icon");
    ok(/icon-snake/.test(r3[1].getAttribute('src')),
       'a chapter with no icon of its own still falls back to the kind icon');
    // it must NOT become a lightbox target — a tap on the row opens the chapter
    ok(!ico.matches('img.zoom, .imgrow img, .duo img'),
       'the icon is not a lightbox target, so tapping the row still opens it');
    r2[0].querySelector('.cx-head').click();
    ok(!r2[0].querySelector('.cx-body').hidden && !document.querySelector('.cmp-lb:not([hidden])'),
       'tapping a row with an icon opens the chapter and no lightbox');

    // 3b — opening and closing must not move the page under her
    document.body.style.height='4000px';
    window.scrollTo(0, 600);
    var y0=window.scrollY;
    rows[0].querySelector('.cx-head').click();     // opens (and collapses row 1)
    var y1=window.scrollY;
    rows[0].querySelector('.cx-head').click();     // closes it again
    var y2=window.scrollY;
    ok(Math.abs(y1-y0)<=2 && Math.abs(y2-y0)<=2,
       'opening and closing keeps the tapped row where it was (' + y0 + '→' + y1 + '→' + y2 + ')');

    // 6 — the standing rule
    ok(!!m.querySelector('.cmp-note-box') || !!m.querySelector('[data-item] .cmp-note'),
       'every chapter carries a note affordance');

    // 7b — v5: the drawing sits in a pastel tile and owns the row
    var ic = document.querySelector('.cx-ico');   // the icon mounts are #chapters2/3
    ok(!!ic && Math.round(ic.getBoundingClientRect().width) >= 40,
       'the row icon is big (' + Math.round(ic.getBoundingClientRect().width) + 'px)');
    var tile = ic.closest('.cx-tile');
    var tw = tile && Math.round(tile.getBoundingClientRect().width);
    ok(!!tile && tw >= 50, 'the icon sits in a tile (' + tw + 'px)');
    var bg = getComputedStyle(tile).backgroundColor;
    ok(bg.indexOf('rgb') === 0 && bg !== 'rgba(0, 0, 0, 0)', 'the tile is a real colour (' + bg + ')');
    ok(parseFloat(getComputedStyle(tile).borderRadius) >= 6, 'the tile is a rounded square');
    // the tile takes most of the row's height
    var rowH = tile.closest('.cx-head').getBoundingClientRect().height;
    ok(tw / rowH > 0.6, 'the tile owns most of the line (' + tw + ' of ' + Math.round(rowH) + ')');
    // adjacent rows never share a colour, and a row with no drawing still tiles
    var tiles = [].slice.call(document.querySelectorAll('#chapters2 .cx-tile'));
    var clash = tiles.some(function(t,ix){ return ix && getComputedStyle(t).backgroundColor
      === getComputedStyle(tiles[ix-1]).backgroundColor; });
    ok(!clash, 'no two touching rows wear the same pastel');
    var dotTile = document.querySelector('#chapters .cx-tile .cx-dot');  // that mount supplies no icons
    ok(!!dotTile, 'a chapter with no drawing still gets a tile, with its dot inside');
    // 7c — v4: the title alone; no gold eyebrow, no tagline
    var eb = document.querySelector('.wrap > .eyebrow'), sb = document.querySelector('.wrap > .sub');
    ok(!!eb && !!sb, '(setup) the page really carries an eyebrow and a sub');
    ok(getComputedStyle(eb).display === 'none' && getComputedStyle(sb).display === 'none',
       'a chapters page hides the eyebrow and the tagline, keeping the h1');
    ok(getComputedStyle(document.querySelector('.wrap > h1')).display !== 'none',
       'the title itself stays');

    // the tap opt-out, on the mount that actually carries a long message
    var m3 = document.getElementById('chapters3');
    m3.querySelector('.cx-ch .cx-head').click();
    m3.querySelector(':scope > .cx-lv button[data-lv="3"]').click();
    var lm = m3.querySelector('.cx-msg.long'), sm = m3.querySelector('.cx-msg:not(.long)');
    ok(!!lm && lm.hasAttribute('data-nostop'),
       'a LONG message is data-nostop — its expander is a .onclick property');
    ok(!!sm && !sm.hasAttribute('data-nostop'),
       'a short message has no handler, so it is left tappable-to-scroll');

    // 8 — v3, Sophie: "get rid of the numbers"
    ok(!m.querySelector('.cx-n') && !/^\s*\d\d\b/.test(rows[0].querySelector('.cx-t').textContent),
       'no 01/02 number on a row');

    // 9 — v3: the note + only exists on the OPEN chapter
    rows.forEach(function(r){ r.classList.remove('on'); });
    var plus = m.querySelector('[data-item] .cmp-note-open');
    ok(!!plus, 'the note + is built for every chapter');
    ok(getComputedStyle(plus).display === 'none', 'a CLOSED chapter shows no note +');
    rows[0].querySelector('.cx-head').click();
    ok(getComputedStyle(rows[0].querySelector('.cmp-note-open')).display !== 'none',
       'opening a chapter reveals its note +');

    // 10 — v3: ONE level for the whole page, and it survives switching chapter
    lvl(0,3);
    rows[1].querySelector('.cx-head').click();
    ok(!!body(1).querySelector('.cx-msg') && bar().getAttribute('data-on')==='3',
       'the level belongs to the PAGE — opening another chapter keeps raw, it does not reset to gist');
    lvl(1,1);
    ok(!body(1).querySelector('.cx-msg') && !!body(1).querySelector('.cx-l1'),
       'the bar drives whichever chapter is open');

    // 11 — v3: the bar is pinned, and every button of it is really tappable
    //      (it stays put when scrolled AND clears the autoscroll pill's corner)
    ok(getComputedStyle(bar()).position === 'sticky' && getComputedStyle(bar()).top === '0px',
       'the level bar is pinned to the top');
    /* Sticky is bounded by its PARENT, so scroll to somewhere still inside
       the list — that is exactly the range it has to survive (the real page
       has 27 chapters; here there are 2). Past the end of .cx it is meant to
       leave with the list it belongs to. */
    var cx = m.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, cx + m.offsetHeight - 60);
    var br = bar().getBoundingClientRect();
    ok(br.top >= -1 && br.top <= 2,
       'scrolled down the list, the bar is still at the top of the screen (top=' + Math.round(br.top) + ')');
    var buried = [];
    bar().querySelectorAll('button').forEach(function(b){
      var r = b.getBoundingClientRect();
      var hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
      if (!hit || !bar().contains(hit)) buried.push(b.textContent + '@' + Math.round(r.left));
    });
    ok(buried.length === 0,
       'every level button is tappable, none under the pill (' + (buried.join(',') || 'all clear') + ')');
    window.scrollTo(0, 0);


    // 12 — v6: the OPTIONAL fourth level, "copy" (the rewritten lesson words)
    ok(bar().querySelectorAll('button').length === 3 && !bar().classList.contains('lv4'),
       'a page with NO copy keeps exactly three tabs (the live artifacts are safe)');
    window.__chapters({ chat:'t', sheet:'chapters4', mount:'#chapters4',
      chapters:[
        { id:'c1', title:'Coffee', when:'Jul 29', kind:'lesson', l1:'g', l2:['d'],
          msgs:[{ who:'sophie', at:'2026-07-29T06:54:00Z', text:'hi' }],
          copy:{ cards:[
            { img:'/cf-x.webp', kicker:'okay, so', h:'One time',
              body:'I was hanging out with my friend Josiah [[and]] then <b> stays text' },
          ]} },
        { id:'c2', title:'No copy yet', when:'Jul 30', kind:'build', l1:'g', l2:['d'],
          msgs:[{ who:'sophie', at:'2026-07-30T06:54:00Z', text:'ho' }] },
      ]});
    var m4 = document.getElementById('chapters4');
    var bar4 = m4.querySelector(':scope > .cx-lv');
    ok(bar4.querySelectorAll('button').length === 4 && bar4.classList.contains('lv4'),
       'a page WITH copy grows a fourth tab');
    var bw = bar4.getBoundingClientRect().width;
    var lw = parseFloat(getComputedStyle(bar4, '::after').width);
    ok(Math.abs(lw - (bw - 56) / 4) < 2,
       'the sliding line is a quarter of the reserved bar (' + Math.round(lw) + 'px)');
    m4.querySelector('.cx-ch .cx-head').click();
    bar4.querySelector('button[data-lv="4"]').click();
    var b4 = m4.querySelector('.cx-ch .cx-body');
    ok(!!b4.querySelector('.cx-cplegend'), 'the copy level opens with the legend');
    ok(!!b4.querySelector('.cx-cp .cx-cpimg'), 'a copy card carries its image');
    var mine = b4.querySelector('.cx-cpb .cx-mine');
    ok(!!mine && mine.textContent === 'and', 'a word of MINE renders red ([[and]])');
    ok(b4.querySelector('.cx-cpb').textContent.indexOf('[[') === -1,
       'the [[ ]] marker never leaks into the text');
    ok(b4.querySelector('.cx-cpb').innerHTML.indexOf('<b>') === -1,
       'raw HTML in the copy stays text, never markup');
    // the chapter with no copy answers honestly
    m4.querySelectorAll('.cx-ch')[1].querySelector('.cx-head').click();
    var b4b = m4.querySelectorAll('.cx-ch')[1].querySelector('.cx-body');
    ok(b4b.textContent.indexOf('No new copy') !== -1,
       'a chapter without copy says so instead of a blank body');


    // 13 — the COPY-ONLY shape: one row per LESSON, no level bar at all
    //      (Sophie, Aug 2026: "split up all the lessons so they're each their
    //      own little thingy, and for now hide everything that's not a
    //      lesson"). Three of four tabs would lead to an empty body here, so
    //      the bar is not built — decided by the DATA, never a flag.
    window.__chapters({ chat:'t', sheet:'lessons-copy', mount:'#chapters5',
      chapters:[
        { id:'ls-01', title:'Wake Up To', when:'2 cards · 1 mine', kind:'lesson',
          icon:'/li-15.webp',
          copy:{ cards:[
            { h:'A party on a train', body:'you wake up and [[there is]] a party' },
            { h:'The beach', body:'we would always go to the beach' },
          ]} },
        { id:'ls-02', title:'Animal Magic', when:'1 card · all yours', kind:'lesson',
          icon:'/li-10.webp',
          copy:{ cards:[{ h:'The snake', body:'a snake came to me' }] } },
      ]});
    var m5 = document.getElementById('chapters5');
    ok(!m5.querySelector(':scope > .cx-lv'),
       'a copy-only page builds NO level bar (nothing to switch between)');
    ok(m5.querySelectorAll('.cx-ch').length === 2, 'every lesson is its own row');
    m5.querySelector('.cx-ch .cx-head').click();
    var b5 = m5.querySelector('.cx-ch .cx-body');
    ok(b5.querySelectorAll('.cx-cp').length === 2,
       'a lesson row opens STRAIGHT into its copy, no tab to find first');
    ok(!!b5.querySelector('.cx-mine') && b5.textContent.indexOf('[[') === -1,
       'the red marks still render on a copy-only page');
    ok(m5.querySelectorAll('.cx-ico').length === 2,
       'each lesson wears its own drawing');
    // and the four-tab page above is untouched by any of it
    ok(bar4.querySelectorAll('button').length === 4,
       'the chapters page on the same document keeps its four tabs');

    fetch('/result?r=' + encodeURIComponent(L.join(' | ')));
  }, 500);
})();
</script>`;

const files = {
  '/compare.css': ['text/css', fs.readFileSync(path.join(PUB, 'compare.css'), 'utf8')],
  '/compare.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'compare.js'), 'utf8')],
  '/chapters.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'chapters.js'), 'utf8')],
};
const pill = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');

let finish = null;
const server = http.createServer((req, res) => {
  const [route, qs] = req.url.split('?');
  if (route === '/result') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
    return finish && finish(decodeURIComponent(new URLSearchParams(qs).get('r') || ''));
  }
  if (route === '/api/chatfeed/verdict') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"ok":true,"items":{},"texts":{}}');
  }
  const hit = files[route];
  if (hit) { res.writeHead(200, { 'Content-Type': hit[0] }); return res.end(hit[1]); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(PAGE.replace('__PILL__', pill));
});

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'chapters-'));
  /* HER PHONE'S WIDTH, not a desktop default. The autoscroll pill is fixed
     over x 324-374, so the sticky level bar's right-hand button only lands
     under it at a narrow viewport — a wide window hides the whole hazard and
     the hit test passes while saying nothing. */
  const kid = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu',
    '--window-size=390,844',
    '--user-data-dir=' + profile, url], { stdio: 'ignore' });

  const done = (verdict, err) => {
    try { kid.kill('SIGKILL'); } catch (_) {}
    server.close();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
    if (err) { console.error(err); process.exit(1); }
    const lines = verdict.split(' | ').filter(Boolean);
    lines.forEach((l) => console.log(l));
    if (!lines.length) { console.error('no verdict — the page script never ran'); process.exit(1); }
    if (lines.some((l) => l.startsWith('FAIL'))) process.exit(1);
    console.log(`all ${lines.length} checks passed`);
    process.exit(0);
  };
  const timer = setTimeout(() => done('', 'timed out waiting for the page'), 30000);
  finish = (v) => { clearTimeout(timer); done(v); };
});
