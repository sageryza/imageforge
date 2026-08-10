const sharp = require('/home/user/imageforge/node_modules/sharp');
const https = require('https');
const fs = require('fs');
const B = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-school/assets/';
const ids = process.argv.slice(2);
function get(url){ return new Promise((res,rej)=>{ https.get(url,r=>{ if(r.statusCode!==200){rej(new Error(r.statusCode));return;} const c=[]; r.on('data',d=>c.push(d)); r.on('end',()=>res(Buffer.concat(c))); }).on('error',rej); }); }
async function sampleBg(buf){ const {data,info}=await sharp(buf).raw().toBuffer({resolveWithObject:true}); const px=(x,y)=>{const i=(y*info.width+x)*info.channels;return[data[i],data[i+1],data[i+2]];}; const m=5,corners=[px(m,m),px(info.width-1-m,m),px(m,info.height-1-m),px(info.width-1-m,info.height-1-m)]; const avg=[0,1,2].map(i=>Math.round(corners.reduce((s,c)=>s+c[i],0)/corners.length)); return '#'+avg.map(v=>v.toString(16).padStart(2,'0')).join(''); }
(async()=>{
  const map = JSON.parse(fs.readFileSync('/tmp/claude-0/-home-user/4cd68f55-e85c-5f19-a4e7-e11874ba9625/scratchpad/bg-map.json','utf8'));
  for(const id of ids){
    try { const buf=await get(B+id+'.png'); const bg=await sampleBg(buf); map[id]=bg; console.log(id,bg); }
    catch(e){ console.log(id,'ERR',e.message); }
  }
  fs.writeFileSync('/tmp/claude-0/-home-user/4cd68f55-e85c-5f19-a4e7-e11874ba9625/scratchpad/bg-map.json', JSON.stringify(map,null,0));
  console.log('total entries', Object.keys(map).length);
})();
