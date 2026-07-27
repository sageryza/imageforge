const fs=require('fs'),path=require('path');
const OUT=path.join(__dirname,'out5');fs.mkdirSync(OUT,{recursive:true});

// Style v2 (content-stripped) + a SINGLE-SUBJECT direction replacing the old
// "visual scene" paragraph. Moment text verbatim, nothing appended.
const STYLE=`ILLUSTRATION STYLE:
Delicate hand-drawn ink illustration with thin, slightly irregular black outlines and flat opaque pastel color fills. Whimsical modern folk art. Simplified shapes, charming imperfections, restrained detail, minimal or no shading, and generous negative space. Use dusty blush, muted coral, pale aqua, mustard gold, lavender-gray, cream, and soft taupe. The result should resemble a thoughtfully designed independent sticker sheet or boutique stationery print—not polished vector clip art, not watercolor, not realistic, and not cartoonish.

This is not a scene. Draw one single subject from the moment—the one object or figure that carries its meaning—isolated on a plain cream background, the way a single sticker is drawn. No setting, no environment, no scenery, no background elements or props around it. Keep it simple, uncluttered, and readable at a glance.

`;
const MOMENTS=[
 {slug:'purple-flower',label:'Two little girls holding hands, and the flower was purple',
  moment:'I saw two little girls holding hands, and then one of them picked a flower, but it was purple.'},
 {slug:'same-yellow-coat',label:'Two strangers in the same yellow coat',
  moment:'Two strangers passed each other on the sidewalk wearing the exact same yellow coat, and neither of them noticed.'},
 {slug:'three-birds',label:'Three birds, one to each wire',
  moment:'There were three telephone wires and exactly one small bird sitting on each of them, evenly spaced.'},
];
async function gen(prompt,quality){
 const r=await fetch('https://api.openai.com/v1/images/generations',{method:'POST',
  headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
  body:JSON.stringify({model:'gpt-image-2',prompt,n:1,size:'1024x1024',quality,output_format:'png'})});
 const d=await r.json();
 if(d.error)throw new Error(d.error.message||JSON.stringify(d.error));
 const b=d.data?.[0]?.b64_json; if(!b)throw new Error('no image');
 return {buf:Buffer.from(b,'base64'),usage:d.usage};
}
(async()=>{
 const jobs=MOMENTS.map(m=>({...m,quality:'low'}));
 jobs.push({...MOMENTS[0],quality:'medium'});
 const res=await Promise.all(jobs.map(async j=>{
  const t=Date.now();
  try{const {buf,usage}=await gen(STYLE+j.moment,j.quality);
   const f=path.join(OUT,`${j.slug}--${j.quality}.png`);fs.writeFileSync(f,buf);
   console.log(`ok   ${j.slug} [${j.quality}] ${Math.round((Date.now()-t)/1000)}s`);
   return {...j,file:f,seconds:Math.round((Date.now()-t)/1000),usage,createdAt:t};
  }catch(e){console.log(`FAIL ${j.slug} [${j.quality}] ${e.message}`);return {...j,error:e.message};}
 }));
 fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(res,null,2));
 fs.writeFileSync(path.join(OUT,'style.txt'),STYLE);
 console.log('\ndone');
})();
