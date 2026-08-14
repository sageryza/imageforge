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

const TITLE='The Metaphor Machine';
const SLIDES=[
  { img:'mm-twoplanes', kicker:'Two floors', h:'The world has an upstairs', body:'Downstairs is everything you can touch — a mug, a book, your glasses. Upstairs is where the ideas live: the circle, the pyramid, the concept itself. You can’t hold anything up there, but it’s just as real.' },
  { img:'mm-tunein', kicker:'The old question', h:'Do we build ideas, or find them?', body:'It’s tempting to think you build a concept by gluing examples together. But it’s easier — and maybe truer — to picture the idea already up there, finished, waiting. Learning is tuning in and pointing at it.' },
  { img:'mm-teaset', kicker:'A first clue', h:'A tea set belongs together', body:'Why do these pieces go together? They share features — same pattern, same china, same look. They point up to the same place because they resemble each other.' },
  { img:'mm-firstaid', kicker:'But also', h:'So does a first-aid kit', body:'A bandage, scissors, antiseptic — nothing alike. Yet they belong together too, by shared purpose: help when you’re hurt. Same word, “belong,” a different upstairs.' },
  { img:'mm-belong', kicker:'The pointer', h:'One word, two planes', body:'“Belong” isn’t one fixed thing. Sometimes it points up to a plane of shared looks, sometimes to a plane of shared purpose. The word is the arrow; the plane is where it lands.' },
  { img:'mm-pointer', kicker:'What a metaphor is', h:'Time is money', body:'When you say time is money, you’re pointing, not inventing. Both can be spent, saved, wasted. A metaphor says: these two different things touch the same spot upstairs.' },
  { img:'mm-machine', kicker:'The machine', h:'Feed it examples, it finds the idea', body:'That’s the Metaphor Machine. Put in a handful of concrete things, turn the crank, and out floats the invisible concept they share. It doesn’t make the idea — it locates it.' },
  { img:'mm-collect', kicker:'How it runs', h:'Lay them side by side', body:'Gather a few instances, set them together, and feel for what they have in common. The shared thing rises up between them — the essence becoming visible.' },
  { img:'mm-ladder', kicker:'The part people mix up', h:'Building is just the ladder', body:'Connecting examples is only the ladder — the climb up to a plane that was already there. Point at the idea first; the full building can come later.' },
  { img:'mm-essence', kicker:'An old name for it', h:'The essence, the form', body:'Plato called the upstairs thing a Form — the soul of the object, the ideal it’s a copy of. Every mug is a stab at Mug. The concept is the essence living inside the thing.' },
  { img:'mm-teach', kicker:'Why it matters', h:'You can hand someone the ladder', body:'Once you can see the plane, you can teach any idea: give someone the right few concrete examples and let their own machine find the concept. That’s what every one of these lessons is doing to you right now.' }
];
(async()=>{
  const r=await fetch(BASE+'/api/chatfeed/page',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat:CHAT, title:TITLE, html:page(TITLE,SLIDES)})});
  const d=await r.json();
  console.log(TITLE,'->',d.ok?BASE+d.url:JSON.stringify(d));
})();
