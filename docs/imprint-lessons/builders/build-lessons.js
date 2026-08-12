// Builds tap-through lesson pages and posts them to the chat Compare tab.
// usage: node build-lessons.js astrology adhd   (posts those keys)
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
  .dashes{ display:flex; gap:5px; padding:14px 16px calc(6px + env(safe-area-inset-top)); }
  .dash{ flex:1; height:3px; border-radius:2px; background:var(--line); }
  .dash.on{ background:var(--ink); }
  .cards{ flex:1; position:relative; }
  .card{ position:absolute; inset:0; display:none; flex-direction:column;
    align-items:center; justify-content:center; text-align:center; padding:1vh 8vw 12vh; }
  .card.show{ display:flex; }
  .imgwrap{ width:min(70vw,320px); aspect-ratio:1/1; background:var(--card);
    border:1px solid var(--line); border-radius:8px; overflow:hidden; margin-bottom:22px; }
  .imgwrap img{ width:100%; height:100%; object-fit:cover; display:block; }
  .kicker{ font-family:-apple-system,'Helvetica Neue',sans-serif; font-size:11px;
    letter-spacing:.26em; text-transform:uppercase; color:var(--accent); margin-bottom:9px; }
  h2{ font-size:1.85em; line-height:1.12; font-weight:700; margin:0 0 .45em; max-width:15em; }
  p{ font-size:1.1em; line-height:1.5; margin:0; max-width:19em; }
  .textonly h2{ font-size:2.1em; }
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
  astrology: { title:'Astrology — is it stupid, and how it works', slides:[
    { img:'zw-mirror2', kicker:'The old idea', h:'As above, so below', body:'The sky and a life are said to mirror each other, the way a mountain sits doubled in a still lake. A reflection, not a puppeteer.' },
    { img:'zw-twelve2', kicker:'The version you know', h:'Twelve little boxes', body:'Pop astrology sorts eight billion people into twelve. That part earns the eye-roll it gets.' },
    { img:'zc-reality2', kicker:'Be honest', h:'He didn’t text back', body:'Sometimes it isn’t his sign. Sometimes you threw spaghetti down your shirt and stormed out.' },
    { img:'zw-skeptics3', kicker:'The critics', h:'So it gets mocked', body:'A whole crowd lines up to call it stupid. About the twelve-boxes version, they’re right.' },
    { kicker:'But', h:'That’s the broken version', body:'The real thing was never twelve boxes. Here is how it is actually built.' },
    { img:'zw-bind2', kicker:'Start here', h:'The sky, sliced', body:'Stand under the night sky and cut the dome into wedges. Two nested wheels, quietly turning.' },
    { img:'zw-spin3', kicker:'The fast wheel', h:'Earth spins once a day', body:'The spin you already know sweeps the whole sky past you every twenty-four hours.' },
    { img:'zw-orbit', kicker:'The slow wheel', h:'And loops the sun once a year', body:'That yearly loop walks the sun slowly through the wedges, about one a month.' },
    { img:'zw-birth', kicker:'Your moment', h:'Frozen at your birth', body:'The instant you were born, the wheels lock in place. That frozen sky is your chart.' },
    { img:'zw-cast', kicker:'The cast', h:'Not one sign — a whole sky', body:'Your famous “sign” is only where the sun sat. The moon, Mars, Venus and the rest each had a spot too.' },
    { img:'zw-aspects', kicker:'How they relate', h:'The planets at angles', body:'Draw the lines between them. Some angles sit easy, some pull tight with tension.' },
    { img:'zw-retrograde', kicker:'Retrograde', h:'Only overtaking', body:'A planet looks like it slips backward because we pass it on the inside lane.' },
    { img:'zw-essenes', kicker:'It’s old', h:'People always read the sky', body:'Long before horoscopes, scholars charted the stars by lamplight. The impulse is ancient.' },
    { kicker:'So', h:'Twelve isn’t twelve', body:'Planets, signs and houses stack into millions of combinations. Understand that, and it stops being stupid.' }
  ]},
  adhd: { title:'ADHD & Autism — cluster, spectrum, genes', slides:[
    { img:'nd-aha', kicker:'Everywhere now', h:'“I’m autistic!”', body:'It’s the label of the moment. So what is it, actually?' },
    { img:'nd-cluster', kicker:'First', h:'A cluster of traits', body:'Autism is one word for a bundle of characteristics that tend to travel together.' },
    { img:'nd-tom', kicker:'One trait', h:'Reading minds is harder', body:'Guessing what someone else is thinking doesn’t come automatically.' },
    { img:'nd-sensory', kicker:'Another', h:'The volume’s too high', body:'Ordinary sounds and lights can press in like they’ve been turned way up.' },
    { img:'nd-savant', kicker:'Another', h:'Strange knacks', body:'Counting, patterns, a memory for detail — gifts that ride along with the wiring.' },
    { img:'nd-binary', kicker:'So what is it?', h:'A yes or no?', body:'Autistic, or not — two boxes you check one of?' },
    { img:'nd-spectrum', kicker:'Or…', h:'A single dial?', body:'From “a little” to “very,” a line you sit somewhere along?' },
    { img:'nd-clusterdots', kicker:'Closer', h:'A cluster', body:'A loose bundle of traits, mixed differently in each person — nearer a cluster than a line.' },
    { img:'nd-helix', kicker:'Underneath', h:'It’s the genes', body:'Below the traits, it’s inherited — written into the DNA.' },
    { img:'nd-manygenes', kicker:'Not one gene', h:'Thousands of tiny nudges', body:'Not a single switch. Thousands of small inherited pieces, each adding a little.' },
    { img:'nd-populations', kicker:'Which means', h:'The edges blur', body:'Draw autistic and non-autistic as two hills — they overlap in the middle, with no clean line.' },
    { img:'nd-web', kicker:'And they mix', h:'The labels overlap', body:'Autism, ADHD, OCD, bipolar — separate names laid over a shared web of traits.' },
    { img:'nd-tiktok', kicker:'Meanwhile', h:'Everyone has it', body:'“Do you pick your nose? You might have ADHD.” The feed hands out diagnoses like candy.' },
    { kicker:'So', h:'Real — and a cluster', body:'Genuinely genetic, genuinely a spread — and still, not everything is it.' }
  ]},
  dysphoria: { title:'General Dysphoria', slides:[
    { img:'gd-gender', kicker:'The one you know', h:'Gender dysphoria', body:'The ache of the outside not matching the inside. Most people have heard of this one.' },
    { kicker:'But', h:'It isn’t only gender', body:'The same gap opens along other lines too. Gender is just the most-named case.' },
    { img:'gd-age', kicker:'Age', h:'Read as a kid', body:'Short, young-faced, thirty-four — handed the children’s menu and talked down to.' },
    { img:'gd-competence', kicker:'Competence', h:'Read as the assistant', body:'Capable, in charge, and still handed the coffee cup and talked over.' },
    { img:'gd-cluster', kicker:'Zoom out', h:'One of many labels', body:'Gender is a single guess in a whole cluster people pin on you at a glance.' },
    { img:'gd-youarehere', kicker:'On meeting you', h:'They plot you', body:'In seconds, they’ve placed you on their own mental charts. You are here.' },
    { img:'gd-approx', kicker:'The best they do', h:'A rough approximation', body:'A vague shape, then a sharper guess, then the closest they’ll ever come. Never exactly you.' },
    { img:'gd-snake', kicker:'Inside', h:'Something unrecognized', body:'There’s a self in there the labels keep missing, trying to be seen.' },
    { img:'gd-mask', kicker:'Under the surface', h:'Not the face they read', body:'The one everyone meets is a mask over someone they haven’t actually met.' },
    { img:'gd-banner', kicker:'So', h:'Name it: general dysphoria', body:'Once you see the shape, you see it everywhere — yours, and everyone else’s.' }
  ]},
  shame: { title:'Inside & Outside Thoughts', slides:[
    { img:'cv-corey', kicker:'A visit', h:'The kind self-story', body:'My uncle explained his whole life sympathetically. I nodded — and noticed it was a story he tells himself.' },
    { img:'cv-vehicle', kicker:'Name it', h:'A cognitive vehicle', body:'A thought whose job is to carry you from one place to another. It doesn’t have to be true.' },
    { img:'cv-shame', kicker:'Why we need them', h:'Driving out of shame', body:'Hero or victim is the way out when you can’t bear to be the villain. That’s human.' },
    { kicker:'And it’s fine', h:'The kind story is healthy', body:'People who can’t tell themselves a generous story at all tend to be more depressed, not wiser.' },
    { img:'cv-keepout', kicker:'The catch', h:'Private. Keep out.', body:'These are inside thoughts. They’re for you — not to be handed to others as fact.' },
    { img:'cv-insideoutside', kicker:'The skill', h:'Know which is which', body:'Inside thoughts move you along. Outside thoughts you can say aloud as true. Label the vehicle.' },
    { img:'cv-broadcast', kicker:'One failure', h:'Broadcasting the private', body:'Handing your inside story to everyone as objective truth. That’s where it curdles into self-justifying.' },
    { img:'cv-novehicle', kicker:'The other failure', h:'No vehicle at all', body:'And with no kind story to ride, shame floods in and you get stuck in the dip.' },
    { kicker:'So', h:'Keep them — know their address', body:'The vehicles are good. The grown-up move is knowing which ones stay inside.' }
  ]},
  synthetic: { title:'Synthetic Learning Syndrome', slides:[
    { kicker:'A brand-new disorder', h:'Synthetic Learning Syndrome', body:'Relearning, at great expense, things you already knew were obvious. (Not a real diagnosis. Mostly.)' },
    { img:'sl-grounding', kicker:'Exhibit A', h:'“Grounding”', body:'Standing barefoot on the earth. We gave it a name and a mat and a movement.' },
    { img:'sl-banana', kicker:'Exhibit B', h:'The pre-peeled banana', body:'It came in its own wrapper. We improved it anyway.' },
    { img:'sl-sadlamp', kicker:'Exhibit C', h:'The sun, in a box', body:'A lamp that mimics daylight — glowing while real daylight pours through the window. (Fair enough in an Alaskan winter.)' },
    { img:'sl-treadmill', kicker:'Exhibit D', h:'Walking, indoors, at nature', body:'On a treadmill, watching a forest on a screen. We used to just walk to the forest.' },
    { kicker:'The pattern', h:'One free bundle, unbundled', body:'Walking outside for food once gave you exercise, sun, earth and real food at once, free. Now each piece is sold back separately.' },
    { img:'sl-supplements', kicker:'The essence', h:'Everything becomes a pill', body:'The active ingredient extracted, the whole thing thrown away. Vitamins instead of a meal.' },
    { img:'sl-pill', kicker:'Why it never fills', h:'The essence isn’t the thing', body:'Sugar is the essence of fruit; the highlight reel, of a life. Distilled, it leaves you emptier, wanting more.' },
    { img:'sl-hero', kicker:'And the twist', h:'Hailed for the obvious', body:'We won’t believe “just go outside” until someone studies it, brands it, and writes the book.' },
    { img:'sl-donut', kicker:'Underneath', h:'The desire treadmill', body:'We solved our problems and kept wanting. The donut stays out of reach because reaching is the trap.' },
    { kicker:'The cure', h:'The one thing you can’t buy', body:'Even the fix gets sold back to you as an app. The thing you actually needed was never a product — just remembering.' }
  ]}
};

(async()=>{
  const keys = process.argv.slice(2);
  for(const k of keys){
    const L=LESSONS[k];
    if(!L){ console.log('unknown lesson', k); continue; }
    const html=page(L.title, L.slides);
    const r=await fetch(BASE+'/api/chatfeed/page',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chat:CHAT, title:L.title, html})});
    const d=await r.json();
    console.log(k, '->', d.ok? BASE+d.url : JSON.stringify(d));
  }
})();
