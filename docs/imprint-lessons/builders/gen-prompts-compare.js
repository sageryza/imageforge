// Compare page: every image grouped by the EXACT style prompt that made it.
// Warm house style first (the big consistent group), then each pastel variant.
// Tap an image -> full assembled prompt (style + char + content + end + refs).
const fs=require('fs');
const A='https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-school/assets/';
const BASE='https://imageforge-q125.onrender.com'; const CHAT='deck-factory-story-room';
const DEFAULT_STYLE='Use the attached images ONLY as a STYLE reference — match their exact look: bold confident black ink outlines, a flat limited palette (warm golden yellow, salmon pink, bright orange, black) on a soft cream off-white background, playful modern editorial illustration, flat colors with NO gradients and minimal shading, lots of generous negative space. Draw a brand-new, SIMPLE, uncluttered illustration with one clear subject (not a busy scene). ';
const DEFAULT_CHAR='Where a woman appears, keep her consistent with the reference: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, pink-and-orange striped pants; calm and gentle. ';
const DEFAULT_END=' Subject centered with lots of empty cream space around it. Absolutely no text, no words, no letters, no numbers, no captions.';
const skip=new Set(['bg-map.json','assets-now.json','assets.json','compare-data.json','prompts.json','package.json','package-lock.json']);

// gather cards, dedupe by id (first-seen; only 1 dupe, same style)
const groups=new Map(); // styleText -> {style, char, end, refs, whiten, items:[]}
const seen=new Set();
const files=fs.readdirSync('.').filter(f=>f.endsWith('.json')&&!skip.has(f)).sort();
for(const f of files){
  let s; try{s=JSON.parse(fs.readFileSync(f,'utf8'));}catch(e){continue;}
  if(!s||!Array.isArray(s.cards)) continue;
  const STYLE=s.style||DEFAULT_STYLE, CHAR=s.charDesc||DEFAULT_CHAR, END=s.end||DEFAULT_END;
  const refs=(s.refs||[]).map(r=>r.replace('storage:','')).join(' + ');
  const whiten=!!s.whiten;
  if(!groups.has(STYLE)) groups.set(STYLE,{style:STYLE,char:CHAR,end:END,refs,whiten,isDefault:!s.style,items:[]});
  const g=groups.get(STYLE);
  for(const c of s.cards){
    if(!c.id||!c.prompt||seen.has(c.id)) continue; seen.add(c.id);
    g.items.push({id:c.id, content:c.prompt, char:!!c.char});
  }
}
// order: default warm first, then by item count desc
const ordered=[...groups.values()].sort((a,b)=> (b.isDefault?1e9:b.items.length)-(a.isDefault?1e9:a.items.length));
let n=0;
const data=ordered.filter(g=>g.items.length).map(g=>{ n++;
  return { n, label: g.isDefault?'Warm house style':'Pastel variant '+(n-1),
    isDefault:g.isDefault, style:g.style.trim(), char:g.char.trim(), end:g.end.trim(),
    refs:g.refs, whiten:g.whiten, count:g.items.length,
    items:g.items.map(it=>({url:A+it.id+'.png', id:it.id, content:it.content, char:it.char})) };
});
const total=data.reduce((s,g)=>s+g.count,0);
const TITLE='Prompts & the images they made';
const HTML=`<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>${TITLE}</title>
<style>
  :root{ --ink:#2a2620; --ink2:#8a8377; --line:#e6dfd2; --accent:#a5586a; --card:#fffdf9; }
  *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html,body{ margin:0; background:#fbf6ef; color:var(--ink);
    font-family:-apple-system,'Helvetica Neue',sans-serif; -webkit-text-size-adjust:100%; }
  .wrap{ max-width:820px; margin:0 auto; padding:calc(16px + env(safe-area-inset-top)) 14px calc(60px + env(safe-area-inset-bottom)); }
  h1{ font-family:Georgia,serif; font-size:1.7em; font-weight:500; margin:0 0 4px; }
  .sub{ font-size:12.5px; color:var(--ink2); margin-bottom:22px; line-height:1.5; }
  .grp{ margin:0 0 30px; }
  .styhead{ background:var(--card); border:1px solid var(--line); border-radius:10px;
    padding:13px 14px; margin-bottom:12px; }
  .stytop{ display:flex; align-items:baseline; justify-content:space-between; gap:10px; margin-bottom:8px; }
  .styname{ font-family:Georgia,serif; font-size:1.06em; color:var(--accent); font-weight:600; }
  .stycount{ font-size:11.5px; color:var(--ink2); white-space:nowrap; }
  .stytext{ font-size:12px; line-height:1.5; color:#4a453d; white-space:pre-wrap; }
  .stymeta{ font-size:10.5px; color:var(--ink2); margin-top:8px; letter-spacing:.02em; }
  .stymeta b{ color:#6a6459; font-weight:600; }
  .toggle{ display:flex; align-items:center; gap:7px; margin:10px 0 4px; cursor:pointer;
    font-size:12.5px; color:var(--accent); font-weight:600; user-select:none; }
  .toggle .chev{ display:inline-block; transition:transform .18s; font-size:11px; }
  .grp.open .toggle .chev{ transform:rotate(90deg); }
  .grid{ display:none; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:11px; margin-top:8px; }
  .grp.open .grid{ display:grid; }
  .cell{ cursor:pointer; }
  .cell .thumb{ aspect-ratio:1/1; border-radius:10px; border:1px solid var(--line);
    overflow:hidden; background:#fff; display:flex; align-items:center; justify-content:center; }
  .cell img{ width:100%; height:100%; object-fit:contain; }
  .cell .cap{ font-size:10.5px; line-height:1.35; color:#5a544b; margin:6px 3px 0;
    display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
  /* lightbox */
  #lb{ position:fixed; inset:0; background:rgba(30,26,22,.94); display:none; z-index:50;
    overflow-y:auto; -webkit-overflow-scrolling:touch; }
  #lb.on{ display:block; }
  .lbin{ max-width:640px; margin:0 auto; padding:calc(64px + env(safe-area-inset-top)) 16px 80px; }
  #lbimg{ width:100%; border-radius:12px; background:#fff; display:block; cursor:zoom-out; }
  .lbtap{ text-align:center; color:#b7ab9a; font-size:11px; margin:10px 0 0; }
  #lbdone{ display:block; width:100%; margin:22px 0 0; padding:14px; border:none; border-radius:8px;
    background:#a5586a; color:#fff; font-size:15px; font-weight:600; cursor:pointer; }
  .lblabel{ color:#f4ede2; font-family:Georgia,serif; font-size:1.05em; margin:16px 0 3px; }
  .lbid{ color:#b7ab9a; font-size:11px; margin-bottom:16px; }
  .lbsec{ color:#c9bdac; font-size:10.5px; letter-spacing:.14em; text-transform:uppercase; margin:16px 0 5px; }
  .lbbody{ color:#efe7db; font-size:13px; line-height:1.55; white-space:pre-wrap; word-wrap:break-word; }
  .lbfull{ color:#d8cdbd; font-size:12px; line-height:1.5; white-space:pre-wrap; word-wrap:break-word;
    background:rgba(0,0,0,.25); border-radius:8px; padding:11px 12px; }
  #lbx{ position:fixed; top:calc(10px + env(safe-area-inset-top)); right:14px; z-index:51;
    width:38px; height:38px; border-radius:6px; border:none; background:rgba(0,0,0,.5);
    color:#fff; font-size:20px; line-height:1; cursor:pointer; }
</style>
<div class="wrap">
  <h1>${TITLE}</h1>
  <div class="sub">Every image grouped under the exact prompt that generated it. <b>Tap a section to expand its images</b>; tap any image for the full prompt.<br><b>${total} images · ${data.length} distinct style prompts.</b> The warm house style is one consistent style; the rest are pastel variants that drifted apart.</div>
  <div id="groups"></div>
</div>
<div id="lb"><button id="lbx" aria-label="Close">&times;</button><div class="lbin">
  <img id="lbimg" alt="">
  <div class="lbtap">tap the image or Close to go back</div>
  <div class="lblabel" id="lblabel"></div>
  <div class="lbid" id="lbid"></div>
  <div class="lbsec">Content prompt (what changed per image)</div>
  <div class="lbbody" id="lbcontent"></div>
  <div class="lbsec">Full prompt sent to the model</div>
  <div class="lbfull" id="lbfull"></div>
  <button id="lbdone">Close</button>
</div></div>
<script>
(function(){
  var DATA=${JSON.stringify(data)};
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var groups=document.getElementById('groups');
  DATA.forEach(function(g){
    var meta=[];
    meta.push('bg: <b>'+(g.whiten?'flood-filled to WHITE':'cream (kept)')+'</b>');
    if(g.refs) meta.push('refs: '+esc(g.refs));
    var html='<div class="grp" data-grp="'+g.n+'"><div class="styhead">'+
      '<div class="stytop"><span class="styname">'+esc(g.label)+'</span><span class="stycount">'+g.count+' image'+(g.count===1?'':'s')+'</span></div>'+
      '<div class="stytext">'+esc(g.style)+'</div>'+
      '<div class="stymeta">'+meta.join(' &nbsp;·&nbsp; ')+'</div></div>'+
      '<div class="toggle" data-toggle="'+g.n+'"><span class="chev">&#9654;</span><span class="tlabel">Show '+g.count+' image'+(g.count===1?'':'s')+'</span></div>'+
      '<div class="grid">';
    g.items.forEach(function(it,idx){
      html+='<div class="cell" data-g="'+g.n+'" data-i="'+idx+'"><div class="thumb"><img loading="lazy" src="'+it.url+'" alt=""></div><div class="cap">'+esc(it.content)+'</div></div>';
    });
    html+='</div></div>';
    groups.insertAdjacentHTML('beforeend', html);
  });
  var lb=document.getElementById('lb'), lbimg=document.getElementById('lbimg'),
      lblabel=document.getElementById('lblabel'), lbid=document.getElementById('lbid'),
      lbcontent=document.getElementById('lbcontent'), lbfull=document.getElementById('lbfull');
  function byN(n){ return DATA.filter(function(g){return g.n==n;})[0]; }
  var savedY=0;
  function open(g,it){
    lbimg.src=it.url; lblabel.textContent=g.label; lbid.textContent=it.id;
    lbcontent.textContent=it.content;
    var full=g.style+' '+(it.char?g.char+' ':'')+it.content+' '+g.end;
    if(g.refs) full+='\\n\\nSTYLE REFS: '+g.refs;
    if(g.whiten) full+='\\n[post-process: background flood-filled to pure white]';
    lbfull.textContent=full;
    // Lock the page behind the image: fix the body in place so nothing (incl.
    // the injected autoscroll pill) can scroll underneath, then restore on close.
    savedY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position='fixed';
    document.body.style.top=(-savedY)+'px';
    document.body.style.left='0'; document.body.style.right='0'; document.body.style.width='100%';
    lb.classList.add('on'); lb.scrollTop=0;
  }
  function close(){
    lb.classList.remove('on');
    document.body.style.position=''; document.body.style.top='';
    document.body.style.left=''; document.body.style.right=''; document.body.style.width='';
    window.scrollTo(0, savedY);
  }
  groups.addEventListener('click', function(e){
    var tog=e.target.closest('.toggle');
    if(tog){ var grp=groups.querySelector('.grp[data-grp="'+tog.getAttribute('data-toggle')+'"]');
      if(grp){ var willOpen=!grp.classList.contains('open'); grp.classList.toggle('open');
        var lab=tog.querySelector('.tlabel'); var n=grp.querySelectorAll('.cell').length;
        lab.textContent=(willOpen?'Hide ':'Show ')+n+' image'+(n===1?'':'s'); }
      return; }
    var cell=e.target.closest('.cell'); if(!cell) return;
    var g=byN(cell.getAttribute('data-g')); if(!g) return;
    open(g, g.items[+cell.getAttribute('data-i')]);
  });
  document.getElementById('lbx').addEventListener('click', close);
  document.getElementById('lbdone').addEventListener('click', close);
  lbimg.addEventListener('click', close);
  lb.addEventListener('click', function(e){ if(e.target===lb || e.target.classList.contains('lbin')) close(); });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape' && lb.classList.contains('on')) close(); });
})();
</script>`;
const OLD='35bXjQrkohsSEcuGHLpa';
(async()=>{
  const r=await fetch(BASE+'/api/chatfeed/page',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat:CHAT, title:TITLE, html:HTML})});
  const d=await r.json();
  if(d.ok){ await fetch(BASE+'/api/chatfeed/page/'+OLD,{method:'DELETE'}).catch(()=>{}); }
  console.log('groups:',data.length,'| total images:',total,'| bytes:',HTML.length);
  console.log(TITLE,'->',d.ok?BASE+d.url:JSON.stringify(d));
})();
