#!/usr/bin/env python3
# The Scratch Pad — public/scratchpad.html, served gated at /scratchpad.
#
# Stage ONE of a story: thinking with pictures, before the Story Room (stage
# two). Deliberately MINIMAL — a place for thinking on paper. No labels on
# anything the eye already understands: a beat's frame color (mustard / green /
# blue / pink) is the indicator, never a word. No machinery on the pad itself —
# finished artwork only; everything operational lives in popups.
#
# Edit HERE and rebuild (python3 scripts/gen-scratchpad.py), same contract as
# gen-chats.py. The autoscroll pill is appended by serveGated({pill:true}) —
# do NOT add one here.
import base64, os

ROOT = os.path.join(os.path.dirname(__file__), '..')
font = base64.b64encode(open(os.path.join(ROOT, 'ios', 'ImageForge', 'EBGaramond.ttf'), 'rb').read()).decode()

page = r"""<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>Story Room</title>
<style>
@font-face{font-family:'EBGaramond';font-weight:400 700;font-display:swap;src:url(data:font/ttf;base64,__FONT__) format('truetype');}
:root{ --paper:#f6f2e9; --ink:#26221c; --ink2:#8a8377; --line:#d9d2c2; --barbg:#fffdf7;
  --mustard:#c99b3f; --green:#7d9b76; --blue:#7189a5; --pink:#c88fa2; }
@media (prefers-color-scheme: dark){:root{--paper:#191713; --ink:#e8e2d6; --ink2:#97907f; --line:#37322a; --barbg:#211e19;}}
:root[data-theme="dark"]{--paper:#191713; --ink:#e8e2d6; --ink2:#97907f; --line:#37322a; --barbg:#211e19;}
:root[data-theme="light"]{--paper:#f6f2e9; --ink:#26221c; --ink2:#8a8377; --line:#d9d2c2; --barbg:#fffdf7;}
html{background:var(--paper);}
body{margin:0; touch-action:manipulation; background:var(--paper); color:var(--ink); font-family:'EBGaramond',Georgia,serif;}
[hidden]{display:none !important;}
.wrap{max-width:34em; margin:0 auto; padding:calc(env(safe-area-inset-top,0px) + 8px) 5vw 16vh;}
.no{font-family:-apple-system,'Helvetica Neue',sans-serif; font-size:11px; letter-spacing:.34em; color:var(--ink2); text-transform:uppercase;}
/* SCRATCH PAD is the header: centered on its own line at the VERY top (the
   old 5vh wrap padding left it stranded mid-page in the app — Sophie's
   screenshot). The buttons live on the title row below, right-aligned and
   stopping 56px short of the pill's corner, so nothing overlaps the word. */
/* The shelf button sits top-LEFT, where a back control normally lives —
   leaving a story feels like going back. */
header{display:block; text-align:center; padding:6px 0 0; position:relative;}
header #storiesbtn{position:absolute; left:0; top:2px;}
/* In the app the native nav bar already says STORY ROOM — never two titles
   (the Playground rule). Builds inject window.__nativeNavBar; the page
   answers with body.native: the eyebrow hides and the shelf button becomes a
   normal block so the header keeps its height instead of collapsing under
   the absolute-positioned button. Plain browsers keep the eyebrow. */
body.native header .no{display:none;}
body.native header #storiesbtn{position:static;}
/* The title row PINS to the top while she scrolls a long story, so film /
   play / add / inbox are always a thumb away (Sophie). Paper background so
   beats slide beneath it. Its z-index stays BELOW the pill's 9 (the house
   pattern — /writing and /editor sit at 5): at 30 the row's paper background
   painted over the autoscroll pill's top button. Full-screen overlays (sheet
   40, beatpop 50, lightbox 60, filmplay 70) stay ABOVE 9 — they are meant to
   cover the pill. */
.titlerow{display:flex; align-items:center; gap:10px; padding-right:56px; margin-top:.4em;
  position:sticky; top:0; z-index:5; background:var(--paper); padding-top:6px; padding-bottom:6px;}
.titlerow #title{flex:1; min-width:0; margin:0;}
.sheethead{display:flex; align-items:center; gap:10px; padding:6px 56px 0 0;}
.sheethead .no{flex:1;}
/* The shelf: every story as a row — its first picture, its name, how many
   beats. The one you're in is marked with a rule, not a label. */
#storylist{margin-top:1.2em;}
.srow{display:flex; align-items:center; gap:12px; width:100%; text-align:left; background:none;
  border:none; border-bottom:1px solid var(--line); padding:10px 0; cursor:pointer;
  font-family:'EBGaramond',Georgia,serif; color:var(--ink);}
.srow .sc{width:38px; height:57px; flex:none; border:1px solid var(--line); border-radius:4px;
  background:var(--barbg); object-fit:cover;}
.srow .sn{flex:1; min-width:0; font-size:1.15em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.srow .sn.blank{color:var(--ink2); font-style:italic;}
.srow .sb{font-size:.8em; color:var(--ink2); flex:none;}
.srow.cur .sn{font-weight:600;}
.iconbtn{width:34px; height:34px; flex:none; display:flex; align-items:center; justify-content:center;
  border:1px solid var(--line); border-radius:6px; background:var(--barbg); color:var(--ink); padding:0;}
.iconbtn svg{width:17px; height:17px;}
.state{font-style:italic; color:var(--ink2); text-align:center; padding:4em 1em; line-height:1.5;}
/* The story's name sits where the eyebrow used to — the normal serif, a
   touch bigger, "Untitled" until Sophie renames it (tap to edit). */
#title{font-size:1.45em; font-weight:600; line-height:1.15; margin:.45em 0 0; padding:2px 0; min-height:1.15em; outline:none;}
#title.blank{color:var(--ink2); font-style:italic; font-weight:400;}
/* Four to a row; incomplete rows CENTER (Sophie: the first beat lands in the
   middle of the top, not the left — flex + justify-content does exactly that,
   and a full row still fills the width). Rows top-align so a beat's caption
   below the tile never pushes its neighbours around. */
#pad{display:flex; flex-wrap:wrap; justify-content:center; align-items:flex-start; gap:16px 12px; margin-top:1.3em;}
.beatwrap{width:calc(25% - 9px); display:flex; flex-direction:column; gap:5px;}
.beat{position:relative; width:100%; aspect-ratio:2/3; border:1.5px solid var(--line); border-radius:4px;
  background:var(--barbg); padding:0; overflow:hidden; cursor:pointer;}
/* A blank beat whose picture is on its way breathes, so it reads as coming
   rather than broken (flat colors trading places — not a gradient). */
.beat.drawing{animation:spwait 1.5s ease-in-out infinite;}
@keyframes spwait{0%,100%{background:var(--barbg);}50%{background:var(--line);}}
/* The beat's words, small, under the tile — FIRST LINE only (the rest lives
   in the popup). Tap to hear them in her voice.
   MUST NOT be a <button>: WebKit gives buttons their own internal layout and
   ignores display:-webkit-box on them, so the line clamp silently did
   nothing and full paragraphs kept showing (Sophie caught it). A div clamps
   correctly. */
.bcap{font-size:.72em; line-height:1.3; color:var(--ink); background:none; border:none; padding:0;
  font-family:'EBGaramond',Georgia,serif; text-align:left; cursor:pointer; overflow-wrap:break-word;
  display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden;}
.bcap.busy{opacity:.45;}
.beat img{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block;}
.beat.c-mustard{border:3px solid var(--mustard);}
.beat.c-green{border:3px solid var(--green);}
.beat.c-blue{border:3px solid var(--blue);}
.beat.c-pink{border:3px solid var(--pink);}
/* A chunk: linked beats in ONE tile's width — side-by-side slices sharing a
   frame (and a color). Tapping a slice opens that member's popup. */
.chunk{display:flex; gap:1px; width:100%; aspect-ratio:2/3; border:1.5px solid var(--line); border-radius:4px;
  background:var(--barbg); overflow:hidden;}
.chunk.c-mustard{border:3px solid var(--mustard);} .chunk.c-green{border:3px solid var(--green);}
.chunk.c-blue{border:3px solid var(--blue);} .chunk.c-pink{border:3px solid var(--pink);}
.slice{position:relative; flex:1; min-width:0; background:var(--barbg); border:none; padding:0; cursor:pointer;}
.slice img{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block;}
/* A placement slot is a slim dashed LINE between beats (a full dashed tile
   per gap ate the whole row — Sophie). The button is 14px of tap target with
   the line drawn up its middle. */
/* A placement slot: a few short dashes centered vertically in the gap —
   an explicit height, because align-self:stretch collapsed to a dot in the
   wrapping flex row (Sophie saw a dot, not a line). */
.slot{position:relative; width:16px; height:120px; border:none; border-radius:0;
  background:none; padding:0; cursor:pointer;}
.slot::before{content:''; position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  height:48px; width:0; border-left:2px dashed var(--ink2);}
/* ── overlays ─────────────────────────────────────────────────────── */
.sheet{position:fixed; inset:0; background:var(--paper); z-index:40; overflow-y:auto; -webkit-overflow-scrolling:touch;}
.sheet .wrap{padding-top:3vh;}
#inboxgrid{display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:1.2em;}
#inboxgrid button{aspect-ratio:2/3; border:1px solid var(--line); border-radius:4px; background:var(--barbg);
  padding:0; overflow:hidden; cursor:pointer;}
#inboxgrid button img{width:100%; height:100%; object-fit:cover; display:block;}
#inboxgrid button.used{opacity:.35;}
#beatpop{position:fixed; inset:0; z-index:50; display:flex; flex-direction:column; align-items:center;
  justify-content:center; gap:20px; background:rgba(20,17,12,.82); padding:5vw;}
/* The art stays THUMBNAIL-sized in the popup (Sophie: the chosen art isn't
   big) — openBeat() copies the pad tile's pixel width onto it. */
#beatpop img{border:3px solid var(--line); border-radius:4px; background:var(--barbg); display:block; height:auto;}
#beatpop img.c-mustard{border-color:var(--mustard);} #beatpop img.c-green{border-color:var(--green);}
#beatpop img.c-blue{border-color:var(--blue);} #beatpop img.c-pink{border-color:var(--pink);}
.chips{display:flex; gap:16px;}
.chip{width:36px; height:36px; border-radius:50%; border:1.5px solid rgba(255,255,255,.55); padding:0; cursor:pointer;}
.chip.on{outline:2.5px solid #fff; outline-offset:3px;}
.chip.gray{background:#8a8377;} .chip.mustard{background:var(--mustard);}
.chip.green{background:var(--green);} .chip.blue{background:var(--blue);} .chip.pink{background:var(--pink);}
#pnote{width:min(80vw,22em); box-sizing:border-box; font-family:'EBGaramond',Georgia,serif; font-size:17px;
  line-height:1.4; color:var(--ink); background:var(--barbg); border:1px solid var(--line); border-radius:6px;
  padding:10px 12px; resize:none;}
.poprow{display:flex; gap:14px;}
#speak,#linkbtn,#micbtn,#delbtn{width:34px; height:34px; display:flex; align-items:center; justify-content:center; padding:0;
  border:1.5px solid rgba(255,255,255,.55); border-radius:6px; background:none; color:#fff; cursor:pointer;}
#speak svg,#linkbtn svg,#micbtn svg,#delbtn svg{width:17px; height:17px;}
/* Every generation this beat has had, all the same size, newest first; the
   one currently on the pad wears the dark ring. Tap one to see it big. */
#verrow{display:flex; flex-wrap:wrap; gap:6px; justify-content:center; max-width:88vw;}
#verrow button{width:44px; aspect-ratio:2/3; padding:0; border:1.5px solid rgba(255,255,255,.4); border-radius:4px;
  overflow:hidden; background:var(--barbg); cursor:pointer;}
#verrow button.cur{border:2.5px solid #fff;}
#verrow img{width:100%; height:100%; object-fit:cover; display:block;}
#delask{position:fixed; inset:0; z-index:55; display:flex; align-items:center; justify-content:center;
  background:rgba(20,17,12,.55); padding:24px;}
#speak.busy,#micbtn.busy{opacity:.45;}
/* Lit = this beat is part of a chunk (tap dissolves the whole chunk). */
#linkbtn.on{background:#fff; color:#26221c; border-color:#fff;}
/* Mic: lit = a recording exists (her reading is what plays); red = recording
   right now, tap again to stop. */
#micbtn.on{background:#fff; color:#26221c; border-color:#fff;}
#micbtn.rec{background:#c25a72; border-color:#c25a72; color:#fff;}
/* An empty beat's popup: the blank paper tile with two quiet icons in its
   middle — the Playground (make new art) and the inbox (pick from what's
   hearted, straight into THIS beat). */
#popblank{aspect-ratio:2/3; border:3px solid var(--line); border-radius:4px; background:var(--barbg);
  display:flex; align-items:center; justify-content:center; gap:14px; color:var(--ink2); padding:0;}
#popblank button{background:none; border:none; padding:4px; color:var(--ink2); cursor:pointer; display:flex;}
#popblank svg{width:24px; height:24px;}
/* The same two ways to art, ABOVE a beat that already has a picture — so it
   can be swapped for another (Sophie, Aug 2026). */
#artrow{display:flex; gap:14px; justify-content:center;}
#artrow button{background:none; border:1.5px solid rgba(255,255,255,.55); border-radius:6px; padding:6px 8px;
  color:#fff; cursor:pointer; display:flex;}
#artrow svg{width:17px; height:17px;}
/* Drawing right here: prompt (defaults to the beat's words), Sophie on/off,
   quality, Draw. The STYLE is never asked — one style per story. */
#drawbox{width:min(80vw,22em); display:flex; flex-direction:column; gap:8px;}
#dprompt{width:100%; box-sizing:border-box; font-family:'EBGaramond',Georgia,serif; font-size:16px;
  line-height:1.4; color:var(--ink); background:var(--barbg); border:1px solid var(--line);
  border-radius:6px; padding:10px 12px; resize:none;}
.drawrow{display:flex; align-items:center; gap:10px;}
#dchar{width:34px; height:34px; flex:none; padding:0; border:1.5px solid rgba(255,255,255,.55); border-radius:6px;
  overflow:hidden; background:none; opacity:.4; cursor:pointer;}
#dchar.on{opacity:1; border-color:#fff;}
#dchar img{width:100%; height:100%; object-fit:cover; display:block;}
#dq{font-family:-apple-system,sans-serif; font-size:16px; border:1.5px solid rgba(255,255,255,.55);
  border-radius:6px; background:none; color:#fff; padding:6px 8px;}
#dq option{color:#26221c;}
#dgo{margin-left:auto; font-family:'EBGaramond',Georgia,serif; font-size:16px; background:#fff; color:#26221c;
  border:none; border-radius:6px; padding:8px 18px; cursor:pointer;}
#dgo:disabled{opacity:.5;}
/* A beat being drawn (or a failed draw) says so on its own line. */
#genstate{color:#fff; font-style:italic; font-size:15px; text-align:center; max-width:80vw;}
/* Draw-the-missing confirm: what it will draw and what it will cost, before
   a cent is spent. Flat, 6px corners, no gradients. */
#bulkask{position:fixed; inset:0; z-index:55; display:flex; align-items:center; justify-content:center;
  background:rgba(20,17,12,.55); padding:24px;}
.bulkbox{background:var(--paper); border:1px solid var(--line); border-radius:6px; padding:18px;
  max-width:320px; width:100%; display:flex; flex-direction:column; gap:12px;}
.bulkbox p{font-size:1.05em; line-height:1.4; margin:0;}
#bq{font-family:-apple-system,sans-serif; font-size:16px; border:1px solid var(--line); border-radius:6px;
  background:var(--barbg); color:var(--ink); padding:7px 8px; align-self:flex-start;}
.bulkrow{display:flex; gap:8px;}
.bulkrow button{flex:1; border-radius:6px; padding:10px; font-family:'EBGaramond',Georgia,serif; font-size:16px;
  border:1px solid var(--line); background:var(--barbg); color:var(--ink); cursor:pointer;}
.bulkrow #bulkyes{background:var(--ink); color:var(--paper); border-color:var(--ink); font-weight:600;}
#popblank.c-mustard{border-color:var(--mustard);} #popblank.c-green{border-color:var(--green);}
#popblank.c-blue{border-color:var(--blue);} #popblank.c-pink{border-color:var(--pink);}
#lightbox{position:fixed; inset:0; z-index:60; display:flex; align-items:center; justify-content:center;
  background:rgba(20,17,12,.94); padding:3vw;}
#lightbox img{max-width:94vw; max-height:88vh; border-radius:4px;}
/* The film's buttons ride the title row; this line only appears while it's
   making (or if it failed). */
#filmrow{margin-top:.5em;}
.filmnote{font-size:.85em; font-style:italic; color:var(--ink2);}
#filmplay{position:fixed; inset:0; z-index:70; display:flex; align-items:center; justify-content:center;
  background:#000; padding:0;}
#filmplay video{max-width:100vw; max-height:100vh; background:#000;}
</style>
<div class="wrap">
  <header>
    <button class="iconbtn" id="storiesbtn" aria-label="Your stories"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg></button>
    <div class="no">Story room</div>
  </header>
  <div class="titlerow">
    <div id="title" contenteditable="true" spellcheck="false"></div>
    <button class="iconbtn" id="playbtn" hidden aria-label="Watch the film"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M6 4.5v15l13-7.5z"/></svg></button>
    <button class="iconbtn" id="drawallbtn" hidden aria-label="Draw every beat that has words but no picture"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg></button>
    <button class="iconbtn" id="addbtn" aria-label="Add an empty beat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg></button>
    <button class="iconbtn" id="inboxbtn" aria-label="Hearted in the Playground"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></button>
  </div>
  <div id="filmrow" hidden><span class="filmnote" id="filmnote"></span></div>
  <div id="pad"></div>
  <div class="state" id="empty" hidden>Empty page — the button top right opens what you hearted in the Playground.</div>
</div>

<div class="sheet" id="stories" hidden>
  <div class="wrap">
    <div class="sheethead">
      <button class="iconbtn" id="storiesclose" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
      <div class="no">Your stories</div>
      <button class="iconbtn" id="newstory" aria-label="Start a new story"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg></button>
    </div>
    <div id="storylist"></div>
  </div>
</div>

<div class="sheet" id="inbox" hidden>
  <div class="wrap">
    <div class="sheethead">
      <button class="iconbtn" id="inboxclose" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
      <div class="no">From the Playground</div>
    </div>
    <div id="inboxgrid"></div>
    <div class="state" id="inboxempty" hidden>Nothing hearted in the Playground yet.</div>
  </div>
</div>

<div id="beatpop" hidden>
  <div id="artrow" hidden>
    <button id="ardraw" aria-label="Draw it again here"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.287 1.288L3 12l5.8 1.9a2 2 0 0 1 1.288 1.287L12 21l1.9-5.8a2 2 0 0 1 1.287-1.288L21 12l-5.8-1.9a2 2 0 0 1-1.288-1.287z"/></svg></button>
    <button id="arplay" aria-label="Make different art in the Playground"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg></button>
    <button id="arinbox" aria-label="Swap in a picture from the inbox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></button>
  </div>
  <img id="popimg" alt="">
  <div id="verrow" hidden></div>
  <div id="popblank" hidden>
    <button id="pbdraw" aria-label="Draw it here"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.287 1.288L3 12l5.8 1.9a2 2 0 0 1 1.288 1.287L12 21l1.9-5.8a2 2 0 0 1 1.287-1.288L21 12l-5.8-1.9a2 2 0 0 1-1.288-1.287z"/></svg></button>
    <button id="pbplay" aria-label="Make its art in the Playground"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg></button>
    <button id="pbinbox" aria-label="Pick from the inbox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></button>
  </div>
  <div class="chips">
    <button class="chip gray" data-c=""></button>
    <button class="chip mustard" data-c="mustard"></button>
    <button class="chip green" data-c="green"></button>
    <button class="chip blue" data-c="blue"></button>
    <button class="chip pink" data-c="pink"></button>
  </div>
  <div id="genstate" hidden></div>
  <div id="drawbox" hidden>
    <textarea id="dprompt" rows="3" placeholder="what to draw"></textarea>
    <div class="drawrow">
      <button id="dchar" class="on" aria-label="Draw Sophie from her reference"><img src="/scratchpad-sophie.png" alt="Sophie"></button>
      <select id="dq" aria-label="Quality"><option value="low">low</option><option value="medium" selected>medium</option><option value="high">high</option></select>
      <button id="dgo">Draw</button>
    </div>
  </div>
  <textarea id="pnote" rows="3"></textarea>
  <div class="poprow">
    <button id="speak" aria-label="Hear it in your voice"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/></svg></button>
    <button id="micbtn" aria-label="Record yourself reading it"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg></button>
    <button id="linkbtn" hidden aria-label="Link with the next beat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>
    <button id="unlinkbtn" hidden aria-label="Break this chunk apart"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="m5.17 11.75-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="8" x2="8" y1="2" y2="5"/><line x1="2" x2="5" y1="8" y2="8"/><line x1="16" x2="16" y1="19" y2="22"/><line x1="19" x2="22" y1="16" y2="16"/></svg></button>
    <button id="delbtn" aria-label="Delete this beat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg></button>
  </div>
</div>

<div id="lightbox" hidden><img id="lbimg" alt=""></div>

<div id="delask" hidden>
  <div class="bulkbox">
    <p>Delete this beat? Its pictures are already saved in your galleries.</p>
    <div class="bulkrow">
      <button id="delno">Not now</button>
      <button id="delyes">Delete it</button>
    </div>
  </div>
</div>

<div id="bulkask" hidden>
  <div class="bulkbox">
    <p id="bulkline"></p>
    <select id="bq" aria-label="Quality"><option value="low" selected>low</option><option value="medium">medium</option><option value="high">high</option></select>
    <div class="bulkrow">
      <button id="bulkno">Not now</button>
      <button id="bulkyes">Draw them</button>
    </div>
  </div>
</div>
<div id="filmplay" hidden><video id="filmvid" controls playsinline></video></div>

<script>
var TOKEN='__STUDIO_TOKEN__';
/* Which story is open. Remembered per device, so the pad reopens where she
   left it; every request carries it (query for GETs, body for POSTs). */
var padId=localStorage.getItem('scratchpad_pad')||'pad';
function api(p,opts){
  opts=opts||{};opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});
  if(TOKEN)opts.headers['x-studio-token']=TOKEN;
  if(opts.body){
    try{var b=JSON.parse(opts.body); if(b.pad===undefined){b.pad=padId; opts.body=JSON.stringify(b);}}catch(e){}
    if(p!=='/film'&&p.indexOf('/pads')!==0&&p!=='/tts') dirtySinceFilm=true;
  } else if(p.indexOf('/pads')!==0){
    p+=(p.indexOf('?')>=0?'&':'?')+'pad='+encodeURIComponent(padId);
  }
  return fetch('/api/scratchpad'+p,opts);
}
var beats=[], inboxItems=[], pending=null, popBeat=null, padTitle='';
var player=new Audio();

function lock(v){document.body.style.overflow=v?'hidden':'';}

/* One shared player so a new tap replaces what's speaking, never stacks.
   Her OWN recording of the line (the popup's mic) always wins over TTS. */
function speakBeat(b, el){
  if(b.voiceUrl){ player.pause(); player.src=b.voiceUrl; player.play(); return; }
  if(el)el.classList.add('busy');
  api('/tts',{method:'POST',body:JSON.stringify({id:b.id})})
    .then(function(r){return r.json()})
    .then(function(d){
      if(el)el.classList.remove('busy');
      if(!d.url)return;
      b.ttsUrl=d.url;
      player.pause(); player.src=d.url; player.play();
    })
    .catch(function(){ if(el)el.classList.remove('busy'); });
}

/* ── the mic: record her reading the line; that becomes the beat's audio ── */
var recorder=null, recStream=null;
function stopRec(){
  if(recorder&&recorder.state!=='inactive')recorder.stop();
}
document.getElementById('micbtn').onclick=function(ev){
  ev.stopPropagation();
  var btn=this, b=popBeat; if(!b)return;
  if(recorder&&recorder.state==='recording'){ stopRec(); return; }
  saveNote();
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
    recStream=stream;
    var mime='';
    ['audio/mp4','audio/webm'].forEach(function(m){ if(!mime&&window.MediaRecorder&&MediaRecorder.isTypeSupported(m)) mime=m; });
    recorder=new MediaRecorder(stream, mime?{mimeType:mime}:undefined);
    var chunks=[];
    recorder.ondataavailable=function(e){ if(e.data&&e.data.size)chunks.push(e.data); };
    recorder.onstop=function(){
      recStream.getTracks().forEach(function(t){t.stop();});
      btn.classList.remove('rec'); btn.classList.add('busy');
      // Strip any ";codecs=…" — the server keys on the base mime.
      var baseMime=(recorder.mimeType||'audio/mp4').split(';')[0]||'audio/mp4';
      var blob=new Blob(chunks,{type:baseMime});
      var fr=new FileReader();
      fr.onload=function(){
        api('/voice',{method:'POST',body:JSON.stringify({id:b.id,audio:fr.result})})
          .then(function(r){return r.json()})
          .then(function(d){
            btn.classList.remove('busy');
            if(d.error){ alert('Recording didn’t save: '+d.error); return; }
            if(d.beats){ beats=d.beats; render(); }
            var fresh=beats.find(function(x){return x.id===b.id;});
            if(fresh&&popBeat&&popBeat.id===b.id){ popBeat=fresh; btn.classList.toggle('on',Boolean(fresh.voiceUrl)); }
            if(d.url){ player.pause(); player.src=d.url; player.play(); }
          })
          .catch(function(){ btn.classList.remove('busy'); alert('Recording didn’t save — network hiccup. Try again.'); });
      };
      fr.readAsDataURL(blob);
    };
    recorder.start();
    btn.classList.add('rec');
  }).catch(function(){
    alert('The microphone is not available here.');
  });
};

/* The pad renders UNITS: a lone beat, or a CHUNK — contiguous beats sharing
   a chunk id, drawn in one tile's width as side-by-side slices in a shared
   frame. Slots (and placement) happen between units, never inside one. */
function padUnits(){
  var units=[], i=0;
  while(i<beats.length){
    var b=beats[i], members=[b];
    if(b.chunk){ while(i+members.length<beats.length && beats[i+members.length].chunk===b.chunk) members.push(beats[i+members.length]); }
    units.push({members:members, at:i});
    i+=members.length;
  }
  return units;
}
function capFor(wrap, b){
  if(!b.text)return;
  var cap=document.createElement('div'); cap.className='bcap'; cap.textContent=b.text;
  cap.onclick=function(ev){ev.stopPropagation(); if(pending)return; speakBeat(b, cap);};
  wrap.appendChild(cap);
}
function render(){
  var pad=document.getElementById('pad'); pad.innerHTML='';
  document.getElementById('empty').hidden=Boolean(beats.length||pending);
  function slot(at){
    var s=document.createElement('button'); s.className='slot'; s.setAttribute('aria-label','Place here');
    s.onclick=function(ev){ev.stopPropagation(); place(at);};
    pad.appendChild(s);
  }
  var units=padUnits();
  units.forEach(function(u){
    if(pending) slot(u.at);
    var wrap=document.createElement('div'); wrap.className='beatwrap';
    if(u.members.length===1){
      var b=u.members[0];
      var el=document.createElement('button');
      el.className='beat'+(b.color?' c-'+b.color:'')+((b.gen&&b.gen.status==='drawing')?' drawing':'');
      if(b.url){ var im=document.createElement('img'); im.src=b.url; im.alt=''; el.appendChild(im); }
      el.onclick=function(ev){ev.stopPropagation(); if(pending)return; openBeat(b);};
      wrap.appendChild(el);
      capFor(wrap, b);
    } else {
      var ck=document.createElement('div'); ck.className='chunk'+(u.members[0].color?' c-'+u.members[0].color:'');
      u.members.forEach(function(m){
        var sl=document.createElement('button'); sl.className='slice';
        if(m.url){ var mi=document.createElement('img'); mi.src=m.url; mi.alt=''; sl.appendChild(mi); }
        sl.onclick=function(ev){ev.stopPropagation(); if(pending)return; openBeat(m);};
        ck.appendChild(sl);
      });
      wrap.appendChild(ck);
      capFor(wrap, u.members[0]);
    }
    pad.appendChild(wrap);
  });
  if(pending&&beats.length) slot(beats.length);
  renderDrawall();
}

function renderTitle(){
  var t=document.getElementById('title');
  if(document.activeElement===t)return;
  t.textContent=padTitle||'Untitled';
  t.className=padTitle?'':'blank';
}
(function(){
  var t=document.getElementById('title');
  t.onfocus=function(){ if(!padTitle){t.textContent=''; t.className='';} };
  t.onblur=function(){
    var v=t.textContent.replace(/\n/g,' ').trim().slice(0,200);
    if(v!==padTitle){
      padTitle=v;
      api('/title',{method:'POST',body:JSON.stringify({title:v})});
    }
    renderTitle();
  };
  t.onkeydown=function(ev){ if(ev.key==='Enter'){ev.preventDefault(); t.blur();} };
})();

/* ── the film: ONE button that always means "watch my film" ────────
   Up-to-date film → plays. Missing or stale (the story was touched after
   the render) → the tap renders first, then auto-plays when it lands if
   she's still here. A failed render re-arms the button — the backend keeps
   remaking possible always (failed state + the stuck-job sweep). */
var film=null, padUpdated=0, dirtySinceFilm=false, autoplayWanted=false;
function filmFresh(){
  // Server-clock to server-clock only — never compare against the phone's.
  return Boolean(film&&film.url&&film.status==='done'&&!dirtySinceFilm&&(film.at||0)>=(padUpdated-2500));
}
function renderFilm(){
  var note=document.getElementById('filmnote');
  var play=document.getElementById('playbtn');
  var making=Boolean(film&&film.status==='making');
  play.hidden=!beats.some(function(b){return b.url;});
  play.disabled=making;
  play.style.opacity=making?'.45':'';
  var msg=making?('making the film… '+(film.progress||''))
    :(film&&film.status==='failed'?(film.error||'the film failed'):'');
  note.textContent=msg;
  document.getElementById('filmrow').hidden=!msg;
}
function playFilm(){
  if(!film||!film.url)return;
  var v=document.getElementById('filmvid');
  v.src=film.url;
  document.getElementById('filmplay').hidden=false; lock(true);
  window.__scrollStop&&window.__scrollStop();
  v.play();
}
document.getElementById('playbtn').onclick=function(ev){
  ev.stopPropagation();
  if(film&&film.status==='making')return;
  if(filmFresh()){ playFilm(); return; }
  autoplayWanted=true;
  film=Object.assign({},film,{status:'making',progress:''}); renderFilm();
  api('/film',{method:'POST',body:JSON.stringify({})})
    .then(function(r){return r.json()})
    .then(function(d){
      if(d.error){ film={status:'failed',error:d.error}; renderFilm(); return; }
      startFilmPoll();
    })
    .catch(function(){ film={status:'failed',error:'could not start'}; renderFilm(); });
};
document.getElementById('filmplay').onclick=function(ev){
  if(ev.target===this){
    var v=document.getElementById('filmvid'); v.pause();
    this.hidden=true; lock(false);
  }
};
/* ── draw the missing pictures: count → cost → are you sure → go ──── */
var BULK_PRICE={low:2, medium:6, high:25};   // ¢ per picture, gpt-image-2
function stripSpeech(t){
  return String(t||'').replace(/<break[^>]*>/gi,' ').replace(/\[[^\]\n]{1,40}\]/g,' ').replace(/\s+/g,' ').trim();
}
function drawables(){
  return beats.filter(function(b){ return !b.url && !(b.gen&&b.gen.status==='drawing') && stripSpeech(b.text); });
}
function renderDrawall(){
  document.getElementById('drawallbtn').hidden=!drawables().length;
}
function bulkLine(){
  var n=drawables().length;
  var cents=n*BULK_PRICE[document.getElementById('bq').value];
  var cost=cents>=100?('$'+(cents/100).toFixed(2)):(cents+'¢');
  document.getElementById('bulkline').textContent=
    'Draw '+n+(n===1?' picture':' pictures')+' · about '+cost+'. Sure?';
}
document.getElementById('drawallbtn').onclick=function(ev){
  ev.stopPropagation();
  if(!drawables().length)return;
  bulkLine();
  document.getElementById('bulkask').hidden=false; lock(true);
};
document.getElementById('bq').onchange=bulkLine;
document.getElementById('bulkno').onclick=function(ev){
  ev.stopPropagation();
  document.getElementById('bulkask').hidden=true; lock(false);
};
document.getElementById('bulkask').onclick=function(ev){ if(ev.target===this){this.hidden=true; lock(false);} };
document.getElementById('bulkyes').onclick=function(ev){
  ev.stopPropagation();
  var btn=this; btn.disabled=true;
  api('/drawall',{method:'POST',body:JSON.stringify({quality:document.getElementById('bq').value})})
    .then(function(r){return r.json()})
    .then(function(d){
      btn.disabled=false;
      document.getElementById('bulkask').hidden=true; lock(false);
      if(d.error){ alert(d.error); return; }
      if(d.beats){ beats=d.beats; render(); }
      startGenPoll();
    })
    .catch(function(){ btn.disabled=false; });
};

/* Rendering is a background job — poll the pad, and resume on return. */
var filmTimer=null;
function startFilmPoll(){
  if(filmTimer)return;
  filmTimer=setInterval(function(){
    api('').then(function(r){return r.json()}).then(function(d){
      film=d.film||null; padUpdated=d.updatedAt||padUpdated; renderFilm();
      if(!film||film.status!=='making'){
        clearInterval(filmTimer); filmTimer=null;
        if(film&&film.status==='done'){
          dirtySinceFilm=false;
          if(autoplayWanted){ autoplayWanted=false; playFilm(); }
        }
      }
    }).catch(function(){});
  },5000);
}

function load(){
  api('').then(function(r){return r.json()}).then(function(d){
    beats=d.beats||[]; padTitle=d.title||''; film=d.film||null;
    padUpdated=d.updatedAt||0; dirtySinceFilm=false;
    renderTitle(); render(); renderFilm();
    if(anyDrawing()) startGenPoll();   // a draw survives leaving the app
    if(film&&film.status==='making') startFilmPoll();
  });
}

/* ── the shelf: every story, newest-touched first ─────────────────── */
document.getElementById('storiesbtn').onclick=function(ev){
  ev.stopPropagation();
  document.getElementById('stories').hidden=false; lock(true);
  api('/pads').then(function(r){return r.json()}).then(function(d){
    var list=document.getElementById('storylist'); list.innerHTML='';
    (d.pads||[]).forEach(function(p){
      var row=document.createElement('button'); row.className='srow'+(p.id===padId?' cur':'');
      var cov;
      if(p.cover){ cov=document.createElement('img'); cov.src=p.cover; cov.alt=''; cov.loading='lazy'; }
      else { cov=document.createElement('div'); }
      cov.className='sc'; row.appendChild(cov);
      var nm=document.createElement('div'); nm.className='sn'+(p.title?'':' blank');
      nm.textContent=p.title||'Untitled'; row.appendChild(nm);
      var ct=document.createElement('div'); ct.className='sb';
      ct.textContent=p.beats+(p.beats===1?' beat':' beats'); row.appendChild(ct);
      row.onclick=function(e){ e.stopPropagation(); openPad(p.id); };
      list.appendChild(row);
    });
  });
};
document.getElementById('storiesclose').onclick=function(ev){
  ev.stopPropagation();
  document.getElementById('stories').hidden=true; lock(false);
};
function openPad(id){
  padId=id; localStorage.setItem('scratchpad_pad',id);
  if(genTimer){ clearInterval(genTimer); genTimer=null; }
  if(filmTimer){ clearInterval(filmTimer); filmTimer=null; }
  film=null; padUpdated=0; dirtySinceFilm=false; autoplayWanted=false; renderFilm();
  document.getElementById('stories').hidden=true; lock(false);
  beats=[]; padTitle=''; render();
  load();
}
document.getElementById('newstory').onclick=function(ev){
  ev.stopPropagation();
  api('/pads',{method:'POST',body:JSON.stringify({pad:null,title:''})})
    .then(function(r){return r.json()})
    .then(function(d){ if(d.pad) openPad(d.pad); });
};

/* ── the inbox: hearted Playground images, 4 to a row ──────────────
   Two ways in: the header button (pick → place on the pad) and the empty
   beat popup's inbox icon (fillBeat set → the choice becomes THAT beat's
   art, no placement step). */
var fillBeat=null;
function openInbox(){
  document.getElementById('inbox').hidden=false; lock(true);
  api('/inbox').then(function(r){return r.json()}).then(function(d){
    inboxItems=d.items||[];
    var g=document.getElementById('inboxgrid'); g.innerHTML='';
    document.getElementById('inboxempty').hidden=Boolean(inboxItems.length);
    var onPad={}; beats.forEach(function(b){onPad[b.url]=1;});
    inboxItems.forEach(function(it){
      var el=document.createElement('button'); if(onPad[it.url])el.className='used';
      var im=document.createElement('img'); im.src=it.url; im.alt=''; im.loading='lazy'; el.appendChild(im);
      // stopPropagation matters: this click must not reach the document-level
      // cancel handler, which would clear the placing mode it just started.
      el.onclick=function(ev){ev.stopPropagation(); pick(it);};
      g.appendChild(el);
    });
  });
}
document.getElementById('inboxbtn').onclick=function(){ fillBeat=null; openInbox(); };
document.getElementById('inboxclose').onclick=function(){
  document.getElementById('inbox').hidden=true;
  if(fillBeat){ var b=fillBeat; fillBeat=null; openBeat(b); return; }
  lock(false);
};

function pick(it){
  document.getElementById('inbox').hidden=true;
  if(fillBeat){
    var target=fillBeat; fillBeat=null;
    var src={runId:it.runId,i:it.i,prompt:it.prompt,model:it.model,engine:it.engine,quality:it.quality};
    api('/image',{method:'POST',body:JSON.stringify({id:target.id,url:it.url,src:src})})
      .then(function(r){return r.json()})
      .then(function(d){
        if(d.beats){ beats=d.beats; render(); }
        var fresh=beats.find(function(x){return x.id===target.id;});
        if(fresh) openBeat(fresh); else lock(false);
      });
    return;
  }
  lock(false);
  if(!beats.length){ place(0, it); return; }
  pending=it; render();
}
function place(at, it){
  it=it||pending; if(!it)return; pending=null;
  var body={at:at};
  if(!it.empty){
    body.url=it.url;
    body.src={runId:it.runId,i:it.i,prompt:it.prompt,model:it.model,engine:it.engine,quality:it.quality};
  }
  api('/add',{method:'POST',body:JSON.stringify(body)})
    .then(function(r){return r.json()})
    .then(function(d){if(d.beats)beats=d.beats;render();});
  render();
}
/* + adds an EMPTY beat — a blank tile whose art comes later (its popup has
   the Playground shortcut for now). Same placement flow as the inbox. */
document.getElementById('addbtn').onclick=function(ev){
  ev.stopPropagation();
  if(!beats.length){ place(0, {empty:true}); return; }
  pending={empty:true}; render();
};
/* tapping anywhere that is not a slot quietly cancels placing */
document.addEventListener('click',function(){ if(pending){pending=null;render();} });

/* ── the beat popup: the art at THUMBNAIL size, frame color, text ─── */
function openBeat(b){
  popBeat=b;
  var im=document.getElementById('popimg'), bl=document.getElementById('popblank');
  // Same size as it sits on the pad — the popup never blows the art up.
  var tile=document.querySelector('#pad .beat');
  var w=(tile?tile.offsetWidth:90)+'px';
  im.hidden=!b.url; bl.hidden=Boolean(b.url);
  bl.style.width=w;
  if(b.url){ im.style.width=w; im.src=b.url; im.className=b.color?'c-'+b.color:''; }
  else { bl.className=b.color?'c-'+b.color:''; }
  document.querySelectorAll('.chip').forEach(function(c){
    c.classList.toggle('on',(c.getAttribute('data-c')||null)===(b.color||null));
  });
  document.getElementById('pnote').value=b.text||'';
  // Every generation this beat has had — thumbnails, newest first, current
  // ringed. Only shows once there is more than the current picture.
  var vr=document.getElementById('verrow'); vr.innerHTML='';
  var vers=(b.url?[b.url]:[]).concat((b.imageHistory||[]).slice().reverse().map(function(h){return h.url;}).filter(Boolean));
  vr.hidden=vers.length<2;
  if(vers.length>1){
    vers.forEach(function(u,i){
      var t=document.createElement('button'); if(i===0&&b.url)t.className='cur';
      var ti=document.createElement('img'); ti.src=u; ti.alt=''; ti.loading='lazy'; t.appendChild(ti);
      t.onclick=function(ev){
        ev.stopPropagation();
        document.getElementById('lbimg').src=u;
        document.getElementById('lightbox').hidden=false;
      };
      vr.appendChild(t);
    });
  }
  // Two separate icons so a chunk can grow past two: link = add the NEXT
  // unit to this one (tap again and again for 3, 4, n), unlink = break the
  // whole chunk apart. One button that meant both made chains impossible.
  var lb=document.getElementById('linkbtn'), ub=document.getElementById('unlinkbtn');
  var units=padUnits();
  var myUnit=-1; units.forEach(function(u,ui){ if(u.members.indexOf(b)>=0) myUnit=ui; });
  lb.hidden=!(myUnit>=0 && myUnit<units.length-1);
  ub.hidden=!b.chunk;
  // The two ways to (re)make art: above the picture when there is one, in
  // the blank tile when there isn't.
  document.getElementById('artrow').hidden=!b.url;
  // Drawing here: the prompt starts as the beat's own words.
  var db_=document.getElementById('drawbox');
  db_.hidden=true;
  document.getElementById('dprompt').value=b.text||'';
  // Drawing (or a failure) is said in its own line — never by rewriting the
  // blank tile, whose children are the buttons.
  var st=document.getElementById('genstate');
  var drawing=Boolean(b.gen&&b.gen.status==='drawing');
  st.hidden=!(drawing||(b.gen&&b.gen.status==='failed'));
  st.textContent=drawing?'drawing…':((b.gen&&b.gen.error)||'');
  if(drawing){ document.getElementById('artrow').hidden=true; bl.hidden=false; }
  var mb=document.getElementById('micbtn');
  mb.classList.remove('rec','busy');
  mb.classList.toggle('on',Boolean(b.voiceUrl));
  document.getElementById('beatpop').hidden=false; lock(true);
}
function chunkAction(pathname){
  var b=popBeat; if(!b)return;
  saveNote();
  api(pathname,{method:'POST',body:JSON.stringify({id:b.id})})
    .then(function(r){return r.json()})
    .then(function(d){
      if(d.beats){ beats=d.beats; render(); }
      var fresh=beats.find(function(x){return x.id===b.id;});
      if(fresh){ popBeat=fresh; openBeat(fresh); }
    });
}
document.getElementById('linkbtn').onclick=function(ev){ ev.stopPropagation(); chunkAction('/chunk'); };
document.getElementById('unlinkbtn').onclick=function(ev){ ev.stopPropagation(); chunkAction('/unchunk'); };

/* ── drawing a beat's art right here ──────────────────────────────── */
function openDraw(ev){
  ev.stopPropagation();
  if(!popBeat)return;
  var box=document.getElementById('drawbox');
  box.hidden=!box.hidden;
  if(!box.hidden){
    // The prompt starts as whatever the text box says RIGHT NOW — not the
    // beat's last SAVED text. Words typed seconds ago aren't saved until the
    // popup closes, and the stale prefill was drawing the old line (Sophie:
    // "it doesn't take the words I put in").
    var live=document.getElementById('pnote').value.trim();
    document.getElementById('dprompt').value=live||(popBeat.text||'');
    saveNote();
    document.getElementById('dprompt').focus();
  }
}
document.getElementById('pbdraw').onclick=openDraw;
document.getElementById('ardraw').onclick=openDraw;
document.getElementById('drawbox').onclick=function(ev){ev.stopPropagation();};
document.getElementById('dchar').onclick=function(ev){
  ev.stopPropagation();
  this.classList.toggle('on');
};
document.getElementById('dgo').onclick=function(ev){
  ev.stopPropagation();
  var b=popBeat; if(!b)return;
  var prompt=document.getElementById('dprompt').value.trim();
  if(!prompt){ document.getElementById('dprompt').focus(); return; }
  var btn=this; btn.disabled=true;
  saveNote();
  api('/generate',{method:'POST',body:JSON.stringify({
    id:b.id, prompt:prompt,
    quality:document.getElementById('dq').value,
    character:document.getElementById('dchar').classList.contains('on'),
  })}).then(function(r){return r.json()}).then(function(d){
    btn.disabled=false;
    if(d.error){ alert(d.error); return; }
    if(d.beats){ beats=d.beats; render(); }
    var fresh=beats.find(function(x){return x.id===b.id;});
    if(fresh){ popBeat=fresh; openBeat(fresh); }
    startGenPoll();
  }).catch(function(){ btn.disabled=false; });
};
/* A draw is a background job: poll the pad while any beat is drawing, and
   resume that poll on return, so leaving the app never loses a picture. */
var genTimer=null;
function anyDrawing(){ return beats.some(function(b){ return b.gen&&b.gen.status==='drawing'; }); }
function startGenPoll(){
  if(genTimer)return;
  genTimer=setInterval(function(){
    if(!anyDrawing()){ clearInterval(genTimer); genTimer=null; return; }
    api('').then(function(r){return r.json()}).then(function(d){
      beats=d.beats||beats; render();
      if(popBeat){
        var fresh=beats.find(function(x){return x.id===popBeat.id;});
        if(fresh&&(!fresh.gen||fresh.gen.status!=='drawing')&&popBeat.gen&&popBeat.gen.status==='drawing'){
          popBeat=fresh; openBeat(fresh);
        } else if(fresh){ popBeat=fresh; }
      }
    }).catch(function(){});
  },4000);
}
/* The blank tile's two icons: make new art in the Playground, or pick from
   the inbox straight into THIS beat. */
document.getElementById('pbplay').onclick=function(ev){
  ev.stopPropagation();
  location.href='/playground?from=scratchpad';
};
function inboxIntoBeat(ev){
  ev.stopPropagation();
  if(!popBeat)return;
  saveNote();
  fillBeat=popBeat;
  document.getElementById('beatpop').hidden=true; popBeat=null;
  openInbox();
}
document.getElementById('pbinbox').onclick=inboxIntoBeat;
document.getElementById('arinbox').onclick=inboxIntoBeat;
document.getElementById('arplay').onclick=function(ev){
  ev.stopPropagation();
  location.href='/playground?from=scratchpad';
};
/* A chip sets the frame color and the popup STAYS open (there's a text box
   here now); tapping the scrim is what closes it. */
document.querySelectorAll('.chip').forEach(function(c){
  c.onclick=function(ev){
    ev.stopPropagation();
    var col=c.getAttribute('data-c')||null;
    if(!popBeat)return;
    popBeat.color=col;
    document.getElementById(popBeat.url?'popimg':'popblank').className=col?'c-'+col:'';
    document.querySelectorAll('.chip').forEach(function(x){
      x.classList.toggle('on',(x.getAttribute('data-c')||null)===col);
    });
    api('/color',{method:'POST',body:JSON.stringify({id:popBeat.id,color:col})})
      .then(function(r){return r.json()})
      .then(function(d){if(d.beats)beats=d.beats;});
  };
});
document.getElementById('pnote').onclick=function(ev){ev.stopPropagation();};
/* Returns a promise so the speech icon can wait for a fresh note to land
   server-side before asking for its audio. */
function saveNote(){
  if(!popBeat)return Promise.resolve();
  var t=document.getElementById('pnote').value;
  if(t===(popBeat.text||''))return Promise.resolve();
  popBeat.text=t;
  return api('/text',{method:'POST',body:JSON.stringify({id:popBeat.id,text:t})})
    .then(function(r){return r.json()})
    .then(function(d){if(d.beats){
      var keep=popBeat; beats=d.beats; popBeat=beats.find(function(x){return x.id===keep.id;})||keep;
    }});
}
/* The speech icon: her words in her voice ("Sophie — morning"). Saves the
   note first so what plays is what's written. */
document.getElementById('speak').onclick=function(ev){
  ev.stopPropagation();
  var btn=this, b=popBeat; if(!b)return;
  btn.classList.add('busy');
  saveNote().then(function(){ speakBeat(b, btn); });
};
/* Tapping the thumbnail opens it big — a lightbox over the popup. */
document.getElementById('popimg').onclick=function(ev){
  ev.stopPropagation();
  if(!popBeat)return;
  document.getElementById('lbimg').src=popBeat.url;
  document.getElementById('lightbox').hidden=false;
};
document.getElementById('lightbox').onclick=function(ev){
  ev.stopPropagation();
  this.hidden=true;
};
/* Delete, behind an are-you-sure. The beat leaves the pad; its pictures are
   already in Storage and My Creations, and its record moves to pad.trash. */
document.getElementById('delbtn').onclick=function(ev){
  ev.stopPropagation();
  if(!popBeat)return;
  document.getElementById('delask').hidden=false;
};
document.getElementById('delno').onclick=function(ev){ ev.stopPropagation(); document.getElementById('delask').hidden=true; };
document.getElementById('delask').onclick=function(ev){ if(ev.target===this)this.hidden=true; };
document.getElementById('delyes').onclick=function(ev){
  ev.stopPropagation();
  var b=popBeat; if(!b)return;
  var btn=this; btn.disabled=true;
  api('/remove',{method:'POST',body:JSON.stringify({id:b.id})})
    .then(function(r){return r.json()})
    .then(function(d){
      btn.disabled=false;
      document.getElementById('delask').hidden=true;
      if(d.error){ alert(d.error); return; }
      if(d.beats)beats=d.beats;
      document.getElementById('beatpop').hidden=true; popBeat=null; lock(false); render();
    })
    .catch(function(){ btn.disabled=false; });
};

function closeBeat(){stopRec(); saveNote(); document.getElementById('beatpop').hidden=true; popBeat=null; lock(false); render();}
document.getElementById('beatpop').onclick=function(ev){ if(ev.target===this)closeBeat(); };

/* ── the app's native nav bar ──────────────────────────────────────────
   Builds inject window.__nativeNavBar before the page runs. body.native
   hides the page's own STORY ROOM eyebrow (the native bar already says it —
   a double header shipped for real, Sophie's screenshot, Aug 2026). The
   chevron asks __navBack first: close the topmost open layer — film,
   lightbox, a confirm box, the beat popup, a sheet — each through its own
   close path so nothing skips its cleanup (closeBeat saves the note, the
   inbox returns to the beat it was filling). Only a bare pad answers false,
   and the app leaves the tool. */
if(window.__nativeNavBar) document.body.classList.add('native');
window.__navBack=function(){
  var el=document.getElementById('filmplay');
  if(!el.hidden){ document.getElementById('filmvid').pause(); el.hidden=true; lock(false); return true; }
  el=document.getElementById('lightbox');
  if(!el.hidden){ el.hidden=true; return true; }
  el=document.getElementById('delask');
  if(!el.hidden){ el.hidden=true; return true; }
  el=document.getElementById('bulkask');
  if(!el.hidden){ el.hidden=true; lock(false); return true; }
  el=document.getElementById('beatpop');
  if(!el.hidden){ closeBeat(); return true; }
  el=document.getElementById('inbox');
  if(!el.hidden){
    el.hidden=true;
    if(fillBeat){ var b=fillBeat; fillBeat=null; openBeat(b); } else lock(false);
    return true;
  }
  el=document.getElementById('stories');
  if(!el.hidden){ el.hidden=true; lock(false); return true; }
  return false;
};

load();
</script>
"""

out = os.path.join(ROOT, 'public', 'scratchpad.html')
open(out, 'w').write(page.replace('__FONT__', font))
print('built public/scratchpad.html', round(len(page) / 1024), 'KB (+font)')
