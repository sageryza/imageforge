# The autoscroll pill — ONE shared implementation for every scrollable web page
# (Writing Room, Story Room, Chats, Wall all import these). Matches the native
# AutoScrollPill: five discrete speeds — Slow / Medium / Fast / Faster /
# Fastest — starting on Fast, not a continuous dial. Idle: ▲ scroll-up / ▶ play
# / ▼ down. Playing: − slower / ‖ pause / + faster (the − dims at Slow, the +
# dims at Fastest). The whole 48×52 button is the tap target, not just the glyph.
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
/* EVERY PROPERTY THE PILL LEAVES UNSET IS A HOLE THE HOST FALLS THROUGH (Aug
   2026, Sophie: "it's still the wrong pill … it looks different").
   compare.css declares `button, .btn{…border-radius:6px…}` — a bare-element
   rule at (0,0,1). `.vseg button` out-specifies it for everything it DECLARES
   (border, background, colour, size, padding), so nobody noticed for months;
   but it never declared a radius, so the 6px stood and each of the three
   segments became its own rounded box — the hairline dividers vanished and
   the capsule read as three loose buttons instead of one control.
   Measured by diffing every computed property of the pill rendered alone
   against the same markup with only compare.css added. FOUR reachable
   properties actually moved it: border-radius, box-sizing (the host's
   `*{box-sizing:border-box}` pulled the 1.5px stroke inside, 50px → 48),
   line-height (#spd grew 12px → 17px, so the whole pill grew 5px taller) and
   the buttons' font. They are all declared now — pin them, don't re-derive
   them, and add to this line whenever a new host reaches something. */
.float, .float *{box-sizing:content-box; line-height:normal; letter-spacing:normal; text-transform:none;}
.float{position:fixed; top:max(14px, env(safe-area-inset-top)); right:max(14px,4vw); z-index:9; display:flex; flex-direction:column; gap:8px; align-items:center; transform:translateZ(0); will-change:transform;}
/* THE FIVE TOKENS ARE READ FROM THE HOST, WITH A FALLBACK — never baked ON
   `.float` (Aug 2026). The injected copy used to carry its own palette plus a
   `prefers-color-scheme: dark` block, and an element's own custom property
   beats one inherited from `:root`, so a host could not simply define the
   tokens: compare.css had to out-specify with `body .float{…}`, ten lines
   whose own comment warned they had to be kept in sync by hand. Read them
   with `var(--x, …)` instead and the host's `:root` wins by itself — the same
   free inheritance a baked-in pill has always had — while a page that defines
   none of them still gets the studio cream. A host with a dark mode already
   swaps its own tokens, so the pill follows it with no dark block of its own. */
.vseg{display:flex; flex-direction:column; width:48px; border:1.5px solid var(--ink, #26221c); border-radius:999px; overflow:hidden; background:var(--paper, #f6f2e9); box-shadow:0 2px 10px rgba(0,0,0,.09);}
.vseg button{border:none; border-radius:0; margin:0; gap:0; background:transparent; color:var(--ink, #26221c); font:400 13px/1 -apple-system,sans-serif; width:48px; height:52px; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; -webkit-tap-highlight-color:transparent; touch-action:manipulation;}
.vseg button + button{border-top:1.5px solid var(--ink, #26221c);}
.vseg button.on{background:color-mix(in srgb, var(--chg, #b3443f) 18%, var(--paper, #f6f2e9)); color:var(--chg, #b3443f);}
.vseg button.dim{opacity:.3;}
.vseg button:focus-visible{outline:2px solid var(--rose, #c66); outline-offset:-2px;}
#spd{font-family:-apple-system,sans-serif; font-size:11px; font-weight:600; color:var(--ink2, #8a8377); letter-spacing:.02em;}
/* The pill's glyphs must survive any HOST page's global svg rules — a page
   that declares `svg{fill:none}` (editor.html, cuttingroom.html) was
   hollowing the play triangle (Sophie: "the play arrow is normally filled
   in, but the one I see on yours is hollow"). CSS beats an SVG's own
   presentation attributes, so reassert each glyph's attributes at higher
   specificity than any bare-`svg` page rule can reach. */
.float svg{fill:none; stroke:currentColor; stroke-width:1.8; width:auto; height:auto;}
.float svg[fill="currentColor"]{fill:currentColor;}
.float svg[stroke-width="1"]{stroke-width:1;}
.float svg:not([stroke]){stroke:none;}
"""

PILL_HTML = """
<div class="float">
  <div class="vseg">
    <button id="vtop" aria-label="Scroll up, or slower while playing"></button>
    <button id="vmid" aria-label="Play or pause autoscroll"></button>
    <button id="vbot" aria-label="Scroll down, or faster while playing"></button>
  </div>
  <span id="spd">Fast</span>
</div>
"""

PILL_JS = """
// A page that scrolls ITSELF opts out with <body data-nopill> (Aug 2026,
// Sophie: on the pausing tool the pill covered a control AND fought the
// read-along's own centring). The pill takes itself off the page and every
// hook below becomes a no-op, so page code that calls __scrollStop still
// works and never has to know whether a pill exists.
// Declared EITHER as <meta name="forge-pill" content="off"> (head-safe, and
// the reliable one — an inline script before any content runs while
// document.body is still null) or as <body data-nopill>.
if (document.querySelector('meta[name="forge-pill"][content="off"]') ||
    (document.body && document.body.hasAttribute('data-nopill'))) {
  var _f=document.querySelector('.float'); if(_f) _f.remove();
  window.__scrollStop=function(){}; window.__scrollTap=function(){};
  window.__pillInteractive=function(){ return false; };
  window.__pillSync=function(){};
} else {
var SPEEDS=[['Slow',0.5],['Medium',1.0],['Fast',1.9],['Faster',3.2],['Fastest',5.2]];
var playing=false, raf=null, last=null, si=2, dir=1, acc=0;
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
function canScroll(d){ return d>0 ? (window.innerHeight+window.scrollY < document.body.scrollHeight-4) : (window.scrollY>2); }
// Pressing play at an end of the page used to do nothing at all: autoscroll
// remembers the direction it stopped in, so after riding UP to the top the next
// play still meant "up" and there was nowhere to go. A direction with no room
// flips to the one that has room, so a press always moves the page.
function scrollStart(d){ if(!canScroll(d) && canScroll(-d)) d=-d;
  dir=d; playing=true; last=null; acc=0; paintPill(); raf=requestAnimationFrame(stepPill); }
function scrollStop(){ playing=false; if(raf) cancelAnimationFrame(raf); paintPill(); }
window.__scrollStop=scrollStop;
window.__scrollStart=scrollStart;
window.__scrollToggle=function(){ playing? scrollStop() : scrollStart(1); };
// A tap that lands on something INTERACTIVE belongs to the page, not to the
// pill: a <summary>/<details> toggle, link, button, form field or media
// control must do its own thing, so the tap gesture ignores the event
// entirely (no toggle, no preventDefault, no stopPropagation).
// Anything a tap could plausibly MEAN something on. A tap here never STARTS
// the scroll — it still pauses one (see __scrollTap). Media and overlays are
// on the list because tapping a picture, a player or a lightbox is the page's
// own gesture everywhere (the rule chats.html already applied to img/figure).
var PILL_SKIP='a,button,summary,details,input,textarea,select,label,option,'
  +'video,audio,img,picture,figure,svg,canvas,iframe,embed,object,progress,meter,'
  +'[onclick],[data-nostop],[contenteditable]:not([contenteditable="false"]),'
  +'[role="button"],[role="link"],[role="checkbox"],[role="slider"],[role="tab"],'
  +'.cmp-lb,.cmp-vlb';
function pillInteractive(t){
  try{ return !!(t && t.closest && t.closest(PILL_SKIP)); }catch(_){ return false; }
}
window.__pillInteractive=pillInteractive;
// Content-tap gesture (a page calls __scrollTap from its own tap handler,
// passing the event when it has one): a plain toggle — tap stops, tap starts
// again (at the current speed; default Fast). Speed changes stay on the −/+.
window.__scrollTap=function(e){
  // ANY tap pauses a running scroll -- that is the house rule, and skipping
  // the pause for interactive elements is what let a tap on a play button
  // leave the page creeping under her while the film opened. Only a tap on
  // inert background may START one.
  if(playing){ scrollStop(); return; }
  if(e && pillInteractive(e.target||e.srcElement)) return;
  scrollStart(1);
};
vtop.onclick=function(){ if(playing){ si=Math.max(0,si-1); paintPill(); } else scrollStart(-1); };
vbot.onclick=function(){ if(playing){ si=Math.min(SPEEDS.length-1,si+1); paintPill(); } else scrollStart(1); };
vmid.onclick=function(){ playing? scrollStop() : scrollStart(dir||1); };
// Leaving the page (tab switch, app background, webview hidden) stops
// autoscroll — it must never keep scrolling while nobody's looking.
document.addEventListener('visibilitychange',function(){ if(document.hidden) scrollStop(); });
window.addEventListener('pagehide',scrollStop);
// IT ONLY APPEARS WHEN THERE IS SOMETHING TO SCROLL (Aug 2026, Sophie: "it
// should be a conditional pill that only appears if there's actually content
// to scroll"). A control that cannot do anything is chrome sitting on the
// top-right corner of a page that had no use for it — and that corner is
// where a picture or a row of buttons usually wants to be.
//
// THE CHECK HAS TO KEEP WATCHING, not run once. Almost every page here fetches
// its own content after it loads (the feed, the queue, a Compare page's
// pictures), so a page is short at load and tall a second later — a check at
// DOMContentLoaded would hide the pill on nearly every page in the app. So:
// a ResizeObserver on the document and the body, plus resize and the font
// load, and it goes back and forth as freely as the content does.
var _pill=document.querySelector('.float');
function pageScrolls(){
  var d=document.documentElement, b=document.body;
  var h=Math.max(d?d.scrollHeight:0, b?b.scrollHeight:0);
  return h > window.innerHeight + 4;
}
function syncPill(){
  if(!_pill) return;
  var can=pageScrolls();
  // never yank it out from under a running scroll — stop first, then hide
  if(!can && playing) scrollStop();
  _pill.style.display = can ? '' : 'none';
}
window.__pillSync=syncPill;
window.addEventListener('resize',syncPill,{passive:true});
window.addEventListener('load',syncPill);
if(document.fonts && document.fonts.ready) document.fonts.ready.then(syncPill);
if(window.ResizeObserver){
  var _ro=new ResizeObserver(syncPill);
  if(document.documentElement) _ro.observe(document.documentElement);
  if(document.body) _ro.observe(document.body);
}
syncPill();
paintPill();
}
"""
