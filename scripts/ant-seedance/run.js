// Animate ant stills through the app's APIFRAME route (the server's key is
// the live one), then bank every clip to Storage and file it into the Dump.
//   node scripts/ant-seedance/run.js round1.json --model seedance-1.5-pro --res 1080p [--audio] [--dry] [--tag r1]
const fs=require('fs'), path=require('path'), {execFileSync}=require('child_process');
const B='https://imageforge-q125.onrender.com';
const args=process.argv.slice(2); const file=args[0];
const opt=(n,d)=>{const i=args.indexOf('--'+n);return i<0?d:args[i+1];};
const MODEL=opt('model','seedance-1.5-pro'), RES=opt('res','1080p'), TAG=opt('tag','r1');
const AUDIO=args.includes('--audio'), DRY=args.includes('--dry');
const shots=JSON.parse(fs.readFileSync(file,'utf8'));
const OUT=path.join(__dirname,'out',TAG); fs.mkdirSync(OUT,{recursive:true});
const ledger=path.join(OUT,'ledger.json');
const L=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):{};
const save=()=>fs.writeFileSync(ledger,JSON.stringify(L,null,1));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function j(url,init){const r=await fetch(url,init);const t=await r.text();let d;try{d=JSON.parse(t)}catch{d={_raw:t}};if(!r.ok){const e=new Error(`${r.status} ${t.slice(0,300)}`);e.status=r.status;throw e;}return d;}
(async()=>{
  // submit everything at once (draws run on APIFRAME's side)
  for(const s of shots){
    if(L[s.name]?.jobId) continue;
    const body={prompt:s.prompt,imageUrl:s.src,model:MODEL,resolution:RES,duration:s.secs,generateAudio:AUDIO,cameraFixed:s.cameraFixed??false};
    if(s.aspectRatio) body.aspectRatio=s.aspectRatio;
    console.log(DRY?'DRY':'SUBMIT',s.name,MODEL,RES,s.secs+'s',AUDIO?'audio':'silent');
    if(DRY) continue;
    try{const r=await j(B+'/api/apiframe/video',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      L[s.name]={jobId:r.jobId,model:MODEL,res:RES,secs:s.secs,audio:AUDIO,prompt:s.prompt,src:s.src,submittedAt:new Date().toISOString()};save();}
    catch(e){console.log('  refused',s.name,e.message);L[s.name]={error:e.message,prompt:s.prompt,src:s.src,model:MODEL,res:RES,secs:s.secs};save();}
  }
  if(DRY) return;
  // poll
  let pending=shots.filter(s=>L[s.name]?.jobId&&!L[s.name].video&&!L[s.name].failed);
  const t0=Date.now();
  while(pending.length && Date.now()-t0<40*60e3){
    await sleep(20e3);
    for(const s of pending){
      try{const r=await j(`${B}/api/apiframe/video-job/${L[s.name].jobId}`);
        if(r.status==='COMPLETED'&&r.video){L[s.name].video=r.video;L[s.name].doneAt=new Date().toISOString();console.log('DONE',s.name,r.video);save();}
        else if(/FAIL|ERROR|CANCEL/i.test(r.status||'')){L[s.name].failed=r.status;L[s.name].raw=JSON.stringify(r.raw).slice(0,400);console.log('FAILED',s.name,r.status,L[s.name].raw);save();}
      }catch(e){console.log('poll err',s.name,e.message);}
    }
    pending=shots.filter(s=>L[s.name]?.jobId&&!L[s.name].video&&!L[s.name].failed);
    console.log('pending',pending.length,Math.round((Date.now()-t0)/1000)+'s');
  }
  console.log('round finished; done',shots.filter(s=>L[s.name]?.video).length,'of',shots.length);
})();
