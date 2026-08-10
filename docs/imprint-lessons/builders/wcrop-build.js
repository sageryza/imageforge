// DRAFT: "Where Do You Crop Art?" — copy is Sophie's own words (filler removed),
// pastel/white theme. Text cards where an image isn't made yet.
const fs=require('fs');
const A='https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-school/assets/';
const CHAT='deck-factory-story-room';
const BASE='https://imageforge-q125.onrender.com';
const BG=JSON.parse(fs.readFileSync(__dirname+'/bg-map.json','utf8'));
const NEUTRAL='#ffffff';
function attachBg(s){ return s.map(x=>Object.assign({bg:x.img?(BG[x.img]||NEUTRAL):NEUTRAL},x)); }
function page(title, slidesRaw){
  const slides=attachBg(slidesRaw); const data=JSON.stringify(slides);
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>${title}</title>
<style>
  :root{ --ink:#2a2620; --ink2:#8a8377; --line:#e0d7ea; --accent:#b98bc9; }
  *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html,body{ margin:0; height:100%; background:#ffffff; color:var(--ink);
    font-family:Georgia,'Times New Roman',serif; overscroll-behavior:none; }
  #stage{ position:fixed; inset:0; display:flex; flex-direction:column; transition:background .38s ease; }
  .dashes{ display:flex; gap:4px; padding:calc(12px + env(safe-area-inset-top)) 16px 6px; flex:none; }
  .dash{ flex:1; height:3px; border-radius:2px; background:var(--line); transition:background .2s; }
  .dash.on{ background:var(--accent); }
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
  .todo{ font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.12em; text-transform:uppercase;
    color:#c58; border:1px dashed #dab; border-radius:6px; padding:8px 12px; margin:6px 0 16px; }
  .textonly h2{ font-size:1.7em; font-weight:500; }
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
    var art = s.img ? '<img class="art" alt="" src="'+A+s.img+'.png">' : (s.todo?'<div class="todo">image to make: '+s.todo+'</div>':'');
    c.innerHTML='<div class="head"><div class="kicker">'+s.kicker+'</div><h2>'+s.h+'</h2></div>'+art+'<p>'+s.body+'</p>';
    cards.appendChild(c);
    var d=document.createElement('div'); d.className='dash'; dashes.appendChild(d);
  });
  var cardEls=cards.querySelectorAll('.card'), dashEls=dashes.querySelectorAll('.dash'), i=0;
  function render(){
    cardEls.forEach(function(c,n){ c.classList.toggle('show', n===i); });
    dashEls.forEach(function(d,n){ d.classList.toggle('on', n<=i); });
    stage.style.background = slides[i].bg || '#ffffff'; hint.style.opacity=i===0?'1':'0'; cardEls[i].scrollTop=0;
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

const TITLE='Where Do You Crop Art? (draft)';
const SLIDES=[
  { img:'na-pipeline', kicker:'My friend Mason', h:'He makes noise art', body:'Mason’s a philosopher and a poet, and he makes this kind of noise art — which is actually a genre of music. It’s a process: you take an input, change it, see the result, change that, and on and on. What comes out looks like art, because it’s so complicated. It’s been through so many steps that your brain can tell it’s not random — so it assumes it means something.' },
  { kicker:'But', h:'It jams the machine', body:'So it goes through the metaphor machine. And it kind of blocks it up — because it doesn’t actually mean anything. But it does pass through all the gates.' },
  { kicker:'The gates', h:'Signs that hint at meaning', todo:'the bouncer checking ID for the 3–5 signs of abstraction', body:'The gates are things like: Is it complicated enough? Are there patterns? Is there a juxtaposition of ideas? They’re all hints that there’s a meaning. But you can’t actually know if there’s a meaning until you feed it through the machine — and even if something comes out, you don’t know if that was the meaning that was intended.' },
  { img:'na-split', kicker:'Two kinds of pattern', h:'The thing, and the maker', body:'Patterns are really helpful, but there are two kinds. One describes the thing. The other describes the creator of the thing — their intentionality, that they were intentional in their pursuit.' },
  { img:'na-disentangle', kicker:'Pull it apart', h:'Two things, tangled together', body:'There are two things here, and they need disentangling. One is the boring part. One is the interesting part.' },
  { kicker:'The boring part', h:'Whose job is this?', todo:'reuse Miriam’s-coworker dumping-work image', body:'The boring part is like giving someone something to do that’s yours — dumping a pile of work into their arms. A job that’s not really theirs. Because the real question is: who’s the artist? Is it the person who interprets all this noise?' },
  { img:'na-teacup', kicker:'The interesting part', h:'Meaning in the grounds', body:'You take a random pattern — tea grounds at the bottom of a cup — and your brain starts finding meaning in it. The grounds clump into little shapes, and the shapes become things: an animal, a chair.' },
  { img:'na-goldframe', kicker:'The good side', h:'Decide the process is the art', body:'But if you decide the process is the art, then you take the frame — and you stamp it right onto the whole weird mechanism. There. That’s where the art is.' },
  { img:'na-checkout', kicker:'Where do you crop art?', h:'My checkout counter', body:'That’s just one example of a bigger question: where do you crop art? Take my checkout counter. If I decide I’m making a sculpture, then for a little while, a sculpture exists — all the things I picked out. And you can’t tell if I arranged them to make pretty colors and shapes, or if I just want to eat them.' },
  { kicker:'So', h:'You draw the frame', body:'Put the frame around it, and it’s art. The art is wherever you decide to crop it.' }
];
(async()=>{
  const r=await fetch(BASE+'/api/chatfeed/page',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat:CHAT, title:TITLE, html:page(TITLE,SLIDES)})});
  const d=await r.json();
  console.log(TITLE,'->',d.ok?BASE+d.url:JSON.stringify(d));
})();
