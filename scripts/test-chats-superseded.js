#!/usr/bin/env node
// test-chats-superseded.js — the Compare tab's CURRENT / SUPERSEDED tabs.
//
//   node scripts/test-chats-superseded.js
//
// Sophie, Aug 2026: "make a superseded tab and a current tab, that way the
// drafts that have changed can still exist, but not crowd the current area."
// A new version of a deliverable is a NEW page and the old one is the history
// — deleting it throws away the record of what she was looking at when she
// left a note — so an old page moves behind a tab instead.
//
// Drives the REAL chats.html the honest way in: home list -> thread ->
// Compare tab -> the rows. Skips if no Chromium (CHROME_PATH overrides).
const http=require('http'),fs=require('fs'),path=require('path');
const PUB=path.join(__dirname,'..','public');
let sup={};                       // id -> superseded
const PAGES=[
  {id:'cur1',title:'Cutting blocks',created:new Date().toISOString()},
  {id:'old1',title:'Cutting blocks (earlier)',created:new Date(Date.now()-6e5).toISOString()},
  {id:'old2',title:'Pausing tool (earlier)',created:new Date(Date.now()-9e5).toISOString()},
];
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://x'), p=url.pathname;
  const send=(t,b)=>{res.writeHead(200,{'Content-Type':t});res.end(b);};
  if(p==='/'||p==='/chats') return send('text/html; charset=utf-8',fs.readFileSync(path.join(PUB,'chats.html'),'utf8'));
  if(p.startsWith('/api/chatfeed/page/')&&p.endsWith('/supersede')){
    let b='';req.on('data',d=>b+=d);return req.on('end',()=>{
      const id=p.split('/')[4]; sup[id]=JSON.parse(b||'{}').superseded!==false;
      send('application/json','{"ok":true}');});
  }
  if(p.startsWith('/api/chatfeed/page/')) return send('text/html; charset=utf-8','<h1>a page</h1>');
  if(p==='/api/chatfeed/pages') return send('application/json',JSON.stringify({
    pages:PAGES.map(x=>Object.assign({},x,{superseded:!!sup[x.id]}))}));
  if(p==='/api/chatfeed'){
    const t=new Date(Date.now()-36e5).toISOString();
    return send('application/json',JSON.stringify({build:'t',settings:{},truncated:[],delta:false,
      chats:{'chat-a':{lastSeen:t}},
      messages:[{id:'m1',chat:'chat-a',from:'claude',text:'hi',tldr:'hi',created:t,postedAt:t}]}));
  }
  if(p.startsWith('/api/')) return send('application/json','{"ok":true,"assets":[],"items":{},"texts":{},"pages":[]}');
  try{ return send('text/plain',fs.readFileSync(path.join(PUB,p.slice(1)))); }catch(_){ res.writeHead(404); res.end(''); }
});
(async()=>{
  let pwOk=true; try{ require('playwright'); }catch(_){ pwOk=false; }
  if(!pwOk){ console.log('playwright not installed — skipping'); process.exit(0); }
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  const pw=require('playwright');
  const b=await pw.chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
  const page=await b.newPage({viewport:{width:390,height:800}});
  const errs=[];page.on('pageerror',e=>errs.push(String(e)));
  let fails=0; const ok=(c,m)=>{console.log((c?'PASS':'FAIL')+': '+m); if(!c) fails++;};
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.crow[data-chat="chat-a"]',{timeout:8000});
  await page.click('.crow[data-chat="chat-a"]');
  await page.waitForTimeout(300);
  await page.click('.tg-compare'); await page.waitForTimeout(500);
  ok(await page.$$eval('.pagerow',n=>n.length)===3,'all three pages show while none is superseded');
  ok(await page.$$eval('#thread .acctabs',n=>n.length)===0,'no tabs until something is superseded');
  // move one across
  await page.$$eval('.pagerow .pr-sup',ns=>ns[1].click());
  await page.waitForTimeout(500);
  ok(await page.$$eval('#thread .acctabs',n=>n.length)===1,'the tabs appear once one is superseded');
  ok(await page.$$eval('.pagerow',n=>n.length)===2,'it leaves the current list');
  ok((await page.$eval('#thread .acctabs',n=>n.dataset.on))==='2','Current is the tab she lands on');
  ok((await page.$eval('#thread .acctab',n=>n.textContent)).indexOf('Superseded')>=0,'Superseded is the LEFT tab');
  await page.$$eval('#thread .acctab',ns=>ns[0].click());
  await page.waitForTimeout(300);
  ok(await page.$$eval('.pagerow',n=>n.length)===1,'and the superseded one is on the left tab');
  ok((await page.$eval('#thread .acctabs',n=>n.dataset.on))==='1','the underline slid to the left');
  ok(Math.round(await page.$eval('.pagerow',n=>parseFloat(getComputedStyle(n).fontSize)))===13,'a row keeps the button font size');
  ok((await page.$eval('.pagerow .pr-title',n=>n.textContent)).indexOf('earlier')>=0,'the right page moved');
  // put it back
  await page.$$eval('.pagerow .pr-sup',ns=>ns[0].click());
  await page.waitForTimeout(500);
  ok(await page.$$eval('.pagerow',n=>n.length)===3,'putting it back restores the current list');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs[0]:''));
  console.log(fails?fails+' failed':'all checks passed');
  await b.close(); server.close();
  process.exit(fails?1:0);
})();
