
(function(){
  var A='https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-school/assets/';
  var slides=[{"img":"in-roadtrip","kicker":"A confession","h":"The fungi decided","body":"This revelation came from those special fungi that one day decided to take me on a road trip. All expenses paid. I say “they decided,” because of the unique way I procured the mushrooms."},{"img":"in-bobbypin","kicker":"The loft","h":"Reach behind the seat","body":"I was sitting on the toilet in my seven-bedroom loft when I had the urge to reach behind the seat. There I found a bobby pin."},{"img":"in-pick","kicker":"The locked door","h":"It opened first try","body":"I felt compelled to use it to open my roommate Nathan’s door, locked while he was away. I’d never picked a lock or thought to — but it opened on the first try."},{"img":"in-drawer","kicker":"The drawer","h":"A little bag","body":"Without knowing what I was looking for, I opened the top-left drawer of his dresser and took out a little bag of mushrooms."},{"img":"in-thread","kicker":"The idea","h":"Instrumentalism","body":"I call this instrumentalism. You follow your heart’s desire, and it leads you on a path you didn’t know existed."},{"img":"in-brain","kicker":"One explanation","h":"A remarkable apparatus","body":"In the spirit of scientism, I hatched a tidy theory: your mind tracks patterns all day and bundles them into little urges that lead you somewhere new. If true, the brain really would be as remarkable as they say."},{"img":"in-compass","kicker":"But","h":"Our navigation system","body":"But Jesus told me otherwise. According to the book Channeling Jesus, “our emotions are our navigation system.” For the unsure sort — bombarded by shoulds, targeted by regret — that itself is a revelation."},{"img":"in-shoulds","kicker":"Against the chatter","h":"The answer is inside","body":"That the answer to our unsureness would be found in our own mind, rather than an elaborate system of rules and suggestions from outside — this goes against the whole foundation of that worried chatter."},{"img":"in-secretcode","kicker":"A step further","h":"A secret code","body":"Instrumentalism takes these convictions further: not the patterns of an unharnessed subconscious, but the communications of another world — the spirit world — leading us “right into temptation.”"},{"img":"in-neglect","kicker":"Why I like it","h":"So be it","body":"Whether or not it’s true, I like this philosophy — it lets me prioritize what I want and neglect the bullying insistence of those around me. If I need a magical system to stop taking everyone’s ill-conceived advice, then so be it."}];
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
