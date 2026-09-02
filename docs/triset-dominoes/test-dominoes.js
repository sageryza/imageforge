const http=require('http'),fs=require('fs');
process.chdir('/home/user/imageforge');
const servePublic=require('/home/user/imageforge/scripts/lib/public-asset');
const SP='/tmp/claude-0/-home-user-imageforge/edcc4b3e-d4dc-593e-a47d-293a501cacff/scratchpad';
const PAGE=fs.readFileSync(SP+'/dominoes.html','utf8'), PILL=fs.readFileSync('public/pill-inject.html','utf8');
const server=http.createServer((q,r)=>{ if(servePublic(q,r))return;
  if(q.url.startsWith('/api/')){r.writeHead(200,{'content-type':'application/json'});return r.end('{"items":{},"texts":{}}');}
  r.writeHead(200,{'content-type':'text/html'}); r.end(PAGE+PILL); });
(async()=>{
 await new Promise(r=>server.listen(0,r)); const port=server.address().port;
 const {chromium}=require('playwright');
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:700},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await ctx.route('https://storage.googleapis.com/**', async rt=>{
   try{ await rt.fulfill({body:fs.readFileSync(SP+'/cuts/'+rt.request().url().split('/').pop()),contentType:'image/webp'});}catch(e){await rt.abort();}});
 const p=await ctx.newPage(); const errs=[];
 p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
 p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text());});
 await p.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded'});
 await p.waitForTimeout(1500);
 const fail=[]; const ok=(c,m)=>{ if(!c) fail.push(m); };

 // play a whole round by tapping
 let guard=0, moves=0;
 while (guard++ < 120) {
   const st=await p.evaluate(()=>({
     msg:document.getElementById('msg').textContent,
     draw:!document.getElementById('bDraw').hidden,
     pass:!document.getElementById('bPass').hidden,
     left:!document.getElementById('bLeft').hidden,
     hand:[...document.querySelectorAll('#hand .tile')].map(e=>e.className),
     chain:document.querySelectorAll('#chain .tile').length,
     scroll:document.body.scrollHeight>innerHeight,
   }));
   ok(!st.scroll,'page scrolled (chain '+st.chain+')');
   if(/went out|Blocked/.test(st.msg)) break;
   if(st.left){ await p.click('#bRight'); moves++; await p.waitForTimeout(1100); continue; }
   const live=st.hand.findIndex(c=>!/dead/.test(c));
   if(live>=0){ await p.locator('#hand .tile').nth(live).click(); moves++; await p.waitForTimeout(300);
     if(await p.locator('#bRight').isVisible()) await p.click('#bRight');
     await p.waitForTimeout(1100); continue; }
   if(st.draw){ await p.click('#bDraw'); await p.waitForTimeout(250); continue; }
   if(st.pass){ await p.click('#bPass'); await p.waitForTimeout(1100); continue; }
   fail.push('stuck with nothing to do: '+JSON.stringify(st)); break;
 }
 const end=await p.evaluate(()=>({
   msg:document.getElementById('msg').textContent,
   chain:document.querySelectorAll('#chain .tile').length,
   hand:document.querySelectorAll('#hand .tile').length,
   backs:document.querySelectorAll('.back').length,
   pile:+document.getElementById('sPile').textContent,
   you:+document.getElementById('sYou').textContent, it:+document.getElementById('sIt').textContent,
   scroll:document.body.scrollHeight>innerHeight,
   firstEnd:document.querySelector('#chain .tile').children[0].firstChild.src.split('/').pop(),
   lastEnd:document.querySelector('#chain .tile:last-child').children[1].firstChild.src.split('/').pop(),
   topRight:(function(){var r=document.querySelector('.top').getBoundingClientRect();
     var e=document.elementFromPoint(r.right-30, r.top+r.height/2); return e?e.className||e.tagName:'none';})(),
 }));
 ok(/went out|Blocked/.test(end.msg),'round did not end: '+end.msg);
 ok(end.chain+end.hand+end.backs+end.pile===28,'tiles not conserved: '+JSON.stringify(end));

 ok(!end.scroll,'page scrolls at end');
 console.log('moves',moves,'end',JSON.stringify(end));
 await p.screenshot({path:SP+'/shot3.png'});
 // new suits still works
 await p.click('#bSuits'); await p.waitForTimeout(900);
 const ns=await p.evaluate(()=>({hand:document.querySelectorAll('#hand .tile').length,
   chain:document.querySelectorAll('#chain .tile').length, scroll:document.body.scrollHeight>innerHeight}));
 ok(ns.hand>=6&&ns.chain>=1&&ns.chain<=2,'new suits did not re-deal: '+JSON.stringify(ns));
 ok(!ns.scroll,'scrolls after new suits');
 await p.screenshot({path:SP+'/shot4.png'});
 console.log(errs.length?('ERRORS '+errs.slice(0,5)):'no console errors');
 console.log(fail.length?('FAIL:\n - '+fail.join('\n - ')):'ALL CHECKS PASS');
 await b.close(); server.close();
})();
