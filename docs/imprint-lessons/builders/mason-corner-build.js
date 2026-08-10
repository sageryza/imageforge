// "Where Do You Crop Art?" — faithful (transcript turns 72–79) WITH the corner-map.
// Two corner slots: metaphor top-LEFT, diagram top-RIGHT (~1 inch each). They
// slide in on the cards where that metaphor/diagram is active (Sophie's design:
// jerky + one-becomes-two in the corners of the "two things" card; the you-are-here
// zoom-out in the corner of the "where do you crop art" cards). Icons off = no corner.
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
    align-items:center; justify-content:center; text-align:center; padding:6vh 7vw 12vh; overflow-y:auto; }
  .card.show{ display:flex; }
  .head{ flex:none; }
  .kicker{ font-family:-apple-system,'Helvetica Neue',sans-serif; font-size:10.5px;
    letter-spacing:.24em; text-transform:uppercase; color:var(--accent); margin-bottom:7px; }
  h2{ font-size:1.42em; line-height:1.18; font-weight:500; margin:0; max-width:15em; }
  img.art{ width:auto; max-width:min(80vw,360px); max-height:38vh; object-fit:contain; display:block; margin:15px 0 13px; }
  p{ font-size:1.08em; line-height:1.56; margin:0; max-width:20em; }
  .todo{ font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.12em; text-transform:uppercase;
    color:#c58; border:1px dashed #dab; border-radius:6px; padding:8px 12px; margin:6px 0 16px; }
  .textonly h2{ font-size:1.7em; font-weight:500; }
  .textonly p{ margin-top:.7em; }
  /* corner map: metaphor top-LEFT, diagram top-RIGHT (~1 inch each) */
  .corner{ position:absolute; top:calc(env(safe-area-inset-top) + 44px); width:76px; height:76px;
    z-index:6; opacity:0; transition:transform .5s cubic-bezier(.22,.9,.3,1), opacity .42s ease; pointer-events:none; }
  #cornerL{ left:12px; transform:translateX(-120px); }
  #cornerR{ right:12px; transform:translateX(120px); }
  .corner.on{ transform:translateX(0); opacity:1; }
  .corner img{ width:100%; height:100%; object-fit:contain; }
  .clabel{ position:absolute; top:100%; left:0; right:0; text-align:center; margin-top:2px;
    font-family:-apple-system,sans-serif; font-size:8px; letter-spacing:.14em; text-transform:uppercase; color:var(--ink2); }
  .hint{ position:absolute; bottom:calc(20px + env(safe-area-inset-bottom)); left:0; right:0;
    text-align:center; font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.14em;
    text-transform:uppercase; color:var(--ink2); pointer-events:none; transition:opacity .4s; }
  .zones{ position:absolute; inset:0; display:flex; }
  .zback{ width:30%; } .zfwd{ width:70%; }
</style>
<div id="stage">
  <div class="dashes" id="dashes"></div>
  <div class="cards" id="cards"></div>
  <div class="corner" id="cornerL"><img id="cornerLImg" alt=""><div class="clabel">metaphor</div></div>
  <div class="corner" id="cornerR"><img id="cornerRImg" alt=""><div class="clabel">diagram</div></div>
  <div class="hint" id="hint">tap to begin &rsaquo;</div>
  <div class="zones"><div class="zback" id="zback"></div><div class="zfwd" id="zfwd"></div></div>
</div>
<script>
(function(){
  var A='${A}'; var slides=${data};
  var stage=document.getElementById('stage'), cards=document.getElementById('cards'),
      dashes=document.getElementById('dashes'), hint=document.getElementById('hint'),
      cL=document.getElementById('cornerL'), cLi=document.getElementById('cornerLImg'),
      cR=document.getElementById('cornerR'), cRi=document.getElementById('cornerRImg');
  slides.forEach(function(s){
    var c=document.createElement('div'); c.className='card'+(s.img?'':' textonly');
    var art = s.img ? '<img class="art" alt="" src="'+A+s.img+'.png">' : (s.todo?'<div class="todo">image to make: '+s.todo+'</div>':'');
    c.innerHTML='<div class="head"><div class="kicker">'+s.kicker+'</div><h2>'+s.h+'</h2></div>'+art+'<p>'+s.body+'</p>';
    cards.appendChild(c);
    var d=document.createElement('div'); d.className='dash'; dashes.appendChild(d);
  });
  var cardEls=cards.querySelectorAll('.card'), dashEls=dashes.querySelectorAll('.dash'), i=0, shL='', shR='';
  function setCorner(box, img, cur, id){
    var want = id || '';
    if(want){ if(want!==cur){ img.src=A+want+'.png'; box.classList.remove('on'); void box.offsetWidth; } box.classList.add('on'); }
    else box.classList.remove('on');
    return want;
  }
  function render(){
    cardEls.forEach(function(c,n){ c.classList.toggle('show', n===i); });
    dashEls.forEach(function(d,n){ d.classList.toggle('on', n<=i); });
    stage.style.background = slides[i].bg || '#ffffff'; hint.style.opacity=i===0?'1':'0'; cardEls[i].scrollTop=0;
    shL=setCorner(cL, cLi, shL, slides[i].metaphor);
    shR=setCorner(cR, cRi, shR, slides[i].diagram);
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

const TITLE='Where Do You Crop Art?';
// metaphor = top-left corner image, diagram = top-right corner image.
const SLIDES=[
  { img:'na-pipeline-v2', kicker:'My friend Mason', h:'He makes noise art', body:'Mason is a poet and a philosopher — reddish hair, a longish red beard. He makes what I call noise art (really a genre of music): you take an input, change it, look at the result, change that, and on and on.' },
  { img:'na-process', kicker:'The process', h:'Random, then order, then random', body:'Each round runs it through order, then chaos, then order again — every pass changing what comes out. After enough rounds it is so complex your brain can tell it is not random. So it assumes it must mean something.' },
  { kicker:'But', h:'It jams the machine', body:'It goes through the metaphor machine and clogs it up — because it does not actually mean anything. And yet it passes all the gates.' },
  { todo:'a bouncer at a club door checking ID for the 3–5 signs of “referring to abstraction”', kicker:'The gates', h:'Signs that hint at meaning', body:'The gates are a bouncer at the door, checking for the signs that usually point to a meaning: is it complicated enough? Are there patterns? A juxtaposition of ideas? You pass — but passing is not the same as meaning something. (The gates are their own lesson.)' },
  { img:'na-split', kicker:'Two kinds of pattern', h:'The thing, and the maker', body:'Patterns come in two kinds. One describes the thing itself. The other describes the maker — that they were being intentional. Only the second tells you someone meant something.' },
  { metaphor:'na-disentangle', diagram:'na-onetwo', kicker:'Two things to pull apart', h:'Tangled together', body:'From all that, there are two things here, tangled together, and they need pulling apart. Separate them and one becomes two — a circle and a square. One strand is the boring part; one is the interesting part.' },
  { todo:'reuse the “dumping your work on a coworker” image', metaphor:'na-disentangle', kicker:'The boring part', h:'Whose job is this?', body:'The boring strand is like handing someone a pile of your work — a job that was never really theirs. Because the real question is: who is the artist? The person left to find meaning in all this noise?' },
  { img:'na-teacup', kicker:'The interesting part', h:'Meaning in the grounds', body:'The interesting strand: you take a random pattern — tea grounds at the bottom of a cup — and your mind starts finding things in it. The grounds clump, and the clumps become an animal, a chair.' },
  { img:'na-goldframe-v2', kicker:'The good side', h:'Decide the process is the art', body:'Here is the good version: decide the process itself is the art. Take a gold frame and stamp it around the whole weird mechanism — the pipes, the squeegee, all of it. There. That is where the art is.' },
  { diagram:'na-youarehere', kicker:'Zoom out', h:'Where do you crop art?', body:'Step back — that was just one example of a bigger question. Where do you crop art? You are one spot among many, and the frame can land in a lot of places.' },
  { img:'na-checkout-v2', diagram:'na-youarehere', kicker:'One example', h:'My checkout counter', body:'Take my checkout counter. If I decide I am making a sculpture, then for a little while a sculpture exists — everything I picked out. And you cannot tell if I arranged it for the colors and shapes, or if I just want to eat it.' },
  { todo:'a big net thrown over the whole pipeline, all the earlier images simplified underneath', kicker:'Recap', h:'Throw the net over it', body:'Now the net drops over the whole pipeline, gathering every piece we made, and we pull everything we learned into one summary.' },
  { todo:'animation: a gallery viewer scratches their head at Mason’s piece → a lightbulb → a meaning fills the thought bubble → a frame closes around them', kicker:'Who’s the artist?', h:'The one who finds the meaning', body:'We forgot one frame: the person in the gallery in front of Mason’s piece. First they scratch their head. Then a lightbulb — a meaning appears in the thought bubble. And the frame comes around them. Maybe that is where the art really lives.' }
];
const OLD='RDYYaBaB1JZh9MD1cwbk';
(async()=>{
  const r=await fetch(BASE+'/api/chatfeed/page',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat:CHAT, title:TITLE, html:page(TITLE,SLIDES)})});
  const d=await r.json();
  if(d.ok){ await fetch(BASE+'/api/chatfeed/page/'+OLD,{method:'DELETE'}); }
  console.log(TITLE,'->',d.ok?BASE+d.url:JSON.stringify(d));
})();
