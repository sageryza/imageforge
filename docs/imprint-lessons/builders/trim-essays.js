// Revert manifestation/ocd/instrumentalism to their tight ORIGINAL card sets,
// keeping the bg-fade restyle. Drops the padded re-illustration cards.
// (The tacked-on images stay in the gallery as history; only the CARDS go.)
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
  manifestation: { title:'My Experiment with Manifestation', slides:[
    { img:'mf-setmind', kicker:'Night after night', h:'A little experiment', body:'Just before I fall asleep, I set my mind on something I want. Not something I’ve prayed for — just something that sounds nice in the moment.' },
    { img:'mf-bed', kicker:'Night one', h:'A pink satin bed', body:'I have the same old Victorian bed my mom won’t let me toss. But I started thinking of a pink satin one, with those cinched-up buttons on the headboard. All shiny and pink.' },
    { img:'mf-headboard', kicker:'The next day', h:'In the alley', body:'No one delivered a bed frame to my door. But I did see a white headboard in my alley that looked suspiciously like the one I’d imagined — I couldn’t remember it being there before.' },
    { img:'mf-catwish', kicker:'Night two', h:'A little cat', body:'It was cold, and I imagined how nice it would be to have a little cat kneading its paws on my bed, settling on my chest so I could sleep warmer, with a little more love.' },
    { img:'mf-catreal', kicker:'The next day', h:'It stared me down', body:'There it was on a brick wall, staring at me like I was late to a meeting. I got scared — I felt sure that if I let it, this cat would follow me home and I’d be destined to care for it forever.' },
    { img:'mf-chocolate', kicker:'Night three', h:'A golden ticket', body:'I knew it was stupid, but I fantasized about being gifted a chocolate factory for being good. The next day my mom had left three full-size bars on the counter — one opened to a bright silver foil, suspiciously like a golden ticket.' },
    { img:'mf-partner', kicker:'The turn', h:'Something bigger', body:'I’m 33 and still without a partner. One lonely night I gave up all pretense and let myself picture him — hair, eyes, personality. This is off-limits to a happy single person, so I felt I was breaking my own rules.' },
    { img:'mf-hinge', kicker:'The next day', h:'A message on read', body:'Claire, a masc lesbian who’d left me on read two months ago, chose today to respond. In her profile she looked suspiciously like the person of my dreams. Same haircut and everything.' },
    { img:'mf-blackcat', kicker:'That evening', h:'Magic was everywhere', body:'Feeling forlorn, I passed the wall where I’d seen that first cat. Then a different cat, black and narrow, made its way to me and pushed gently into my side, letting me have some of its warmth.' },
    { img:'mf-horse', kicker:'Later', h:'Always there for you', body:'I’d been planning to wish for a horse. Then my bulk-crystal supplier — who I’d never joked with — sent a meme: a horse in an office, “always there for you.” There was nothing to do but let a couple tears fall.' }
  ]},
  ocd: { title:'What’s the Difference Between OCD and Witchcraft?', slides:[
    { img:'oc-child', kicker:'Age 10', h:'I had OCD', body:'I couldn’t shake this dread that something would happen to my mom, and I developed all sorts of strange rituals to prevent it.' },
    { img:'oc-cbt', kicker:'The coach', h:'Just a trick of the brain', body:'I asked Lindsay if I needed to keep doing the rituals. She said it was just a trick of the brain, and that I could stop. So I stopped. Cold turkey. And I was fine.' },
    { img:'oc-voices', kicker:'Ten years', h:'Battling my intuition', body:'Then I spent the next ten years battling my intuition. I’d get a compulsion, say “that’s silly,” and hear my mother, my therapist, the science articles about how your mind tricks you. Guilt or shame, no matter what.' },
    { img:'oc-tracking', kicker:'The experiment', h:'Tracking the results', body:'If I didn’t do it, something bad would happen. If I did, and something good happened, I told myself I got lucky. I spent a lot of time tracking the results, like a science experiment. I wanted to know once and for all.' },
    { img:'oc-art', kicker:'Junior year', h:'Solace in art', body:'I found solace in art. Drawing requires careful observation and a non-judgmental attitude — all lines are good lines, as long as they describe what you’re looking at. Any outcome was neither good nor bad, just “interesting.”' },
    { img:'oc-witchkit', kicker:'Age 19', h:'Secretly a witch', body:'I dropped out to sell odd commodities. The only one that took off was the “secretly a witch kit.” Suddenly I was the head of a witch corporation, a driveway full of crystals and 500 decks of tarot — and I’d never done a single reading.' },
    { img:'oc-irony', kicker:'The irony doubled', h:'Pretending both ways', body:'I was pretending to be a witch, pretending not to be a witch. I might have called myself a fraud — except I knew, deep down, that if anyone had magical powers, it was me.' },
    { img:'oc-anger', kicker:'2025', h:'So much anger', body:'I left a relationship with so much anger I could barely see straight. It followed me for months while I stayed home and stewed. My “any outcome is a good outcome” mantra was breaking down. I needed this anger to dissolve.' },
    { img:'oc-spell', kicker:'One night', h:'My first spell', body:'In bed, the feeling came without the story — and with it an image: large black pins, straight into his stomach. I concentrated, feeling the white-hot anger, and then it was done. “If this really works, I need to see the result.”' },
    { img:'oc-result', kicker:'A few days later', h:'He came knocking', body:'He had stomach pain, he said; he needed me to forgive him. “I was causing it,” he said — though he was a staunch atheist. Driving to San Francisco, I made the connection. Then I tried it again, and sent my mom some healing for her blurry vision.' }
  ]},
  instrumentalism: { title:'Instrumentalism, Part I', slides:[
    { img:'in-roadtrip', kicker:'A confession', h:'The fungi decided', body:'This revelation came from those special fungi that one day decided to take me on a road trip. All expenses paid. I say “they decided,” because of the unique way I procured the mushrooms.' },
    { img:'in-bobbypin', kicker:'The loft', h:'Reach behind the seat', body:'I was sitting on the toilet in my seven-bedroom loft when I had the urge to reach behind the seat. There I found a bobby pin.' },
    { img:'in-pick', kicker:'The locked door', h:'It opened first try', body:'I felt compelled to use it to open my roommate Nathan’s door, locked while he was away. I’d never picked a lock or thought to — but it opened on the first try.' },
    { img:'in-drawer', kicker:'The drawer', h:'A little bag', body:'Without knowing what I was looking for, I opened the top-left drawer of his dresser and took out a little bag of mushrooms.' },
    { img:'in-thread', kicker:'The idea', h:'Instrumentalism', body:'I call this instrumentalism. You follow your heart’s desire, and it leads you on a path you didn’t know existed.' },
    { img:'in-brain', kicker:'One explanation', h:'A remarkable apparatus', body:'In the spirit of scientism, I hatched a tidy theory: your mind tracks patterns all day and bundles them into little urges that lead you somewhere new. If true, the brain really would be as remarkable as they say.' },
    { img:'in-compass', kicker:'But', h:'Our navigation system', body:'But Jesus told me otherwise. According to the book Channeling Jesus, “our emotions are our navigation system.” For the unsure sort — bombarded by shoulds, targeted by regret — that itself is a revelation.' },
    { img:'in-shoulds', kicker:'Against the chatter', h:'The answer is inside', body:'That the answer to our unsureness would be found in our own mind, rather than an elaborate system of rules and suggestions from outside — this goes against the whole foundation of that worried chatter.' },
    { img:'in-secretcode', kicker:'A step further', h:'A secret code', body:'Instrumentalism takes these convictions further: not the patterns of an unharnessed subconscious, but the communications of another world — the spirit world — leading us “right into temptation.”' },
    { img:'in-neglect', kicker:'Why I like it', h:'So be it', body:'Whether or not it’s true, I like this philosophy — it lets me prioritize what I want and neglect the bullying insistence of those around me. If I need a magical system to stop taking everyone’s ill-conceived advice, then so be it.' }
  ]}
};
const OLD={ manifestation:'wsDkDzQqrnaiVWgPfsxV', ocd:'QXIAIMIxNtbWtZQDgCHT', instrumentalism:'PhxMYKNuKEP7guiKygUr' };
(async()=>{
  const out=[];
  for(const k of ['manifestation','ocd','instrumentalism']){
    const L=LESSONS[k];
    const r=await fetch(BASE+'/api/chatfeed/page',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chat:CHAT, title:L.title, html:page(L.title,L.slides)})});
    const d=await r.json();
    out.push([L.title, d.ok?BASE+d.url:JSON.stringify(d)]);
    if(d.ok){ const dr=await fetch(BASE+'/api/chatfeed/page/'+OLD[k],{method:'DELETE'}); console.log('replaced',k,'(deleted old',dr.status+')'); }
  }
  console.log('\n=== TIGHTENED LINKS ===');
  out.forEach(([t,u])=>console.log(t,'::',u));
})();
