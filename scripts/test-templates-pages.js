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
// what the LIGHTBOX opens (an item's `full`): a real picture's proportions, so
// the overlay geometry under test is the geometry she actually gets — the 40×60
// tile stand-in renders 60px tall and sits nowhere near the middle of a screen
const BIG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='600'%3E%3Crect width='400' height='600' fill='%23c99'/%3E%3C/svg%3E";
const SG = 'https://storage.googleapis.com/test-bucket';

const files = {
  '/compare.css': ['text/css', fs.readFileSync(path.join(PUB, 'compare.css'), 'utf8')],
  '/compare.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'compare.js'), 'utf8')],
  '/judge.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'judge.js'), 'utf8')],
  '/grid.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'grid.js'), 'utf8')],
  '/asset-lightbox.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'asset-lightbox.js'), 'utf8')],
  '/asset-view.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'asset-view.js'), 'utf8')],
  '/page-views.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'page-views.js'), 'utf8')],
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
      { label: 'medium', img: IMG, full: BIG, url: `${SG}/a/p-med.png`, model: 'gpt-image-2',
        quality: 'medium', promptStyle: 'wtr watercolor drawing', promptContent: 'penny with the blue kleenex' },
      { label: 'high', img: IMG, url: `${SG}/a/p-high.png`, model: 'gpt-image-2',
        quality: 'high', promptStyle: 'wtr watercolor drawing', promptContent: 'penny with the blue kleenex' },
    ] },
    { label: 'three options', items: [
      { id: 'o1', label: 'one', img: IMG }, { id: 'o2', label: 'two', img: IMG },
      { id: 'o3', label: 'three', text: 'a to-do line <b>escaped</b>' },
    ] },
    // 2026-08-19: six items must WRAP at three, never sit as one row of six
    // ~50px tiles (the threshold-ladder page bug).
    { label: 'six on a ladder', items: [1, 2, 3, 4, 5, 6].map((n) => (
      { id: 's' + n, label: 'v' + n, img: IMG })) },
    // an item whose page data carries NO prompt — the Assets tab has one on
    // file for it, and the page must grow the button from that
    { label: 'prompt only in the Assets tab', items: [
      { id: 'fillme', label: 'the page data never had a prompt', img: IMG,
        url: `${SG}/a/p-fill.png` },
    ] },
    // same dream, two styles — the style tab marks the line they DON'T share
    { label: 'same dream, two styles', items: [
      { id: 'st1', label: 'watercolor', img: IMG,
        promptStyle: 'loose watercolor wash\nvisible paper grain',
        promptContent: 'the party dream with sandy' },
      { id: 'st2', label: 'linocut', img: IMG,
        promptStyle: 'clean linocut relief print\nvisible paper grain',
        promptContent: 'the party dream with sandy' },
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
  ok(rows.length===5 && r1.length===2 && r2.length===3, 'the groups render their items');
  var basis=function(el){ return (el.getAttribute('style')||'').replace(/\\s+/g,''); };
  ok(basis(r1[0]).indexOf('/2)')>0 && basis(r2[0]).indexOf('/3)')>0,
     'two share a row in halves, three in thirds — got ' + basis(r1[0]) + ' & ' + basis(r2[0]));
  var r3=rows[2].querySelectorAll('.gd-it');
  ok(r3.length===6 && basis(r3[0]).indexOf('/3)')>0,
     'six wrap at thirds, not sixths — got ' + basis(r3[0]));
  var img1=r1[0].querySelector('img');
  ok(img1 && r1[0].getBoundingClientRect().width - img1.getBoundingClientRect().width < 3,
     'the picture fills its cell edge to edge, no side padding');
  ok(r1[0].firstElementChild.tagName==='IMG'
     && r1[0].querySelector('.gd-sub').textContent==='medium',
     'the picture comes FIRST, the what-changed line under it');
  var acts=[].map.call(r1[0].querySelectorAll('.gd-acts > button'), function(b){
    return b.className.replace('gd-','').split(' ')[0] + (b.classList.contains('yes')?'-yes':
      b.classList.contains('no')?'-no':''); });
  ok(acts.join(',')==='vote-no,prompt,vote-yes',
     'PROMPT sits BETWEEN the X and the heart — got ' + acts.join(','));
  var g2=m.querySelectorAll('.gd-group')[1];
  ok(getComputedStyle(g2).borderTopStyle==='solid'
     && parseFloat(getComputedStyle(g2).borderTopWidth)>0,
     'a rule separates one compared set from the next (rows wrap, so white '
     + 'space alone cannot say where a set ends)');
  ok(parseFloat(getComputedStyle(m.querySelector('.gd-group')).borderTopWidth)===0,
     'but no rule dangles above the first set');
  ok(!r1[0].querySelector('.tag') && !r1[0].querySelector('.gd-cap'),
     'no title above the picture, no extra caption line — minimal, like Assets');
  var txt=r2[2].querySelector('.gd-txt');
  ok(txt && txt.textContent.indexOf('<b>')>=0 && !txt.querySelector('b'),
     'a text item renders its words ESCAPED');

  // THE TITLE FITS ON ONE LINE, and it is the page's own heading — the
  // "Auto-compare" prefix belongs to the Compare tab's row, not to the
  // biggest type on her screen (Sophie, Aug 2026)
  var h1=document.querySelector('.wrap > h1');
  var h1text=(h1.firstChild&&h1.firstChild.textContent||'').trim();
  ok(h1text.indexOf('Same style, different subjects')===0 && h1.textContent.indexOf('Auto-compare')<0,
     'the h1 drops the Auto-compare prefix — got ' + h1text);
  ok(document.title.indexOf('Auto-compare')===0,
     'while the browser tab keeps the full name');
  var fs1=parseFloat(getComputedStyle(h1).fontSize);
  var lh1=parseFloat(getComputedStyle(h1).lineHeight);
  ok(h1.scrollHeight <= lh1*1.3,
     'the title is ONE line — h ' + h1.scrollHeight + ' vs line ' + lh1);
  ok(fs1 < 26 && fs1 >= 15,
     'it scaled DOWN to get there, and not into nothing — got ' + fs1 + 'px');

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
  ok(ov.querySelector('.gd-ovtext').textContent==='wtr watercolor drawing'
     && !ov.querySelector('.gd-ovtext .gd-diff'),
     'STYLE is one tap away, and identical styles carry no diff marks');
  ov.click();

  // the style tab marks ONLY the line this variant does not share (Sophie:
  // "showing the lines that are different in the style tab")
  m.querySelector('[data-item="st1"] .gd-prompt').click();
  ov=document.querySelector('.gd-ov');
  ov.querySelector('[data-side="style"]').click();
  var marks=ov.querySelectorAll('.gd-ovtext .gd-diff');
  var ovt=ov.querySelector('.gd-ovtext').textContent;
  ok(marks.length===1 && marks[0].textContent.indexOf('watercolor wash')>=0
     && ovt.indexOf('paper grain')>=0,
     'a differing style line marks in rose, the shared line stays plain — got '
     + marks.length + ' marks');
  ov.click();

  setTimeout(function(){
    // resume: the Assets-tab ♥ on p-med (served by the harness) lit it
    var medHeart=m.querySelector('[data-item="p-med"] .gd-vote.yes');
    ok(medHeart && medHeart.classList.contains('on'),
       'an Assets-tab heart fills in an unjudged item on load');
    ok(m.querySelectorAll('.gd-it .cmp-note-open').length===0,
       'NO note + on a tile — it would cost every tile a line (the note is in '
       + 'the lightbox)');

    // tapping an asset-backed picture opens THE Assets-tab lightbox —
    // heart, note thread, Prompt (Sophie: "identical to what happens when I
    // open the image in assets")
    m.querySelector('[data-item="p-med"] img').click();
    setTimeout(function(){
      var clb=document.getElementById('clightbox');
      ok(clb && clb.style.display==='flex',
         'tapping an asset picture opens the Assets lightbox');
      ok(!!clb.querySelector('.lbnote input') && !!clb.querySelector('.promptbtn'),
         'with the note box and the Prompt button');
      // the BOX comes first and the conversation sits under it (Aug 2026)
      var kids=[].map.call(clb.querySelector('.lbtalk').children, function(k){
        return k.className.split(' ')[0]; });
      ok(kids.join(',')==='lbnote,lbthread',
         'the note box is above the thread — got ' + kids.join(','));
      var thr=clb.querySelector('.lbthread');
      ok(thr.getBoundingClientRect().height < window.innerHeight*0.2,
         'the thread only PEEKS until she asks for it');
      // CHAT rides beside PROMPT in the top row, and says Chat
      var mid=clb.querySelector('.lbtop .lbmid');
      var midkids=[].map.call(mid.children, function(k){ return k.textContent.trim(); });
      ok(midkids.join(',')==='Prompt,Chat',
         'CHAT sits next to PROMPT in the top row — got ' + midkids.join(','));
      var mb=mid.lastElementChild;
      ok(mb.style.display!=='none',
         'and it shows, because this thread has more than the peek can hold');
      mb.click();
      var img=clb.querySelector('.clwrap img');
      var tr=thr.getBoundingClientRect(), ir=img.getBoundingClientRect();
      ok(clb.querySelector('.lbtalk').classList.contains('big')
         && tr.top < ir.bottom && tr.bottom > ir.top,
         'it throws the conversation OVER the picture — thread '
         + Math.round(tr.top) + '-' + Math.round(tr.bottom) + ' vs image '
         + Math.round(ir.top) + '-' + Math.round(ir.bottom));
      ok(mb.textContent.trim()==='Hide', 'and reads Hide while it is open');
      mb.click();
      ok(!clb.querySelector('.lbtalk').classList.contains('big'), 'and puts it back');
      ok(clb.querySelector('.vote.heart').classList.contains('on'),
         'its heart already agrees with the tile');
      var msgs=clb.querySelectorAll('.lbmsg');
      ok(msgs.length===6 && msgs[0].textContent.indexOf('letter 1')===0,
         'her existing note thread rides in, oldest first — got ' + msgs.length);
      // the lightbox ✕ lands on the page verdict AND the Assets mirror
      clb.querySelector('.vote.nope').click();
      var pv=posts('/api/chatfeed/verdict').pop(), pm=posts('/api/gallery/assets/vote').pop();
      ok(pv && pv.b.ok===false && pv.b.item==='p-med' && pm && pm.b.vote==='dislike',
         'the lightbox X saves the page verdict and mirrors the asset vote');
      ok(!medHeart.classList.contains('on')
         && m.querySelector('[data-item="p-med"] .gd-vote.no').classList.contains('on'),
         'and the tile underneath repaints to match');
      ok(clb.hasAttribute('data-nostop'),
         'the lightbox is marked data-nostop, so tapping out of it never '
         + 'starts the autoscroll (the app toggle skips [data-nostop])');
      clb.click();
      ok(clb.style.display==='none', 'the backdrop closes it');

    // THE PROMPT FILL: the page data gave this one nothing, so the button can
    // only come from the Assets tab's filed prompt (Sophie: "I don't see a
    // prompt box for this chat")
    var fill=m.querySelector('[data-item="fillme"]');
    var fb=fill.querySelector('.gd-prompt');
    ok(!!fb, 'an item with no prompt in the page data still grows a PROMPT '
       + 'button, from what is filed against the picture');
    if(fb){
      fb.click();
      var fo=document.querySelector('.gd-ov');
      ok(fo && fo.querySelector('.gd-ovtext').textContent==='the filed content half'
         && fo.querySelector('.gd-ovmq').textContent==='gpt-image-2 · low',
         'and it opens the filed prompt, with the filed caption on top');
      fo.click();
    }

    // …and the whole point of the button: a thread that already FITS gets
      // none (p-high carries one short line). Her rule: it means "there is
      // more up there", not "notes exist".
      m.querySelector('[data-item="p-high"] img').click();
      setTimeout(function(){
        var c2=document.getElementById('clightbox');
        var mid2=c2.querySelector('.lbtop .lbmid');
        var chat2=mid2 && mid2.querySelector('.promptbtn + .promptbtn');
        ok(c2.querySelectorAll('.lbmsg').length===1,
           'the short thread is there');
        ok(chat2 && chat2.style.display==='none',
           'but NO Chat button — nothing is hidden below the peek');
        c2.click();
        fetch('/result?r=' + encodeURIComponent(L.join(' | ')), {});
      }, 500);
    }, 500);
  }, 400);
}, 600);
</script>`;
  return SPY + renderTemplatePage({
    template: 'grid', title: 'Auto-compare — same style, different subjects',
    // long on purpose: the harness window is wider than her phone, so the
    // title has to be long enough to wrap HERE for the fitter to be tested
    heading: 'Same style, different subjects — the long-heading case',
    chat: 't', sheet: 'page-g', data: v.data,
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
  function who(){ var w=m.querySelector('.jg.mom>.who'); return w?w.textContent:''; }

  // EVERY DECK IS HER DECK (Aug 2026 v3: "make the single image review
  // surface the same general template as the text one") — a deck of PICTURES
  // now wears the chrome the date cards had to itself
  ok(!!m.querySelector('.jg.mom') && !m.querySelector('.jg-count')
     && !!m.querySelector('.jg-prog') && !!m.querySelector('.jg-pilesbtn'),
     'a picture deck wears her chrome — the progress line and Piles, no count');
  ok(getComputedStyle(document.body).backgroundColor==='rgb(247, 242, 232)',
     'and her cream behind it');
  ok(m.querySelectorAll('.jg-mombtn').length===2 && !m.querySelector('.jg-btn'),
     'her two marks, not the four house verdicts');
  ok(!!m.querySelector('.jg-momnote'), 'and her note box, not a corner +');
  ok(who()==='first', 'the item label becomes the name over the picture');
  ok(!!m.querySelector('.jg-mom figure.hug img'),
     'the picture sits in her panel, hugged and height-capped');

  // browse: edge taps page the deck, no verdict required, none posted
  ok(m.querySelector('.jg-navzone.next') && m.querySelector('.jg-navzone.prev'),
     'browse mode has edge tap zones');
  // THE MIC SURVIVED THE MOVE — every live deck is posted with voice on
  var mic=m.querySelector('.jg-mic'), mr=mic.getBoundingClientRect();
  ok(!!mic, 'voice on = the mic is still there');
  var nb=m.querySelector('.jg-momnote').getBoundingClientRect();
  ok(mr.right<=nb.right+1 && mr.bottom<=nb.bottom+1 && mr.top>=nb.top-1,
     'it rides in the note box\\'s own corner');
  var tr=m.querySelector('.jg-mom').getBoundingClientRect();
  ok(mr.top >= tr.bottom - 1, 'the mic sits BELOW the content, never on it');
  var before=posts('/api/chatfeed/verdict').length;
  m.querySelector('.jg-navzone.next').click();
  ok(who()==='second' && posts('/api/chatfeed/verdict').length===before,
     'tapping the right edge moves forward and judges nothing');
  m.querySelector('.jg-navzone.prev').click();
  ok(who()==='first', 'the left edge goes back');

  // ♥ mirrors the asset vote, LIGHTS IN PLACE, and never moves the deck
  m.querySelector('[data-act="yes"]').click();
  var pm=posts('/api/gallery/assets/vote').pop();
  ok(pm && pm.b.vote==='like' && pm.b.url.indexOf('/d/a.png')>0, 'a heart mirrors the asset vote');
  ok(who()==='first', 'a MARK NEVER MOVES THE DECK — only the edges do');
  ok(m.querySelector('[data-act="yes"]').classList.contains('on'), 'the verdict lights in place');
  m.querySelector('.jg-navzone.next').click();
  m.querySelector('.jg-navzone.prev').click();
  ok(m.querySelector('[data-act="yes"]').classList.contains('on'), 'the verdict shows lit when she returns');

  // THE SECOND DECK IS HAND-BUILT (window.__judge direct, no look:'mom'), so
  // it still wears the house look — that is the guarantee that unifying the
  // TEMPLATE did not restyle every judge page ever posted
  var m2=document.getElementById('judge2');
  ok(!!m2.querySelector('.jg-count') && !m2.querySelector('.jg.mom'),
     'a hand-built judge page keeps the house look');
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

function run(name, html, search) {
  return new Promise((resolve, reject) => {
    let finish = null;
    const verdictDoc = { items: {}, texts: {} };
    const server = http.createServer((req, res) => {
      const [route, qs] = req.url.split('?');
      if (/^\/api\/chatfeed\/page\/[^/]+\/review$/.test(route)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end('{"ok":true}');
      }
      if (route === '/result') {
        res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
        // URLSearchParams already percent-decodes — a second decode dies on
        // any literal % in a message (e.g. a calc(100% …) in a diagnostic)
        return finish && finish(new URLSearchParams(qs).get('r') || '');
      }
      // A REAL ROUND TRIP, not a stub that forgets. The two-view page proves
      // itself by a mark made in one view showing in the other, and both read
      // it back off this doc — against a stub that always answered {} the
      // cross-view check can only ever fail.
      if (route === '/api/chatfeed/verdict') {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (c) => { body += c; });
          return req.on('end', () => {
            try {
              const b = JSON.parse(body || '{}');
              if (b.item !== undefined) {
                if (b.ok === null || b.ok === undefined) delete verdictDoc.items[b.item];
                else verdictDoc.items[b.item] = b.ok;
                if (b.text !== undefined) verdictDoc.texts[b.item] = b.text;
              }
            } catch (e) { /* the page still holds its own state */ }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('{"ok":true}');
          });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, items: verdictDoc.items, texts: verdictDoc.texts }));
      }
      if (route === '/api/gallery/assets/vote' || route === '/api/gallery/assets/note') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end('{"ok":true}');
      }
      if (route === '/api/gallery/assets/notes') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        // p-med: far more letters than the peek can show → the CHAT button
        // p-high: one short line that fits → no button (her rule)
        const long = (n) => ({ from: n % 2 ? 'chat' : 'sophie',
          text: `letter ${n} — ` + 'a long enough line to fill the peek. '.repeat(4),
          at: '2026-08-19T00:00:0' + n + 'Z' });
        return res.end(JSON.stringify({ notes: [
          { url: `${SG}/a/p-med.png`, thread: [1, 2, 3, 4, 5, 6].map(long) },
          { url: `${SG}/a/p-high.png`,
            thread: [{ from: 'sophie', text: 'warmer next time', at: '2026-08-19T00:00:00Z' }] },
        ] }));
      }
      if (route === '/api/gallery/assets') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ assets: [
          { url: `${SG}/a/p-med.png`, vote: 'like' },
          // filed against the picture, absent from the page — the fill's job
          { url: `${SG}/a/p-fill.png`, prompt: 'gpt-image-2 · low',
            promptStyle: 'the filed style half', promptContent: 'the filed content half' },
        ] }));
      }
      const hit = files[route];
      if (hit) { res.writeHead(200, { 'Content-Type': hit[0] }); return res.end(hit[1]); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    server.listen(0, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${server.address().port}/${search || ''}`;
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
    // long enough to overflow the card box even after the `long` step-down —
    // the truncation report: the top must stay reachable and the box scroll
    { id: 'm4', who: 'Ruth', eyebrow: 'Moment · Ch. 4',
      text: new Array(30).fill('A very long moment that keeps going well past one screen.').join(' '),
      sections: [{ label: 'Illustration', text: 'A hallway of doors, all ajar.' }] },
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
  // NO PILL OVER A DECK — but the page holds the COMPARE view too now, and
  // that half scrolls and needs one. So the pill is injected and hidden by
  // the view (page-views.js), which is the honest form of the rule: what she
  // asked for is not seeing one while swiping.
  var pill=document.querySelector('.float');
  ok(!pill || getComputedStyle(pill).display==='none',
     'no autoscroll pill over a deck — there is nothing to scroll');
  ok(!document.querySelector('h1'),
     'no page title of its own — the app header already names it');
  // her chrome: progress line + Piles + ? up top, her footer below the card
  ok(!!m.querySelector('.jg-prog i') && !!m.querySelector('.jg-pilesbtn')
     && !m.querySelector('.jg-count') && !m.querySelector('[data-act="undo"]'),
     'her top chrome: progress line and Piles, no count and no undo');
  var row=m.querySelector('.jg-momfoot');
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
  ok(row && btns.length===2 && btns[0].getAttribute('aria-label')==='No'
     && btns[1].getAttribute('aria-label')==='Yes' && !m.querySelector('.jg-btn'),
     'her footer: ✕ and ♥ (the ✓ swapped for a heart), not the four house verdicts');
  // HAND-DRAWN, NOT THE CHARACTERS (Aug 2026: "make this X that I gave as a
  // screenshot, and make the heart actually kind of a handwriting look") —
  // filled paths with an explicit fill, so a host svg-fill-none rule can
  // never hollow them out
  var gx=btns[0].querySelector('svg'), gh=btns[1].querySelector('svg');
  ok(gx && gh && gx.querySelectorAll('path').length===2 && gh.querySelectorAll('path').length===1,
     'the marks are drawn — two crossing strokes and one heart, not ✕/♥ characters');
  ok(getComputedStyle(gx.querySelector('path')).fill!=='none'
     && getComputedStyle(gx).getPropertyValue('fill')!=='none',
     'they are FILLED — got '+getComputedStyle(gx).getPropertyValue('fill'));
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
     'the Note for Claude box IS the footer row — no corner + and no mic');
  // the footer, both asks (Aug 2026): her bigger full-width note box, the
  // ✕/♥ a size smaller and ABOVE it — and now floating ON the content rather
  // than holding a row of their own ("there's a lot of space between the X and
  // the heart that's empty… put the heart and the X on top of the content so
  // the content comes down a little farther and there's just a tiny bit of
  // space between the note and the content")
  var nbb=row.querySelector('.jg-momnote').getBoundingClientRect();
  ok(btns[0].getBoundingClientRect().bottom<=nbb.top+1
     && btns[1].getBoundingClientRect().bottom<=nbb.top+1,
     'the ✕ and ♥ sit ABOVE the note box');
  ok(Math.abs(Math.round(nbb.left)-L0)<=1 && Math.abs(Math.round(nbb.right)-R0)<=1,
     'the note box spans the boxes\\' full width');
  ok(nbb.height>=90, 'the note box is the bigger one — got '+Math.round(nbb.height));
  ok(btns[0].getBoundingClientRect().width<=54,
     'the ✕ and ♥ came down a size to make room');
  var card=m.querySelector('.jg-card.momcard').getBoundingClientRect();
  var bb=btns[0].getBoundingClientRect();
  ok(bb.top<card.bottom && bb.bottom>card.bottom-90,
     'the ✕ floats ON the content, not in a row of its own');
  ok(nbb.top-card.bottom<12,
     'the note sits just under the content — got '+Math.round(nbb.top-card.bottom)+'px');
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
      // 4 — the LONG card: type steps down, the top stays reachable, and
      // what still does not fit scrolls inside the box (never truncated)
      document.querySelector('.jg-navzone.next').click();
      setTimeout(function(){
        var m4=document.querySelector('.jg-mom');
        var card4=document.querySelector('.jg-card.momcard');
        ok(m4 && m4.classList.contains('long'),
           'a card that overflows steps its type down');
        ok(parseFloat(getComputedStyle(m4.querySelector('.moment')).fontSize)===16,
           'the top blurb comes down toward the other blurbs\\' size');
        ok(m4.getBoundingClientRect().top>=card4.getBoundingClientRect().top-1
           && card4.scrollTop===0,
           'the stack starts at the TOP of its box — nothing clipped above');
        ok(card4.scrollHeight>card4.clientHeight+1,
           'and the rest scrolls inside the box, never hidden');
        ok(document.documentElement.scrollHeight<=document.documentElement.clientHeight+1,
           'the page itself still never scrolls');
        fetch('/result?r=' + encodeURIComponent(L.join(' | ')), {});
      }, 260);
    }, 900);
  }, 260);
}, 700);
</script>`;
  return SPY + renderTemplatePage({
    template: 'deck', title: 'Moment test v2', chat: 't', sheet: 'page-m', data: v.data,
  }) + pill + TEST;
}

// A DECK OPENED FROM THE REVIEW QUEUE (?clean=1) — Aug 2026 v2, three of her
// asks in one page: a long card puts its title in the top-left corner, there
// is a way back to the queue, and the piles area carries the link to the chat
// plus Skip and Done (the ✕ having come off the queue's tiles).
function queuePage() {
  const LONG = 'A crown and a running score. The winner says WINNER at the top with a '
    + 'little crown. And when the two tiles are the same picture made by ChatGPT and by '
    + 'Claude, keep score at the top of who is winning — Claude always on the left, '
    + 'ChatGPT always on the right.';
  const v = validateTemplate('deck', { items: [
    { id: 'q1', who: 'update-tab-messaging', eyebrow: 'PART ONE · 2:26 · 3 OF 9',
      text: LONG, sections: [{ label: 'Your words', text: LONG }] },
    { id: 'q2', who: 'Theo', text: 'Short one.' },
  ] });
  if (!v.ok) throw new Error(v.error);
  const TEST = `<script>
setTimeout(function(){
  var L=[]; function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  function posts(u){ return window.__posts.filter(function(p){ return p.u.indexOf(u)>=0; }); }
  var m=document.getElementById('judge');
  // ── a LONG card: the title goes to the top-left corner ──────────────────
  var jg=m.querySelector('.jg.mom');
  ok(jg.classList.contains('long'), 'a long card is marked long');
  var who=m.querySelector('.jg.mom>.who'), box=m.querySelector('.jg-mombox');
  var wr=who.getBoundingClientRect(), br=box.getBoundingClientRect();
  ok(Math.abs(wr.left-br.left)<2,
     'the title starts on the boxes\\' left edge — got '+Math.round(wr.left)+' vs '+Math.round(br.left));
  ok(parseFloat(getComputedStyle(who).fontSize)<16,
     'and it is small — got '+getComputedStyle(who).fontSize);
  ok(document.documentElement.scrollHeight<=document.documentElement.clientHeight+1,
     'the page still does not scroll');
  // ── the MINI AUTOSCROLL, conditional (Aug 2026: "only appears when the
  //    text is very long and is smaller than the normal one and just like on
  //    the side of the screen") ─────────────────────────────────────────────
  var mini=document.querySelector('.jg-mini');
  var sc=m.querySelector('.jg-card.momcard');
  ok(sc.scrollHeight>sc.clientHeight+4, 'this card genuinely overflows');
  ok(mini && !mini.hidden, 'the mini autoscroll is there for it');
  var mb=mini.getBoundingClientRect();
  ok(mb.width<=34, 'it is smaller than the house pill (48) — got '+Math.round(mb.width));
  ok(window.innerWidth-mb.right<12, 'it sits on the SIDE of the screen');
  ok(getComputedStyle(mini).position==='fixed', 'and stays put while the card scrolls');
  ok(!m.contains(mini), 'it lives outside the card, so a tap on it never pages the deck');
  // ── back to the queue ───────────────────────────────────────────────────
  ok(!!m.querySelector('[data-act="back"]'), 'a long deck opened from the queue has a way back');
  var top0=sc.scrollTop;
  mini.click();
  setTimeout(function(){
    ok(sc.scrollTop>top0, 'tapping it scrolls the card — got '+Math.round(sc.scrollTop));
    mini.click();
    var stopped=sc.scrollTop;
    setTimeout(function(){
      ok(Math.abs(sc.scrollTop-stopped)<1.5, 'tapping again stops it');
      // the SHORT card next door needs none, so it does not get one
      m.querySelector('.jg-navzone.next').click();
      setTimeout(function(){
        ok(document.querySelector('.jg-mini').hidden,
           'the short card that fits gets no autoscroll at all');
        // ── the piles area: the chat link and her two buttons ─────────────
        m.querySelector('[data-act="piles"]').click();
        setTimeout(function(){
          var foot=document.querySelector('.jg-pilefoot');
          ok(!!foot, 'the piles area carries a footer');
          var link=foot.querySelector('.jg-pilelink');
          ok(link && link.getAttribute('href')==='/chats?chat=t',
             'a link back to the chat — got '+(link&&link.getAttribute('href')));
          var pb=foot.querySelectorAll('.jg-pilebtn');
          ok(pb.length===2 && pb[0].textContent==='Skip' && pb[1].textContent==='Done',
             'Skip and Done, in the piles area');
          ok(Math.round(pb[0].getBoundingClientRect().width)<110,
             'the buttons hug their words — got '+Math.round(pb[0].getBoundingClientRect().width));
          ok(getComputedStyle(pb[0]).borderRadius==='6px', 'rounded rectangles, never pills');
          pb[0].click();
          setTimeout(function(){
            var p=posts('/review').pop();
            ok(p && p.b.hidden===true && p.u.indexOf('/api/chatfeed/page/q/review')>=0,
               'Skip stamps the page hidden — got '+(p&&p.u));
            fetch('/result?r=' + encodeURIComponent(L.join(' | ')), {});
          }, 300);
        }, 260);
      }, 300);
    }, 200);
  }, 400);
}, 700);
</script>`;
  return SPY + renderTemplatePage({
    template: 'deck', title: 'Queue deck v1', chat: 't', sheet: 'page-q', data: v.data,
    clean: true,
  }) + pill + TEST;
}

// A SHORT card keeps her big centred title — the long rule must not swallow
// the design it is an exception to.
function shortMomentPage() {
  const v = validateTemplate('deck', { items: [
    { id: 's1', who: 'Theo', text: 'Just one line, nothing else.' },
  ] });
  if (!v.ok) throw new Error(v.error);
  const TEST = `<script>
setTimeout(function(){
  var L=[]; function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  var m=document.getElementById('judge');
  ok(!m.querySelector('.jg.mom').classList.contains('long'), 'a short card is not long');
  var mom=m.querySelector('.jg-mom'), who=m.querySelector('.jg.mom>.who');
  var wr=who.getBoundingClientRect(), mr=mom.getBoundingClientRect();
  var cMid=mr.left+mom.clientLeft+mom.clientWidth/2;
  ok(Math.abs((wr.left+wr.right)/2-cMid)<2, 'its title is still CENTRED and big');
  ok(parseFloat(getComputedStyle(who).fontSize)>16, 'still 21px — got '+getComputedStyle(who).fontSize);
  ok(!m.querySelector('[data-act="back"]'),
     'a deck NOT opened from the queue has no back mark — the app header owns that');
  fetch('/result?r=' + encodeURIComponent(L.join(' | ')), {});
}, 700);
</script>`;
  return SPY + renderTemplatePage({
    template: 'deck', title: 'Short v1', chat: 't', sheet: 'page-s', data: v.data,
  }) + pill + TEST;
}

// ONE PAGE, TWO VIEWS (Aug 2026, Sophie: "the compare page, and tinder swipe
// shud be TWO views of the the same page, since they have the same content.
// that way I can swipe back and forth, and see them at full size, rather than
// opening and closing"). The switch, the marks crossing between the views, the
// pill appearing only for the half that scrolls, and the Assets lightbox on a
// swipe card's picture.
function twoViewPage() {
  const v = validateTemplate('grid', { groups: [
    { label: 'Listened at the door', items: [
      { id: 'a1', label: 'ink & wash', img: IMG, full: BIG, url: `${SG}/x/a1.png`,
        model: 'gpt-image-2', quality: 'medium',
        promptStyle: 'ink & wash', promptContent: 'listened at the door' },
      { id: 'a2', label: 'silkscreen', img: IMG, url: `${SG}/x/a2.png` },
    ] },
    { label: 'Snuck out', items: [
      { id: 'b1', label: 'ink & wash', img: IMG },
      { id: 'b2', label: 'silkscreen', img: IMG },
    ] },
  ] });
  if (!v.ok) throw new Error(v.error);
  const TEST = `<script>
setTimeout(function(){
  var L=[]; function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  function posts(u){ return window.__posts.filter(function(p){ return p.u.indexOf(u)>=0; }); }
  var tabs=document.querySelectorAll('.pv button');
  ok(tabs.length===2 && tabs[0].textContent==='Swipe' && tabs[1].textContent==='Compare',
     'the page carries both views behind one switch');
  ok(!document.getElementById('grid').hidden && document.getElementById('judge').hidden,
     'a grid page opens on COMPARE');
  var pill=document.querySelector('.float');
  ok(!pill || getComputedStyle(pill).display!=='none',
     'the compare half keeps the pill — it scrolls');
  // THE PILL FOLLOWS THE PAGE (Aug 2026, Sophie: "this is the wrong pill").
  // pill-inject bakes its palette ON .float, so the page's :root can never
  // reach it — it wore #f6f2e9 on a #faf6ee page in light mode and went
  // near-black in dark. compare.css out-specifies it on the body.
  var pp=getComputedStyle(pill).getPropertyValue('--paper').trim();
  var rp=getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
  ok(pp===rp, 'the pill wears this page paper — got '+pp+' vs '+rp);
  ok(document.querySelectorAll('#grid .gd-it').length===4,
     'all four pictures are on the compare view');

  // …the same four are the swipe deck, flattened in order
  tabs[0].click();
  setTimeout(function(){
    ok(document.body.classList.contains('jg-mombg'),
       'switching to swipe puts her one-screen chrome on the page');
    ok(document.querySelector('.float')==null
       || getComputedStyle(document.querySelector('.float')).display==='none',
       'and takes the pill away — a deck never scrolls');
    ok(!!document.querySelector('#judge .jg.mom'), 'the deck drew, in her look');
    // A SPREAD IS ONE CARD (Aug 2026: "a note per card, or per spread") — the
    // two pictures of a comparison travel together, which is also the two-up
    // picker she asked about
    var who=document.querySelector('#judge .jg.mom>.who');
    ok(who && who.textContent==='Listened at the door',
       'the card is the SPREAD, named by it — got '+(who&&who.textContent));
    ok(document.querySelectorAll('#judge .jg-spread figure').length===2,
       'both of its pictures are on the one card');
    var caps=[].map.call(document.querySelectorAll('#judge .jg-spread figcaption'),
      function(c){ return c.textContent; });
    ok(caps.join('|')==='ink & wash|silkscreen', 'each keeps its own name — got '+caps.join('|'));

    // NO OUTLINE, NO ROUNDED CORNER ON A PICTURE (Aug 2026: "gray outlines,
    // rounded corners") — the panel drew one and the image another
    var fig=document.querySelector('#judge .jg-spread figure');
    var fim=fig.querySelector('img');
    ok(getComputedStyle(fig).borderTopWidth==='0px'
       && parseFloat(getComputedStyle(fig).borderTopLeftRadius)===0
       && getComputedStyle(fim).borderTopWidth==='0px'
       && parseFloat(getComputedStyle(fim).borderTopLeftRadius)===0,
       'a picture on a spread wears no outline and no rounded corner');

    // THE PICTURES AND THEIR BUTTONS ARE TAPPABLE (Aug 2026 — the browse
    // zones are 26% strips and the CENTRE of each picture on a two-up lands
    // inside one, so a tap paged the deck instead of opening the picture).
    // elementFromPoint is the only honest way to ask this: the element is
    // "visible" either way; the question is what the tap actually reaches.
    var reach=[].map.call(document.querySelectorAll('#judge .jg-spread img'),function(im){
      var r=im.getBoundingClientRect();
      var el=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
      return el===im ? 'img' : (el&&el.className||'').toString().split(' ')[0];
    });
    ok(reach.join('|')==='img|img',
       'a tap on either picture reaches the PICTURE — got '+reach.join('|'));
    // scrolled into view FIRST — elementFromPoint asks about the viewport, and
    // in this fixture the buttons sit below the card scroller's clip
    var breach=[].map.call(document.querySelectorAll('#judge .jg-pick'),function(bt){
      bt.scrollIntoView({block:'center'});
      var r=bt.getBoundingClientRect();
      var el=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
      return el===bt||bt.contains(el) ? 'pick'
        : ((el&&el.className||'').toString().split(' ')[0] || (el&&el.tagName) || 'nothing');
    });
    ok(breach.join('|')==='pick|pick',
       'and both this-one buttons are reachable — got '+breach.join('|'));

    // PICKING ONE OF THEM (Aug 2026: "a 'this one' small button underneath
    // each one") — the spread's verdict becomes the winning card's id
    var picks=document.querySelectorAll('#judge .jg-pick');
    ok(picks.length===2 && picks[0].textContent==='this one',
       'each picture carries its own this-one button');
    picks[1].click();
    var pp=posts('/api/chatfeed/verdict').pop();
    ok(pp && pp.b.item==='s:listened-at-the-door' && pp.b.ok==='a2',
       'picking records WHICH one won the spread — got '+(pp&&pp.b.ok));
    ok(document.querySelectorAll('#judge .jg-pick')[1].classList.contains('on'),
       'and the one she picked is lit');
    // it lands in a pile of its own rather than falling off the piles screen
    document.querySelector('#judge [data-act="piles"]').click();
    var heads=[].map.call(document.querySelectorAll('#judge .jg-piles h2'),
      function(h){ return h.textContent; }).join('|');
    ok(heads.indexOf('Picked')>=0, 'a picked spread has a pile — got '+heads);
    document.querySelector('#judge [data-act="piles"]').click();

    // the card's ♥ marks the SPREAD, under a key of its own
    document.querySelector('#judge [data-act="yes"]').click();
    setTimeout(function(){
      var pv=posts('/api/chatfeed/verdict').pop();
      ok(pv && pv.b.item==='s:listened-at-the-door' && pv.b.ok===true,
         'the heart marked the spread, not a picture — got '+(pv&&pv.b.item));

      // …and tapping ONE picture is that picture's own lightbox
      document.querySelector('#judge .jg-spread img').click();
      setTimeout(function(){
        var lb=document.getElementById('clightbox');
        ok(lb && lb.style.display!=='none', 'a picture on the spread opens its lightbox');
        ok(lb.querySelectorAll('.vote').length===2 && !!lb.querySelector('.promptbtn')
           && !!lb.querySelector('.lbnote input'),
           'with the Assets formula — heart, prompt, note');
        lb.click();   // anywhere that isn't a control closes it

        tabs[1].click();
        setTimeout(function(){
          ok(!document.body.classList.contains('jg-mombg'),
             'switching back lets the compare view scroll again');
          var sp=document.querySelector('#grid [data-item="s:listened-at-the-door"]');
          ok(!!sp, 'the spread is a marked-up group over here');
          var h=sp.querySelector('.gd-gacts .gd-vote.yes');
          ok(h && h.classList.contains('on'),
             'and the spread heart she gave while swiping is lit on its row');
          ok(!!sp.querySelector('.cmp-note-open'),
             'a spread carries the note + of its own');
          var solo=document.querySelector('#grid .gd-group:not([data-item])');
          ok(!solo || !solo.querySelector('.gd-gacts'),
             'a one-card spread gets NO second heart — its card is the mark');
          fetch('/result?r=' + encodeURIComponent(L.join(' | ')), {});
        }, 600);
      }, 700);
    }, 300);
  }, 500);
}, 900);
</script>`;
  return SPY + renderTemplatePage({
    template: 'grid', title: 'Two views v1', chat: 't', sheet: 'page-tv', data: v.data,
  }) + pill + TEST;
}

(async () => {
  try {
    const a = await run('grid', gridPage());
    const b = await run('deck', deckPage());
    const c = await run('tour', tourPage());
    const d = await run('moment', momentPage());
    const e = await run('queue', queuePage(), '?clean=1');
    const f = await run('short', shortMomentPage());
    const g = await run('twoview', twoViewPage());
    console.log(`all ${a + b + c + d + e + f + g} checks passed`);
  } catch (err) { console.error(err.message); process.exit(1); }
})();
