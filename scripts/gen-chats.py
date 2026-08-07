#!/usr/bin/env python3
# The Chat app — public/chats.html, served gated at /chats.
# build marker: 2026-08-07 — RESYNCED from public/chats.html (third time). It
# keeps drifting because several chats edit the page directly: #636 (Archive in
# the header), #642 (the ask-first sheet), then the working-chat tint, the
# ARCHIVE word and another chat's body.ontop overlay fix. Running a stale
# generator REVERTS all of it — the very accident this file exists to stop.
#
# SO: DO NOT resync by hand, and do not run this script before syncing.
#   1. edit public/chats.html
#   2. python3 scripts/resync-gen-chats.py     <-- rebuilds this template from
#      the page and verifies the round trip; --check tells you if it's stale
#   3. commit BOTH files
# Running gen-chats.py first overwrites the page from the stale template and
# your edit is gone (this happened while writing the resync script).
import base64, os
from pill import PILL_CSS, PILL_HTML, PILL_JS

ROOT = os.path.join(os.path.dirname(__file__), '..')
font = base64.b64encode(open(os.path.join(ROOT, 'ios', 'ImageForge', 'EBGaramond.ttf'), 'rb').read()).decode()

page = r"""<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>Chats — every chat in one place</title>
<style>
@font-face{font-family:'EBGaramond';font-weight:400 700;font-display:swap;src:url(data:font/ttf;base64,__FONT__) format('truetype');}
:root{ --paper:#f6f2e9; --ink:#26221c; --ink2:#8a8377; --line:#d9d2c2; --rose:#a5586a; --chg:#b3443f; --barbg:#fffdf7; }
@media (prefers-color-scheme: dark){:root{--paper:#191713; --ink:#e8e2d6; --ink2:#97907f; --line:#37322a; --rose:#c98a99; --chg:#e08b84; --barbg:#211e19;}}
:root[data-theme="dark"]{--paper:#191713; --ink:#e8e2d6; --ink2:#97907f; --line:#37322a; --rose:#c98a99; --chg:#e08b84; --barbg:#211e19;}
:root[data-theme="light"]{--paper:#f6f2e9; --ink:#26221c; --ink2:#8a8377; --line:#d9d2c2; --rose:#a5586a; --chg:#b3443f; --barbg:#fffdf7;}
html{background:var(--paper);}
body{margin:0; touch-action:manipulation; background:var(--paper); color:var(--ink); font-family:'EBGaramond',Georgia,serif;}
.wrap{max-width:34em; margin:0 auto; padding:5vh 5vw 16vh;}
.no{font-family:-apple-system,'Helvetica Neue',sans-serif; font-size:11px; letter-spacing:.34em; color:var(--ink2); text-transform:uppercase;}
/* In a thread the back button is FIXED over the top-left (x 15-59) and the
   autoscroll pill over the top-right, so this row has to start clear of one
   and stop short of the other. Archive rides at its right end. */
#thread header .no{display:flex; align-items:center; gap:10px; min-height:34px;
  padding-left:48px; padding-right:56px;}
#thread header .no .crumb{flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
h1{font-weight:600; font-size:2.3em; line-height:1; margin:.15em 0 .3em;}
.rule{height:1px; background:var(--line); margin:1em 0 1.6em;}
.state{font-style:italic; color:var(--ink2); text-align:center; padding:4em 0;}
#chatgrid{display:grid; grid-template-columns:repeat(3,1fr); gap:20px 14px;}
.tile{display:flex; flex-direction:column; gap:0; background:none; border:none; padding:0; cursor:pointer;
  color:var(--ink); font-family:'EBGaramond',Georgia,serif; text-align:center; min-width:0;}
.tile:focus-visible{outline:2px solid var(--rose); border-radius:4px;}
.t-cover{display:block; aspect-ratio:1; border:1px solid var(--line); background:var(--barbg); border-radius:4px; overflow:hidden; position:relative;}
.t-cover img{width:100%; height:100%; object-fit:cover; display:block;}
.t-blank{display:flex; align-items:center; justify-content:center;}
.t-blank span{font-size:2.2em; font-style:italic; color:var(--ink2);}
.t-new{position:absolute; bottom:6px; right:6px; width:10px; height:10px; border-radius:50%; background:var(--rose); z-index:2;}
.t-name{font-size:1.12em; font-weight:600; line-height:1.15; margin-top:7px; overflow-wrap:break-word;}
.t-about{font-family:'EBGaramond',Georgia,serif; font-style:italic; font-size:.92em; color:var(--ink2); line-height:1.2; margin-top:2px;}
.t-tldr{font-family:'EBGaramond',Georgia,serif; font-size:.92em; color:var(--ink); line-height:1.28; margin-top:4px;
  display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;}
.t-meta{font-family:-apple-system,sans-serif; font-size:9px; letter-spacing:.14em; color:var(--ink2); text-transform:uppercase; margin-top:4px;}
.abouted{display:block; width:100%; margin:2px 0 0; font-family:'EBGaramond',Georgia,serif; font-size:16px; box-sizing:border-box;
  border:1px solid var(--line); border-radius:6px; background:var(--barbg); color:var(--ink); padding:7px 9px;}
/* The floating autoscroll pill is fixed over the top-right corner (x 324-374,
   y 14-192 on an iPhone 13), so ANY header control that reaches that corner is
   untappable — the rename pencil was. Both header rows reserve that column. */
.thread-head{display:flex; align-items:center; gap:10px; margin-bottom:.5em; padding-right:56px;}
.thread-head img,.thread-head .t-blank{width:38px; height:38px; border-radius:4px; border:1px solid var(--line); object-fit:cover; flex:none;}
.thread-head .t-blank{display:flex; font-size:1.1em;}
.thread-head h1{font-size:1.5em; margin:0; flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.renamebtn{flex:none; background:none; border:none; padding:4px; margin:0; color:var(--ink2); cursor:pointer; line-height:0; -webkit-tap-highlight-color:transparent;}
.renamebtn:active{color:var(--ink);}
.nameed{flex:1; min-width:0; font-family:inherit; font-size:1.5em; font-weight:700; color:var(--ink); background:var(--barbg); border:1px solid var(--line); border-radius:6px; padding:2px 6px; box-sizing:border-box;}
.assetgrid{display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:.4em 0 2em;}
.assetgrid button{position:relative; margin:0; padding:0; border:none; background:none; cursor:pointer; display:flex; flex-direction:column;}
.assetgrid img{width:100%; aspect-ratio:1; object-fit:cover; border-radius:6px; border:1px solid var(--line); display:block; background:var(--barbg);}
.assetgrid .lbl{font-size:11px; line-height:1.3; color:var(--muted,#888); margin-top:3px; text-align:left; word-break:break-word;}
.assetgrid .acell{position:relative;}
.vote{width:29px; height:29px; border-radius:50%; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer;
  background:rgba(250,247,240,.9); color:#8a8377; box-shadow:0 1px 4px rgba(0,0,0,.2); padding:0; flex:none;}
.vote svg{width:15px; height:15px; display:block;}
.vote.heart.on{background:#c96a5e; color:#fff;}
.vote.nope.on{background:#3a3530; color:#fff;}
.assetgrid .vote{position:absolute; top:5px;}
.assetgrid .vote.heart{left:5px;}
.assetgrid .vote.nope{right:5px;}
.assetgrid .acell.nay img{opacity:.35; filter:grayscale(60%);}
/* lightbox: ♥ / ✕ overlaid on the image corners; note box sits under the image */
.lbtop{position:absolute; top:max(18px, env(safe-area-inset-top)); left:22px; right:22px; display:flex; gap:8px; align-items:center; justify-content:space-between; z-index:2;}
.lbtop .vote{width:38px; height:38px;}
.lbtop .vote svg{width:18px; height:18px;}
.lbnote{display:flex; gap:6px; width:100%; margin-top:8px;}
.lbnote input{flex:1; min-width:0; border:none; border-radius:6px; background:rgba(250,247,240,.92); color:#26221c;
  font-family:'EBGaramond',Georgia,serif; font-size:15px; padding:8px 10px; box-shadow:0 1px 4px rgba(0,0,0,.2);}
.lbnote .notesend{width:38px; height:38px; border-radius:50%; border:none; background:rgba(250,247,240,.92); color:#5d7a5a;
  display:flex; align-items:center; justify-content:center; cursor:pointer; flex:none; box-shadow:0 1px 4px rgba(0,0,0,.2); padding:0;}
.lbnote .notesend svg{width:18px; height:18px; display:block;}
.lbnote .notesend.saved{background:#5d7a5a; color:#fff;}
/* The note thread under the image: her letters and the chat's replies back.
   Its own scroll area so a long exchange can never push the picture off. */
.lbtalk{width:min(92vw,360px); margin-top:12px;}
.lbthread{max-height:26vh; overflow-y:auto; -webkit-overflow-scrolling:touch;
  display:flex; flex-direction:column; gap:5px;}
.lbmsg{max-width:82%; padding:7px 10px; border-radius:6px; font-family:'EBGaramond',Georgia,serif;
  font-size:14px; line-height:1.4; word-break:break-word; white-space:pre-wrap;}
.lbmsg.me{align-self:flex-end; background:rgba(250,247,240,.92); color:#26221c;}
.lbmsg.them{align-self:flex-start; background:rgba(250,247,240,.14); color:#ece6da;}
.lbmsg.pending{opacity:.55;}
.lbmsg.failed{opacity:1; box-shadow:inset 0 0 0 1px #c96a5e; cursor:pointer;}
/* an unread reply from the chat — top centre, between the ♥ and the ✕ */
.assetgrid .nbadge{position:absolute; top:5px; left:50%; transform:translateX(-50%);
  min-width:18px; height:18px; border-radius:9px; background:#5d7a5a; color:#fff;
  font-family:-apple-system,sans-serif; font-size:11px; line-height:18px; text-align:center;
  padding:0 5px; box-sizing:border-box; box-shadow:0 1px 4px rgba(0,0,0,.25); pointer-events:none;}
#clightbox{position:fixed; inset:0; background:rgba(15,13,10,.93); z-index:30; display:none; align-items:center; justify-content:center; padding:18px; flex-direction:column;}
#clightbox img{max-width:100%; max-height:88vh; border-radius:6px;}
/* With a note thread under it the picture can't have the whole screen, or the
   thread and the box you type in fall off the bottom. */
#clightbox.hastalk img{max-height:46vh;}
#clightbox .clcap{color:#b9b2a4; font-size:12px; margin-top:12px; text-align:center; letter-spacing:.02em;}
/* the prompt behind the image: covers it completely (that's the point — you
   read the words instead of the picture), Style on the left of the toggle,
   Content on the right. .clwrap only wraps the img so the overlay lands on
   exactly the image; it is deliberately NOT .clframe, which would move the
   ♥/✕ row off the screen corners it sits in today. */
#clightbox .clwrap{position:relative; display:flex; align-items:center; justify-content:center; max-width:100%;}
/* The wrapper shrink-wraps the <img>, so on a slow connection (or a cold
   Render) it can still be 0×0 when you tap PROMPT — an inset:0 overlay would
   then render as an unreadable stamp. .pon (only while the prompt is showing,
   so nothing moves otherwise) floors the box so the words always have room. */
#clightbox .clwrap.pon{min-width:min(86vw,420px); min-height:min(52vh,420px);}
.promptbtn{border:none; border-radius:6px; background:rgba(250,247,240,.9); color:#26221c; padding:7px 11px; margin:0;
  font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.14em; text-transform:uppercase; cursor:pointer;
  box-shadow:0 1px 4px rgba(0,0,0,.2); flex:none;}
.promptbtn.on{background:#3a3530; color:#faf7f0;}
.lbp{position:absolute; inset:0; border-radius:6px; background:rgba(15,13,10,.95); display:flex; flex-direction:column;
  padding:14px; box-sizing:border-box; z-index:1;}
.lbp .lbptog{display:flex; gap:6px; flex:none; margin-bottom:10px;}
.lbp .lbptog button{flex:1; margin:0; border:1px solid rgba(250,247,240,.35); border-radius:6px; background:none; color:#c8c1b3;
  font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.14em; text-transform:uppercase; padding:8px 4px; cursor:pointer;}
.lbp .lbptog button.on{background:#faf7f0; border-color:#faf7f0; color:#26221c;}
.lbp .lbptext{flex:1; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch; color:#ece6da;
  font-family:'EBGaramond',Georgia,serif; font-size:15px; line-height:1.45; white-space:pre-wrap; word-break:break-word;}
.aboutrow{margin:-2px 0 6px;}
.aboutshow{font-style:italic; color:var(--ink2); font-size:1.02em; cursor:pointer;}
.seticon{font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.1em; text-transform:uppercase;
  background:none; border:none; color:var(--ink2); cursor:pointer; padding:4px 0; display:block; margin:-2px 0 0;}
.msg{padding:14px 0; border-bottom:1px solid var(--line); transition:background-color .3s;}
.msg.flash{background:color-mix(in srgb, var(--rose) 16%, var(--paper)); border-radius:8px;}
.m-head{display:flex; gap:8px; align-items:baseline;}
.m-chat{font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink2); font-weight:600;}
.m-chat.sophie{color:var(--rose);}
.m-time{font-family:-apple-system,sans-serif; font-size:10px; color:var(--ink2);}
/* A live draft — the turn is still running; the hook posted the prose written
   so far and the message grows in place until the reply finishes. Gentle
   breathing so it reads as "in motion", same idiom as the tiles placeholder. */
.m-working{font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--rose); animation:mworking 1.6s ease-in-out infinite;}
@keyframes mworking{0%,100%{opacity:1;} 50%{opacity:.45;}}
.m-preview{font-size:16.5px; line-height:1.5; cursor:pointer;}
.m-full{display:none; font-size:16.5px; line-height:1.6; white-space:pre-wrap;}
.m-full pre{white-space:pre-wrap; overflow-wrap:anywhere; background:var(--barbg); border:1px solid var(--line); border-radius:6px; padding:8px 10px; font-size:12.5px; line-height:1.45;}
.codebox{position:relative; margin:8px 0;}
.codebox pre{margin:0; padding-right:44px;}
.codecopy{position:absolute; top:6px; right:6px; display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; background:var(--barbg); border:1px solid var(--line); border-radius:6px; color:var(--ink2); cursor:pointer; padding:0; -webkit-tap-highlight-color:transparent;}
.codecopy svg{width:15px; height:15px;}
.codecopy.done{color:var(--ink);}
.m-full code{background:var(--barbg); border:1px solid var(--line); border-radius:4px; padding:0 4px; font-size:14px;}
/* The folded technical middle of a message — collapsed to a tap. */
.fold{margin:8px 0;}
.foldtog{display:inline-flex; align-items:center; gap:6px; background:var(--barbg); border:1px solid var(--line); color:var(--ink2); font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.1em; text-transform:uppercase; border-radius:6px; padding:6px 11px; cursor:pointer; -webkit-tap-highlight-color:transparent;}
.foldtog.open{color:var(--ink);}
.foldbody{margin-top:8px;}
.msg.open .m-head{cursor:pointer;}
.m-close{display:none; font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink2); margin-left:auto;}
.msg.open .m-close{display:inline;}
/* Per-chat Claude-account picker — the last thing under the messages (Archive
   moved up to the header, so this is now the foot of the thread) */
.acctrow{margin-top:2.4em; display:flex; align-items:center; justify-content:center; gap:8px;
  font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--ink2);}
.acctrow .tbtn{min-width:34px; text-align:center;}
/* Just the word (Sophie's ask) — no box, no border. In a sub-view it becomes
   the way OUT and says so ("← Chats"): the bold word alone read as decoration
   and left her stuck ("it should make it clear that I'm in the archive and
   then I wanna get out"). The big serif title is the other half of that —
   it says Archive / Bookmarks while she's there. */
.archlink{background:none; border:none; padding:7px 2px; cursor:pointer; color:var(--ink2); flex:none; white-space:nowrap;
  font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.08em; text-transform:uppercase;}
/* NOT bold in a sub-view (Aug 2026, Sophie): the big title already says
   Archive / Bookmarks, so bolding the exit as well said the same thing twice.
   It still darkens to full ink — it is the live control on that row. */
.archlink.on{color:var(--ink);}
/* Bookmark LEFT of the word (Sophie), and ALWAYS filled red — it reads as the
   bookmark thing at a glance. Which view is open is the title's job, so this
   one doesn't change with state. Selector is `.bmk.hdrbmk`, not `.hdrbmk`: the
   generic .bmk color rule sits LATER in this file, so at equal specificity it
   would win and the icon came out grey. */
.bmk.hdrbmk{flex:none; padding:6px 4px; color:var(--chg);}
.bmk.hdrbmk svg{fill:currentColor;}
.msg.open .m-preview{display:none;}
.msg.open .m-full{display:block;}
.m-tools{display:flex; gap:8px; margin:6px 0; align-items:center;}
.openrow{display:flex; justify-content:space-between; align-items:center; padding:14px 0 6px;}
/* Bookmark toggle — a message you want to find later. Same glyph as the stories
   bookmark; circular icon button (the sanctioned exception to no-pills). */
.bmk{background:none; border:none; color:var(--ink2); cursor:pointer; padding:6px; border-radius:6px; display:inline-flex; align-items:center; -webkit-tap-highlight-color:transparent;}
.bmk.on{color:var(--chg);}
.bmk.on svg{fill:currentColor;}
.tbtn{font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.08em; text-transform:uppercase;
  border:1px solid var(--line); background:var(--barbg); color:var(--ink2); border-radius:6px; padding:5px 10px; cursor:pointer;}
.tbtn.on{border-color:var(--rose); color:var(--rose);}
/* Labeled Refresh button, left-grouped next to the view toggle so it never
   sits under the floating autoscroll pill in the top-right corner.
   PILL-SHAPED BY REQUEST (Aug 2026, Sophie) — a deliberate exception to the
   no-pills rule, which still holds for every other text button. Don't "fix"
   this back to 6px. */
.refreshbtn{display:inline-flex; align-items:center; gap:6px; padding:3px 14px; border-radius:999px; line-height:1.5;}
/* Search across every chat (in-memory index on the server). */
.searchrow{position:relative; margin:0 0 1.4em;}
#qsearch{width:100%; box-sizing:border-box; font-family:'EBGaramond',Georgia,serif; font-size:16px; padding:11px 40px 11px 14px; border:1px solid var(--line); border-radius:6px; background:var(--barbg); color:var(--ink);}
#qsearch:focus{outline:none; border-color:var(--rose);}
#qsearch::-webkit-search-cancel-button{-webkit-appearance:none; appearance:none;}
.qclear{position:absolute; right:5px; top:50%; transform:translateY(-50%); width:32px; height:32px; border:none; background:none; color:var(--ink2); font-size:22px; line-height:1; cursor:pointer; border-radius:6px;}
.sres{display:block; width:100%; text-align:left; background:none; border:none; border-bottom:1px solid var(--line); padding:12px 2px; cursor:pointer; color:var(--ink); font-family:'EBGaramond',Georgia,serif;}
.sr-top{display:flex; align-items:baseline; gap:8px; margin-bottom:3px;}
.sr-chat{font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--rose); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0;}
.sr-time{font-family:-apple-system,sans-serif; font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink2); margin-left:auto; flex:none;}
.sr-snip{font-size:15.5px; line-height:1.4; color:var(--ink);}
.sr-snip b{background:color-mix(in srgb, var(--rose) 24%, var(--paper)); border-radius:3px; padding:0 1px;}
/* Bookmarks: the two kinds she keeps (code to copy vs. something to read),
   derived server-side. The chips filter; the tag marks a code one in "All". */
.bmkfilter{display:flex; gap:8px; margin:0 0 1.1em;}
.sr-kind{font-family:-apple-system,sans-serif; font-size:9px; letter-spacing:.1em; text-transform:uppercase;
  color:var(--ink2); border:1px solid var(--line); border-radius:4px; padding:1px 5px; flex:none;}
/* Chat-name results sit above message hits — the name reads at full size. */
.sres.schat .sr-chat{font-family:'EBGaramond',Georgia,serif; font-size:17px; letter-spacing:0; text-transform:none;}
.sres.schat .sr-chat b{background:color-mix(in srgb, var(--rose) 24%, var(--paper)); border-radius:3px; padding:0 1px;}
/* Compare tab: a chat's published pages (comparison sheets / option boards) */
.pagerow{display:flex; align-items:baseline; gap:12px; width:100%; text-align:left; background:none; border:none; border-bottom:1px solid var(--line); padding:15px 2px; cursor:pointer; color:var(--ink); font-family:'EBGaramond',Georgia,serif;}
.pr-title{flex:1; font-size:1.12em; font-weight:600; line-height:1.25; min-width:0;}
.pr-time{font-family:-apple-system,sans-serif; font-size:9px; letter-spacing:.12em; color:var(--ink2); text-transform:uppercase; flex:none;}
/* Full-screen viewer for a Compare page */
.pageview{position:fixed; inset:0; z-index:40; background:var(--paper); display:flex; flex-direction:column;}
.pv-bar{display:flex; align-items:center; gap:10px; padding:calc(max(8px, env(safe-area-inset-top))) 12px 8px; border-bottom:1px solid var(--line); background:var(--barbg); flex:none;}
.pv-back{width:38px; height:38px; border-radius:6px; border:1px solid var(--line); background:var(--barbg); color:var(--ink2); font-size:20px; cursor:pointer; flex:none;}
.pv-title{font-family:'EBGaramond',Georgia,serif; font-weight:600; font-size:1.1em; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0;}
.pv-frame{flex:1; width:100%; border:none; background:#fff;}
.pv-title{padding-right:60px;}
.pps{font-family:-apple-system,sans-serif; font-size:11px; font-weight:600; color:var(--ink2); letter-spacing:.02em;}
.m-tools audio{flex:1; height:32px; min-width:0;}
/* view toggle (List / Tiles) */
.viewtog{display:flex; border:1.5px solid var(--ink); border-radius:6px; overflow:hidden; width:max-content; margin:0 0 1.5em;}
.viewtog button{font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.08em; text-transform:uppercase; border:none; background:transparent; color:var(--ink); padding:7px 16px; cursor:pointer;}
.viewtog button + button{border-left:1.5px solid var(--ink);}
.viewtog button.on{background:color-mix(in srgb, var(--chg) 18%, var(--paper)); font-weight:600;}
/* list view */
.clist{display:flex; flex-direction:column;}
.crow{display:flex; align-items:center; gap:12px; width:100%; text-align:left; background:none; border:none; border-bottom:1px solid var(--line); padding:12px 2px; cursor:pointer; color:var(--ink); font-family:'EBGaramond',Georgia,serif;}
.crow .cr-ic{width:46px; height:46px; border-radius:6px; border:1px solid var(--line); object-fit:cover; flex:none; background:var(--barbg);}
.crow .cr-ic.t-blank{display:flex; align-items:center; justify-content:center; font-size:1.2em; font-style:italic; color:var(--ink2);}
.cr-body{flex:1; min-width:0;}
/* The name is the whole row now, so it can be bigger. display:block is what
   makes the ellipsis work at all — as an inline span it could never truncate,
   which is how the old snippet ended up running off the screen. */
.cr-name{display:block; font-size:1.45em; font-weight:600; line-height:1.2;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.cr-time{font-family:-apple-system,sans-serif; font-size:9px; letter-spacing:.12em; color:var(--ink2); text-transform:uppercase; flex:none;}
.cr-dot{width:9px; height:9px; border-radius:50%; background:var(--rose); flex:none;}
/* "Answered" check — mark a chat done; it grays until a newer message arrives */
.ckbtn,.flagbtn{border:none; cursor:pointer; padding:0; display:flex; align-items:center; justify-content:center; -webkit-tap-highlight-color:transparent; border-radius:50%; background:rgba(250,247,240,.92); color:var(--ink2); box-shadow:0 1px 4px rgba(0,0,0,.18);}
.ckbtn svg,.flagbtn svg{width:14px; height:14px; display:block;}
.ckbtn.on{background:#5d7a5a; color:#fff;}
.flagbtn.on{background:#c2703a; color:#fff;}
.t-cover .ckbtn{position:absolute; top:5px; left:5px; width:26px; height:26px; z-index:2;}
.t-cover .flagbtn{position:absolute; top:5px; right:5px; width:26px; height:26px; z-index:2;}
.crow .ckbtn,.crow .flagbtn{width:31px; height:31px; flex:none; margin-left:2px;}
.tile.done .t-cover img, .tile.done .t-name, .tile.done .t-about, .tile.done .t-tldr, .tile.done .t-meta{opacity:.38;}
.tile.done .t-cover.t-blank span{opacity:.38;}
.crow.done .cr-ic, .crow.done .cr-body, .crow.done .cr-time{opacity:.38;}
/* WORKING — the chat is mid-turn (its newest message is a live draft still
   being written). Tinted rose on the home screen so an in-flight chat reads at
   a glance and doesn't get opened and re-asked. Same signal as the thread's
   "still writing…" marker, just visible from outside. */
.tile.live .t-cover{border-color:var(--rose); background:color-mix(in srgb, var(--rose) 15%, var(--paper));}
/* Most tiles carry a cover image, which would hide a background tint — so the
   wash goes OVER the picture. The ♥/✕ marks (z-index 2) and the unread dot sit
   above it; nothing tappable ends up under the wash. */
.tile.live .t-cover::after{content:''; position:absolute; inset:0; background:var(--rose); opacity:.26; pointer-events:none;}
.tile.live .t-new{box-shadow:0 0 0 2px var(--paper);}   /* rose dot on a rose wash needs an edge */
.tile.live .t-name{color:var(--rose);}
.crow.live{background:color-mix(in srgb, var(--rose) 13%, var(--paper));}
.crow.live .cr-ic{border-color:var(--rose);}
.crow.live .cr-name{color:var(--rose);}
/* The unread dot still means "you need to check this" (Sophie) and must stay
   readable on a tinted row — rose on rose disappears without an edge. */
.crow.live .cr-dot{box-shadow:0 0 0 2px var(--paper);}
/* Open-in-Claude button — Claude orange, white starburst + text */
.openclaude{display:inline-flex; align-items:center; gap:6px; background:#d97757; color:#fff; border:none; border-radius:6px;
  font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.04em; padding:8px 14px; cursor:pointer; text-decoration:none;}
.openclaude svg{width:15px; height:15px; display:block; stroke:#fff;}
.headbtns{display:flex; align-items:center; gap:8px; margin:2px 0 0; padding-right:56px;}
/* Refresh rides in the tab bar itself rather than wrapping to a line of its
   own; the toggle takes whatever width is left. */
.headbtns .viewtog{flex:1; min-width:0; width:auto;}
.headbtns .viewtog button{flex:1; min-width:0; padding-left:4px; padding-right:4px;}
.headbtns .threadrefresh{flex:none;}
/* Ask-first sheet. Deliberately NOT window.confirm(): in the iOS app's
   WKWebView a confirm panel only appears if the native side implements the
   delegate for it — otherwise it returns false silently and the action would
   never run at all. This is plain DOM, so it works everywhere. */
.askwrap{position:fixed; inset:0; z-index:40; background:rgba(15,13,10,.55);
  display:flex; align-items:center; justify-content:center; padding:24px;}
.askbox{background:var(--paper); border:1px solid var(--line); border-radius:6px;
  padding:18px 16px 14px; width:min(88vw,320px); box-shadow:0 6px 24px rgba(0,0,0,.22);}
.askbox p{margin:0 0 14px; font-family:'EBGaramond',Georgia,serif; font-size:17px; line-height:1.35; color:var(--ink);}
.askrow{display:flex; gap:8px; justify-content:flex-end;}
.askrow button{font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.08em;
  text-transform:uppercase; border-radius:6px; padding:9px 14px; cursor:pointer; border:1px solid var(--line);
  background:var(--barbg); color:var(--ink2); margin:0;}
.askrow button.go{background:var(--ink); border-color:var(--ink); color:var(--paper);}
/* Archive as words, beside the name — not a button, still tappable. */
/* Vertical padding is the tap target, not decoration: as bare 11px text this
   was a 20px-tall thing to hit with a thumb. The row is already 40px, so this
   costs no layout. */
.archlink{flex:none; background:none; border:none; margin:0; padding:10px 6px; cursor:pointer;
  font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.1em; text-transform:uppercase;
  color:var(--ink2); -webkit-tap-highlight-color:transparent;}
.archlink:active{color:var(--ink);}
/* An on/off switch, the iOS shape. Circular track, so it's the sanctioned
   exception to no-pills — it's a toggle, not a text button. */
.swi{position:relative; width:42px; height:26px; border-radius:13px; border:1.5px solid var(--line);
  background:var(--barbg); padding:0; margin:0; flex:none; cursor:pointer; -webkit-tap-highlight-color:transparent;}
.swi::after{content:''; position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%;
  background:var(--ink2); transition:transform .18s, background .18s;}
.swi.on{background:var(--chg); border-color:var(--chg);}
.swi.on::after{transform:translateX(16px); background:var(--paper);}
.tbtn.play{display:inline-flex; align-items:center; gap:6px;}
.backwrap{position:fixed; top:max(14px, env(safe-area-inset-top)); left:max(14px,4vw); z-index:9; display:none;}
body.reading .backwrap{display:block;}
#back{width:44px; height:44px; border-radius:6px; border:1px solid var(--line); background:var(--barbg); color:var(--ink2); font-size:20px; cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,.09);}
/* Floating "now playing" bar — pinned at the top while a message's audio plays,
   so it can be paused without scrolling back up to the message. translateZ keeps
   it from riding along with WKWebView momentum scroll. */
.nowplaying{position:fixed; top:max(14px, env(safe-area-inset-top)); left:50%; transform:translateX(-50%) translateZ(0); z-index:10; display:none; align-items:center; gap:8px; max-width:min(60vw,240px); background:var(--barbg); color:var(--ink); border:1px solid var(--line); border-radius:6px; padding:8px 13px; box-shadow:0 2px 12px rgba(0,0,0,.14); cursor:pointer; -webkit-tap-highlight-color:transparent; font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--ink2);}
.nowplaying.show{display:flex;}
.nowplaying svg{flex:none; color:var(--ink);}
/* "New message" bar. A reply landing mid-read must NEVER rebuild the page under
   her: new messages come in at the TOP, so a rebuild moved her scroll spot and
   collapsed anything she had open. poll() buffers them instead and raises this;
   tapping it is what shows them. Sits below the now-playing bar when both are
   up (sibling selector — no JS coordination). */
.newbar{position:fixed; top:max(14px, env(safe-area-inset-top)); left:50%; transform:translateX(-50%) translateZ(0); z-index:11; display:none; align-items:center; gap:7px; background:var(--rose); color:var(--paper); border:none; border-radius:6px; padding:9px 14px; box-shadow:0 2px 12px rgba(0,0,0,.18); cursor:pointer; -webkit-tap-highlight-color:transparent; font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.12em; text-transform:uppercase;}
.newbar.show{display:flex;}
.newbar svg{flex:none;}
.nowplaying.show ~ .newbar{top:calc(max(14px, env(safe-area-inset-top)) + 48px);}
/* Floating jump-to-top arrow — appears once you've scrolled down. */
.totop{position:fixed; right:max(14px,4vw); bottom:max(20px, env(safe-area-inset-bottom)); z-index:9; width:44px; height:44px; border-radius:6px; border:1px solid var(--line); background:var(--barbg); color:var(--ink2); cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,.09); display:none; align-items:center; justify-content:center; -webkit-tap-highlight-color:transparent; transform:translateZ(0);}
.totop.show{display:flex;}
.arow{display:flex; align-items:center; gap:10px; margin:0 0 10px;}
/* Search within a chat's Assets tab — matches the home search bar's shape
   (rounded rectangle, never a pill). */
.asearch{position:relative; margin:0 0 12px;}
.asearch input,.msgsearch input{width:100%; box-sizing:border-box; font-family:'EBGaramond',Georgia,serif;
  font-size:16px; padding:9px 38px 9px 12px; border:1px solid var(--line); border-radius:6px;
  background:var(--barbg); color:var(--ink);}
.asearch input:focus,.msgsearch input:focus{outline:none; border-color:var(--rose);}
.asearch input::-webkit-search-cancel-button,.msgsearch input::-webkit-search-cancel-button{-webkit-appearance:none; appearance:none;}
.asearch .qclear,.msgsearch .qclear{right:2px;}
/* Search WITHIN the open chat (the Chat tab's own messages) — separate from
   the home screen's search-all-chats bar. Collapsed by default behind the
   magnifier in the tab row, so it costs no space until she wants it; it reuses
   .asearch's shape so both in-thread searches look like one control. */
.msgsearch{display:none; position:relative; margin:0 0 14px;}
.msgsearch.open{display:block;}
.msgcount{font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.06em;
  text-transform:uppercase; color:var(--ink2); margin:-6px 0 12px;}
.afilter{display:flex; border:1.5px solid var(--line); border-radius:999px; overflow:hidden; background:var(--barbg); flex:none;}
.afilter button{border:none; background:transparent; color:var(--ink2); font-family:-apple-system,sans-serif; font-size:11px;
  letter-spacing:.05em; text-transform:uppercase; padding:7px 12px; cursor:pointer; -webkit-tap-highlight-color:transparent;}
.afilter button+button{border-left:1px solid var(--line);}
.afilter button.on{background:var(--rose); color:#fff;}
#toast{position:fixed; bottom:calc(64px + env(safe-area-inset-bottom)); left:50%; transform:translateX(-50%);
  background:var(--ink); color:var(--paper); font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.06em;
  padding:8px 14px; border-radius:6px; opacity:0; transition:opacity .25s; pointer-events:none;}
@media (prefers-reduced-motion: reduce){ #toast{transition:none;} }

__PILL_CSS__
/* While a full-screen overlay is open (Compare page viewer, image lightbox)
   this page's OWN pill must be hidden: the viewer supplies its own pill for
   the iframe, and `.float` is promoted to its own layer (translateZ), which
   iOS paints ABOVE the overlay despite the lower z-index — so Sophie saw TWO
   pills stacked. Child selector: the viewer's pill lives inside .pageview.
   NOTE: this is a CHATS-page rule, not a pill.py rule — it lives OUTSIDE the
   shared-pill placeholder so a pill resync can never swallow it again. */
body.ontop > .float{display:none !important;}

</style>

__PILL_HTML__

<div class="backwrap"><button id="back" aria-label="Back to all chats">&#8249;</button></div>
<div id="nowplaying" class="nowplaying" role="button" aria-label="Play or pause audio"><span id="npic"></span><span id="nptxt">Playing</span></div>
<button id="newbar" class="newbar" aria-label="Show new messages"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg><span id="newtxt">New message</span></button>
<button id="totop" class="totop" aria-label="Back to top"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg></button>
<div class="wrap">
  <section id="home">
    <header>
      <div class="no">deck factory &middot; every chat, one place</div>
      <div style="display:flex; align-items:center; gap:10px; padding-right:56px;">
        <h1 id="htitle" style="flex:1; min-width:0; margin:0">Chats</h1>
        <button id="bmklink" class="bmk hdrbmk" aria-label="Bookmarked messages"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>
        <button id="archlink" class="archlink">Archive</button>
        <button id="acctog" class="swi" aria-label="Swap which Claude account is signed into the app"></button>
      </div>
      <div class="rule"></div>
    </header>
    <div style="display:flex; align-items:center; gap:10px; margin:0 0 1em; flex-wrap:wrap;">
      <div class="viewtog" style="margin:0"><button id="v-list">List</button><button id="v-tiles">Tiles</button></div>
      <button id="refresh" class="tbtn refreshbtn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg><span>Refresh</span></button>
    </div>
    <div class="searchrow">
      <input id="qsearch" type="search" placeholder="Search all chats&hellip;" autocomplete="off" autocorrect="off">
      <button id="qclear" class="qclear" aria-label="Clear search" style="display:none">&times;</button>
    </div>
    <div id="searchresults" style="display:none"></div>
    <div id="grid"><div class="state">Loading&hellip;</div></div>
  </section>
  <section id="thread" style="display:none"></section>
</div>
<div id="toast"></div>
<div id="clightbox"></div>
<script>
(function(){
var TOKEN='__STUDIO_TOKEN__';
function api(path,opt){ opt=opt||{}; opt.headers=Object.assign({'x-studio-token':TOKEN,'Content-Type':'application/json'},opt.headers||{}); return fetch(path,opt); }
function toast(m){ var t=document.getElementById('toast'); t.textContent=m; t.style.opacity=1; setTimeout(function(){t.style.opacity=0},1800); }
// Copy button on every fenced code block (works in Safari AND the iOS app's
// WKWebView — clipboard API first, hidden-textarea execCommand fallback).
var COPY_ICON='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
var CHECK_ICON='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
document.addEventListener('click', function(e){
  var b=e.target&&e.target.closest?e.target.closest('.codecopy'):null;
  if(!b) return;
  e.stopPropagation();
  var pre=b.parentNode.querySelector('pre');
  var text=pre?pre.textContent:'';
  function ok(){ b.innerHTML=CHECK_ICON; b.classList.add('done'); toast('Copied');
    setTimeout(function(){ b.innerHTML=COPY_ICON; b.classList.remove('done'); },1600); }
  function fallback(){
    var ta=document.createElement('textarea'); ta.value=text;
    ta.style.position='fixed'; ta.style.top='0'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    var done=false; try{ done=document.execCommand('copy'); }catch(_){}
    document.body.removeChild(ta);
    if(done) ok(); else toast('Copy failed');
  }
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(ok,fallback); }
  else fallback();
});
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
// Light markdown for the full message view: escape FIRST (safe), then style.
// Bold/italics/inline code render for real; fenced code becomes a quiet <pre>;
// heading marks become bold lines. Everything else stays plain text.
function md(t){
  var s=esc(t);
  s=s.replace(/```[a-z]*\n?([\s\S]*?)```/g, function(_,c){ return '<div class="codebox"><pre>'+c.replace(/\s+$/,'')+'</pre><button class="codecopy" aria-label="Copy code" title="Copy">'+COPY_ICON+'</button></div>'; });
  s=s.replace(/\*\*([^*\n][^*]*?)\*\*/g,'<b>$1</b>');
  s=s.replace(/(^|[\s(“"'>])\*([^*\n]+)\*/g,'$1<i>$2</i>');
  s=s.replace(/`([^`\n]+)`/g,'<code>$1</code>');
  s=s.replace(/^#{1,4}\s+(.+)$/gm,'<b>$1</b>');
  // Clickable links, added last so pre/code blocks stay untouched:
  // markdown [text](url) first, then bare https:// URLs.
  s=s.split(/(<div class="codebox">[\s\S]*?<\/div>|<code>[^<]*?<\/code>)/g).map(function(part){
    if(part.lastIndexOf('<div class="codebox">',0)===0||part.lastIndexOf('<code>',0)===0) return part;
    part=part.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
    part=part.replace(/(^|[^"'>])(https?:\/\/[^\s<)\]]+[^\s<)\].,!?:;'"])/g,'$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    return part;
  }).join('');
  return s;
}
// small cached thumbnails for the Assets grid (server resizes + caches)
// The messages follow a pattern: a bit for Sophie, a chunk of technical work in
// the MIDDLE, then a closing bit for Sophie. foldBody keeps everything spoken
// TO Sophie visible and tucks the working narration behind a tap — nothing
// deleted, one tap to reveal. The classifier is about VOICE, not vocabulary
// (per Sophie): "here are your cards" is a message for her even if it mentions
// chats.html; "Now I'm structuring the PDF" is work even though it's prose.
// Ties break toward showing. First and last blocks never fold.
function splitBlocks(text){
  var out=[], lines=String(text||'').split('\n'), buf=[], inCode=false;
  function flush(){ var s=buf.join('\n'); if(s.trim()!=='') out.push(s); buf=[]; }
  for(var i=0;i<lines.length;i++){
    var l=lines[i];
    if(/^\s*```/.test(l)){
      if(inCode){ buf.push(l); out.push(buf.join('\n')); buf=[]; inCode=false; }
      else { flush(); buf.push(l); inCode=true; }
      continue;
    }
    if(inCode){ buf.push(l); continue; }
    if(l.trim()===''){ flush(); } else { buf.push(l); }
  }
  if(inCode){ out.push(buf.join('\n')); } else { flush(); }
  return out;
}
// true = working narration (fold), false = message for Sophie (show).
function isWork(b){
  var t=b.trim(); if(!t) return false;
  if(/^```/.test(t)) return true;                    // fenced code = always work
  if(/https?:\/\//.test(t)) return false;            // links are for her
  // Narration voice wins even when the block mentions "you" ("the way you
  // asked"): forward-looking / in-progress first person = doing the work.
  if(/^(now|next|then|first|second|also|finally|meanwhile)[,: ]*\s*(i|let|the|to|on|checking|running|building|reading|writing|adding|updating|fixing|creating|testing|mirroring|committing|wiring|regenerating)/i.test(t)
    || /^(let me|let's|i'll|i will|time to|on to|onto)\b/i.test(t)
    || /^i'?m\s+(going|now|checking|running|building|adding|updating|reading|writing|looking|fixing|creating|testing|wiring|mirroring|committing|pushing)\b/i.test(t)
    || /^(checking|running|building|reading|verifying|validating|testing|committing|pushing|regenerating|mirroring|inspecting|looking)\b/i.test(t)) return true;
  if(/\byou\b|\byour\b|\byours\b/i.test(t)) return false;   // second person = talking to her
  if(/\bhere('s| is| are)\b|\bthis is what\b/i.test(t)) return false;  // presenting something
  if(/\?\s*($|\n)/.test(t)) return false;            // asking her something
  // Past-tense first-person = reporting what got done — that's for her.
  if(/^(done|all set|merged|shipped|fixed|finished|ok(ay)?[,!. ]|good news|both|everything)\b/i.test(t)
    || /^i('ve| have)?\s*(did|made|built|fixed|added|created|changed|updated|merged|shipped|removed|swapped|moved)\b/i.test(t)) return false;
  // Otherwise fall back to line texture: mostly commands/diffs/hashes/paths.
  var lines=t.split('\n').filter(function(l){ return l.trim()!==''; });
  if(!lines.length) return false;
  var hits=0;
  for(var i=0;i<lines.length;i++){
    var l=lines[i];
    if(/^\s*(\$|>|git|npm|npx|node|python3?|cd|curl|sudo|ls|cat|grep|mkdir|rm|cp|mv|chmod|brew|xcrun|pip|bash|sed|awk|echo|touch)\b/.test(l)
      || /^[+\-]\s/.test(l)                          // diff line
      || /\b[0-9a-f]{10,40}\b/.test(l)               // commit hash / long id
      || /\s\/[\w.-]+\/[\w./-]+/.test(l)             // absolute-ish path
    ) hits++;
  }
  return hits / lines.length >= 0.5;
}
function foldBody(text){
  var blocks=splitBlocks(text);
  if(blocks.length<3) return md(text);
  var work=blocks.map(isWork);
  // Each contiguous run of working blocks folds on its own, so a for-Sophie
  // paragraph in the middle is never swallowed. First/last blocks never fold.
  var out='', i=1, parts=[md(blocks[0])];
  while(i<blocks.length-1){
    if(!work[i]){ parts.push(md(blocks[i])); i++; continue; }
    var j=i; while(j<blocks.length-1 && work[j]) j++;
    var run=blocks.slice(i,j).join('\n\n');
    parts.push('<div class="fold"><button type="button" class="foldtog" aria-expanded="false">··· working details</button>'
      + '<div class="foldbody" hidden>'+md(run)+'</div></div>');
    i=j;
  }
  parts.push(md(blocks[blocks.length-1]));
  out=parts.join('\n');
  return out.indexOf('foldtog')<0 ? md(text) : out;
}
function assetThumb(u){ return '/api/story/thumb?w=480&url='+encodeURIComponent(u); }
// previews/status lines: strip the marks instead of showing asterisks
function plain(t){ return String(t==null?'':t).replace(/[*_`#]/g,''); }
function ago(iso){
  var s=(Date.now()-new Date(iso).getTime())/1000;
  if(s<90) return 'just now';
  if(s<5400) return Math.round(s/60)+'m ago';
  if(s<129600) return Math.round(s/3600)+'h ago';
  return Math.round(s/86400)+'d ago';
}

__PILL_JS__

var chats={}, msgs=[], cur=null, seen={}, homeY=0, openUrl='', curTab='chat';
// Feed-wide settings from the server (registry __settings doc). appAccount =
// which Claude account is signed into the iOS app right now ("1"/"2").
var settings={};
// The feed hands us only a tail per chat (chatfeed.js trims it so the app
// doesn't download the entire history on every launch). `truncated` marks the
// chats that have more behind them; `fullLoaded` remembers which ones we've
// already pulled in full, so opening a chat twice doesn't refetch.
var truncated={}, fullLoaded={};
var view=(function(){ try{ return localStorage.getItem('chats-view')||'list'; }catch(e){ return 'list'; } })();
// Claude "spark" mark (simple hand-inlined equivalent, white on orange)
var CLAUDE_STAR='<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M12 2.5v6M12 15.5v6M2.5 12h6M15.5 12h6M5.4 5.4l4.2 4.2M14.4 14.4l4.2 4.2M18.6 5.4l-4.2 4.2M9.6 14.4l-4.2 4.2"/></svg>';
function claudeUrlFor(name, list){
  var u=(chats[name]&&chats[name].url)||'';
  if(!u && list){ for(var i=list.length-1;i>=0;i--){ if(list[i].url){ u=list[i].url; break; } } }
  return u;
}
function appAccount(){ return (settings&&settings.appAccount)||'1'; }
// The href an Open button should use for this chat. A chat on the account
// that's signed into the app gets the direct claude.ai link (iOS hands it to
// the Claude app); a chat on the OTHER account gets the same link with
// #no_universal_links appended — claude.ai's own apple-app-site-association
// EXCLUDES any URL carrying that fragment (their first match rule, checked
// July 2026), so iOS never hands it to the Claude app and it opens in the
// BROWSER, where that account is signed in. This replaced the /go redirect
// hop: both a server 302 and a self-navigating page were verified live to
// bounce into the app anyway. Chats with no account tag keep the old direct
// behavior.
function openHref(name,url){
  var acct=(chats[name]&&chats[name].account)||'';
  if(!url||!acct||acct===appAccount()) return url;
  return url+(url.indexOf('#')<0?'#no_universal_links':'');
}
function openClaudeBtn(url){
  var a=document.createElement('a'); a.className='openclaude'; a.href=url; a.target='_blank'; a.rel='noopener';
  a.innerHTML=CLAUDE_STAR+'<span>Open</span>';
  a.onclick=function(e){ e.stopPropagation(); };
  return a;
}
try{ seen=JSON.parse(localStorage.getItem('chats-seen-v1')||'{}'); }catch(e){}
function markSeen(name){
  var g=groups()[name]; if(!g||!g.length) return;
  seen[name]=g[g.length-1].created||'';
  try{ localStorage.setItem('chats-seen-v1',JSON.stringify(seen)); }catch(e){}
}

function editAbout(chat, row, current){
  // inline editor (WKWebView blocks window.prompt), saves to /about
  var inp=document.createElement('input'); inp.type='text'; inp.className='abouted';
  inp.value=current||''; inp.placeholder='What is this project? (one line)'; inp.maxLength=140;
  row.innerHTML=''; row.appendChild(inp); inp.focus();
  var done=false;
  function save(){
    if(done) return; done=true;
    var v=inp.value.trim();
    api('/api/chatfeed/about',{method:'POST',body:JSON.stringify({chat:chat,about:v})})
      .then(function(r){return r.json()})
      .then(function(d){ if(!d.ok) throw 0;
        chats[chat]=chats[chat]||{}; chats[chat].about=v;
        row.innerHTML='<span class="aboutshow">'+(v?esc(v):'add a description')+'</span>';
        row.querySelector('.aboutshow').onclick=function(){ editAbout(chat,row,v); };
        toast('Saved'); })
      .catch(function(){ done=false; toast('Couldn\u2019t save'); });
  }
  inp.addEventListener('blur',save);
  inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); inp.blur(); } });
}

// Rename a chat from its thread header (WKWebView blocks window.prompt, so an
// inline input). Saves a cosmetic displayName; the chat key never changes, so
// messages keep grouping the same way. Empty clears back to the key.
function editName(chat, head){
  var th=head.querySelector('.thread-head'); var h1=th.querySelector('h1');
  var btn=th.querySelector('.renamebtn'); if(btn) btn.style.display='none';
  var inp=document.createElement('input'); inp.type='text'; inp.className='nameed';
  inp.value=dispName(chat); inp.placeholder=chat; inp.maxLength=60;
  h1.style.display='none'; th.insertBefore(inp,h1); inp.focus(); inp.select();
  var done=false;
  function restore(label){
    h1.textContent=label; h1.style.display=''; if(btn) btn.style.display='';
    if(inp.parentNode) inp.parentNode.removeChild(inp);
  }
  function save(){
    if(done) return; done=true;
    var v=inp.value.trim();
    api('/api/chatfeed/rename',{method:'POST',body:JSON.stringify({chat:chat,name:v})})
      .then(function(r){return r.json()})
      .then(function(d){ if(!d.ok) throw 0;
        chats[chat]=chats[chat]||{}; chats[chat].displayName=v||null;
        restore(dispName(chat)); toast('Renamed'); })
      .catch(function(){ done=false; if(btn) btn.style.display='none'; toast('Couldn\u2019t save that'); inp.focus(); });
  }
  inp.addEventListener('blur',save);
  inp.addEventListener('keydown',function(e){
    if(e.key==='Enter'){ e.preventDefault(); inp.blur(); }
    else if(e.key==='Escape'){ done=true; restore(dispName(chat)); }
  });
}

function setIcon(chat){
  var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange=function(){
    var f=inp.files&&inp.files[0]; if(!f) return;
    var img=new Image();
    img.onload=function(){
      var cv=document.createElement('canvas'); var m=Math.min(img.width,img.height);
      cv.width=200; cv.height=200;
      cv.getContext('2d').drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,200,200);
      api('/api/chatfeed/icon',{method:'POST',body:JSON.stringify({chat:chat,image:cv.toDataURL('image/jpeg',.85)})})
        .then(function(r){return r.json()})
        .then(function(d){ if(!d.ok) throw 0; toast('Icon set'); load(); })
        .catch(function(){ toast('Couldn\u2019t set the icon'); });
    };
    img.src=URL.createObjectURL(f);
  };
  inp.click();
}

// messages grouped per chat, oldest first
function groups(){
  var g={};
  msgs.slice().sort(function(a,b){ return (a.created||'')<(b.created||'')?-1:1; })
    .forEach(function(m){ (g[m.chat]=g[m.chat]||[]).push(m); });
  return g;
}
// The label Sophie sees for a chat. Defaults to the underlying chat key
// (branch-derived); a custom displayName set in-app overrides it. Messages
// still group by the real key, so renaming only changes the label.
function dispName(name){ return (chats[name]&&chats[name].displayName)||name; }
function iconHtml(name, cls){
  var icon=chats[name]&&chats[name].icon;
  if(icon) return '<img alt="" src="'+esc(icon)+'"'+(cls?' class="'+cls+'"':'')+'>';
  return '<span class="t-blank'+(cls?' '+cls:'')+'"><span>'+esc((dispName(name)||'?').slice(0,1).toUpperCase())+'</span></span>';
}

function sortedChatNames(g){
  // both views: most recent activity first (chats with no messages sink)
  var names=Object.keys(g);
  Object.keys(chats).forEach(function(n){ if(names.indexOf(n)<0) names.push(n); });
  names.sort(function(a,b){
    var la=(g[a]&&g[a][g[a].length-1].created)||'', lb=(g[b]&&g[b][g[b].length-1].created)||'';
    return la<lb?1:-1;
  });
  return names;
}
// status line = the latest message that carries a TLDR (what the project last
// did); fall back to the last message's first line
function statusFor(list){
  var last=list.length? list[list.length-1] : null;
  var tldrs=list.filter(function(m){return m.tldr;});
  var sm=tldrs.length? tldrs[tldrs.length-1] : last;
  return sm? plain(sm.tldr||(sm.text||'').split('\n')[0]) : '';
}
// The home screen has THREE views: the live chats, the archived ones, and every
// bookmarked message across all chats. `homeView` survives opening a chat and
// coming back, so she returns to the list she was reading.
var homeView='live';   // 'live' | 'archive' | 'bookmarks'
// Where am I / how do I leave. The title carries the state (the word alone was
// "really confusing" — Sophie), the archlink carries the exit.
function paintHomeChrome(){
  document.getElementById('htitle').textContent =
    homeView==='archive' ? 'Archive' : homeView==='bookmarks' ? 'Bookmarks' : 'Chats';
  var a=document.getElementById('archlink');
  a.textContent = homeView==='live' ? 'Archive' : '← Chats';
  a.setAttribute('aria-label', homeView==='live' ? 'Show archived chats' : 'Back to all chats');
  a.classList.toggle('on', homeView!=='live');
  document.getElementById('bmklink').classList.toggle('on', homeView==='bookmarks');
  // LIST/TILES describes chat tiles; bookmarks are messages, so the pair would
  // be a control that does nothing. (Search stays — it still searches everything.)
  document.getElementById('v-list').parentNode.style.display = homeView==='bookmarks' ? 'none' : '';
}
function setHomeView(v){ homeView = (homeView===v ? 'live' : v); renderHome(); window.scrollTo(0,0); }
// Every bookmarked message, newest first, whichever chat it is in. Tapping one
// opens its chat and jumps to it — the same focus+flash the search results use.
// The two things she actually bookmarks (her words): something with code /
// copy-paste instructions to keep, and a long explanation to read later. The
// server derives which from the message itself (a fenced code block = the
// first kind), so she never has to categorise anything — these chips only
// filter what's already sorted. Kept for the session, not persisted: the
// default should always be everything.
var bmkFilter='all';   // 'all' | 'code' | 'read'
var bmkCache=null;
function paintBookmarks(el){
  var items=(bmkCache||[]).filter(function(m){ return bmkFilter==='all' || (m.kind||'read')===bmkFilter; });
  var counts={all:(bmkCache||[]).length, code:0, read:0};
  (bmkCache||[]).forEach(function(m){ counts[(m.kind||'read')]++; });
  el.innerHTML='';
  var row=document.createElement('div'); row.className='bmkfilter';
  [['all','All'],['code','Code'],['read','To read']].forEach(function(p){
    var b=document.createElement('button');
    b.className='tbtn'+(bmkFilter===p[0]?' on':'');
    b.textContent=p[1]+' '+counts[p[0]];
    b.onclick=function(){ bmkFilter=p[0]; paintBookmarks(el); };
    row.appendChild(b);
  });
  el.appendChild(row);
  if(!items.length){
    var s=document.createElement('div'); s.className='state';
    s.textContent = counts.all ? 'Nothing in this one.'
      : 'No bookmarks yet — tap the bookmark under a message to keep it here.';
    el.appendChild(s); return;
  }
  items.forEach(function(m){
    var b=document.createElement('button'); b.className='sres';
    b.innerHTML='<div class="sr-top"><span class="sr-chat">'+esc(dispName(m.chat))+'</span>'
      +((m.kind||'read')==='code'?'<span class="sr-kind">code</span>':'')
      +'<span class="sr-time">'+ago(m.created)+'</span></div>'
      +'<div class="sr-snip">'+esc(m.snippet||'')+'</div>';
    b.onclick=function(){ openChat(m.chat, false, m.id); };
    el.appendChild(b);
  });
}
function renderBookmarks(el){
  el.innerHTML='<div class="state">Loading…</div>';
  api('/api/chatfeed/bookmarks?_='+Date.now())
    .then(function(r){return r.json()})
    .then(function(d){
      if(homeView!=='bookmarks') return;            // she left while it loaded
      if(d&&d.chats) chats=d.chats;                 // fresh display names
      bmkCache=(d&&d.items)||[];
      paintBookmarks(el);
    })
    .catch(function(){ if(homeView==='bookmarks') el.innerHTML='<div class="state">Couldn’t load bookmarks.</div>'; });
}
function renderHome(){
  clearNew();   // a full rebuild shows everything, so nothing is pending
  document.getElementById('v-list').classList.toggle('on', view==='list');
  document.getElementById('v-tiles').classList.toggle('on', view==='tiles');
  var el=document.getElementById('grid'); el.innerHTML='';
  var g=groups();
  var all=sortedChatNames(g);
  var names=all.filter(function(n){ return !(chats[n]&&chats[n].archived); });
  var arch=all.filter(function(n){ return chats[n]&&chats[n].archived; });
  paintHomeChrome();
  if(homeView==='bookmarks'){ renderBookmarks(el); return; }
  // ARCHIVE is a VIEW, not a fold at the bottom of the live list: the word at
  // the top of the screen swaps the grid over to the archived chats and back.
  if(homeView==='archive'){
    if(!arch.length){ el.innerHTML='<div class="state">Nothing archived yet.</div>'; return; }
    if(view==='list') renderList(el,g,arch); else renderTiles(el,g,arch);
    return;
  }
  if(!all.length){ el.innerHTML='<div class="state">Nothing yet — chats appear here as they finish replies.</div>'; return; }
  if(view==='list') renderList(el,g,names); else renderTiles(el,g,names);
}
// A chat is "answered" (green check) while its answeredAt stamp is >= its latest
// message — any newer message (from Sophie or the chat) un-grays it. "Flagged"
// (amber !) works the same way but means "come back to this later." The two are
// exclusive; either one grays the tile.
function stampActive(a,last){ if(!a) return false; return !last || a>=(last.created||''); }
function chatDone(name,last){ return stampActive((chats[name]&&chats[name].answeredAt)||'', last); }
function chatFlagged(name,last){ return stampActive((chats[name]&&chats[name].flaggedAt)||'', last); }
function chatMuted(name,last){ return chatDone(name,last)||chatFlagged(name,last); }
// A chat counts as WORKING on either of two signals, and it needs both:
//
//   1. its newest message is a live draft (working:true — the hook's
//      PostToolUse pass posts the turn's prose as it is written, and the Stop
//      post clears the flag), or
//   2. its newest message is HERS — she asked and nothing has come back yet.
//
// (2) is not a nicety. Shipped with (1) alone, the tint never appeared once:
// the hook installed in these sessions is the pre-v7 build, which registers
// only Stop and UserPromptSubmit, so `working:true` is never written and the
// live feed contains zero drafts (checked live, 2026-08-07). It also covers
// the gap between her message and the turn's first prose, which even a v7
// hook can't fill. Measured against the real feed, (2) tints 1 chat of 71 —
// precise, not a wall of pink.
//
// The cap: `postedAt` bumps on every draft growth, so a draft that hasn't
// moved in hours belongs to a session that died mid-turn, and a message of
// hers that has gone hours unanswered belongs to a chat that is not coming
// back. Without it either would stay tinted forever.
var LIVE_STALE=3*60*60*1000;
// The PRIMARY signal is the registry's turn-start mark (`workingAt`, stamped
// by the hook's UserPromptSubmit ping the moment she messages a session,
// cleared by the reply's own registry write). The message-shaped signals are
// fallbacks: they only become true at the END of a turn (the hook can't lift
// her message from the transcript until then — measured live, her messages'
// postedAt lands ~1s before the reply's), which is why the tint originally
// never showed. The backstop comparison against the newest reply covers a
// missed clear: a reply posted AFTER the mark means the turn finished.
function chatWorking(name,last){
  var now=Date.now();
  var wa=Date.parse((chats[name]&&chats[name].workingAt)||'');
  if(wa && (now-wa)<LIVE_STALE){
    if(!last || last.from==='sophie' || wa>Date.parse(last.postedAt||last.created||'')) return true;
  }
  if(!last) return false;
  if(!last.working && last.from!=='sophie') return false;
  var at=Date.parse(last.postedAt||last.created||'');
  return !at || (now-at) < LIVE_STALE;
}
var CK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
var FL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10"/><path d="M12 19h.01"/></svg>';
// Repaint the gray state + both mark buttons on a tile/row from current state.
function paintMarks(name,last,container){
  container.classList.toggle('done', chatMuted(name,last));
  var ck=container.querySelector('.ckbtn'); if(ck) ck.classList.toggle('on', chatDone(name,last));
  var fl=container.querySelector('.flagbtn'); if(fl) fl.classList.toggle('on', chatFlagged(name,last));
}
// Repaint just the working tint on the tiles/rows already on screen. A draft
// starting or finishing must show up even when she's scrolled down the home
// screen, where a full renderHome() would rebuild the grid under her.
function paintLive(){
  var nodes=document.querySelectorAll('#grid [data-chat]');
  if(!nodes.length) return;
  var g=groups();
  nodes.forEach(function(node){
    var list=g[node.dataset.chat]||[];
    node.classList.toggle('live', chatWorking(node.dataset.chat, list.length? list[list.length-1] : null));
  });
}
function mkCheck(name,last,container){
  var ck=document.createElement('button'); ck.className='ckbtn'+(chatDone(name,last)?' on':'');
  ck.innerHTML=CK; ck.setAttribute('aria-label','Mark answered');
  ck.onclick=function(e){ e.stopPropagation(); toggleMark(name,last,container,'done'); };
  return ck;
}
function mkFlag(name,last,container){
  var fl=document.createElement('button'); fl.className='flagbtn'+(chatFlagged(name,last)?' on':'');
  fl.innerHTML=FL; fl.setAttribute('aria-label','Flag to come back to');
  fl.onclick=function(e){ e.stopPropagation(); toggleMark(name,last,container,'flag'); };
  return fl;
}
// One toggler for both marks. Setting one clears the other (exclusive); the
// server enforces the same so a reload matches. Optimistic with rollback.
function toggleMark(name,last,container,kind){
  var prevA=(chats[name]&&chats[name].answeredAt)||null, prevF=(chats[name]&&chats[name].flaggedAt)||null;
  chats[name]=chats[name]||{};
  var now=new Date().toISOString();
  if(kind==='done'){
    var willDone=!chatDone(name,last);
    chats[name].answeredAt = willDone? now : null;
    if(willDone) chats[name].flaggedAt=null;
    paintMarks(name,last,container);
    api('/api/chatfeed/answered',{method:'POST',body:JSON.stringify({chat:name, answered:willDone})})
      .then(function(r){return r.json()}).then(function(d){ if(!d.ok) throw 0; })
      .catch(function(){ chats[name].answeredAt=prevA; chats[name].flaggedAt=prevF; paintMarks(name,last,container); toast('Couldn’t save that'); });
  } else {
    var willFlag=!chatFlagged(name,last);
    chats[name].flaggedAt = willFlag? now : null;
    if(willFlag) chats[name].answeredAt=null;
    paintMarks(name,last,container);
    api('/api/chatfeed/flag',{method:'POST',body:JSON.stringify({chat:name, flagged:willFlag})})
      .then(function(r){return r.json()}).then(function(d){ if(!d.ok) throw 0; })
      .catch(function(){ chats[name].answeredAt=prevA; chats[name].flaggedAt=prevF; paintMarks(name,last,container); toast('Couldn’t save that'); });
  }
}
function renderTiles(el,g,names){
  var grid=document.createElement('div'); grid.id='chatgrid'; el.appendChild(grid);
  names.forEach(function(name){
    var list=g[name]||[];
    var last=list.length? list[list.length-1] : null;
    var unread=last && last.from!=='sophie' && (seen[name]||'')<(last.created||'');
    var status=statusFor(list);
    var about=(chats[name]&&chats[name].about)||'';
    var b=document.createElement('button'); b.className='tile'+(chatMuted(name,last)?' done':'')+(chatWorking(name,last)?' live':'');
    b.dataset.chat=name;
    b.innerHTML='<span class="t-cover">'+iconHtml(name)+(unread?'<span class="t-new"></span>':'')+'</span>'
      +'<span class="t-name">'+esc(dispName(name))+'</span>'
      +(about? '<span class="t-about">'+esc(about)+'</span>':'')
      +(status? '<span class="t-tldr">'+esc(status)+'</span>':'')
      +'<span class="t-meta">'+(last? ago(last.created) : 'no messages')+'</span>';
    var cov=b.querySelector('.t-cover'); cov.appendChild(mkCheck(name,last,b)); cov.appendChild(mkFlag(name,last,b));
    b.onclick=function(){ openChat(name); };
    grid.appendChild(b);
  });
}
function renderList(el,g,names){
  var wrap=document.createElement('div'); wrap.className='clist'; el.appendChild(wrap);
  names.forEach(function(name){
    var list=g[name]||[];
    var last=list.length? list[list.length-1] : null;
    var unread=last && last.from!=='sophie' && (seen[name]||'')<(last.created||'');
    var row=document.createElement('button'); row.className='crow'+(chatMuted(name,last)?' done':'')+(chatWorking(name,last)?' live':'');
    row.dataset.chat=name;
    // Just the chat's name (Sophie's rule). The message snippet that used to sit
    // beside it was an inline span, so it never truncated — it ran over the
    // timestamp and the ✓ and off the side of the screen.
    row.innerHTML=iconHtml(name,'cr-ic')
      +'<span class="cr-body"><span class="cr-name">'+esc(dispName(name))+'</span></span>'
      +(unread?'<span class="cr-dot"></span>':'')
      +'<span class="cr-time">'+(last? ago(last.created):'')+'</span>';
    row.insertBefore(mkFlag(name,last,row), row.firstChild.nextSibling);   // far from the check, so it's not an accidental tap
    row.appendChild(mkCheck(name,last,row));
    row.onclick=function(){ openChat(name); };
    wrap.appendChild(row);
  });
}

function renderMsg(m){
  var row=document.createElement('div'); row.className='msg'; if(m.id) row.dataset.mid=m.id;
  var firstLine=plain((m.tldr||m.text||'').split('\n')[0]).slice(0,140);
  row.innerHTML='<div class="m-head"><span class="m-chat'+(m.from==='sophie'?' sophie':'')+'">'
    +(m.from==='sophie'?'me':'claude')+'</span><span class="m-time">'+ago(m.created)+'</span>'
    +(m.working?'<span class="m-working">still writing…</span>':'')
    +'<span class="m-close">close &#9650;</span></div>'
    +'<div class="m-preview">'+esc(firstLine)+((m.text||'').length>140?'\u2026':'')+'</div>'
    +'<div class="m-full">'+foldBody(m.text)+'</div>';
  // Wire the "working details" fold toggles (a message can have several).
  // Stops propagation so a tap doesn't also trigger the reading-aid autoscroll.
  row.querySelectorAll('.foldtog').forEach(function(ft){
    ft.onclick=function(e){ e.stopPropagation();
      var body=ft.nextElementSibling, open=body.hasAttribute('hidden');
      if(open){ body.removeAttribute('hidden'); ft.setAttribute('aria-expanded','true'); ft.classList.add('open'); }
      else { body.setAttribute('hidden',''); ft.setAttribute('aria-expanded','false'); ft.classList.remove('open'); }
    };
  });
  var tools=document.createElement('div'); tools.className='m-tools';
  if(m.audioUrl){ var au=document.createElement('audio'); au.controls=true; au.preload='none'; au.src=m.audioUrl; tools.appendChild(au); }
  else if(m.from!=='sophie' && !m.working){
    // no Play on a live draft — the voice render would freeze a half-written
    // reply; the button appears when the message finishes
    // Play = generate the neural voice on demand (~1¢), cached forever after.
    // Sophie taps it when she wants to listen — she stays in control.
    var PLAY='<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
    var pol=document.createElement('button'); pol.className='tbtn play'; pol.innerHTML=PLAY+'<span>Play</span>';
    pol.onclick=function(e){
      e.stopPropagation();
      pol.disabled=true; pol.innerHTML=PLAY+'<span>making\u2026</span>';
      api('/api/chatfeed/polish',{method:'POST',body:JSON.stringify({id:m.id})})
        .then(function(r){return r.json()})
        .then(function(d){
          if(!d.ok||!d.url) throw 0;
          m.audioUrl=d.url;
          var au=document.createElement('audio'); au.controls=true; au.src=d.url; au.autoplay=true;
          tools.replaceChild(au,pol);
        })
        .catch(function(){ pol.disabled=false; pol.innerHTML=PLAY+'<span>Play</span>'; toast('Couldn\u2019t make that one'); });
    };
    tools.appendChild(pol);
  }
  // audio (player or Play) sits at the TOP of the message, under the header
  row.insertBefore(tools, row.querySelector('.m-preview'));
  row.querySelector('.m-preview').onclick=function(){ row.classList.add('open'); };
  // tapping the open message toggles autoscroll (stop/start). Closing is the
  // header row ("close ▲") so a tap never collapses it.
  // PASS THE EVENT. __scrollTap's own PILL_SKIP list is what exempts every
  // interactive control (button, link, input, media) from the tap gesture —
  // called bare it exempts nothing, so tapping a code block's COPY button
  // copied AND started the autoscroll (the copy handler's stopPropagation is
  // a document-level listener, so it runs after this one, too late to help).
  // pre/code stay on top of that list: selecting text in a code block is not
  // a tap on the page.
  row.querySelector('.m-full').onclick=function(e){
    if(e.target.closest('pre')||e.target.closest('code')) return;
    window.__scrollTap(e);
  };
  row.querySelector('.m-head').onclick=function(){
    if(row.classList.contains('open')){ window.__scrollStop(); row.classList.remove('open'); }
  };
  // Bottom row: bookmark (left) + Open-in-Claude (right).
  var ob=document.createElement('div'); ob.className='openrow';
  ob.appendChild(bookmarkBtn(m));
  var murl=m.url||openUrl;
  if(murl){ ob.appendChild(openClaudeBtn(openHref(m.chat, murl))); }
  row.appendChild(ob);
  return row;
}

// Bookmark toggle for a message — saves server-side (a field on the message
// doc) so a flagged message stays marked across reloads and any chat can find
// what Sophie marked to keep.
function bookmarkBtn(m){
  var BM='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
  var b=document.createElement('button'); b.className='bmk'+(m.bookmarked?' on':'');
  b.setAttribute('aria-label','Bookmark this message'); b.innerHTML=BM;
  b.onclick=function(e){
    e.stopPropagation();
    var nv=!m.bookmarked; m.bookmarked=nv; b.classList.toggle('on',nv);
    api('/api/chatfeed/bookmark',{method:'POST',body:JSON.stringify({id:m.id, bookmarked:nv})})
      .then(function(r){return r.json()})
      .then(function(d){ if(!d.ok) throw 0; })
      .catch(function(){ m.bookmarked=!nv; b.classList.toggle('on',!nv); toast('Couldn’t save that'); });
  };
  return b;
}

// focusId: scroll to & highlight a specific message after opening (used by
// search, so a hit hundreds of messages back is actually shown, not the newest
// message). noFetch guards the one-shot full-history load so it can't loop.
// Pull a chat's FULL history the first time it's opened. Background job, never
// a spinner: the tail we already have renders instantly and the older messages
// fold in underneath when they land, so scrolling back always reaches
// everything even though the first load only carried the last few.
function ensureFullThread(name){
  if(!truncated[name] || fullLoaded[name]) return;
  fullLoaded[name]=1;
  api('/api/chatfeed/thread?chat='+encodeURIComponent(name)+'&_='+Date.now())
    .then(function(r){return r.json()})
    .then(function(d){
      var have={}; msgs.forEach(function(m){ have[m.id]=1; });
      var added=0;
      (d.messages||[]).forEach(function(m){ if(!have[m.id]){ msgs.push(m); have[m.id]=1; added++; } });
      // Only rebuild if she's still on this chat, and hold her scroll spot.
      if(added && cur===name){ var y=window.scrollY; openChat(name,true,null,true); window.scrollTo(0,y); }
    })
    .catch(function(){ fullLoaded[name]=0; });   // let a later open retry
}
function openChat(name, keepScroll, focusId, noFetch){
  if(!cur) homeY=window.scrollY;   // remember the feed spot for back
  scrollStop(); cur=name;
  if(!noFetch) ensureFullThread(name);
  var sec=document.getElementById('thread');
  // A rebuild (the full history landing ~1s after entering, the New-message
  // bar, an account change) must NOT collapse what she's reading: it made a
  // just-tapped message look like it closed itself, forcing a second tap.
  // Carry the open rows across, matched by message id.
  var wasOpen={};
  sec.querySelectorAll('.msg.open').forEach(function(r){ if(r.dataset.mid) wasOpen[r.dataset.mid]=1; });
  sec.innerHTML='';
  var list=(groups()[name])||[];
  var head=document.createElement('header');
  head.innerHTML='<div class="no"><span class="crumb">chats</span></div>'
    +'<div class="thread-head">'+iconHtml(name)+'<h1>'+esc(dispName(name))+'</h1><button class="renamebtn" aria-label="Rename this chat"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button></div>'
    +'<div class="headbtns"><div class="viewtog" style="margin:0"><button class="tg-chat on">Chat</button><button class="tg-assets">Assets</button><button class="tg-compare">Compare</button></div>'
    +'<button class="tbtn threadsearch" aria-label="Search this chat" style="padding:6px 9px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button>'
    +'<button class="tbtn threadrefresh" aria-label="Refresh" style="padding:6px 9px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg></button></div><div class="rule"></div>';
  head.querySelector('.threadrefresh').onclick=function(){ toast('Refreshing\u2026'); load(); };
  // Archive sits beside the chat's NAME, above the tab bar, and reads as plain
  // text rather than a button \u2014 it isn't a place to go, it's a thing you do
  // once. Same word and same spot either way: "Archive" / "Unarchive".
  (function(){
    var isArch=!!(chats[name]&&chats[name].archived);
    var ab=document.createElement('button');
    ab.textContent=isArch? 'Unarchive' : 'Archive';
    ab.onclick=function(){
      if(!isArch){ askFirst('Archive '+dispName(name)+'?', 'Archive', function(ok){ if(ok) doArchive(); }); }
      else doArchive();
    };
    function doArchive(){
      api('/api/chatfeed/archive',{method:'POST',body:JSON.stringify({chat:name, archived:!isArch})})
        .then(function(r){return r.json()})
        .then(function(d){ if(!d.ok) throw 0;
          chats[name]=chats[name]||{}; chats[name].archived=!isArch;
          toast(!isArch? 'Archived' : 'Restored'); goHome();
        })
        .catch(function(){ toast('Couldn\u2019t save that'); });
    }
    ab.className='archlink';   // reads as text, still a button
    head.querySelector('.no').appendChild(ab);
  })();
  var curl=claudeUrlFor(name, list); openUrl=curl;   // renderMsg reads openUrl
  sec.appendChild(head);
  head.querySelector('.renamebtn').onclick=function(){ editName(name, head); };

  // Chat panel — the messages (newest at top) + archive control
  var chatPanel=document.createElement('div');
  // Search THIS chat's messages. The home screen's bar searches every chat at
  // once; this one stays inside the thread she already opened. Collapsed until
  // the magnifier is tapped, and it filters what's already rendered — no
  // request per keystroke — matching a message's preview line and its whole
  // body, so a phrase buried deep in a long reply still finds it.
  var srow=document.createElement('div'); srow.className='msgsearch';
  var sinp=document.createElement('input'); sinp.type='search';
  sinp.placeholder='Search this chat…';
  sinp.autocapitalize='none'; sinp.autocorrect='off'; sinp.setAttribute('autocomplete','off');
  var sclr=document.createElement('button'); sclr.className='qclear'; sclr.innerHTML='&times;';
  sclr.style.display='none'; sclr.setAttribute('aria-label','Clear search');
  srow.appendChild(sinp); srow.appendChild(sclr);
  var scount=document.createElement('div'); scount.className='msgcount'; scount.style.display='none';
  chatPanel.appendChild(srow); chatPanel.appendChild(scount);
  if(!list.length) chatPanel.appendChild(Object.assign(document.createElement('div'),{className:'state',textContent:'No messages yet.'}));
  // Each row is indexed once against the text it was built from, not re-read
  // out of the DOM on every keystroke.
  var mrows=[];
  list.slice().reverse().forEach(function(m){
    var row=renderMsg(m);
    if(m.id&&wasOpen[m.id]) row.classList.add('open');
    mrows.push({row:row, hay:((m.tldr||'')+' '+(m.text||'')+' '+(m.from==='sophie'?'me':'claude')).toLowerCase()});
    chatPanel.appendChild(row);
  });
  function applyMsgFilter(){
    var q=(sinp.value||'').trim().toLowerCase();
    sclr.style.display=q?'':'none';
    if(!q){
      mrows.forEach(function(r){ r.row.style.display=''; });
      scount.style.display='none';
      return;
    }
    var hits=0;
    mrows.forEach(function(r){
      var on=r.hay.indexOf(q)>=0;
      r.row.style.display=on?'':'none';
      if(on) hits++;
    });
    scount.style.display='';
    scount.textContent=hits? (hits+' message'+(hits===1?'':'s')) : 'No messages match that';
  }
  sinp.oninput=applyMsgFilter;
  sclr.onclick=function(){ sinp.value=''; applyMsgFilter(); sinp.focus(); };
  var tsBtn=head.querySelector('.threadsearch');
  tsBtn.onclick=function(){
    var open=srow.classList.toggle('open');
    tsBtn.classList.toggle('on', open);
    if(open){ sinp.focus(); }
    else { sinp.value=''; applyMsgFilter(); }   // closing always restores every message
  };
  // Every message carries its own Open button (added in renderMsg). With no
  // messages at all, fall back to one in the header row.
  if(curl && !list.length){ head.querySelector('.headbtns').appendChild(openClaudeBtn(openHref(name, curl))); }
  // Which Claude account this chat belongs to — normally stamped by the hook,
  // but existing chats haven't posted since the env vars were added, so this
  // sets it with one tap. Tapping the active number clears back to untagged.
  var acr=document.createElement('div'); acr.className='acctrow';
  var alab=document.createElement('span'); alab.textContent='Claude account'; acr.appendChild(alab);
  ['1','2'].forEach(function(v){
    var b=document.createElement('button'); b.className='tbtn'; b.textContent=v;
    function paintA(){ b.classList.toggle('on', ((chats[name]&&chats[name].account)||'')===v); }
    paintA(); acr._paints=(acr._paints||[]).concat(paintA);
    b.onclick=function(){
      var prev=(chats[name]&&chats[name].account)||'';
      var next=prev===v? '' : v;
      chats[name]=chats[name]||{}; chats[name].account=next;
      acr._paints.forEach(function(f){f();}); saveCache();
      api('/api/chatfeed/account',{method:'POST',body:JSON.stringify({chat:name, account:next})})
        .then(function(r){return r.json()})
        .then(function(d){ if(!d.ok) throw 0;
          toast(next? 'Opens with account '+next : 'Account cleared');
          // re-render so every Open button in the thread re-routes now
          var y=window.scrollY; openChat(name,true,null,true); window.scrollTo(0,y);
        })
        .catch(function(){ chats[name].account=prev; acr._paints.forEach(function(f){f();}); saveCache(); toast('Couldn’t save that'); });
    };
    acr.appendChild(b);
  });
  chatPanel.appendChild(acr);
  sec.appendChild(chatPanel);

  // Assets panel — this chat's images, lazy-loaded on first open
  var assetsPanel=document.createElement('div'); assetsPanel.style.display='none';
  assetsPanel.innerHTML='<div class="state">Loading images&hellip;</div>';
  sec.appendChild(assetsPanel);
  var assetsLoaded=false;
  function loadAssets(){
    if(assetsLoaded) return; assetsLoaded=true;
    // A page at a time. The old single request was a hard truncate: once a chat
    // passed the cap its OLDEST images silently stopped appearing (they were
    // never deleted — just never sent). More pages load as she scrolls.
    var PAGE=150;
    api('/api/gallery/assets?chat='+encodeURIComponent(name)+'&limit='+PAGE+'&offset=0')
      .then(function(r){return r.json()})
      .then(function(d){
        var a=(d&&d.assets)||[];
        assetsPanel.innerHTML='';
        if(!a.length){ assetsPanel.appendChild(Object.assign(document.createElement('div'),{className:'state',textContent:'No images from this chat yet.'})); return; }
        // Grid tiles load small thumbnails (served straight from storage's CDN
        // when they exist, else generated by /api/story/thumb); the lightbox
        // still opens the full image.
        // Thin three-way filter pill: New (unvoted) · ♥ (hearted) · Hide ✕
        // (everything but rejected). Tapping the active one turns the filter
        // off again, so the ✕'d tiles stay reachable to un-reject.
        var cells=[], filter=null, q='';
        // Everything written about an image is searchable: its label, the
        // model/quality caption, both halves of the prompt, and the whole note
        // thread — so "yellow raincoat" finds it by what's in the picture and
        // "watercolor" by how it was made. Built once per tile, not per keystroke.
        function haystack(it){
          if(it._hay==null){
            var t=[it.description, it.prompt, it.promptStyle, it.promptContent, it.note];
            (it.thread||[]).forEach(function(m){ t.push(m.text); });
            it._hay=t.filter(Boolean).join(' \n ').toLowerCase();
          }
          return it._hay;
        }
        function applyFilter(){
          var shown=0;
          cells.forEach(function(c){
            var v=c.it.vote||null, show=true;
            if(filter==='new') show=!v;
            else if(filter==='like') show=(v==='like');
            else if(filter==='nox') show=(v!=='dislike');
            if(show && q) show=haystack(c.it).indexOf(q)>=0;
            if(c.it._broken) show=false;   // a dead image stays hidden
            c.cell.style.display=show?'':'none';
            if(show) shown++;
          });
          none.style.display=(shown||!cells.length)?'none':'';
        }
        var seg=document.createElement('div'); seg.className='afilter';
        [['new','New'],['like','♥'],['nox','Hide ✕']].forEach(function(m){
          var sb=document.createElement('button'); sb.textContent=m[1]; sb.dataset.f=m[0];
          sb.onclick=function(){
            filter = filter===m[0] ? null : m[0];
            seg.querySelectorAll('button').forEach(function(x){ x.classList.toggle('on', x.dataset.f===filter); });
            applyFilter();
          };
          seg.appendChild(sb);
        });
        var arow=document.createElement('div'); arow.className='arow';
        arow.appendChild(seg);
        assetsPanel.appendChild(arow);
        // Search this tab's images by anything written about them. Filters as
        // she types (they're all already loaded — no request per keystroke) and
        // stacks with the ♥/New/Hide filter above.
        var srow=document.createElement('div'); srow.className='asearch';
        var si=document.createElement('input'); si.type='search';
        si.placeholder='Search these images…';
        si.autocapitalize='none'; si.autocorrect='off';
        var sx=document.createElement('button'); sx.className='qclear'; sx.innerHTML='&times;';
        sx.style.display='none'; sx.setAttribute('aria-label','Clear search');
        si.oninput=function(){
          q=(si.value||'').trim().toLowerCase();
          sx.style.display=q?'':'none';
          applyFilter();
        };
        sx.onclick=function(){ si.value=''; q=''; sx.style.display='none'; applyFilter(); si.focus(); };
        srow.appendChild(si); srow.appendChild(sx);
        assetsPanel.appendChild(srow);
        var none=document.createElement('div'); none.className='state';
        none.textContent='No images match that.'; none.style.display='none';
        assetsPanel.appendChild(none);
        // Load each thumb as it nears the viewport. An IntersectionObserver is
        // far more reliable in the app's WKWebView than native loading="lazy",
        // which routinely needed a tap to trigger. rootMargin loads a screen or
        // two ahead so scrolling feels instant.
        var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function(ents){
          ents.forEach(function(en){
            if(!en.isIntersecting) return;
            var im=en.target;
            if(im.dataset.src){ im.src=im.dataset.src; im.removeAttribute('data-src'); }
            io.unobserve(im);
          });
        }, {rootMargin:'900px 0px'}) : null;
        var grid=document.createElement('div'); grid.className='assetgrid';
        // ♥ / ✕ curation per tile (circular icon buttons — allowed by the
        // no-pills rule). Saved server-side per chat+url; tapping the active
        // one clears it. A ✕'d tile dims so the keepers stand out.
        var HEART=window.__HEART='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
        var XMARK=window.__XMARK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
        function voteBtns(cell,it){
          var hb=document.createElement('button'); hb.className='vote heart'; hb.innerHTML=HEART;
          var xb=document.createElement('button'); xb.className='vote nope'; xb.innerHTML=XMARK;
          // count of the chat's replies she hasn't opened yet (server sets unread)
          var nb=document.createElement('div'); nb.className='nbadge';
          function unreadCount(){
            if(!it.unread) return 0;
            var n=0, t=it.thread||[];
            for(var i=t.length-1;i>=0 && t[i].from==='chat';i--) n++;
            return n||1;
          }
          function paint(){
            hb.classList.toggle('on', it.vote==='like');
            xb.classList.toggle('on', it.vote==='dislike');
            cell.classList.toggle('nay', it.vote==='dislike');
            var n=unreadCount();
            nb.textContent=n?String(n):'';
            nb.style.display=n?'':'none';
            if(it._lbPaint) it._lbPaint();   // mirror into an open lightbox
            applyFilter();                   // a changed vote may hide/show tiles
          }
          it._paintCell=paint;
          function cast(v){
            var next = it.vote===v ? null : v;
            api('/api/gallery/assets/vote',{method:'POST',body:JSON.stringify({chat:name,url:it.url,vote:next})})
              .then(function(r){return r.json()})
              .then(function(d){ if(!d.ok) throw 0; it.vote=next; paint(); })
              .catch(function(){ toast('Couldn’t save that'); });
          }
          it._cast=cast;
          // Send one letter in this image's thread. The bubble is already on
          // screen by the time this runs (the lightbox appends it optimistically),
          // so this only confirms or flags it.
          it._noteSend=function(text,cb){
            var t=String(text||'').trim();
            if(!t){ if(cb)cb(false); return; }
            api('/api/gallery/assets/note',{method:'POST',
              body:JSON.stringify({chat:name,url:it.url,text:t,from:'sophie'})})
              .then(function(r){ return r.json().then(function(d){ return {s:r.status,d:d}; }); })
              .then(function(x){
                if(!x.d.ok) throw new Error(x.d.error||'failed');
                it.note=t;                       // legacy mirror, same as the server
                if(x.d.thread) it.thread=x.d.thread;
                it._hay=null;                    // a new note is searchable too
                if(cb)cb(true);
              })
              .catch(function(e){ toast((e&&e.message)||'Couldn’t send that note'); if(cb)cb(false); });
          };
          // She's read the chat's replies — clears the tile badge for good.
          it._markSeen=function(){
            if(!it.unread) return;
            it.unread=false; paint();
            api('/api/gallery/assets/note',{method:'POST',
              body:JSON.stringify({chat:name,url:it.url,seen:true})}).catch(function(){});
          };
          hb.onclick=function(e){ e.stopPropagation(); cast('like'); };
          xb.onclick=function(e){ e.stopPropagation(); cast('dislike'); };
          paint();
          cell.appendChild(hb); cell.appendChild(xb); cell.appendChild(nb);
        }
        function addTiles(list){ list.forEach(function(it){
          var cell=document.createElement('div'); cell.className='acell';
          var b=document.createElement('button');
          // What the image IS, when the chat filed one — else the generic "from <chat>"
          var cap=it.description||it.prompt||'';
          var lbl=cap?'<div class="lbl">'+esc(cap)+'</div>':'';
          // Prefer the direct storage thumb (CDN, no server hop); if it isn't
          // generated yet it 404s and we fall back to /api/story/thumb, which
          // makes it on demand. IntersectionObserver sets src from data-src.
          var thumb=it.thumb||assetThumb(it.url), fb=assetThumb(it.url);
          var srcAttr = io ? 'data-src' : 'src';
          b.innerHTML='<img alt="" decoding="async" '+srcAttr+'="'+esc(thumb)+'">'+lbl;
          var img=b.querySelector('img'), triedFb=false;
          // Two-stage error: direct thumb → /api/story/thumb → if BOTH fail the
          // underlying image is gone (deleted / not public), so hide the tile
          // instead of showing a broken "?" box.
          img.onerror=function(){
            if(!triedFb && it.thumb){ triedFb=true; img.src=fb; return; }
            it._broken=true; cell.style.display='none'; if(it._lbPaint) it._lbPaint();
          };
          b.onclick=function(){ lightbox(it.url, it); };
          cell.appendChild(b); voteBtns(cell,it);
          if(io) io.observe(img);
          cells.push({cell:cell, it:it});
          grid.appendChild(cell);
        }); }
        addTiles(a);
        assetsPanel.appendChild(grid);
        // Infinite scroll: a sentinel under the grid pulls the next page when
        // it comes near the viewport, so nothing is ever out of reach — and a
        // chat with 40 images never pays for a request it doesn't need.
        var loaded=a.length, total=(d&&d.total)||a.length, busy=false;
        var more=document.createElement('div'); more.className='state';
        more.style.display='none'; assetsPanel.appendChild(more);
        function nextPage(){
          if(busy || loaded>=total) return;
          busy=true; more.textContent='Loading more…'; more.style.display='';
          api('/api/gallery/assets?chat='+encodeURIComponent(name)+'&limit='+PAGE+'&offset='+loaded)
            .then(function(r){return r.json()})
            .then(function(p){
              var got=(p&&p.assets)||[];
              if(p&&p.total) total=p.total;
              loaded+=got.length;
              addTiles(got);
              applyFilter();          // a new tile obeys the search/filter too
              busy=false;
              more.style.display='none';
              if(!got.length) loaded=total;   // never spin on an empty page
              if(loaded<total) watchTail();
            })
            .catch(function(){ busy=false; more.textContent='Couldn\u2019t load more — scroll to retry.'; });
        }
        var tailIO=null;
        function watchTail(){
          if(loaded>=total) return;
          if(!('IntersectionObserver' in window)){ more.style.display=''; more.textContent='Load more'; more.onclick=nextPage; return; }
          if(tailIO) tailIO.disconnect();
          tailIO=new IntersectionObserver(function(es){
            if(es.some(function(e){return e.isIntersecting;})){ tailIO.disconnect(); nextPage(); }
          },{rootMargin:'800px 0px'});
          var last=grid.lastElementChild;
          if(last) tailIO.observe(last);
        }
        watchTail();
      })
      .catch(function(){ assetsPanel.innerHTML='<div class="state">Couldn\u2019t load images.</div>'; });
  }
  // Compare panel — pages the chat published (comparison sheets, option
  // boards; what used to live as claude.ai artifacts). Lazy-loaded.
  var comparePanel=document.createElement('div'); comparePanel.style.display='none';
  comparePanel.innerHTML='<div class="state">Loading pages&hellip;</div>';
  sec.appendChild(comparePanel);
  var pagesLoaded=false;
  function loadPages(force){
    if(pagesLoaded && !force) return; pagesLoaded=true;
    api('/api/chatfeed/pages?chat='+encodeURIComponent(name)+'&_='+Date.now())
      .then(function(r){return r.json()})
      .then(function(d){
        var ps=(d&&d.pages)||[];
        comparePanel.innerHTML='';
        if(!ps.length){ comparePanel.appendChild(Object.assign(document.createElement('div'),{className:'state',textContent:'No pages from this chat yet.'})); return; }
        ps.forEach(function(p){
          var row=document.createElement('button'); row.className='pagerow';
          row.innerHTML='<span class="pr-title">'+esc(p.title)+'</span><span class="pr-time">'+ago(p.created)+'</span>';
          row.onclick=function(){ openPage(p); };
          comparePanel.appendChild(row);
        });
      })
      .catch(function(){ comparePanel.innerHTML='<div class="state">Couldn\u2019t load pages.</div>'; });
  }
  var tgChat=head.querySelector('.tg-chat'), tgAssets=head.querySelector('.tg-assets'), tgCompare=head.querySelector('.tg-compare');
  var panels={chat:chatPanel, assets:assetsPanel, compare:comparePanel};
  var togs={chat:tgChat, assets:tgAssets, compare:tgCompare};
  function showTab(tab){
    curTab=tab;
    Object.keys(panels).forEach(function(k){
      panels[k].style.display = k===tab ? '' : 'none';
      togs[k].classList.toggle('on', k===tab);
    });
    if(tab==='assets') loadAssets();
    if(tab==='compare') loadPages();
    // The magnifier searches the Chat tab's messages, so it only belongs
    // there — Assets carries its own search bar, Compare has nothing to filter.
    tsBtn.style.display = tab==='chat' ? '' : 'none';
  }
  tgChat.onclick=function(){ showTab('chat'); };
  tgAssets.onclick=function(){ scrollStop(); showTab('assets'); window.scrollTo(0,0); };
  tgCompare.onclick=function(){ scrollStop(); showTab('compare'); window.scrollTo(0,0); };
  // let the global refresh button re-pull this chat's assets/pages fresh
  window._reloadAssets=function(){
    if(assetsPanel.style.display!=='none') loadAssets(true);
    if(comparePanel.style.display!=='none') loadPages(true);
  };
  // A rebuild (e.g. from Refresh) keeps whichever tab was open — restore it
  // instead of snapping back to Chat.
  if(curTab!=='chat') showTab(curTab);

  clearNew();   // the thread just rebuilt from msgs — nothing is waiting
  markSeen(name);
  document.getElementById('home').style.display='none';
  sec.style.display='';
  document.body.classList.add('reading');
  if(!keepScroll && !focusId) window.scrollTo(0,0);
  if(focusId){ showTab('chat'); focusMessage(name, focusId, noFetch); }
}
// Jump to a specific message in the open thread (from a search hit). If it's
// not in the loaded tail, pull the chat's full history once, rebuild, then
// scroll to it. Expands the message and flashes it so it's easy to spot.
function focusMessage(name, id, noFetch){
  var row=document.querySelector('#thread .msg[data-mid="'+String(id).replace(/"/g,'')+'"]');
  if(row){
    row.classList.add('open');
    row.scrollIntoView({block:'center'});
    row.classList.add('flash');
    setTimeout(function(){ row.classList.remove('flash'); }, 2400);
    return;
  }
  if(noFetch){ toast('Couldn\u2019t find that message'); return; }
  toast('Loading full history\u2026');
  api('/api/chatfeed/thread?chat='+encodeURIComponent(name)+'&_='+Date.now())
    .then(function(r){return r.json()})
    .then(function(d){
      if(cur!==name) return;
      var have={}; msgs.forEach(function(m){ have[m.id]=1; });
      (d.messages||[]).forEach(function(m){ if(!have[m.id]){ msgs.push(m); have[m.id]=1; } });
      openChat(name, true, id, true);   // rebuild with full thread; noFetch=true
    })
    .catch(function(){ toast('Couldn\u2019t load history'); });
}
// An autoscroll pill that lives in THIS page and drives a same-origin iframe's
// scroll — because iOS renders position:fixed unreliably INSIDE an iframe, so a
// pill injected into the Compare page itself won't stay put on a phone. Same
// look/behavior as the shared pill (default Fast; tap play/pause; -/+ speed).
function mkPagePill(getWin){
  var SPEEDS=[['Slow',0.5],['Medium',1.0],['Fast',1.9],['Faster',3.2],['Fastest',5.2]];
  var playing=false, raf=null, last=null, si=2, dir=1, acc=0;
  var I={
    up:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
    down:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    play:'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
    pause:'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="4.5" height="16" rx="1"/><rect x="14.5" y="4" width="4.5" height="16" rx="1"/></svg>',
    plus:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    minus:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 12h14"/></svg>'
  };
  var pill=document.createElement('div'); pill.className='float';
  pill.innerHTML='<div class="vseg"><button class="ppt"></button><button class="ppm"></button><button class="ppb"></button></div><span class="pps"></span>';
  var vt=pill.querySelector('.ppt'), vm=pill.querySelector('.ppm'), vb=pill.querySelector('.ppb'), sp=pill.querySelector('.pps');
  function paint(){
    if(playing){ vt.innerHTML=I.minus; vb.innerHTML=I.plus; vm.innerHTML=I.pause; vm.classList.add('on');
      vt.classList.toggle('dim',si===0); vb.classList.toggle('dim',si===SPEEDS.length-1);
    } else { vt.innerHTML=I.up; vb.innerHTML=I.down; vm.innerHTML=I.play; vm.classList.remove('on'); vt.classList.remove('dim'); vb.classList.remove('dim'); }
    sp.textContent=SPEEDS[si][0];
  }
  function step(ts){
    if(!playing) return;
    var w=getWin();
    if(w && last!=null){
      acc+=dir*(ts-last)/1000*42*SPEEDS[si][1];
      var move=acc>0?Math.floor(acc):Math.ceil(acc);
      if(move){ try{ w.scrollBy(0,move); }catch(_){} acc-=move; }
      try{ var d=w.document.documentElement, atEnd=dir>0?(w.innerHeight+w.scrollY>=d.scrollHeight-4):(w.scrollY<=2); if(atEnd) stop(); }catch(_){}
    }
    last=ts; raf=requestAnimationFrame(step);
  }
  // Same end-of-page rule as the shared pill: a direction with no room flips
  // to the one that has room, so a press is never a dead press.
  function canGo(d){ var w=getWin(); if(!w) return true;
    try{ return d>0 ? (w.innerHeight+w.scrollY < w.document.documentElement.scrollHeight-4) : (w.scrollY>2); }catch(_){ return true; } }
  function start(d){ if(!canGo(d) && canGo(-d)) d=-d;
    dir=d; playing=true; last=null; acc=0; paint(); raf=requestAnimationFrame(step); }
  function stop(){ playing=false; if(raf) cancelAnimationFrame(raf); raf=null; paint(); }
  vt.onclick=function(){ if(playing){ si=Math.max(0,si-1); paint(); } else start(-1); };
  vb.onclick=function(){ if(playing){ si=Math.min(SPEEDS.length-1,si+1); paint(); } else start(1); };
  vm.onclick=function(){ playing? stop() : start(1); };
  paint(); pill._stop=stop;
  pill._tap=function(){ playing? stop() : start(1); };   // tap the page to toggle
  return pill;
}
// Full-screen viewer for a Compare page: top bar (back + title) over an
// iframe, with a pill (above) that scrolls the iframe. Freezes the page
// behind it, like the lightbox (design rule). embed=1 tells the server not to
// inject its own in-page pill (this parent pill drives it instead).
function openPage(p){
  scrollStop();
  var v=document.createElement('div'); v.className='pageview';
  var bar=document.createElement('div'); bar.className='pv-bar';
  bar.innerHTML='<button class="pv-back" aria-label="Back">&#8249;</button><span class="pv-title">'+esc(p.title)+'</span>';
  var frame=document.createElement('iframe'); frame.className='pv-frame';
  frame.src='/api/chatfeed/page/'+encodeURIComponent(p.id)+'?embed=1'+(TOKEN?'&token='+encodeURIComponent(TOKEN):'');
  v.appendChild(bar); v.appendChild(frame);
  var pill=mkPagePill(function(){ try{ return frame.contentWindow; }catch(_){ return null; } });
  v.appendChild(pill);
  // Tap the page itself to start/stop autoscroll (same-origin iframe, so we can
  // listen on its document). A tap on anything INTERACTIVE — a <details>/
  // <summary> toggle, link, button, form field, media control — is the page's
  // own, so we ignore it entirely (same skip list as the injected pill).
  frame.addEventListener('load', function(){
    try{
      var doc=frame.contentDocument;
      if(doc) doc.addEventListener('click', function(e){
        var t=e.target;
        if(t && t.closest && t.closest('a,button,summary,details,input,textarea,select,label,video,audio,[onclick]')) return;
        pill._tap();
      });
    }catch(_){}
  });
  bar.querySelector('.pv-back').onclick=function(){ if(pill._stop) pill._stop(); v.remove();
    document.body.style.overflow=''; document.body.classList.remove('ontop'); };
  document.body.appendChild(v);
  document.body.style.overflow='hidden'; document.body.classList.add('ontop');
}
// How a chat files the prompt behind an image, shown folded-away at the top of
// every Assets tab — so the instructions live where the images do and can be
// handed to any chat that isn't doing it yet. Kept in sync with the CLAUDE.md
// section "Prompts on Assets images".

// Ask before something you can't undo with one tap. Locks the page behind it
// like the lightbox does, and hands back true/false.
function askFirst(question, okLabel, cb){
  scrollStop();
  var wrap=document.createElement('div'); wrap.className='askwrap';
  var box=document.createElement('div'); box.className='askbox';
  var q=document.createElement('p'); q.textContent=question;
  var row=document.createElement('div'); row.className='askrow';
  var no=document.createElement('button'); no.textContent='Cancel';
  var yes=document.createElement('button'); yes.className='go'; yes.textContent=okLabel;
  function close(v){
    wrap.remove(); document.body.style.overflow='';
    cb(v);
  }
  no.onclick=function(e){ e.stopPropagation(); close(false); };
  yes.onclick=function(e){ e.stopPropagation(); close(true); };
  wrap.onclick=function(e){ if(e.target===wrap) close(false); };   // tap outside = no
  box.onclick=function(e){ e.stopPropagation(); };
  row.appendChild(no); row.appendChild(yes);
  box.appendChild(q); box.appendChild(row); wrap.appendChild(box);
  document.body.appendChild(wrap); document.body.style.overflow='hidden';
}

// Image lightbox — freezes the page behind it (design rule)
function lightbox(url, asset){
  scrollStop();
  var lb=document.getElementById('clightbox');
  lb.innerHTML='<div class="clwrap"><img alt="" src="'+url.replace(/"/g,'&quot;')+'"></div>';
  lb.classList.remove('hastalk');   // last image's thread must not shrink this one
  // The generating prompt, over the image: Style left, Content right, tap the
  // PROMPT button to cover/uncover the picture. Only offered when a chat
  // actually filed a split — nothing is shown (and nothing is said) when it
  // didn't. Built before .lbtop so the button can join that row.
  var promptBtn=null;
  if(asset && (asset.promptStyle||asset.promptContent)){
    var wrap=lb.querySelector('.clwrap');
    var ov=document.createElement('div'); ov.className='lbp'; ov.style.display='none';
    ov.onclick=function(e){ e.stopPropagation(); };   // reading it must not close the lightbox
    var tog=document.createElement('div'); tog.className='lbptog';
    var sb=document.createElement('button'); sb.textContent='Style';
    var cb=document.createElement('button'); cb.textContent='Content';
    var txt=document.createElement('div'); txt.className='lbptext';
    // Start on whichever side was filed; Style wins when both are.
    var side=asset.promptStyle?'style':'content';
    function paintSide(){
      sb.classList.toggle('on', side==='style');
      cb.classList.toggle('on', side==='content');
      txt.textContent=(side==='style'?asset.promptStyle:asset.promptContent)||'';
      txt.scrollTop=0;
    }
    sb.onclick=function(e){ e.stopPropagation(); side='style'; paintSide(); };
    cb.onclick=function(e){ e.stopPropagation(); side='content'; paintSide(); };
    tog.appendChild(sb); tog.appendChild(cb);
    ov.appendChild(tog); ov.appendChild(txt);
    paintSide();
    wrap.appendChild(ov);
    promptBtn=document.createElement('button');
    promptBtn.className='promptbtn'; promptBtn.textContent='Prompt';
    promptBtn.onclick=function(e){
      e.stopPropagation();
      var open=ov.style.display==='none';
      ov.style.display=open?'flex':'none';
      wrap.classList.toggle('pon', open);
      promptBtn.classList.toggle('on', open);
    };
  }
  // ♥/✕ overlaid on the image (left / right); the note box sits UNDER the image.
  if(asset && asset._cast){
    var row=document.createElement('div'); row.className='lbtop';
    row.onclick=function(e){ e.stopPropagation(); };
    var hb=document.createElement('button'); hb.className='vote heart'; hb.innerHTML=window.__HEART;
    var xb=document.createElement('button'); xb.className='vote nope'; xb.innerHTML=window.__XMARK;
    // The thread: her notes and the chat's replies back, oldest at the top.
    // Snail mail — the chat that made the image answers next time she messages
    // it, so a reply landing here later is normal and expected.
    var talk=document.createElement('div'); talk.className='lbtalk';
    talk.onclick=function(e){ e.stopPropagation(); };
    var th=document.createElement('div'); th.className='lbthread';
    function paintThread(){
      th.innerHTML='';
      var msgs=asset.thread||[];
      msgs.forEach(function(m){
        var b=document.createElement('div');
        b.className='lbmsg '+(m.from==='chat'?'them':'me');
        b.textContent=m.text;
        th.appendChild(b);
      });
      th.style.display=msgs.length?'':'none';
      th.scrollTop=th.scrollHeight;   // newest letter in view
    }
    var nw=document.createElement('div'); nw.className='lbnote';
    var ni=document.createElement('input'); ni.placeholder='Write a note…';
    var ns=document.createElement('button'); ns.className='notesend';
    // Lucide "send" — the paper aeroplane (lucide-static 1.27.0)
    ns.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>';
    function sendNote(){
      var t=(ni.value||'').trim();
      if(!t) return;
      // It leaves the box the moment it's sent and joins the thread underneath,
      // so the box is always empty and ready for the next one.
      ni.value='';
      asset.thread=(asset.thread||[]).concat([{from:'sophie',text:t,at:new Date().toISOString()}]);
      paintThread();
      var el=th.lastChild;
      el.classList.add('pending');
      function attempt(){
        el.classList.remove('failed'); el.classList.add('pending');
        asset._noteSend(t, function(ok){
          el.classList.remove('pending');
          if(ok) return;
          // Nothing is lost on a failure — the letter stays on screen, outlined,
          // and tapping it tries again.
          el.classList.add('failed');
          el.title='Not sent — tap to try again';
          el.onclick=function(e){ e.stopPropagation(); attempt(); };
        });
      }
      attempt();
    }
    ns.onclick=function(e){ e.stopPropagation(); sendNote(); };
    ni.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); sendNote(); } };
    nw.appendChild(ni); nw.appendChild(ns);
    talk.appendChild(th); talk.appendChild(nw);
    paintThread();
    if(asset._markSeen) asset._markSeen();   // opening it counts as reading it
    asset._lbPaint=function(){
      hb.classList.toggle('on', asset.vote==='like');
      xb.classList.toggle('on', asset.vote==='dislike');
    };
    asset._lbPaint();
    hb.onclick=function(e){ e.stopPropagation(); asset._cast('like'); };
    xb.onclick=function(e){ e.stopPropagation(); asset._cast('dislike'); };
    // ♥ left, Prompt in the middle, ✕ right (the row is space-between)
    row.appendChild(hb); if(promptBtn) row.appendChild(promptBtn); row.appendChild(xb);
    var frame=lb.querySelector('.clframe');
    (frame||lb).appendChild(row);
    lb.appendChild(talk);   // thread + note box below the image, never over it
    lb.classList.add('hastalk');   // shrinks the picture so the thread has room
  }
  if(promptBtn && !promptBtn.parentNode){   // image opened without the curate row
    var prow=document.createElement('div'); prow.className='lbtop';
    prow.style.justifyContent='center';
    prow.onclick=function(e){ e.stopPropagation(); };
    prow.appendChild(promptBtn); lb.appendChild(prow);
  }
  var cap=asset?(asset.description||asset.prompt||''):'';
  if(cap){ var cc=document.createElement('div'); cc.className='clcap'; cc.textContent=cap; lb.appendChild(cc); }
  lb.style.display='flex'; document.body.style.overflow='hidden'; document.body.classList.add('ontop');
  lb.onclick=function(){ if(asset) asset._lbPaint=null; lb.style.display='none'; lb.innerHTML='';
    lb.classList.remove('hastalk'); document.body.style.overflow=''; document.body.classList.remove('ontop'); };
}
function goHome(){
  scrollStop(); cur=null; curTab='chat';
  document.getElementById('thread').style.display='none';
  document.getElementById('home').style.display='';
  document.body.classList.remove('reading');
  renderHome();
  if(window._resetSearch) window._resetSearch();
  window.scrollTo(0,homeY||0);   // back to where you were, not the top
}
document.getElementById('back').onclick=goHome;

// Search across every chat. Debounced; hits the server's in-memory index and
// shows matching messages (chat + snippet, match highlighted); tap opens the
// chat. Empty/short query falls back to the normal grid.
(function(){
  var qi=document.getElementById('qsearch'), qc=document.getElementById('qclear'),
      sr=document.getElementById('searchresults'), grid=document.getElementById('grid'), t=null;
  function showGrid(){ sr.style.display='none'; sr.innerHTML=''; grid.style.display=''; }
  window._resetSearch=function(){ if(qi){ qi.value=''; } qc.style.display='none'; showGrid(); };
  function hl(snip,q){
    var e=esc(snip||'');
    try{ var rx=new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'); return e.replace(rx,'<b>$1</b>'); }
    catch(_){ return e; }
  }
  function run(q){
    q=(q||'').trim(); qc.style.display=q?'':'none';
    if(q.length<2){ showGrid(); return; }
    api('/api/chatfeed/search?q='+encodeURIComponent(q)+'&_='+Date.now())
      .then(function(r){return r.json()})
      .then(function(d){
        if(qi.value.trim()!==q) return;   // a newer keystroke already fired
        var rs=(d&&d.results)||[];
        var cm=(d&&d.chatMatches)||[];
        grid.style.display='none'; sr.style.display=''; sr.innerHTML='';
        if(!rs.length&&!cm.length){ sr.innerHTML='<div class="state">No matches.</div>'; return; }
        // Chats whose NAME matches come first (Sophie's rule, Aug 2026):
        // searching a chat's name should find the chat itself at the top,
        // above any message-content hits. Tapping one opens the chat.
        cm.forEach(function(c){
          var b=document.createElement('button'); b.className='sres schat';
          b.innerHTML='<div class="sr-top"><span class="sr-chat">'+hl(c.name,q)+'</span><span class="sr-time">chat</span></div>';
          b.onclick=function(){ if(window._resetSearch) window._resetSearch(); openChat(c.chat); };
          sr.appendChild(b);
        });
        rs.forEach(function(m){
          var b=document.createElement('button'); b.className='sres';
          b.innerHTML='<div class="sr-top"><span class="sr-chat">'+esc(dispName(m.chat))+'</span><span class="sr-time">'+ago(m.created)+'</span></div>'
            +'<div class="sr-snip">'+hl(m.snippet,q)+'</div>';
          b.onclick=function(){ if(window._resetSearch) window._resetSearch(); openChat(m.chat, false, m.id); };
          sr.appendChild(b);
        });
      })
      .catch(function(){ grid.style.display='none'; sr.style.display=''; sr.innerHTML='<div class="state">Search unavailable.</div>'; });
  }
  qi.addEventListener('input', function(){ clearTimeout(t); var v=qi.value; t=setTimeout(function(){ run(v); }, 220); });
  qc.onclick=function(){ window._resetSearch(); qi.focus(); };
})();

// Floating audio bar: while a message's audio is in play, a tappable bar pins
// to the top. It STAYS as a play/pause toggle even when paused or finished —
// only a NEW audio (it switches to that) or the round ending removes it. The
// round ends when you leave the Chats screen (native calls __npEnd) or the app
// backgrounds/closes (visibilitychange / pagehide). Delegated with capture so
// it catches audio added later (Play → neural voice).
(function(){
  var npBar=document.getElementById('nowplaying'), npIc=document.getElementById('npic'),
      npTxt=document.getElementById('nptxt'), npAudio=null;
  var PAUSE='<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="4.5" height="16" rx="1"/><rect x="14.5" y="4" width="4.5" height="16" rx="1"/></svg>';
  var PLAY='<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
  function paint(){
    if(!npAudio){ npBar.classList.remove('show'); return; }
    var playing=!npAudio.paused && !npAudio.ended;
    npIc.innerHTML=playing?PAUSE:PLAY; npTxt.textContent=playing?'Playing':'Paused';
    npBar.classList.add('show');
  }
  document.addEventListener('play', function(e){
    if(e.target && e.target.tagName==='AUDIO'){ npAudio=e.target; paint(); }
  }, true);
  // Pause/end keep the bar — it becomes a resume control.
  document.addEventListener('pause', function(e){ if(e.target===npAudio) paint(); }, true);
  document.addEventListener('ended', function(e){ if(e.target===npAudio) paint(); }, true);
  npBar.onclick=function(){ if(!npAudio) return; (npAudio.paused||npAudio.ended) ? npAudio.play() : npAudio.pause(); };
  // End the round: stop the audio and dismiss the bar.
  function end(){ if(npAudio){ try{ npAudio.pause(); }catch(e){} } npAudio=null; npBar.classList.remove('show'); }
  window.__npEnd=end;   // native calls this when you leave the Chats screen
  document.addEventListener('visibilitychange', function(){ if(document.hidden) end(); });
  window.addEventListener('pagehide', end);
})();

// Floating jump-to-top arrow: appears once you've scrolled down; stops any
// autoscroll and glides back to the top.
(function(){
  var toTop=document.getElementById('totop');
  toTop.onclick=function(){ if(window.__scrollStop) window.__scrollStop(); window.scrollTo({top:0,behavior:'smooth'}); };
  function upd(){ toTop.classList.toggle('show', window.scrollY>400); }
  window.addEventListener('scroll', upd, {passive:true});
  upd();
})();
document.getElementById('v-list').onclick=function(){ view='list'; try{localStorage.setItem('chats-view','list');}catch(e){} renderHome(); };
document.getElementById('v-tiles').onclick=function(){ view='tiles'; try{localStorage.setItem('chats-view','tiles');}catch(e){} renderHome(); };
document.getElementById('refresh').onclick=function(){ toast('Refreshing\u2026'); load(); };
document.getElementById('archlink').onclick=function(){ setHomeView('archive'); };
document.getElementById('bmklink').onclick=function(){ setHomeView('bookmarks'); };

// Which Claude account is signed into the iOS app right now (the other one is
// on the web) \u2014 a plain on/off switch in the header: off = account 1, on =
// account 2. Flip it after swapping sign-ins; every Open button re-routes off
// it immediately, and the toast names the account so the switch needs no label.
var acctog=document.getElementById('acctog');
function paintAcct(){
  var on=appAccount()==='2';
  acctog.classList.toggle('on', on);
  acctog.setAttribute('aria-pressed', on?'true':'false');
}
acctog.onclick=function(){
  var prev=appAccount(), next=prev==='1'?'2':'1';
  settings=settings||{}; settings.appAccount=next; paintAcct(); saveCache();
  api('/api/chatfeed/app-account',{method:'POST',body:JSON.stringify({account:next})})
    .then(function(r){return r.json()})
    .then(function(d){ if(!d.ok) throw 0; toast('The app is account '+next+' now'); })
    .catch(function(){ settings.appAccount=prev; paintAcct(); saveCache(); toast('Couldn\u2019t save that'); });
};
paintAcct();

// ---- Launch cache ---------------------------------------------------------
// Every app-open used to start from nothing and pull the full feed — a
// 1500-document read server-side just to re-fetch messages the phone had
// already seen. Instead the feed is remembered in localStorage between
// launches: render instantly from the saved copy, then ask only "what's new
// since my newest?" (normally zero reads). The Refresh button still does a
// true full load, which repairs the cache if it ever drifts.
var CACHE_KEY='chats-cache-v1';
function saveCache(){
  try{
    // Keep only a per-chat tail (same shape a fresh full load returns), so the
    // cache stays small no matter how many full threads were pulled this
    // visit. Chats whose extra messages we drop are re-marked truncated so
    // opening them pulls the thread again next launch.
    var byChat={}, dropped={};
    msgs.slice().sort(function(a,b){ return (a.created||'')<(b.created||'')?1:-1; })
      .forEach(function(m){
        var c=m.chat||''; var arr=(byChat[c]=byChat[c]||[]);
        if(arr.length<10) arr.push(m); else dropped[c]=1;
      });
    var keep=[]; Object.keys(byChat).forEach(function(c){ keep=keep.concat(byChat[c]); });
    var trunc={}; Object.keys(truncated).forEach(function(c){ trunc[c]=1; });
    Object.keys(dropped).forEach(function(c){ trunc[c]=1; });
    localStorage.setItem(CACHE_KEY, JSON.stringify({chats:chats, settings:settings, msgs:keep, truncated:Object.keys(trunc)}));
  }catch(e){}   // full storage / private mode: the cache is only an optimization
}
function loadCache(){
  try{
    var d=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
    if(!d || !d.msgs || !d.msgs.length) return false;
    chats=d.chats||{}; msgs=d.msgs; settings=d.settings||{}; paintAcct();
    truncated={}; fullLoaded={};
    (d.truncated||[]).forEach(function(c){ truncated[c]=1; });
    renderHome();
    return true;
  }catch(e){ return false; }
}

// The app keeps a page loaded for days, so polling refreshes the DATA while the
// CODE stays whatever it was at load — a shipped change then silently never
// reaches her phone (a whole afternoon of UI changes sat unreachable this way,
// and the feature she was testing "didn't work" because its code wasn't there).
// Every feed response carries a stamp of the page file: keep the first one seen
// — that IS the build running — and reload when it changes. Only from the home
// screen, never mid-thread or while she's typing, so a reload can't eat words
// or lose her place.
var BUILD=null;
function checkBuild(data){
  if(!data||!data.build) return;
  if(!BUILD){ BUILD=data.build; return; }
  if(BUILD===data.build) return;
  var a=document.activeElement, typing=a&&/^(INPUT|TEXTAREA)$/.test(a.tagName||'');
  if(cur||typing) return;             // it can wait until she's back on the list
  location.reload();
}
function load(){
  // cache-bust: the webview heuristically cached the bare URL, which made the
  // Refresh button look dead (new messages only appeared minutes later)
  api('/api/chatfeed?_='+Date.now()).then(function(r){return r.json()}).then(function(data){
    checkBuild(data);
    chats=data.chats||{}; msgs=data.messages||[];
    settings=data.settings||{}; paintAcct();
    // A reload replaces msgs with the trimmed tail, so anything we'd expanded
    // is gone — clear fullLoaded and let openChat pull the thread again.
    truncated={}; fullLoaded={};
    (data.truncated||[]).forEach(function(c){ truncated[c]=1; });
    saveCache();
    if(cur){ var y=window.scrollY; openChat(cur,true); window.scrollTo(0,y); } else renderHome();
  }).catch(function(){
    if(!cur && !msgs.length) document.getElementById('grid').innerHTML='<div class="state">Couldn\u2019t reach the feed.</div>';
  });
}

// ---- Delta polling --------------------------------------------------------
// A full load() re-reads the newest 1500 messages server-side EVERY time. Doing
// that once a minute with the page open burned through the free Firestore read
// quota in about half an hour and cost real money for, usually, nothing new.
// So the timer asks a much cheaper question instead — "anything after the
// newest message I already have?" — which normally reads ZERO documents.
// Because it's nearly free we can poll often, AND poll while a chat is open,
// which is exactly when she's waiting for a reply to land.
function newestCreated(){
  var max='';
  for(var i=0;i<msgs.length;i++){ var c=msgs[i].created||''; if(c>max) max=c; }
  return max;
}
// The buffer behind the "New message" bar. A polled message is merged into msgs
// and cached immediately, but NOTHING re-renders until she taps the bar — that's
// what keeps her place (and anything she'd expanded). Any full rebuild
// (renderHome / openChat) clears the count, because that render shows them all.
var pendingNew=0;
function paintNew(){
  var b=document.getElementById('newbar');
  b.classList.toggle('show', pendingNew>0);
  document.getElementById('newtxt').textContent = pendingNew>1 ? pendingNew+' new messages' : 'New message';
}
function clearNew(){ if(pendingNew){ pendingNew=0; paintNew(); } }
document.getElementById('newbar').onclick=function(){
  scrollStop();
  // She asked for the new one, so land on it: the newest is at the top, and in
  // a thread that means the Chat tab even if she was looking at Assets.
  if(cur){ curTab='chat'; openChat(cur,false,null,true); }
  else { renderHome(); window.scrollTo(0,0); }
};
// Re-render one message row in the open thread after its doc changed (a live
// draft grew, or finished and gained its Play button). A full node swap keeps
// renderMsg the single source of message markup; the open/closed state is the
// only thing carried over. Rows outside the open thread just wait for the next
// natural render.
function refreshDraft(m){
  var row=document.querySelector('#thread .msg[data-mid="'+String(m.id).replace(/"/g,'')+'"]');
  if(!row) return;
  var nr=renderMsg(m);
  if(row.classList.contains('open')) nr.classList.add('open');
  row.parentNode.replaceChild(nr,row);
}
function poll(){
  var since=newestCreated();
  if(!since) return load();   // nothing yet (empty/failed first paint)
  api('/api/chatfeed?since='+encodeURIComponent(since)+'&_='+Date.now())
    .then(function(r){return r.json()})
    .then(function(data){
      checkBuild(data);
      if(data.chats) chats=data.chats;
      if(data.settings){ settings=data.settings; paintAcct(); }
      var incoming=data.messages||[];
      if(!incoming.length) return;              // the common case: nothing to do
      // The delta is capped at 200 server-side. Hitting the cap means the
      // cache is so far behind (a long-untouched install) that messages fell
      // off the far end — a merge would leave holes, so start over clean.
      if(incoming.length>=200) return load();
      var have={}; msgs.forEach(function(m,i){ have[m.id]=i+1; });
      var added=0, mine=0, grew=0;
      incoming.forEach(function(m){
        var at=have[m.id];
        if(at){
          // A message we already hold, re-delivered: normally identical (the
          // postedAt delta query re-serves recent docs — skip), but a LIVE
          // DRAFT grows in place server-side, so changed text/tldr/working
          // means the draft got longer or finished. Swap the copy and refresh
          // its row quietly — it already pinged once when it first appeared,
          // so growth never counts as a new message.
          var old=msgs[at-1];
          if((old.text||'')!==(m.text||'')||(old.tldr||'')!==(m.tldr||'')||!!old.working!==!!m.working){
            msgs[at-1]=m; grew++;
            if(cur && m.chat===cur) refreshDraft(m);
          }
          return;
        }
        msgs.push(m); have[m.id]=msgs.length; added++;    // groups() re-sorts by created
        if(cur && m.chat===cur) mine++;
      });
      if(!added){
        if(!grew) return;                       // never re-render for nothing
        saveCache();
        // a draft changed but nothing new arrived: thread rows swapped above;
        // the home grid repaints only when she's at the top with no place to
        // lose — scrolled down, the working tint still updates in place
        if(!cur){ if(window.scrollY<8) renderHome(); else paintLive(); }
        return;
      }
      saveCache();
      // Sitting at the very top of the feed there's no place to lose and nothing
      // expanded, so just show them — that's also the app-just-opened case.
      if(!cur && window.scrollY<8){ renderHome(); return; }
      // Otherwise buffer and raise the bar. In a thread only THIS chat's
      // messages count: a reply landing in some other chat must not move the
      // page under her, and the home screen picks those up when she goes back.
      if(!cur) paintLive();   // buffered below, but the working tint is not news to hold back
      var n = cur ? mine : added;
      if(!n) return;
      pendingNew+=n; paintNew();
    })
    .catch(function(){});   // a failed poll is not worth surfacing; next one retries
}
// Launch: paint from the saved copy and fetch only the delta — the full
// 1500-doc load now happens only on a first-ever visit or a Refresh tap.
if(loadCache()) poll(); else load();
setInterval(function(){
  // Don't poll a page nobody is looking at — a backgrounded webview would
  // otherwise keep paying for reads all day.
  if(document.hidden) return;
  poll();
}, 20000);
// Coming back to the app should feel instant rather than waiting out the timer.
document.addEventListener('visibilitychange', function(){ if(!document.hidden) poll(); });
})();
</script>
"""

page = page.replace('__FONT__', font)
page = page.replace('__PILL_CSS__', PILL_CSS).replace('__PILL_HTML__', PILL_HTML).replace('__PILL_JS__', PILL_JS)
out = os.path.join(ROOT, 'public', 'chats.html')
open(out, 'w', encoding='utf-8').write(page)
print('built public/chats.html', round(len(page) / 1024), 'KB')
