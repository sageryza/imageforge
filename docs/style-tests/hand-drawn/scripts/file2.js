const fs=require('fs'),path=require('path');
const BASE='https://imageforge-q125.onrender.com',CHAT='hand-drawn-illustration-style';
const ITEMS=[
 ['out4/purple-flower--low.png',      'EXACT prompt v2 (no edits from me) · Two girls, purple flower · low'],
 ['out4/purple-flower--medium.png',   'EXACT prompt v2 (no edits from me) · Two girls, purple flower · MEDIUM'],
 ['out4/same-yellow-coat--low.png',   'EXACT prompt v2 (no edits from me) · Same yellow coat · low'],
 ['out4/three-birds--low.png',        'EXACT prompt v2 (no edits from me) · Three birds · low — sky still fills in'],
 ['out6/purple-flower--low.png',      'SINGLE-THING + white space · Two girls, purple flower · low — lost the 2nd girl'],
 ['out6/purple-flower--medium.png',   'SINGLE-THING + white space · Two girls, purple flower · MEDIUM — lost the 2nd girl'],
 ['out6/same-yellow-coat--low.png',   'SINGLE-THING + white space · Same yellow coat · low — kept both, street gone'],
 ['out6/three-birds--low.png',        'SINGLE-THING + white space · Three birds · low — clean white, works'],
];
async function post(u,b){const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
 const t=await r.text();let j;try{j=JSON.parse(t)}catch{j={raw:t.slice(0,200)}};return{status:r.status,json:j};}
(async()=>{let n=0;
 for(const [rel,description] of ITEMS){
  const f=path.join(__dirname,rel); if(!fs.existsSync(f)){console.log('MISSING',rel);continue;}
  const up=await post(`${BASE}/api/ingest/upload`,{batch:'style-tests',keyword:rel.replace(/[\/.]/g,'-'),
    images:['data:image/png;base64,'+fs.readFileSync(f).toString('base64')]});
  const url=up.json?.images?.[0];
  if(!url){console.log('UPLOAD FAIL',rel,up.status);continue;}
  const g=await post(`${BASE}/api/gallery`,{url,chat:CHAT,assetsOnly:true,description});
  console.log(g.status===200?'filed':'FAIL',rel,g.status); if(g.status===200)n++;
 }
 console.log(`\n${n}/${ITEMS.length} filed`);})();
