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
.assetgrid{display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:.4em 0 2em;}
.assetgrid button{position:relative; margin:0; padding:0; border:none; background:none; cursor:pointer;}
.assetgrid img{width:100%; aspect-ratio:1; object-fit:cover; border-radius:6px; border:1px solid var(--line); display:block; background:var(--barbg);}
.assetgrid .acell{position:relative;}
.assetgrid .vote{position:absolute; top:5px; width:29px; height:29px; border-radius:50%; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer;
  background:rgba(250,247,240,.9); color:#8a8377; box-shadow:0 1px 4px rgba(0,0,0,.2); padding:0;}
.assetgrid .vote svg{width:15px; height:15px; display:block;}
.assetgrid .vote.heart{left:5px;}
.assetgrid .vote.nope{right:5px;}
.assetgrid .vote.heart.on{background:#c96a5e; color:#fff;}
.assetgrid .vote.nope.on{background:#8a8377; color:#fff;}
.assetgrid .acell.nay img{opacity:.35; filter:grayscale(60%);}
.lbvotes{display:flex; gap:16px; justify-content:center; margin-top:14px;}
.lbvotes .vote{position:static; width:46px; height:46px;}
.lbvotes .vote svg{width:22px; height:22px;}
#clightbox{position:fixed; inset:0; background:rgba(15,13,10,.93); z-index:30; display:none; align-items:center; justify-content:center; padding:18px;}
#clightbox img{max-width:100%; max-height:92vh; border-radius:6px;}
.aboutrow{margin:-2px 0 6px;}
.aboutshow{font-style:italic; color:var(--ink2); font-size:1.02em; cursor:pointer;}
.seticon{font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.1em; text-transform:uppercase;
  background:none; border:none; color:var(--ink2); cursor:pointer; padding:4px 0; display:block; margin:-2px 0 0;}
.msg{padding:14px 0; border-bottom:1px solid var(--line);}
.m-head{display:flex; gap:8px; align-items:baseline;}
.m-chat{font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink2); font-weight:600;}
.m-chat.sophie{color:var(--rose);}
.m-time{font-family:-apple-system,sans-serif; font-size:10px; color:var(--ink2);}
.m-preview{font-size:16.5px; line-height:1.5; cursor:pointer;}
.m-full{display:none; font-size:16.5px; line-height:1.6; white-space:pre-wrap;}
.m-full pre{white-space:pre-wrap; overflow-wrap:anywhere; background:var(--barbg); border:1px solid var(--line); border-radius:6px; padding:8px 10px; font-size:12.5px; line-height:1.45;}
.m-full code{background:var(--barbg); border:1px solid var(--line); border-radius:4px; padding:0 4px; font-size:14px;}
.msg.open .m-head{cursor:pointer;}
.m-close{display:none; font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink2); margin-left:auto;}
.msg.open .m-close{display:inline;}
.archrow{margin-top:2.2em; text-align:center;}
.archrow button{background:none; border:none; color:var(--ink2); opacity:.7; font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.12em; text-transform:uppercase; cursor:pointer; padding:6px;}
.archtoggle{display:block; width:100%; text-align:left; background:none; border:none; border-top:1px solid var(--line); margin-top:1.6em; padding:14px 2px; color:var(--ink2); font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.14em; text-transform:uppercase; cursor:pointer;}
.msg.open .m-preview{display:none;}
.msg.open .m-full{display:block;}
.m-tools{display:flex; gap:8px; margin:6px 0; align-items:center;}
.openrow{display:flex; justify-content:flex-end; padding:14px 0 6px;}
.tbtn{font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.08em; text-transform:uppercase;
  border:1px solid var(--line); background:var(--barbg); color:var(--ink2); border-radius:6px; padding:5px 10px; cursor:pointer;}
.tbtn.on{border-color:var(--rose); color:var(--rose);}
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
/* Open-in-Claude button — Claude orange, white starburst + text */
.openclaude{display:inline-flex; align-items:center; gap:6px; background:#d97757; color:#fff; border:none; border-radius:6px;
  font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.04em; padding:8px 14px; cursor:pointer; text-decoration:none;}
.openclaude svg{width:15px; height:15px; display:block; stroke:#fff;}
.headbtns{display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:2px 0 0;}
.tbtn.play{display:inline-flex; align-items:center; gap:6px;}
.backwrap{position:fixed; top:max(14px, env(safe-area-inset-top)); left:max(14px,4vw); z-index:9; display:none;}
body.reading .backwrap{display:block;}
#back{width:44px; height:44px; border-radius:6px; border:1px solid var(--line); background:var(--barbg); color:var(--ink2); font-size:20px; cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,.09);}
.loadall{display:block; margin:0 0 10px auto; font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.06em; text-transform:uppercase;
  border:1px solid var(--line); color:var(--ink2); background:var(--barbg); border-radius:6px; padding:8px 14px; cursor:pointer;}
#toast{position:fixed; bottom:calc(64px + env(safe-area-inset-bottom)); left:50%; transform:translateX(-50%);
  background:var(--ink); color:var(--paper); font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.06em;
  padding:8px 14px; border-radius:6px; opacity:0; transition:opacity .25s; pointer-events:none;}
@media (prefers-reduced-motion: reduce){ #toast{transition:none;} }
__PILL_CSS__
</style>
__PILL_HTML__
<div class="backwrap"><button id="back" aria-label="Back to all chats">&#8249;</button></div>
<div class="wrap">
  <section id="home">
    <header>
      <div class="no">deck factory &middot; every chat, one place</div>
      <h1>Chats</h1>
      <div class="rule"></div>
    </header>
    <div style="display:flex; align-items:center; gap:10px; margin:0 0 1.5em;">
      <div class="viewtog" style="margin:0"><button id="v-list">List</button><button id="v-tiles">Tiles</button></div>
      <button id="refresh" class="tbtn" aria-label="Refresh" style="margin-left:auto; padding:8px 10px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg></button>
    </div>
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
var chats={}, msgs=[], cur=null, seen={}, homeY=0;
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
function iconHtml(name, cls){
  var icon=chats[name]&&chats[name].icon;
  if(icon) return '<img alt="" src="'+esc(icon)+'"'+(cls?' class="'+cls+'"':'')+'>';
  return '<span class="t-blank'+(cls?' '+cls:'')+'"><span>'+esc((name||'?').slice(0,1).toUpperCase())+'</span></span>';
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
function renderTiles(el,g,names){
  var grid=document.createElement('div'); grid.id='chatgrid'; el.appendChild(grid);
  names.forEach(function(name){
    var list=g[name]||[];
    var last=list.length? list[list.length-1] : null;
    var unread=last && last.from!=='sophie' && (seen[name]||'')<(last.created||'');
    var status=statusFor(list);
    var about=(chats[name]&&chats[name].about)||'';
    var b=document.createElement('button'); b.className='tile';
    b.innerHTML='<span class="t-cover">'+iconHtml(name)+(unread?'<span class="t-new"></span>':'')+'</span>'
      +'<span class="t-name">'+esc(name)+'</span>'
      +(about? '<span class="t-about">'+esc(about)+'</span>':'')
      +(status? '<span class="t-tldr">'+esc(status)+'</span>':'')
      +'<span class="t-meta">'+(last? ago(last.created) : 'no messages')+'</span>';
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
    var row=document.createElement('button'); row.className='crow';
    row.innerHTML=iconHtml(name,'cr-ic')
      +'<span class="cr-body"><span class="cr-name">'+esc(name)+'</span>'
      +'<span class="cr-sub">'+esc(status)+'</span></span>'
      +(unread?'<span class="cr-dot"></span>':'')
      +'<span class="cr-time">'+(last? ago(last.created):'')+'</span>';
    row.onclick=function(){ openChat(name); };
    wrap.appendChild(row);
  });
}

function renderMsg(m){
  var row=document.createElement('div'); row.className='msg';
  var firstLine=plain((m.tldr||m.text||'').split('\\n')[0]).slice(0,140);
  row.innerHTML='<div class="m-head"><span class="m-chat'+(m.from==='sophie'?' sophie':'')+'">'
    +(m.from==='sophie'?'me':'claude')+'</span><span class="m-time">'+ago(m.created)+'</span>'
    +'<span class="m-close">close &#9650;</span></div>'
    +'<div class="m-preview">'+esc(firstLine)+((m.text||'').length>140?'\\u2026':'')+'</div>'
    +'<div class="m-full">'+md(m.text)+'</div>';
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
  // tapping the open message starts/stops autoscroll (reading aid) —
  // closing moved to the header row ("close ▲") so a tap never collapses it
  row.querySelector('.m-full').onclick=function(e){
    if(e.target.closest('a')||e.target.closest('pre')||e.target.closest('code')) return;
    window.__scrollToggle();
  };
  row.querySelector('.m-head').onclick=function(){
    if(row.classList.contains('open')){ window.__scrollStop(); row.classList.remove('open'); }
  };
  return row;
}

function openChat(name, keepScroll){
  if(!cur) homeY=window.scrollY;   // remember the feed spot for back
  scrollStop(); cur=name;
  var sec=document.getElementById('thread'); sec.innerHTML='';
  var list=(groups()[name])||[];
  var head=document.createElement('header');
  head.innerHTML='<div class="no">chats</div>'
    +'<div class="thread-head">'+iconHtml(name)+'<h1>'+esc(name)+'</h1></div>'
    +'<div class="headbtns"><div class="viewtog" style="margin:0"><button class="tg-chat on">Chat</button><button class="tg-assets">Assets</button></div>'
    +'<button class="tbtn threadrefresh" aria-label="Refresh" style="padding:6px 9px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg></button></div><div class="rule"></div>';
  head.querySelector('.threadrefresh').onclick=function(){ toast('Refreshing\\u2026'); load(); };
  var curl=claudeUrlFor(name, list);
  sec.appendChild(head);

  // Chat panel — the messages (newest at top) + archive control
  var chatPanel=document.createElement('div');
  if(!list.length) chatPanel.appendChild(Object.assign(document.createElement('div'),{className:'state',textContent:'No messages yet.'}));
  list.slice().reverse().forEach(function(m){ chatPanel.appendChild(renderMsg(m)); });
  // The Open-in-Claude button renders INSIDE the latest message (newest is
  // first), right-aligned — part of the message, not a separate row. With no
  // messages it falls back to the header row.
  if(curl){
    var ob=document.createElement('div'); ob.className='openrow'; ob.appendChild(openClaudeBtn(curl));
    var firstMsg=chatPanel.querySelector('.msg');
    if(firstMsg) firstMsg.appendChild(ob);
    else head.querySelector('.headbtns').appendChild(openClaudeBtn(curl));
  }
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
        // Small cached thumbnails in the grid ("Load all" defeats lazy
        // loading); the lightbox still opens the full image.
        var la=document.createElement('button'); la.className='loadall'; la.textContent='Load all';
        la.onclick=function(){
          assetsPanel.querySelectorAll('img[loading="lazy"]').forEach(function(im){ im.loading='eager'; });
          // Also trickle the FULL-SIZE originals into the cache (3 at a time)
          // so the lightbox opens instantly once its image has come in.
          la.disabled=true;
          var q=a.map(function(it){ return it.url; }), active=0, done=0;
          function tick(){
            if(!q.length && !active){ la.textContent='All loaded'; setTimeout(function(){ la.remove(); },1200); return; }
            while(active<3 && q.length){
              active++;
              // fetch() lands the bytes in the HTTP cache WITHOUT decoding the
              // image — new Image() decoded all of them and blew webview memory
              fetch(q.shift(),{mode:'no-cors'}).catch(function(){}).then(function(){
                active--; done++;
                la.textContent='Loading full sizes\u2026 '+done+'/'+a.length; tick(); });
            }
          }
          la.textContent='Loading full sizes\u2026 0/'+a.length;
          tick();
        };
        assetsPanel.appendChild(la);
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
          }
          function cast(v){
            var next = it.vote===v ? null : v;
            api('/api/gallery/assets/vote',{method:'POST',body:JSON.stringify({chat:name,url:it.url,vote:next})})
              .then(function(r){return r.json()})
              .then(function(d){ if(!d.ok) throw 0; it.vote=next; paint(); })
              .catch(function(){ toast('Couldn\u2019t save that'); });
          }
          it._cast=cast;
          hb.onclick=function(e){ e.stopPropagation(); cast('like'); };
          xb.onclick=function(e){ e.stopPropagation(); cast('dislike'); };
          paint();
          cell.appendChild(hb); cell.appendChild(xb);
        }
        a.forEach(function(it){
          var cell=document.createElement('div'); cell.className='acell';
          var b=document.createElement('button');
          b.innerHTML='<img alt="" loading="lazy" src="'+esc(assetThumb(it.url))+'">';
          b.onclick=function(){ lightbox(it.url, it); };
          cell.appendChild(b); voteBtns(cell,it);
          grid.appendChild(cell);
        });
        assetsPanel.appendChild(grid);
      })
      .catch(function(){ assetsPanel.innerHTML='<div class="state">Couldn\\u2019t load images.</div>'; });
  }
  var tgChat=head.querySelector('.tg-chat'), tgAssets=head.querySelector('.tg-assets');
  tgChat.onclick=function(){ tgChat.classList.add('on'); tgAssets.classList.remove('on'); chatPanel.style.display=''; assetsPanel.style.display='none'; };
  tgAssets.onclick=function(){ scrollStop(); tgAssets.classList.add('on'); tgChat.classList.remove('on'); chatPanel.style.display='none'; assetsPanel.style.display=''; loadAssets(); window.scrollTo(0,0); };

  markSeen(name);
  document.getElementById('home').style.display='none';
  sec.style.display='';
  document.body.classList.add('reading');
  if(!keepScroll) window.scrollTo(0,0);
}
// Image lightbox — freezes the page behind it (design rule)
function lightbox(url, asset){
  scrollStop();
  var lb=document.getElementById('clightbox');
  lb.innerHTML='<img alt="" src="'+url.replace(/"/g,'&quot;')+'">';
  // the same ♥/✕ as the tile, mirrored live in both places
  if(asset && asset._cast){
    var row=document.createElement('div'); row.className='lbvotes';
    var hb=document.createElement('button'); hb.className='vote heart'; hb.innerHTML=window.__HEART;
    var xb=document.createElement('button'); xb.className='vote nope'; xb.innerHTML=window.__XMARK;
    asset._lbPaint=function(){
      hb.classList.toggle('on', asset.vote==='like');
      xb.classList.toggle('on', asset.vote==='dislike');
    };
    asset._lbPaint();
    hb.onclick=function(e){ e.stopPropagation(); asset._cast('like'); };
    xb.onclick=function(e){ e.stopPropagation(); asset._cast('dislike'); };
    row.appendChild(hb); row.appendChild(xb); lb.appendChild(row);
  }
  lb.style.display='flex'; document.body.style.overflow='hidden';
  lb.onclick=function(){ if(asset) asset._lbPaint=null; lb.style.display='none'; lb.innerHTML=''; document.body.style.overflow=''; };
}
function goHome(){
  scrollStop(); cur=null;
  document.getElementById('thread').style.display='none';
  document.getElementById('home').style.display='';
  document.body.classList.remove('reading');
  renderHome();
  window.scrollTo(0,homeY||0);   // back to where you were, not the top
}
document.getElementById('back').onclick=goHome;
document.getElementById('v-list').onclick=function(){ view='list'; try{localStorage.setItem('chats-view','list');}catch(e){} renderHome(); };
document.getElementById('v-tiles').onclick=function(){ view='tiles'; try{localStorage.setItem('chats-view','tiles');}catch(e){} renderHome(); };
document.getElementById('refresh').onclick=function(){ toast('Refreshing\\u2026'); load(); };

function load(){
  api('/api/chatfeed').then(function(r){return r.json()}).then(function(data){
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
