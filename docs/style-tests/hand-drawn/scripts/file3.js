const fs=require('fs'),path=require('path');
const BASE='https://imageforge-q125.onrender.com',CHAT='hand-drawn-illustration-style';
const ITEMS=[
 ['out7/purple-flower--low.png',    'FIXED prompt · Two girls, purple flower · low — both girls kept, white space'],
 ['out7/purple-flower--medium.png', 'FIXED prompt · Two girls, purple flower · MEDIUM'],
 ['out7/same-yellow-coat--low.png', 'FIXED prompt · Same yellow coat · low'],
 ['out7/three-birds--low.png',      'FIXED prompt · Three birds, one to each wire · low'],
];
async function post(u,b){const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
 const t=await r.text();let j;try{j=JSON.parse(t)}catch{j={raw:t.slice(0,200)}};return{status:r.status,json:j};}
(async()=>{let n=0;const urls=[];
 for(const [rel,description] of ITEMS){
  const f=path.join(__dirname,rel); if(!fs.existsSync(f)){console.log('MISSING',rel);continue;}
  const up=await post(`${BASE}/api/ingest/upload`,{batch:'style-tests',keyword:rel.replace(/[\/.]/g,'-'),
    images:['data:image/png;base64,'+fs.readFileSync(f).toString('base64')]});
  const url=up.json?.images?.[0]; if(!url){console.log('UPLOAD FAIL',rel,up.status);continue;}
  const g=await post(`${BASE}/api/gallery`,{url,chat:CHAT,assetsOnly:true,description});
  console.log(g.status===200?'filed':'FAIL',rel,g.status); if(g.status===200){n++;urls.push({rel,url,description});}
 }
 fs.writeFileSync(path.join(__dirname,'filed3.json'),JSON.stringify(urls,null,2));
 console.log(`\n${n}/${ITEMS.length} filed`);})();
