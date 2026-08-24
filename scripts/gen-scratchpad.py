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

# THE generate glyph, app-wide: the hand-fitted star the witch app draws from
# its own STAR const (public/witch.html) — an exact bezier match of SF Symbols
# `sparkles`. Anything that makes a picture with AI uses this, not a Lucide
# sparkle, so "this button spends a model call" reads the same everywhere.
ICON_STAR = r"""<svg viewBox="0 0 100 100" fill="currentColor" stroke="none"><path d="M 55.8 31.9C52.8 32.3 53.9 36.4 53.2 38.5C52.5 44.4 52.0 51.0 47.3 55.3C42.9 59.9 36.4 60.6 30.4 61.3C28.2 61.9 24.2 60.8 23.9 64.0C24.4 67.0 28.4 65.9 30.6 66.6C36.5 67.4 43.0 68.0 47.3 72.6C52.0 76.9 52.5 83.5 53.3 89.4C54.0 91.5 52.7 95.5 55.8 95.9C59.0 95.6 57.9 91.6 58.5 89.4C59.4 83.5 60.0 76.9 64.6 72.6C68.8 68.0 75.4 67.3 81.2 66.5C83.4 65.8 87.4 67.0 87.9 64.0C87.7 60.8 83.6 61.9 81.5 61.2C75.5 60.5 68.9 59.9 64.6 55.2C59.9 51.0 59.3 44.5 58.5 38.5C57.9 36.4 59.0 32.2 55.8 31.9Z"/><path d="M 25.8 21.9C24.5 22.2 25.1 23.9 24.7 24.8C24.4 27.4 24.3 30.3 22.3 32.2C20.4 34.3 17.4 34.4 14.8 34.7C13.9 35.0 12.2 34.5 11.9 35.8C12.0 37.2 13.9 36.8 14.8 37.0C17.4 37.4 20.4 37.4 22.3 39.5C24.3 41.4 24.4 44.3 24.7 46.9C25.0 47.9 24.5 49.6 25.8 49.9C27.2 49.8 26.8 48.0 27.0 47.1C27.4 44.4 27.4 41.4 29.6 39.5C31.5 37.4 34.5 37.4 37.1 37.0C38.0 36.8 39.8 37.2 39.9 35.8C39.6 34.5 37.9 35.0 36.9 34.7C34.3 34.4 31.4 34.3 29.5 32.3C27.4 30.4 27.4 27.4 27.0 24.8C26.8 23.9 27.2 22.0 25.8 21.9Z"/><path d="M 47.9 4.9C47.1 5.1 47.3 6.2 47.2 6.9C47.1 8.5 46.7 10.3 45.5 11.5C44.3 12.7 42.5 13.1 40.8 13.2C40.2 13.3 39.0 13.1 38.9 14.0C39.2 14.8 40.2 14.4 40.8 14.6C42.5 14.7 44.2 15.0 45.4 16.3C46.8 17.5 47.1 19.3 47.2 21.0C47.3 21.6 47.1 22.8 47.9 22.8C48.7 22.7 48.4 21.6 48.6 21.0C48.6 19.3 49.1 17.5 50.4 16.2C51.6 15.0 53.3 14.6 55.0 14.6C55.6 14.4 56.6 14.8 56.8 14.0C56.8 13.1 55.6 13.3 55.0 13.2C53.3 13.1 51.5 12.8 50.3 11.5C49.1 10.3 48.6 8.5 48.6 6.9C48.4 6.2 48.8 5.1 47.9 4.9Z"/></svg>"""

# The Playground's own icon — Sophie's drawing of the wire-loop toy, the same
# vector the iOS home card and bottom bar use
# (ios/ImageForge/Assets.xcassets/Playground.imageset/playground.svg). Keep the
# two in step: a button that sends you to the Playground looks like the tile.
ICON_PLAY = r"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"> <g transform="translate(1.47 0) scale(0.09510)" fill="#000" stroke="none"> <g transform="translate(0,673) scale(0.1,-0.1)"> <path d="M3145 6720 c-7 -12 -58 -175 -91 -293 l-19 -69 -96 7 c-108 8 -150 -5 -171 -50 -13 -30 -4 -29 -103 -8 -119 25 -497 25 -620 0 -279 -57 -515 -175 -704 -353 -228 -215 -341 -450 -357 -744 -15 -263 37 -431 236 -766 101 -169 140 -248 179 -357 17 -49 31 -90 31 -93 0 -2 -13 -4 -30 -4 -22 0 -31 5 -35 23 -3 12 -19 80 -35 152 -39 178 -36 175 -223 175 -134 0 -149 -2 -267 -36 -159 -46 -180 -65 -180 -157 1 -52 13 -213 23 -280 2 -15 -20 -27 -107 -60 -94 -37 -112 -47 -122 -72 -17 -39 -17 -106 1 -178 l13 -58 -51 -38 c-132 -98 -289 -286 -365 -440 l-47 -94 -3 -235 c-3 -233 -3 -235 22 -286 83 -169 254 -294 596 -436 273 -114 371 -181 467 -321 l31 -45 -130 -144 c-256 -284 -597 -676 -637 -732 -12 -16 -15 -78 -18 -314 l-3 -295 24 -24 c30 -29 68 -32 586 -45 217 -5 553 -14 745 -20 626 -18 1506 -30 2165 -29 l645 0 55 63 c30 35 136 153 235 262 99 110 256 285 349 389 93 105 184 204 203 222 18 18 38 45 44 60 8 18 11 120 11 299 -1 291 -7 330 -52 354 -13 7 -105 14 -236 17 l-215 6 58 59 c149 152 351 267 663 378 320 114 423 168 555 291 84 79 131 142 183 245 72 144 73 154 70 416 l-3 233 -32 64 c-86 169 -247 296 -429 336 -128 29 -116 18 -144 130 -14 55 -29 108 -33 118 -13 33 -74 50 -164 44 l-81 -5 -12 82 c-6 44 -16 114 -22 155 -15 103 -31 120 -133 133 -110 14 -262 5 -372 -21 -131 -32 -138 -41 -146 -203 -4 -68 -4 -151 -1 -184 l6 -60 -87 -25 c-115 -32 -135 -54 -135 -147 1 -37 7 -96 15 -132 20 -93 19 -117 -6 -125 -46 -15 -261 -190 -369 -301 -274 -281 -551 -653 -676 -909 -66 -135 -132 -321 -155 -438 l-13 -68 -130 3 -131 3 -8 105 c-20 270 72 996 183 1440 42 166 103 351 177 540 102 258 159 363 368 685 128 197 230 395 266 520 21 69 24 101 24 240 0 140 -3 169 -23 235 -36 115 -89 207 -166 288 l-69 72 9 58 c15 101 11 187 -9 210 -10 11 -57 32 -103 47 -83 26 -85 28 -79 54 37 146 50 217 50 278 0 91 -11 103 -150 164 l-100 44 -192 3 c-135 2 -193 0 -198 -8z m-520 -605 c44 -10 83 -20 86 -23 4 -4 1 -41 -7 -82 -7 -41 -13 -108 -14 -148 0 -91 18 -114 106 -132 96 -19 94 -17 94 -61 0 -56 23 -105 62 -129 45 -29 163 -25 205 6 23 17 54 62 66 97 1 4 17 5 35 1 32 -6 32 -7 32 -66 0 -55 3 -63 34 -94 33 -33 36 -34 116 -34 82 0 82 0 121 39 22 22 39 48 39 61 0 17 4 21 18 15 33 -13 147 -17 174 -6 16 6 36 24 47 41 l18 31 27 -36 c69 -90 110 -215 108 -325 -2 -153 -81 -331 -286 -649 -210 -324 -269 -438 -378 -721 -155 -404 -237 -747 -308 -1295 -35 -273 -50 -472 -50 -674 l0 -194 -241 6 c-133 4 -244 9 -247 11 -11 11 24 195 70 366 69 258 84 329 102 460 25 194 28 250 16 383 -39 455 -271 788 -635 915 -95 33 -152 43 -280 50 l-119 7 -12 72 c-30 175 -83 301 -242 570 -120 202 -155 278 -188 402 -40 155 -30 288 36 458 45 117 118 224 229 333 193 192 426 311 696 355 114 18 357 13 470 -10z m-765 -2395 c295 -70 505 -291 597 -627 23 -85 26 -118 27 -248 0 -172 -20 -294 -99 -589 -63 -236 -72 -277 -86 -397 l-12 -107 -116 -6 c-64 -3 -290 -9 -502 -12 l-385 -6 -18 28 c-111 174 -239 266 -546 394 -330 138 -451 227 -527 387 -29 60 -36 87 -36 133 2 153 108 354 275 522 48 49 92 88 98 88 5 0 10 -8 10 -18 0 -29 44 -63 87 -68 21 -3 74 1 118 8 l80 14 20 -41 c25 -51 72 -75 145 -75 100 0 160 55 160 146 0 33 4 43 19 47 15 4 20 -2 25 -28 6 -32 33 -63 73 -84 36 -18 129 -13 173 9 49 25 70 64 70 128 l0 50 73 10 c61 9 76 16 100 42 23 26 27 39 27 88 0 53 -8 118 -26 200 l-6 32 48 0 c27 0 87 -9 134 -20z m4196 -296 c124 -88 204 -235 204 -378 0 -166 -117 -396 -266 -519 -98 -82 -194 -132 -401 -208 -296 -109 -361 -137 -467 -195 -181 -101 -327 -225 -452 -384 l-49 -63 -160 7 c-310 13 -836 44 -842 50 -9 8 52 196 98 303 73 172 153 303 323 528 130 172 276 345 391 461 103 104 277 241 283 224 2 -6 17 -17 34 -26 24 -13 48 -14 122 -9 l92 7 12 -39 c19 -64 52 -87 131 -91 90 -5 136 15 162 72 10 23 19 58 19 79 0 20 3 37 8 37 4 0 16 -24 27 -53 25 -65 63 -87 148 -87 103 0 157 47 157 135 l0 53 92 13 c120 16 138 32 138 118 l0 61 66 -25 c37 -14 95 -46 130 -71z m-3766 -1997 c0 -158 5 -167 95 -167 93 0 98 11 89 169 l-7 121 267 0 266 0 0 -30 c0 -32 40 -243 66 -344 31 -125 41 -136 122 -136 90 0 111 60 69 200 -26 86 -67 267 -67 295 0 12 16 15 88 15 106 0 132 -6 132 -31 0 -37 36 -59 94 -59 47 0 57 4 75 26 12 15 21 33 21 40 0 11 10 13 38 9 20 -2 181 -12 357 -20 176 -9 361 -18 411 -21 l92 -6 -54 -91 c-46 -78 -54 -100 -54 -143 0 -70 15 -86 83 -92 68 -5 73 -1 164 155 37 62 78 126 92 142 l26 30 158 -7 158 -7 -187 -215 c-103 -118 -268 -306 -367 -417 l-179 -203 -226 0 c-281 1 -1228 15 -1902 30 -486 10 -1571 48 -1579 55 -4 5 120 149 378 438 107 120 197 214 201 210 10 -11 40 -149 40 -185 0 -31 16 -68 34 -80 6 -4 35 -8 65 -8 76 0 91 16 91 97 0 64 -30 221 -55 294 l-14 39 27 1 c231 11 423 16 635 17 l257 2 0 -123z m2911 -233 l-2 -86 -207 -232 c-114 -127 -272 -304 -352 -393 l-145 -161 -3 79 c-2 53 1 86 10 98 12 17 136 158 537 613 86 97 158 174 160 172 3 -2 4 -43 2 -90z m-4281 -679 c556 -21 2082 -55 2725 -60 231 -1 473 -3 538 -4 l118 -1 -3 -137 -3 -138 -345 3 c-190 2 -514 8 -720 13 -206 6 -609 14 -895 19 -681 10 -1798 41 -1807 49 -8 7 2 271 11 271 3 0 175 -7 381 -15z"/> </g> </g> </svg>"""

page = r"""<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>Story Room</title>
<style>
@font-face{font-family:'EBGaramond';font-weight:400 700;font-display:swap;src:url(data:font/ttf;base64,__FONT__) format('truetype');}
:root{ --paper:#f6f2e9; --ink:#26221c; --ink2:#8a8377; --line:#d9d2c2; --barbg:#fffdf7; --gold:#a8845c;
  --mustard:#c99b3f; --green:#7d9b76; --blue:#7189a5; --pink:#c88fa2; }
@media (prefers-color-scheme: dark){:root{--paper:#191713; --ink:#e8e2d6; --ink2:#97907f; --line:#37322a; --barbg:#211e19; --gold:#c9a06b;}}
:root[data-theme="dark"]{--paper:#191713; --ink:#e8e2d6; --ink2:#97907f; --line:#37322a; --barbg:#211e19; --gold:#c9a06b;}
:root[data-theme="light"]{--paper:#f6f2e9; --ink:#26221c; --ink2:#8a8377; --line:#d9d2c2; --barbg:#fffdf7; --gold:#a8845c;}
html{background:var(--paper);}
body{margin:0; touch-action:manipulation; background:var(--paper); color:var(--ink); font-family:'EBGaramond',Georgia,serif;}
[hidden]{display:none !important;}
/* THE HEADER SITS AT THE TOP, AND AT THE SAME HEIGHT ON EVERY SURFACE
   (2026-08-23, Sophie's two screenshots: "the header is different in both,
   and not at the top"). Measured on the real page at 390x844 before the fix:
   the page's row started at y=8 and the shelf's at y=25, because `.sheet
   .wrap` overrode this padding with a flat `3vh` that also ignored the safe
   area — so the two rows sat 17px apart and both floated below the top of
   the screen. ONE variable owns it now, both wraps read it, and the rows
   themselves carry no top padding of their own. */
:root{--headtop:calc(env(safe-area-inset-top,0px) + 4px);}
.wrap{max-width:34em; margin:0 auto; padding:var(--headtop) 5vw 16vh;}
.no{font-family:-apple-system,'Helvetica Neue',sans-serif; font-size:11px; letter-spacing:.34em; color:var(--ink2); text-transform:uppercase;}
/* The name sits on its own line at the VERY top (the old 5vh wrap padding
   left it stranded mid-page in the app — Sophie's screenshot). The story's
   own buttons live on the title row below, right-aligned and stopping 56px
   short of the pill's corner, so nothing overlaps the word. */
/* THE ONE HEADER SHAPE — the page's header AND every sheet in it (Aug 2026,
   Sophie, looking at the shelf: "there's like an X to get out of it and a
   weird icon. I just want it to be a back button and no X … the header
   should be like normal it should say the shelf just like all the other
   pages have a header at the top. Make sure the pattern is consistent
   everywhere"). Back control in a 34px rounded box at the LEFT — never an
   ✕ — the name centred, actions at the right.
   THE NAME IS CENTRED ABSOLUTELY, not by flex, because the two ends are
   different widths (the pill owns the top-right 56px), so a flex-centred
   name reads visibly off-centre. That is pagehead.js's own `.fh` rule,
   copied here on purpose: this page draws its whole chrome, and its sheets
   have to look identical to the row pagehead draws on the page behind
   them. */
header,.sheethead{display:flex; align-items:center; gap:10px; position:relative;
  min-height:34px; padding:0 56px 0 0;}
/* ...and the leading button starts at the same x wherever it was drawn.
   pagehead.js pulls its own chevron 4px left (`margin:0 2px 0 -4px`), so a
   sheet's chevron drawn by the page sat 4px further in than the app's —
   measured 16 against 20, which is exactly what reads as "different". */
header > .iconbtn:first-child,.sheethead > .iconbtn:first-child{margin-left:-4px;}
header > .no,.sheethead > .no{position:absolute; left:88px; right:88px; top:50%;
  transform:translateY(-50%); margin:0; text-align:center; white-space:nowrap;
  overflow:hidden; text-overflow:ellipsis;}
/* whatever ENDS the row (the + on the shelf, the shelf door on the pad) hugs
   the right — the centred name is absolute, so it cannot be the flex spacer */
header > :last-child:not(.no),.sheethead > :last-child:not(.no){margin-left:auto;}
/* THE OLD BUILD STILL HAS APPLE'S BAR, and it already says STORY ROOM — never
   two titles (the Playground rule). Builds inject window.__nativeNavBar and
   the page answers with body.native. The build that HANDS THE HEADER OVER
   also runs pagehead.js, which stamps body.pagehead and draws the chevron
   into this row — and then the page's own name is the only one there is, so
   it comes back. Both halves ship separately, so both states have to hold. */
body.native header > .no{display:none;}
body.native.pagehead header > .no{display:block;}
/* ...and the page's own back chevron yields to whichever chevron the app has
   already drawn. It shows in a plain browser ONLY, where nothing injects one
   and a story would otherwise be a dead end with no way back to the shelf. */
body.native #shelfback,body.pagehead #shelfback{display:none;}
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
/* THE STYLE TOGGLE — watercolor ↔ dreamy (Aug 2026, Sophie: "a style toggle
   at the top of a story that alternates between dreamy and watercolor …
   the same format that the account's toggle is, with a switch that moves
   back-and-forth"). `.swi` is the account switcher's toggle from chats.html
   VERBATIM — 48px track, 26 tall, an 18px knob — with TWO stops instead of
   three and the track in INK on this cream page (the Playground's quality
   toggle set that precedent; the rose belongs to the Chats app). The far
   stop's 23px offset is the same arithmetic as the account one's third stop
   (2 + 23 + 18 leaves the same 2px margin the near stop has). The words
   either side say which is which — the lit one is where the knob sits — and
   tapping a word or the switch flips the story. Its own line under the
   title row: the row above already carries six 34px icons on a 390pt phone,
   and a 48px track cannot fit beside them. */
.stylerow{display:flex; align-items:center; gap:9px; padding:2px 56px 4px 0;}
.stylerow .sw{font-family:-apple-system,'Helvetica Neue',sans-serif; font-size:10px; letter-spacing:.1em;
  text-transform:uppercase; color:var(--ink2); background:none; border:none; padding:2px 0; cursor:pointer;
  -webkit-tap-highlight-color:transparent;}
.stylerow .sw.on{color:var(--ink); font-weight:600;}
.swi{--tw:48px; --k:18px; --gap:23px;
  position:relative; box-sizing:border-box; width:var(--tw); height:26px; border-radius:13px;
  border:1.5px solid var(--ink); background:var(--ink);
  padding:0; margin:0; flex:none; cursor:pointer; -webkit-tap-highlight-color:transparent;}
.swi::after{content:''; position:absolute; top:2px; left:2px; width:var(--k); height:18px; border-radius:50%;
  background:var(--paper); transition:transform .18s;}
.swi[data-a="2"]::after{transform:translateX(var(--gap));}
/* THE SHELF (Aug 2026, the media-asset-survey prototype v5, ~15 rounds with
   Sophie): category chips + portrait tiles four across. A tile is a REAL
   picture from that story — portrait 2:3 so nothing crops the art — with the
   name only underneath; tapping it opens that story's beat canvas directly.
   The chips are the witch shop's category style: rounded rectangles, gold
   border + gold text when lit. */
#shelfcats{display:flex; gap:7px; overflow-x:auto; -webkit-overflow-scrolling:touch;
  margin:14px 0 12px; padding-bottom:2px;}
#shelfcats::-webkit-scrollbar{display:none;}
.scat{flex:0 0 auto; background:var(--barbg); border:1px solid var(--line); color:var(--ink2);
  border-radius:6px; padding:7px 13px; font:600 13px -apple-system,'Helvetica Neue',sans-serif;
  cursor:pointer; -webkit-tap-highlight-color:transparent;}
.scat.on{border-color:var(--gold); color:var(--gold);}
/* THREE to a row (Aug 2026, Sophie), and the tile is a FRAMED picture: the
   art sits on a white mat inside the one hairline outline, both corners
   slightly rounded, the name centred underneath. The mat is the .cov's own
   padding — so `inset:5px` on the art, not `inset:0`, because an absolutely
   positioned child is placed against the PADDING BOX and would otherwise sit
   on top of the mat — and the art's size is spelled out rather than left to
   `inset`, because an absolutely positioned IMG with auto width shrinks to
   its intrinsic size instead of stretching between two offsets. `box-sizing` is not global on this page, so the frame
   declares its own or the padding pushes each tile out of its grid cell. */
#shelftiles{display:grid; grid-template-columns:repeat(3,1fr); gap:16px 10px;}
.stile{display:block; padding:0; background:none; border:none; text-align:left; color:var(--ink);
  cursor:pointer; font-family:'EBGaramond',Georgia,serif; -webkit-tap-highlight-color:transparent;}
.stile .cov{display:block; position:relative; box-sizing:border-box; width:100%; aspect-ratio:2/3;
  padding:5px; background:#fff; border:1px solid var(--line); border-radius:4px;}
.stile .cov img,.stile .cov .none{position:absolute; top:5px; left:5px;
  width:calc(100% - 10px); height:calc(100% - 10px); border-radius:2px; background:var(--barbg);}
.stile .cov img{object-fit:cover;}
.stile .cov .none{box-sizing:border-box; border:1px dashed var(--line);}
/* THE PUSHPIN — round head, straight spike, never the Maps teardrop (the
   house rule). It rides the tile's top-left corner because the injected
   autoscroll pill owns the top-RIGHT of the screen, and the first row's last
   tile sits under it. Only the HEAD fills when it is set, as on the Chats
   app's rows. Its plate is a ROUNDED SQUARE at the house 6px, never a circle
   (2026-08-24, Sophie: rounded squares or a plain icon, not circles). */
.stile .pinpin{position:absolute; top:4px; left:4px; z-index:2; width:26px; height:26px;
  display:flex; align-items:center; justify-content:center; padding:0; border:none;
  border-radius:6px; background:rgba(255,255,255,.92); color:var(--ink2);
  box-shadow:0 1px 4px rgba(0,0,0,.18); cursor:pointer; -webkit-tap-highlight-color:transparent;}
.stile .pinpin svg{width:14px; height:14px; display:block;}
.stile .pinpin.on{color:var(--gold);}
.stile .pinpin.on .pinhead{fill:var(--gold); stroke:var(--gold);}
.stile .snm{padding-top:5px; text-align:center; font-weight:700; font-size:.8em; line-height:1.25;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;}
/* The way to the rest of the shelf. An underlined word, never a button with a
   box round it — the house truncation-opener pattern. */
#shelfmore{grid-column:1/-1; justify-self:center; margin:2px 0 0; padding:6px 4px;
  background:none; border:none; color:var(--ink2); cursor:pointer;
  font-family:'EBGaramond',Georgia,serif; font-size:.95em; text-decoration:underline;
  -webkit-tap-highlight-color:transparent;}
.stile .snm.blank{color:var(--ink2); font-style:italic; font-weight:400;}
.stile.cur .snm{color:var(--gold);}
/* The OLD shelf: every story as a row. Kept as a fallback only — NOTHING
   links here (Sophie's call); ?plain=1 is the one way in. */
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
/* About this story — her words pre-wrapped verbatim, her recordings above */
#descbody{white-space:pre-wrap; line-height:1.55; font-size:.95em; padding:4px 0 60px;}
#descaudios .arow{margin:12px 0 16px;}
#descaudios .arow .no{margin-bottom:6px;}
#descaudios audio{width:100%; display:block;}
/* The sheet is its own scroller, so the page's pill cannot drive it — it gets
   one of its own, same look, in the same corner. */
.sfloat{position:fixed; top:max(14px, env(safe-area-inset-top)); right:max(14px,4vw); z-index:41;
  display:flex; flex-direction:column; gap:8px; align-items:center;}
.sfloat .vseg{display:flex; flex-direction:column; width:44px; border:1.5px solid var(--ink);
  border-radius:999px; overflow:hidden; background:var(--paper); box-shadow:0 2px 10px rgba(0,0,0,.09);}
.sfloat button{border:none; background:transparent; color:var(--ink); width:44px; height:46px;
  display:flex; align-items:center; justify-content:center; padding:0; cursor:pointer;}
.sfloat button+button{border-top:1.5px solid var(--ink);}
.sfloat button.on{background:color-mix(in srgb, var(--gold,#a8845c) 18%, var(--paper)); color:var(--gold,#a8845c);}
.sheet .wrap{padding-top:var(--headtop);}   /* the SAME top as the page's row */
/* TWO TABS in the add sheet — PICTURES and CLIPS (Aug 2026, Sophie: "can u
   add film clips to story room"). The house `.acctabs` pattern verbatim: two
   labels over a hairline, the line MEASURING the lit tab so the count lives
   nowhere. A seventh icon in the title row was the alternative and the row
   already carries six at 34px on a 390pt phone. */
.acctabs{position:relative; display:flex; border-bottom:1px solid var(--line);
  margin:14px 0 12px; padding-right:56px;}
.acctab{flex:1 1 0; min-width:0; padding:7px 4px 9px; border:none; background:none; cursor:pointer;
  font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.08em; text-transform:uppercase;
  color:var(--ink2); -webkit-tap-highlight-color:transparent;}
.acctab.on{color:var(--ink);}
.acctabs::after{content:''; position:absolute; left:0; bottom:-1px; height:2px;
  width:var(--tw,0); background:var(--ink); transform:translateX(var(--tx,0));}
.acctabs.tl::after{transition:transform .2s ease, width .2s ease;}
/* The clip shelf: two to a row (a clip is landscape and its NAME is how she
   knows which one it is — four across left no room for either). The tile is
   the clip's POSTER, never the mp4: a grid of decoding videos is what makes
   a picker crawl on a phone. */
#clipq{width:100%; box-sizing:border-box; font-family:'EBGaramond',Georgia,serif; font-size:1em;
  padding:8px 10px; border:1px solid var(--line); border-radius:6px; background:var(--barbg);
  color:var(--ink); -webkit-appearance:none;}
#clipgrid{display:grid; grid-template-columns:repeat(2,1fr); gap:14px 10px; margin-top:1.1em;}
#clipgrid button{padding:0; background:none; border:none; text-align:left; color:var(--ink);
  font-family:'EBGaramond',Georgia,serif; cursor:pointer;}
#clipgrid .cpost{position:relative; display:block; width:100%; aspect-ratio:16/9;
  border:1px solid var(--line); border-radius:4px; background:var(--barbg); overflow:hidden;}
#clipgrid .cpost img{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block;}
#clipgrid .cnm{display:block; padding-top:5px; font-size:.8em; font-weight:700; line-height:1.25;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;}
#clipgrid .cdur{display:block; font-size:.72em; color:var(--ink2); padding-top:2px;}
/* The film mark — what says a beat is a CLIP and not a picture, on the pad
   tile, on a shelf poster, and on a blank clip that has no poster. */
.fmark{position:absolute; left:4px; bottom:4px; width:18px; height:18px; border-radius:50%;
  background:var(--paper); border:1px solid var(--ink); display:flex; align-items:center;
  justify-content:center; z-index:2;}
.fmark svg{width:9px; height:9px; display:block;}
.fmark.mid{left:50%; bottom:50%; transform:translate(-50%,50%); width:26px; height:26px;}
.fmark.mid svg{width:13px; height:13px;}
/* A clip in the beat popup is WATCHABLE — the full card width, not the pad
   tile's ~90px. The never-blow-the-art-up rule is about her drawings; a film
   nobody can see is not a preview. */
#popvid{width:100%; max-height:100%; display:block; border-radius:4px; background:#000;}
#popvid.c-mustard{outline:3px solid var(--mustard);} #popvid.c-green{outline:3px solid var(--green);}
#popvid.c-blue{outline:3px solid var(--blue);} #popvid.c-pink{outline:3px solid var(--pink);}
#inboxgrid{display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:1.2em;}
#inboxgrid button{position:relative; aspect-ratio:2/3; border:1px solid var(--line); border-radius:4px; background:var(--barbg);
  padding:0; overflow:hidden; cursor:pointer;}
#inboxgrid button img{width:100%; height:100%; object-fit:cover; display:block;}
#inboxgrid button.used{opacity:.35;}
/* Uploading from her phone says how far along it is — one quiet line. */
#upline{font-style:italic; color:var(--ink2); font-size:.9em; margin-top:1em;}
/* The beat popup is an opaque cream CARD, not a dark lightbox: white/cream
   paper with a light border, centered, and only as TALL as what's on it
   (Sophie, Aug 2026 — a full-height card was "too tall"; the pad showing
   all around it is also the tap-out target). Capped at the screen and
   scrolls inside if content ever overflows. Everything — art, versions,
   chips, note, icons — lives ON the card. No scrim. */
/* IT STARTS BELOW THE HEADER, AND CUTS THROUGH THE STORY'S NAME (2026-08-24,
   Sophie: "someone made the beat one at a time popup too big. it shud
   comfortably show the story room header, and part of the story name"). The
   card's top used to be 18px down, which put it OVER both — so the one thing
   on screen saying which room she was in and which story she was in was gone
   the moment she opened a beat. Measured on the real page at 390x780: the
   header runs y 4-38 and the name y 52-83, so a 68px top clears the header
   whole and leaves the top half of the name showing above the card. The
   number is a MEASUREMENT, not a taste — re-measure it if the header or the
   title's type ever changes. The card is still screen-shaped and still
   leaves a strip of pad all round as the tap-out target. */
#beatpop{position:fixed; inset:0; z-index:50; background:none;
  display:flex; align-items:center; justify-content:center;
  padding:calc(env(safe-area-inset-top,0px) + 68px) 14px calc(env(safe-area-inset-bottom,0px) + 18px);}
/* THE CARD IS NEARLY THE WHOLE SCREEN, AND SCREEN-SHAPED (Aug 2026, Sophie:
   "the whole popup gets bigger, so there's only room enough to comfortably
   see behind it. similar aspect ratio as total screen (not square)"). It
   used to be only as tall as its contents, which on a beat with a small
   picture left a squat card floating in the middle. height:100% of a
   padded fixed inset IS the screen's own shape, minus the strip of pad
   showing all round it — and that strip is still the tap-out target. */
#beatcard{width:100%; height:100%; box-sizing:border-box; background:var(--barbg);
  border:1.5px solid var(--line); border-radius:10px;
  display:flex; flex-direction:column; overflow:hidden;}
/* A thin strip that never scrolls, so the colour square keeps its corner
   however long the card's contents get. */
#cardtop{flex:none; display:flex; justify-content:flex-end; padding:10px 12px 0;}
#colorwrap{position:relative;}
/* ONE MULTICOLOURED ROUNDED SQUARE, DROPPING DOWN (Aug 2026, Sophie:
   "colors become one multicolored rounded square in the corner, drop
   down"). Five circles in a row cost the card a whole band; the chosen
   colour is already legible on the picture's own frame, so the button
   stays multicoloured rather than showing the pick — it reads as "colour"
   from across the room, which a single filled square would not. */
#colorbtn{width:32px; height:32px; padding:0; border:none; background:none; cursor:pointer; display:block;}
#colorbtn svg{width:100%; height:100%; display:block;}
#colormenu{position:absolute; top:38px; right:0; z-index:2; display:flex; gap:12px;
  background:var(--barbg); border:1.5px solid var(--line); border-radius:8px; padding:10px 12px;}
#cardin{flex:1; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch;
  width:100%; box-sizing:border-box; padding:8px 16px 20px;
  display:flex; flex-direction:column; align-items:center; gap:14px;}
/* THE PICTURE IS BIG NOW (Sophie, same message: "that image is bigger by
   default"). It used to be pinned to the pad tile's ~90px — a thumbnail of
   a thumbnail. It takes the room the card has left instead: flex:1 with
   min-height:0, and the image sized by max-height/max-width so a 2:3
   drawing keeps its shape whatever the screen is. */
#artwrap{flex:1; min-height:120px; width:100%; display:flex; align-items:center; justify-content:center;}
#popimg{max-width:100%; max-height:100%; width:auto; height:auto; object-fit:contain; cursor:pointer;}
#beatpop img{border:3px solid var(--line); border-radius:4px; background:var(--barbg); display:block; height:auto;}
#beatpop img.c-mustard{border-color:var(--mustard);} #beatpop img.c-green{border-color:var(--green);}
#beatpop img.c-blue{border-color:var(--blue);} #beatpop img.c-pink{border-color:var(--pink);}
.chip{width:32px; height:32px; border-radius:50%; border:1.5px solid var(--line); padding:0; cursor:pointer;}
.chip.on{outline:2.5px solid var(--ink); outline-offset:3px;}
.chip.gray{background:#8a8377;} .chip.mustard{background:var(--mustard);}
.chip.green{background:var(--green);} .chip.blue{background:var(--blue);} .chip.pink{background:var(--pink);}
/* TWO TEXT BOXES, ONE OPEN AT A TIME BY DEFAULT (Aug 2026, Sophie: "two
   text boxes: caption, and drawing prompt. drawing prompt is collapsed by
   default, and uncollapsing draw prompt automatically collapses the caption
   but can be manually expanded again"). The label IS the toggle — a quiet
   serif line with a chevron, not a button-looking button — and opening the
   prompt folds the caption away, which she can undo by tapping Caption.
   Both open at once is a state she can reach; neither is a state she can
   reach by accident, since a tap on a label only ever moves that one. */
.tbox{width:100%; max-width:26em; display:flex; flex-direction:column; gap:6px;}
.tlab{display:flex; align-items:center; gap:4px; align-self:flex-start;
  background:none; border:none; padding:2px 0; cursor:pointer;
  font-family:'EBGaramond',Georgia,serif; font-size:14px; color:var(--ink2); font-style:italic;}
.tlab .chev{width:14px; height:14px; transition:transform .15s ease;}
.tlab[aria-expanded="false"] .chev{transform:rotate(-90deg);}
#pnote{width:100%; box-sizing:border-box; font-family:'EBGaramond',Georgia,serif; font-size:17px;
  line-height:1.4; color:var(--ink); background:var(--paper); border:1px solid var(--line); border-radius:6px;
  padding:10px 12px; resize:none;}
.poprow{flex:none; display:flex; gap:14px;}
#speak,#linkbtn,#micbtn,#coverbtn,#delbtn{width:34px; height:34px; display:flex; align-items:center; justify-content:center; padding:0;
  border:1px solid var(--line); border-radius:6px; background:none; color:var(--ink); cursor:pointer;}
#speak svg,#linkbtn svg,#micbtn svg,#coverbtn svg,#delbtn svg{width:17px; height:17px;}
#coverbtn.on{background:var(--ink); color:var(--barbg);}
/* Every generation this beat has had, all the same size, newest first; the
   one currently on the pad wears the dark ring. Tap one to see it big. */
/* Past pictures — hidden until the stacked-squares button asks for them
   (Sophie: "drawing a new picture replaces the old, but keeps it in the
   stacked squares icon"). Newest first, the current one ringed. */
#verrow{flex:none; display:flex; flex-wrap:wrap; gap:6px; justify-content:center; max-width:100%;}
#verrow button{width:44px; aspect-ratio:2/3; padding:0; border:1.5px solid var(--line); border-radius:4px;
  overflow:hidden; background:var(--paper); cursor:pointer;}
#verrow button.cur{border:2.5px solid var(--ink);}
#verrow img{width:100%; height:100%; object-fit:cover; display:block;}
#delask{position:fixed; inset:0; z-index:55; display:flex; align-items:center; justify-content:center;
  background:rgba(20,17,12,.55); padding:24px;}
#speak.busy,#micbtn.busy{opacity:.45;}
/* Lit = this beat is part of a chunk (tap dissolves the whole chunk). */
#linkbtn.on{background:var(--ink); color:var(--barbg); border-color:var(--ink);}
/* Mic: lit = a recording exists (her reading is what plays); red = recording
   right now, tap again to stop. */
#micbtn.on{background:var(--ink); color:var(--barbg); border-color:var(--ink);}
#micbtn.rec{background:#c25a72; border-color:#c25a72; color:#fff;}
/* An empty beat's popup: the blank paper tile with two quiet icons in its
   middle — the Playground (make new art) and the inbox (pick from what's
   hearted, straight into THIS beat). */
/* The blank tile is now just the empty paper at the picture's size — its
   two icons moved into #artrow under it, beside the star, so the ways to
   make art sit in ONE place whether the beat has a picture or not. */
#popblank{aspect-ratio:2/3; max-height:100%; border:3px solid var(--line); border-radius:4px;
  background:var(--paper); box-sizing:border-box;}
/* The same two ways to art, ABOVE a beat that already has a picture — so it
   can be swapped for another (Sophie, Aug 2026). */
/* THE WAYS TO ART, IN ROUNDED SQUARES, UNDER THE PICTURE (Aug 2026,
   Sophie: "stars, playground and inbox buttons get put into rounded
   squares and go under the main (currently chosen) image"). 38px SQUARES —
   the tap target, house radius 6px — never pills. The fourth, stacked
   squares, opens the past pictures and shows only when there are some. */
#artrow{flex:none; display:flex; gap:12px; justify-content:center;}
#artrow button{width:38px; height:38px; padding:0; background:none; border:1px solid var(--line);
  border-radius:6px; color:var(--ink); cursor:pointer; display:flex; align-items:center; justify-content:center;}
#artrow button.on{background:var(--ink); color:var(--barbg); border-color:var(--ink);}
#artrow svg{width:18px; height:18px;}
/* Drawing right here: prompt (defaults to the beat's words), Sophie on/off,
   quality, Draw. The STYLE is never asked — one style per story. */
#drawbox{width:100%; display:flex; flex-direction:column; gap:8px;}
/* Says which words a draw is about to use. Chrome, not content — it is
   never IN the box she writes in. */
#promhint{font-family:'EBGaramond',Georgia,serif; font-size:13px; font-style:italic;
  color:var(--ink2); margin-top:-2px;}
#dprompt{width:100%; box-sizing:border-box; font-family:'EBGaramond',Georgia,serif; font-size:16px;
  line-height:1.4; color:var(--ink); background:var(--paper); border:1px solid var(--line);
  border-radius:6px; padding:10px 12px; resize:none;}
.drawrow{display:flex; align-items:center; gap:10px;}
#dchar{width:34px; height:34px; flex:none; padding:0; border:1.5px solid var(--line); border-radius:6px;
  overflow:hidden; background:none; opacity:.4; cursor:pointer;}
#dchar.on{opacity:1; border-color:var(--ink);}
#dchar img{width:100%; height:100%; object-fit:cover; display:block;}
#dq{font-family:-apple-system,sans-serif; font-size:16px; border:1px solid var(--line);
  border-radius:6px; background:var(--paper); color:var(--ink); padding:6px 8px;}
#dq option{color:#26221c;}
#dgo{margin-left:auto; font-family:'EBGaramond',Georgia,serif; font-size:16px; background:var(--ink); color:var(--paper);
  border:none; border-radius:6px; padding:8px 18px; cursor:pointer;}
#dgo:disabled{opacity:.5;}
/* A beat being drawn (or a failed draw) says so on its own line. */
#genstate{color:var(--ink2); font-style:italic; font-size:15px; text-align:center; max-width:80vw;}
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
/* Listen rows — every recording attached to this story, behind the waveform
   button on the title row (Aug 2026, Sophie: "a story can hold multiple
   audios … hide them all behind a single icon that has a wave form"). Two
   kinds share the list: episodes cut from this story in the Episode Editor
   (the NDE montages), and the SOURCE recordings it came out of — the voice
   memos. They share the page's one player, so a tap replaces whatever is
   speaking, never stacks. */
#audios{margin-top:.6em;}
.aurow{display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid var(--line);}
.aurow:first-child{border-top:1px solid var(--line);}
.aurow .autxt{flex:1; min-width:0;}
.aurow .aunm{font-size:1.05em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.aurow .audate{font-size:.8em; color:var(--ink2); margin-top:2px;}
.aurow .audur{flex:none; font-size:.8em; color:var(--ink2);}
/* CANDIDATES — recordings a chat guessed belong to this story, waiting on
   her (Aug 2026, Sophie: "attach them behind the wave form, but under a
   header tag called candidates"). Same rows, same player; only the header
   separates them, so a guess is heard in context instead of judged from a
   title on a review card. */
.auhead{margin:1.4em 0 .2em; font-size:.78em; letter-spacing:.08em; text-transform:uppercase; color:var(--ink2);}
.auhead + .aurow{border-top:1px solid var(--line);}
/* WHAT THE BUTTONS DO — one row per control: its own glyph in the same box
   it wears on the page (so a row is recognisable at a glance rather than
   read), the name, and one line. The glyph is inert — this is a legend, not
   a second set of controls. */
.hrow{display:flex; align-items:flex-start; gap:12px; padding:11px 0; border-bottom:1px solid var(--line);}
.hrow:first-child{border-top:1px solid var(--line);}
.hrow .iconbtn{pointer-events:none;}
.hrow .htxt{flex:1; min-width:0;}
.hrow .hnm{font-size:1.02em;}
.hrow .hwhat{font-size:.85em; color:var(--ink2); margin-top:2px; line-height:1.35;}
/* A control with no glyph of its own (the style toggle, tapping a beat) —
   the words carry it, so the row keeps its indent and skips the box. */
.hrow.nogl .htxt{margin-left:46px;}
/* The film's buttons ride the title row; this line only appears while it's
   making (or if it failed). */
#filmrow{margin-top:.5em;}
.filmnote{font-size:.85em; font-style:italic; color:var(--ink2);}
#filmplay{position:fixed; inset:0; z-index:70; display:flex; align-items:center; justify-content:center;
  background:#000; padding:0;}
#filmplay video{max-width:100vw; max-height:100vh; background:#000;}
</style>
<div class="wrap">
  <!-- THE BACK BUTTON IS THE SHELF BUTTON (2026-08-23, Sophie: "the story
       room architecture is backwards. the shelf is the main room. the back
       button goes to the shelf. story room opens on the shelf. we don't need
       a separate shelf button. the back button IS the shelf button").
       The `library` door that used to sit at the right of this row is GONE: a
       story is one level DOWN from the shelf, so going back up is what the
       one chevron at the left already means, and a second control saying the
       same thing was the backwards half.
       In the app that chevron belongs to chrome outside the page — Apple's
       bar on the old build, pagehead.js's on the new one — and both ask
       __navBack, which hands them the shelf. A plain browser injects
       neither, so the page draws its own (#shelfback), hidden under
       body.native / body.pagehead by exactly the rule the ten __nativeNavBar
       pages follow: whoever owns back draws it once. -->
  <header>
    <button class="iconbtn" id="shelfback" hidden aria-label="Back to the shelf"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
    <div class="no">Story room</div>
    <!-- WHAT THE BUTTONS DO (Aug 2026, Sophie: "also add an info icon that
         says what all the buttons do"). It sits on the NAME row, not the
         title row: that row already carries six 34px icons on a 390pt phone
         and a seventh would eat the story's name, while this row has its
         whole right end free. The row reserves the pill's 56px, so the "?"
         lands just clear of the injected pill's corner. -->
    <button class="iconbtn" id="helpbtn" aria-label="What the buttons do"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg></button>
  </header>
  <div class="titlerow">
    <div id="title" contenteditable="true" spellcheck="false"></div>
    <button class="iconbtn" id="descbtn" hidden aria-label="About this story — what you said about it"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/></svg></button>
    <button class="iconbtn" id="audiobtn" hidden aria-label="Every recording attached to this story"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2"/></svg></button>
    <button class="iconbtn" id="playbtn" hidden aria-label="Watch the film"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M6 4.5v15l13-7.5z"/></svg></button>
    <button class="iconbtn" id="drawallbtn" hidden aria-label="Draw every beat that has words but no picture"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg></button>
    <button class="iconbtn" id="addbtn" aria-label="Add an empty beat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg></button>
    <button class="iconbtn" id="inboxbtn" aria-label="Hearted in the Playground"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></button>
  </div>
  <div class="stylerow">
    <button class="sw on" id="swwater" type="button">Watercolor</button>
    <button class="swi" id="styletog" type="button" data-a="1" aria-label="Which style this story is showing"></button>
    <button class="sw" id="swdreamy" type="button">Dreamy</button>
  </div>
  <div id="filmrow" hidden><span class="filmnote" id="filmnote"></span></div>
  <div id="pad"></div>
  <div class="state" id="empty" hidden>Empty page — the button top right opens your pictures and your clips.</div>
</div>

<div class="sheet" id="stories" hidden>
  <div class="wrap">
    <div class="sheethead">
      <button class="iconbtn" id="storiesclose" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
      <div class="no">The shelf</div>
      <button class="iconbtn" id="newstory" aria-label="Start a new story"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg></button>
    </div>
    <div id="shelfcats"></div>
    <div id="shelftiles"></div>
    <div id="storylist" hidden></div>
  </div>
</div>

<div class="sheet" id="inbox" hidden>
  <div class="wrap">
    <div class="sheethead">
      <button class="iconbtn" id="inboxclose" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
      <div class="no" id="inboxno">From the Playground</div>
      <!-- Photos and movies straight off her phone (Aug 2026, Sophie: "add
           clips right from my phone into the inbox … a file picker that looks
           in my photos so I can add movies or photos"). The system picker
           reaches her Photos library by itself; the bytes ride the Dump's
           upload-file route, and the finished urls wait here to be placed. -->
      <button class="iconbtn" id="upbtn" aria-label="Add photos or movies from your phone"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg></button>
    </div>
    <input type="file" id="upfile" accept="image/*,video/*" multiple hidden>
    <div id="upline" hidden></div>
    <div class="acctabs" id="inboxtabs">
      <button class="acctab on" id="tab-pics" type="button">Pictures</button>
      <button class="acctab" id="tab-clips" type="button">Clips</button>
    </div>
    <div id="picpane">
      <div id="inboxgrid"></div>
      <div class="state" id="inboxempty" hidden>Nothing hearted in the Playground yet.</div>
    </div>
    <div id="clippane" hidden>
      <input id="clipq" type="search" enterkeyhint="search" autocomplete="off"
             spellcheck="false" placeholder="Search clips">
      <div id="clipgrid"></div>
      <div class="state" id="clipempty" hidden>No clips on the shelf yet.</div>
    </div>
  </div>
</div>

<!-- Every recording attached to this story, behind the waveform button:
     the memos it came out of, and the episodes cut from it. -->
<div class="sheet" id="ausheet" hidden>
  <div class="wrap">
    <div class="sheethead">
      <button class="iconbtn" id="auclose" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
      <div class="no">Audio on this story</div>
    </div>
    <div id="audios"></div>
  </div>
</div>

<!-- WHAT THE BUTTONS DO. Every row's glyph is CLONED from the real control
     at open time (mkHelp), so this list can never show a button the page no
     longer has, or an old drawing of one that changed. -->
<div class="sheet" id="helpsheet" hidden>
  <div class="wrap">
    <div class="sheethead">
      <button class="iconbtn" id="helpclose" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
      <div class="no">What the buttons do</div>
    </div>
    <div id="helpbody"></div>
  </div>
</div>

<!-- About this story: her own words + her recordings, read-only -->
<div class="sheet" id="descsheet" hidden>
  <div class="wrap">
    <div class="sheethead">
      <button class="iconbtn" id="descclose" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
      <div class="no">About this story</div>
    </div>
    <div id="descaudios"></div>
    <div id="descbody"></div>
  </div>
</div>

<div id="beatpop" hidden>
  <div id="beatcard">
  <div id="cardtop">
    <div id="colorwrap">
      <button id="colorbtn" aria-label="Frame color"><svg viewBox="0 0 24 24" aria-hidden="true"><clipPath id="csq"><rect x="2" y="2" width="20" height="20" rx="5"/></clipPath><g clip-path="url(#csq)"><rect x="2" y="2" width="10" height="10" fill="var(--mustard)"/><rect x="12" y="2" width="10" height="10" fill="var(--green)"/><rect x="2" y="12" width="10" height="10" fill="var(--blue)"/><rect x="12" y="12" width="10" height="10" fill="var(--pink)"/></g><rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="var(--line)" stroke-width="1.5"/></svg></button>
      <div id="colormenu" hidden>
        <button class="chip gray" data-c="" aria-label="No frame"></button>
        <button class="chip mustard" data-c="mustard" aria-label="Mustard frame"></button>
        <button class="chip green" data-c="green" aria-label="Green frame"></button>
        <button class="chip blue" data-c="blue" aria-label="Blue frame"></button>
        <button class="chip pink" data-c="pink" aria-label="Pink frame"></button>
      </div>
    </div>
  </div>
  <div id="cardin">
  <div id="artwrap">
    <img id="popimg" alt="">
    <video id="popvid" hidden playsinline preload="metadata" controls></video>
    <div id="popblank" hidden></div>
  </div>
  <div id="artrow" hidden>
    <button id="ardraw" aria-label="Draw it here">__STAR__</button>
    <button id="arplay" aria-label="Make its art in the Playground">__PLAYICON__</button>
    <button id="arinbox" aria-label="Pick from the inbox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></button>
    <button id="arvers" hidden aria-label="Past pictures"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h12a1 1 0 0 1 1 1v12"/><path d="M6 7h11a1 1 0 0 1 1 1v11"/><rect x="3" y="10" width="12" height="11" rx="1"/></svg></button>
  </div>
  <div id="verrow" hidden></div>
  <div id="genstate" hidden></div>
  <div class="tbox" id="capbox">
    <button class="tlab" id="caplab" aria-expanded="true">Caption<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
    <textarea id="pnote" rows="3"></textarea>
  </div>
  <div class="tbox" id="prombox">
    <button class="tlab" id="promlab" aria-expanded="false">Drawing prompt<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
    <div id="drawbox" hidden>
      <textarea id="dprompt" rows="3" placeholder="what to draw"></textarea>
      <div id="promhint" hidden>empty — this beat draws from its caption</div>
      <div class="drawrow">
        <button id="dchar" class="on" aria-label="Draw Sophie from her reference"><img src="/scratchpad-sophie.png" alt="Sophie"></button>
        <select id="dq" aria-label="Quality"><option value="low">low</option><option value="medium" selected>medium</option><option value="high">high</option></select>
        <button id="dgo">Draw</button>
      </div>
    </div>
  </div>
  <div class="poprow">
    <button id="speak" aria-label="Hear it in your voice"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/></svg></button>
    <button id="micbtn" aria-label="Record yourself reading it"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg></button>
    <button id="linkbtn" hidden aria-label="Link with the next beat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>
    <button id="unlinkbtn" hidden aria-label="Break this chunk apart"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="m5.17 11.75-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="8" x2="8" y1="2" y2="5"/><line x1="2" x2="5" y1="8" y2="8"/><line x1="16" x2="16" y1="19" y2="22"/><line x1="19" x2="22" y1="16" y2="16"/></svg></button>
    <button id="coverbtn" hidden aria-label="Make this the story's cover on the shelf"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></button>
    <button id="delbtn" aria-label="Delete this beat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg></button>
  </div>
  </div></div>
</div>

<div id="lightbox" hidden><img id="lbimg" alt=""></div>

<div id="delask" hidden>
  <div class="bulkbox">
    <p id="delline">Delete this beat? Its pictures are already saved in your galleries.</p>
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
    /* /style and /upload don't stale the film: flipping the view is not an
       edit (the film's own `style` field handles the flip), and an upload
       still waiting in the add sheet isn't on the timeline yet.
       `/film*` is matched by PREFIX so that /film/cancel is covered too —
       stopping a render changes nothing about the story, and marking it dirty
       would make the next play button re-render a film that was already
       fresh. */
    if(p.indexOf('/film')!==0&&p.indexOf('/pads')!==0&&p!=='/tts'&&p!=='/style'&&p!=='/upload') dirtySinceFilm=true;
  } else if(p.indexOf('/pads')!==0){
    p+=(p.indexOf('?')>=0?'&':'?')+'pad='+encodeURIComponent(padId);
  }
  return fetch('/api/scratchpad'+p,opts);
}
var beats=[], inboxItems=[], uploads=[], pending=null, popBeat=null, padTitle='';
var player=new Audio();
/* ── the STYLE TOGGLE: watercolor ↔ dreamy ──────────────────────────
   One story, two sets of art over the SAME beats (Sophie, Aug 2026): the
   words, colors, voice and order are shared; only the pictures differ.
   "watercolor" is the pad's original look and lives where it always did
   (beat.url/src/gen/imageHistory); "dreamy" lives in beat.alt.dreamy, empty
   until she fills it. slotOf() is the one accessor — everything that touches
   ART goes through it, so the rest of the page never asks which side is up.
   A CLIP is per-style TOO (2026-08-23, Sophie, after movies she added on
   the dreamy side showed up on watercolor): a slot holds a picture OR a
   clip, so "is this a clip" is a question about the side she is showing. */
var padStyle='watercolor';
function slotOf(b){
  return padStyle==='dreamy' ? ((b.alt&&b.alt.dreamy)||{}) : b;
}
function clipOf(b){ var s=slotOf(b); return Boolean(s&&s.kind==='clip'); }
/* The side she DELETED this beat from (2026-08-23, Sophie: "leave it in the
   other style cause that one might have an image for that"). The beat keeps
   its place and its words on the side that still wants it; here it is
   simply not drawn. */
function beatOff(b){ var s=slotOf(b); return Boolean(s&&s.off); }
function otherSlotOf(b){ return padStyle==='dreamy' ? b : ((b.alt&&b.alt.dreamy)||{}); }
function slotDrawing(b){ var s=slotOf(b); return Boolean(s.gen&&s.gen.status==='drawing'); }
function renderStyle(){
  document.getElementById('styletog').setAttribute('data-a', padStyle==='dreamy'?'2':'1');
  document.getElementById('swwater').classList.toggle('on', padStyle!=='dreamy');
  document.getElementById('swdreamy').classList.toggle('on', padStyle==='dreamy');
}
function setStyle(s){
  if(s===padStyle)return;
  padStyle=s; renderStyle(); render(); renderFilm();
  api('/style',{method:'POST',body:JSON.stringify({style:s})}).catch(function(){});
  if(anyDrawing()) startGenPoll();
}
document.getElementById('styletog').onclick=function(ev){ ev.stopPropagation(); setStyle(padStyle==='dreamy'?'watercolor':'dreamy'); };
document.getElementById('swwater').onclick=function(ev){ ev.stopPropagation(); setStyle('watercolor'); };
document.getElementById('swdreamy').onclick=function(ev){ ev.stopPropagation(); setStyle('dreamy'); };

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
/* Chunks are grouped over the WHOLE list (a chunk link is shared by both
   styles), then each unit is drawn from the members this side still has —
   a unit whose every member was deleted here is not drawn at all. `at`
   stays the TRUE index into `beats`, so placing a new beat next to a
   visible one lands where she expects however many hidden ones sit
   between. */
function padUnits(){
  var units=[], i=0;
  while(i<beats.length){
    var b=beats[i], members=[b];
    if(b.chunk){ while(i+members.length<beats.length && beats[i+members.length].chunk===b.chunk) members.push(beats[i+members.length]); }
    var shown=members.filter(function(m){ return !beatOff(m); });
    if(shown.length) units.push({members:shown, at:i});
    i+=members.length;
  }
  return units;
}
/* A beat can be a FILM CLIP (Aug 2026, Sophie: "can u add film clips to
   story room") — an ordinary beat whose url is an mp4. It tiles as its
   POSTER with a film mark, never as a <video>: a page of decoding videos is
   what makes a phone crawl, and the pad is a thinking surface. */
function isClip(b){ return Boolean(b&&b.kind==='clip'); }
/* What a beat SHOWS in the current style — the slot's picture, or its
   clip's poster. Under dreamy an unfilled beat is honestly blank. */
function artOf(b){
  if(!b)return null;
  var s=slotOf(b);
  return s.kind==='clip'?(s.poster||null):(s.url||null);
}
/* A beat that is a SHOT in the current style's film — art, or a clip
   (both live on the slot's url). */
function hasShot(b){ return Boolean(slotOf(b).url); }
var FILM_TRI='<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M6 4.5v15l13-7.5z"/></svg>';
function filmMark(mid){
  var m=document.createElement('span'); m.className='fmark'+(mid?' mid':'');
  m.innerHTML=FILM_TRI; return m;
}
/* Fills a tile (or a chunk slice) with what the beat shows. */
function fillTile(el, b){
  var art=artOf(b);
  if(art){ var im=document.createElement('img'); im.src=art; im.alt=''; el.appendChild(im); }
  if(clipOf(b)) el.appendChild(filmMark(!art));
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
      el.className='beat'+(b.color?' c-'+b.color:'')+(slotDrawing(b)?' drawing':'');
      fillTile(el, b);
      el.onclick=function(ev){ev.stopPropagation(); if(pending)return; openBeat(b);};
      wrap.appendChild(el);
      capFor(wrap, b);
    } else {
      var ck=document.createElement('div'); ck.className='chunk'+(u.members[0].color?' c-'+u.members[0].color:'');
      u.members.forEach(function(m){
        var sl=document.createElement('button'); sl.className='slice';
        fillTile(sl, m);
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
/* THE PLAY BUTTON BECOMES THE CANCEL WHILE IT IS MAKING (Aug 2026, Sophie:
   "add a cancel button to the play which makes the film button in story
   room"). ONE control, two states, and it had to be one: the title row
   already carries six 34px icons on a 390pt phone (the same measurement that
   put the style toggle on its own line), so a seventh would have squeezed the
   story's name to nothing exactly while a render was running.
   It also fixes what was there before — a DEAD control: the button sat
   disabled at .45 opacity for the whole render, so the one thing on screen
   she might want to tap did nothing.
   No arming delay on the swap, deliberately: the film is free (ffmpeg on our
   own box, no model call), so the cost of a stray double-tap is one more tap
   to start it again — and a button that ignores her for a second to protect
   her from that reads as broken. */
var FILM_PLAY='<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M6 4.5v15l13-7.5z"/></svg>';
var FILM_STOP='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
var film=null, padUpdated=0, dirtySinceFilm=false, autoplayWanted=false;
function filmFresh(){
  // Server-clock to server-clock only — never compare against the phone's.
  // A film is also only fresh for the STYLE it was cut in: the watercolor
  // render is not the dreamy film, however recent it is.
  return Boolean(film&&film.url&&film.status==='done'&&!dirtySinceFilm&&(film.at||0)>=(padUpdated-2500)
    &&(film.style||'watercolor')===padStyle);
}
function renderFilm(){
  var note=document.getElementById('filmnote');
  var play=document.getElementById('playbtn');
  var making=Boolean(film&&film.status==='making');
  play.hidden=!beats.some(hasShot);
  play.disabled=false;
  play.style.opacity='';
  play.innerHTML=making?FILM_STOP:FILM_PLAY;
  play.setAttribute('aria-label',making?'Stop making the film':'Watch the film');
  var msg=making?('making the film… '+(film.progress||''))
    :(film&&film.status==='failed'?(film.error||'the film failed')
    :(film&&film.status==='canceled'?'film stopped':''));
  note.textContent=msg;
  document.getElementById('filmrow').hidden=!msg;
}
/* ── listen: every recording attached to this story ─────────────────
   (Aug 2026, Sophie: the NDE montages "should be connected to their
   stories so I can listen to them when I go to their story"; then "a
   story can hold multiple audios … hide them all behind a single icon
   that has a wave form".) Two kinds arrive in ONE `audios` list from
   GET /: the linked episodes, resolved to their newest render, and the
   source recordings — the voice memos the story came out of. The rows
   reuse the page's ONE player, so a tap replaces whatever is speaking —
   a beat's line, another recording — never stacks. */
var audios=[];
var AU_PLAY='<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M6 4.5v15l13-7.5z"/></svg>';
var AU_PAUSE='<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>';
function fmtDur(s){
  s=Math.round(Number(s)||0); if(!s)return '';
  return Math.floor(s/60)+':'+('0'+(s%60)).slice(-2);
}
function auGlyphs(){
  var rows=document.querySelectorAll('#audios .aurow');
  for(var i=0;i<rows.length;i++){
    var on=player.src===rows[i]._url&&!player.paused&&!player.ended;
    rows[i].querySelector('.iconbtn').innerHTML=on?AU_PAUSE:AU_PLAY;
  }
}
player.addEventListener('play',auGlyphs);
player.addEventListener('pause',auGlyphs);
player.addEventListener('ended',auGlyphs);
function renderAudios(){
  var box=document.getElementById('audios');
  box.innerHTML='';
  /* No recordings, no button — an empty sheet is a tap that says nothing. */
  document.getElementById('audiobtn').hidden=!audios.length;
  /* Confirmed audio first, then the CANDIDATES under their own header — a
     chat's guesses, playable here so she judges them by ear in the story's
     own context. Ordering is the whole feature: a candidate must never sit
     among the attached rows as if she had already said yes. */
  var ordered=audios.filter(function(a){return !a.candidate;})
    .concat(audios.filter(function(a){return a.candidate;}));
  var headed=false;
  ordered.forEach(function(a){
    if(a.candidate&&!headed){
      headed=true;
      var h=document.createElement('div'); h.className='auhead';
      h.textContent='Candidates'; box.appendChild(h);
    }
    var row=document.createElement('div'); row.className='aurow'; row._url=a.url;
    var b=document.createElement('button'); b.className='iconbtn';
    b.setAttribute('aria-label','Listen — '+a.title);
    b.innerHTML=AU_PLAY;
    b.onclick=function(ev){
      ev.stopPropagation();
      /* play() synchronously in the tap — the iOS rule */
      if(player.src===a.url&&!player.paused){ player.pause(); }
      else if(player.src===a.url){ player.play(); }
      else { player.pause(); player.src=a.url; player.play(); }
      auGlyphs();
    };
    var tx=document.createElement('div'); tx.className='autxt';
    var nm=document.createElement('div'); nm.className='aunm'; nm.textContent=a.title;
    tx.appendChild(nm);
    /* A memo's date is how she recognises it — it is what the Memos app
       shows under the name. An episode has no date worth the line. */
    if(a.date){
      var dt=document.createElement('div'); dt.className='audate'; dt.textContent=a.date;
      tx.appendChild(dt);
    }
    var du=document.createElement('div'); du.className='audur'; du.textContent=fmtDur(a.seconds);
    row.appendChild(b); row.appendChild(tx); row.appendChild(du);
    box.appendChild(row);
  });
  auGlyphs();
}
/* The sheet deliberately does NOT stop the player on close: a recording she
   started is meant to keep going while she reads the beats it became. */
document.getElementById('audiobtn').onclick=function(ev){
  ev.stopPropagation();
  var sh=document.getElementById('ausheet');
  sh.hidden=false; sh.scrollTop=0; lock(true);
};
document.getElementById('auclose').onclick=function(ev){
  ev.stopPropagation();
  document.getElementById('ausheet').hidden=true; lock(false);
};

/* ── what the buttons do ────────────────────────────────────────────
   Sophie, Aug 2026: "add an info icon that says what all the buttons do".
   The page is all unlabelled glyphs by design (the pad is minimal and no
   machinery lives on the canvas), so the legend is the one place the words
   live.
   EVERY GLYPH IS CLONED FROM THE REAL BUTTON — `sel` names the control and
   the row copies its innerHTML. A second hand-drawn copy of each icon would
   drift the first time one is changed, and the drift would be invisible:
   the legend would go on looking right while describing a page that no
   longer exists. A control the page doesn't have (a beat's own buttons
   before one is opened) simply draws no box. */
var HELP=[
  {sel:'#shelfback', nm:'Back', what:'To the shelf. In the app the chevron at the top of the screen does this.'},
  {sel:'#descbtn', nm:'About this story', what:'What you said the story is, and the recordings it came out of.'},
  {sel:'#audiobtn', nm:'Listen', what:'Every recording attached to this story — the memos it came from, and the episodes cut out of it.'},
  {sel:'#playbtn', nm:'Play the film', what:'Watches your film. If the story changed since the last one it makes a new film first, then plays it. While it is making, this button turns into an ✕ that stops it — nothing is lost and it costs nothing to start again.'},
  {sel:'#drawallbtn', nm:'Draw them all', what:'Draws every beat that has words but no picture yet. It asks first and says how many.'},
  {sel:'#addbtn', nm:'Add a beat', what:'Puts an empty beat at the end.'},
  {sel:'#inboxbtn', nm:'Your pictures and clips', what:'Everything you hearted in the Playground, plus the clip shelf and photos off your phone — tap one to put it on the pad.'},
  {sel:null, nm:'Watercolor / Dreamy', what:'Which set of pictures the story is showing. The words, colours, voice and order are shared; only the art changes — and the film is made from the side you are looking at.'},
  {sel:null, nm:'Tap a beat', what:'Opens its card: the picture, the colour chips, its words, and the buttons below.'},
  {sel:'#ardraw', nm:'Draw it', what:'Draws this beat here, from its words.'},
  {sel:'#arplay', nm:'Playground', what:'Opens the Playground to make its art there instead.'},
  {sel:'#arinbox', nm:'From the inbox', what:'Swaps in a picture or clip you already have.'},
  {sel:'#speak', nm:'Hear it', what:'Reads the beat aloud in your voice.'},
  {sel:'#micbtn', nm:'Record it', what:'Records you reading it. Your own take always wins over the read-aloud, and every take is kept.'},
  {sel:'#linkbtn', nm:'Link', what:'Joins this beat to the next one into a chunk, sharing one frame.'},
  {sel:'#unlinkbtn', nm:'Unlink', what:'Breaks the chunk back apart.'},
  {sel:'#coverbtn', nm:'Make it the cover', what:'This picture becomes the story’s tile on the shelf.'},
  {sel:'#delbtn', nm:'Delete the beat', what:'Asks first. Its pictures stay in your galleries.'},
];
function mkHelp(){
  var box=document.getElementById('helpbody');
  box.innerHTML='';
  HELP.forEach(function(h){
    var row=document.createElement('div'); row.className='hrow';
    var src=h.sel?document.querySelector(h.sel):null;
    if(src){
      var b=document.createElement('span'); b.className='iconbtn';
      b.innerHTML=src.innerHTML; row.appendChild(b);
    } else { row.className+=' nogl'; }
    var tx=document.createElement('div'); tx.className='htxt';
    var nm=document.createElement('div'); nm.className='hnm'; nm.textContent=h.nm;
    var wt=document.createElement('div'); wt.className='hwhat'; wt.textContent=h.what;
    tx.appendChild(nm); tx.appendChild(wt); row.appendChild(tx);
    box.appendChild(row);
  });
}
document.getElementById('helpbtn').onclick=function(ev){
  ev.stopPropagation();
  /* Built on the TAP, never at load: the play button's glyph depends on
     whether a film is making right now, so a list built once would show the
     wrong one. */
  mkHelp();
  var sh=document.getElementById('helpsheet');
  sh.hidden=false; sh.scrollTop=0; lock(true);
};
document.getElementById('helpclose').onclick=function(ev){
  ev.stopPropagation();
  document.getElementById('helpsheet').hidden=true; lock(false);
};

function playFilm(){
  if(!film||!film.url)return;
  player.pause();   // the film's sound must not fight an episode's
  var v=document.getElementById('filmvid');
  v.src=film.url;
  document.getElementById('filmplay').hidden=false; lock(true);
  window.__scrollStop&&window.__scrollStop();
  v.play();
}
/* Stop the render. The button flips back to play at once — she asked it to
   stop, so the screen says stopped whatever the server is still unwinding —
   and the poll is cleared here rather than left to notice, so nothing can
   paint 'making' back over it. `autoplayWanted` is dropped with it: a film
   she stopped must never open its own player a minute later. */
function cancelFilm(){
  autoplayWanted=false;
  filmGen++;
  if(filmTimer){ clearInterval(filmTimer); filmTimer=null; }
  film=Object.assign({},film,{status:'canceled',progress:''}); renderFilm();
  api('/film/cancel',{method:'POST',body:JSON.stringify({})}).catch(function(){});
}
document.getElementById('playbtn').onclick=function(ev){
  ev.stopPropagation();
  if(film&&film.status==='making'){ cancelFilm(); return; }
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
/* What a beat draws: its own stored prompt, else its words stripped of
   speech markup — the server's promptFor, kept in step. */
function promptOf(b){
  var p=String((b&&b.prompt)||'').trim();
  return p||stripSpeech(b&&b.text);
}
function drawables(){
  // Per STYLE: a beat whose watercolor is drawn but whose dreamy slot is
  // empty is exactly what the toggle exists to fill.
  return beats.filter(function(b){
    var s=slotOf(b);
    if(s.kind==='clip')return false;   // a clip slot never draws; the OTHER side still can
    if(s.off)return false;             // deleted from this side — never draw it back
    return !s.url && !(s.gen&&s.gen.status==='drawing') && promptOf(b);
  });
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
  api('/drawall',{method:'POST',body:JSON.stringify({quality:document.getElementById('bq').value,style:padStyle})})
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
/* A poll can be IN FLIGHT when she cancels, and the server may not have
   written 'canceled' yet — so its answer still says 'making'. Landing it
   would paint the ✕ back on with no timer left to correct it, i.e. a render
   she stopped, stuck on screen forever. Every poll carries the generation it
   was fired in and a stale one is dropped whole. */
var filmGen=0;
function startFilmPoll(){
  if(filmTimer)return;
  var gen=filmGen;
  filmTimer=setInterval(function(){
    api('').then(function(r){return r.json()}).then(function(d){
      if(gen!==filmGen)return;
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
    padStyle=(d.style==='dreamy')?'dreamy':'watercolor'; renderStyle();
    uploads=d.uploads||[];
    audios=d.audios||[]; renderAudios();
    padUpdated=d.updatedAt||0; dirtySinceFilm=false;
    padDesc=d.description||''; padDescAudio=d.descriptionAudio||null;
    padVoice=(d.voiceover&&d.voiceover.url)?d.voiceover.url:null;
    document.getElementById('descbtn').hidden=!(padDesc||padDescAudio||padVoice);
    renderTitle(); render(); renderFilm();
    if(anyDrawing()) startGenPoll();   // a draw survives leaving the app
    if(film&&film.status==='making') startFilmPoll();
  });
}

/* ── the shelf: every story, newest-touched first ──────────────────
   The NEW look (Aug 2026, the survey prototype): Personal · Lessons · NDE
   chips over portrait tiles, a real picture from each story and its name.
   Tap a tile → straight to that story's beat canvas (Sophie's call). A story
   with no category files under Personal so a brand-new one is never
   invisible; the chip choice is session-only, every open starts on Personal.
   The old row list is the fallback ONLY — nothing links to it; ?plain=1 is
   the one way in. */
var SHELF_CATS=[['Personal','personal'],['Lessons','lessons'],['NDE','nde']];
var shelfCat='personal';
var PLAIN_SHELF=/(\?|&)plain=1/.test(location.search);
var shelfPads=[];
function thumbOf(u){return '/api/story/thumb?w=240&url='+encodeURIComponent(u);}
/* THE SHELF IS THE ROOM (2026-08-23, Sophie). It is still drawn as a .sheet —
   opaque, inset:0, its own scroller — but it is no longer somewhere you go:
   the page OPENS here (see the bottom of this file), a story is the level
   below it, and the back chevron is what walks between them. */
function openShelf(){
  var sh=document.getElementById('stories');
  if(!sh.hidden) return;
  sh.hidden=false; sh.scrollTop=0; lock(true); sheetPill(sh);
  paintShelfBack();
  api('/pads').then(function(r){return r.json()}).then(function(d){
    shelfPads=d.pads||[];
    if(PLAIN_SHELF) renderPlainShelf(); else renderShelf();
  });
}
/* The page's own chevron (a plain browser only — the CSS above hides it under
   both app builds) belongs to a STORY, because the shelf has nothing above
   it. `padOpened` is what says a story is showing: padId is remembered across
   loads, so it cannot answer that on its own. */
var padOpened=false;
function paintShelfBack(){
  document.getElementById('shelfback').hidden =
    !padOpened || !document.getElementById('stories').hidden;
}
/* PINNED STORIES LEAD, THE REST GO BEHIND "see more" (Aug 2026, Sophie: "a
   pinning feature where i can pin a couple stories i'm actively working on and
   the rest go behind a see more toggle"). The fold only exists once something
   in this category is pinned — with no pins the shelf is the whole shelf, as
   it always was, because a "see more" hiding EVERY story would be a shelf with
   nothing on it. Pinned ones keep the newest-first order among themselves.
   The open/closed state is per category and per visit: tapping a chip is
   asking for that shelf fresh. */
var SHELF_PIN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle class="pinhead" cx="12" cy="6.6" r="4.4"/><path d="M12 11V21.6"/></svg>';
var shelfMore=false;
function shelfTile(p){
  var t=document.createElement('button'); t.className='stile'+(p.id===padId?' cur':'');
  var cov=document.createElement('span'); cov.className='cov';
  if(p.cover){
    var im=document.createElement('img'); im.alt=''; im.loading='lazy';
    im.src=thumbOf(p.cover); cov.appendChild(im);
  } else {
    var n=document.createElement('span'); n.className='none'; cov.appendChild(n);
  }
  var pin=document.createElement('span');
  pin.className='pinpin'+(p.pinned?' on':''); pin.innerHTML=SHELF_PIN;
  pin.setAttribute('role','button');
  pin.setAttribute('aria-label',p.pinned?'Unpin this story':'Pin this story to the top');
  pin.title=pin.getAttribute('aria-label');
  /* The pin sits INSIDE the tile, which is itself a button, so the tap has to
     be stopped here or pinning a story would also open it. */
  pin.onclick=function(e){ e.preventDefault(); e.stopPropagation(); togglePin(p); };
  cov.appendChild(pin);
  t.appendChild(cov);
  var nm=document.createElement('span'); nm.className='snm'+(p.title?'':' blank');
  nm.textContent=p.title||'Untitled'; t.appendChild(nm);
  t.onclick=function(e){ e.stopPropagation(); openPad(p.id); };
  return t;
}
function togglePin(p){
  var was=!!p.pinned; p.pinned=!was; renderShelf();
  api('/pads/pin',{method:'POST',body:JSON.stringify({pad:p.id, pinned:!was})})
    .then(function(r){ if(!r.ok) throw 0; })
    .catch(function(){ p.pinned=was; renderShelf(); });
}
function renderShelf(){
  var cats=document.getElementById('shelfcats');
  var tiles=document.getElementById('shelftiles');
  document.getElementById('storylist').hidden=true;
  cats.hidden=false; tiles.hidden=false;
  cats.innerHTML='';
  SHELF_CATS.forEach(function(c){
    var b=document.createElement('button'); b.className='scat'+(c[1]===shelfCat?' on':'');
    b.textContent=c[0];
    b.onclick=function(e){ e.stopPropagation(); shelfCat=c[1]; shelfMore=false; renderShelf(); };
    cats.appendChild(b);
  });
  tiles.innerHTML='';
  var mine=shelfPads.filter(function(p){ return (p.category||'personal')===shelfCat; });
  var pinned=mine.filter(function(p){ return p.pinned; });
  var rest=mine.filter(function(p){ return !p.pinned; });
  var show=pinned.length ? pinned.concat(shelfMore?rest:[]) : mine;
  show.forEach(function(p){ tiles.appendChild(shelfTile(p)); });
  if(pinned.length && rest.length){
    var more=document.createElement('button'); more.id='shelfmore';
    more.textContent=shelfMore?'see less':'see more ('+rest.length+')';
    more.onclick=function(e){ e.stopPropagation(); shelfMore=!shelfMore; renderShelf(); };
    tiles.appendChild(more);
  }
}
function renderPlainShelf(){
  document.getElementById('shelfcats').hidden=true;
  document.getElementById('shelftiles').hidden=true;
  var list=document.getElementById('storylist'); list.hidden=false; list.innerHTML='';
  shelfPads.forEach(function(p){
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
}
function closeShelf(){
  var sh=document.getElementById('stories');
  if(sh._stopPill) sh._stopPill();
  sh.hidden=true; lock(false); paintShelfBack();
}
/* The shelf's own chevron used to drop back onto the story behind it. Nothing
   is behind it any more, so it does what the app's chevron does at the top of
   a tool: leaves. In a plain browser there is nothing to leave to, so it goes
   back through history if there is any and otherwise stays put — a browser
   tab opened straight at /storyroom has no outside to return to. */
document.getElementById('storiesclose').onclick=function(ev){
  ev.stopPropagation();
  if(window.__forgeLeave){ window.__forgeLeave(); return; }
  if(history.length>1) history.back();
};

/* ── About this story: what she said about it, verbatim + recordings ──
   Data-only fields on the pad doc (a chat writes them); the sheet is
   read-only. When descriptionAudio and the voiceover are the SAME file
   (a lesson whose source IS her read-aloud) only one player shows. */
var padDesc='', padDescAudio=null, padVoice=null;
document.getElementById('descbtn').onclick=function(ev){
  ev.stopPropagation();
  var au=document.getElementById('descaudios'); au.innerHTML='';
  function row(label,url){
    if(!url) return;
    var d=document.createElement('div'); d.className='arow';
    var n=document.createElement('div'); n.className='no'; n.textContent=label; d.appendChild(n);
    var a=document.createElement('audio'); a.controls=true; a.preload='none'; a.src=url;
    d.appendChild(a); au.appendChild(d);
  }
  if(padDescAudio && padVoice===padDescAudio){ row('Your recording', padDescAudio); }
  else { row('As you told it', padDescAudio); row('Your narration', padVoice); }
  var b=document.getElementById('descbody');
  b.textContent=padDesc; b.hidden=!padDesc;
  var sh=document.getElementById('descsheet');
  sh.hidden=false; sh.scrollTop=0; lock(true); sheetPill(sh);
};
document.getElementById('descclose').onclick=function(ev){
  ev.stopPropagation();
  var sh=document.getElementById('descsheet');
  var as=sh.querySelectorAll('audio');
  for(var i=0;i<as.length;i++) as[i].pause();
  if(sh._stopPill) sh._stopPill();
  sh.hidden=true; lock(false);
};
function openPad(id){
  padId=id; padOpened=true; localStorage.setItem('scratchpad_pad',id);
  if(genTimer){ clearInterval(genTimer); genTimer=null; }
  filmGen++;   // an in-flight poll belongs to the story she just left
  if(filmTimer){ clearInterval(filmTimer); filmTimer=null; }
  film=null; padUpdated=0; dirtySinceFilm=false; autoplayWanted=false; renderFilm();
  player.pause(); audios=[]; renderAudios();
  padStyle='watercolor'; renderStyle(); uploads=[];
  closeShelf();
  beats=[]; padTitle=''; render();
  load();
}
document.getElementById('shelfback').onclick=function(ev){
  ev.stopPropagation(); openShelf();
};
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
// A pill for a sheet: same three buttons as the page's, but it scrolls the
// sheet, which is its own scroller.
function sheetPill(sheet){
  var old=sheet.querySelector('.sfloat'); if(old) old.remove();
  var I={up:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
         down:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
         play:'<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
         pause:'<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="4.5" height="16" rx="1"/><rect x="14.5" y="4" width="4.5" height="16" rx="1"/></svg>'};
  var el=document.createElement('div'); el.className='sfloat';
  el.innerHTML='<div class="vseg"><button class="su"></button><button class="sm"></button><button class="sd"></button></div>';
  var up=el.querySelector('.su'), mid=el.querySelector('.sm'), dn=el.querySelector('.sd');
  var playing=false, raf=null, last=null, dir=1, acc=0;
  function paint(){ up.innerHTML=I.up; dn.innerHTML=I.down; mid.innerHTML=playing?I.pause:I.play;
    mid.classList.toggle('on',playing); }
  function step(ts){ if(!playing) return;
    if(last!=null){ acc+=dir*(ts-last)/1000*80;
      var m=acc>0?Math.floor(acc):Math.ceil(acc);
      if(m){ sheet.scrollTop+=m; acc-=m; }
      if(dir>0 && sheet.scrollTop+sheet.clientHeight>=sheet.scrollHeight-4) return stop();
      if(dir<0 && sheet.scrollTop<=2) return stop(); }
    last=ts; raf=requestAnimationFrame(step); }
  function start(d){ dir=d; playing=true; last=null; acc=0; paint(); raf=requestAnimationFrame(step); }
  function stop(){ playing=false; if(raf) cancelAnimationFrame(raf); raf=null; paint(); }
  up.onclick=function(e){ e.stopPropagation(); playing?stop():start(-1); };
  dn.onclick=function(e){ e.stopPropagation(); playing?stop():start(1); };
  mid.onclick=function(e){ e.stopPropagation(); playing?stop():start(1); };
  sheet.addEventListener('pointerdown',function(ev){ if(!ev.target.closest('.sfloat')) stop(); },true);
  paint(); sheet.appendChild(el); sheet._stopPill=stop;
  return el;
}
/* ── the add sheet's two tabs: PICTURES · CLIPS ────────────────────
   The line MEASURES the lit tab, so the tab count lives nowhere (the house
   `.acctabs` rule). */
var inboxTab=0, shelfClips=null, clipQ='';
function tabLine(){
  var tabs=document.getElementById('inboxtabs');
  var on=tabs.querySelector('.acctab.on'); if(!on) return;
  var r=tabs.getBoundingClientRect(), t=on.getBoundingClientRect();
  if(!t.width) return;
  tabs.style.setProperty('--tw', t.width+'px');
  tabs.style.setProperty('--tx', (t.left-r.left-tabs.clientLeft)+'px');
  if(!tabs.__tl){ tabs.__tl=1; requestAnimationFrame(function(){ tabs.classList.add('tl'); }); }
}
window.addEventListener('resize',function(){
  var tabs=document.getElementById('inboxtabs');
  tabs.classList.remove('tl'); tabs.__tl=0; requestAnimationFrame(tabLine);
},{passive:true});
function showInboxTab(i){
  inboxTab=i;
  document.getElementById('tab-pics').classList.toggle('on',i===0);
  document.getElementById('tab-clips').classList.toggle('on',i===1);
  document.getElementById('picpane').hidden=i!==0;
  document.getElementById('clippane').hidden=i!==1;
  var no=document.getElementById('inboxno');
  if(i===1) no.textContent='From the clip shelf';
  else no.textContent=inboxSource==='story'?'This story\u2019s art':'From the Playground';
  tabLine();
  if(i===1&&shelfClips===null) loadClips();
}
document.getElementById('tab-pics').onclick=function(ev){ ev.stopPropagation(); showInboxTab(0); };
document.getElementById('tab-clips').onclick=function(ev){ ev.stopPropagation(); showInboxTab(1); };

/* The Chunking clip library, read-only. A clip is REFERENCED, never copied
   (Assembly's rule) — and unlike the picture inbox, a clip already on the pad
   is NOT filtered out: the shelf is a library, and one clip can legitimately
   come round twice in a story. */
function loadClips(){
  var g=document.getElementById('clipgrid');
  api('/shelf'+(clipQ?'?q='+encodeURIComponent(clipQ):'')).then(function(r){return r.json()}).then(function(d){
    shelfClips=d.clips||[];
    g.innerHTML='';
    document.getElementById('clipempty').hidden=Boolean(shelfClips.length);
    if(!shelfClips.length&&clipQ) document.getElementById('clipempty').textContent='No clips match that.';
    else document.getElementById('clipempty').textContent='No clips on the shelf yet.';
    shelfClips.forEach(function(c){
      var el=document.createElement('button');
      var po=document.createElement('span'); po.className='cpost';
      if(c.poster){ var im=document.createElement('img'); im.src=c.poster; im.alt=''; im.loading='lazy'; po.appendChild(im); }
      po.appendChild(filmMark(!c.poster));
      el.appendChild(po);
      var nm=document.createElement('span'); nm.className='cnm'; nm.textContent=c.title||'Untitled clip'; el.appendChild(nm);
      if(c.seconds){ var du=document.createElement('span'); du.className='cdur'; du.textContent=Math.round(c.seconds)+'s'; el.appendChild(du); }
      el.onclick=function(ev){ ev.stopPropagation(); pick({film:true, clip:c}); };
      g.appendChild(el);
    });
  }).catch(function(){});
}
/* The house search contract on a live box: iOS dictation can fill a field
   without ever firing `input`, so the value is POLLED while it has focus,
   and RETURN runs it at once and drops the keyboard. */
(function(){
  var box=document.getElementById('clipq'), timer=null, poll=null, last='';
  function sync(){
    var v=box.value.trim();
    if(v===last) return;
    last=v;
    clearTimeout(timer);
    timer=setTimeout(function(){ clipQ=v; loadClips(); },350);
  }
  box.onclick=function(ev){ ev.stopPropagation(); };
  box.addEventListener('input',sync);
  box.addEventListener('focus',function(){ poll=setInterval(sync,300); });
  box.addEventListener('blur',function(){ clearInterval(poll); poll=null; sync(); });
  box.addEventListener('keydown',function(ev){
    if(ev.key!=='Enter') return;
    ev.preventDefault();
    clearTimeout(timer);
    last=box.value.trim(); clipQ=last; loadClips();
    box.blur();
  });
})();

var inboxSource='playground';
/* A picture she has already placed is gone from here, not dimmed: the inbox
   is what is still waiting to be used (Sophie, Aug 2026). "Placed" means on
   EITHER side of the style toggle, and covers her uploads too. */
function urlsOnPad(){
  var onPad={};
  beats.forEach(function(b){
    if(b.url)onPad[b.url]=1;
    if(b.alt&&b.alt.dreamy&&b.alt.dreamy.url)onPad[b.alt.dreamy.url]=1;
  });
  return onPad;
}
function renderInboxGrid(){
  var g=document.getElementById('inboxgrid'); g.innerHTML='';
  var onPad=urlsOnPad();
  /* Her phone uploads lead the grid \u2014 the thing she just added is the thing
     she came to place. A movie tiles as its poster with the film mark and
     places as a CLIP beat; a photo places as a picture. Phone photos are
     huge, so the tile loads a derived thumb, never the original. */
  var ups=uploads.filter(function(u){ return u&&u.url&&!onPad[u.url]; });
  ups.forEach(function(u){
    var el=document.createElement('button');
    var face=u.kind==='clip'?(u.poster||null):thumbOf(u.url);
    if(face){ var im=document.createElement('img'); im.src=face; im.alt=''; im.loading='lazy'; el.appendChild(im); }
    if(u.kind==='clip') el.appendChild(filmMark(!u.poster));
    el.onclick=function(ev){
      ev.stopPropagation();
      pick(u.kind==='clip'
        ? {film:true, clip:{id:null, url:u.url, poster:u.poster, seconds:null, title:u.title||''}}
        : {url:u.url});
    };
    g.appendChild(el);
  });
  var items=inboxItems.filter(function(it){ return !onPad[it.url]; });
  document.getElementById('inboxempty').hidden=Boolean(items.length||ups.length);
  items.forEach(function(it){
    var el=document.createElement('button');
    var im=document.createElement('img'); im.src=it.url; im.alt=''; im.loading='lazy'; el.appendChild(im);
    // stopPropagation matters: this click must not reach the document-level
    // cancel handler, which would clear the placing mode it just started.
    el.onclick=function(ev){ev.stopPropagation(); pick(it);};
    g.appendChild(el);
  });
}
function openInbox(){
  var sh=document.getElementById('inbox');
  sh.hidden=false; lock(true); sheetPill(sh);
  showInboxTab(inboxTab);
  renderInboxGrid();   // what we already know, instantly
  api('/inbox').then(function(r){return r.json()}).then(function(d){
    inboxItems=d.items||[];
    if(d.uploads)uploads=d.uploads;
    // A story that carries its own gathered art says so; otherwise this is
    // still the Playground hearts.
    inboxSource=d.source||'playground';
    if(inboxTab===0){
      var hd=document.getElementById('inboxno');
      if(hd) hd.textContent = (inboxSource==='story') ? 'This story\u2019s art' : 'From the Playground';
    }
    renderInboxGrid();
  });
}
/* \u2500\u2500 adding straight from her phone (Aug 2026, Sophie: "add clips right
   from my phone into the inbox \u2026 so I can add movies or photos") \u2500\u2500\u2500\u2500\u2500
   The system file picker reads her Photos library by itself. Each file's
   bytes ride the Dump's /api/drop/upload-file (md5 dedupe, HEIC\u2192JPEG, video
   posters \u2014 never a second upload path, the Assembly pattern), one at a
   time so a batch never floods the connection; the finished url is filed on
   the story with POST /upload and lands at the top of this grid, ready to
   place. */
var upSession='';
document.getElementById('upbtn').onclick=function(ev){
  ev.stopPropagation();
  document.getElementById('upfile').click();
};
document.getElementById('upfile').onclick=function(ev){ ev.stopPropagation(); };
document.getElementById('upfile').onchange=function(){
  var files=Array.prototype.slice.call(this.files||[]);
  this.value='';
  if(files.length) uploadBatch(files);
};
function uploadBatch(files){
  var line=document.getElementById('upline');
  var total=files.length, done=0, failed=0;
  function say(){
    line.hidden=false;
    line.textContent=(done+failed<total)
      ? 'adding '+(done+failed+1)+' of '+total+'\u2026'
      : (failed?(failed+(failed===1?' file':' files')+' didn\u2019t make it \u2014 try again'):'');
    if(done+failed>=total&&!failed) line.hidden=true;
  }
  say();
  function next(){
    if(!files.length){ say(); return; }
    var f=files.shift();
    var q='?bundle='+encodeURIComponent(('Story Room \u00b7 '+(padTitle||'Untitled')).slice(0,80))
      +'&filename='+encodeURIComponent(f.name||'upload')
      +(upSession?'&session='+encodeURIComponent(upSession):'');
    var headers={'content-type':f.type||'application/octet-stream'};
    if(TOKEN)headers['x-studio-token']=TOKEN;
    fetch('/api/drop/upload-file'+q,{method:'POST',headers:headers,body:f})
      .then(function(r){return r.json()})
      .then(function(r){
        if(!r||!r.item||!r.item.url)throw new Error((r&&r.error)||'upload failed');
        upSession=r.session||upSession;
        var video=(r.item.media||'image')==='video';
        var item={url:r.item.url, kind:video?'clip':'image',
          poster:video?(r.item.posterUrl||null):null,
          title:String(f.name||'').replace(/\.[a-z0-9]+$/i,'').slice(0,200)};
        return api('/upload',{method:'POST',body:JSON.stringify({item:item})})
          .then(function(r2){return r2.json()})
          .then(function(d){
            if(d.uploads)uploads=d.uploads;
            done++; renderInboxGrid();
          });
      })
      .catch(function(){ failed++; })
      .then(function(){ say(); next(); });
  }
  next();
}
document.getElementById('inboxbtn').onclick=function(){ fillBeat=null; openInbox(); };
document.getElementById('inboxclose').onclick=function(){
  var sh=document.getElementById('inbox'); if(sh._stopPill) sh._stopPill();
  sh.hidden=true;
  if(fillBeat){ var b=fillBeat; fillBeat=null; openBeat(b); return; }
  lock(false);
};

function pick(it){
  document.getElementById('inbox').hidden=true;
  if(fillBeat){
    var target=fillBeat; fillBeat=null;
    var body, path;
    if(it.film){ path='/clip'; body={id:target.id, clip:it.clip, style:padStyle}; }
    else {
      path='/image';
      // style rides along so the picture lands on the side she is looking at
      // (an upload has no run to remember, so it carries no src).
      body={id:target.id, url:it.url, style:padStyle};
      if(it.runId!==undefined) body.src={runId:it.runId,i:it.i,prompt:it.prompt,model:it.model,engine:it.engine,quality:it.quality};
    }
    api(path,{method:'POST',body:JSON.stringify(body)})
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
  var body={at:at}, path='/add';
  if(it.film){ path='/clip'; body.clip=it.clip; body.style=padStyle; }
  else if(!it.empty){
    body.url=it.url; body.style=padStyle;
    if(it.runId!==undefined) body.src={runId:it.runId,i:it.i,prompt:it.prompt,model:it.model,engine:it.engine,quality:it.quality};
  }
  api(path,{method:'POST',body:JSON.stringify(body)})
    .then(function(r){return r.json()})
    .then(function(d){if(d.beats)beats=d.beats;render();});
  render();
}
/* + adds an EMPTY beat — a blank tile whose art comes later (its popup has
   the Playground shortcut for now). Same placement flow as the inbox.
   A SECOND tap is changing her mind (Aug 2026, Sophie: "if I click the plus
   button … and then change my mind and click it again, the lines between
   the clips should disappear"): the + stops propagation, so the document-
   level cancel below never hears it — it has to un-arm here itself. */
document.getElementById('addbtn').onclick=function(ev){
  ev.stopPropagation();
  if(pending){ pending=null; render(); return; }
  if(!beats.length){ place(0, {empty:true}); return; }
  pending={empty:true}; render();
};
/* tapping anywhere that is not a slot quietly cancels placing */
document.addEventListener('click',function(){ if(pending){pending=null;render();} });

/* ── the beat popup: the art at THUMBNAIL size, frame color, text ─── */
function openBeat(b){
  popBeat=b;
  var im=document.getElementById('popimg'), bl=document.getElementById('popblank');
  var vid=document.getElementById('popvid');
  // The popup shows the side the toggle is showing — under dreamy an
  // unfilled beat opens BLANK, with its shared words underneath, which is
  // exactly the fill-it-in state the toggle exists for. A clip is the
  // SLOT's kind: a movie on the dreamy side leaves watercolor a picture.
  var su=slotOf(b);
  var clip=su.kind==='clip';
  // The picture takes the room the card has left (Sophie: "that image is
  // bigger by default") — CSS sizes it inside #artwrap, so nothing here
  // pins a pixel width the way the old thumbnail-sized popup did.
  im.hidden=clip||!su.url; bl.hidden=clip||Boolean(su.url); vid.hidden=!clip;
  if(clip){
    if(vid.src!==su.url){ vid.src=su.url; }
    if(su.poster) vid.poster=su.poster; else vid.removeAttribute('poster');
    vid.className=b.color?'c-'+b.color:'';
  } else if(su.url){ im.src=su.url; im.className=b.color?'c-'+b.color:''; }
  else { bl.className=b.color?'c-'+b.color:''; }
  paintChips(b.color||null);
  closeColors();
  document.getElementById('pnote').value=b.text||'';
  document.getElementById('coverbtn').hidden=!artOf(b);
  document.getElementById('coverbtn').classList.remove('on');
  // Every generation this beat has had — thumbnails, newest first, current
  // ringed — folded behind the stacked-squares button, which only appears
  // once a draw has actually replaced something.
  var vr=document.getElementById('verrow'); vr.innerHTML='';
  var vers=((su.url&&!clip)?[su.url]:[]).concat((su.imageHistory||[]).slice().reverse().map(function(h){return h.url;}).filter(Boolean));
  var av=document.getElementById('arvers');
  av.hidden=vers.length<2; av.classList.remove('on'); vr.hidden=true;
  if(vers.length>1){
    vers.forEach(function(u,i){
      var t=document.createElement('button'); if(i===0&&su.url)t.className='cur';
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
  // The three ways to art sit UNDER the picture in one row now, whether or
  // not there is a picture yet — the blank tile no longer carries its own
  // pair. NEVER on a clip: nothing here draws a film, and a picture-maker
  // over one would only ever replace it.
  document.getElementById('artrow').hidden=clip;
  // Drawing here: the box holds ONLY her own stored prompt — never the
  // caption (2026-08-24: seeding it with the caption meant a beat with no
  // prompt of its own showed the caption's words in the prompt box, so
  // there was nothing on screen to tell "this beat has its own prompt" from
  // "you are about to draw the caption", and Draw sent the caption). Empty
  // means FOLLOW THE CAPTION, which the hint line says out loud.
  document.getElementById('dprompt').value=String(b.prompt||'');
  setBoxes(true,false);
  // Drawing (or a failure) is said in its own line — never by rewriting the
  // blank tile, whose children are the buttons.
  var st=document.getElementById('genstate');
  var drawing=Boolean(su.gen&&su.gen.status==='drawing');
  st.hidden=!(drawing||(su.gen&&su.gen.status==='failed'));
  st.textContent=drawing?'drawing…':((su.gen&&su.gen.error)||'');
  if(drawing){ bl.hidden=clip; im.hidden=true; }
  // A clip's own sound IS its voice — the film plays the tape rather than
  // reading her note over it — so the speak and record icons come off
  // instead of sitting there promising something the render won't do.
  document.getElementById('speak').hidden=clip;
  var mb=document.getElementById('micbtn');
  mb.hidden=clip;
  mb.classList.remove('rec','busy');
  mb.classList.toggle('on',Boolean(b.voiceUrl));
  document.getElementById('beatpop').hidden=false; lock(true);
}
/* Leaving the popup stops a clip — a film still talking behind the pad is
   the same bug as a sheet that keeps scrolling. */
function stopPopVid(){
  var v=document.getElementById('popvid');
  if(!v.hidden){ try{ v.pause(); }catch(e){} }
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
  var opening=box.hidden;
  if(!opening)savePrompt();
  // Opening the prompt folds the caption away (her rule); closing it leaves
  // the caption as she left it rather than forcing it back open.
  // DREAMY never takes the Sophie card (the Playground's noCharacter rule:
  // her card is the watercolor look, the wrong reference there) — setBoxes
  // takes the toggle off rather than leaving it there doing nothing.
  setBoxes(opening?false:document.getElementById('caplab').getAttribute('aria-expanded')==='true', opening);
  if(opening){
    // Only her own prompt goes in the box. An empty box is the honest
    // default and it still DRAWS — from the caption, live, exactly as it
    // always did ("it doesn't take the words I put in" was the old bug and
    // stays fixed: drawPrompt() reads the caption box, never the last
    // SAVED text).
    document.getElementById('dprompt').value=String(popBeat.prompt||'');
    saveNote();
    document.getElementById('dprompt').focus();
  }
}
document.getElementById('ardraw').onclick=openDraw;
/* The stacked squares: past pictures fold out under the row and fold back.
   A toggle, not a trip somewhere else — she is comparing against the one
   on screen. */
document.getElementById('arvers').onclick=function(ev){
  ev.stopPropagation();
  var vr=document.getElementById('verrow');
  vr.hidden=!vr.hidden;
  this.classList.toggle('on',!vr.hidden);
};
document.getElementById('drawbox').onclick=function(ev){ev.stopPropagation();};
document.getElementById('dchar').onclick=function(ev){
  ev.stopPropagation();
  this.classList.toggle('on');
};
document.getElementById('dgo').onclick=function(ev){
  ev.stopPropagation();
  var b=popBeat; if(!b)return;
  var prompt=drawPrompt();
  if(!prompt){ document.getElementById('dprompt').focus(); return; }
  var btn=this; btn.disabled=true;
  saveNote(); savePrompt();
  api('/generate',{method:'POST',body:JSON.stringify({
    id:b.id, prompt:prompt,
    quality:document.getElementById('dq').value,
    style:padStyle,
    character:padStyle!=='dreamy'&&document.getElementById('dchar').classList.contains('on'),
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
/* Watches BOTH sides of the toggle — she can flip away while a dreamy draw
   is still cooking, and the poll must keep going until it lands. */
function anyDrawing(){
  return beats.some(function(b){
    return (b.gen&&b.gen.status==='drawing')
      ||(b.alt&&b.alt.dreamy&&b.alt.dreamy.gen&&b.alt.dreamy.gen.status==='drawing');
  });
}
function startGenPoll(){
  if(genTimer)return;
  genTimer=setInterval(function(){
    if(!anyDrawing()){ clearInterval(genTimer); genTimer=null; return; }
    api('').then(function(r){return r.json()}).then(function(d){
      beats=d.beats||beats; render();
      if(popBeat){
        var fresh=beats.find(function(x){return x.id===popBeat.id;});
        if(fresh&&!slotDrawing(fresh)&&slotDrawing(popBeat)){
          popBeat=fresh; openBeat(fresh);
        } else if(fresh){ popBeat=fresh; }
      }
    }).catch(function(){});
  },4000);
}
function inboxIntoBeat(ev){
  ev.stopPropagation();
  if(!popBeat)return;
  saveNote();
  fillBeat=popBeat;
  document.getElementById('beatpop').hidden=true; popBeat=null;
  openInbox();
}
document.getElementById('arinbox').onclick=inboxIntoBeat;
document.getElementById('arplay').onclick=function(ev){
  ev.stopPropagation();
  location.href='/playground?from=scratchpad';
};
/* ── the frame colour: one square in the corner, dropping down ────── */
function paintChips(col){
  document.querySelectorAll('#colormenu .chip').forEach(function(x){
    x.classList.toggle('on',(x.getAttribute('data-c')||null)===col);
  });
}
function closeColors(){ document.getElementById('colormenu').hidden=true; }
document.getElementById('colorbtn').onclick=function(ev){
  ev.stopPropagation();
  var m=document.getElementById('colormenu');
  m.hidden=!m.hidden;
};
document.getElementById('colormenu').onclick=function(ev){ev.stopPropagation();};
/* A chip sets the frame color, shuts the drop-down, and the popup STAYS
   open (there are text boxes here); tapping outside is what closes it. */
document.querySelectorAll('#colormenu .chip').forEach(function(c){
  c.onclick=function(ev){
    ev.stopPropagation();
    var col=c.getAttribute('data-c')||null;
    if(!popBeat)return;
    popBeat.color=col;
    document.getElementById(clipOf(popBeat)?'popvid':(slotOf(popBeat).url?'popimg':'popblank')).className=col?'c-'+col:'';
    paintChips(col);
    closeColors();
    api('/color',{method:'POST',body:JSON.stringify({id:popBeat.id,color:col})})
      .then(function(r){return r.json()})
      .then(function(d){if(d.beats)beats=d.beats;});
  };
});
/* ── the two text boxes: caption and drawing prompt ───────────────── */
/* Opening the PROMPT folds the caption away — the two together are taller
   than the card wants to be once the picture is big. She can always tap
   Caption to bring it back and have both. */
function setBoxes(capOpen, promOpen){
  var cl=document.getElementById('caplab'), pl=document.getElementById('promlab');
  document.getElementById('pnote').hidden=!capOpen;
  document.getElementById('drawbox').hidden=!promOpen;
  cl.setAttribute('aria-expanded',capOpen?'true':'false');
  pl.setAttribute('aria-expanded',promOpen?'true':'false');
  document.getElementById('dchar').hidden=(padStyle==='dreamy');
  paintPromptHint();
}
document.getElementById('caplab').onclick=function(ev){
  ev.stopPropagation();
  var open=this.getAttribute('aria-expanded')==='true';
  if(open)savePrompt();
  setBoxes(!open, document.getElementById('promlab').getAttribute('aria-expanded')==='true');
  if(!open)document.getElementById('pnote').focus();
};
document.getElementById('promlab').onclick=function(ev){ openDraw(ev); };
document.getElementById('pnote').onclick=function(ev){ev.stopPropagation();};
/* Returns a promise so the speech icon can wait for a fresh note to land
   server-side before asking for its audio. */
/* The draw prompt saves ITSELF — on leaving the box, closing the popup, or
   drawing. No save button (Sophie's rule). The server clears a prompt that
   just equals the words, so an untouched box keeps following the note. */
function savePrompt(){
  if(!popBeat)return Promise.resolve();
  var box=document.getElementById('drawbox');
  if(box.hidden)return Promise.resolve();   // never seeded — nothing she said
  var t=document.getElementById('dprompt').value;
  if(t.trim()===promptOf(popBeat))return Promise.resolve();
  return api('/prompt',{method:'POST',body:JSON.stringify({id:popBeat.id,prompt:t})})
    .then(function(r){return r.json()})
    .then(function(d){if(d.beats){
      var keep=popBeat; beats=d.beats; popBeat=beats.find(function(x){return x.id===keep.id;})||keep;
    }});
}
document.getElementById('dprompt').onblur=function(){savePrompt();};
/* WHAT DRAW WILL ACTUALLY SEND — one function, so the hint line and the
   Draw button can never disagree about it. Her own prompt when the box has
   one; otherwise the caption as it reads RIGHT NOW, speech markup stripped.
   The server's promptFor() is the same rule over the SAVED fields. */
function drawPrompt(){
  var typed=document.getElementById('dprompt').value.trim();
  if(typed)return typed;
  var live=document.getElementById('pnote').value.trim();
  return stripSpeech(live||(popBeat&&popBeat.text));
}
/* The empty box is not a dead box — it follows the caption, and the line
   under it says so rather than leaving her to guess which words a draw is
   about to use (2026-08-24: "it sent the wrong prompt … from the caption
   part not the drawing part"). */
function paintPromptHint(){
  var h=document.getElementById('promhint');
  if(!h)return;
  var typed=document.getElementById('dprompt').value.trim();
  h.hidden=Boolean(typed);
}
document.getElementById('dprompt').addEventListener('input',paintPromptHint);
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
  document.getElementById('lbimg').src=slotOf(popBeat).url;
  document.getElementById('lightbox').hidden=false;
};
document.getElementById('lightbox').onclick=function(ev){
  ev.stopPropagation();
  this.hidden=true;
};
/* Make this beat's art the story's cover on the shelf. The button fills in
   dark as the ack and the popup stays open (same manner as the color chips). */
document.getElementById('coverbtn').onclick=function(ev){
  ev.stopPropagation();
  var b=popBeat; if(!b||!artOf(b))return;
  var btn=this;
  api('/cover',{method:'POST',body:JSON.stringify({id:b.id,style:padStyle})})
    .then(function(r){return r.json()})
    .then(function(d){ if(d&&d.ok){ btn.classList.add('on'); } })
    .catch(function(){});
};
/* Delete, behind an are-you-sure. The beat leaves the pad; its pictures are
   already in Storage and My Creations, and its record moves to pad.trash. */
/* The box says WHICH SIDE is going, because a delete here means two
   different things (2026-08-23, Sophie): with art on the other side only
   this side goes and the beat stays over there; with nothing anywhere else,
   the beat itself goes. */
var STYLE_WORD={watercolor:'Watercolor', dreamy:'Dreamy'};
document.getElementById('delbtn').onclick=function(ev){
  ev.stopPropagation();
  if(!popBeat)return;
  var keeps=Boolean(otherSlotOf(popBeat).url);
  document.getElementById('delline').textContent=keeps
    ? ('Delete this beat from '+STYLE_WORD[padStyle]+'? It stays in '
        +STYLE_WORD[padStyle==='dreamy'?'watercolor':'dreamy']+'.')
    : 'Delete this beat? Its pictures are already saved in your galleries.';
  document.getElementById('delask').hidden=false;
};
document.getElementById('delno').onclick=function(ev){ ev.stopPropagation(); document.getElementById('delask').hidden=true; };
document.getElementById('delask').onclick=function(ev){ if(ev.target===this)this.hidden=true; };
document.getElementById('delyes').onclick=function(ev){
  ev.stopPropagation();
  var b=popBeat; if(!b)return;
  var btn=this; btn.disabled=true;
  api('/remove',{method:'POST',body:JSON.stringify({id:b.id,style:padStyle})})
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

function closeBeat(){stopRec(); stopPopVid(); saveNote(); savePrompt(); document.getElementById('beatpop').hidden=true; popBeat=null; lock(false); render();}
/* Close on the edge around the card OR on the card's own empty cream — the
   same "tap anywhere that isn't a control" contract the old scrim had. */
document.getElementById('beatpop').onclick=function(ev){
  var t=ev.target;
  if(t===this||t.id==='beatcard'||t.id==='cardin')closeBeat();
};

/* ── the back chevron, wherever it is drawn ────────────────────────────
   Builds inject window.__nativeNavBar before the page runs. On the OLD build
   that means Apple's bar, and body.native hides the page's own STORY ROOM
   name so there are never two titles (a double header shipped for real,
   Sophie's screenshot, Aug 2026). On the build that hands the header over,
   pagehead.js draws the chevron into the page's own row instead and the name
   comes back — see the header CSS. Either way the
   chevron asks __navBack first: close the topmost open layer — film,
   lightbox, a confirm box, the beat popup, a sheet — each through its own
   close path so nothing skips its cleanup (closeBeat saves the note, the
   inbox returns to the beat it was filling).
   BELOW ALL OF THAT IS THE SHELF, and it is the floor (2026-08-23, Sophie:
   "the back button goes to the shelf … the back button IS the shelf
   button"). So a bare story answers TRUE and opens the shelf, and only the
   shelf itself answers false, which is where the app leaves the tool. It
   used to be the other way round — the shelf closed onto a story and the
   story handed back — which is the architecture she called backwards. */
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
  el=document.getElementById('ausheet');
  if(!el.hidden){ document.getElementById('auclose').click(); return true; }
  el=document.getElementById('descsheet');
  if(!el.hidden){ document.getElementById('descclose').click(); return true; }
  el=document.getElementById('helpsheet');
  if(!el.hidden){ document.getElementById('helpclose').click(); return true; }
  el=document.getElementById('stories');
  if(!el.hidden) return false;    // the shelf is the floor — the app leaves
  openShelf(); return true;       // a story steps up to it
};

/* THE ROOM OPENS ON THE SHELF (2026-08-23, Sophie: "story room opens on the
   shelf"). Nothing loads a story until she taps one — the last one she was on
   is still remembered (padId), but only to mark its tile as where she left
   off. Loading it here would spend a fetch on a page nobody is looking at and
   put a stale story one chevron behind the shelf. */
openShelf();
</script>
"""

out = os.path.join(ROOT, 'public', 'scratchpad.html')
open(out, 'w').write(page.replace('__FONT__', font)
                        .replace('__STAR__', ICON_STAR)
                        .replace('__PLAYICON__', ICON_PLAY))
print('built public/scratchpad.html', round(len(page) / 1024), 'KB (+font)')
