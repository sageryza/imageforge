const A='https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-school/assets/';
const CHAT='deck-factory-story-room';
const BASE='https://imageforge-q125.onrender.com';

function page(title, slides){
  const data=JSON.stringify(slides);
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>${title}</title>
<style>
  :root{ --paper:#f6f2e9; --ink:#26221c; --ink2:#8a8377; --line:#d9d2c2; --accent:#a5586a; --card:#fffdf7; }
  *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html,body{ margin:0; height:100%; background:var(--paper); color:var(--ink);
    font-family:Georgia,'Times New Roman',serif; overscroll-behavior:none; }
  #stage{ position:fixed; inset:0; display:flex; flex-direction:column; }
  .dashes{ display:flex; gap:4px; padding:14px 16px calc(6px + env(safe-area-inset-top)); }
  .dash{ flex:1; height:3px; border-radius:2px; background:var(--line); }
  .dash.on{ background:var(--ink); }
  .cards{ flex:1; position:relative; }
  .card{ position:absolute; inset:0; display:none; flex-direction:column;
    align-items:center; justify-content:center; text-align:center; padding:1vh 8vw 12vh; }
  .card.show{ display:flex; }
  .imgwrap{ width:min(66vw,300px); aspect-ratio:1/1; background:var(--card);
    border:1px solid var(--line); border-radius:8px; overflow:hidden; margin-bottom:20px; }
  .imgwrap img{ width:100%; height:100%; object-fit:cover; display:block; }
  .kicker{ font-family:-apple-system,'Helvetica Neue',sans-serif; font-size:11px;
    letter-spacing:.24em; text-transform:uppercase; color:var(--accent); margin-bottom:8px; }
  h2{ font-size:1.5em; line-height:1.15; font-weight:700; margin:0 0 .5em; max-width:15em; }
  p{ font-size:1.02em; line-height:1.5; margin:0; max-width:20em; font-style:italic; }
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
  var A='${A}';
  var slides=${data};
  var cards=document.getElementById('cards'), dashes=document.getElementById('dashes'), hint=document.getElementById('hint');
  slides.forEach(function(s){
    var c=document.createElement('div'); c.className='card'+(s.img?'':' textonly');
    c.innerHTML=(s.img?'<div class="imgwrap"><img alt="" src="'+A+s.img+'.png"></div>':'')
      +'<div class="kicker">'+s.kicker+'</div><h2>'+s.h+'</h2><p>'+s.body+'</p>';
    cards.appendChild(c);
    var d=document.createElement('div'); d.className='dash'; dashes.appendChild(d);
  });
  var cardEls=cards.querySelectorAll('.card'), dashEls=dashes.querySelectorAll('.dash'), i=0;
  function render(){
    cardEls.forEach(function(c,n){ c.classList.toggle('show', n===i); });
    dashEls.forEach(function(d,n){ d.classList.toggle('on', n<=i); });
    hint.style.opacity=i===0?'1':'0';
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
  animal: { title:'Animal Magic', slides:[
    { img:'an-snake', kicker:'On a hike', h:'The snake', body:'We were in a fight, trying hard not to speak, when suddenly there was a snake in my path. I gasped. It was like the snake had sensed the venom between us and taken the chance to show itself.' },
    { img:'an-lab', kicker:'The vista', h:'A Labrador', body:'The gasp broke the silence, and figuring out what to do, we forgot the fight. By the next vista we were holding each other — and someone’s off-leash Labrador ambled over and nuzzled our backs.' },
    { img:'an-cat', kicker:'On my walk', h:'The cat that pulled away', body:'The cat I often saw on my walk would not be petted by my male companion. I took that to mean he was not to be trusted.' },
    { img:'an-yorkie', kicker:'With my mom', h:'A hopeful terrier', body:'A Yorkshire terrier peeked out hopefully from behind a fence on a walk where my mom could suddenly see my perspective. She doesn’t like dogs, but said it was the first time she’d found one cute.' },
    { img:'an-retriever', kicker:'With my dad', h:'The golden retriever', body:'When my dad kept missing my point, a large golden retriever reared up and growled at him. In a moment I’d normally feel helpless, I felt powerful — as though the dog said what I could not.' },
    { img:'an-rat', kicker:'At dinner', h:'A rat!', body:'I was under my ex’s spell, thinking maybe he’s not so bad, when a rat — a rat! — ran under the next table. The universe warning me, so plainly, that this man was a liar.' },
    { img:'an-notice', kicker:'The pattern', h:'They took my shape', body:'From then on I noticed how creatures took the shape of what I was thinking or feeling. He was happy about the dog nuzzling our backs — but did not believe in the snake, or the rat.' }
  ]},
  hate: { title:'For the Hate of the Game', slides:[
    { img:'ht-veil', kicker:'The old idea', h:'A veil of forgetfulness', body:'They say a veil of forgetfulness is placed over earth, so we forget the soul that we are. On a dark starry night the veil lifts, and we remember where we came from.' },
    { img:'ht-fade', kicker:'But', h:'It fades', body:'Try as we might to keep the feeling, it fades like tinder on a disappearing fire, and we go back to the humdrum — errand to market and back again.' },
    { img:'ht-grace', kicker:'2012', h:'Saying grace', body:'My second attempt at college was failing. I’d caught too many whiffs of that feeling, and one thing led to another until I found myself across town, saying grace with a gathering of homeless people.' },
    { img:'ht-loft', kicker:'Brooklyn', h:'On a whim', body:'I moved to Brooklyn on a whim, and was disappointed that whimsy is in short supply when you seek it out. My seven roommates and I just passed a joint around our furniture-less loft.' },
    { img:'ht-wind', kicker:'The rules', h:'Carried by the wind', body:'The law was lack of doubt. The moment I thought “I know where this is going,” the whole thing would change course. But leap without looking, feet on a cloud of faith, and there was always something waiting at the end.' },
    { img:'ht-volley', kicker:'The game', h:'A volley', body:'I kept nothing from these adventures — numbers exchanged were never called. It was a volley: the longer the ball stayed in the air, the more hearts I’d be given access to. Grab a piece of gold, and you’d be ejected.' },
    { img:'ht-shapeshifter', kicker:'How to win', h:'Nod along', body:'I was scarcely a person, more a shapeshifter. Agree with whatever strange understanding of the world my companions believed, and I’d be rewarded. Nod along, and you’ve won half the battle.' },
    { img:'ht-above', kicker:'Playing blind', h:'From above', body:'I learned the patterns coincidences take, and played blind — no longer the chess piece moving to and fro, but somewhere above it, strategizing my next move, which was almost always to do nothing.' },
    { img:'ht-balcony', kicker:'But', h:'I grew to hate it', body:'On a stranger’s balcony, a long-haired man confessing a secret, bubbles floating down — and I’d know magic waited up on the roof. What I wanted most was just to go home.' },
    { img:'ht-tinkerbell', kicker:'The secret', h:'Grumbling for coffee', body:'“Because you’re free, it makes everyone feel free,” a roommate said. But I thought: I don’t get to do what I want, I have to. Inside this Tinkerbell cloud of a person is a heart grumbling that it hasn’t had its coffee.' }
  ]},
  art: { title:'Art Is Forgiving', slides:[
    { img:'af-burn', kicker:'My art teacher', h:'He burned it all', body:'Like he’d solved a puzzle, my high school art teacher jubilantly burned all his old artwork when he switched to a more cartoony style.' },
    { img:'af-garage', kicker:'The paradox', h:'Rotting in a garage', body:'Art has infinite value and depthless uselessness — the power to express what can’t be said, and the power to sit in a garage rotting until you realize no one’s ever even seen your masterpiece.' },
    { img:'af-ai', kicker:'A debate', h:'Three times they guessed wrong', body:'A night out turned into a heated debate about AI. I showed them my drawings and ones ChatGPT made. Three times they failed to guess correctly. The ones people spot are just the ones they know are AI.' },
    { img:'af-gaveup', kicker:'Age 20', h:'I wasn’t the best', body:'I gave up becoming a painter because, though I’m not bad, I’m not the best. There are people with more raw talent, more heart. If I wasn’t the best, why compete at all?' },
    { img:'af-esoteric', kicker:'So instead', h:'Things no one would compete over', body:'I picked esoteric things — things no one would even try to compete with me over, much less win.' },
    { img:'af-journal', kicker:'A dare', h:'Little diagrams', body:'A year ago, on a dare, I took up journaling. I started adding little “diagrams” to the entries when there were things I couldn’t find the words for.' },
    { img:'af-gratitude', kicker:'One day', h:'Everything I was grateful for', body:'I sketched everything I was grateful for that day. An extra cherry added to my ice cream. My friend braiding my hair at a party.' },
    { img:'af-forme', kicker:'The joy', h:'Just for me', body:'I was overwhelmed by the joy I’d once felt in art class. These drawings were for me, just for me — so they didn’t have to follow any rules or live up to anyone’s standards.' }
  ]},
  mysterious: { title:'God Only Works in Mysterious Ways', slides:[
    { img:'gm-miracle', kicker:'The miracle', h:'Exactly what we asked', body:'When we get our miracle — the exact thing we asked for, delivered in a form we never imagined, when we least expected it — we’re so mystified and grateful that to question the method feels like hubris.' },
    { img:'gm-constellation', kicker:'We connect the dots', h:'They sing with meaning', body:'We connect the dots of the constellation, and they sing to us with significance. Somehow, we know.' },
    { img:'gm-fade', kicker:'Then time passes', h:'The light fades', body:'This shining moment becomes a beacon in our past, whose light fades ever so slightly, until one day we go looking for it again.' },
    { img:'gm-scattered', kicker:'And we find', h:'Only scattered stars', body:'We find only scattered stars — no line connecting them into the picture we saw before. Each ordinary star now resembles a common coincidence. Only crumbling stardust in our hands.' },
    { img:'gm-doubt', kicker:'So', h:'Pockets laden with doubt', body:'How foolish, we think, to imagine someone bigger had a plan. And we trudge along, our pockets laden with doubt and fear.' },
    { img:'gm-loom', kicker:'But what if', h:'The warp and the weft', body:'What if this oscillation, occurring many times across a life, was not a mistake but by design? I call it the warp and the weft. Weaving works by going under and over every other string.' },
    { img:'gm-shuttle', kicker:'The mechanism', h:'The shuttle', body:'A shuttle raises and lowers the strings, intermittently differentiating them, then returns them seamlessly. Without it, they appear uniform — like the world of spirit coexisting with the physical.' },
    { img:'gm-innerlight', kicker:'So', h:'We learn an inner light', body:'Were it not for the utter blackness when the strings disconnect and we’re left with just stars, we’d have no reason to grope carefully in the dark. It is in this way that we learn to carry an inner light.' }
  ]},
  curious: { title:'In Case You’re Curious (Manifestation, Part II)', slides:[
    { img:'c2-theta', kicker:'The experiment continues', h:'A scientist at heart', body:'I got a couple signs from the universe and now I’m high on a cloud. But you best believe I’m a scientist at heart. I extended my experiment — here are the findings.' },
    { img:'c2-cake', kicker:'The cinnamon cake', h:'Eat this', body:'I knew I’d walk past cake — the only way I’d eat it was if someone locked me in a room and said “eat this.” That Thursday our housekeeper pushed the chairs and couches together to block the only exit, handed me a fork, and said “Eat!”' },
    { img:'c2-splinter', kicker:'The splinter', h:'Five weeks', body:'A splinter stayed in my foot for five weeks — urgent care and all. Then I saw a TikTok about a magic drawing salve. I watched it three times and that night imagined the splinter coming loose. It came out the next day.' },
    { img:'c2-crown', kicker:'The crown', h:'Deliriously happy', body:'A YouTube short said to lean your head back and hold your breath to push energy up into your crown chakra. I did it, went on a walk, and found myself deliriously happy, laughing and humming to myself.' },
    { img:'c2-herbalist', kicker:'The teacher', h:'An herbalist appears', body:'I’ve turned to herbalism with no training, and one night thought, wouldn’t it be nice if someone just came and showed me how? The next day my mom called: a woman had come to repair a necklace, and happened to be an herbalist.' },
    { img:'c2-owl', kicker:'Spotted owl', h:'Owl spotted', body:'I had four friends over and we settled on manifesting an owl. Eyes closed, we all imagined a snowy owl swooping toward us. The next day, Jack texted: “owl spotted.”' },
    { img:'c2-candle', kicker:'P.S.', h:'A biblically accurate angel', body:'At the dinner, I’d left googly eyes on the table — the ones I bought to stick on my hats so they’d say “my eye is up here.” Mary found them and, as the candle burned down, made it into a biblically accurate angel.' }
  ]}
};

(async()=>{
  for(const k of ['animal','hate','art','mysterious','curious']){
    const L=LESSONS[k];
    const html=page(L.title, L.slides);
    const r=await fetch(BASE+'/api/chatfeed/page',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chat:CHAT, title:L.title, html})});
    const d=await r.json();
    console.log(k, '->', d.ok? BASE+d.url : JSON.stringify(d));
  }
})();
