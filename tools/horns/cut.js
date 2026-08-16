const admin=require('firebase-admin');
const FFMPEG=require('ffmpeg-static');
const {execFile}=require('child_process');
const fs=require('fs'), path=require('path');
const sa=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({credential:admin.credential.cert(sa),storageBucket:`${sa.project_id}.firebasestorage.app`});
const b=admin.storage().bucket();
const DIR='/tmp/claude-0/-home-user/9a67f47a-9ba4-5529-a3f9-de888e6c3a69/scratchpad/horns/clips';
fs.mkdirSync(DIR,{recursive:true});
const run=(a)=>new Promise((res,rej)=>execFile(FFMPEG,a,{maxBuffer:1<<26,timeout:900000},(e,so,se)=>e?rej(new Error(String(se).slice(-400))):res()));
const URLS={IJZVNv5O6rA:'/tmp/claude-0/-home-user/9a67f47a-9ba4-5529-a3f9-de888e6c3a69/scratchpad/horns/IJZVNv5O6rA.webm',
            wwQcSKbqfoQ:'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/nde-audio/wwQcSKbqfoQ.webm'};
const CUTS=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
(async()=>{
  const out=[];
  for (const c of CUTS){
    const f=path.join(DIR,`${c.slug}.mp3`);
    if(!fs.existsSync(f)){
      console.log('cutting',c.slug,(c.t1-c.t0).toFixed(0)+'s');
      await run(['-y','-ss',String(c.t0),'-t',String(c.t1-c.t0),'-i',URLS[c.src],'-vn','-c:a','libmp3lame','-q:a','4',f]);
    }
    const dest=`horns-passages/${c.slug}.mp3`;
    await b.upload(f,{destination:dest,metadata:{contentType:'audio/mpeg',cacheControl:'public, max-age=31536000, immutable'}});
    await b.file(dest).makePublic();
    const url=`https://storage.googleapis.com/${b.name}/${dest}`;
    console.log('  ->',(fs.statSync(f).size/1e6).toFixed(1)+'MB',url);
    out.push({...c,url,bytes:fs.statSync(f).size});
  }
  fs.writeFileSync(DIR+'/clips.json',JSON.stringify(out,null,2));
  process.exit(0);
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
