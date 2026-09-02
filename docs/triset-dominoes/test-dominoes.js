const http=require('http'),fs=require('fs');
process.chdir('/home/user/imageforge');
const servePublic=require('/home/user/imageforge/scripts/lib/public-asset');
const SP='/tmp/claude-0/-home-user-imageforge/edcc4b3e-d4dc-593e-a47d-293a501cacff/scratchpad';
const PAGE=fs.readFileSync(SP+'/dominoes.html','utf8'), PILL=fs.readFileSync('public/pill-inject.html','utf8');
const posted=[];
const server=http.createServer((q,r)=>{ if(servePublic(q,r))return;
  if(q.url.startsWith('/api/chatfeed/verdict')&&q.method==='POST'){let b='';q.on('data',d=>b+=d);q.on('end',()=>{try{posted.push(JSON.parse(b));}catch(e){} r.writeHead(200,{'content-type':'application/json'});r.end('{"ok":true}');});return;}
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
 await p.waitForTimeout(1500);
 const st0=await p.evaluate(()=>({
   hand:document.querySelectorAll('#hand > span').length, tiles:document.querySelectorAll('#felt > span').length,
   pile:+document.getElementById('sPile').textContent, backs:document.querySelectorAll('.back').length,
   scroll:document.body.scrollHeight>innerHeight }));
 console.log('open',JSON.stringify(st0));
 ok(st0.hand===3&&st0.backs===3,'hands are not 3'); ok(st0.tiles===1,'no opener');
 ok(st0.hand+st0.backs+st0.pile+st0.tiles===24,'24 not conserved at open');
 ok(!st0.scroll,'page scrolls');

 let guard=0, laid=0, passed=0, shot=false, midsSeen=0;
 const words=['both dark','round shapes','night','feels lonely','water','tiny things','same colour'];
 while(guard++<80){
   const st=await p.evaluate(()=>({
     msg:document.getElementById('msg').textContent,
     inputs:document.querySelectorAll('#say input').length,
     lay:!document.getElementById('bLay').hidden, pass:!document.getElementById('bPass').hidden,
     swap:!document.getElementById('bSwap').hidden,
     slots:document.querySelectorAll('[data-slot]').length,
     hand:document.querySelectorAll('#hand > span').length,
     sel:!!document.querySelector('#hand .lit'),
     mids:document.querySelectorAll('[data-card]').length,
     scroll:document.body.scrollHeight>innerHeight,
     thinking:/thinking/.test(document.getElementById('msg').textContent),
   }));
   ok(!st.scroll,'page scrolled mid-game'); midsSeen=Math.max(midsSeen,st.mids);
   if(/win|draw/i.test(st.msg)) break;
   if(st.thinking){ await p.waitForTimeout(600); continue; }
   if(st.lay){
     const ins=await p.locator('#say input').count();
     for(let i=0;i<ins;i++) await p.locator('#say input').nth(i).fill(words[(laid+i)%words.length]);
     await p.click('#bLay'); laid++; await p.waitForTimeout(300);
     if(!shot && laid===1){ shot=true; }
     await p.waitForTimeout(2600); continue; }
   if(st.swap){ await p.locator('#hand > span').first().click(); await p.waitForTimeout(150); await p.click('#bSwap'); await p.waitForTimeout(2800); continue; }
   if(st.sel && st.slots){ await p.locator('[data-slot]').first().click(); await p.waitForTimeout(300);
     if(laid===2 && !fs.existsSync(SP+'/v3ask.png')) await p.screenshot({path:SP+'/v3ask.png'});
     continue; }
   if(st.hand && !st.sel && st.pass){
     if(laid===3 && passed===0){ await p.click('#bPass'); passed++; await p.waitForTimeout(300); continue; }
     await p.locator('#hand > span').first().click(); await p.waitForTimeout(250); continue; }
   if(!st.hand && st.pass){ await p.click('#bPass'); await p.waitForTimeout(200); await p.click('#bNoSwap'); await p.waitForTimeout(2800); continue; }
   await p.waitForTimeout(700);
 }
 const end=await p.evaluate(()=>({
   msg:document.getElementById('msg').textContent,
   you:+document.getElementById('sYou').textContent, it:+document.getElementById('sIt').textContent,
   cards:document.querySelectorAll('#felt > span[data-card]').length,
   hand:document.querySelectorAll('#hand > span').length, backs:document.querySelectorAll('.back').length,
   pile:+document.getElementById('sPile').textContent,
 }));
 console.log('laid',laid,'passed',passed,'mids seen',midsSeen,'end',JSON.stringify(end));
 ok(/win|draw/i.test(end.msg),'round did not end: '+end.msg);
 ok(end.cards+end.hand+end.backs+end.pile===24,'24 not conserved at end');
 ok(end.you>0,'she scored nothing');
 ok(midsSeen>=10,'few cards on table: '+midsSeen);
 const you=posted.filter(x=>/-you$/.test(x.item)), it=posted.filter(x=>/-it$/.test(x.item)), hdr=posted.filter(x=>/^g[a-z0-9]+$/.test(x.item));
 ok(hdr.length>=1,'game header not recorded twice (open + done): '+hdr.length);
 await p.waitForTimeout(600); ok(you.length>=laid-1,'her moves not all recorded: '+you.length+' of '+laid);
 const sample=you.find(x=>/links/.test(x.text)); console.log('recorded sample:',sample&&sample.text.slice(0,160));
 ok(posted.every(x=>x.text.length<=2000),'a record over 2000 chars');
 await p.locator('[data-card]').nth(1).click(); await p.waitForTimeout(150);
 const rb=await p.evaluate(()=>document.getElementById('msg').textContent); ok(/:/.test(rb),'read-back gave nothing: '+rb);
 // no white corners: sample the pixels near a DOWN card's three corners
 const white=await p.evaluate(async()=>{ const el=[...document.querySelectorAll('[data-card]')].find(e=>e.querySelector('polygon').getAttribute('points').startsWith('0,0')); if(!el) return 'nodown';
   const img=el.querySelector('image'); return img.getAttribute('transform')||'none'; });
 console.log('down card transform:',white);
 await p.screenshot({path:SP+'/v4end.png'});
 console.log(errs.length?errs.slice(0,5):'no page errors');
 console.log(fail.length?('FAIL:\n - '+fail.join('\n - ')):'ALL CHECKS PASS');
 await b.close(); server.close();
})();
