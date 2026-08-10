// Animate 6 punchy coffee-story beats at 480p draft (wan). Fire all, poll all.
const https=require('https');
const A='https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-school/assets/';
const BASE='https://imageforge-q125.onrender.com';
const BEATS=[
  ['cf-wired','the woman vibrating and jittering with too much caffeine, eyes widening, a jolt of energy running through her'],
  ['cf-highway','the woman sprinting hard across the road as cars rush past, her hair and clothes streaming back'],
  ['cf-track','the woman running at a full sprint as a car sweeps past just behind her in a rush of motion'],
  ['cf-siren','the woman springing up and vaulting over the fence, ambulance lights pulsing behind her'],
  ['cf-parkedcar','the woman peering out warily from under the car as a police dog’s silhouette shifts closer'],
  ['cf-penny','the woman’s face slowly shifting into dawning realization as she looks between the card and the glinting penny'],
];
function getBuf(url){return new Promise((res,rej)=>{https.get(url,r=>{if(r.statusCode!==200){rej(new Error(r.statusCode));return;}const c=[];r.on('data',d=>c.push(d));r.on('end',()=>res(Buffer.concat(c)));}).on('error',rej);});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const jobs=[];
  for(const [id,prompt] of BEATS){
    try{
      const buf=await getBuf(A+id+'.png');
      const dataUrl='data:image/png;base64,'+buf.toString('base64');
      const r=await fetch(BASE+'/api/movies/animate',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({image:dataUrl, prompt, resolution:'480p', tier:'draft'})});
      const d=await r.json();
      if(d.id){ jobs.push({id, job:d.id}); console.log('started',id,'->',d.id,'($'+d.cost+')'); }
      else { console.log('FAIL start',id,JSON.stringify(d)); }
    }catch(e){ console.log('ERR',id,e.message); }
  }
  console.log('\npolling',jobs.length,'jobs...');
  const done={};
  for(let t=0;t<60 && Object.keys(done).length<jobs.length;t++){
    await sleep(10000);
    for(const j of jobs){
      if(done[j.id]) continue;
      try{
        const r=await fetch(BASE+'/api/movies/quick/'+j.job);
        const d=await r.json();
        if(d.status==='done'){ done[j.id]={clip:d.clipUrl}; console.log('DONE',j.id,'->',d.clipUrl); }
        else if(d.status==='error'){ done[j.id]={err:d.error}; console.log('ERROR',j.id,d.error); }
      }catch(e){}
    }
  }
  console.log('\n=== CLIPS ===');
  for(const j of jobs){ const r=done[j.id]; console.log(j.id,'::', r? (r.clip||('ERR '+r.err)) : 'timeout'); }
})();
