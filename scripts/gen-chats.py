#!/usr/bin/env python3
# The Chat app — public/chats.html, served gated at /chats.
# Home is a grid of chat tiles (picture icon, name, last activity); tapping a
# tile opens that chat's thread — its replies oldest-to-newest, each with a
# one-tap "polish" render in the neural onyx-British voice (cached; the free
# device voice was retired — Sophie found it robotic) — with the reply bar
# pre-targeted to that chat (replies are picked up on chats' hourly checks).
import base64, os
from pill import PILL_CSS, PILL_HTML, PILL_JS

ROOT = os.path.join(os.path.dirname(__file__), '..')
font = base64.b64encode(open(os.path.join(ROOT, 'ios', 'ImageForge', 'EBGaramond.ttf'), 'rb').read()).decode()

page = """<!doctype html>
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
.t-new{position:absolute; top:6px; right:6px; width:10px; height:10px; border-radius:50%; background:var(--rose);}
.t-name{font-size:1.12em; font-weight:600; line-height:1.15; margin-top:7px; overflow-wrap:break-word;}
.t-about{font-family:'EBGaramond',Georgia,serif; font-style:italic; font-size:.92em; color:var(--ink2); line-height:1.2; margin-top:2px;}
.t-tldr{font-family:'EBGaramond',Georgia,serif; font-size:.92em; color:var(--ink); line-height:1.28; margin-top:4px;
  display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;}
.t-meta{font-family:-apple-system,sans-serif; font-size:9px; letter-spacing:.14em; color:var(--ink2); text-transform:uppercase; margin-top:4px;}
.abouted{display:block; width:100%; margin:2px 0 0; font-family:'EBGaramond',Georgia,serif; font-size:16px; box-sizing:border-box;
  border:1px solid var(--line); border-radius:6px; background:var(--barbg); color:var(--ink); padding:7px 9px;}
.thread-head{display:flex; align-items:center; gap:10px; margin-bottom:.5em;}
.thread-head img,.thread-head .t-blank{width:38px; height:38px; border-radius:4px; border:1px solid var(--line); object-fit:cover; flex:none;}
.thread-head .t-blank{display:flex; font-size:1.1em;}
.thread-head h1{font-size:1.5em; margin:0; flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.renamebtn{flex:none; background:none; border:none; padding:4px; margin:0; color:var(--ink2); cursor:pointer; line-height:0; -webkit-tap-highlight-color:transparent;}
.renamebtn:active{color:var(--ink);}
.nameed{flex:1; min-width:0; font-family:inherit; font-size:1.5em; font-weight:700; color:var(--ink); background:var(--barbg); border:1px solid var(--line); border-radius:6px; padding:2px 6px; box-sizing:border-box;}
.assetgrid{display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:.4em 0 2em;}
.assetgrid button{position:relative; margin:0; padding:0; border:none; background:none; cursor:pointer;}
.assetgrid img{width:100%; aspect-ratio:1; object-fit:cover; border-radius:6px; border:1px solid var(--line); display:block; background:var(--barbg);}
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
.lbnote{display:flex; gap:6px; width:min(92vw,360px); margin-top:12px;}
.lbnote input{flex:1; min-width:0; border:none; border-radius:6px; background:rgba(250,247,240,.92); color:#26221c;
  font-family:'EBGaramond',Georgia,serif; font-size:15px; padding:8px 10px; box-shadow:0 1px 4px rgba(0,0,0,.2);}
.lbnote .notesend{width:38px; height:38px; border-radius:50%; border:none; background:rgba(250,247,240,.92); color:#5d7a5a;
  display:flex; align-items:center; justify-content:center; cursor:pointer; flex:none; box-shadow:0 1px 4px rgba(0,0,0,.2); padding:0;}
.lbnote .notesend svg{width:18px; height:18px; display:block;}
.lbnote .notesend.saved{background:#5d7a5a; color:#fff;}
#clightbox{position:fixed; inset:0; background:rgba(15,13,10,.93); z-index:30; display:none; align-items:center; justify-content:center; padding:18px;}
#clightbox img{max-width:100%; max-height:92vh; border-radius:6px;}
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
.m-preview{font-size:16.5px; line-height:1.5; cursor:pointer;}
.m-full{display:none; font-size:16.5px; line-height:1.6; white-space:pre-wrap;}
.m-full pre{white-space:pre-wrap; overflow-wrap:anywhere; background:var(--barbg); border:1px solid var(--line); border-radius:6px; padding:8px 10px; font-size:12.5px; line-height:1.45;}
.m-full code{background:var(--barbg); border:1px solid var(--line); border-radius:4px; padding:0 4px; font-size:14px;}
/* The folded technical middle of a message — collapsed to a tap. */
.fold{margin:8px 0;}
.foldtog{display:inline-flex; align-items:center; gap:6px; background:var(--barbg); border:1px solid var(--line); color:var(--ink2); font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.1em; text-transform:uppercase; border-radius:6px; padding:6px 11px; cursor:pointer; -webkit-tap-highlight-color:transparent;}
.foldtog.open{color:var(--ink);}
.foldbody{margin-top:8px;}
.msg.open .m-head{cursor:pointer;}
.m-close{display:none; font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink2); margin-left:auto;}
.msg.open .m-close{display:inline;}
.archrow{margin-top:2.2em; text-align:center;}
.archrow button{background:none; border:none; color:var(--ink2); opacity:.7; font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.12em; text-transform:uppercase; cursor:pointer; padding:6px;}
.archtoggle{display:block; width:100%; text-align:left; background:none; border:none; border-top:1px solid var(--line); margin-top:1.6em; padding:14px 2px; color:var(--ink2); font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.14em; text-transform:uppercase; cursor:pointer;}
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
   sits under the floating autoscroll pill in the top-right corner. */
.refreshbtn{display:inline-flex; align-items:center; gap:6px; padding:7px 12px;}
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
.cr-name{font-size:1.15em; font-weight:600; line-height:1.12;}
.cr-sub{font-size:.95em; color:var(--ink2); line-height:1.25; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.cr-time{font-family:-apple-system,sans-serif; font-size:9px; letter-spacing:.12em; color:var(--ink2); text-transform:uppercase; flex:none;}
.cr-dot{width:9px; height:9px; border-radius:50%; background:var(--rose); flex:none;}
/* "Answered" check — mark a chat done; it grays until a newer message arrives */
.ckbtn{border:none; cursor:pointer; padding:0; display:flex; align-items:center; justify-content:center; -webkit-tap-highlight-color:transparent; border-radius:50%; background:rgba(250,247,240,.92); color:var(--ink2); box-shadow:0 1px 4px rgba(0,0,0,.18);}
.ckbtn svg{width:14px; height:14px; display:block;}
.ckbtn.on{background:#5d7a5a; color:#fff;}
.t-cover .ckbtn{position:absolute; top:5px; left:5px; width:26px; height:26px; z-index:2;}
.crow .ckbtn{width:31px; height:31px; flex:none; margin-left:2px;}
.tile.done .t-cover img, .tile.done .t-name, .tile.done .t-about, .tile.done .t-tldr, .tile.done .t-meta{opacity:.38;}
.tile.done .t-cover.t-blank span{opacity:.38;}
.crow.done .cr-ic, .crow.done .cr-body, .crow.done .cr-time{opacity:.38;}
/* Open-in-Claude button — Claude orange, white starburst + text */
.openclaude{display:inline-flex; align-items:center; gap:6px; background:#d97757; color:#fff; border:none; border-radius:6px;
  font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.04em; padding:8px 14px; cursor:pointer; text-decoration:none;}
.openclaude svg{width:15px; height:15px; display:block; stroke:#fff;}
.headbtns{display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:2px 0 0;}
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
/* Floating jump-to-top arrow — appears once you've scrolled down. */
.totop{position:fixed; right:max(14px,4vw); bottom:max(20px, env(safe-area-inset-bottom)); z-index:9; width:44px; height:44px; border-radius:6px; border:1px solid var(--line); background:var(--barbg); color:var(--ink2); cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,.09); display:none; align-items:center; justify-content:center; -webkit-tap-highlight-color:transparent; transform:translateZ(0);}
.totop.show{display:flex;}
.arow{display:flex; align-items:center; gap:10px; margin:0 0 10px;}
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
</style>
__PILL_HTML__
<div class="backwrap"><button id="back" aria-label="Back to all chats">&#8249;</button></div>
<div id="nowplaying" class="nowplaying" role="button" aria-label="Play or pause audio"><span id="npic"></span><span id="nptxt">Playing</span></div>
<button id="totop" class="totop" aria-label="Back to top"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg></button>
<div class="wrap">
  <section id="home">
    <header>
      <div class="no">deck factory &middot; every chat, one place</div>
      <h1>Chats</h1>
      <div class="rule"></div>
    </header>
    <div style="display:flex; align-items:center; gap:10px; margin:0 0 1em;">
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
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
// Light markdown for the full message view: escape FIRST (safe), then style.
// Bold/italics/inline code render for real; fenced code becomes a quiet <pre>;
// heading marks become bold lines. Everything else stays plain text.
function md(t){
  var s=esc(t);
  s=s.replace(/```[a-z]*\\n?([\\s\\S]*?)```/g, function(_,c){ return '<pre>'+c.replace(/\\s+$/,'')+'</pre>'; });
  s=s.replace(/\\*\\*([^*\\n][^*]*?)\\*\\*/g,'<b>$1</b>');
  s=s.replace(/(^|[\\s(“"'>])\\*([^*\\n]+)\\*/g,'$1<i>$2</i>');
  s=s.replace(/`([^`\\n]+)`/g,'<code>$1</code>');
  s=s.replace(/^#{1,4}\\s+(.+)$/gm,'<b>$1</b>');
  // Clickable links, added last so pre/code blocks stay untouched:
  // markdown [text](url) first, then bare https:// URLs.
  s=s.split(/(<pre>[\\s\\S]*?<\\/pre>|<code>[^<]*?<\\/code>)/g).map(function(part){
    if(part.lastIndexOf('<pre>',0)===0||part.lastIndexOf('<code>',0)===0) return part;
    part=part.replace(/\\[([^\\]\\n]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
    part=part.replace(/(^|[^"'>])(https?:\\/\\/[^\\s<)\\]]+[^\\s<)\\].,!?:;'"])/g,'$1<a href="$2" target="_blank" rel="noopener">$2</a>');
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
var view=(function(){ try{ return localStorage.getItem('chats-view')||'list'; }catch(e){ return 'list'; } })();
// Claude "spark" mark (simple hand-inlined equivalent, white on orange)
var CLAUDE_STAR='<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M12 2.5v6M12 15.5v6M2.5 12h6M15.5 12h6M5.4 5.4l4.2 4.2M14.4 14.4l4.2 4.2M18.6 5.4l-4.2 4.2M9.6 14.4l-4.2 4.2"/></svg>';
function claudeUrlFor(name, list){
  var u=(chats[name]&&chats[name].url)||'';
  if(!u && list){ for(var i=list.length-1;i>=0;i--){ if(list[i].url){ u=list[i].url; break; } } }
  return u;
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
      .catch(function(){ done=false; toast('Couldn\\u2019t save'); });
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
      .catch(function(){ done=false; if(btn) btn.style.display='none'; toast('Couldn\\u2019t save that'); inp.focus(); });
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
        .catch(function(){ toast('Couldn\\u2019t set the icon'); });
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
  return sm? plain(sm.tldr||(sm.text||'').split('\\n')[0]) : '';
}
var showArchived=false;
function renderHome(){
  document.getElementById('v-list').classList.toggle('on', view==='list');
  document.getElementById('v-tiles').classList.toggle('on', view==='tiles');
  var el=document.getElementById('grid'); el.innerHTML='';
  var g=groups();
  var all=sortedChatNames(g);
  var names=all.filter(function(n){ return !(chats[n]&&chats[n].archived); });
  var arch=all.filter(function(n){ return chats[n]&&chats[n].archived; });
  if(!all.length){ el.innerHTML='<div class="state">Nothing yet — chats appear here as they finish replies.</div>'; return; }
  if(view==='list') renderList(el,g,names); else renderTiles(el,g,names);
  if(arch.length){
    var tog=document.createElement('button'); tog.className='archtoggle';
    tog.textContent=(showArchived?'\\u25be':'\\u25b8')+' Archived ('+arch.length+')';
    tog.onclick=function(){ showArchived=!showArchived; renderHome(); };
    el.appendChild(tog);
    if(showArchived){ if(view==='list') renderList(el,g,arch); else renderTiles(el,g,arch); }
  }
}
// A chat is "answered" (grayed) while its answeredAt stamp is >= its latest
// message — so any newer message (from Sophie or the chat) un-grays it.
function chatDone(name,last){
  var a=(chats[name]&&chats[name].answeredAt)||'';
  if(!a) return false;
  return !last || a>=(last.created||'');
}
var CK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
function mkCheck(name,last,container){
  var ck=document.createElement('button'); ck.className='ckbtn'+(chatDone(name,last)?' on':'');
  ck.innerHTML=CK; ck.setAttribute('aria-label','Mark answered');
  ck.onclick=function(e){ e.stopPropagation(); toggleDone(name,last,ck,container); };
  return ck;
}
function toggleDone(name,last,ck,container){
  var prev=(chats[name]&&chats[name].answeredAt)||null;
  var willDone=!chatDone(name,last);
  chats[name]=chats[name]||{}; chats[name].answeredAt = willDone ? new Date().toISOString() : null;
  container.classList.toggle('done',willDone); ck.classList.toggle('on',willDone);
  api('/api/chatfeed/answered',{method:'POST',body:JSON.stringify({chat:name, answered:willDone})})
    .then(function(r){return r.json()}).then(function(d){ if(!d.ok) throw 0; })
    .catch(function(){ chats[name].answeredAt=prev; var d2=chatDone(name,last);
      container.classList.toggle('done',d2); ck.classList.toggle('on',d2); toast('Couldn’t save that'); });
}
function renderTiles(el,g,names){
  var grid=document.createElement('div'); grid.id='chatgrid'; el.appendChild(grid);
  names.forEach(function(name){
    var list=g[name]||[];
    var last=list.length? list[list.length-1] : null;
    var unread=last && last.from!=='sophie' && (seen[name]||'')<(last.created||'');
    var status=statusFor(list);
    var about=(chats[name]&&chats[name].about)||'';
    var b=document.createElement('button'); b.className='tile'+(chatDone(name,last)?' done':'');
    b.innerHTML='<span class="t-cover">'+iconHtml(name)+(unread?'<span class="t-new"></span>':'')+'</span>'
      +'<span class="t-name">'+esc(dispName(name))+'</span>'
      +(about? '<span class="t-about">'+esc(about)+'</span>':'')
      +(status? '<span class="t-tldr">'+esc(status)+'</span>':'')
      +'<span class="t-meta">'+(last? ago(last.created) : 'no messages')+'</span>';
    b.querySelector('.t-cover').appendChild(mkCheck(name,last,b));
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
    var status=statusFor(list) || (chats[name]&&chats[name].about) || 'no messages yet';
    var row=document.createElement('button'); row.className='crow'+(chatDone(name,last)?' done':'');
    row.innerHTML=iconHtml(name,'cr-ic')
      +'<span class="cr-body"><span class="cr-name">'+esc(dispName(name))+'</span>'
      +'<span class="cr-sub">'+esc(status)+'</span></span>'
      +(unread?'<span class="cr-dot"></span>':'')
      +'<span class="cr-time">'+(last? ago(last.created):'')+'</span>';
    row.appendChild(mkCheck(name,last,row));
    row.onclick=function(){ openChat(name); };
    wrap.appendChild(row);
  });
}

function renderMsg(m){
  var row=document.createElement('div'); row.className='msg'; if(m.id) row.dataset.mid=m.id;
  var firstLine=plain((m.tldr||m.text||'').split('\\n')[0]).slice(0,140);
  row.innerHTML='<div class="m-head"><span class="m-chat'+(m.from==='sophie'?' sophie':'')+'">'
    +(m.from==='sophie'?'me':'claude')+'</span><span class="m-time">'+ago(m.created)+'</span>'
    +'<span class="m-close">close &#9650;</span></div>'
    +'<div class="m-preview">'+esc(firstLine)+((m.text||'').length>140?'\\u2026':'')+'</div>'
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
  else if(m.from!=='sophie'){
    // Play = generate the neural voice on demand (~1¢), cached forever after.
    // Sophie taps it when she wants to listen — she stays in control.
    var PLAY='<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
    var pol=document.createElement('button'); pol.className='tbtn play'; pol.innerHTML=PLAY+'<span>Play</span>';
    pol.onclick=function(e){
      e.stopPropagation();
      pol.disabled=true; pol.innerHTML=PLAY+'<span>making\\u2026</span>';
      api('/api/chatfeed/polish',{method:'POST',body:JSON.stringify({id:m.id})})
        .then(function(r){return r.json()})
        .then(function(d){
          if(!d.ok||!d.url) throw 0;
          m.audioUrl=d.url;
          var au=document.createElement('audio'); au.controls=true; au.src=d.url; au.autoplay=true;
          tools.replaceChild(au,pol);
        })
        .catch(function(){ pol.disabled=false; pol.innerHTML=PLAY+'<span>Play</span>'; toast('Couldn\\u2019t make that one'); });
    };
    tools.appendChild(pol);
  }
  // audio (player or Play) sits at the TOP of the message, under the header
  row.insertBefore(tools, row.querySelector('.m-preview'));
  row.querySelector('.m-preview').onclick=function(){ row.classList.add('open'); };
  // tapping the open message toggles autoscroll (stop/start). Closing is the
  // header row ("close ▲") so a tap never collapses it.
  row.querySelector('.m-full').onclick=function(e){
    if(e.target.closest('a')||e.target.closest('pre')||e.target.closest('code')) return;
    window.__scrollTap();
  };
  row.querySelector('.m-head').onclick=function(){
    if(row.classList.contains('open')){ window.__scrollStop(); row.classList.remove('open'); }
  };
  // Bottom row: bookmark (left) + Open-in-Claude (right).
  var ob=document.createElement('div'); ob.className='openrow';
  ob.appendChild(bookmarkBtn(m));
  var murl=m.url||openUrl;
  if(murl){ ob.appendChild(openClaudeBtn(murl)); }
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
function openChat(name, keepScroll, focusId, noFetch){
  if(!cur) homeY=window.scrollY;   // remember the feed spot for back
  scrollStop(); cur=name;
  var sec=document.getElementById('thread'); sec.innerHTML='';
  var list=(groups()[name])||[];
  var head=document.createElement('header');
  head.innerHTML='<div class="no">chats</div>'
    +'<div class="thread-head">'+iconHtml(name)+'<h1>'+esc(dispName(name))+'</h1><button class="renamebtn" aria-label="Rename this chat"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button></div>'
    +'<div class="headbtns"><div class="viewtog" style="margin:0"><button class="tg-chat on">Chat</button><button class="tg-assets">Assets</button><button class="tg-compare">Compare</button></div>'
    +'<button class="tbtn threadrefresh" aria-label="Refresh" style="padding:6px 9px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg></button></div><div class="rule"></div>';
  head.querySelector('.threadrefresh').onclick=function(){ toast('Refreshing\\u2026'); load(); };
  var curl=claudeUrlFor(name, list); openUrl=curl;   // renderMsg reads openUrl
  sec.appendChild(head);
  head.querySelector('.renamebtn').onclick=function(){ editName(name, head); };

  // Chat panel — the messages (newest at top) + archive control
  var chatPanel=document.createElement('div');
  if(!list.length) chatPanel.appendChild(Object.assign(document.createElement('div'),{className:'state',textContent:'No messages yet.'}));
  list.slice().reverse().forEach(function(m){ chatPanel.appendChild(renderMsg(m)); });
  // Every message carries its own Open button (added in renderMsg). With no
  // messages at all, fall back to one in the header row.
  if(curl && !list.length){ head.querySelector('.headbtns').appendChild(openClaudeBtn(curl)); }
  var isArch=!!(chats[name]&&chats[name].archived);
  var ar=document.createElement('div'); ar.className='archrow';
  var ab=document.createElement('button'); ab.textContent=isArch? 'Unarchive this chat' : 'Archive this chat';
  ab.onclick=function(){
    api('/api/chatfeed/archive',{method:'POST',body:JSON.stringify({chat:name, archived:!isArch})})
      .then(function(r){return r.json()})
      .then(function(d){ if(!d.ok) throw 0;
        chats[name]=chats[name]||{}; chats[name].archived=!isArch;
        toast(!isArch? 'Archived' : 'Restored'); goHome();
      })
      .catch(function(){ toast('Couldn\\u2019t save that'); });
  };
  ar.appendChild(ab); chatPanel.appendChild(ar);
  sec.appendChild(chatPanel);

  // Assets panel — this chat's images, lazy-loaded on first open
  var assetsPanel=document.createElement('div'); assetsPanel.style.display='none';
  assetsPanel.innerHTML='<div class="state">Loading images&hellip;</div>';
  sec.appendChild(assetsPanel);
  var assetsLoaded=false;
  function loadAssets(){
    if(assetsLoaded) return; assetsLoaded=true;
    api('/api/gallery/assets?chat='+encodeURIComponent(name)+'&limit=300')
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
        var cells=[], filter=null;
        function applyFilter(){
          cells.forEach(function(c){
            var v=c.it.vote||null, show=true;
            if(filter==='new') show=!v;
            else if(filter==='like') show=(v==='like');
            else if(filter==='nox') show=(v!=='dislike');
            if(c.it._broken) show=false;   // a dead image stays hidden
            c.cell.style.display=show?'':'none';
          });
        }
        var seg=document.createElement('div'); seg.className='afilter';
        [['new','New'],['like','\u2665'],['nox','Hide \u2715']].forEach(function(m){
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
          function paint(){
            hb.classList.toggle('on', it.vote==='like');
            xb.classList.toggle('on', it.vote==='dislike');
            cell.classList.toggle('nay', it.vote==='dislike');
            if(it._lbPaint) it._lbPaint();   // mirror into an open lightbox
            applyFilter();                   // a changed vote may hide/show tiles
          }
          function cast(v){
            var next = it.vote===v ? null : v;
            api('/api/gallery/assets/vote',{method:'POST',body:JSON.stringify({chat:name,url:it.url,vote:next})})
              .then(function(r){return r.json()})
              .then(function(d){ if(!d.ok) throw 0; it.vote=next; paint(); })
              .catch(function(){ toast('Couldn\u2019t save that'); });
          }
          it._cast=cast;
          it._noteSave=function(text,cb){
            var t=String(text||'').trim();
            api('/api/gallery/assets/vote',{method:'POST',body:JSON.stringify({chat:name,url:it.url,note:t||null})})
              .then(function(r){return r.json()})
              .then(function(d){ if(!d.ok) throw 0; it.note=t||null; if(cb)cb(true); })
              .catch(function(){ toast('Couldn\u2019t save the note'); if(cb)cb(false); });
          };
          hb.onclick=function(e){ e.stopPropagation(); cast('like'); };
          xb.onclick=function(e){ e.stopPropagation(); cast('dislike'); };
          paint();
          cell.appendChild(hb); cell.appendChild(xb);
        }
        a.forEach(function(it){
          var cell=document.createElement('div'); cell.className='acell';
          var b=document.createElement('button');
          // Prefer the direct storage thumb (CDN, no server hop); if it isn't
          // generated yet it 404s and we fall back to /api/story/thumb, which
          // makes it on demand. IntersectionObserver sets src from data-src.
          var thumb=it.thumb||assetThumb(it.url), fb=assetThumb(it.url);
          var srcAttr = io ? 'data-src' : 'src';
          b.innerHTML='<img alt="" decoding="async" '+srcAttr+'="'+esc(thumb)+'">';
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
        });
        assetsPanel.appendChild(grid);
      })
      .catch(function(){ assetsPanel.innerHTML='<div class="state">Couldn\\u2019t load images.</div>'; });
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
      .catch(function(){ comparePanel.innerHTML='<div class="state">Couldn\\u2019t load pages.</div>'; });
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
  if(noFetch){ toast('Couldn\\u2019t find that message'); return; }
  toast('Loading full history\\u2026');
  api('/api/chatfeed/thread?chat='+encodeURIComponent(name)+'&_='+Date.now())
    .then(function(r){return r.json()})
    .then(function(d){
      if(cur!==name) return;
      var have={}; msgs.forEach(function(m){ have[m.id]=1; });
      (d.messages||[]).forEach(function(m){ if(!have[m.id]){ msgs.push(m); have[m.id]=1; } });
      openChat(name, true, id, true);   // rebuild with full thread; noFetch=true
    })
    .catch(function(){ toast('Couldn\\u2019t load history'); });
}
// An autoscroll pill that lives in THIS page and drives a same-origin iframe's
// scroll — because iOS renders position:fixed unreliably INSIDE an iframe, so a
// pill injected into the Compare page itself won't stay put on a phone. Same
// look/behavior as the shared pill (default Fast; tap play/pause; -/+ speed).
function mkPagePill(getWin){
  var SPEEDS=[['Slow',0.5],['Medium',1.0],['Fast',1.9],['Faster',3.2]];
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
  function start(d){ dir=d; playing=true; last=null; acc=0; paint(); raf=requestAnimationFrame(step); }
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
  // listen on its document). Taps on links/buttons still do their own thing.
  frame.addEventListener('load', function(){
    try{
      var doc=frame.contentDocument;
      if(doc) doc.addEventListener('click', function(e){
        var t=e.target;
        if(t && t.closest && t.closest('a,button,input,textarea,select,label,summary')) return;
        pill._tap();
      });
    }catch(_){}
  });
  bar.querySelector('.pv-back').onclick=function(){ if(pill._stop) pill._stop(); v.remove(); document.body.style.overflow=''; };
  document.body.appendChild(v);
  document.body.style.overflow='hidden';
}
// Image lightbox — freezes the page behind it (design rule)
function lightbox(url, asset){
  scrollStop();
  var lb=document.getElementById('clightbox');
  lb.innerHTML='<img alt="" src="'+url.replace(/"/g,'&quot;')+'">';
  // ♥/✕ overlaid on the image (left / right); the note box sits UNDER the image.
  if(asset && asset._cast){
    var row=document.createElement('div'); row.className='lbtop';
    row.onclick=function(e){ e.stopPropagation(); };
    var hb=document.createElement('button'); hb.className='vote heart'; hb.innerHTML=window.__HEART;
    var xb=document.createElement('button'); xb.className='vote nope'; xb.innerHTML=window.__XMARK;
    var nw=document.createElement('div'); nw.className='lbnote';
    nw.onclick=function(e){ e.stopPropagation(); };
    var ni=document.createElement('input'); ni.placeholder='Add a note…'; ni.value=asset.note||'';
    var ns=document.createElement('button'); ns.className='notesend';
    ns.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    function sendNote(){
      asset._noteSave(ni.value, function(ok){
        if(!ok) return;
        ns.classList.add('saved'); toast('Note saved');
        ni.blur();
        setTimeout(function(){ ns.classList.remove('saved'); }, 1500);
      });
    }
    ns.onclick=function(e){ e.stopPropagation(); sendNote(); };
    ni.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); sendNote(); } };
    nw.appendChild(ni); nw.appendChild(ns);
    asset._lbPaint=function(){
      hb.classList.toggle('on', asset.vote==='like');
      xb.classList.toggle('on', asset.vote==='dislike');
    };
    asset._lbPaint();
    hb.onclick=function(e){ e.stopPropagation(); asset._cast('like'); };
    xb.onclick=function(e){ e.stopPropagation(); asset._cast('dislike'); };
    row.appendChild(hb); row.appendChild(xb);
    var frame=lb.querySelector('.clframe');
    (frame||lb).appendChild(row);
    lb.appendChild(nw);   // note box below the image, not over it
  }
  lb.style.display='flex'; document.body.style.overflow='hidden';
  lb.onclick=function(){ if(asset) asset._lbPaint=null; lb.style.display='none'; lb.innerHTML=''; document.body.style.overflow=''; };
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
        grid.style.display='none'; sr.style.display=''; sr.innerHTML='';
        if(!rs.length){ sr.innerHTML='<div class="state">No matches.</div>'; return; }
        rs.forEach(function(m){
          var b=document.createElement('button'); b.className='sres';
          b.innerHTML='<div class="sr-top"><span class="sr-chat">'+esc(m.chat)+'</span><span class="sr-time">'+ago(m.created)+'</span></div>'
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
document.getElementById('refresh').onclick=function(){ toast('Refreshing\\u2026'); load(); };

function load(){
  // cache-bust: the webview heuristically cached the bare URL, which made the
  // Refresh button look dead (new messages only appeared minutes later)
  api('/api/chatfeed?_='+Date.now()).then(function(r){return r.json()}).then(function(data){
    chats=data.chats||{}; msgs=data.messages||[];
    if(cur){ var y=window.scrollY; openChat(cur,true); window.scrollTo(0,y); } else renderHome();
  }).catch(function(){
    if(!cur) document.getElementById('grid').innerHTML='<div class="state">Couldn\\u2019t reach the feed.</div>';
  });
}
load();
setInterval(function(){
  if(cur) return;   // never rebuild a thread under her — refresh button covers it
  load();
}, 60000);
})();
</script>
"""

page = page.replace('__FONT__', font)
page = page.replace('__PILL_CSS__', PILL_CSS).replace('__PILL_HTML__', PILL_HTML).replace('__PILL_JS__', PILL_JS)
out = os.path.join(ROOT, 'public', 'chats.html')
open(out, 'w', encoding='utf-8').write(page)
print('built public/chats.html', round(len(page) / 1024), 'KB')
