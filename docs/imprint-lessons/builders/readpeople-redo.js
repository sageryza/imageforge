// Faithful Read People redo — recreates HER booklet drawings; text cards for
// connective concepts; drops my invented scene-illustrations. Replaces old pages.
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
  read1: { title:'How to Read People — I. Actions & Intentions', slides:[
    { kicker:'A high IQ into a high EQ', h:'Theory of mind is just the beginning', body:'At about four, you learn that other people have their own thoughts. Most of us stop there — as if noticing that other minds exist were the whole skill. It’s only step one.' },
    { img:'hr-trains', kicker:'The easy case', h:'The train guy', body:'A man rhapsodizes about semi-automatic locomotives. Across from him: I don’t like trains, why is he still talking about trains? You don’t need advanced theory of mind to read that — and when you can’t tell, you can just ask.' },
    { img:'hr-why', kicker:'The core question', h:'Why did they do that?', body:'Every action has an intention behind it. A thought — the intention — becomes the bubble that is the action. So start simple: was it on purpose, or by accident?' },
    { img:'hr-web', kicker:'The rule', h:'Every action traces back', body:'Draw each thing someone does as a little box, and run an arrow inward from all of them. They point back to the single intention they came from.' }
  ]},
  read2: { title:'How to Read People — II. The Pattern Collector', slides:[
    { img:'hr-matchbox', kicker:'The game', h:'A pattern collector', body:'Take out a matchbox. Pick something about a person you’re unsure of, and collect evidence — every time you see an example, drop a tic-tac in the box.' },
    { img:'hr-scatter', kicker:'What to collect', h:'Pocket the examples', body:'When someone does something that doesn’t fit who you thought they were, notice it — pick it up and pocket it for later. Then watch for others that came from the same place.' },
    { kicker:'A first date', h:'The memory constellation', body:'Bring a collector for one pattern: things I don’t understand. Light a candle, dim the lights — “Whoever you are, it’s okay. No judgment comes in, none goes out.” Then lay your boxes on the table and connect the dots together.' },
    { img:'hr-daisy', kicker:'Competing patterns', h:'He loves me, he loves me not', body:'Imagine the daisy game made evidence-based. One box for the times they showed they might love you, one for the times they showed they might not.' },
    { img:'hr-evidence', kicker:'Two piles', h:'Weigh the evidence', body:'Stack the moments that actually happened into their two piles, and compare. Now the guess has something real underneath it.' },
    { img:'hr-competing', kicker:'From examples', h:'To a guess', body:'A few examples, connected, point forward to one conclusion. Keep holding it loosely — it’s still a guess, a theory.' },
    { img:'hr-corebeliefs', kicker:'Going deeper', h:'Actions add up to character', body:'An action points back to an intention. Intentions in the moment gather outward into something lasting — core beliefs, character. Your traits are the sum of your actions.' },
    { img:'hr-paradox', kicker:'A warning', h:'People as paradoxes', body:'Pull too hard on one thread and a person seems to point ten directions at once. The contradictions are real, and they belong to the whole person.' },
    { img:'hr-star', kicker:'The star of paradox', h:'Even contradictions point inward', body:'Follow each contradictory thread back and they all meet at one center — the whole person, too big to sum up.' },
    { img:'hr-teams', kicker:'Do it together', h:'Compare in pairs', body:'Sit down with someone and lay out each other’s opposite traits side by side. Two collectors help each other connect actions to intentions.' }
  ]},
  read3: { title:'How to Read People — III. Expert Mode', slides:[
    { img:'hr-map', kicker:'Advanced', h:'Mapping the mind', body:'Intentions are the surface. Under them sit core values and beliefs — the real map. Stop reading single actions and chart the terrain they come from.' },
    { kicker:'Momentary vs lasting', h:'Traits are forever', body:'Intentions live in the moment; character is permanent. Once you know someone’s core beliefs, a hundred small actions make sense at once.' },
    { kicker:'Retroactive pattern recognition', h:'The big reveal', body:'Sometimes one late fact rearranges everything before it — the detective’s missing clue, or realizing Snape was never the villain. Every earlier moment now reads differently.' },
    { img:'hr-ambiguous', kicker:'The ambiguous event', h:'One event, more than one reading', body:'Every event is a membrane holding several possible interpretations — one shape always there, the others only sometimes. By itself, you can’t tell which is true.' },
    { img:'hr-context2', kicker:'Context decides', h:'You pick the interpretation', body:'Line the possibilities up. Only in context do you get to reach in and choose which reading is the real one.' },
    { kicker:'The proactive version', h:'Planting seeds', body:'You can plant an ambiguous event on purpose — act in a way that looks one way now and reveals another later. “Now that I know you, I finally understand that thing you did.”' },
    { kicker:'One caution', h:'Keep it a theory', body:'When you catch yourself explaining someone, check that you’re not just projecting your own reasons onto them. Hold every conclusion loosely, as a theory you keep testing.' }
  ]}
};
const OLD={ read1:'pVwOEeMIpvLPoqRi9lH7', read2:'qkT9yUvhwCEfUFZ8bhH5', read3:'ejvgL1RUjsLO0Fbm0m5T' };
(async()=>{
  const out=[];
  for(const k of ['read1','read2','read3']){
    const L=LESSONS[k];
    const r=await fetch(BASE+'/api/chatfeed/page',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chat:CHAT, title:L.title, html:page(L.title,L.slides)})});
    const d=await r.json();
    out.push([L.title, d.ok?BASE+d.url:JSON.stringify(d)]);
    if(d.ok){ const dr=await fetch(BASE+'/api/chatfeed/page/'+OLD[k],{method:'DELETE'}); console.log('replaced',k,'(old',dr.status+')'); }
  }
  console.log('\n=== FAITHFUL READ PEOPLE ===');
  out.forEach(([t,u])=>console.log(t,'::',u));
})();
