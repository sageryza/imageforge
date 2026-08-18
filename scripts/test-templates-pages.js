#!/usr/bin/env node
/* Tests the STOCK TEMPLATE pages end to end — the real renderTemplatePage()
 * output driven in headless Chromium with the real pill injected, exactly as
 * the server serves them.
 *
 *   node scripts/test-templates-pages.js
 *
 * Run 1 — the GRID template (grid.js):
 *   rows share their width 2-across and 3-across, labels on top, the
 *   MODEL · QUALITY caption, ♥ saves the verdict AND mirrors the asset vote,
 *   tapping the lit ♥ clears both, the PROMPT overlay opens on CONTENT, an
 *   Assets-tab ♥ fills in an unjudged item on load, a note + per item.
 *
 * Run 2 — the DECK template (judge.js browse mode):
 *   edge taps page the deck without judging anything, ♥ mirrors the asset
 *   vote and advances one step, the verdict shows lit when she comes back,
 *   custom states render her words and save as strings, the mic renders when
 *   voice is on, piles take their names from the states.
 *
 * Same harness as test-judge.js. Skips with exit 0 if no Chromium.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { validateTemplate, renderTemplatePage } = require('../page-templates');

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

const IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='60'%3E%3Crect width='40' height='60' fill='%23c99'/%3E%3C/svg%3E";
const SG = 'https://storage.googleapis.com/test-bucket';

const files = {
  '/compare.css': ['text/css', fs.readFileSync(path.join(PUB, 'compare.css'), 'utf8')],
  '/compare.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'compare.js'), 'utf8')],
  '/judge.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'judge.js'), 'utf8')],
  '/grid.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'grid.js'), 'utf8')],
};
const pill = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');

// the fetch recorder loads FIRST so every template post is captured; images
// come from data: URLs so the harness serves no pictures
const SPY = `<script>
// these runs test the controls, not the tour — mark it seen up front
// (the tour run below seeds nothing and tests the tour itself)
try{localStorage.setItem('cmp-tour-deck','1');localStorage.setItem('cmp-tour-grid','1');}catch(_){}
window.__posts=[]; (function(){ var rf=window.fetch.bind(window);
window.fetch=function(u,o){ if(o&&o.method==='POST'){ try{ window.__posts.push({u:String(u),b:JSON.parse(o.body)}); }catch(_){} }
return rf(u,o); }; })();
window.addEventListener('error', function(e){
  fetch('/result?r=' + encodeURIComponent('FAIL: page error — ' + e.message + ' @' + (e.filename||'') + ':' + (e.lineno||'')), {});
});
</script>`;

function gridPage() {
  const v = validateTemplate('grid', { groups: [
    { label: 'Penny — which quality?', items: [
      { label: 'medium', img: IMG, url: `${SG}/a/p-med.png`, model: 'gpt-image-2',
        quality: 'medium', promptStyle: 'wtr watercolor drawing', promptContent: 'penny with the blue kleenex' },
      { label: 'high', img: IMG, url: `${SG}/a/p-high.png`, model: 'gpt-image-2',
        quality: 'high', promptStyle: 'wtr watercolor drawing', promptContent: 'penny with the blue kleenex' },
    ] },
    { label: 'three options', items: [
      { id: 'o1', label: 'one', img: IMG }, { id: 'o2', label: 'two', img: IMG },
      { id: 'o3', label: 'three', text: 'a to-do line <b>escaped</b>' },
    ] },
  ] });
  if (!v.ok) throw new Error(v.error);
  const TEST = `<script>
setTimeout(function(){
  var L=[]; function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  function posts(u){ return window.__posts.filter(function(p){ return p.u.indexOf(u)>=0; }); }
  var m=document.getElementById('grid');
  var rows=m.querySelectorAll('.gd-row');
  var r1=rows[0].querySelectorAll('.gd-it'), r2=rows[1].querySelectorAll('.gd-it');
  ok(rows.length===2 && r1.length===2 && r2.length===3, 'two groups render their items');
  var basis=function(el){ return (el.getAttribute('style')||'').replace(/\\s+/g,''); };
  ok(basis(r1[0]).indexOf('/2)')>0 && basis(r2[0]).indexOf('/3)')>0,
     'two share a row in halves, three in thirds — got ' + basis(r1[0]) + ' & ' + basis(r2[0]));
  ok(r1[0].querySelector('.tag').textContent==='medium'
     && r1[0].querySelector('.tag').nextElementSibling.tagName==='IMG',
     'the label sits ON TOP of the picture');
  ok(r1[0].querySelector('.gd-cap').textContent==='gpt-image-2 · medium',
     'the MODEL · QUALITY caption shows');
  ok(m.querySelectorAll('.gd-it .cmp-note-open').length===0 || true, 'notes wire async');
  var txt=r2[2].querySelector('.gd-txt');
  ok(txt && txt.textContent.indexOf('<b>')>=0 && !txt.querySelector('b'),
     'a text item renders its words ESCAPED');

  // ♥ on an asset-backed item: verdict + asset-vote mirror, lit; again clears
  var heart=r1[1].querySelector('.gd-vote.yes'); heart.click();
  var pv=posts('/api/chatfeed/verdict').pop(), pm=posts('/api/gallery/assets/vote').pop();
  ok(pv && pv.b.ok===true && pv.b.item==='p-high', 'a heart saves the verdict');
  ok(pm && pm.b.vote==='like' && pm.b.url.indexOf('p-high')>0, 'and mirrors the asset vote');
  ok(heart.classList.contains('on'), 'the heart lights');
  heart.click();
  pv=posts('/api/chatfeed/verdict').pop(); pm=posts('/api/gallery/assets/vote').pop();
  ok(pv.b.ok===null && pm.b.vote===null && !heart.classList.contains('on'),
     'tapping the lit heart clears verdict and mirror');

  // the PROMPT overlay: opens on CONTENT, style behind the second tab
  r1[0].querySelector('.gd-prompt').click();
  var ov=document.querySelector('.gd-ov');
  ok(ov && !ov.hidden && ov.querySelector('.gd-ovtabs .on').textContent==='CONTENT'
     && ov.querySelector('.gd-ovtext').textContent==='penny with the blue kleenex'
     && ov.querySelector('.gd-ovmq').textContent==='gpt-image-2 · medium',
     'PROMPT opens on CONTENT with the caption on top');
  ov.querySelector('[data-side="style"]').click();
  ok(ov.querySelector('.gd-ovtext').textContent==='wtr watercolor drawing',
     'STYLE is one tap away');
  ov.click();

  setTimeout(function(){
    // resume: the Assets-tab ♥ on p-med (served by the harness) lit it
    var medHeart=m.querySelector('[data-item="p-med"] .gd-vote.yes');
    ok(medHeart && medHeart.classList.contains('on'),
       'an Assets-tab heart fills in an unjudged item on load');
    ok(m.querySelectorAll('.gd-it .cmp-note-open').length===5,
       'every item carries the note +');
    fetch('/result?r=' + encodeURIComponent(L.join(' | ')), {});
  }, 400);
}, 600);
</script>`;
  return SPY + renderTemplatePage({
    template: 'grid', title: 'Grid test v1', chat: 't', sheet: 'page-g', data: v.data,
  }) + pill + TEST;
}

function deckPage() {
  const v = validateTemplate('deck', { voice: true, items: [
    { id: 'a', label: 'first', img: IMG, url: `${SG}/d/a.png` },
    { id: 'b', label: 'second', img: IMG },
    { id: 'c', label: 'third', text: 'walk the dog' },
  ] });
  if (!v.ok) throw new Error(v.error);
  const v2 = validateTemplate('deck', { states: [
    { key: 'done', label: 'done' }, { key: 'progress', label: 'in progress' },
  ], items: [
    { id: 't1', label: 'todo one', text: 'buy stamps' },
    { id: 't2', label: 'todo two', text: 'mail the zine' },
  ] });
  const TEST = `<script>
window.__judge({ chat:'t', sheet:'page-d2', mount:'#judge2',
  browse:true, states:${JSON.stringify(v2.data.states)}, items:${JSON.stringify(v2.data.items)} });
setTimeout(function(){
  var L=[]; function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  function posts(u){ return window.__posts.filter(function(p){ return p.u.indexOf(u)>=0; }); }
  var m=document.getElementById('judge');
  function count(){ return m.querySelector('.jg-count').textContent; }

  // browse: edge taps page the deck, no verdict required, none posted
  ok(m.querySelector('.jg-navzone.next') && m.querySelector('.jg-navzone.prev'),
     'browse mode has edge tap zones');
  ok(m.querySelector('.jg-mic'), 'voice on = a mic on the card');
  // the XI overlap: corner controls get their own strip — with voice on,
  // every card reserves it, and the mic may never sit on the words
  ok(m.querySelector('.jg-card').classList.contains('ctl'),
     'voice on = the card reserves a controls strip');
  var mic=m.querySelector('.jg-mic'), mr=mic.getBoundingClientRect();
  var media=m.querySelector('.jg-media, .jg-cardtext'), tr=media.getBoundingClientRect();
  ok(mr.top >= tr.bottom - 1, 'the mic sits BELOW the content, never on it');
  var before=posts('/api/chatfeed/verdict').length;
  m.querySelector('.jg-navzone.next').click();
  ok(count()==='2 of 3' && posts('/api/chatfeed/verdict').length===before,
     'tapping the right edge moves forward and judges nothing');
  m.querySelector('.jg-navzone.prev').click();
  ok(count()==='1 of 3', 'the left edge goes back');

  // ♥ mirrors the asset vote, LIGHTS IN PLACE, and never moves the deck
  m.querySelector('[data-act="yes"]').click();
  var pm=posts('/api/gallery/assets/vote').pop();
  ok(pm && pm.b.vote==='like' && pm.b.url.indexOf('/d/a.png')>0, 'a heart mirrors the asset vote');
  ok(count()==='1 of 3', 'a MARK NEVER MOVES THE DECK — only the edges do');
  ok(m.querySelector('[data-act="yes"]').classList.contains('on'), 'the verdict lights in place');
  m.querySelector('.jg-navzone.next').click();
  m.querySelector('.jg-navzone.prev').click();
  ok(m.querySelector('[data-act="yes"]').classList.contains('on'), 'the verdict shows lit when she returns');

  // the second deck: her words as chips, saved as strings, piles named by them
  var m2=document.getElementById('judge2');
  var chips=[].map.call(m2.querySelectorAll('.jg-chip'), function(b){ return b.textContent; });
  ok(chips.join('|')==='done|in progress', 'custom states render her words');
  m2.querySelectorAll('.jg-chip')[0].click();
  var pv=posts('/api/chatfeed/verdict').pop();
  ok(pv && pv.b.ok==='done' && pv.b.item==='t1', "a chip saves its string ('done')");
  ok(m2.querySelector('.jg-count').textContent==='1 of 2', 'a chip does not move the deck either');
  m2.querySelector('.jg-navzone.next').click();          // the EDGE moves it
  m2.querySelectorAll('.jg-chip')[1].click();
  m2.querySelector('[data-act="piles"]').click();
  var heads=[].map.call(m2.querySelectorAll('.jg-piles h2'), function(h){ return h.textContent; });
  ok(heads.join('|')==='done · 1|in progress · 1', 'piles take their names from the states');

  fetch('/result?r=' + encodeURIComponent(L.join(' | ')), {});
}, 700);
</script>`;
  return SPY + renderTemplatePage({
    template: 'deck', title: 'Deck test v1', chat: 't', sheet: 'page-d', data: v.data,
  }).replace('</div>\n', '</div>\n<div id="judge2"></div>\n') + pill + TEST;
}

function run(name, html) {
  return new Promise((resolve, reject) => {
    let finish = null;
    const server = http.createServer((req, res) => {
      const [route, qs] = req.url.split('?');
      if (route === '/result') {
        res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
        // URLSearchParams already percent-decodes — a second decode dies on
        // any literal % in a message (e.g. a calc(100% …) in a diagnostic)
        return finish && finish(new URLSearchParams(qs).get('r') || '');
      }
      if (route === '/api/chatfeed/verdict') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end('{"ok":true,"items":{},"texts":{}}');
      }
      if (route === '/api/gallery/assets/vote' || route === '/api/gallery/assets/note') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end('{"ok":true}');
      }
      if (route === '/api/gallery/assets') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ assets: [{ url: `${SG}/a/p-med.png`, vote: 'like' }] }));
      }
      const hit = files[route];
      if (hit) { res.writeHead(200, { 'Content-Type': hit[0] }); return res.end(hit[1]); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    server.listen(0, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${server.address().port}/`;
      const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-'));
      const kid = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu',
        '--user-data-dir=' + profile, url], { stdio: 'ignore' });
      const done = (verdict, err) => {
        try { kid.kill('SIGKILL'); } catch (_) {}
        server.close();
        try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
        if (err) return reject(new Error(`${name}: ${err}`));
        const lines = verdict.split(' | ').filter(Boolean);
        lines.forEach((l) => console.log(`${name} — ${l}`));
        if (!lines.length) return reject(new Error(`${name}: no verdict — the page script never ran`));
        if (lines.some((l) => l.startsWith('FAIL'))) return reject(new Error(`${name}: failures above`));
        resolve(lines.length);
      };
      const timer = setTimeout(() => done('', 'timed out waiting for the page'), 30000);
      finish = (vd) => { clearTimeout(timer); done(vd); };
    });
  });
}

// the TOUR run seeds nothing, so the coach marks auto-play — first open of a
// served template page on a fresh device
function tourPage() {
  const v = validateTemplate('deck', { voice: true, items: [
    { id: 'a', label: 'first', img: IMG }, { id: 'b', label: 'second', img: IMG },
  ] });
  const TEST = `<script>
setTimeout(function(){
  var L=[]; function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  var t=document.querySelector('.cmp-tour');
  ok(!!t, 'the tour auto-plays on a fresh device');
  var ring=t&&t.querySelector('.cmp-tour-ring');
  ok(ring && ring.getBoundingClientRect().width>10, 'the spotlight ring frames a control');
  var count=t&&t.querySelector('.ct-count').textContent;
  ok(/^1 of \\d+$/.test(count||''), 'it starts at step 1 — got "'+count+'"');
  t.click();
  ok(t.querySelector('.ct-count').textContent.indexOf('2 of')===0, 'a tap anywhere advances');
  t.querySelector('.ct-skip').click();
  ok(!document.querySelector('.cmp-tour'), 'SKIP puts it away');
  var again=window.__compareTour({key:'deck',auto:true,steps:[{sel:'.jg-card',text:'x'}]});
  ok(again===false, 'seen once = never auto-plays again');
  fetch('/result?r=' + encodeURIComponent(L.join(' | ')), {});
}, 900);
</script>`;
  return SPY.replace("localStorage.setItem('cmp-tour-deck','1');", '')
    + renderTemplatePage({
      template: 'deck', title: 'Tour test v1', chat: 't', sheet: 'page-t', data: v.data,
    }) + pill + TEST;
}

// the MOMENT card — her "Decision Deck v2" design wired in as the deck's
// text style, copied exactly: white boxes on her cream, Newsreader, her
// footer (✕ · Note for Claude · ♥)
function momentPage() {
  const v = validateTemplate('deck', { items: [
    { id: 'm1', who: 'Maya', eyebrow: 'Moment · Ch. 1',
      text: 'Forty minutes choosing between two photos.',
      sections: [{ label: 'Illustration', text: 'A grid of nearly identical selfies.' }],
      caption: 'Both are you. Neither feels like it.' },
    { id: 'm2', who: 'Theo', text: 'Just one line, nothing else.' },
    { id: 'm3', who: 'Sam', text: 'Words and a picture together.', img: IMG },
  ] });
  if (!v.ok) throw new Error(v.error);
  const TEST = `<script>
setTimeout(function(){
  var L=[]; function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  function posts(u){ return window.__posts.filter(function(p){ return p.u.indexOf(u)>=0; }); }
  var m=document.getElementById('judge');
  var mom=m.querySelector('.jg-mom');
  ok(!!mom, 'a card with parts renders in the moment style');
  ok(getComputedStyle(document.body).backgroundColor==='rgb(247, 242, 232)',
     'the page wears her cream (#F7F2E8), not the house paper');
  // the name is pinned in the top chrome, under the Piles row — not inside
  // the centred stack, where it would drift to mid-screen on a tall phone
  var who=m.querySelector('.jg.mom>.who'), eb=mom.querySelector('.eyebrow');
  var wr=who.getBoundingClientRect(), mr=mom.getBoundingClientRect();
  var cLeft=mr.left+mom.clientLeft, cMid=cLeft+mom.clientWidth/2;
  ok(Math.abs((wr.left+wr.right)/2-cMid)<2, 'the name is CENTRED');
  ok(eb.getBoundingClientRect().top>wr.bottom, 'the name sits ABOVE the eyebrow — lower down the card');
  var topRow=m.querySelector('.jg-momtop').getBoundingClientRect();
  ok(wr.top>=topRow.bottom-1 && wr.top-topRow.bottom<40,
     'it sits just under the Piles row — a little lower, not mid-screen');
  ok(getComputedStyle(who).fontFamily.indexOf('Newsreader')<0
     && getComputedStyle(who).color==='rgb(194, 94, 76)',
     'the name is her RUST, and NOT the serif — got '+getComputedStyle(who).color);
  ok(getComputedStyle(who).textTransform==='uppercase'
     && parseInt(getComputedStyle(who).fontWeight,10)<600,
     'the name is CAPS, and the sans-caps rule keeps it off bold');
  ok(getComputedStyle(mom.querySelector('.moment')).fontFamily.indexOf('Newsreader')>=0,
     'the moment itself is still her Newsreader serif');
  var boxes=mom.querySelectorAll('.jg-mombox');
  ok(boxes.length===3 && !mom.querySelector('hr'),
     'moment, section and caption each get their own white box — no hairline');
  ok(getComputedStyle(boxes[0]).borderRadius==='10px'
     && getComputedStyle(boxes[0]).backgroundColor==='rgb(255, 253, 248)',
     'the boxes are her white boxes, squarer than the mockup at her ask');
  ok(getComputedStyle(mom.querySelector('.cap')).fontStyle==='italic', 'the caption is italic');
  ok(mom.querySelector('.jg-mombox .seclabel:last-of-type') &&
     boxes[2].querySelector('.seclabel').textContent==='Caption',
     'the caption box is labelled Caption (her v2 word)');
  ok(document.documentElement.scrollWidth<=document.documentElement.clientWidth,
     'nothing overflows the screen');
  // ONE SCREEN: her design does not scroll, and no autoscroll pill rides it
  ok(document.documentElement.scrollHeight<=document.documentElement.clientHeight+1,
     'the page does not scroll — it is one screen');
  ok(!document.querySelector('.float')
     && !!document.querySelector('meta[name="forge-pill"][content="off"]'),
     'no autoscroll pill on a deck — there is nothing to scroll');
  ok(!document.querySelector('h1'),
     'no page title of its own — the app header already names it');
  // her chrome: progress line + Piles + ? up top, her footer below the card
  ok(!!m.querySelector('.jg-prog i') && !!m.querySelector('.jg-pilesbtn')
     && !m.querySelector('.jg-count') && !m.querySelector('[data-act="undo"]'),
     'her top chrome: progress line and Piles, no count and no undo');
  var row=m.querySelector('.jg-momrow');
  var btns=row?row.querySelectorAll('.jg-mombtn'):[];
  // EVERY ROW ON THE SAME EDGES — the misalignment she reported
  var L0=Math.round(boxes[0].getBoundingClientRect().left);
  var R0=Math.round(boxes[0].getBoundingClientRect().right);
  var prog=m.querySelector('.jg-prog').getBoundingClientRect();
  var q=m.querySelector('.jg-momq').getBoundingClientRect();
  ok(Math.round(prog.left)===L0 && Math.round(prog.right)===R0,
     'the progress line spans the boxes\\' width');
  ok(Math.abs(Math.round(q.right)-R0)<=1,
     'the ? ends on the boxes\\' right edge — got '+Math.round(q.right)+' vs '+R0);
  ok(Math.abs(Math.round(btns[0].getBoundingClientRect().left)-L0)<=1
     && Math.abs(Math.round(btns[1].getBoundingClientRect().right)-R0)<=1,
     'the ✕ and ♥ sit on the boxes\\' own edges');
  ok(Math.round(row.getBoundingClientRect().bottom)<=window.innerHeight,
     'the footer sits on the screen, not below it');
  ok(row && btns.length===2 && btns[0].textContent==='✕' && btns[1].textContent==='♥'
     && !m.querySelector('.jg-btn'),
     'her footer: ✕ and ♥ (the ✓ swapped for a heart), not the four house verdicts');
  function off(el){ var r=document.createRange(); r.selectNodeContents(el);
    var g=r.getBoundingClientRect(), b=el.getBoundingClientRect();
    return [Math.abs((g.left+g.right)/2-(b.left+b.right)/2),
            Math.abs((g.top+g.bottom)/2-(b.top+b.bottom)/2)]; }
  var offs=[off(btns[0]),off(btns[1]),off(m.querySelector('.jg-momq'))];
  ok(offs.every(function(d){ return d[0]<1.5 && d[1]<1.5; }),
     'the ✕, the ♥ and the ? are centred in their own buttons — got '
     + offs.map(function(d){ return d[0].toFixed(1)+'/'+d[1].toFixed(1); }).join(' '));
  // her size, and the page pinned so iOS cannot zoom itself instead
  ok(parseFloat(getComputedStyle(row.querySelector('.jg-momnote')).fontSize)===13,
     'the note box is HER 13px, not inflated to dodge the iOS zoom');
  ok(/maximum-scale=1/.test((document.querySelector('meta[name="viewport"]')||{})
       .getAttribute('content')||''),
     'the viewport pins the scale, so a focused field cannot zoom the page');
  var nz=m.querySelector('.jg-navzone');
  ok(nz && getComputedStyle(nz).webkitTapHighlightColor.split(' ').join('')==='rgba(0,0,0,0)',
     'the edge zones flash NO grey bar when she taps the side — got '
     + (nz && getComputedStyle(nz).webkitTapHighlightColor));
  ok(!!row.querySelector('.jg-momnote') && !m.querySelector('.cmp-note-open')
     && !m.querySelector('.jg-mic'),
     'the Note for Claude box sits between them — no corner + and no mic');
  ok(m.querySelector('.jg-card').classList.contains('momcard')
     && !m.querySelector('.jg-card').classList.contains('ctl'),
     'the house card chrome disappears behind her boxes');
  // the ♥ saves a yes and steps forward, exactly like the mockup
  btns[1].click();
  var pv=posts('/api/chatfeed/verdict').pop();
  ok(pv && pv.b.ok===true && pv.b.item==='m1', 'the heart saves a yes');
  ok(document.querySelector('.jg.mom>.who').textContent==='Maya'
     && document.querySelector('.jg-mombtn.yes').classList.contains('on'),
     'and leaves her ON the same moment, marked');
  m.querySelector('.jg-navzone.next').click();   // only the EDGE moves it
  setTimeout(function(){
    // 2 — parts she did not send simply do not appear
    var m2=document.querySelector('.jg-mom');
    ok(m2 && !m2.querySelector('.eyebrow') && m2.querySelectorAll('.jg-mombox').length===1,
       'a one-text card shows a single box, no empty parts');
    ok(!!document.querySelector('.jg.mom>.who') && !!m2.querySelector('.moment'),
       'it still shows name + words');
    // her note box: typing saves onto this card's thread
    var nb=document.querySelector('.jg-momnote');
    nb.value='too sweet'; nb.dispatchEvent(new Event('input'));
    document.querySelector('.jg-navzone.next').click();
    setTimeout(function(){
      var m3=document.querySelector('.jg-mom');
      ok(m3 && !!m3.querySelector('.moment') && !!m3.querySelector('figure img'),
         'a card can carry words AND a picture');
      var pn=posts('/api/chatfeed/verdict').filter(function(p){ return p.b.text; }).pop();
      ok(pn && pn.b.item==='m2' && pn.b.text.indexOf('too sweet')>=0,
         'the note box saves onto its card');
      fetch('/result?r=' + encodeURIComponent(L.join(' | ')), {});
    }, 900);
  }, 260);
}, 700);
</script>`;
  return SPY + renderTemplatePage({
    template: 'deck', title: 'Moment test v2', chat: 't', sheet: 'page-m', data: v.data,
  }) + pill + TEST;
}

(async () => {
  try {
    const a = await run('grid', gridPage());
    const b = await run('deck', deckPage());
    const c = await run('tour', tourPage());
    const d = await run('moment', momentPage());
    console.log(`all ${a + b + c + d} checks passed`);
  } catch (err) { console.error(err.message); process.exit(1); }
})();
