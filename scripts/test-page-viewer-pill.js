#!/usr/bin/env node
/* THE PILL THAT SCROLLS A COMPARE PAGE INSIDE THE APP (Aug 2026, Sophie: "the
   auto scroll doesn't work on my image prompt artifact so I can't scroll back
   up only down").

   A Compare page opened in the Chats app runs in an IFRAME, and the pill she
   taps is NOT the injected one — it is `mkPagePill` in chats.html, a second
   implementation living in the parent page (iOS renders position:fixed
   unreliably inside an iframe). Two things had drifted apart from the shared
   pill, and both of them are "can't get back up":

     1. RESUME WENT DOWN, ALWAYS. `vm.onclick` and `pill._tap` were a
        hardcoded `start(1)`, where the shared pill has always resumed on
        `dir`. So riding UP and pausing — with the ‖ or with a tap on the
        page, the same toggle — sent her back DOWN on the next tap.
     2. THERE WAS NO BACK-TO-TOP AT ALL. The shared pill grew one when she
        asked for it; this copy never did, so a long page in the app had no
        jump home.

   This drives the REAL mkPagePill (read out of chats.html, never a copy) over
   a real scrolling page in a real iframe, and it drives the REAL injected
   pill for the tap-gesture half. Verified failing against the pre-fix files:
   4 of 9.

   Run: npm install playwright --no-save && node scripts/test-page-viewer-pill.js
*/
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', 'public');
const chats = fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8');
const inject = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');

let bad = 0;
const ok = m => console.log('  ok   ' + m);
const fail = m => { console.log('  FAIL ' + m); bad++; };

// The real function, lifted out of the real page.
const m = chats.match(/function mkPagePill\(getWin\)\{[\s\S]*?\n  return pill;\n\}/);
if (!m) { console.log('FAIL could not find mkPagePill in chats.html'); process.exit(1); }

const LONG = '<p style="margin:0 0 14px">' +
  'The prompt is the treasure and the image is a throwaway probe. '.repeat(6) +
  '</p>';
const PAGE = `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:16px;font:16px/1.6 sans-serif}</style>${LONG.repeat(40)}`;

const HOST = `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%}
.pageview{position:fixed;inset:0;display:flex;flex-direction:column}
.pv-bar{height:44px;flex:none}
.pv-frame{flex:1;width:100%;border:none}
.float{position:fixed;top:14px;right:14px;z-index:9;display:flex;flex-direction:column;gap:8px;align-items:center}
.vseg{display:flex;flex-direction:column;width:48px;border:1.5px solid #26221c;border-radius:999px;overflow:hidden;background:#f6f2e9}
.vseg button{width:48px;height:52px;border:none;background:transparent}
.ptop{box-sizing:border-box;width:38px;height:38px;border:1.5px solid #26221c;border-radius:50%;
  background:#f6f2e9;padding:0;margin:0;display:none;align-items:center;justify-content:center}
.ptop.on{display:flex}</style>
<div class="pageview"><div class="pv-bar"></div><iframe class="pv-frame" src="/page.html"></iframe></div>
<script>
${m[0]}
var frame=document.querySelector('.pv-frame');
var pill=mkPagePill(function(){ try{return frame.contentWindow;}catch(_){return null;} });
document.querySelector('.pageview').appendChild(pill);
window.__pill=pill;
frame.addEventListener('load',function(){
  var w=frame.contentWindow, doc=frame.contentDocument;
  var pausedThisTap=false;
  if(w) w.__scrollStop=function(){ if(pill._playing&&pill._playing()) pausedThisTap=true; pill._stop(); };
  if(w && pill._topSync){
    w.addEventListener('scroll', pill._topSync, {passive:true});
    w.addEventListener('resize', pill._topSync, {passive:true});
    pill._topSync();
  }
  var OWN='[data-nostop],img,figure,.cmp-lb'; var ownThisTap=false;
  doc.addEventListener('pointerdown',function(e){ var t=e.target;
    try{ownThisTap=!!(t&&t.closest&&t.closest(OWN));}catch(_){ownThisTap=false;} },true);
  doc.addEventListener('click',function(e){
    var paused=pausedThisTap; pausedThisTap=false;
    var own=ownThisTap; ownThisTap=false;
    var t=e.target;
    if(t&&t.closest&&t.closest('a,button,summary,details,input,textarea,select,label,video,audio,[onclick]')) return;
    if(own||(t&&t.closest&&t.closest(OWN))){ if(pill._stop) pill._stop(); return; }
    if(paused) return;
    pill._tap();
  });
});
</script>`;

// A plain page carrying the REAL injected pill, for the shared half.
const PLAIN = `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:16px;font:16px/1.6 sans-serif}</style>${LONG.repeat(40)}${inject}`;

const TYPES = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html' };
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const send = (b, t) => { res.writeHead(200, { 'content-type': t }); res.end(b); };
  if (u === '/host.html') return send(HOST, 'text/html');
  if (u === '/page.html') return send(PAGE, 'text/html');
  if (u === '/plain.html') return send(PLAIN, 'text/html');
  const f = path.join(PUB, u);
  if (f.startsWith(PUB) && fs.existsSync(f) && fs.statSync(f).isFile())
    return send(fs.readFileSync(f), TYPES[path.extname(f)] || 'application/octet-stream');
  res.writeHead(404); res.end('no');
});

const Y = p => p.evaluate(() => document.querySelector('.pv-frame').contentWindow.scrollY);
const setY = (p, y) => p.evaluate(v => document.querySelector('.pv-frame').contentWindow.scrollTo(0, v), y);

(async () => {
  await new Promise(r => srv.listen(3197, r));
  const launch = {};
  if (process.env.PW_CHROME) launch.executablePath = process.env.PW_CHROME;
  const browser = await chromium.launch(launch);
  const p = await browser.newPage({ viewport: { width: 390, height: 720 } });
  p.on('pageerror', e => fail('page error: ' + e.message));
  await p.goto('http://localhost:3197/host.html', { waitUntil: 'load' });
  await p.waitForTimeout(400);

  console.log('THE APP’S PILL SCROLLS THE IFRAME BOTH WAYS');
  await setY(p, 3000);
  const start = await Y(p);
  await p.click('.ppt');                                  // ▲ from a stopped pill
  await p.waitForTimeout(1000);
  const up = await Y(p);
  if (up < start - 20) ok(`▲ goes up (${start} → ${up})`);
  else fail(`▲ did not scroll up (${start} → ${up})`);

  console.log('PAUSE AND PLAY RESUMES THE WAY IT WAS GOING');
  await p.click('.ppm');                                  // pause mid-climb
  await p.waitForTimeout(150);
  const held = await Y(p);
  await p.click('.ppm');                                  // play again
  await p.waitForTimeout(900);
  const after = await Y(p);
  if (after < held - 10) ok(`still going up (${held} → ${after})`);
  else fail(`resumed DOWNWARD after a pause (${held} → ${after})`);
  await p.evaluate(() => window.__pill._stop());

  console.log('A TAP ON THE PAGE RESUMES THE WAY IT WAS GOING');
  await setY(p, 3000);
  await p.click('.ppt');
  await p.waitForTimeout(500);
  await p.mouse.click(150, 400);                          // tap the words: pause
  await p.waitForTimeout(200);
  const held2 = await Y(p);
  if (!(await p.evaluate(() => window.__pill._playing()))) ok('a tap pauses');
  else fail('a tap did not pause');
  await p.mouse.click(150, 400);                          // tap again: resume
  await p.waitForTimeout(900);
  const after2 = await Y(p);
  if (after2 < held2 - 10) ok(`still going up (${held2} → ${after2})`);
  else fail(`a second tap sent it DOWN (${held2} → ${after2})`);
  await p.evaluate(() => window.__pill._stop());

  console.log('THE APP’S PILL HAS A BACK-TO-TOP');
  const pt = p.locator('.pageview .ptop');
  if (await pt.count() === 1) ok('the button is in the rail');
  else fail('no back-to-top in the page viewer’s pill');
  if (await pt.count() === 1) {
    await setY(p, 0);
    await p.waitForTimeout(200);
    if (!(await pt.isVisible())) ok('hidden at the top of the page');
    else fail('showing at the top, where it has nothing to do');
    await setY(p, 3000);
    await p.waitForTimeout(250);
    if (await pt.isVisible()) ok('shown a full screen down');
    else fail('never appears, however far down she is');
    if (await pt.isVisible()) {
      await pt.click();
      await p.waitForTimeout(1200);
      const home = await Y(p);
      if (home < 5) ok('a tap jumps home (' + home + ')');
      else fail('the jump home left her at ' + home);
    }
  }

  console.log('AND THE SHARED PILL’S OWN TAP GESTURE, SAME RULE');
  const q = await browser.newPage({ viewport: { width: 390, height: 720 } });
  await q.goto('http://localhost:3197/plain.html', { waitUntil: 'load' });
  await q.waitForTimeout(300);
  await q.evaluate(() => window.scrollTo(0, 3000));
  await q.click('#vtop');                                 // ride up
  await q.waitForTimeout(500);
  await q.evaluate(() => window.__scrollTap());           // pause
  await q.waitForTimeout(150);
  const h3 = await q.evaluate(() => window.scrollY);
  await q.evaluate(() => window.__scrollTap());           // resume
  await q.waitForTimeout(900);
  const a3 = await q.evaluate(() => window.scrollY);
  if (a3 < h3 - 10) ok(`__scrollTap resumes upward (${h3} → ${a3})`);
  else fail(`__scrollTap resumed DOWNWARD (${h3} → ${a3})`);
  await q.evaluate(() => window.__scrollStop());

  await browser.close();
  srv.close();
  console.log(bad ? `\nFAILED (${bad})` : '\nAll good.');
  process.exitCode = bad ? 1 : 0;
})();
