// Gap-tightening keyed to whisper word timings, run on the ORIGINAL recording.
// Cuts every inter-word gap down to a beat, protecting energetic edges
// (laughs/breaths) by extending the keep edge across bins above floor+8dB.
const fs=require('fs'),path=require('path'),os=require('os'),{execFile}=require('child_process');
const FF=require('/home/user/imageforge/node_modules/ffmpeg-static');
const IN=process.argv[2],OUT=process.argv[3];
const BEAT=Number(process.env.BEAT||0.40), LONGBEAT=Number(process.env.LONGBEAT||0.60);
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'tg-'));
const run=(a,t=600000)=>new Promise((res,rej)=>execFile(FF,a,{timeout:t,maxBuffer:1<<27},(e,so,se)=>e?rej(new Error(String(se||e.message).slice(-400))):res({stderr:se})));
const dur=async f=>{const{stderr}=await run(['-i',f,'-f','null','-']).catch(e=>({stderr:e.message}));const m=String(stderr).match(/Duration: (\d+):(\d+):([\d.]+)/);return m?+m[1]*3600+ +m[2]*60+ +m[3]:0;};
async function words(file){
  const D=await dur(file),all=[];
  for(let s=0;s<D;s+=75){
    const c=path.join(TMP,'c.mp3');
    await run(['-y','-ss',String(s),'-t','75','-i',file,'-c:a','libmp3lame','-q:a','3',c]);
    const form=new FormData();
    form.append('file',new Blob([fs.readFileSync(c)],{type:'audio/mpeg'}),'c.mp3');
    form.append('model','whisper-1');form.append('response_format','verbose_json');form.append('timestamp_granularities[]','word');
    for(let a=0;a<3;a++){
      const j=await (await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY},body:form})).json().catch(()=>({}));
      if(j.words){for(const w of j.words) all.push({w:w.word,s:w.start+s,e:w.end+s});break;}
      if(a===2)throw new Error('whisper failed');
    }
  }
  return {ws:all,D};
}
async function prof(file){
  const raw=path.join(TMP,'r.pcm');
  await run(['-y','-i',file,'-f','s16le','-ac','1','-ar','16000',raw]);
  const b=fs.readFileSync(raw),bin=320,n=Math.floor(b.length/2/bin),p=new Float32Array(n);
  for(let i=0;i<n;i++){let a=0;for(let j=0;j<bin;j++){const v=b.readInt16LE((i*bin+j)*2)/32768;a+=v*v;}p[i]=10*Math.log10(a/bin+1e-10);}
  return p;
}
(async()=>{
  const {ws,D}=await words(IN);
  const p=await prof(IN);
  const S=[...p].sort((a,b)=>a-b), floor=S[Math.floor(p.length*.08)], sp=S[Math.floor(p.length*.85)];
  const at=t=>p[Math.max(0,Math.min(p.length-1,Math.round(t/0.02)))];
  const thr=floor+8;
  // extend a keep edge outward while energy stays above floor+8dB, capped
  const extAfter=t=>{let x=t;while(x<D-0.02&&x-t<0.5&&at(x)>thr)x+=0.02;return Math.min(D,x+0.06);};
  const extBefore=t=>{let x=t;while(x>0.02&&t-x<0.5&&at(x)>thr)x-=0.02;return Math.max(0,x-0.06);};
  const cuts=[];
  const first=ws[0], last=ws[ws.length-1];
  let h=extBefore(first.s); if(h>0.15) cuts.push([0,h-0.10]);
  for(let i=0;i<ws.length-1;i++){
    const g=ws[i+1].s-ws[i].e; if(g<=0.55) continue;
    const a=extAfter(ws[i].e), b=extBefore(ws[i+1].s);
    const beat=g>4?LONGBEAT:BEAT;
    if(b-a<=beat+0.05) continue;
    cuts.push([a+beat/2,b-beat/2]);
  }
  let tl=extAfter(last.e); if(D-tl>0.25) cuts.push([Math.min(D,tl+0.10),D]);
  cuts.sort((x,y)=>x[0]-y[0]);
  const m=[];for(const c of cuts){if(m.length&&c[0]<=m[m.length-1][1]+0.02)m[m.length-1][1]=Math.max(m[m.length-1][1],c[1]);else m.push([...c]);}
  const segs=[];let cur=0;for(const[s,e]of m){if(s-cur>0.02)segs.push([cur,s]);cur=e;}if(D-cur>0.02)segs.push([cur,D]);
  const parts=segs.map((g,i)=>`[0:a]atrim=start=${g[0].toFixed(3)}:end=${g[1].toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.012,afade=t=out:st=${Math.max(0,g[1]-g[0]-0.012).toFixed(3)}:d=0.012[a${i}]`).join(';');
  await run(['-y','-i',IN,'-filter_complex',`${parts};${segs.map((_,i)=>`[a${i}]`).join('')}concat=n=${segs.length}:v=0:a=1[o]`,'-map','[o]','-ar','44100','-ac','1','-c:a','pcm_s16le',OUT]);
  const removed=m.reduce((x,[a,b])=>x+(b-a),0);
  console.log(`${path.basename(IN)}: speech85 ${sp.toFixed(1)}dB floor ${floor.toFixed(1)}dB | ${m.length} cuts, ${removed.toFixed(1)}s removed | ${D.toFixed(1)}s -> ${(D-removed).toFixed(1)}s`);
  fs.writeFileSync(OUT.replace(/\.\w+$/,'-cuts.json'),JSON.stringify({cuts:m,segs,dur:D},null,1));
  fs.rmSync(TMP,{recursive:true,force:true});
})().catch(e=>{console.error('FAILED '+e.message);process.exit(1);});
