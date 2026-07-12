#!/usr/bin/env python3
# The Wall — public/wall.html, served gated at /wall.
# One live feed of everything every chat produced: generated images, movie
# panels, zine pages, dream comics (deckfactory Storage) plus the story
# boards' art (membry Storage), newest first, via /api/wall. Images load as
# small server-side thumbnails (/api/story/thumb); tap for full resolution.
import base64, os

ROOT = os.path.join(os.path.dirname(__file__), '..')
font = base64.b64encode(open(os.path.join(ROOT, 'ios', 'ImageForge', 'EBGaramond.ttf'), 'rb').read()).decode()

page = """<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>The Wall — everything the chats made</title>
<style>
@font-face{font-family:'EBGaramond';font-weight:400 700;font-display:swap;src:url(data:font/ttf;base64,__FONT__) format('truetype');}
:root{ --paper:#f6f2e9; --ink:#26221c; --ink2:#8a8377; --line:#d9d2c2; --rose:#a5586a; --chg:#b3443f; --barbg:#fffdf7; }
@media (prefers-color-scheme: dark){:root{--paper:#191713; --ink:#e8e2d6; --ink2:#97907f; --line:#37322a; --rose:#c98a99; --chg:#e08b84; --barbg:#211e19;}}
:root[data-theme="dark"]{--paper:#191713; --ink:#e8e2d6; --ink2:#97907f; --line:#37322a; --rose:#c98a99; --chg:#e08b84; --barbg:#211e19;}
:root[data-theme="light"]{--paper:#f6f2e9; --ink:#26221c; --ink2:#8a8377; --line:#d9d2c2; --rose:#a5586a; --chg:#b3443f; --barbg:#fffdf7;}
html{background:var(--paper);}
body{margin:0; touch-action:manipulation; background:var(--paper); color:var(--ink); font-family:'EBGaramond',Georgia,serif;}
.wrap{max-width:34em; margin:0 auto; padding:5vh 5vw 12vh;}
.no{font-family:-apple-system,'Helvetica Neue',sans-serif; font-size:11px; letter-spacing:.34em; color:var(--ink2); text-transform:uppercase;}
h1{font-weight:600; font-size:2.3em; line-height:1; margin:.15em 0 .3em;}
.rule{height:1px; background:var(--line); margin:1em 0 1.2em;}
.state{font-style:italic; color:var(--ink2); text-align:center; padding:4em 0;}
.daymark{font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.3em; color:var(--ink2); text-transform:uppercase; margin:1.8em 0 .8em;}
.grid{display:grid; grid-template-columns:repeat(3,1fr); gap:8px;}
.cell{position:relative; border:none; background:none; padding:0; cursor:pointer;}
.cell img{width:100%; aspect-ratio:1; object-fit:cover; border-radius:4px; display:block; border:1px solid var(--line); box-sizing:border-box; background:var(--barbg);}
.cell .tag{position:absolute; left:4px; bottom:4px; font-family:-apple-system,sans-serif; font-size:8px; letter-spacing:.05em;
  color:#fff; background:rgba(20,18,14,.55); padding:1px 5px; border-radius:3px; max-width:85%; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;}
.cell .new{position:absolute; top:5px; right:5px; width:9px; height:9px; border-radius:50%; background:var(--rose);}
#lightbox{position:fixed; inset:0; background:rgba(15,13,10,.93); z-index:20; display:none; align-items:center; justify-content:center; padding:16px; flex-direction:column; gap:10px;}
#lightbox img{max-width:100%; max-height:86vh; border-radius:6px;}
#lightbox .cap{font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.1em; color:#d8d2c6; text-transform:uppercase;}
#more{display:block; margin:1.6em auto 0; font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.08em; text-transform:uppercase;
  border:1px solid var(--line); background:var(--barbg); color:var(--ink); border-radius:6px; padding:9px 16px; cursor:pointer;}
</style>
<div class="wrap">
  <header>
    <div class="no">deck factory &middot; everything the chats made</div>
    <h1>The Wall</h1>
    <div class="rule"></div>
  </header>
  <div id="feed"><div class="state">Loading&hellip;</div></div>
  <button id="more" style="display:none">Show more</button>
</div>
<div id="lightbox"></div>
<script>
(function(){
var TOKEN='__STUDIO_TOKEN__';
function api(path){ return fetch(path,{headers:{'x-studio-token':TOKEN}}); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function thumb(u){ return '/api/story/thumb?w=480&url='+encodeURIComponent(u); }
var lastSeen='';
try{ lastSeen=localStorage.getItem('wall-seen-v1')||''; }catch(e){}
var all=[], shown=0, PAGE=60;

function dayLabel(iso){
  var d=new Date(iso), now=new Date();
  var days=Math.floor((now-d)/86400000);
  if(d.toDateString()===now.toDateString()) return 'TODAY';
  if(days<2 && new Date(now-86400000).toDateString()===d.toDateString()) return 'YESTERDAY';
  return (d.getMonth()+1)+'/'+d.getDate();
}
function render(){
  var feed=document.getElementById('feed');
  feed.innerHTML='';
  if(!all.length){ feed.innerHTML='<div class="state">Nothing on the wall yet.</div>'; return; }
  var curDay=null, grid=null;
  all.slice(0,shown).forEach(function(im){
    var day=dayLabel(im.created);
    if(day!==curDay){
      curDay=day;
      var dm=document.createElement('div'); dm.className='daymark'; dm.textContent=day; feed.appendChild(dm);
      grid=document.createElement('div'); grid.className='grid'; feed.appendChild(grid);
    }
    var cell=document.createElement('button'); cell.className='cell';
    cell.innerHTML='<img alt="" loading="lazy" src="'+esc(thumb(im.url))+'">'
      +'<span class="tag">'+esc(im.folder)+'</span>'
      +(lastSeen && im.created>lastSeen ? '<span class="new"></span>':'');
    cell.onclick=function(){
      var lb=document.getElementById('lightbox');
      lb.innerHTML='<img alt="" src="'+esc(im.url)+'"><div class="cap">'+esc(im.folder)+' \\u00b7 '+esc(new Date(im.created).toLocaleDateString())+'</div>';
      lb.style.display='flex';
      lb.onclick=function(){ lb.style.display='none'; lb.innerHTML=''; };
    };
    grid.appendChild(cell);
  });
  document.getElementById('more').style.display = shown<all.length ? '' : 'none';
}
document.getElementById('more').onclick=function(){ shown=Math.min(all.length, shown+PAGE); render(); };
function load(){
  api('/api/wall?limit=500').then(function(r){return r.json()}).then(function(d){
    all=d.images||[];
    if(!shown) shown=Math.min(all.length, PAGE);
    render();
    // mark seen AFTER first paint so the NEW dots show once, then clear next visit
    if(all.length){ try{ localStorage.setItem('wall-seen-v1', all[0].created); }catch(e){} }
  }).catch(function(){ document.getElementById('feed').innerHTML='<div class="state">Couldn\\u2019t reach the studio.</div>'; });
}
load();
setInterval(load, 60000);
})();
</script>
"""

page = page.replace('__FONT__', font)
out = os.path.join(ROOT, 'public', 'wall.html')
open(out, 'w', encoding='utf-8').write(page)
print('built public/wall.html', round(len(page) / 1024), 'KB')
