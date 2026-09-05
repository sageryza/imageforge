// Poll ONLY the jobs already in a ledger (never submits anything), write results back.
//   node scripts/ant-seedance/collect.js r1
const fs=require('fs'),path=require('path');
const B='https://imageforge-q125.onrender.com'; const TAG=process.argv[2]||'r1';
const ledger=path.join(__dirname,'out',TAG,'ledger.json'); const L=JSON.parse(fs.readFileSync(ledger,'utf8'));
const save=()=>fs.writeFileSync(ledger,JSON.stringify(L,null,1)); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const t0=Date.now();
 while(Date.now()-t0<45*60e3){
  const pending=Object.entries(L).filter(([n,e])=>e.jobId&&!e.video&&!e.failed);
  if(!pending.length) break;
  for(const [n,e] of pending){ try{const r=await (await fetch(`${B}/api/apiframe/video-job/${e.jobId}`)).json();
    if(r.status==='COMPLETED'&&r.video){e.video=r.video;e.doneAt=new Date().toISOString();console.log('DONE',n);save();}
    else if(/FAIL|ERROR|CANCEL/i.test(r.status||'')){e.failed=r.status;e.raw=JSON.stringify(r.raw).slice(0,300);console.log('FAILED',n,e.failed);save();}
   }catch(x){console.log('poll err',n,x.message)} }
  await sleep(20e3);
 }
 console.log('collected',Object.values(L).filter(e=>e.video).length,'of',Object.keys(L).length);
})();
