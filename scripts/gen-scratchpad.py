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
.sheet .wrap{padding-top:3vh;}
#inboxgrid{display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:1.2em;}
#inboxgrid button{aspect-ratio:2/3; border:1px solid var(--line); border-radius:4px; background:var(--barbg);
  padding:0; overflow:hidden; cursor:pointer;}
#inboxgrid button img{width:100%; height:100%; object-fit:cover; display:block;}
#inboxgrid button.used{opacity:.35;}
/* The beat popup is an opaque cream CARD, not a dark lightbox: white/cream
   paper with a light border, centered, and only as TALL as what's on it
   (Sophie, Aug 2026 — a full-height card was "too tall"; the pad showing
   all around it is also the tap-out target). Capped at the screen and
   scrolls inside if content ever overflows. Everything — art, versions,
   chips, note, icons — lives ON the card. No scrim. */
#beatpop{position:fixed; inset:0; z-index:50; background:none;
  display:flex; align-items:center; justify-content:center;
  padding:calc(env(safe-area-inset-top,0px) + 24px) 16px calc(env(safe-area-inset-bottom,0px) + 24px);}
#beatcard{width:100%; max-height:100%; box-sizing:border-box; background:var(--barbg);
  border:1.5px solid var(--line); border-radius:10px; overflow-y:auto; -webkit-overflow-scrolling:touch;
  display:flex; flex-direction:column;}
/* margin:auto keeps the content centered inside the card and lets it
   scroll normally when it's taller than the screen cap (justify-content:
   center would clip the top of overflowing content). */
#cardin{margin:auto; width:100%; box-sizing:border-box; padding:20px 16px;
  display:flex; flex-direction:column; align-items:center; gap:18px;}
/* The art stays THUMBNAIL-sized in the popup (Sophie: the chosen art isn't
   big) — openBeat() copies the pad tile's pixel width onto it. */
#beatpop img{border:3px solid var(--line); border-radius:4px; background:var(--barbg); display:block; height:auto;}
#beatpop img.c-mustard{border-color:var(--mustard);} #beatpop img.c-green{border-color:var(--green);}
#beatpop img.c-blue{border-color:var(--blue);} #beatpop img.c-pink{border-color:var(--pink);}
.chips{display:flex; gap:16px;}
.chip{width:36px; height:36px; border-radius:50%; border:1.5px solid var(--line); padding:0; cursor:pointer;}
.chip.on{outline:2.5px solid var(--ink); outline-offset:3px;}
.chip.gray{background:#8a8377;} .chip.mustard{background:var(--mustard);}
.chip.green{background:var(--green);} .chip.blue{background:var(--blue);} .chip.pink{background:var(--pink);}
#pnote{width:min(80vw,22em); box-sizing:border-box; font-family:'EBGaramond',Georgia,serif; font-size:17px;
  line-height:1.4; color:var(--ink); background:var(--paper); border:1px solid var(--line); border-radius:6px;
  padding:10px 12px; resize:none;}
.poprow{display:flex; gap:14px;}
#speak,#linkbtn,#micbtn,#delbtn{width:34px; height:34px; display:flex; align-items:center; justify-content:center; padding:0;
  border:1px solid var(--line); border-radius:6px; background:none; color:var(--ink); cursor:pointer;}
#speak svg,#linkbtn svg,#micbtn svg,#delbtn svg{width:17px; height:17px;}
/* Every generation this beat has had, all the same size, newest first; the
   one currently on the pad wears the dark ring. Tap one to see it big. */
#verrow{display:flex; flex-wrap:wrap; gap:6px; justify-content:center; max-width:88vw;}
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
#popblank{aspect-ratio:2/3; border:3px solid var(--line); border-radius:4px; background:var(--paper);
  display:flex; align-items:center; justify-content:center; gap:14px; color:var(--ink2); padding:0;}
#popblank button{background:none; border:none; padding:4px; color:var(--ink2); cursor:pointer; display:flex;}
#popblank svg{width:24px; height:24px;}
/* The same two ways to art, ABOVE a beat that already has a picture — so it
   can be swapped for another (Sophie, Aug 2026). */
#artrow{display:flex; gap:14px; justify-content:center;}
#artrow button{background:none; border:1px solid var(--line); border-radius:6px; padding:6px 8px;
  color:var(--ink); cursor:pointer; display:flex;}
#artrow svg{width:17px; height:17px;}
/* Drawing right here: prompt (defaults to the beat's words), Sophie on/off,
   quality, Draw. The STYLE is never asked — one style per story. */
#drawbox{width:min(80vw,22em); display:flex; flex-direction:column; gap:8px;}
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
  <div id="beatcard"><div id="cardin">
  <div id="artrow" hidden>
    <button id="ardraw" aria-label="Draw it again here">__STAR__</button>
    <button id="arplay" aria-label="Make different art in the Playground">__PLAYICON__</button>
    <button id="arinbox" aria-label="Swap in a picture from the inbox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></button>
  </div>
  <img id="popimg" alt="">
  <div id="verrow" hidden></div>
  <div id="popblank" hidden>
    <button id="pbdraw" aria-label="Draw it here">__STAR__</button>
    <button id="pbplay" aria-label="Make its art in the Playground">__PLAYICON__</button>
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
  </div></div>
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
function openInbox(){
  var sh=document.getElementById('inbox');
  sh.hidden=false; lock(true); sheetPill(sh);
  api('/inbox').then(function(r){return r.json()}).then(function(d){
    inboxItems=d.items||[];
    // A story that carries its own gathered art says so; otherwise this is
    // still the Playground hearts.
    var hd=document.querySelector('#inbox .no');
    if(hd) hd.textContent = (d.source==='story') ? 'This story\u2019s art' : 'From the Playground';
    var g=document.getElementById('inboxgrid'); g.innerHTML='';
    document.getElementById('inboxempty').hidden=Boolean(inboxItems.length);
    // A picture she has already placed is gone from here, not dimmed: the
    // inbox is what is still waiting to be used (Sophie, Aug 2026).
    var onPad={}; beats.forEach(function(b){onPad[b.url]=1;});
    inboxItems=inboxItems.filter(function(it){ return !onPad[it.url]; });
    document.getElementById('inboxempty').hidden=Boolean(inboxItems.length);
    inboxItems.forEach(function(it){
      var el=document.createElement('button');
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
  var sh=document.getElementById('inbox'); if(sh._stopPill) sh._stopPill();
  sh.hidden=true;
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
   here now); tapping outside the controls is what closes it. */
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
/* Close on the edge around the card OR on the card's own empty cream — the
   same "tap anywhere that isn't a control" contract the old scrim had. */
document.getElementById('beatpop').onclick=function(ev){
  var t=ev.target;
  if(t===this||t.id==='beatcard'||t.id==='cardin')closeBeat();
};

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
open(out, 'w').write(page.replace('__FONT__', font)
                        .replace('__STAR__', ICON_STAR)
                        .replace('__PLAYICON__', ICON_PLAY))
print('built public/scratchpad.html', round(len(page) / 1024), 'KB (+font)')
