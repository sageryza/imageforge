// Repost the EXACT prompt (verbatim, not paraphrased) for every image I have a
// witch-school-cards spec for. Reconstructs precisely what the generator sent:
//   full = STYLE + (CHAR if card.char) + card.prompt + END,  with refs attached.
// style half = STYLE + CHAR + END + refs (verbatim framing); content half = card.prompt (verbatim).
const fs=require('fs');
const A='https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-school/assets/';
const BASE='https://imageforge-q125.onrender.com'; const CHAT='deck-factory-story-room';
// verbatim defaults from scripts/witch-school-cards.js
const DEFAULT_STYLE='Use the attached images ONLY as a STYLE reference — match their exact look: bold confident black ink outlines, a flat limited palette (warm golden yellow, salmon pink, bright orange, black) on a soft cream off-white background, playful modern editorial illustration, flat colors with NO gradients and minimal shading, lots of generous negative space. Draw a brand-new, SIMPLE, uncluttered illustration with one clear subject (not a busy scene). ';
const DEFAULT_CHAR='Where a woman appears, keep her consistent with the reference: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, pink-and-orange striped pants; calm and gentle. ';
const DEFAULT_END=' Subject centered with lots of empty cream space around it. Absolutely no text, no words, no letters, no numbers, no captions.';

const dir=__dirname;
const skip=new Set(['bg-map.json','assets-now.json','assets.json','compare-data.json','prompts.json','package.json']);
const items=[]; const seen=new Set();
for(const f of fs.readdirSync(dir)){
  if(!f.endsWith('.json') || skip.has(f)) continue;
  let spec; try{ spec=JSON.parse(fs.readFileSync(dir+'/'+f,'utf8')); }catch(e){ continue; }
  if(!spec || !Array.isArray(spec.cards)) continue;
  const STYLE=spec.style||DEFAULT_STYLE, CHAR=spec.charDesc||DEFAULT_CHAR, END=spec.end||DEFAULT_END;
  const refs=(spec.refs||[]).map(r=>r.replace('storage:','')).join(' + ');
  const whiten=spec.whiten?' [post: background flood-filled to pure white]':'';
  for(const card of spec.cards){
    if(!card.id || !card.prompt || seen.has(card.id)) continue;
    seen.add(card.id);
    const style = STYLE + (card.char?CHAR:'') + END + (refs?(' REFS: '+refs):'') + whiten;
    items.push({ url:A+card.id+'.png', style, content:card.prompt, src:f });
  }
}
(async()=>{
  console.log('reconstructed exact prompts for', items.length, 'images from', new Set(items.map(x=>x.src)).size, 'specs');
  // post in batches of 40
  let ok=0;
  for(let i=0;i<items.length;i+=40){
    const batch=items.slice(i,i+40).map(({url,style,content})=>({url,style,content}));
    const r=await fetch(BASE+'/api/gallery/assets/prompt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat:CHAT,items:batch})});
    const d=await r.json().catch(()=>({})); ok+=(d.saved||0);
  }
  console.log('posted exact prompts:', ok+'/'+items.length);
})();
