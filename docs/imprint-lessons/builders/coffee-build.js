// Builds the "Valued Customer" illustrated story (house style, bg-fade) and posts to Compare.
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

const TITLE='Valued Customer';
const SLIDES=[
  { img:'cf-josiah', kicker:'One time', h:'Hanging out with Josiah', body:'I was out with my friend Josiah, and somewhere along the way I spotted a cup of coffee just sitting there on the ground.' },
  { img:'cf-wired', kicker:'A mistake', h:'I don’t normally drink coffee', body:'So naturally I drank a bunch of it. I don’t normally drink coffee — it made me really, really hyper. That’s important. Everything after this is the coffee.' },
  { img:'cf-wallet', kicker:'First', h:'I stole a wallet', body:'I climbed a fence into a restaurant, took a bag from the employee area — then realized I didn’t actually want it, so I dumped all the cards out on the lawn. So they could find them. Eventually. Maybe.' },
  { img:'cf-highway', kicker:'Downtown', h:'“You shouldn’t be here”', body:'A stranger told me I shouldn’t be in this part of town. I said, oh no, I shouldn’t be in this part of town — and bolted across the street. It turned out to be a five-lane highway.' },
  { img:'cf-track', kicker:'Track paid off', h:'Run so fast right now', body:'I almost got run over. But I did track in high school, and I remember thinking, you have to run so fast right now. And I did. Fast enough not to die.' },
  { img:'cf-crowd', kicker:'The crowd', h:'“No honey, don’t get up”', body:'Then everyone was around me on the ground — someone swore they saw my legs go under the car. I wasn’t in any pain, but a really kind woman knelt down, hugged me, and said no honey, don’t get up. So I got peer-pressured into staying.' },
  { img:'cf-siren', kicker:'The ambulance', h:'I’m not going in an ambulance', body:'Someone called an ambulance. The second I heard the siren, I jumped up, ran off, and vaulted over a fence.' },
  { img:'cf-ride', kicker:'A lift', h:'“Ever rode with a black man before?”', body:'I asked a stranger for a ride. He said, have you ever rode with a black man before? I said, I don’t know. He dropped me by a 7-Eleven, nowhere near home.' },
  { img:'cf-container', kicker:'Hiding', h:'In a storage container', body:'I hid in a storage container for a while, because I didn’t really know what to do. Then I heard the police coming — so obviously I started to run.' },
  { img:'cf-parkedcar', kicker:'The chase', h:'“We’ll release the dogs”', body:'Running made them chase me. It’s actually really hard to get away from them. I hid under a parked car — until they said they’d release the dogs. I did not want the dogs.' },
  { img:'cf-meth', kicker:'The question', h:'“Did you do meth?”', body:'They asked if I’d done any drugs that day. I was so embarrassed to admit I’d just drunk coffee that I said, yeah, I did meth.' },
  { img:'cf-valued', kicker:'The card', h:'You lied about your name', body:'They asked for ID. All I had was one of those replacement debit cards that says “valued customer.” I told them my name is Sophie. They looked at the card and said: you lied. Your name isn’t Sophie. It’s Valued Customer.' },
  { img:'cf-arrested', kicker:'The charge', h:'Arrested for being mean', body:'They asked my birthday. I said you can infer it from the day I was born. They asked again. I said, do you have a low IQ? So they arrested me — for being mean. (“Don’t you have to read me my rights?” “That’s just in the movies.”)' },
  { img:'cf-jail', kicker:'Jail', h:'The mayonnaise sandwich', body:'They gave me a mayonnaise sandwich. I didn’t like it, so I gave it to someone else. I felt terrible for everyone there who was actually going to jail. They fingerprinted me and took my mugshots.' },
  { img:'cf-sunrise', kicker:'Sunrise', h:'They released me', body:'It was the next morning — the sun was coming up when I left. And I noticed my silver bracelet was gone. And a shiny penny I’d been collecting. Gone.' },
  { img:'cf-penny', kicker:'Five hours later', h:'Oh. That’s the penny.', body:'They’d handed me a debit card on the way out. I went into store after store trying to spend it — one cent, every time. Five hours later it hit me: that’s the penny. They turn all your money into a card. My one cent was the penny.' }
];

(async()=>{
  const r=await fetch(BASE+'/api/chatfeed/page',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat:CHAT, title:TITLE, html:page(TITLE,SLIDES)})});
  const d=await r.json();
  console.log(TITLE,'->',d.ok?BASE+d.url:JSON.stringify(d));
})();
