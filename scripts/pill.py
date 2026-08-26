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
/* BACK TO TOP (Aug 2026, Sophie: "add a small back to top arrow in playground
   when i scroll down. as well as other long scrolls like meta assets"). It
   rides in the pill's own rail rather than floating somewhere new: that
   corner is already reserved on every page (headers pad 56px for it), so a
   second free-floating control would land on top of page content — the exact
   thing the pill's reservation exists to prevent. Small and round, so it
   never reads as a fourth pill segment, and it is NOT the pill's ▲ (which
   walks up gradually) — the glyph is arrow-up-TO-LINE, a jump.
   Shown only past one full screen of scrolling, so a page she can nearly see
   the end of does not grow a control. */
.ptop{box-sizing:border-box; width:38px; height:38px; border:1.5px solid var(--ink, #26221c); border-radius:50%;
  background:var(--paper, #f6f2e9); color:var(--ink, #26221c); padding:0; margin:0; cursor:pointer;
  display:none; align-items:center; justify-content:center; box-shadow:0 2px 10px rgba(0,0,0,.09);
  -webkit-tap-highlight-color:transparent; touch-action:manipulation;}
.ptop.on{display:flex;}
.ptop:focus-visible{outline:2px solid var(--rose, #c66); outline-offset:-2px;}
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
  <button id="ptop" class="ptop" aria-label="Back to the top" title="Back to the top"></button>
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
  window.__pillTopSync=function(){};
} else {
var SPEEDS=[['Slow',0.5],['Medium',1.0],['Fast',1.9],['Faster',3.2],['Fastest',5.2]];
var playing=false, raf=null, last=null, si=2, dir=1, acc=0;
// ── WHAT IS ACTUALLY SCROLLING ────────────────────────────────────────────
// (2026-08-24, Sophie: "some surfaces scroll but have no to top arrow. like
// story room shelf".) Every check below used to ask the WINDOW, so a surface
// whose content scrolls inside a full-screen sheet — the Story Room's shelf is
// `position:fixed; inset:0; overflow-y:auto` — looked to the pill like a page
// with nothing to scroll: no pill, no back-to-top, on the one screen she reads
// most. The sheet also sits at z-index 40 over the pill's 9, so even a lit
// arrow was under it (measured with elementFromPoint: the tap reached
// `#shelftiles`).
//
// THE SCROLLER ANNOUNCES ITSELF BY SCROLLING, which is why there is no
// per-page hook and no scanning. `scroll` does not bubble but it DOES capture,
// so one capture-phase listener on the document hears an inner element scroll
// and names it in `e.target`. Scrolling the window again releases it. The
// alternative — walking the DOM looking for a scroller — is a query per scroll
// event on pages holding thousands of nodes, and it has to guess.
//
// ONLY A NEARLY-FULL-SCREEN OVERLAY IS ADOPTED. A small inner scroller (a note
// list, a caption box, a filter drawer) must never steal the pill from the
// page behind it — the pill would then jump a box she is not reading. 80% of
// the width and 60% of the height is the floor, measured against the sheet
// pattern this exists for.
var _box=null, _boxZ='';
function boxOK(el){
  if(!el || el===document || el===document.body || el===document.documentElement) return false;
  if(!el.getBoundingClientRect || el.scrollHeight - el.clientHeight <= 4) return false;
  var r=el.getBoundingClientRect();
  return r.width >= window.innerWidth*0.8 && r.height >= window.innerHeight*0.6;
}
// Adopting one LIFTS THE PILL OVER IT and putting it down restores the pill's
// own layer — a sheet is drawn above the pill on purpose, and the pill has to
// out-stack only the thing it is currently driving (never lightboxes, which
// are higher again and are not scrollers).
function useBox(el){
  if(el===_box) return;
  _box=el;
  if(_pill){
    if(el){
      var z=parseInt(getComputedStyle(el).zIndex,10);
      _boxZ=_pill.style.zIndex;
      if(z===z) _pill.style.zIndex=String(z+1);
    } else { _pill.style.zIndex=_boxZ; _boxZ=''; }
  }
  if(playing) scrollStop();
  syncPill(); syncPtop();
}
function sTop(){ return _box ? _box.scrollTop : window.scrollY; }
function sView(){ return _box ? _box.clientHeight : window.innerHeight; }
function sHeight(){
  if(_box) return _box.scrollHeight;
  var d=document.documentElement, b=document.body;
  return Math.max(d?d.scrollHeight:0, b?b.scrollHeight:0);
}
function sBy(px){ if(_box) _box.scrollTop += px; else window.scrollBy(0,px); }
function sHome(){
  if(_box){ try{ _box.scrollTo({top:0, behavior:'smooth'}); }catch(_){ _box.scrollTop=0; } return; }
  try{ window.scrollTo({top:0, behavior:'smooth'}); }catch(_){ window.scrollTo(0,0); }
}
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
    if(move!==0){ sBy(move); acc-=move; }
    var atEnd = dir>0 ? (sView()+sTop()>=sHeight()-4) : (sTop()<=2);
    if(atEnd) scrollStop(); }
  last=ts; raf=requestAnimationFrame(stepPill);
}
function canScroll(d){ return d>0 ? (sView()+sTop() < sHeight()-4) : (sTop()>2); }
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
var PILL_SKIP='a,button,summary,details,input,textarea,select,label,video,audio,[onclick]';
function pillInteractive(t){
  try{ return !!(t && t.closest && t.closest(PILL_SKIP)); }catch(_){ return false; }
}
window.__pillInteractive=pillInteractive;
// Content-tap gesture (a page calls __scrollTap from its own tap handler,
// passing the event when it has one): a plain toggle — tap stops, tap starts
// again (at the current speed; default Fast). Speed changes stay on the −/+.
// A RESUMED SCROLL ALWAYS GOES DOWN (2026-08-26, Sophie: "it used to go down
// after I stopped it even if it was going up before. now it doesn't seem to
// do that. can you just revert that one change"). It resumed on `dir` for two
// days (#1618) so that pausing an upward scroll and tapping again kept going
// up — she has asked for the older behaviour back, so `dir` on resume is
// HISTORY rather than a rule. DOWN is the direction a resume means; the ▲ is
// how she goes back up. `scrollStart`'s end-of-page flip still applies, so a
// resume at the very bottom turns around rather than doing nothing — that
// half of #1618 stays.
window.__scrollTap=function(e){
  if(e && pillInteractive(e.target||e.srcElement)) return;
  playing? scrollStop() : scrollStart(1);
};
vtop.onclick=function(){ if(playing){ si=Math.max(0,si-1); paintPill(); } else scrollStart(-1); };
vbot.onclick=function(){ if(playing){ si=Math.min(SPEEDS.length-1,si+1); paintPill(); } else scrollStart(1); };
vmid.onclick=function(){ playing? scrollStop() : scrollStart(1); };
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
function pageScrolls(){ return sHeight() > sView() + 4; }
// Waiting for her to scroll is too late for the PILL itself: opening a sheet
// would show no pill at all until she had already scrolled it by hand. So when
// the window has nothing to scroll, ask what is under the middle of the screen
// — `elementsFromPoint` walks the stack at one point, which is O(depth) and
// finds the topmost overlay covering the viewport, where scanning the DOM for
// scrollers is a query over every node on the page and still has to guess.
function findBox(){
  if(!document.elementsFromPoint) return null;
  var els=document.elementsFromPoint(window.innerWidth/2, window.innerHeight/2)||[];
  for(var i=0;i<els.length;i++){
    if(boxOK(els[i]) && /auto|scroll/.test(getComputedStyle(els[i]).overflowY)) return els[i];
  }
  return null;
}
function syncPill(){
  if(!_pill) return;
  // a sheet that has closed is not the scroller any more — put it down before
  // measuring, or the pill goes on reporting a box nobody can see
  if(_box && !boxOK(_box)){ useBox(null); return; }
  if(!_box && sHeight() <= sView()+4){ var f=findBox(); if(f){ useBox(f); return; } }
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
// A SHEET OPENING CHANGES NOTHING THE ResizeObserver WATCHES — it is a fixed
// overlay, so the document and the body keep their size and the pill would
// wait for a scroll that has nowhere to start. Attribute/child changes are the
// signal (every sheet here is a body child toggled by `hidden`), coalesced to
// one check a frame so a chatty page pays for it once.
if(window.MutationObserver && document.body){
  var _mq=false;
  new MutationObserver(function(){
    if(_mq) return; _mq=true;
    requestAnimationFrame(function(){ _mq=false; syncPill(); syncPtop(); });
  }).observe(document.body,{childList:true,subtree:true,attributes:true,
    attributeFilter:['hidden','class','style']});
}

// The back-to-top button. Appears past one full screen; a tap stops any
// running autoscroll FIRST (otherwise the scroll keeps walking the page back
// down under the animation) and then jumps.
var _ptop=document.getElementById('ptop');
if(_ptop){
  _ptop.innerHTML='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" '+
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+
    '<path d="M5 4h14"/><path d="m18 14-6-6-6 6"/><path d="M12 8v12"/></svg>';
  _ptop.onclick=function(){
    scrollStop();
    sHome();
  };
}
function syncPtop(){
  if(!_ptop) return;
  _ptop.classList.toggle('on', sTop() > sView() && pageScrolls());
}
window.__pillTopSync=syncPtop;
window.addEventListener('scroll',syncPtop,{passive:true});
window.addEventListener('resize',syncPtop,{passive:true});
// The capture-phase listener that hears an inner scroller (see WHAT IS
// ACTUALLY SCROLLING above). It is the ONLY thing that adopts one, and the
// window scrolling puts it down again.
document.addEventListener('scroll',function(e){
  var t=e.target;
  if(t===document || t===document.documentElement || t===document.body) useBox(null);
  else if(boxOK(t)) useBox(t);
  syncPtop();
},true);
syncPtop();
syncPill();
paintPill();
}
"""
