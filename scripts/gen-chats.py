#!/usr/bin/env python3
# The Chat app — public/chats.html, served gated at /chats.
# Home is a grid of chat tiles (picture icon, name, last activity); tapping a
# tile opens that chat's thread — its replies oldest-to-newest with free
# device-voice read-aloud and polished memos — with the reply bar pre-targeted
# to that chat (replies are picked up on chats' hourly checks).
import base64, os

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
.t-meta{font-family:-apple-system,sans-serif; font-size:9px; letter-spacing:.14em; color:var(--ink2); text-transform:uppercase; margin-top:2px;}
.thread-head{display:flex; align-items:center; gap:12px; margin-bottom:.4em;}
.thread-head img,.thread-head .t-blank{width:46px; height:46px; border-radius:4px; border:1px solid var(--line); object-fit:cover; flex:none;}
.thread-head .t-blank{display:flex; font-size:1.3em;}
.seticon{font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.1em; text-transform:uppercase;
  background:none; border:none; color:var(--ink2); cursor:pointer; padding:4px 0; display:block; margin:-2px 0 0;}
.msg{padding:14px 0; border-bottom:1px solid var(--line);}
.m-head{display:flex; gap:8px; align-items:baseline;}
.m-chat{font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink2); font-weight:600;}
.m-chat.sophie{color:var(--rose);}
.m-time{font-family:-apple-system,sans-serif; font-size:10px; color:var(--ink2);}
.m-preview{font-size:16.5px; line-height:1.5; cursor:pointer;}
.m-full{display:none; font-size:16.5px; line-height:1.6; white-space:pre-wrap;}
.msg.open .m-preview{display:none;}
.msg.open .m-full{display:block;}
.m-tools{display:flex; gap:8px; margin-top:6px; align-items:center;}
.tbtn{font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.08em; text-transform:uppercase;
  border:1px solid var(--line); background:var(--barbg); color:var(--ink2); border-radius:6px; padding:5px 10px; cursor:pointer;}
.tbtn.on{border-color:var(--rose); color:var(--rose);}
.m-tools audio{flex:1; height:32px; min-width:0;}
.backwrap{position:fixed; top:max(14px, env(safe-area-inset-top)); left:max(14px,4vw); z-index:9; display:none;}
body.reading .backwrap{display:block;}
#back{width:44px; height:44px; border-radius:6px; border:1px solid var(--line); background:var(--barbg); color:var(--ink2); font-size:20px; cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,.09);}
.replybar{position:fixed; left:0; right:0; bottom:0; background:color-mix(in srgb, var(--barbg) 94%, transparent); backdrop-filter:blur(6px);
  border-top:1px solid var(--line); padding:10px max(4vw,12px) calc(10px + env(safe-area-inset-bottom)); display:none; gap:8px;}
body.reading .replybar{display:flex;}
.replybar input{flex:1; font-family:'EBGaramond',Georgia,serif; font-size:17px; border:1px solid var(--line); border-radius:6px; background:var(--barbg); color:var(--ink); padding:8px 10px; min-width:0;}
.replybar button{font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.06em; text-transform:uppercase;
  border:1px solid var(--rose); color:var(--rose); background:var(--barbg); border-radius:6px; padding:8px 14px; cursor:pointer;}
#toast{position:fixed; bottom:calc(64px + env(safe-area-inset-bottom)); left:50%; transform:translateX(-50%);
  background:var(--ink); color:var(--paper); font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.06em;
  padding:8px 14px; border-radius:6px; opacity:0; transition:opacity .25s; pointer-events:none;}
@media (prefers-reduced-motion: reduce){ #toast{transition:none;} }
</style>
<div class="backwrap"><button id="back" aria-label="Back to all chats">&#8249;</button></div>
<div class="wrap">
  <section id="home">
    <header>
      <div class="no">deck factory &middot; every chat, one place</div>
      <h1>Chats</h1>
      <div class="rule"></div>
    </header>
    <div id="grid"><div class="state">Loading&hellip;</div></div>
  </section>
  <section id="thread" style="display:none"></section>
</div>
<div class="replybar">
  <input id="rtext" placeholder="Reply&hellip; (chats check hourly)">
  <button id="rsend">Send</button>
</div>
<div id="toast"></div>
<script>
(function(){
var TOKEN='__STUDIO_TOKEN__';
function api(path,opt){ opt=opt||{}; opt.headers=Object.assign({'x-studio-token':TOKEN,'Content-Type':'application/json'},opt.headers||{}); return fetch(path,opt); }
function toast(m){ var t=document.getElementById('toast'); t.textContent=m; t.style.opacity=1; setTimeout(function(){t.style.opacity=0},1800); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function ago(iso){
  var s=(Date.now()-new Date(iso).getTime())/1000;
  if(s<90) return 'just now';
  if(s<5400) return Math.round(s/60)+'m ago';
  if(s<129600) return Math.round(s/3600)+'h ago';
  return Math.round(s/86400)+'d ago';
}
var chats={}, msgs=[], cur=null, speaking=null, seen={};
try{ seen=JSON.parse(localStorage.getItem('chats-seen-v1')||'{}'); }catch(e){}
function markSeen(name){
  var g=groups()[name]; if(!g||!g.length) return;
  seen[name]=g[g.length-1].created||'';
  try{ localStorage.setItem('chats-seen-v1',JSON.stringify(seen)); }catch(e){}
}

// The free device engine defaults to its most robotic voice — ask for the
// best installed one instead: enhanced/premium British first, then any
// British, then any enhanced English. (getVoices() fills in asynchronously,
// so re-pick on voiceschanged.)
var bestVoice=null;
function pickVoice(){
  var vs=(speechSynthesis.getVoices()||[]);
  var best=null, bestScore=0;
  vs.forEach(function(v){
    if(!/^en/i.test(v.lang||'')) return;
    var s=1;
    if(/en[-_]GB/i.test(v.lang)) s+=4;
    if(/enhanced|premium|natural/i.test(v.name||'')) s+=2;
    if(v.localService) s+=1;
    if(s>bestScore){ bestScore=s; best=v; }
  });
  bestVoice=best;
}
if('speechSynthesis' in window){
  pickVoice();
  speechSynthesis.onvoiceschanged=pickVoice;
}
function speak(text,btn){
  if(!('speechSynthesis' in window)){ toast('Voice not available here'); return; }
  if(speaking===btn){ speechSynthesis.cancel(); speaking=null; btn.classList.remove('on'); btn.textContent='\\u25b6 hear it'; return; }
  speechSynthesis.cancel();
  document.querySelectorAll('.tbtn.on').forEach(function(b){ b.classList.remove('on'); b.textContent='\\u25b6 hear it'; });
  var u=new SpeechSynthesisUtterance(text);
  if(!bestVoice) pickVoice();
  if(bestVoice){ u.voice=bestVoice; u.lang=bestVoice.lang; }
  u.rate=1.05;
  u.onend=function(){ if(speaking===btn){ speaking=null; btn.classList.remove('on'); btn.textContent='\\u25b6 hear it'; } };
  speaking=btn; btn.classList.add('on'); btn.textContent='\\u25a0 stop';
  speechSynthesis.speak(u);
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

function renderHome(){
  var el=document.getElementById('grid'); el.innerHTML='';
  var g=groups();
  var names=Object.keys(g);
  Object.keys(chats).forEach(function(n){ if(names.indexOf(n)<0) names.push(n); });
  if(!names.length){ el.innerHTML='<div class="state">Nothing yet — chats appear here as they finish replies.</div>'; return; }
  names.sort(function(a,b){
    var la=(g[a]&&g[a][g[a].length-1].created)||'', lb=(g[b]&&g[b][g[b].length-1].created)||'';
    return la<lb?1:-1;
  });
  var grid=document.createElement('div'); grid.id='chatgrid'; el.appendChild(grid);
  names.forEach(function(name){
    var list=g[name]||[];
    var last=list.length? list[list.length-1] : null;
    var unread=last && last.from!=='sophie' && (seen[name]||'')<(last.created||'');
    var b=document.createElement('button'); b.className='tile';
    b.innerHTML='<span class="t-cover">'+iconHtml(name)+(unread?'<span class="t-new"></span>':'')+'</span>'
      +'<span class="t-name">'+esc(name)+'</span>'
      +'<span class="t-meta">'+(last? ago(last.created) : 'no messages')+'</span>';
    b.onclick=function(){ openChat(name); };
    grid.appendChild(b);
  });
}

function renderMsg(m){
  var row=document.createElement('div'); row.className='msg';
  var firstLine=(m.tldr||m.text||'').split('\\n')[0].slice(0,140);
  row.innerHTML='<div class="m-head"><span class="m-chat'+(m.from==='sophie'?' sophie':'')+'">'
    +(m.from==='sophie'?'me':'claude')+'</span><span class="m-time">'+ago(m.created)+'</span></div>'
    +'<div class="m-preview">'+esc(firstLine)+((m.text||'').length>140?'\\u2026':'')+'</div>'
    +'<div class="m-full">'+esc(m.text)+'</div>';
  var tools=document.createElement('div'); tools.className='m-tools';
  var hear=document.createElement('button'); hear.className='tbtn'; hear.innerHTML='\\u25b6 hear it';
  hear.onclick=function(e){ e.stopPropagation(); speak(m.text,hear); };
  tools.appendChild(hear);
  if(m.audioUrl){ var au=document.createElement('audio'); au.controls=true; au.preload='none'; au.src=m.audioUrl; tools.appendChild(au); }
  row.appendChild(tools);
  row.querySelector('.m-preview').onclick=function(){ row.classList.add('open'); };
  row.querySelector('.m-full').onclick=function(){ row.classList.remove('open'); };
  return row;
}

function openChat(name, keepScroll){
  cur=name;
  var sec=document.getElementById('thread'); sec.innerHTML='';
  var head=document.createElement('header');
  head.innerHTML='<div class="no">chats</div>'
    +'<div class="thread-head">'+iconHtml(name)+'<h1 style="margin:0">'+esc(name)+'</h1></div>'
    +'<button class="seticon">change picture</button><div class="rule"></div>';
  head.querySelector('.seticon').onclick=function(){ setIcon(name); };
  sec.appendChild(head);
  var list=(groups()[name])||[];
  if(!list.length) sec.appendChild(Object.assign(document.createElement('div'),{className:'state',textContent:'No messages yet.'}));
  list.forEach(function(m){ sec.appendChild(renderMsg(m)); });
  markSeen(name);
  document.getElementById('home').style.display='none';
  sec.style.display='';
  document.body.classList.add('reading');
  if(!keepScroll) window.scrollTo(0,document.body.scrollHeight);
}
function goHome(){
  cur=null;
  if(speaking){ speechSynthesis.cancel(); speaking=null; }
  document.getElementById('thread').style.display='none';
  document.getElementById('home').style.display='';
  document.body.classList.remove('reading');
  renderHome();
  window.scrollTo(0,0);
}
document.getElementById('back').onclick=goHome;

function load(){
  api('/api/chatfeed').then(function(r){return r.json()}).then(function(data){
    chats=data.chats||{}; msgs=data.messages||[];
    if(cur){ var y=window.scrollY; openChat(cur,true); window.scrollTo(0,y); } else renderHome();
  }).catch(function(){
    if(!cur) document.getElementById('grid').innerHTML='<div class="state">Couldn\\u2019t reach the feed.</div>';
  });
}
document.getElementById('rsend').onclick=function(){
  var text=document.getElementById('rtext').value.trim();
  if(!text||!cur) return;
  api('/api/chatfeed/reply',{method:'POST',body:JSON.stringify({chat:cur,text:text})})
    .then(function(r){return r.json()})
    .then(function(d){ if(!d.ok) throw 0; document.getElementById('rtext').value=''; toast('Sent \\u2014 '+cur+' will see it on its next check'); load(); })
    .catch(function(){ toast('Couldn\\u2019t send'); });
};
load();
setInterval(function(){
  if(document.getElementById('rtext').value) return;
  if(cur && document.querySelector('.msg.open')) return;
  load();
}, 60000);
})();
</script>
"""

page = page.replace('__FONT__', font)
out = os.path.join(ROOT, 'public', 'chats.html')
open(out, 'w', encoding='utf-8').write(page)
print('built public/chats.html', round(len(page) / 1024), 'KB')
