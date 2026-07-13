# The autoscroll pill — ONE shared implementation for every scrollable web page
# (Writing Room, Story Room, Chats, Wall all import these). Matches the native
# AutoScrollPill: three discrete speeds — Slow / Medium / Fast — starting on
# Medium, not a continuous dial. Idle: ▲ scroll-up / ▶ play / ▼ down. Playing:
# − slower / ‖ pause / + faster (the − dims at Slow, the + dims at Fast). The
# whole 48×52 button is the tap target, not just the glyph.
#
# Public hooks other page code can call (tap-to-pause, close-image, tab-switch):
#   window.__scrollStop()    — stop autoscroll
#   window.__scrollStart(d)  — start (d = 1 down, -1 up)
#   window.__scrollToggle()  — toggle (starts downward)
#
# Change it here and every page updates on the next gen-*.py run. Plain-brace
# strings: embed directly in a non-f-string template, or via the
# __PILL_CSS__ / __PILL_HTML__ / __PILL_JS__ placeholder + .replace() pattern.

PILL_CSS = """
.float{position:fixed; top:max(14px, env(safe-area-inset-top)); right:max(14px,4vw); z-index:9; display:flex; flex-direction:column; gap:8px; align-items:center;}
.vseg{display:flex; flex-direction:column; width:48px; border:1.5px solid var(--ink); border-radius:999px; overflow:hidden; background:var(--paper); box-shadow:0 2px 10px rgba(0,0,0,.09);}
.vseg button{border:none; background:transparent; color:var(--ink); width:48px; height:52px; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; -webkit-tap-highlight-color:transparent; touch-action:manipulation;}
.vseg button + button{border-top:1.5px solid var(--ink);}
.vseg button.on{background:color-mix(in srgb, var(--chg) 18%, var(--paper)); color:var(--chg);}
.vseg button.dim{opacity:.3;}
.vseg button:focus-visible{outline:2px solid var(--rose, #c66); outline-offset:-2px;}
#spd{font-family:-apple-system,sans-serif; font-size:11px; font-weight:600; color:var(--ink2); letter-spacing:.02em;}
"""

PILL_HTML = """
<div class="float">
  <div class="vseg">
    <button id="vtop" aria-label="Scroll up, or slower while playing"></button>
    <button id="vmid" aria-label="Play or pause autoscroll"></button>
    <button id="vbot" aria-label="Scroll down, or faster while playing"></button>
  </div>
  <span id="spd">Medium</span>
</div>
"""

PILL_JS = """
var SPEEDS=[['Slow',0.5],['Medium',1.0],['Fast',1.9]];
var playing=false, raf=null, last=null, si=1, dir=1, acc=0;
var vtop=document.getElementById('vtop'), vmid=document.getElementById('vmid'), vbot=document.getElementById('vbot');
var I={
 up:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
 down:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
 play:'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
 pause:'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="4.5" height="16" rx="1"/><rect x="14.5" y="4" width="4.5" height="16" rx="1"/></svg>',
 plus:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
 minus:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 12h14"/></svg>'
};
function spd(){ return SPEEDS[si][1]; }
function showSpd(){ document.getElementById('spd').textContent=SPEEDS[si][0]; }
function paintPill(){
  if(playing){
    vtop.innerHTML=I.minus; vbot.innerHTML=I.plus; vmid.innerHTML=I.pause; vmid.classList.add('on');
    vtop.classList.toggle('dim', si===0); vbot.classList.toggle('dim', si===SPEEDS.length-1);
  } else {
    vtop.innerHTML=I.up; vbot.innerHTML=I.down; vmid.innerHTML=I.play; vmid.classList.remove('on');
    vtop.classList.remove('dim'); vbot.classList.remove('dim');
  }
  showSpd();
}
function stepPill(ts){
  if(!playing) return;
  if(last!=null){
    acc += dir*(ts-last)/1000*42*spd();
    var move = acc>0 ? Math.floor(acc) : Math.ceil(acc);
    if(move!==0){ window.scrollBy(0,move); acc-=move; }
    var atEnd = dir>0 ? (window.innerHeight+window.scrollY>=document.body.scrollHeight-4) : (window.scrollY<=2);
    if(atEnd) scrollStop(); }
  last=ts; raf=requestAnimationFrame(stepPill);
}
function scrollStart(d){ dir=d; playing=true; last=null; acc=0; paintPill(); raf=requestAnimationFrame(stepPill); }
function scrollStop(){ playing=false; if(raf) cancelAnimationFrame(raf); paintPill(); }
window.__scrollStop=scrollStop;
window.__scrollStart=scrollStart;
window.__scrollToggle=function(){ playing? scrollStop() : scrollStart(1); };
vtop.onclick=function(){ if(playing){ si=Math.max(0,si-1); paintPill(); } else scrollStart(-1); };
vbot.onclick=function(){ if(playing){ si=Math.min(SPEEDS.length-1,si+1); paintPill(); } else scrollStart(1); };
vmid.onclick=function(){ playing? scrollStop() : scrollStart(dir||1); };
paintPill();
"""
