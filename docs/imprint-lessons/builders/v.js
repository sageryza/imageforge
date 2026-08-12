
(function(){
  var A='https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-school/assets/';
  var slides=[{"kicker":"A brand-new disorder","h":"Synthetic Learning Syndrome","body":"Relearning, at great expense, things you already knew were obvious. (Not a real diagnosis. Mostly.)"},{"img":"sl-grounding","kicker":"Exhibit A","h":"“Grounding”","body":"Standing barefoot on the earth. We gave it a name and a mat and a movement."},{"img":"sl-banana","kicker":"Exhibit B","h":"The pre-peeled banana","body":"It came in its own wrapper. We improved it anyway."},{"img":"sl-sadlamp","kicker":"Exhibit C","h":"The sun, in a box","body":"A lamp that mimics daylight — glowing while real daylight pours through the window. (Fair enough in an Alaskan winter.)"},{"img":"sl-treadmill","kicker":"Exhibit D","h":"Walking, indoors, at nature","body":"On a treadmill, watching a forest on a screen. We used to just walk to the forest."},{"kicker":"The pattern","h":"One free bundle, unbundled","body":"Walking outside for food once gave you exercise, sun, earth and real food at once, free. Now each piece is sold back separately."},{"img":"sl-supplements","kicker":"The essence","h":"Everything becomes a pill","body":"The active ingredient extracted, the whole thing thrown away. Vitamins instead of a meal."},{"img":"sl-pill","kicker":"Why it never fills","h":"The essence isn’t the thing","body":"Sugar is the essence of fruit; the highlight reel, of a life. Distilled, it leaves you emptier, wanting more."},{"img":"sl-hero","kicker":"And the twist","h":"Hailed for the obvious","body":"We won’t believe “just go outside” until someone studies it, brands it, and writes the book."},{"img":"sl-donut","kicker":"Underneath","h":"The desire treadmill","body":"We solved our problems and kept wanting. The donut stays out of reach because reaching is the trap."},{"kicker":"The cure","h":"The one thing you can’t buy","body":"Even the fix gets sold back to you as an app. The thing you actually needed was never a product — just remembering."}];
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
