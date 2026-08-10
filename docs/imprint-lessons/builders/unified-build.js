// Unified lesson/essay builder — witch-imprint bg-fade template.
// Each card's screen background = its illustration's sampled corner hex, so the
// art floats boxless. Title above, contained art, body below. Reads bg-map.json.
const fs=require('fs');
const A='https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-school/assets/';
const CHAT='deck-factory-story-room';
const BASE='https://imageforge-q125.onrender.com';
const BG=JSON.parse(fs.readFileSync(__dirname+'/bg-map.json','utf8'));
const NEUTRAL='#fbf7ef';

function attachBg(slides){
  return slides.map(s=>{
    const bg = s.img ? (BG[s.img]||NEUTRAL) : NEUTRAL;
    return Object.assign({bg}, s);
  });
}

function page(title, slidesRaw){
  const slides=attachBg(slidesRaw);
  const data=JSON.stringify(slides);
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
  img.art{ width:auto; max-width:min(80vw,360px); max-height:40vh; object-fit:contain;
    display:block; margin:15px 0 13px; }
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
  var A='${A}';
  var slides=${data};
  var stage=document.getElementById('stage'), cards=document.getElementById('cards'),
      dashes=document.getElementById('dashes'), hint=document.getElementById('hint');
  slides.forEach(function(s){
    var c=document.createElement('div'); c.className='card'+(s.img?'':' textonly');
    c.innerHTML='<div class="head"><div class="kicker">'+s.kicker+'</div><h2>'+s.h+'</h2></div>'
      +(s.img?'<img class="art" alt="" src="'+A+s.img+'.png">':'')
      +'<p>'+s.body+'</p>';
    cards.appendChild(c);
    var d=document.createElement('div'); d.className='dash'; dashes.appendChild(d);
  });
  var cardEls=cards.querySelectorAll('.card'), dashEls=dashes.querySelectorAll('.dash'), i=0;
  function render(){
    cardEls.forEach(function(c,n){ c.classList.toggle('show', n===i); });
    dashEls.forEach(function(d,n){ d.classList.toggle('on', n<=i); });
    stage.style.background = slides[i].bg || '#fdf9f3';
    hint.style.opacity=i===0?'1':'0';
    cardEls[i].scrollTop=0;
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
    { img:'zw-twelve-v2', kicker:'The version you know', h:'Twelve little boxes', body:'Pop astrology sorts eight billion people into twelve. That part earns the eye-roll it gets.' },
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
    { img:'nd-aha-v2', kicker:'Everywhere now', h:'“I’m autistic!”', body:'It’s the label of the moment. So what is it, actually?' },
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
    { img:'nd-tiktok-v2', kicker:'Meanwhile', h:'Everyone has it', body:'“Do you pick your nose? You might have ADHD.” The feed hands out diagnoses like candy.' },
    { kicker:'So', h:'Real — and a cluster', body:'Genuinely genetic, genuinely a spread — and still, not everything is it.' }
  ]},
  dysphoria: { title:'General Dysphoria', slides:[
    { img:'gd-gender', kicker:'The one you know', h:'Gender dysphoria', body:'The ache of the outside not matching the inside. Most people have heard of this one.' },
    { kicker:'But', h:'It isn’t only gender', body:'The same gap opens along other lines too. Gender is just the most-named case.' },
    { img:'gd-age-v2', kicker:'Age', h:'Read as a kid', body:'Short, young-faced, thirty-four — handed the children’s menu and talked down to.' },
    { img:'gd-competence', kicker:'Competence', h:'Read as the assistant', body:'Capable, in charge, and still handed the coffee cup and talked over.' },
    { img:'gd-cluster', kicker:'Zoom out', h:'One of many labels', body:'Gender is a single guess in a whole cluster people pin on you at a glance.' },
    { img:'gd-youarehere', kicker:'On meeting you', h:'They plot you', body:'In seconds, they’ve placed you on their own mental charts. You are here.' },
    { img:'gd-approx', kicker:'The best they do', h:'A rough approximation', body:'A vague shape, then a sharper guess, then the closest they’ll ever come. Never exactly you.' },
    { img:'gd-snake-v2', kicker:'Inside', h:'Something unrecognized', body:'There’s a self in there the labels keep missing, trying to be seen.' },
    { img:'gd-mask-v2', kicker:'Under the surface', h:'Not the face they read', body:'The one everyone meets is a mask over someone they haven’t actually met.' },
    { img:'gd-banner', kicker:'So', h:'Name it: general dysphoria', body:'Once you see the shape, you see it everywhere — yours, and everyone else’s.' }
  ]},
  gender: { title:'Two Questions, Not One', slides:[
    { img:'gx-conflated', kicker:'The mix-up', h:'Two things, tangled into one', body:'Whether someone is gay or straight, and whether they are a man or a woman inside — people knot these together. They are two separate things.' },
    { img:'gx-twoaxes', kicker:'Two axes', h:'Who you want, and who you are', body:'One line is who you are drawn to. The other is who you are. They cross, and each one moves on its own.' },
    { img:'gx-eachspectrum', kicker:'Each is a range', h:'Not two boxes', body:'Attraction runs across a range, end to end. Gender runs across a range too. Steps, not a switch.' },
    { img:'gx-field', kicker:'The map', h:'Every combination is real', body:'Most people sit in one corner of the grid. But every spot on it is somebody, somewhere.' },
    { img:'gx-independent', kicker:'Independent', h:'One doesn’t predict the other', body:'Knowing who a person loves tells you nothing about whether they feel like a man or a woman. The two never line up on their own.' },
    { img:'gx-seed', kicker:'Where it comes from', h:'A seed, then a life', body:'Part of it is inherited — a lean set early. The rest a whole life shapes. Loosely written in, and never chosen.' },
    { kicker:'To recap', h:'Two axes, any combination', body:'Who you want, and who you are. Each of them a range. Every mix is a real person on the grid.' }
  ]},
  shame: { title:'Inside & Outside Thoughts', slides:[
    { img:'cv-corey-v2', kicker:'A visit', h:'The kind self-story', body:'My uncle explained his whole life sympathetically. I nodded — and noticed it was a story he tells himself.' },
    { img:'cv-vehicle', kicker:'Name it', h:'A cognitive vehicle', body:'A thought whose job is to carry you from one place to another. It doesn’t have to be true to do its work.' },
    { img:'cv-shame', kicker:'Why we need them', h:'Driving out of shame', body:'Hero or victim is the way out when you can’t bear to be the villain. That’s human, and it keeps you moving.' },
    { img:'cv-affirm-v2', kicker:'An inside thought', h:'Talking to the mirror', body:'Some mornings I point at myself in the mirror and say something kind. No one hears it. It isn’t a claim about the world — just a little push to get me out the door.' },
    { kicker:'And it’s fine', h:'The kind story is healthy', body:'People who can’t tell themselves a generous story at all tend to be more depressed, not wiser.' },
    { img:'cv-gentle', kicker:'Two ways to say it', h:'Ungrateful, or just hard?', body:'The harsh voice calls me an ungrateful bitch. The gentle one says: this is hard, and she doesn’t understand. Same moment, two vehicles — and I get to pick the one I ride.' },
    { img:'cv-keepout-v2', kicker:'The catch', h:'Private. Keep out.', body:'These are inside thoughts. They’re for you — not to be handed to other people as fact.' },
    { img:'cv-insideoutside', kicker:'The skill', h:'Know which is which', body:'Inside thoughts move you along. Outside thoughts you can say aloud as true. The grown-up move is labeling the vehicle before you hand it over.' },
    { img:'cv-leeway', kicker:'The gap', h:'Room between the two', body:'Inside, a private sense of who I am. Outside, a flat label a stranger sticks on in a second. They don’t match — and I’ve stopped needing them to. The gap is mine to keep.' },
    { img:'cv-parvati-v2', kicker:'Leeway', h:'Naming yourself', body:'My aunt woke up to her spiritual side and announced a brand-new name for herself. The family rolled their eyes. But that’s an inside thought made a little visible — and she’s allowed the room to try it on.' },
    { img:'cv-broadcast-v2', kicker:'One failure', h:'Broadcasting the private', body:'Handing your inside story to everyone as objective truth. That’s where it curdles into self-justifying.' },
    { img:'cv-project-v2', kicker:'Where it curdles', h:'Talking shit as truth', body:'He was always talking shit about people. Clearly cognitive vehicles — he could have that feeling of protection for himself without projecting it onto the world as fact. Kept inside, it’s armor. Handed out as truth, it’s just contempt.' },
    { img:'cv-novehicle', kicker:'The other failure', h:'No vehicle at all', body:'And with no kind story to ride, shame floods in and you get stuck in the dip.' },
    { kicker:'So', h:'Keep them — know their address', body:'The vehicles are good. The skill is knowing which ones stay inside, and which ones are safe to say out loud.' }
  ]},
  synthetic: { title:'Synthetic Learning Syndrome', slides:[
    { kicker:'A brand-new disorder', h:'Synthetic Learning Syndrome', body:'Relearning, at great expense, things you already knew were obvious. (Not a real diagnosis. Mostly.)' },
    { img:'sl-grounding', kicker:'Exhibit A', h:'“Grounding”', body:'Standing barefoot on the earth. We gave it a name and a mat and a movement.' },
    { img:'sl-banana', kicker:'Exhibit B', h:'The pre-peeled banana', body:'It came in its own wrapper. We improved it anyway.' },
    { img:'sl-sadlamp-v2', kicker:'Exhibit C', h:'The sun, in a box', body:'A lamp that mimics daylight — glowing while real daylight pours through the window. (Fair enough in an Alaskan winter.)' },
    { img:'sl-treadmill', kicker:'Exhibit D', h:'Walking, indoors, at nature', body:'On a treadmill, watching a forest on a screen. We used to just walk to the forest.' },
    { kicker:'The pattern', h:'One free bundle, unbundled', body:'Walking outside for food once gave you exercise, sun, earth and real food at once, free. Now each piece is sold back separately.' },
    { img:'sl-supplements', kicker:'The essence', h:'Everything becomes a pill', body:'The active ingredient extracted, the whole thing thrown away. Vitamins instead of a meal.' },
    { img:'sl-pill', kicker:'Why it never fills', h:'The essence isn’t the thing', body:'Sugar is the essence of fruit; the highlight reel, of a life. Distilled, it leaves you emptier, wanting more.' },
    { img:'sl-hero', kicker:'And the twist', h:'Hailed for the obvious', body:'We won’t believe “just go outside” until someone studies it, brands it, and writes the book.' },
    { img:'sl-donut', kicker:'Underneath', h:'The desire treadmill', body:'We solved our problems and kept wanting. The donut stays out of reach because reaching is the trap.' },
    { kicker:'The cure', h:'The one thing you can’t buy', body:'Even the fix gets sold back to you as an app. The thing you actually needed was never a product — just remembering.' }
  ]},

  manifestation: { title:'My Experiment with Manifestation', slides:[
    { img:'mf-setmind', kicker:'Night after night', h:'A little experiment', body:'Just before I fall asleep, I set my mind on something I want. Not something I’ve prayed for — just something that sounds nice in the moment.' },
    { img:'mf-oldbed', kicker:'The bed I’m stuck with', h:'The old Victorian one', body:'I still have the same dark Victorian bed my mom won’t let me toss — tall, spiked, a little imposing. I keep it out of duty, not love.' },
    { img:'mf-bed', kicker:'Night one', h:'A pink satin bed', body:'So I started thinking of a pink satin one, with those cinched-up buttons on the headboard. All shiny and pink.' },
    { img:'mf-alley', kicker:'My daily route', h:'Down the same alley', body:'Every day I walk the same narrow alley with my coffee, past whatever bit of furniture someone’s left at the curb.' },
    { img:'mf-headboard', kicker:'The next day', h:'In the alley', body:'No one delivered a bed frame to my door. But there was a white headboard that looked suspiciously like the one I’d imagined — I couldn’t remember it being there before.' },
    { img:'mf-catwish', kicker:'Night two', h:'A little cat', body:'It was cold, and I imagined how nice it would be to have a little cat kneading its paws on my bed, settling on my chest so I could sleep warmer, with a little more love.' },
    { img:'mf-catreal', kicker:'The next day', h:'It stared me down', body:'There it was on a brick wall, staring at me like I was late to a meeting. I got scared — I felt sure that if I let it, this cat would follow me home and I’d be destined to care for it forever.' },
    { img:'mf-chocolate', kicker:'Night three', h:'A golden ticket', body:'I knew it was stupid, but I fantasized about being gifted a chocolate factory for being good. The next day my mom had left three full-size bars on the counter — one opened to a bright silver foil, suspiciously like a golden ticket.' },
    { img:'mf-why', kicker:'A pause', h:'Why so small?', body:'One afternoon I stopped writing and wondered why I’d only ever wished for such small, childish things — a bed, a cat, a candy bar.' },
    { img:'mf-partner', kicker:'The turn', h:'Something bigger', body:'I’m 33 and still without a partner. One lonely night I gave up all pretense and let myself picture him — hair, eyes, personality. This is off-limits to a happy single person, so I felt I was breaking my own rules.' },
    { img:'mf-hinge', kicker:'The next day', h:'A message on read', body:'Claire, a masc lesbian who’d left me on read two months ago, chose today to respond. In her profile she looked suspiciously like the person of my dreams. Same haircut and everything.' },
    { img:'mf-forlorn', kicker:'That evening', h:'Homesick for magic', body:'I walked home with my tea gone cold, feeling forlorn and a little alone, homesick for the magic I’d been tasting all week.' },
    { img:'mf-blackcat', kicker:'On the way', h:'Magic was everywhere', body:'I passed the wall where I’d seen that first cat. Then a different cat, black and narrow, made its way to me and pushed gently into my side, letting me have some of its warmth.' },
    { img:'mf-alibaba', kicker:'My phone buzzed', h:'I almost didn’t look', body:'A notification lit up my phone — the kind I usually ignore. Something made me check it anyway.' },
    { img:'mf-horse', kicker:'Later', h:'Always there for you', body:'I’d been planning to wish for a horse. Then my bulk-crystal supplier — who I’d never joked with — sent a meme: a horse in an office, “always there for you.” There was nothing to do but let a couple tears fall.' }
  ]},
  ocd: { title:'What’s the Difference Between OCD and Witchcraft?', slides:[
    { img:'oc-child', kicker:'Age 10', h:'I had OCD', body:'I couldn’t shake this dread that something would happen to my mom, and I developed all sorts of strange rituals to prevent it.' },
    { img:'oc-rituals', kicker:'The rituals', h:'In a precise order', body:'I touched things in a certain order, checked the switch again and again — small careful spells to keep my mom safe.' },
    { img:'oc-cbt', kicker:'The coach', h:'Just a trick of the brain', body:'I asked Lindsay if I needed to keep doing the rituals. She said it was just a trick of the brain, and that I could stop. So I stopped. Cold turkey. And I was fine.' },
    { img:'oc-voices', kicker:'Ten years', h:'Battling my intuition', body:'Then I spent the next ten years battling my intuition. I’d get a compulsion, say “that’s silly,” and hear my mother, my therapist, the science articles about how your mind tricks you. Guilt or shame, no matter what.' },
    { img:'oc-tracking', kicker:'The experiment', h:'Tracking the results', body:'If I didn’t do it, something bad would happen. If I did, and something good happened, I told myself I got lucky. I spent a lot of time tracking the results, like a science experiment. I wanted to know once and for all.' },
    { img:'oc-art', kicker:'Junior year', h:'Solace in art', body:'I found solace in art. Drawing requires careful observation and a non-judgmental attitude — all lines are good lines, as long as they describe what you’re looking at. Any outcome was neither good nor bad, just “interesting.”' },
    { img:'oc-witchkit', kicker:'Age 19', h:'Secretly a witch', body:'I dropped out to sell odd commodities. The only one that took off was the “secretly a witch kit.” Suddenly I was the head of a witch corporation, a driveway full of crystals and 500 decks of tarot — and I’d never done a single reading.' },
    { img:'oc-customers', kicker:'Behind the counter', h:'Never done a reading', body:'Customers leaned in asking about love spells, and I answered like an expert — crystals and tarot boxes stacked around me, having never done a single reading.' },
    { img:'oc-irony', kicker:'The irony doubled', h:'Pretending both ways', body:'I was pretending to be a witch, pretending not to be a witch. I might have called myself a fraud — except I knew, deep down, that if anyone had magical powers, it was me.' },
    { img:'oc-deepdown', kicker:'The secret', h:'Deep down I knew', body:'I could’ve called myself a fraud, except a quiet certainty glowed in my chest: if anyone here actually had powers, it was me.' },
    { img:'oc-summer', kicker:'A long summer', h:'The anger wouldn’t cool', body:'Through the whole hot summer a red cloud of anger sat around me, singeing hotter the longer the season dragged on.' },
    { img:'oc-anger', kicker:'2025', h:'So much anger', body:'I left a relationship with so much anger I could barely see straight. My “any outcome is a good outcome” mantra was breaking down. I needed this anger to dissolve.' },
    { img:'oc-spell', kicker:'One night', h:'My first spell', body:'In bed, the feeling came without the story — and with it an image: large black pins, straight into his stomach. I concentrated, feeling the white-hot anger, and then it was done. “If this really works, I need to see the result.”' },
    { img:'oc-result', kicker:'A few days later', h:'He came knocking', body:'He had stomach pain, he said; he needed me to forgive him. “I was causing it,” he said — though he was a staunch atheist. Driving to San Francisco, I made the connection.' },
    { img:'oc-heal', kicker:'From the car', h:'Sending some back', body:'So I tried it the other way — a gentle beam of healing sent toward my mom’s blurry vision, from miles away.' }
  ]},
  instrumentalism: { title:'Instrumentalism, Part I', slides:[
    { img:'in-roadtrip', kicker:'A confession', h:'The fungi decided', body:'This revelation came from those special fungi that one day decided to take me on a road trip. All expenses paid. I say “they decided,” because of the unique way I procured the mushrooms.' },
    { img:'in-loft', kicker:'Where I lived', h:'Seven bedrooms', body:'It was a big whimsical loft, seven bedrooms and too many doors — a grand, quirky, airy place to get lost in.' },
    { img:'in-bobbypin', kicker:'The loft', h:'Reach behind the seat', body:'I was sitting on the toilet in that loft when I had the urge to reach behind the seat. There I found a bobby pin.' },
    { img:'in-pick', kicker:'The locked door', h:'It opened first try', body:'I felt compelled to use it to open my roommate Nathan’s door, locked while he was away. I’d never picked a lock or thought to — but it opened on the first try.' },
    { img:'in-drawer', kicker:'The drawer', h:'A little bag', body:'Without knowing what I was looking for, I opened the top-left drawer of his dresser and took out a little bag of mushrooms.' },
    { img:'in-nathan', kicker:'My roommate', h:'Nathan didn’t mind', body:'When Nathan got back, he just handed me the rest of the little bag, cheerful and unbothered, like it was always meant for me.' },
    { img:'in-thread', kicker:'The idea', h:'Instrumentalism', body:'I call this instrumentalism. You follow your heart’s desire, and it leads you on a path you didn’t know existed.' },
    { img:'in-patterns', kicker:'All day long', h:'The dots collect', body:'As I went about ordinary days, tiny observations and pattern-dots drifted in and gathered quietly around my head.' },
    { img:'in-brain', kicker:'One explanation', h:'A remarkable apparatus', body:'In the spirit of scientism, I hatched a tidy theory: your mind tracks patterns all day and bundles them into little urges that lead you somewhere new. If true, the brain really would be as remarkable as they say.' },
    { img:'in-book', kicker:'A little book', h:'Channeling Jesus', body:'There’s a book — a soft, glowing thing — whose whole idea is that our emotions are our navigation system.' },
    { img:'in-compass', kicker:'But', h:'Our navigation system', body:'According to it, “our emotions are our navigation system.” For the unsure sort — bombarded by shoulds, targeted by regret — that itself is a revelation.' },
    { img:'in-shoulds', kicker:'Against the chatter', h:'The answer is inside', body:'That the answer to our unsureness would be found in our own mind, rather than an elaborate system of rules and suggestions from outside — this goes against the whole foundation of that worried chatter.' },
    { img:'in-secretcode', kicker:'A step further', h:'A secret code', body:'Instrumentalism takes these convictions further: not the patterns of an unharnessed subconscious, but the communications of another world — the spirit world — leading us “right into temptation.”' },
    { img:'in-temptation', kicker:'Led forward', h:'Right into temptation', body:'A soft hand reached down from a starry sky and coaxed me gently through the open door I’d been told to avoid.' },
    { img:'in-neglect', kicker:'Why I like it', h:'So be it', body:'Whether or not it’s true, I like this philosophy — it lets me prioritize what I want and neglect the bullying insistence of those around me. If I need a magical system to stop taking everyone’s ill-conceived advice, then so be it.' }
  ]},

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
    { img:'ht-grace-v2', kicker:'2012', h:'Saying grace', body:'My second attempt at college was failing. I’d caught too many whiffs of that feeling, and one thing led to another until I found myself across town, saying grace with a gathering of homeless people.' },
    { img:'ht-loft-v2', kicker:'Brooklyn', h:'On a whim', body:'I moved to Brooklyn on a whim, and was disappointed that whimsy is in short supply when you seek it out. My seven roommates and I just passed a joint around our furniture-less loft.' },
    { img:'ht-wind', kicker:'The rules', h:'Carried by the wind', body:'The law was lack of doubt. The moment I thought “I know where this is going,” the whole thing would change course. But leap without looking, feet on a cloud of faith, and there was always something waiting at the end.' },
    { img:'ht-volley', kicker:'The game', h:'A volley', body:'I kept nothing from these adventures — numbers exchanged were never called. It was a volley: the longer the ball stayed in the air, the more hearts I’d be given access to. Grab a piece of gold, and you’d be ejected.' },
    { img:'ht-shapeshifter', kicker:'How to win', h:'Nod along', body:'I was scarcely a person, more a shapeshifter. Agree with whatever strange understanding of the world my companions believed, and I’d be rewarded. Nod along, and you’ve won half the battle.' },
    { img:'ht-above', kicker:'Playing blind', h:'From above', body:'I learned the patterns coincidences take, and played blind — no longer the chess piece moving to and fro, but somewhere above it, strategizing my next move, which was almost always to do nothing.' },
    { img:'ht-balcony-v2', kicker:'But', h:'I grew to hate it', body:'On a stranger’s balcony, a long-haired man confessing a secret, bubbles floating down — and I’d know magic waited up on the roof. What I wanted most was just to go home.' },
    { img:'ht-tinkerbell', kicker:'The secret', h:'Grumbling for coffee', body:'“Because you’re free, it makes everyone feel free,” a roommate said. But I thought: I don’t get to do what I want, I have to. Inside this Tinkerbell cloud of a person is a heart grumbling that it hasn’t had its coffee.' }
  ]},
  art: { title:'Art Is Forgiving', slides:[
    { img:'af-burn', kicker:'My art teacher', h:'He burned it all', body:'Like he’d solved a puzzle, my high school art teacher jubilantly burned all his old artwork when he switched to a more cartoony style.' },
    { img:'af-garage-v2', kicker:'The paradox', h:'Rotting in a garage', body:'Art has infinite value and depthless uselessness — the power to express what can’t be said, and the power to sit in a garage rotting until you realize no one’s ever even seen your masterpiece.' },
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
    { img:'gm-shuttle-v2', kicker:'The mechanism', h:'The shuttle', body:'A shuttle raises and lowers the strings, intermittently differentiating them, then returns them seamlessly. Without it, they appear uniform — like the world of spirit coexisting with the physical.' },
    { img:'gm-innerlight', kicker:'So', h:'We learn an inner light', body:'Were it not for the utter blackness when the strings disconnect and we’re left with just stars, we’d have no reason to grope carefully in the dark. It is in this way that we learn to carry an inner light.' }
  ]},
  curious: { title:'In Case You’re Curious (Manifestation, Part II)', slides:[
    { img:'c2-theta', kicker:'The experiment continues', h:'A scientist at heart', body:'I got a couple signs from the universe and now I’m high on a cloud. But you best believe I’m a scientist at heart. I extended my experiment — here are the findings.' },
    { img:'c2-cake', kicker:'The cinnamon cake', h:'Eat this', body:'I knew I’d walk past cake — the only way I’d eat it was if someone locked me in a room and said “eat this.” That Thursday our housekeeper pushed the chairs and couches together to block the only exit, handed me a fork, and said “Eat!”' },
    { img:'c2-splinter', kicker:'The splinter', h:'Five weeks', body:'A splinter stayed in my foot for five weeks — urgent care and all. Then I saw a TikTok about a magic drawing salve. I watched it three times and that night imagined the splinter coming loose. It came out the next day.' },
    { img:'c2-crown', kicker:'The crown', h:'Deliriously happy', body:'A YouTube short said to lean your head back and hold your breath to push energy up into your crown chakra. I did it, went on a walk, and found myself deliriously happy, laughing and humming to myself.' },
    { img:'c2-herbalist-v2', kicker:'The teacher', h:'An herbalist appears', body:'I’ve turned to herbalism with no training, and one night thought, wouldn’t it be nice if someone just came and showed me how? The next day my mom called: a woman had come to repair a necklace, and happened to be an herbalist.' },
    { img:'c2-owl', kicker:'Spotted owl', h:'Owl spotted', body:'I had four friends over and we settled on manifesting an owl. Eyes closed, we all imagined a snowy owl swooping toward us. The next day, Jack texted: “owl spotted.”' },
    { img:'c2-candle', kicker:'P.S.', h:'A biblically accurate angel', body:'At the dinner, I’d left googly eyes on the table — the ones I bought to stick on my hats so they’d say “my eye is up here.” Mary found them and, as the candle burned down, made it into a biblically accurate angel.' }
  ]}
};

// Old page ids to delete after reposting (title-keyed), so Compare shows no dupes.
const OLD = {
  astrology:'0D7ADvlLPoHfrqg2yADZ', adhd:'uVdeS9ApPaB1oeFAUqdJ', dysphoria:'P7LRFcOyrEFmuqoxmDMT',
  gender:'klktpkvkcPsXQvo61zAE', shame:'JdAgnOEv7QBhfrhsF1w4', synthetic:'H2DViGzGIJH0zM3Emet3',
  manifestation:'qeX8K4SDyadETQlEaTHk', ocd:'EZU7H3G934jz6T68JL9k', instrumentalism:'IB85HgC3icGqir0qJGX8'
};

const ORDER=['astrology','adhd','gender','dysphoria','shame','synthetic',
  'manifestation','ocd','instrumentalism','animal','hate','art','mysterious','curious'];

(async()=>{
  const results={};
  for(const k of ORDER){
    const L=LESSONS[k];
    const html=page(L.title, L.slides);
    const r=await fetch(BASE+'/api/chatfeed/page',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chat:CHAT, title:L.title, html})});
    const d=await r.json();
    results[k]=d.ok?d:null;
    console.log(k, '->', d.ok? BASE+d.url : JSON.stringify(d));
  }
  // delete old duplicates
  for(const [k,id] of Object.entries(OLD)){
    if(results[k]){
      const r=await fetch(BASE+'/api/chatfeed/page/'+id,{method:'DELETE'});
      console.log('deleted old', k, r.status);
    }
  }
  console.log('\n=== FINAL LINKS ===');
  for(const k of ORDER){ if(results[k]) console.log(LESSONS[k].title,'::',BASE+results[k].url); }
})();
