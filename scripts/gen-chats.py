#!/usr/bin/env python3
# The Chat app — public/chats.html, served gated at /chats.
# Feed of every project chat's replies (posted by standing CLAUDE.md rule),
# grouped by chat with picture icons, collapsed to first lines, free
# device-voice read-aloud on every message, polished memos when attached,
# and a reply box whose messages chats pick up on their hourly checks.
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
.msg{display:flex; gap:12px; padding:14px 0; border-bottom:1px solid var(--line); align-items:flex-start;}
.avatar{width:42px; height:42px; border-radius:50%; object-fit:cover; background:var(--line); flex:none; border:none; padding:0; cursor:pointer;
  display:flex; align-items:center; justify-content:center; font-family:-apple-system,sans-serif; font-size:15px; color:var(--ink2);}
.m-body{flex:1; min-width:0;}
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
.replybar{position:fixed; left:0; right:0; bottom:0; background:color-mix(in srgb, var(--barbg) 94%, transparent); backdrop-filter:blur(6px);
  border-top:1px solid var(--line); padding:10px max(4vw,12px) calc(10px + env(safe-area-inset-bottom)); display:flex; gap:8px;}
.replybar select{font-family:-apple-system,sans-serif; font-size:12px; border:1px solid var(--line); border-radius:6px; background:var(--barbg); color:var(--ink); padding:8px; max-width:34%;}
.replybar input{flex:1; font-family:'EBGaramond',Georgia,serif; font-size:17px; border:1px solid var(--line); border-radius:6px; background:var(--barbg); color:var(--ink); padding:8px 10px; min-width:0;}
.replybar button{font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.06em; text-transform:uppercase;
  border:1px solid var(--rose); color:var(--rose); background:var(--barbg); border-radius:6px; padding:8px 14px; cursor:pointer;}
#toast{position:fixed; bottom:calc(64px + env(safe-area-inset-bottom)); left:50%; transform:translateX(-50%);
  background:var(--ink); color:var(--paper); font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.06em;
  padding:8px 14px; border-radius:6px; opacity:0; transition:opacity .25s; pointer-events:none;}
@media (prefers-reduced-motion: reduce){ #toast{transition:none;} }
</style>
<div class="wrap">
  <header>
    <div class="no">deck factory &middot; every chat, one place</div>
    <h1>Chats</h1>
    <div class="rule"></div>
  </header>
  <div id="feed"><div class="state">Loading&hellip;</div></div>
</div>
<div class="replybar">
  <select id="rchat"></select>
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
var chats={}, speaking=null;

function speak(text,btn){
  if(!('speechSynthesis' in window)){ toast('Voice not available here'); return; }
  if(speaking===btn){ speechSynthesis.cancel(); speaking=null; btn.classList.remove('on'); btn.textContent='\\u25b6 hear it'; return; }
  speechSynthesis.cancel();
  document.querySelectorAll('.tbtn.on').forEach(function(b){ b.classList.remove('on'); b.textContent='\\u25b6 hear it'; });
  var u=new SpeechSynthesisUtterance(text);
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

function render(data){
  chats=data.chats||{};
  var feed=document.getElementById('feed'); feed.innerHTML='';
  var msgs=data.messages||[];
  if(!msgs.length){ feed.innerHTML='<div class="state">Nothing yet — messages appear here as chats finish replies.</div>'; }
  msgs.forEach(function(m){
    var row=document.createElement('div'); row.className='msg';
    var av=document.createElement('button'); av.className='avatar'; av.title='Tap to set this chat\\u2019s picture';
    var icon=chats[m.chat]&&chats[m.chat].icon;
    if(icon){ var im=document.createElement('img'); im.src=icon; im.className='avatar'; im.style.cursor='pointer'; im.onclick=function(){setIcon(m.chat)}; row.appendChild(im); }
    else { av.textContent=(m.chat||'?').slice(0,2).toUpperCase(); av.onclick=function(){setIcon(m.chat)}; row.appendChild(av); }
    var body=document.createElement('div'); body.className='m-body';
    var firstLine=(m.tldr||m.text||'').split('\\n')[0].slice(0,140);
    body.innerHTML='<div class="m-head"><span class="m-chat'+(m.from==='sophie'?' sophie':'')+'">'
      +(m.from==='sophie'?'me \\u2192 ':'')+esc(m.chat)+'</span><span class="m-time">'+ago(m.created)+'</span></div>'
      +'<div class="m-preview">'+esc(firstLine)+((m.text||'').length>140?'\\u2026':'')+'</div>'
      +'<div class="m-full">'+esc(m.text)+'</div>';
    var tools=document.createElement('div'); tools.className='m-tools';
    var hear=document.createElement('button'); hear.className='tbtn'; hear.innerHTML='\\u25b6 hear it';
    hear.onclick=function(e){ e.stopPropagation(); speak(m.text,hear); };
    tools.appendChild(hear);
    if(m.audioUrl){ var au=document.createElement('audio'); au.controls=true; au.preload='none'; au.src=m.audioUrl; tools.appendChild(au); }
    body.appendChild(tools);
    body.querySelector('.m-preview').onclick=function(){ row.classList.add('open'); };
    body.querySelector('.m-full').onclick=function(){ row.classList.remove('open'); };
    row.appendChild(body);
    feed.appendChild(row);
  });
  // reply target options
  var sel=document.getElementById('rchat'); sel.innerHTML='';
  var names={}; msgs.forEach(function(m){ if(m.from!=='sophie') names[m.chat]=1; });
  Object.keys(names).sort().forEach(function(n){
    var o=document.createElement('option'); o.value=n; o.textContent=n; sel.appendChild(o);
  });
  if(!sel.children.length){ var o=document.createElement('option'); o.value='general'; o.textContent='general'; sel.appendChild(o); }
}

function load(){
  api('/api/chatfeed').then(function(r){return r.json()}).then(render)
    .catch(function(){ document.getElementById('feed').innerHTML='<div class="state">Couldn\\u2019t reach the feed.</div>'; });
}
document.getElementById('rsend').onclick=function(){
  var text=document.getElementById('rtext').value.trim();
  var chat=document.getElementById('rchat').value;
  if(!text) return;
  api('/api/chatfeed/reply',{method:'POST',body:JSON.stringify({chat:chat,text:text})})
    .then(function(r){return r.json()})
    .then(function(d){ if(!d.ok) throw 0; document.getElementById('rtext').value=''; toast('Sent \\u2014 '+chat+' will see it on its next check'); load(); })
    .catch(function(){ toast('Couldn\\u2019t send'); });
};
load();
setInterval(load, 60000);
})();
</script>
"""

page = page.replace('__FONT__', font)
out = os.path.join(ROOT, 'public', 'chats.html')
open(out, 'w', encoding='utf-8').write(page)
print('built public/chats.html', round(len(page) / 1024), 'KB')
