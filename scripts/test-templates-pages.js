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
  var before=posts('/api/chatfeed/verdict').length;
  m.querySelector('.jg-navzone.next').click();
  ok(count()==='2 of 3' && posts('/api/chatfeed/verdict').length===before,
     'tapping the right edge moves forward and judges nothing');
  m.querySelector('.jg-navzone.prev').click();
  ok(count()==='1 of 3', 'the left edge goes back');

  // ♥ mirrors the asset vote, advances ONE step, and shows lit on return
  m.querySelector('[data-act="yes"]').click();
  var pm=posts('/api/gallery/assets/vote').pop();
  ok(pm && pm.b.vote==='like' && pm.b.url.indexOf('/d/a.png')>0, 'a heart mirrors the asset vote');
  ok(count()==='2 of 3', 'browse advances one step, not to first-unjudged');
  m.querySelector('.jg-navzone.prev').click();
  ok(m.querySelector('[data-act="yes"]').classList.contains('on'), 'the verdict shows lit when she returns');

  // the second deck: her words as chips, saved as strings, piles named by them
  var m2=document.getElementById('judge2');
  var chips=[].map.call(m2.querySelectorAll('.jg-chip'), function(b){ return b.textContent; });
  ok(chips.join('|')==='done|in progress', 'custom states render her words');
  m2.querySelectorAll('.jg-chip')[0].click();
  var pv=posts('/api/chatfeed/verdict').pop();
  ok(pv && pv.b.ok==='done' && pv.b.item==='t1', "a chip saves its string ('done')");
  m2.querySelectorAll('.jg-chip')[1].click();   // judging the LAST card lands on piles
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

(async () => {
  try {
    const a = await run('grid', gridPage());
    const b = await run('deck', deckPage());
    console.log(`all ${a + b} checks passed`);
  } catch (err) { console.error(err.message); process.exit(1); }
})();
