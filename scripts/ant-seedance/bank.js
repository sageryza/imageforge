// Bank finished clips: Storage ant-story/clips/seedance/<tag>-<name>.mp4 (+poster),
// then file into the Dump album so Sophie gets a save link per clip.
//   node scripts/ant-seedance/bank.js r1
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const {initializeApp,cert,getApps}=require('firebase-admin/app'); const {getStorage}=require('firebase-admin/storage');
const FFMPEG=require('ffmpeg-static'); const FFPROBE=(()=>{try{return require('ffprobe-static').path}catch{return null}})();
const B='https://imageforge-q125.onrender.com', BUCKET='deckfactory-43176.firebasestorage.app';
const TAG=process.argv[2]||'r1'; const OUT=path.join(__dirname,'out',TAG); const ledger=path.join(OUT,'ledger.json');
const L=JSON.parse(fs.readFileSync(ledger,'utf8')); const save=()=>fs.writeFileSync(ledger,JSON.stringify(L,null,1));
if(!getApps().length) initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),storageBucket:BUCKET});
const bucket=getStorage().bucket(BUCKET);
async function up(local,dest,ct){await bucket.upload(local,{destination:dest,metadata:{contentType:ct}});await bucket.file(dest).makePublic();return `https://storage.googleapis.com/${BUCKET}/${dest}`;}
(async()=>{
 for(const [name,e] of Object.entries(L)){
  if(!e.video||e.banked) continue;
  const local=path.join(OUT,name+'.mp4'); const r=await fetch(e.video); fs.writeFileSync(local,Buffer.from(await r.arrayBuffer()));
  const poster=path.join(OUT,name+'.jpg'); try{execFileSync(FFMPEG,['-y','-ss','0.5','-i',local,'-frames:v','1','-q:v','3',poster],{stdio:'ignore'});}catch{}
  let meta='';try{meta=execFileSync(FFMPEG,['-i',local],{encoding:'utf8',stdio:['ignore','pipe','pipe']})}catch(x){meta=String(x.stderr||'')}
  const m=meta.match(/(\d{3,4})x(\d{3,4})/); const d=meta.match(/Duration: (\d+):(\d+):([\d.]+)/);
  e.w=m?+m[1]:null; e.h=m?+m[2]:null; e.seconds=d?(+d[1]*3600+ +d[2]*60+ +d[3]):null; e.bytes=fs.statSync(local).size;
  e.url=await up(local,`ant-story/clips/seedance/${TAG}-${name}.mp4`,'video/mp4');
  if(fs.existsSync(poster)) e.poster=await up(poster,`ant-story/clips/seedance/${TAG}-${name}-poster.jpg`,'image/jpeg');
  // Dump filing -> save link
  try{const q=new URLSearchParams({bundle:'Ant stills animated',filename:`${name}-${TAG}.mp4`,session:'ant-seedance-'+TAG});
    const rr=await fetch(`${B}/api/drop/upload-file?${q}`,{method:'POST',headers:{'content-type':'video/mp4'},body:fs.readFileSync(local)});
    const j=await rr.json(); e.dropId=j.item&&j.item.id; e.saveUrl=e.dropId?`${B}/api/drop/file/${e.dropId}`:null; e.dropRaw=e.dropId?undefined:JSON.stringify(j).slice(0,200);
  }catch(x){e.dropErr=x.message}
  e.banked=true; save(); console.log('banked',name,e.w+'x'+e.h,e.seconds+'s',Math.round(e.bytes/1e6*10)/10+'MB',e.saveUrl||e.dropRaw||e.dropErr);
 }
})();
