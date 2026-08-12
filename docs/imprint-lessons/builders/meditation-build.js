// "What Do You Want to Wake Up To?" — pastel Meditation lesson.
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
  :root{ --ink:#33294a; --ink2:#8a83a0; --line:#ddd2ea; --accent:#b98bc9; }
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

const TITLE='What Do You Want to Wake Up To?';
const SLIDES=[
  { img:'md-sauna-v5', kicker:'In the sauna', h:'Just meditate', body:'My friend Mason — poet, philosopher, red beard — turns to me in the steam and says it like it’s easy. Just meditate. Empty your mind. But I can’t.' },
  { img:'md-ballpit', kicker:'Because in my head', h:'It’s not empty in there', body:'I close my eyes and I’m not floating in calm. I’m flailing in a ball pit, going under, grabbing for the surface.' },
  { img:'md-bubble', kicker:'How it actually works', h:'A new idea, like a bubble', body:'Here’s what my mind does instead. An idea floats up like a soap bubble off a wand — delicate, shimmering, growing on its own.' },
  { img:'md-train', kicker:'It grows', h:'A party on a train', body:'What if I threw a party on a train — each car a different theme? A witchy car, a speakeasy car, a jungle lounge. The bubble fills right up with it.' },
  { img:'md-badthoughts', kicker:'Then', h:'The bad thoughts push in', body:'And from every side the intrusive thoughts crowd toward me. That’s stupid. You’ll never pull it off. Why even try.' },
  { img:'md-push', kicker:'Traditional CBT', h:'Push back the noise', body:'So I run around pushing each one back with a reframe — he didn’t mean that, it’s just in my head, that’s only my anxiety. One at a time, all day. I’ve done this since I was twelve.' },
  { img:'md-bigidea', kicker:'Creative CBT', h:'Until the bubble gets big enough', body:'But if the idea keeps growing, it gets so big it pushes them all out to the edges on its own. Oh — that’s a good idea.' },
  { img:'md-meditate', kicker:'So when they say “just meditate”', h:'What fills the space?', body:'Empty the mind, they say. But if I let the bubble go, there’s nothing holding the thoughts back. They just creep in to fill the room.' },
  { kicker:'So here’s the real question', h:'What do you want to wake up to?', body:'Maybe it was never about emptying the room. It’s about what’s waiting in it when you get quiet.' },
  { img:'md-smoke-dumpster', kicker:'One version', h:'Alone in the dumpster', body:'You can get high by yourself in a dumpster, pinching your nose against the trash.' },
  { img:'md-smoke-friends', kicker:'Or', h:'A circle in the pines', body:'Or in a ring of friends under the pine trees, everyone in their own patterns, passing it around.' },
  { img:'md-wake-dingy', kicker:'One morning', h:'You wake up to this', body:'You stretch, you look around, and it’s junk on the floor — everything gone dingy and gray.' },
  { img:'md-wake-nice', kicker:'Or this', h:'Three good things waiting', body:'Or you wake up in a bright room to a plan you made the night before — a walk, an afternoon on the floor with scissors and colored paper, a croissant on the way home.' },
  { kicker:'The real work', h:'Build the place first', body:'Getting quiet only takes you inward. The work is making the inside worth arriving in — a room you’d want to wake up to. Build that first, and the quiet has somewhere good to put you.' }
];
const OLD='VksvV8X2SipKkqYACRIy';
(async()=>{
  const r=await fetch(BASE+'/api/chatfeed/page',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat:CHAT, title:TITLE, html:page(TITLE,SLIDES)})});
  const d=await r.json();
  if(d.ok){ const dr=await fetch(BASE+'/api/chatfeed/page/'+OLD,{method:'DELETE'}); console.log('deleted old lilac-bg page',dr.status); }
  console.log(TITLE,'->',d.ok?BASE+d.url:JSON.stringify(d));
})();
