const fs=require('fs');
const D='/tmp/claude-0/-home-user/9a67f47a-9ba4-5529-a3f9-de888e6c3a69/scratchpad/horns';
const t=JSON.parse(fs.readFileSync(D+'/IJZVNv5O6rA.json'));
const segs=t.segments||[];
const hms=s=>{s=Math.floor(s);return `${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`};
const cuts=JSON.parse(fs.readFileSync(D+'/cuts.json'));
for(const c of cuts){
  const txt=segs.filter(s=>s.start>=c.t0-0.6 && s.start<c.t1).map(s=>(s.text||'').trim()).join(' ')
    .replace(/\s+/g,' ').replace(/>>\s*/g,'\n\n').replace(/\n{3,}/g,'\n\n').trim();
  fs.writeFileSync(`${D}/${c.slug}.txt`, `${c.slug}  [${hms(c.t0)} – ${hms(c.t1)}]\n\n${txt}\n`);
  console.log('===',c.slug,hms(c.t0),'-',hms(c.t1),`(${Math.round(c.t1-c.t0)}s)`,txt.split(/\s+/).length,'words');
}
