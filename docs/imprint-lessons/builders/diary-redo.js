// Rebuild ADHD + Dysphoria lessons around HER actual diary drawings.
const fs=require('fs');
const A='https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-school/assets/';
const CHAT='deck-factory-story-room';
const BASE='https://imageforge-q125.onrender.com';
const BG=JSON.parse(fs.readFileSync(__dirname+'/bg-map.json','utf8'));
const NEUTRAL='#fbf7ef';
function attachBg(s){ return s.map(x=>Object.assign({bg:x.img?(BG[x.img]||NEUTRAL):NEUTRAL},x)); }
function page(title, slidesRaw){
  const slides=attachBg(slidesRaw); const data=JSON.stringify(slides);
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>${title}</title>
<style>
  :root{ --ink:#2a2620; --ink2:#8a8377; --line:#d9d2c2; --accent:#a5586a; }
  *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html,body{ margin:0; height:100%; background:#fdf9f3; color:var(--ink);
    font-family:Georgia,'Times New Roman',serif; overscroll-behavior:none; }
  #stage{ position:fixed; inset:0; display:flex; flex-direction:column; transition:background .38s ease; }
  .dashes{ display:flex; gap:4px; padding:calc(12px + env(safe-area-inset-top)) 16px 6px; flex:none; }
  .dash{ flex:1; height:3px; border-radius:2px; background:var(--line); transition:background .2s; }
  .dash.on{ background:var(--ink); }
  .cards{ flex:1; position:relative; min-height:0; }
  .card{ position:absolute; inset:0; display:none; flex-direction:column;
    align-items:center; justify-content:center; text-align:center; padding:1vh 7vw 12vh; overflow-y:auto; }
  .card.show{ display:flex; }
  .head{ flex:none; }
  .kicker{ font-family:-apple-system,'Helvetica Neue',sans-serif; font-size:10.5px;
    letter-spacing:.24em; text-transform:uppercase; color:var(--accent); margin-bottom:7px; }
  h2{ font-size:1.42em; line-height:1.18; font-weight:500; margin:0; max-width:15em; }
  img.art{ width:auto; max-width:min(80vw,360px); max-height:40vh; object-fit:contain; display:block; margin:15px 0 13px; }
  p{ font-size:1.08em; line-height:1.56; margin:0; max-width:20em; }
  .textonly h2{ font-size:1.95em; font-weight:500; }
  .textonly p{ margin-top:.7em; }
  .hint{ position:absolute; bottom:calc(20px + env(safe-area-inset-bottom)); left:0; right:0;
    text-align:center; font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.14em;
    text-transform:uppercase; color:var(--ink2); pointer-events:none; transition:opacity .4s; }
  .zones{ position:absolute; inset:0; display:flex; }
  .zback{ width:30%; } .zfwd{ width:70%; }
</style>
<div id="stage">
  <div class="dashes" id="dashes"></div>
  <div class="cards" id="cards"></div>
  <div class="hint" id="hint">tap to begin &rsaquo;</div>
  <div class="zones"><div class="zback" id="zback"></div><div class="zfwd" id="zfwd"></div></div>
</div>
<script>
(function(){
  var A='${A}'; var slides=${data};
  var stage=document.getElementById('stage'), cards=document.getElementById('cards'),
      dashes=document.getElementById('dashes'), hint=document.getElementById('hint');
  slides.forEach(function(s){
    var c=document.createElement('div'); c.className='card'+(s.img?'':' textonly');
    c.innerHTML='<div class="head"><div class="kicker">'+s.kicker+'</div><h2>'+s.h+'</h2></div>'
      +(s.img?'<img class="art" alt="" src="'+A+s.img+'.png">':'')+'<p>'+s.body+'</p>';
    cards.appendChild(c);
    var d=document.createElement('div'); d.className='dash'; dashes.appendChild(d);
  });
  var cardEls=cards.querySelectorAll('.card'), dashEls=dashes.querySelectorAll('.dash'), i=0;
  function render(){
    cardEls.forEach(function(c,n){ c.classList.toggle('show', n===i); });
    dashEls.forEach(function(d,n){ d.classList.toggle('on', n<=i); });
    stage.style.background = slides[i].bg || '#fdf9f3'; hint.style.opacity=i===0?'1':'0'; cardEls[i].scrollTop=0;
  }
  function next(){ if(i<slides.length-1){ i++; render(); } }
  function prev(){ if(i>0){ i--; render(); } }
  document.getElementById('zfwd').addEventListener('click', next);
  document.getElementById('zback').addEventListener('click', prev);
  document.addEventListener('keydown', function(e){ if(e.key==='ArrowRight')next(); if(e.key==='ArrowLeft')prev(); });
  render();
})();
</script>`;
}

const LESSONS = {
  adhd: { title:'ADHD & Autism — cluster, spectrum, genes', slides:[
    { kicker:'Everywhere now', h:'“I’m autistic!”', body:'It’s the label of the moment. So what is it, actually?' },
    { img:'nd-cluster2', kicker:'First', h:'A cluster of characteristics', body:'Autism is one word for a bundle of traits that travel together — reduced mind-reading, senses turned up too high, an odd knack for counting. Not one thing; a cluster.' },
    { img:'nd-binaryspectrum', kicker:'So what is it?', h:'Binary, spectrum, or cluster?', body:'A yes/no box you check one of? A single line you sit somewhere along? Closer to the truth: a loose cluster of traits, mixed differently in each person.' },
    { img:'nd-helix', kicker:'But wait', h:'Actually — it’s the genes', body:'Under the traits, it’s inherited. Not one switch but thousands of tiny nudges, written into the DNA and passed down.' },
    { img:'nd-blobweb', kicker:'And they mix', h:'The labels overlap', body:'Autism, ADHD, OCD, BPD — separate names laid over a shared web of traits, connected across the lines. The edges blur.' },
    { img:'nd-phone2', kicker:'Meanwhile', h:'“You might have ADHD”', body:'“Do you pick your nose? You might have ADHD.” The feed hands out diagnoses like candy.' },
    { kicker:'So', h:'Real — and a cluster', body:'Genuinely genetic, genuinely a spread — and still, not everything is it.' }
  ]},
  dysphoria: { title:'General Dysphoria', slides:[
    { img:'gd-escaping', kicker:'The feeling', h:'A self that won’t stay put', body:'There’s a self in here that keeps slipping out of the shape people see — the real one, escaping the outline. That’s dysphoria, and it isn’t only about gender.' },
    { img:'gd-assumptions', kicker:'At a glance', h:'Gender is just one assumption', body:'People pin a whole set of guesses on you the moment they see you — your age (thirty-four, handed the kids’ menu), your competence, your gender. Gender is just one tag stuck in the blob.' },
    { img:'gd-youarehere2', kicker:'On meeting you', h:'You are here', body:'In seconds they’ve plotted you on their own charts — a wedge of the pie, a point on the grid. A rough locator for a whole person.' },
    { img:'gd-progression', kicker:'The best they do', h:'Vague, closer, closest', body:'First a vague shape, then a sharper but still-wrong guess, then the closest they’ll ever come. Never exactly you.' },
    { img:'gd-olives', kicker:'Even so', h:'Still learning you', body:'And the people who’ve known you for years keep finding new things. “I didn’t know you liked olives!” “I do.” The picture is never finished.' },
    { kicker:'So', h:'Name it: general dysphoria', body:'Once you see the shape, you see it everywhere — the gap between the self inside and the guess outside. Yours, and everyone’s.' }
  ]}
};

(async()=>{
  // find current page ids by title
  const r0=await fetch(BASE+'/api/chatfeed/pages?chat='+CHAT);
  const j0=await r0.json(); const pages=j0.pages||j0||[];
  const idByTitle={}; for(const p of pages){ idByTitle[p.title]=p.id; }
  const out=[];
  for(const k of ['adhd','dysphoria']){
    const L=LESSONS[k];
    const r=await fetch(BASE+'/api/chatfeed/page',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chat:CHAT, title:L.title, html:page(L.title,L.slides)})});
    const d=await r.json();
    out.push([L.title, d.ok?BASE+d.url:JSON.stringify(d)]);
    const old=idByTitle[L.title];
    if(d.ok && old){ const dr=await fetch(BASE+'/api/chatfeed/page/'+old,{method:'DELETE'}); console.log('replaced',k,'(old',old,dr.status+')'); }
    else console.log('posted',k,'(no old id found to delete)');
  }
  console.log('\n=== FAITHFUL ADHD + DYSPHORIA ===');
  out.forEach(([t,u])=>console.log(t,'::',u));
})();
