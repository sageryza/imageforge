const http=require('http'), fs=require('fs'), path=require('path');
const {chromium}=require('playwright-core');
const PUB=path.join(__dirname,'public');
const T0=Date.now(), iso=(ms)=>new Date(ms).toISOString();
const long='The hook flagged unpushed commits so I verified what they actually were before pushing.\n\nThere were three, all mine, so I pushed them and opened a PR. Details of what each one did and why the order mattered follow here so the preview has to truncate.';
const MSGS=[{id:'m1',chat:'revert-playground-views',from:'claude',text:long,tldr:'pushed the stranded commits',created:iso(T0-1020000),postedAt:iso(T0-1020000),url:'https://claude.ai/code/session_abc'},
            {id:'m2',chat:'revert-playground-views',from:'sophie',text:'do the images',created:iso(T0-1080000),postedAt:iso(T0-1080000)}];
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://x');
 if(u.pathname==='/api/chatfeed'){res.writeHead(200,{'Content-Type':'application/json'});
  return res.end(JSON.stringify({build:'b1',chats:{'revert-playground-views':{lastSeen:MSGS[0].created,sophieNote:'note to myself',url:'https://claude.ai/code/session_abc'}},settings:{},truncated:[],messages:u.searchParams.get('since')?[]:MSGS}));}
 if(u.pathname==='/api/chatfeed/thread'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({messages:MSGS}));}
 if(u.pathname==='/'||u.pathname==='/chats'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(fs.readFileSync(path.join(PUB,'chats.html'),'utf8'));}
 res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({assets:[],pages:[],items:[]}));
});
(async()=>{
 await new Promise(r=>server.listen(0,r));
 const base='http://127.0.0.1:'+server.address().port;
 const exe=['/opt/pw-browsers/chromium-1194/chrome-linux/chrome','/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p=>{try{fs.accessSync(p);return true}catch{return false}});
 const b=await chromium.launch(exe?{executablePath:exe}:{});
 const page=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
 const OUT='/tmp/claude-0/-home-user/bb915fe6-1ed9-5f0f-9301-c8bc3b801238/scratchpad/';
 await page.goto(base+'/chats'); await page.waitForSelector('#grid [data-chat]');
 await page.click('#grid .crow[data-chat="revert-playground-views"]');
 await page.waitForSelector('#thread .msg'); await page.waitForTimeout(500);
 await page.screenshot({path:OUT+'thread2.png'});
 const geo=await page.$$eval('#thread .msg:first-of-type button, #thread .msg:first-of-type .m-head *, #thread .msg:first-of-type a',
   ns=>ns.map(n=>{const r=n.getBoundingClientRect();return {cls:n.className&&n.className.baseVal===undefined?n.className:'(svg)',
     label:(n.getAttribute&&n.getAttribute('aria-label'))||(n.textContent||'').trim().slice(0,24),
     x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};}));
 console.log(JSON.stringify(geo,null,1));
 await b.close(); server.close();
})();
