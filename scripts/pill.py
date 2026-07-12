# The autoscroll pill — one shared implementation for every scrollable page
# (Writing Room and Story Room carry their own inline copies from before;
# gen-chats.py, gen-wall.py import these). Plain-brace strings: safe to embed
# in non-f-string templates. Behavior: idle = ▲ scroll-up / ▶ play / ▼ down;
# playing = − slower / ‖ pause / + faster; default 1.0×, range 0.1–2×.

PILL_CSS = """
.float{position:fixed; top:max(14px, env(safe-area-inset-top)); right:max(14px,4vw); z-index:9; display:flex; flex-direction:column; gap:8px; align-items:center;}
.vseg{display:flex; flex-direction:column; width:46px; border:1.5px solid var(--ink); border-radius:999px; overflow:hidden; background:var(--paper); box-shadow:0 2px 10px rgba(0,0,0,.09);}
.vseg button{border:none; background:transparent; color:var(--ink); height:46px; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0;}
.vseg button + button{border-top:1.5px solid var(--ink);}
.vseg button.on{background:color-mix(in srgb, var(--chg) 18%, var(--paper)); color:var(--chg);}
#spd{font-family:-apple-system,sans-serif; font-size:10px; color:var(--ink2); font-variant-numeric:tabular-nums;}
"""

PILL_HTML = """
<div class="float">
  <div class="vseg">
    <button id="vtop" aria-label="Scroll up / slower"></button>
    <button id="vmid" aria-label="Play or pause autoscroll"></button>
    <button id="vbot" aria-label="Scroll down / faster"></button>
  </div>
  <span id="spd">1.0&times;</span>
</div>
"""

PILL_JS = """
var playing=false, raf=null, last=null, speed=1, dir=1, acc=0;
var vtop=document.getElementById('vtop'), vmid=document.getElementById('vmid'), vbot=document.getElementById('vbot');
var I={
 up:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
 down:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
 play:'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
 pause:'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="4.5" height="16" rx="1"/><rect x="14.5" y="4" width="4.5" height="16" rx="1"/></svg>',
 plus:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
 minus:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 12h14"/></svg>'
};
function showSpd(){ document.getElementById('spd').textContent=speed.toFixed(1)+'\\u00d7'; }
function paintPill(){
  if(playing){ vtop.innerHTML=I.minus; vbot.innerHTML=I.plus; vmid.innerHTML=I.pause; vmid.classList.add('on'); }
  else{ vtop.innerHTML=I.up; vbot.innerHTML=I.down; vmid.innerHTML=I.play; vmid.classList.remove('on'); }
  showSpd();
}
function stepPill(ts){
  if(!playing) return;
  if(last!=null){
    acc += dir*(ts-last)/1000*42*speed;
    var move = acc>0 ? Math.floor(acc) : Math.ceil(acc);
    if(move!==0){ window.scrollBy(0,move); acc-=move; }
    var atEnd = dir>0 ? (window.innerHeight+window.scrollY>=document.body.scrollHeight-4) : (window.scrollY<=2);
    if(atEnd) scrollStop(); }
  last=ts; raf=requestAnimationFrame(stepPill);
}
function scrollStart(d){ dir=d; playing=true; last=null; acc=0; paintPill(); raf=requestAnimationFrame(stepPill); }
function scrollStop(){ playing=false; if(raf) cancelAnimationFrame(raf); paintPill(); }
window.__scrollStop=scrollStop;
vtop.onclick=function(){ if(playing){ speed=Math.max(.1,+(speed-0.1).toFixed(1)); showSpd(); } else scrollStart(-1); };
vbot.onclick=function(){ if(playing){ speed=Math.min(2,+(speed+0.1).toFixed(1)); showSpd(); } else scrollStart(1); };
vmid.onclick=function(){ playing? scrollStop() : scrollStart(dir||1); };
paintPill();
"""
