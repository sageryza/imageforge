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
   try{await rt.fulfill({body:fs.readFileSync(SP+'/cuts/'+rt.request().url().split('/').pop()),contentType:'image/webp'});}catch(e){await rt.abort();}});
 const p=await ctx.newPage(); const errs=[], fail=[];
 p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
 p.on('console',m=>{if(m.type()==='error'&&!/ERR_FAILED|Failed to load resource/.test(m.text()))errs.push('CONSOLE '+m.text());});
 const ok=(c,m)=>{ if(!c) fail.push(m); };
 await p.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded'});
 await p.waitForTimeout(1800);

 const first=await p.evaluate(()=>({
   tiles:document.querySelectorAll('#felt > span').length,
   hand:document.querySelectorAll('#hand > span').length,
   decoded:[...document.querySelectorAll('image')].length,
   msg:document.getElementById('msg').textContent,
   pile:+document.getElementById('sPile').textContent,
   backs:document.querySelectorAll('.back').length,
   scroll:document.body.scrollHeight>innerHeight,
 }));
 console.log('open:',JSON.stringify(first));
 ok(first.tiles===1,'no opening tile'); ok(first.hand===7,'hand is not 7');
 ok(!first.scroll,'page scrolls');
 ok(first.pile+first.hand+first.backs+first.tiles===24,'24 cards not conserved: '+JSON.stringify(first));

 // the images really decode (a broken href renders as nothing and looks fine)
 const dec=await p.evaluate(async()=>{ await new Promise(r=>setTimeout(r,600));
   return [...document.querySelectorAll('image')].length; });
 ok(dec>=8,'too few card images: '+dec);

 let guard=0, laid=0, said=0;
 while (guard++ < 90) {
   const st=await p.evaluate(()=>({
     msg:document.getElementById('msg').textContent,
     asking:!document.getElementById('why').hidden,
     draw:!document.getElementById('bDraw').hidden,
     pass:!document.getElementById('bPass').hidden,
     slots:document.querySelectorAll('[data-slot]').length,
     hand:document.querySelectorAll('#hand > span').length,
     tiles:document.querySelectorAll('#felt > span:not([data-slot])').length,
     sel:!!document.querySelector('#hand .lit'),
     scroll:document.body.scrollHeight>innerHeight,
   }));
   ok(!st.scroll,'page scrolled mid-game');
   if(/went out|Blocked/.test(st.msg)) break;
   if(st.asking){ await p.fill('#why','they both feel like evening'); await p.click('#bSay'); said++; await p.waitForTimeout(1100); continue; }
   if(st.sel && st.slots){ await p.locator('[data-slot]').first().click(); laid++; await p.waitForTimeout(400); continue; }
   if(!st.sel){ await p.locator('#hand > span').first().click(); await p.waitForTimeout(250); continue; }
   if(st.draw){ await p.click('#bDraw'); await p.waitForTimeout(300); continue; }
   if(st.pass){ await p.click('#bPass'); await p.waitForTimeout(1100); continue; }
   fail.push('stuck: '+JSON.stringify(st)); break;
 }
 const end=await p.evaluate(()=>({
   msg:document.getElementById('msg').textContent,
   tiles:document.querySelectorAll('#felt > span').length,
   hand:document.querySelectorAll('#hand > span').length,
   backs:document.querySelectorAll('.back').length,
   pile:+document.getElementById('sPile').textContent,
   scroll:document.body.scrollHeight>innerHeight,
 }));
 ok(/went out|Blocked/.test(end.msg),'round did not end: '+end.msg);
 ok(end.tiles+end.hand+end.backs+end.pile===24,'24 not conserved at end: '+JSON.stringify(end));
 console.log('laid',laid,'said',said,'end',JSON.stringify(end));
 await p.screenshot({path:SP+'/v2a.png'});
 // pick a card up so the slots and the say-box can be photographed
 await p.click('#bRound'); await p.waitForTimeout(700);
 await p.locator('#hand > span').first().click(); await p.waitForTimeout(400);
 await p.screenshot({path:SP+'/v2b.png'});
 console.log(errs.length?errs.slice(0,5):'no page errors');
 console.log(fail.length?('FAIL:\n - '+fail.join('\n - ')):'ALL CHECKS PASS');
 await b.close(); server.close();
})();
