#!/usr/bin/env python3
# Story Room — THE story surface (July 2026: Story Boards + the Stories
# library merged in here). One shelf of every story; a story doc can hold any
# mix of title / cover / prose (`text`) / whole-story voiceover
# (`voiceover:{url,text}`) / beats+art — any one field starts a project.
# Generates public/storyroom.html (served gated at /storyroom). Content is
# fetched LIVE from /api/story on every open, so board changes need no deploy
# at all. Notes reuse /api/writing/notes with keys "story-<project>:b<beat>"
# so any chat can read and apply them.
import base64, os
from pill import PILL_CSS, PILL_HTML, PILL_JS

ROOT = os.path.join(os.path.dirname(__file__), '..')
font = base64.b64encode(open(os.path.join(ROOT, 'ios', 'ImageForge', 'EBGaramond.ttf'), 'rb').read()).decode()

page = """<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>Story Room — the movie boards</title>
<style>
@font-face{font-family:'EBGaramond';font-weight:400 700;font-display:swap;src:url(data:font/ttf;base64,__FONT__) format('truetype');}
:root{ --paper:#f6f2e9; --ink:#26221c; --ink2:#8a8377; --line:#d9d2c2; --rose:#a5586a; --chg:#b3443f;
  --ok:#5d7a5a; --cand:#a3822f; --barbg:#fffdf7; }
@media (prefers-color-scheme: dark){:root{--paper:#191713; --ink:#e8e2d6; --ink2:#97907f; --line:#37322a; --rose:#c98a99; --chg:#e08b84; --ok:#8fae8b; --cand:#c9a95a; --barbg:#211e19;}}
:root[data-theme="dark"]{--paper:#191713; --ink:#e8e2d6; --ink2:#97907f; --line:#37322a; --rose:#c98a99; --chg:#e08b84; --ok:#8fae8b; --cand:#c9a95a; --barbg:#211e19;}
:root[data-theme="light"]{--paper:#f6f2e9; --ink:#26221c; --ink2:#8a8377; --line:#d9d2c2; --rose:#a5586a; --chg:#b3443f; --ok:#5d7a5a; --cand:#a3822f; --barbg:#fffdf7;}
html{background:var(--paper);}
body{margin:0; touch-action:manipulation; background:var(--paper); color:var(--ink); font-family:'EBGaramond',Georgia,serif;}
/* Little top padding: the app supplies its own "STORY ROOM" nav title right
   above this, so a tall pad here just left a dead gap before the first row. */
.wrap{max-width:34em; margin:0 auto; padding:1.4vh 6vw 22vh;}
.no{font-family:-apple-system,'Helvetica Neue',sans-serif; font-size:11px; letter-spacing:.34em; color:var(--ink2); text-transform:uppercase;}
h1{font-weight:600; font-size:2.5em; line-height:1; margin:.15em 0 .3em;}
.rule{height:1px; background:var(--line); margin:1.1em 0;}
.sub{font-style:italic; color:var(--ink2); margin-bottom:2em;}
.shelfgrid{display:grid; grid-template-columns:repeat(3,1fr); gap:20px 14px;}
/* Covers align across a row no matter how many lines a title wraps to: tiles
   are TOP-aligned (equal-width + 5/7 covers, so every cover bottom lands on
   the same line) and the name block reserves two lines so the meta under it
   lines up too. */
.shelfrow{display:grid; grid-template-columns:repeat(3,1fr); gap:20px 14px; align-items:start;}
.shelfline{height:1px; background:var(--line); margin:12px 0 22px;}
.prose{font-size:19px; line-height:1.7; margin:0 0 1em; white-space:pre-wrap;}
.vosec audio{width:100%; display:block; margin:.4em 0 .8em;}
.voscript{font-style:italic; color:var(--ink2); font-size:16.5px; line-height:1.6; margin:.2em 0 .8em; white-space:pre-wrap;}
.voerr{color:var(--chg); font-family:-apple-system,sans-serif; font-size:12px; margin:.4em 0;}
.tile{display:flex; flex-direction:column; gap:0; background:none; border:none; padding:0; cursor:pointer;
  color:var(--ink); font-family:'EBGaramond',Georgia,serif; text-align:center; min-width:0;}
.tile:focus-visible{outline:2px solid var(--rose); border-radius:4px;}
.t-cover{display:block; aspect-ratio:5/7; border:1px solid var(--line); background:var(--barbg); border-radius:4px; overflow:hidden;}
.t-cover img{width:100%; height:100%; object-fit:cover; display:block;}
.t-blank{display:flex; align-items:center; justify-content:center;}
.t-blank span{font-size:2.2em; font-style:italic; color:var(--ink2);}
.t-name{font-size:1.12em; font-weight:600; line-height:1.15; margin-top:7px; min-height:2.3em;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;}
.t-meta{font-family:-apple-system,sans-serif; font-size:9px; letter-spacing:.14em; color:var(--ink2); text-transform:uppercase; margin-top:2px;}
.r-notes{font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.08em; color:var(--rose); display:block; margin-top:1px;}
.pagemark{font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.3em; color:var(--ink2); margin:3em 0 1.2em; text-transform:uppercase;}
.vo{font-size:19px; line-height:1.7; margin:0 0 1em;}
.vo.none{font-style:italic; color:var(--ink2); font-size:16px;}
.cards{display:grid; grid-template-columns:repeat(2,1fr); gap:18px 16px; margin:0 0 .8em;}
.card{margin:0;}
.card img{width:100%; display:block; border-radius:4px;}
.card .ph{width:100%; aspect-ratio:1/1; border:1px dashed var(--line); border-radius:4px; display:flex; align-items:center; justify-content:center;
  color:var(--ink2); font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.1em; text-transform:uppercase;}
.card figcaption{font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--ink2); text-align:center; margin-top:6px;}
.st{display:inline-block; margin-left:6px; background:none; border:none; font:inherit; letter-spacing:inherit; text-transform:inherit; cursor:pointer; padding:2px 4px; border-radius:4px;}
.st:focus-visible{outline:2px solid var(--rose);}
.st.ok{color:var(--ok);} .st.cand{color:var(--cand);} .st.draft{color:var(--ink2);} .st.miss{color:var(--chg);}
.addnote{display:block; margin:.2em 0 0 auto; background:none; border:none; color:var(--ink2); opacity:.55;
  font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.12em; text-transform:uppercase; cursor:pointer; padding:4px 2px;}
.addnote:focus-visible{outline:2px solid var(--rose); border-radius:4px;}
.archrow{display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 0; border-bottom:1px solid var(--line);}
.archname{flex:1; text-align:left; background:none; border:none; color:var(--ink2); font-family:'EBGaramond',Georgia,serif; font-size:1.05em; cursor:pointer; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.notehead{display:flex; align-items:center; justify-content:flex-end; gap:8px; margin-bottom:6px;}
.micbtn{width:38px; height:32px; border-radius:6px; border:1px solid var(--line); background:var(--barbg); color:var(--ink2); cursor:pointer; display:flex; align-items:center; justify-content:center;}
.micbtn.rec{background:color-mix(in srgb, var(--chg) 20%, var(--paper)); border-color:var(--chg); color:var(--chg);}
.miclbl{font-family:-apple-system,sans-serif; font-size:11px; color:var(--ink2);}
.notebox textarea{width:100%; box-sizing:border-box; min-height:70px; font-family:'EBGaramond',Georgia,serif; font-size:17px;
  background:var(--barbg); color:var(--ink); border:1px solid var(--line); border-radius:6px; padding:10px;}
.noteactions{display:flex; gap:8px; margin-top:6px;}
.btn{font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.08em; text-transform:uppercase;
  border:1px solid var(--line); background:var(--barbg); color:var(--ink); border-radius:6px; padding:8px 14px; cursor:pointer;}
.btn.primary{border-color:var(--rose); color:var(--rose);}
.savednote{margin:.5em 0 1.4em; padding:.1em 0 .1em 1em; border-left:2px solid var(--rose); color:var(--rose); font-style:italic; font-size:16.5px; line-height:1.55; white-space:pre-wrap;}
.savednote .del{background:none; border:none; color:var(--ink2); font-size:11px; cursor:pointer; margin-left:8px; font-family:-apple-system,sans-serif; text-transform:uppercase; letter-spacing:.1em;}
.endmark{text-align:center; color:var(--ink2); margin-top:3.5em; font-size:1.2em;}
.state{font-style:italic; color:var(--ink2); text-align:center; padding:4em 0;}
.player{width:100%; border-radius:6px; background:#000; display:block;}
.tabs{display:flex; gap:8px; padding:12px 62px 12px 58px; position:sticky; top:0; z-index:5;
  background:color-mix(in srgb, var(--paper) 93%, transparent); backdrop-filter:blur(6px);}
.seg{flex:1; display:flex; border:1.5px solid var(--ink); border-radius:999px; overflow:hidden; background:var(--paper);}
.tab{flex:1; font-family:-apple-system,'Helvetica Neue',sans-serif; font-size:12px; letter-spacing:.1em; text-transform:uppercase;
  border:none; background:transparent; color:var(--ink); padding:9px 0; cursor:pointer;}
.tab + .tab{border-left:1.5px solid var(--ink);}
.tab.on{background:color-mix(in srgb, var(--chg) 18%, var(--paper)); font-weight:600;}
.zgrid{display:grid; grid-template-columns:repeat(4,1fr); gap:8px;}
.zgrid.z8{grid-template-columns:repeat(8,1fr); gap:4px;}
.zcell{position:relative; margin:0; cursor:pointer; border:none; background:none; padding:0;}
.zcell img{width:100%; aspect-ratio:5/7; object-fit:cover; border-radius:4px; display:block;}
.zcell .zph{width:100%; aspect-ratio:5/7; border:1px dashed var(--line); border-radius:4px; box-sizing:border-box;}
.zcell .zno{position:absolute; left:3px; bottom:3px; font-family:-apple-system,sans-serif; font-size:9px;
  color:#fff; background:rgba(20,18,14,.55); padding:1px 4px; border-radius:3px; letter-spacing:.06em;}
.zoombtn{margin:0 0 12px auto; display:block;}
#lightbox{position:fixed; inset:0; background:rgba(15,13,10,.92); z-index:20; display:none; align-items:center; justify-content:center; padding:20px;}
#lightbox img{max-width:100%; max-height:90vh; border-radius:6px;}
.cutrow{display:flex; align-items:baseline; gap:10px; width:100%; text-align:left; background:none; border:none;
  border-bottom:1px solid var(--line); padding:12px 2px; cursor:pointer; color:var(--ink); font-family:'EBGaramond',Georgia,serif;}
.cutrow.on .c-name{color:var(--rose); font-weight:600;}
.cutrow:focus-visible{outline:2px solid var(--rose);}
.c-name{font-size:1.05em; flex:1;}
.c-meta{font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.1em; color:var(--ink2); text-transform:uppercase;}
.newrow{display:flex; gap:8px; margin:0 0 1.6em; flex-wrap:wrap;}
/* Search sits level with the floating autoscroll pill, so it stops 52px short
   of the right edge — a control under the pill's corner is untappable. */
.searchbar{display:block; width:calc(100% - 52px); box-sizing:border-box; -webkit-appearance:none; appearance:none;
  font-family:'EBGaramond',Georgia,serif; font-size:18px; background:var(--barbg); color:var(--ink);
  border:1px solid var(--line); border-radius:6px; padding:9px 12px; margin:0 0 12px;}
.searchbar::placeholder{color:var(--ink2); font-style:italic;}
.searchbar:focus{outline:none; border-color:var(--rose);}
.modal{position:fixed; inset:0; background:rgba(15,13,10,.55); z-index:30; display:flex; align-items:center; justify-content:center; padding:20px;}
.sheet{background:var(--paper); border:1px solid var(--line); border-radius:10px; padding:20px; width:100%; max-width:23em; max-height:82vh; overflow:auto; box-shadow:0 8px 30px rgba(0,0,0,.22);}
.sheet h2{font-size:1.5em; font-weight:600; margin:0 0 .7em;}
.field{width:100%; box-sizing:border-box; font-family:'EBGaramond',Georgia,serif; font-size:18px; background:var(--barbg); color:var(--ink); border:1px solid var(--line); border-radius:6px; padding:10px; margin-bottom:12px;}
textarea.field{min-height:80px; line-height:1.5;}
.filelbl{display:block; font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink2); margin-bottom:14px;}
.filelbl input{display:block; margin-top:8px; font-family:inherit; color:var(--ink);}
.sheetact{display:flex; gap:8px; justify-content:flex-end; margin-top:4px;}
.pickrow{display:block; width:100%; text-align:left; margin-bottom:6px;}
/* The Summary — the story's key moments with arrows between, at a glance */
.sumrow{display:flex; flex-wrap:wrap; align-items:center; gap:8px 4px; margin:0 0 1.4em;}
.sumcard{flex:0 0 26%; min-width:0; display:flex; flex-direction:column; gap:5px; background:none; border:none; padding:0; cursor:pointer;
  color:var(--ink); font-family:'EBGaramond',Georgia,serif;}
.sumcard:focus-visible{outline:2px solid var(--rose); border-radius:4px;}
.sumcard img{width:100%; aspect-ratio:5/7; object-fit:cover; border-radius:4px; display:block; border:1px solid var(--line); box-sizing:border-box;}
.sumcard .sph{width:100%; aspect-ratio:5/7; border:1px dashed var(--line); border-radius:4px; box-sizing:border-box;}
.sumlbl{font-size:.95em; line-height:1.2; text-align:center;
  display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;}
.sumarrow{flex:0 0 auto; font-size:1.25em; color:var(--ink2);}
__PILL_CSS__
/* Back to the shelf. It used to float (position:fixed) over the page, which
   landed it right on top of a story's eyebrow line and hid the first words —
   so it lives INLINE at the start of that line. But inline-only meant it
   scrolled away the moment you read past the title and there was no way back
   without scrolling all the way up, so the row is STICKY: it rides the top of
   the screen for the whole story, and content scrolls under it rather than
   behind it. It must be a direct child of the section (NOT inside <header>) —
   a sticky element only sticks within its own parent's box, so nesting it in
   the header would unstick it as soon as the header scrolled past.
   The side bleed re-paints .wrap's 6vw padding so nothing shows through. */
.eyebrowrow{display:flex; align-items:center; gap:10px;
  position:sticky; top:0; z-index:8; background:var(--paper);
  margin:0 -6vw; padding:8px 6vw;}
.backbtn{flex:0 0 auto; width:40px; height:40px; border-radius:6px; border:1px solid var(--line);
  background:var(--barbg); color:var(--ink2); font-size:20px; line-height:1; cursor:pointer;
  display:flex; align-items:center; justify-content:center; padding:0;}
.backbtn:focus-visible{outline:2px solid var(--rose);}
#toast{position:fixed; bottom:max(20px, env(safe-area-inset-bottom)); left:50%; transform:translateX(-50%);
  background:var(--ink); color:var(--paper); font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.06em;
  padding:8px 14px; border-radius:6px; opacity:0; transition:opacity .25s; pointer-events:none;}
@media (prefers-reduced-motion: reduce){ #toast{transition:none;} }
</style>
__PILL_HTML__
<div class="wrap">
  <section id="home">
    <input id="storysearch" class="searchbar" type="search" placeholder="Search stories&hellip;" autocomplete="off">
    <div class="newrow"><button id="newstory" class="btn primary">+ New story</button><button class="btn" onclick="location.href='/character'">Characters</button><button id="filmsbtn" class="btn" style="display:none">Films</button></div>
    <div id="shelf"><div class="state">Loading the boards&hellip;</div></div>
  </section>
  <section id="proj" style="display:none"></section>
</div>
<div id="lightbox"></div>
<div id="toast"></div>
<script>
(function(){
var TOKEN='__STUDIO_TOKEN__';
function api(path,opt){ opt=opt||{}; opt.headers=Object.assign({'x-studio-token':TOKEN,'Content-Type':'application/json'},opt.headers||{}); return fetch(path,opt); }
function toast(m){ var t=document.getElementById('toast'); t.textContent=m; t.style.opacity=1; setTimeout(function(){t.style.opacity=0},1800); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

var projects=[], notes={}, cur=null, homeY=0, query='';
// Films (forge-movies docs) grouped by the story they belong to. A film with
// no story — dream experiments, tests — waits behind the home's Films button
// instead of cluttering the shelf (Sophie's rule, Aug 2026).
var filmsByStory={}, unmatchedFilms=[];
var voTimer=null, drawVoCur=null;
// A voiceover render/transcription is a server-side background job recorded
// on the doc — poll the boards until voiceover.status clears (survives
// leaving the page: reopening the project re-arms this from the doc).
// ── Native paste-a-recording callbacks (app only) ──
// The app reads the clipboard audio and POSTs it to /api/story/voiceover
// itself, so megabytes of audio never cross into JavaScript; it just tells us
// how it went. window.__voPasteTarget holds the project it was started for.
window.__pasteVoStart=function(){ toast('Reading the recording\\u2026'); };
window.__pasteVoEmpty=function(){ toast('No recording on the clipboard — in Voice Memos: Share \\u2192 Copy'); };
window.__pasteVoError=function(msg){ toast(String(msg||'Could not read that recording').slice(0,70)); };
window.__pasteVoDone=function(){
  toast('Voiceover added');
  var pid=window.__voPasteTarget;
  if(cur&&pid&&cur.id===pid) reloadProject(pid); else if(cur) reloadProject(cur.id);
};
function pollVo(pid){
  clearInterval(voTimer);
  voTimer=setInterval(function(){
    api('/api/story').then(function(r){return r.json()}).then(function(res){
      if(!cur||cur.id!==pid){ clearInterval(voTimer); return; }
      var p2=((res&&res.projects)||[]).filter(function(x){return x.id===pid})[0];
      if(!p2){ clearInterval(voTimer); return; }
      cur.voiceover=p2.voiceover||null;
      if(drawVoCur) drawVoCur();
      if(!(p2.voiceover&&p2.voiceover.status)){
        clearInterval(voTimer);
        toast(p2.voiceover&&p2.voiceover.error? 'Voiceover failed':'Voiceover ready');
      }
    }).catch(function(){});
  },6000);
}
var STATUS={ok:'approved', cand:'candidate', draft:'storyboard', miss:'no art yet'};
// some boards store the full words — fold them back to the short codes
var NORM={approved:'ok', candidate:'cand', storyboard:'draft', 'no art yet':'miss'};

// grid cells and shelf covers load small server-side thumbnails (the raw
// card images are ~3MB PNGs); the beats view keeps the full-res originals
function thumb(u,w){
  if(!u || u.slice(0,5)==='data:') return u;
  return '/api/story/thumb?w='+(w||480)+'&url='+encodeURIComponent(u);
}
function noteKey(pid,bi){ return 'story-'+pid+':b'+bi; }
function docId(id){ return id.replace(/[^a-zA-Z0-9_-]/g,'_'); }
function noteText(id){ var n=notes[id]; return (typeof n==='string')? n : (n&&n.t||''); }
function noteAudio(id){ var n=notes[id]; return (n&&typeof n==='object'&&n.a)||null; }
function syncNote(id, excerpt){
  var n=notes[id];
  if(n===undefined){ api('/api/writing/notes/'+docId(id),{method:'DELETE'}).catch(function(){}); return; }
  var body={ key:id, dateId:id.split(':')[0], blockId:id.split(':')[1], version:'c',
    excerpt:excerpt||'', text:noteText(id) };
  var a=noteAudio(id); if(a && a.slice(0,5)==='data:') body.audio=a;
  api('/api/writing/notes',{method:'POST',body:JSON.stringify(body)})
    .then(function(r){return r.json()})
    .then(function(d){ if(d&&d.audioUrl&&notes[id]&&typeof notes[id]==='object'){ notes[id].a=d.audioUrl; } })
    .catch(function(){ toast('Offline — note kept on this phone'); });
}

function projCover(p){
  if(p.cover) return p.cover;
  var bs=p.beats||[];
  for(var i=0;i<bs.length;i++){ var cs=(bs[i]&&bs[i].cards)||[]; for(var j=0;j<cs.length;j++){ if(cs[j]&&cs[j].url) return cs[j].url; } }
  return '';
}
function setArchived(p,val){
  api('/api/story/project/'+encodeURIComponent(p.id)+'/archive',{method:'POST',body:JSON.stringify({archived:val})})
    .then(function(r){return r.json()})
    .then(function(d){ if(!d.ok) throw 0; p.archived=val; toast(val?'Archived':'Restored'); if(val){ goHome(); } else { renderShelf(); } })
    .catch(function(){ toast('Could not save that'); });
}
function archiveStory(p){ setArchived(p,true); }
function restoreStory(p){ setArchived(p,false); }
// Rows of three with a thin line under each — the shelf, minus the wood.
function shelfRows(container, items, makeTile){
  for(var i=0;i<items.length;i+=3){
    var row=document.createElement('div'); row.className='shelfrow';
    items.slice(i,i+3).forEach(function(it){ row.appendChild(makeTile(it)); });
    container.appendChild(row);
    var line=document.createElement('div'); line.className='shelfline';
    container.appendChild(line);
  }
}
// Search matches everywhere a story keeps words: title, prose, voiceover
// words, beat narrations. Client-side over the loaded list — no requests.
function storyMatches(p){
  if(!query) return true;
  var hay=(p.title||'')+' '+(p.id||'')+' '+(p.text||'')+' '+((p.voiceover&&p.voiceover.text)||'');
  (p.beats||[]).forEach(function(b){ if(b&&b.vo) hay+=' '+b.vo; });
  return hay.toLowerCase().indexOf(query)!==-1;
}
// order climbs as stories are created (server: max+1), so higher = newer;
// stories with no order sort last, same end of the shelf as before.
function storyOrd(p){ return typeof p.order==='number'? p.order : -1; }
function newestFirst(a,b){ return storyOrd(b)-storyOrd(a); }
function renderShelf(){
  var el=document.getElementById('shelf');
  if(!projects.length){ el.innerHTML='<div class="state">No stories yet — tap + New story, or they\\u2019ll appear as projects land in the studio.</div>'; return; }
  el.innerHTML='';
  var active=projects.filter(function(p){return !p.archived&&storyMatches(p);}).sort(newestFirst);
  var archived=projects.filter(function(p){return p.archived&&storyMatches(p);}).sort(newestFirst);
  if(query&&!active.length&&!archived.length){ el.innerHTML='<div class="state">Nothing matches \\u201c'+esc(query)+'\\u201d.</div>'; return; }
  shelfRows(el, active, function(p){
    var beats=(p.beats||[]).length;
    var n=Object.keys(notes).filter(function(id){return id.split(':')[0]==='story-'+p.id}).length;
    var cov=projCover(p);
    var bits=[];
    if(beats) bits.push(beats+(beats===1?' beat':' beats'));
    if(String(p.text||'').trim()) bits.push('story');
    if(p.voiceover&&(p.voiceover.url||p.voiceover.status)) bits.push('voice');
    if((filmsByStory[p.id]||[]).some(function(f){return f.movieUrl;})||(p.draftFilm&&p.draftFilm.url)) bits.push('film');
    if(!bits.length) bits.push('new');
    var b=document.createElement('button'); b.className='tile';
    b.innerHTML=(cov? '<span class="t-cover"><img alt="" loading="lazy" src="'+esc(thumb(cov))+'"></span>'
                        : '<span class="t-cover t-blank"><span>'+esc((p.title||p.id||'?').slice(0,1))+'</span></span>')
      +'<span class="t-name">'+esc(p.title||p.id)+'</span>'
      +'<span class="t-meta">'+esc(bits.join(' · '))
      +(n? '<span class="r-notes">'+n+(n===1?' note':' notes')+'</span>':'')+'</span>';
    b.onclick=function(){ openProj(p); };
    return b;
  });
  if(archived.length){
    var am=document.createElement('div'); am.className='pagemark'; am.textContent='ARCHIVED'; el.appendChild(am);
    archived.forEach(function(p){
      var row=document.createElement('div'); row.className='archrow';
      var nm=document.createElement('button'); nm.className='archname'; nm.textContent=p.title||p.id; nm.onclick=function(){ openProj(p); };
      var rb=document.createElement('button'); rb.className='btn'; rb.textContent='Restore'; rb.onclick=function(){ restoreStory(p); };
      row.appendChild(nm); row.appendChild(rb); el.appendChild(row);
    });
  }
}

function renderNoteInto(wrap,id,excerpt){
  wrap.innerHTML='';
  if(notes[id]!==undefined){
    var d=document.createElement('div'); d.className='savednote'; d.textContent=noteText(id);
    if(noteAudio(id)){ var au=document.createElement('audio'); au.controls=true; au.src=noteAudio(id); au.style.display='block'; au.style.marginTop='6px'; au.style.width='100%'; d.appendChild(au); }
    var del=document.createElement('button'); del.className='del'; del.textContent='remove';
    del.onclick=function(){ delete notes[id]; syncNote(id); renderNoteInto(wrap,id,excerpt); };
    d.appendChild(del); wrap.appendChild(d);
  }
}
function openEditor(wrap,id,excerpt){
  window.__scrollStop();
  if(wrap.querySelector('.notebox')){ wrap.querySelector('textarea').focus(); return; }
  var box=document.createElement('div'); box.className='notebox';
  var head=document.createElement('div'); head.className='notehead';
  var micLbl=document.createElement('span'); micLbl.className='miclbl';
  var mic=document.createElement('button'); mic.className='micbtn'; mic.setAttribute('aria-label','Record a voice note');
  mic.innerHTML='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>';
  head.appendChild(micLbl); head.appendChild(mic);
  var ta=document.createElement('textarea'); ta.value=noteText(id); ta.placeholder='Your note…';
  var pendingAudio=noteAudio(id);
  var acts=document.createElement('div'); acts.className='noteactions';
  var save=document.createElement('button'); save.className='btn primary'; save.textContent='Save';
  var cancel=document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancel';
  var cancelled=false, saved=false, recording=false, mrec=null, lastBoxTouch=0;
  box.addEventListener('pointerdown',function(){ lastBoxTouch=Date.now(); },true);
  function doSave(){
    if(saved||cancelled) return; saved=true;
    var v=ta.value.trim();
    if(v||pendingAudio) notes[id]= pendingAudio? {t:v,a:pendingAudio} : v; else delete notes[id];
    syncNote(id,excerpt); box.remove(); renderNoteInto(wrap,id,excerpt); renderShelfCountsOnly();
  }
  save.onclick=doSave;
  cancel.onmousedown=function(){ cancelled=true; };
  cancel.onclick=function(){ box.remove(); renderNoteInto(wrap,id,excerpt); };
  ta.addEventListener('blur',function(){ setTimeout(function(){
    if(cancelled||saved||recording) return;
    if(Date.now()-lastBoxTouch<600) return;
    if(document.body.contains(box)&&!box.contains(document.activeElement)) doSave();
  },220); });
  mic.onclick=function(){
    if(recording){ mrec.stop(); return; }
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||typeof MediaRecorder==='undefined'){ toast('Mic not available here'); return; }
    navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
      var chunks=[]; mrec=new MediaRecorder(stream);
      mrec.ondataavailable=function(e){ if(e.data.size) chunks.push(e.data); };
      mrec.onstop=function(){
        stream.getTracks().forEach(function(t){t.stop()});
        recording=false; mic.classList.remove('rec'); micLbl.textContent='voice note attached';
        var blob=new Blob(chunks,{type:mrec.mimeType||'audio/webm'});
        if(blob.size>2500000){ toast('Keep voice notes under ~2 min'); return; }
        var r=new FileReader(); r.onload=function(){ pendingAudio=r.result; }; r.readAsDataURL(blob);
      };
      mrec.start(); recording=true; mic.classList.add('rec'); micLbl.textContent='recording… tap to stop';
    }, function(){ toast('Mic not available here'); });
  };
  acts.appendChild(save); acts.appendChild(cancel);
  box.appendChild(head); box.appendChild(ta); box.appendChild(acts);
  wrap.appendChild(box); ta.focus();
}
function renderShelfCountsOnly(){ if(!cur) return; /* refreshed on back */ }

function openProj(p, jumpBeat){
  if(!cur) homeY=window.scrollY;   // remember the shelf spot for back
  window.__scrollStop();
  clearInterval(voTimer);
  cur=p;
  var sec=document.getElementById('proj'); sec.innerHTML='';
  var bar=document.createElement('div'); bar.className='eyebrowrow';
  // The app's native bar already says STORY ROOM — this row is ONLY the way
  // back (one header, no beats count; Sophie, Aug 2026).
  bar.innerHTML='<button class="backbtn" aria-label="Back to the shelf">&#8249;</button>';
  bar.querySelector('.backbtn').onclick=goHome;
  sec.appendChild(bar);
  var head=document.createElement('header');
  head.innerHTML='<h1>'+esc(p.title||p.id)+'</h1><div class="rule"></div>';
  sec.appendChild(head);
  // The title is tappable — a story can be created with no name at all, so
  // naming it happens here, whenever she gets that far.
  var h1=head.querySelector('h1');
  h1.style.cursor='pointer';
  h1.title='Tap to name this story';
  h1.onclick=function(){
    showModal({ title:'Name this story', okLabel:'Save',
      fields:[ {key:'title', type:'text', placeholder:'Story title',
                value:(p.title==='Untitled'? '' : (p.title||''))} ],
      onOk:function(v, close){
        var t=(v.title||'').trim();
        if(!t){ toast('Type a name'); return; }
        api('/api/story/project',{method:'POST',body:JSON.stringify({id:p.id, title:t})})
          .then(function(r){return r.json()})
          .then(function(d){ if(!d.ok) throw new Error(d.error||'failed');
            p.title=t; h1.textContent=t; close(); toast('Named');
          })
          .catch(function(e){ toast('Failed: '+String(e.message||e).slice(0,50)); });
      }
    });
  };
  // Tools: add a beat, dump art, and (when missing) start the prose/voiceover
  var tools=document.createElement('div'); tools.className='newrow';
  var abtn=document.createElement('button'); abtn.className='btn'; abtn.textContent='+ Add beat'; abtn.onclick=function(){ addBeat(p); };
  var dbtn=document.createElement('button'); dbtn.className='btn'; dbtn.textContent='+ Dump art'; dbtn.onclick=function(){ dumpArt(p); };
  var sbtn=document.createElement('button'); sbtn.className='btn'; sbtn.textContent='+ Story'; sbtn.onclick=function(){ editProse(); };
  var dsbtn=document.createElement('button'); dsbtn.className='btn'; dsbtn.textContent='+ Description'; dsbtn.onclick=function(){ editDesc(); };
  var vbtn=document.createElement('button'); vbtn.className='btn'; vbtn.textContent='+ Voiceover'; vbtn.onclick=function(){ voForced=true; drawVo(); voWrap.scrollIntoView({block:'center'}); };
  var smbtn=document.createElement('button'); smbtn.className='btn'; smbtn.textContent='+ Summary'; smbtn.onclick=function(){ editSummary(); };
  tools.appendChild(abtn); tools.appendChild(dbtn); tools.appendChild(sbtn); tools.appendChild(dsbtn); tools.appendChild(vbtn); tools.appendChild(smbtn); sec.appendChild(tools);

  // ── The Summary — the shape of the story at a glance: the few key beats
  // that carry it, with arrows showing they lead into each other. Tap a
  // moment to jump to its beat. ──
  var sumWrap=document.createElement('div'); sec.appendChild(sumWrap);
  function beatArt(bi){
    var b=(p.beats||[])[bi]; if(!b) return '';
    var cs=b.cards||[], pick='';
    ['ok','cand','draft'].some(function(want){
      return cs.some(function(c){ if(c&&c.url&&(NORM[c.status]||c.status)===want){ pick=c.url; return true; } return false; });
    });
    if(!pick) cs.some(function(c){ if(c&&c.url){ pick=c.url; return true; } return false; });
    return pick;
  }
  function sumDefaultLabel(bi){
    var b=(p.beats||[])[bi]; var t=String(b&&b.vo||'').trim();
    return t? t.split(/\\s+/).slice(0,7).join(' ') : 'Beat '+(bi+1);
  }
  function drawSummary(){
    sumWrap.innerHTML='';
    var sm=p.summary||[];
    smbtn.style.display=(sm.length||!((p.beats||[]).length))? 'none':'';
    if(!sm.length) return;
    var pm=document.createElement('div'); pm.className='pagemark'; pm.textContent='SUMMARY';
    var ed=document.createElement('button'); ed.className='st'; ed.textContent='\\u00b7 edit';
    ed.onclick=function(){ editSummary(); };
    pm.appendChild(ed); sumWrap.appendChild(pm);
    var row=document.createElement('div'); row.className='sumrow';
    sm.forEach(function(m,i){
      if(i){ var ar=document.createElement('span'); ar.className='sumarrow'; ar.textContent='\\u2192'; row.appendChild(ar); }
      var c=document.createElement('button'); c.className='sumcard';
      var art=beatArt(m.beat);
      c.innerHTML=(art? '<img alt="" loading="lazy" src="'+esc(thumb(art))+'">' : '<span class="sph"></span>')
        +'<span class="sumlbl">'+esc(m.label||sumDefaultLabel(m.beat))+'</span>';
      c.onclick=function(){ tb.onclick(); var t=beatsView.querySelector('[data-beat="'+m.beat+'"]'); if(t) t.scrollIntoView({block:'start'}); };
      row.appendChild(c);
    });
    sumWrap.appendChild(row);
  }
  function editSummary(){
    var beats=p.beats||[];
    if(!beats.length){ toast('Add beats first'); return; }
    var sel={}; (p.summary||[]).forEach(function(m){ sel[m.beat]=m.label||''; });
    var ov=document.createElement('div'); ov.className='modal';
    var sheet=document.createElement('div'); sheet.className='sheet';
    var h=document.createElement('h2'); h.textContent='The key moments'; sheet.appendChild(h);
    var hint=document.createElement('p'); hint.className='vo none'; hint.style.margin='0 0 .8em'; hint.style.fontSize='15px';
    hint.textContent='Pick the moments that carry the story. They show at the top, in order, with arrows between.';
    sheet.appendChild(hint);
    var list=document.createElement('div'); sheet.appendChild(list);
    function renderList(){
      list.innerHTML='';
      beats.forEach(function(b,bi){
        var on=sel[bi]!==undefined;
        var t=document.createElement('button'); t.className='btn pickrow';
        t.textContent=(on?'\\u2713 ':'')+'Beat '+(bi+1)+(b.vo? ' \\u2014 '+String(b.vo).slice(0,30):'');
        if(on){ t.style.borderColor='var(--rose)'; t.style.color='var(--rose)'; }
        t.onclick=function(){ if(on) delete sel[bi]; else sel[bi]=''; renderList(); };
        list.appendChild(t);
        if(on){
          var inp=document.createElement('input'); inp.className='field'; inp.type='text';
          inp.placeholder=sumDefaultLabel(bi);
          inp.value=sel[bi];
          inp.oninput=function(){ sel[bi]=inp.value; };
          list.appendChild(inp);
        }
      });
    }
    renderList();
    var act=document.createElement('div'); act.className='sheetact';
    var cancel=document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancel'; cancel.onclick=function(){ ov.remove(); };
    var ok=document.createElement('button'); ok.className='btn primary'; ok.textContent='Save';
    ok.onclick=function(){
      var out=Object.keys(sel).map(Number).sort(function(a,b){return a-b})
        .map(function(bi){ return {beat:bi, label:(sel[bi]||'').trim()}; });
      toast('Saving\\u2026');
      api('/api/story/summary',{method:'POST',body:JSON.stringify({projectId:p.id, summary:out})})
        .then(function(r){return r.json()})
        .then(function(d){ if(!d.ok) throw new Error(d.error||'failed');
          p.summary=d.summary||out; ov.remove(); toast(out.length?'Summary saved':'Summary cleared'); drawSummary();
        })
        .catch(function(e){ toast('Failed: '+String(e.message||e).slice(0,50)); });
    };
    act.appendChild(cancel); act.appendChild(ok); sheet.appendChild(act);
    ov.appendChild(sheet); document.body.appendChild(ov);
  }
  drawSummary();

  // ── The Film — the story's most recent rendered film, ON the story
  // (Sophie, Aug 2026). A real film (a linked forge-movies doc with a stitch)
  // wins; otherwise an ffmpeg DRAFT cut from the beat art — auto-stitched on
  // first open, over the voiceover when there is one — so there's always
  // something watchable the moment art exists. Below it, the frames. ──
  var filmWrap=document.createElement('div'); sec.appendChild(filmWrap);
  var draftKicked=false, draftTimer=null;
  function artList(){
    var out=[];
    (p.beats||[]).forEach(function(b,bi){ var a=beatArt(bi); if(a) out.push(a); });
    return out;
  }
  function mkVideo(src, poster){
    var v=document.createElement('video'); v.className='player'; v.controls=true;
    v.playsInline=true; v.setAttribute('playsinline',''); v.preload='none';
    if(poster) v.poster=thumb(poster);
    v.src=src;
    return v;
  }
  function thumbRow(urls){
    var zg=document.createElement('div'); zg.className='zgrid'; zg.style.margin='12px 0 0';
    urls.forEach(function(u,i){
      var cell=document.createElement('button'); cell.className='zcell';
      cell.innerHTML='<img alt="" loading="lazy" src="'+esc(thumb(u))+'"><span class="zno">'+(i+1)+'</span>';
      cell.onclick=function(){
        window.__scrollStop();
        var lb=document.getElementById('lightbox');
        lb.innerHTML='<img alt="" src="'+esc(u)+'">';
        lb.style.display='flex';
        document.body.style.overflow='hidden';   // freeze the page behind
        lb.onclick=function(){ lb.style.display='none'; lb.innerHTML=''; document.body.style.overflow=''; };
      };
      zg.appendChild(cell);
    });
    return zg;
  }
  function pollDraft(){
    clearInterval(draftTimer);
    draftTimer=setInterval(function(){
      api('/api/story').then(function(r){return r.json()}).then(function(res){
        if(!cur||cur.id!==p.id){ clearInterval(draftTimer); return; }
        var p2=((res&&res.projects)||[]).filter(function(x){return x.id===p.id})[0];
        if(!p2){ clearInterval(draftTimer); return; }
        p.draftFilm=p2.draftFilm||null;
        if(!(p.draftFilm&&p.draftFilm.status)){
          clearInterval(draftTimer);
          drawFilm();
          toast(p.draftFilm&&p.draftFilm.error? 'Draft stitch failed':'Draft film ready');
        }
      }).catch(function(){});
    },6000);
  }
  function kickDraft(force){
    api('/api/story/draft-film',{method:'POST',body:JSON.stringify({projectId:p.id, force:!!force})})
      .then(function(r){return r.json()})
      .then(function(d){ if(!d.ok) throw new Error(d.error||'failed');
        p.draftFilm=d.draftFilm||{status:'stitching'};
        drawFilm(); pollDraft();
      })
      .catch(function(e){ toast('Stitch failed: '+String(e.message||e).slice(0,60)); });
  }
  function drawFilm(){
    filmWrap.innerHTML='';
    var films=filmsByStory[p.id]||[];
    var real=films.filter(function(f){return f.movieUrl;});
    var df=p.draftFilm||null;
    var art=artList();
    if(!real.length&&!df&&!art.length&&!films.length) return;   // nothing filmable yet
    var pm=document.createElement('div'); pm.className='pagemark'; pm.textContent='THE FILM'; filmWrap.appendChild(pm);
    if(real.length){
      var f0=real[0];   // newest linked film
      filmWrap.appendChild(mkVideo(f0.movieUrl, f0.poster));
      var row=document.createElement('div'); row.className='newrow'; row.style.margin='10px 0 0';
      var ob=document.createElement('button'); ob.className='btn'; ob.textContent='Cuts & rejected art';
      ob.onclick=function(){ openFilm(f0, function(){ openProj(p); }); };
      row.appendChild(ob);
      real.slice(1).forEach(function(f){
        var b=document.createElement('button'); b.className='btn'; b.textContent=String(f.title||f.id).slice(0,24);
        b.onclick=function(){ openFilm(f, function(){ openProj(p); }); };
        row.appendChild(b);
      });
      filmWrap.appendChild(row);
      // the film's frames, in order, from the movie doc
      api('/api/movies/'+encodeURIComponent(f0.id)).then(function(r){return r.json()}).then(function(doc){
        if(!cur||cur.id!==p.id) return;
        var urls=((doc&&doc.scenes)||[]).map(function(sc){return sc&&sc.panel&&sc.panel.url;}).filter(Boolean);
        if(urls.length) filmWrap.appendChild(thumbRow(urls));
      }).catch(function(){});
      return;
    }
    // No real film — the ffmpeg draft.
    if(df&&df.status){
      var st=document.createElement('p'); st.className='vo none';
      st.textContent='Stitching the draft… it keeps working if you leave.';
      filmWrap.appendChild(st);
      if(df.url) filmWrap.appendChild(mkVideo(df.url, art[0]));
      pollDraft();
    } else if(df&&df.error){
      if(df.url) filmWrap.appendChild(mkVideo(df.url, art[0]));
      var er=document.createElement('div'); er.className='voerr'; er.textContent=df.error; filmWrap.appendChild(er);
      var rr2=document.createElement('div'); rr2.className='newrow';
      var rb2=document.createElement('button'); rb2.className='btn'; rb2.textContent='Try again';
      rb2.onclick=function(){ toast('Stitching…'); kickDraft(true); };
      rr2.appendChild(rb2); filmWrap.appendChild(rr2);
    } else if(df&&df.url){
      filmWrap.appendChild(mkVideo(df.url, art[0]));
      var stale=JSON.stringify(df.art||[])!==JSON.stringify(art)
        || String((p.voiceover&&p.voiceover.url)||'')!==String(df.voUrl||'');
      var cap=document.createElement('p'); cap.className='vo none'; cap.style.fontSize='14px'; cap.style.margin='6px 0 4px';
      cap.textContent='Draft — cut from the beat art'+(stale? ', and the art has changed since':'');
      filmWrap.appendChild(cap);
      var rr=document.createElement('div'); rr.className='newrow'; rr.style.margin='0';
      var rb=document.createElement('button'); rb.className='btn'+(stale?' primary':''); rb.textContent='Restitch';
      rb.onclick=function(){ toast('Stitching…'); kickDraft(true); };
      rr.appendChild(rb); filmWrap.appendChild(rr);
    } else if(art.length){
      // first open with art and no draft yet — stitch without being asked, so
      // walking into a story always shows the current rough cut
      var st2=document.createElement('p'); st2.className='vo none';
      st2.textContent='Stitching the draft… it keeps working if you leave.';
      filmWrap.appendChild(st2);
      if(!draftKicked){ draftKicked=true; kickDraft(false); }
    } else if(films.length){
      var no=document.createElement('p'); no.className='vo none';
      no.textContent='A film is linked but nothing is stitched yet.';
      filmWrap.appendChild(no);
    }
    if(art.length) filmWrap.appendChild(thumbRow(art));
  }
  drawFilm();
  if(p.draftFilm&&p.draftFilm.status) pollDraft();

  // ── The story itself (prose) — read + edit in place ──
  var proseWrap=document.createElement('div'); sec.appendChild(proseWrap);
  function drawProse(){
    proseWrap.innerHTML='';
    sbtn.style.display=String(p.text||'').trim()? 'none':'';
    if(!String(p.text||'').trim()) return;
    var pm=document.createElement('div'); pm.className='pagemark'; pm.textContent='THE STORY';
    var ed=document.createElement('button'); ed.className='st'; ed.textContent='\\u00b7 edit';
    ed.onclick=function(){ editProse(); };
    pm.appendChild(ed); proseWrap.appendChild(pm);
    var body=document.createElement('div'); body.className='prose'; body.textContent=p.text; proseWrap.appendChild(body);
  }
  function editProse(){
    showModal({ title: p.text? 'Edit the story':'The story', okLabel:'Save',
      fields:[ {key:'text', type:'textarea', placeholder:'Once upon a time\\u2026', value:p.text||''} ],
      onOk:function(v, close){
        api('/api/story/text',{method:'POST',body:JSON.stringify({projectId:p.id, text:v.text||''})})
          .then(function(r){return r.json()})
          .then(function(d){ if(!d.ok) throw new Error(d.error||'failed');
            p.text=String(v.text||''); close(); toast('Story saved'); drawProse();
          })
          .catch(function(e){ toast('Failed: '+String(e.message||e).slice(0,50)); });
      }
    });
  }

  // ── The description — what the video should be (shots, staging, visual
  // notes), separate from the story prose so the two never share one field ──
  var descWrap=document.createElement('div'); sec.appendChild(descWrap);
  function drawDesc(){
    descWrap.innerHTML='';
    dsbtn.style.display=String(p.description||'').trim()? 'none':'';
    if(!String(p.description||'').trim()) return;
    var pm=document.createElement('div'); pm.className='pagemark'; pm.textContent='THE DESCRIPTION';
    var ed=document.createElement('button'); ed.className='st'; ed.textContent='· edit';
    ed.onclick=function(){ editDesc(); };
    pm.appendChild(ed); descWrap.appendChild(pm);
    var body=document.createElement('div'); body.className='prose'; body.textContent=p.description; descWrap.appendChild(body);
  }
  function editDesc(){
    showModal({ title: p.description? 'Edit the description':'The description', okLabel:'Save',
      fields:[ {key:'description', type:'textarea', placeholder:'What this video should be…', value:p.description||''} ],
      onOk:function(v, close){
        api('/api/story/description',{method:'POST',body:JSON.stringify({projectId:p.id, description:v.description||''})})
          .then(function(r){return r.json()})
          .then(function(d){ if(!d.ok) throw new Error(d.error||'failed');
            p.description=String(v.description||''); close(); toast('Description saved'); drawDesc();
          })
          .catch(function(e){ toast('Failed: '+String(e.message||e).slice(0,50)); });
      }
    });
  }

  // ── Whole-story voiceover: audio and/or its words, either half derivable ──
  var voWrap=document.createElement('div'); voWrap.className='vosec'; sec.appendChild(voWrap);
  var voForced=false;
  function postVo(body, busyMsg){
    toast(busyMsg||'Saving\\u2026');
    body.projectId=p.id;
    api('/api/story/voiceover',{method:'POST',body:JSON.stringify(body)})
      .then(function(r){return r.json()})
      .then(function(d){ if(!d.ok) throw new Error(d.error||'failed');
        p.voiceover={ url:d.voiceover.url||null, text:d.voiceover.text||'', status:d.voiceover.status||null,
                      source:(p.voiceover&&p.voiceover.source)||null,
                      // the server keeps `alt` on the doc; carry it locally too
                      // or the other take vanishes from the page until reload
                      alt:(p.voiceover&&p.voiceover.alt)||null };
        if(body.audio||body.url) p.voiceover.source='recording';
        drawVo();
        if(d.voiceover.status) pollVo(p.id);
        else toast('Voiceover saved');
      })
      .catch(function(e){ toast('Failed: '+String(e.message||e).slice(0,60)); });
  }
  // The words of a recording are for checking, not reading past — a
  // 17-minute transcript buried the whole page (Sophie, Aug 2026). Folded
  // behind a "transcription" toggle, closed by default.
  function foldedWords(text){
    var w=document.createElement('div');
    var tog=document.createElement('button'); tog.className='st'; tog.style.marginLeft='0';
    tog.textContent='· transcription';
    var tx=document.createElement('div'); tx.className='voscript'; tx.textContent=text; tx.style.display='none';
    tog.onclick=function(){
      var open=tx.style.display==='none';
      tx.style.display=open?'':'none';
      tog.textContent=open?'· hide transcription':'· transcription';
    };
    w.appendChild(tog); w.appendChild(tx);
    return w;
  }
  function drawVo(){
    voWrap.innerHTML='';
    var vo=p.voiceover||{};
    var has=vo.url||(vo.parts&&vo.parts.length)||String(vo.text||'').trim()||vo.status||vo.error;
    vbtn.style.display=(has||voForced)? 'none':'';
    if(!has&&!voForced) return;
    var pm=document.createElement('div'); pm.className='pagemark'; pm.textContent='THE VOICEOVER'; voWrap.appendChild(pm);
    if(vo.status){
      var st=document.createElement('p'); st.className='vo none';
      st.textContent= vo.status==='rendering'? 'Making the voice\\u2026 it keeps working if you leave.'
                    : 'Writing down the words\\u2026 it keeps working if you leave.';
      voWrap.appendChild(st);
    }
    if(vo.error){
      var er=document.createElement('div'); er.className='voerr'; er.textContent=vo.error; voWrap.appendChild(er);
    }
    if(vo.parts&&vo.parts.length){
      // Separate, ordered takes (Aug 2026, Sophie's rule: recordings stay
      // LINKED BUT SEPARATE). A stitched vo.url may still sit on the doc for
      // the film pipeline, but what plays here is the real takes, in order.
      vo.parts.forEach(function(pt,i){
        var lb=document.createElement('div'); lb.className='vo none'; lb.style.fontSize='14px'; lb.style.margin=(i?'10px':'0')+' 0 2px';
        var mm=pt.seconds? Math.floor(pt.seconds/60)+':'+String(Math.round(pt.seconds)%60).padStart(2,'0') : '';
        lb.textContent=(i+1)+'. '+(pt.title||('Take '+(i+1)))+(mm? ' · '+mm:'');
        voWrap.appendChild(lb);
        var pa=document.createElement('audio'); pa.controls=true; pa.preload='none'; pa.src=pt.url; voWrap.appendChild(pa);
      });
    } else if(vo.url){
      var au=document.createElement('audio'); au.controls=true; au.preload='none'; au.src=vo.url; voWrap.appendChild(au);
    }
    if(String(vo.text||'').trim()){
      voWrap.appendChild(foldedWords(vo.text));
    }
    // An earlier/alternate take of the SAME narration — she often records twice
    // in a row and the keeper isn't always the second one. Shown under the main
    // take with its own player so both can be heard without swapping anything.
    if(vo.alt&&vo.alt.url){
      var al=document.createElement('div'); al.className='pagemark'; al.style.marginTop='14px';
      al.textContent='ANOTHER TAKE' + (vo.alt.seconds? ' · '+vo.alt.seconds+'s' : '');
      voWrap.appendChild(al);
      if(vo.alt.note){ var an=document.createElement('div'); an.className='vo none'; an.textContent=vo.alt.note; voWrap.appendChild(an); }
      var aa=document.createElement('audio'); aa.controls=true; aa.preload='none'; aa.src=vo.alt.url; voWrap.appendChild(aa);
      if(String(vo.alt.text||'').trim()){
        voWrap.appendChild(foldedWords(vo.alt.text));
      }
    }
    var row=document.createElement('div'); row.className='newrow';
    // Paste a recording — the native bridge (app only): in Voice Memos,
    // Share -> Copy, then tap this. iOS won't hand clipboard audio to a web
    // page, so the app reads UIPasteboard and uploads it for us.
    if(window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.pasteVoiceover){
      var pb=document.createElement('button'); pb.className='btn'; pb.textContent='Paste a recording';
      pb.onclick=function(){
        window.__voPasteTarget=p.id;
        try{ window.webkit.messageHandlers.pasteVoiceover.postMessage(p.id); }
        catch(e){ toast('Paste not available here'); }
      };
      row.appendChild(pb);
    }
    var up=document.createElement('button'); up.className='btn'; up.textContent='Choose a file';
    up.onclick=function(){
      var inp=document.createElement('input'); inp.type='file'; inp.accept='audio/*';
      inp.onchange=function(){
        var f=inp.files&&inp.files[0]; if(!f) return;
        if(f.size>30000000){ toast('That file is too big'); return; }
        var r=new FileReader();
        r.onload=function(){ postVo({audio:r.result}, 'Uploading the voiceover\\u2026'); };
        r.readAsDataURL(f);
      };
      inp.click();
    };
    var sc=document.createElement('button'); sc.className='btn'; sc.textContent= String(vo.text||'').trim()? 'Edit the words':'Write the words';
    sc.onclick=function(){
      showModal({ title:'The voiceover words', okLabel:'Save',
        fields:[ {key:'text', type:'textarea', placeholder:'What the voice says\\u2026', value:vo.text||''} ],
        onOk:function(v, close){ close(); postVo({text:v.text||''}); }
      });
    };
    row.appendChild(up); row.appendChild(sc);
    if(String(vo.text||'').trim() && !vo.status){
      var mk=document.createElement('button'); mk.className='btn primary'; mk.textContent='Make the voice';
      mk.onclick=function(){
        if(vo.url && vo.source!=='tts'){
          showModal({ title:'Replace the recording?', okLabel:'Make the voice', fields:[],
            onOk:function(v, close){ close(); postVo({tts:true}, 'Starting the voice\\u2026'); } });
        } else postVo({tts:true}, 'Starting the voice\\u2026');
      };
      row.appendChild(mk);
    }
    voWrap.appendChild(row);
  }
  drawVoCur=drawVo;
  drawProse(); drawDesc(); drawVo();
  if(p.voiceover&&p.voiceover.status) pollVo(p.id);
  // Beats / Grid pill
  var tabs=document.createElement('div'); tabs.className='tabs';
  var seg=document.createElement('div'); seg.className='seg';
  var tb=document.createElement('button'); tb.className='tab on'; tb.textContent='Beats';
  var tg=document.createElement('button'); tg.className='tab'; tg.textContent='Grid';
  seg.appendChild(tb); seg.appendChild(tg); tabs.appendChild(seg); sec.appendChild(tabs);
  var beatsView=document.createElement('div');
  var gridView=document.createElement('div'); gridView.style.display='none';
  sec.appendChild(beatsView); sec.appendChild(gridView);
  tb.onclick=function(){ window.__scrollStop(); tb.classList.add('on'); tg.classList.remove('on'); beatsView.style.display=''; gridView.style.display='none'; };
  tg.onclick=function(){ window.__scrollStop(); tg.classList.add('on'); tb.classList.remove('on'); gridView.style.display=''; beatsView.style.display='none'; };
  // Grid view: every card, 4 per row (zoomable to 8)
  var zoom=document.createElement('button'); zoom.className='btn zoombtn'; zoom.textContent='Smaller';
  var zg=document.createElement('div'); zg.className='zgrid';
  zoom.onclick=function(){ var small=zg.classList.toggle('z8'); zoom.textContent=small?'Bigger':'Smaller'; };
  gridView.appendChild(zoom); gridView.appendChild(zg);
  (p.beats||[]).forEach(function(beat,bi){
    var cs=beat.cards||[];
    if(!cs.length){
      var cell=document.createElement('button'); cell.className='zcell';
      cell.innerHTML='<div class="zph"></div><span class="zno">'+(bi+1)+'</span>';
      cell.onclick=function(){ tb.onclick(); var t=beatsView.querySelector('[data-beat="'+bi+'"]'); if(t) t.scrollIntoView({block:'start'}); };
      zg.appendChild(cell);
      return;
    }
    cs.forEach(function(c){
      var cell=document.createElement('button'); cell.className='zcell';
      cell.innerHTML=(c.url? '<img alt="" loading="lazy" src="'+esc(thumb(c.url))+'">' : '<div class="zph"></div>')
        +'<span class="zno">'+(bi+1)+'</span>';
      cell.onclick=function(){ tb.onclick(); var t=beatsView.querySelector('[data-beat="'+bi+'"]'); if(t) t.scrollIntoView({block:'start'}); };
      zg.appendChild(cell);
    });
  });
  // Inbox: unsorted art dumped for this story — tap a piece to file it away
  var inbox=p.inbox||[];
  if(inbox.length){
    var im=document.createElement('div'); im.className='pagemark'; im.textContent='INBOX — '+inbox.length+' TO SORT'; beatsView.appendChild(im);
    var ihint=document.createElement('p'); ihint.className='vo none'; ihint.textContent='Tap a piece to file it into a beat.'; beatsView.appendChild(ihint);
    var izoom=document.createElement('button'); izoom.className='btn zoombtn'; izoom.textContent='Smaller';
    var ig=document.createElement('div'); ig.className='zgrid';
    izoom.onclick=function(){ var s=ig.classList.toggle('z8'); izoom.textContent=s?'Bigger':'Smaller'; };
    beatsView.appendChild(izoom); beatsView.appendChild(ig);
    inbox.forEach(function(it,ii){
      var cell=document.createElement('button'); cell.className='zcell';
      cell.innerHTML=(it.url? '<img alt="" loading="lazy" src="'+esc(thumb(it.url))+'">' : '<div class="zph"></div>');
      cell.onclick=function(){ moveChooser(p, {inbox:ii}); };
      ig.appendChild(cell);
    });
  }
  (p.beats||[]).forEach(function(beat,bi){
    var pm=document.createElement('div'); pm.className='pagemark'; pm.textContent='BEAT '+String(bi+1).padStart(2,'0'); pm.setAttribute('data-beat',bi); beatsView.appendChild(pm);
    var vo=document.createElement('p');
    if(beat.vo){ vo.className='vo'; vo.textContent=beat.vo; } else { vo.className='vo none'; vo.textContent='(no narration for this beat)'; }
    beatsView.appendChild(vo);
    var cards=document.createElement('div'); cards.className='cards';
    var beatHasArt=(beat.cards||[]).some(function(c){return c&&c.url;});
    (beat.cards||[]).forEach(function(c){
      if(!c.url && beatHasArt) return;   // hide the empty placeholder once real art lands
      var f=document.createElement('figure'); f.className='card';
      if(NORM[c.status]) c.status=NORM[c.status];
      var st=c.status||'miss';
      f.innerHTML=(c.url? '<img alt="" loading="lazy" src="'+esc(c.url)+'">' : '<div class="ph">no art yet</div>');
      var cap=document.createElement('figcaption');
      // The candidate/approved status label and the auto-generated UUID
      // filename are intentionally not shown for now (candidate architecture
      // parked; every asset reads the same).
      var mv=document.createElement('button'); mv.className='st'; mv.textContent='· move'; mv.title='Move this art to another beat or the inbox';
      mv.onclick=function(ev){ ev.stopPropagation(); moveChooser(p, {beat:bi, card:(beat.cards||[]).indexOf(c)}); };
      cap.appendChild(mv); f.appendChild(cap);
      cards.appendChild(f);
    });
    if((beat.cards||[]).length) beatsView.appendChild(cards);
    var id=noteKey(p.id,bi);
    var artBtn=document.createElement('button'); artBtn.className='addnote'; artBtn.textContent='+ art';
    artBtn.onclick=function(){
      window.__scrollStop();
      var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
      inp.onchange=function(){
        var f=inp.files&&inp.files[0]; if(!f) return;
        resizeToDataUrl(f,function(dataUrl,label){
          toast('Uploading art\u2026');
          api('/api/story/art',{method:'POST',body:JSON.stringify({projectId:p.id, beat:bi, label:label, image:dataUrl})})
            .then(function(r){return r.json()})
            .then(function(d){
              if(!d.ok) throw new Error(d.error||'failed');
              beat.cards=beat.cards||[];
              beat.cards.push({label:label, status:'cand', url:d.url});
              toast('Art added as candidate');
              openProj(p);
            })
            .catch(function(e){ toast('Upload failed: '+String(e.message||e).slice(0,60)); });
        });
      };
      inp.click();
    };
    var btn=document.createElement('button'); btn.className='addnote'; btn.textContent='+ note';
    var wrap=document.createElement('div');
    btn.onclick=function(){ openEditor(wrap,id,(beat.vo||'beat '+(bi+1)).slice(0,70)); };
    var btnrow=document.createElement('div'); btnrow.style.display='flex'; btnrow.style.justifyContent='flex-end'; btnrow.style.gap='4px';
    artBtn.style.margin='0'; btn.style.margin='0';
    btnrow.appendChild(artBtn); btnrow.appendChild(btn);
    beatsView.appendChild(btnrow); beatsView.appendChild(wrap);
    renderNoteInto(wrap,id,(beat.vo||'').slice(0,70));
  });
  var dz=document.createElement('button'); dz.className='addnote'; dz.style.margin='2.4em auto 0'; dz.style.color='var(--ink2)'; dz.style.opacity='.75';
  dz.textContent='Archive this story'; dz.onclick=function(){ archiveStory(p); }; sec.appendChild(dz);
  document.getElementById('home').style.display='none';
  sec.style.display='';
  document.body.classList.add('reading');
  window.scrollTo(0,0);
  if(jumpBeat!==undefined){ var t=beatsView.querySelector('[data-beat="'+jumpBeat+'"]'); if(t) t.scrollIntoView({block:'start'}); }
}
function goHome(){
  window.__scrollStop(); cur=null;
  clearInterval(voTimer); drawVoCur=null;
  document.getElementById('proj').style.display='none';
  document.getElementById('home').style.display='';
  document.body.classList.remove('reading');
  renderShelf();
  window.scrollTo(0,homeY||0);   // back to where you were, not the top
}

// ── Self-serve story building: new story, add beat, dump + sort art ──
// Client-side downscale to ≤1400px JPEG (same as the old + art path), shared
// by + art, cover upload, and the bulk dump.
function resizeToDataUrl(file, cb){
  var img=new Image();
  img.onload=function(){
    var max=1400, sc=Math.min(1, max/Math.max(img.width,img.height));
    var cv=document.createElement('canvas'); cv.width=Math.round(img.width*sc); cv.height=Math.round(img.height*sc);
    cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
    cb(cv.toDataURL('image/jpeg',0.88), (file.name||'art').replace(/\\.[^.]+$/,''));
  };
  img.src=URL.createObjectURL(file);
}
// WKWebView-safe input (window.prompt is unreliable in the app's web view):
// build a small DOM sheet. fields:[{key,type:'text'|'textarea'|'file',label,placeholder,multiple}]
function showModal(opts){
  var ov=document.createElement('div'); ov.className='modal';
  var sheet=document.createElement('div'); sheet.className='sheet';
  var h=document.createElement('h2'); h.textContent=opts.title; sheet.appendChild(h);
  var inputs={};
  (opts.fields||[]).forEach(function(f){
    if(f.type==='file'){
      var lbl=document.createElement('label'); lbl.className='filelbl'; lbl.textContent=f.label||'';
      var i=document.createElement('input'); i.type='file'; i.accept=f.accept||'image/*'; if(f.multiple) i.multiple=true;
      lbl.appendChild(i); sheet.appendChild(lbl); inputs[f.key]=i;
    } else if(f.type==='textarea'){
      var t=document.createElement('textarea'); t.className='field'; t.placeholder=f.placeholder||''; t.value=f.value||''; sheet.appendChild(t); inputs[f.key]=t;
    } else {
      var x=document.createElement('input'); x.className='field'; x.type='text'; x.placeholder=f.placeholder||''; x.value=f.value||''; sheet.appendChild(x); inputs[f.key]=x;
    }
  });
  var act=document.createElement('div'); act.className='sheetact';
  var cancel=document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancel'; cancel.onclick=function(){ ov.remove(); };
  var ok=document.createElement('button'); ok.className='btn primary'; ok.textContent=opts.okLabel||'Save';
  ok.onclick=function(){
    var v={}; (opts.fields||[]).forEach(function(f){ v[f.key]= f.type==='file'? inputs[f.key].files : inputs[f.key].value; });
    opts.onOk(v, function(){ ov.remove(); });
  };
  act.appendChild(cancel); act.appendChild(ok); sheet.appendChild(act);
  ov.appendChild(sheet); document.body.appendChild(ov);
  var first=sheet.querySelector('.field'); if(first) first.focus();
}
// Re-fetch the boards and re-open a project (the inbox endpoints return counts,
// not per-item URLs — a reload is the simplest way to show the new art).
function reloadProject(id, jumpBeat){
  api('/api/story').then(function(r){return r.json()}).then(function(res){
    projects=(res&&res.projects)||projects;
    var p=projects.filter(function(x){return x.id===id})[0];
    if(p) openProj(p, jumpBeat);
  }).catch(function(){});
}
// A picker of where to move one piece of art: any other beat, or (from a beat)
// back to the inbox. `from` is {inbox:i} or {beat,card}.
function moveChooser(p, from){
  var beats=p.beats||[];
  if(from.inbox!=null && !beats.length){ toast('Add a beat first'); return; }
  var ov=document.createElement('div'); ov.className='modal';
  var sheet=document.createElement('div'); sheet.className='sheet';
  var h=document.createElement('h2'); h.textContent= from.inbox!=null? 'File into which beat?' : 'Move to…'; sheet.appendChild(h);
  function go(to){
    ov.remove(); toast('Moving…');
    api('/api/story/assign',{method:'POST',body:JSON.stringify({projectId:p.id, from:from, to:to})})
      .then(function(r){return r.json()})
      .then(function(d){ if(!d.ok) throw new Error(d.error||'failed'); toast('Moved'); reloadProject(p.id); })
      .catch(function(e){ toast('Failed: '+String(e.message||e).slice(0,50)); });
  }
  beats.forEach(function(b,bi){
    if(from.beat!=null && Number(from.beat)===bi) return;
    var btn=document.createElement('button'); btn.className='btn pickrow';
    btn.textContent='Beat '+(bi+1)+(b.vo?' — '+b.vo.slice(0,34):'');
    btn.onclick=function(){ go({beat:bi}); }; sheet.appendChild(btn);
  });
  if(from.inbox==null){
    var ib=document.createElement('button'); ib.className='btn pickrow'; ib.textContent='↩ Back to inbox';
    ib.onclick=function(){ go({inbox:true}); }; sheet.appendChild(ib);
  }
  var cancel=document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancel'; cancel.onclick=function(){ ov.remove(); };
  sheet.appendChild(cancel); ov.appendChild(sheet); document.body.appendChild(ov);
}
// Nothing is required to start a story — every field is optional, so tapping
// Create with all of them empty opens a fresh "Untitled" story you name later
// (the title is tappable on the story page). A blank title is derived from the
// first words of the text when there is any.
function newStory(){
  showModal({ title:'New story', okLabel:'Create',
    fields:[ {key:'title', type:'text', placeholder:'Story title (optional)'},
             {key:'text', type:'textarea', placeholder:'The story itself (optional)'},
             {key:'cover', type:'file', label:'Cover photo (optional)'},
             {key:'vo', type:'file', label:'Voiceover recording (optional)', accept:'audio/*'} ],
    onOk:function(v, close){
      var text=(v.text||'').trim();
      var voFile=v.vo&&v.vo[0];
      var title=(v.title||'').trim()
        || (text? text.split(/\\s+/).slice(0,6).join(' ') : '');
      function create(cover){
        api('/api/story/project',{method:'POST',body:JSON.stringify({title:title||undefined, cover:cover||undefined, text:text||undefined})})
          .then(function(r){return r.json()})
          .then(function(d){ if(!d.ok) throw new Error(d.error||'failed');
            close(); toast('Story created');
            d.project.beats=d.project.beats||[]; projects.push(d.project); openProj(d.project);
            if(voFile){
              if(voFile.size>30000000){ toast('Voiceover file too big — add it from the story page'); return; }
              toast('Uploading the voiceover\\u2026');
              var r=new FileReader();
              r.onload=function(){
                api('/api/story/voiceover',{method:'POST',body:JSON.stringify({projectId:d.project.id, audio:r.result})})
                  .then(function(x){return x.json()})
                  .then(function(x){ if(!x.ok) throw new Error(x.error||'failed');
                    reloadProject(d.project.id);
                  })
                  .catch(function(e){ toast('Voiceover failed: '+String(e.message||e).slice(0,50)); });
              };
              r.readAsDataURL(voFile);
            }
          })
          .catch(function(e){ toast('Failed: '+String(e.message||e).slice(0,50)); });
      }
      var f=v.cover&&v.cover[0];
      if(f) resizeToDataUrl(f,function(dataUrl){ toast('Creating…'); create(dataUrl); });
      else { toast('Creating…'); create(null); }
    }
  });
}
function addBeat(p){
  showModal({ title:'Add a beat', okLabel:'Add',
    fields:[ {key:'vo', type:'textarea', placeholder:'Narration for this beat (optional)'} ],
    onOk:function(v, close){
      api('/api/story/beat',{method:'POST',body:JSON.stringify({projectId:p.id, vo:v.vo||''})})
        .then(function(r){return r.json()})
        .then(function(d){ if(!d.ok) throw new Error(d.error||'failed');
          p.beats=p.beats||[]; p.beats.push({vo:(v.vo||''), cards:[]});
          close(); toast('Beat added'); openProj(p, p.beats.length-1);
        })
        .catch(function(e){ toast('Failed: '+String(e.message||e).slice(0,50)); });
    }
  });
}
function dumpArt(p){
  var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.multiple=true;
  inp.onchange=function(){
    var files=Array.prototype.slice.call(inp.files||[]); if(!files.length) return;
    toast('Preparing '+files.length+' image'+(files.length>1?'s':'')+'…');
    var out=[], done=0;
    files.forEach(function(f){
      resizeToDataUrl(f,function(dataUrl){
        out.push(dataUrl); done++;
        if(done===files.length){
          toast('Uploading '+out.length+'…');
          api('/api/story/inbox',{method:'POST',body:JSON.stringify({projectId:p.id, images:out})})
            .then(function(r){return r.json()})
            .then(function(d){ if(!d.ok) throw new Error(d.error||'failed');
              toast(d.added+' added to inbox'); reloadProject(p.id);
            })
            .catch(function(e){ toast('Upload failed: '+String(e.message||e).slice(0,50)); });
        }
      });
    });
  };
  inp.click();
}
function deleteStory(p){
  var ov=document.createElement('div'); ov.className='modal';
  var sheet=document.createElement('div'); sheet.className='sheet';
  var h=document.createElement('h2'); h.textContent='Delete this story?'; sheet.appendChild(h);
  var msg=document.createElement('p'); msg.className='vo none'; msg.style.margin='.2em 0 1em';
  msg.textContent='“'+(p.title||p.id)+'” and its beats will be removed from the boards. This can’t be undone.';
  sheet.appendChild(msg);
  var act=document.createElement('div'); act.className='sheetact';
  var cancel=document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancel'; cancel.onclick=function(){ ov.remove(); };
  var del=document.createElement('button'); del.className='btn primary'; del.textContent='Delete';
  del.onclick=function(){ ov.remove(); toast('Deleting…');
    api('/api/story/project/'+encodeURIComponent(p.id),{method:'DELETE'})
      .then(function(r){return r.json()})
      .then(function(d){ if(!d.ok) throw new Error(d.error||'failed');
        projects=projects.filter(function(x){return x.id!==p.id}); toast('Story deleted'); goHome();
      })
      .catch(function(e){ toast('Failed: '+String(e.message||e).slice(0,50)); });
  };
  act.appendChild(cancel); act.appendChild(del); sheet.appendChild(act);
  ov.appendChild(sheet); document.body.appendChild(ov);
}
var nsBtn=document.getElementById('newstory'); if(nsBtn) nsBtn.onclick=newStory;
var sBox=document.getElementById('storysearch');
if(sBox) sBox.oninput=function(){ query=sBox.value.trim().toLowerCase(); renderShelf(); };

// autoscroll pill — shared component (scripts/pill.py)
__PILL_JS__
document.querySelector('.wrap').addEventListener('click',function(e){
  if(e.target.closest('button')||e.target.closest('.notebox')||e.target.closest('audio')||e.target.closest('a')||e.target.closest('img')) return;
  if(!document.body.classList.contains('reading')) return;
  window.__scrollStop();   // a tap on content only ever STOPS autoscroll
});

// The films archive \u2014 everything the Movies pipeline made that has NO story
// to live on (dream experiments, tests). Off the home screen by request
// (Sophie, Aug 2026): a film with a story shows on the story itself; the
// rest waits back here behind the Films button.
function openFilmsArchive(){
  if(!cur) homeY=window.scrollY;
  window.__scrollStop();
  clearInterval(voTimer);
  cur={films:1};
  var sec=document.getElementById('proj'); sec.innerHTML='';
  var bar=document.createElement('div'); bar.className='eyebrowrow';
  bar.innerHTML='<button class="backbtn" aria-label="Back to the shelf">&#8249;</button>';
  bar.querySelector('.backbtn').onclick=goHome;
  sec.appendChild(bar);
  var head=document.createElement('header');
  head.innerHTML='<h1>Films</h1><div class="rule"></div>';
  sec.appendChild(head);
  var sub=document.createElement('p'); sub.className='sub';
  sub.textContent='Experiments and films without a story. A film that belongs to a story lives on the story itself.';
  sec.appendChild(sub);
  var wrap=document.createElement('div'); sec.appendChild(wrap);
  shelfRows(wrap, unmatchedFilms, function(m){
    var b=document.createElement('button'); b.className='tile';
    b.innerHTML=(m.poster? '<span class="t-cover"><img alt="" loading="lazy" src="'+esc(thumb(m.poster))+'"></span>'
                         : '<span class="t-cover t-blank"><span>'+esc((m.title||m.id||'?').slice(0,1))+'</span></span>')
      +'<span class="t-name">'+esc(m.title||m.id)+'</span>'
      +'<span class="t-meta">'+(m.sceneCount||0)+' scenes'+(m.movieUrl?'':' \u00b7 no film yet')+'</span>';
    b.onclick=function(){ openFilm(m, openFilmsArchive); };
    return b;
  });
  document.getElementById('home').style.display='none';
  sec.style.display='';
  document.body.classList.add('reading');
  window.scrollTo(0,0);
}
// backTo: where the \u2039 button returns \u2014 the films archive, a story page, or
// (default) the shelf.
function openFilm(m, backTo){
  if(!cur) homeY=window.scrollY;   // remember the shelf spot for back
  window.__scrollStop();
  cur={film:m.id};
  var sec=document.getElementById('proj'); sec.innerHTML='';
  var bar=document.createElement('div'); bar.className='eyebrowrow';
  bar.innerHTML='<button class="backbtn" aria-label="Back">&#8249;</button>';
  bar.querySelector('.backbtn').onclick=(typeof backTo==='function')? backTo : goHome;
  sec.appendChild(bar);
  var head=document.createElement('header');
  head.innerHTML='<h1>'+esc(m.title||m.id)+'</h1><div class="rule"></div>';
  sec.appendChild(head);
  var video=document.createElement('video'); video.className='player'; video.controls=true;
  video.playsInline=true; video.setAttribute('playsinline','');
  if(m.poster) video.poster=m.poster;
  sec.appendChild(video);
  var list=document.createElement('div'); sec.appendChild(list);
  var noteWrap=document.createElement('div');
  var noteBtn=document.createElement('button'); noteBtn.className='addnote'; noteBtn.textContent='+ note';
  var nid='movie-'+m.id+':cut';
  noteBtn.onclick=function(){ openEditor(noteWrap,nid,(m.title||'film').slice(0,70)); };
  sec.appendChild(noteBtn); sec.appendChild(noteWrap);
  renderNoteInto(noteWrap,nid,(m.title||'').slice(0,70));
  var em=document.createElement('div'); em.className='endmark'; em.innerHTML='&#10086;'; sec.appendChild(em);
  document.getElementById('home').style.display='none';
  sec.style.display='';
  document.body.classList.add('reading');
  window.scrollTo(0,0);
  function fmt(iso){ try{ var d=new Date(iso); return (d.getMonth()+1)+'/'+d.getDate(); }catch(e){ return ''; } }
  function fmtDur(s){ return s? Math.round(s)+'s':''; }
  api('/api/movies/'+m.id).then(function(r){return r.json()}).then(function(doc){
    // Rejected art: every superseded panel is kept in scene.panelHistory —
    // show them as a History tab (the images we decided against).
    var hist=[];
    ((doc&&doc.scenes)||[]).forEach(function(sc,si){
      ((sc&&sc.panelHistory)||[]).forEach(function(h){ if(h&&h.url) hist.push({url:h.url, no:si+1}); });
    });
    if(hist.length){
      var tabs=document.createElement('div'); tabs.className='tabs';
      var seg=document.createElement('div'); seg.className='seg';
      var tf=document.createElement('button'); tf.className='tab on'; tf.textContent='Film';
      var th=document.createElement('button'); th.className='tab'; th.textContent='Rejected art';
      seg.appendChild(tf); seg.appendChild(th); tabs.appendChild(seg);
      sec.insertBefore(tabs, video);
      var hv=document.createElement('div'); hv.style.display='none';
      var hg=document.createElement('div'); hg.className='zgrid'; hv.appendChild(hg);
      sec.insertBefore(hv, list.nextSibling);
      hist.forEach(function(h){
        var cell=document.createElement('button'); cell.className='zcell';
        cell.innerHTML='<img alt="" loading="lazy" src="'+esc(thumb(h.url))+'"><span class="zno">sc '+h.no+'</span>';
        cell.onclick=function(){
          window.__scrollStop();
          var lb=document.getElementById('lightbox');
          lb.innerHTML='<img alt="" src="'+esc(h.url)+'">';
          lb.style.display='flex';
          document.body.style.overflow='hidden';   // freeze the page behind
          lb.onclick=function(){ lb.style.display='none'; lb.innerHTML=''; document.body.style.overflow=''; };
        };
        hg.appendChild(cell);
      });
      tf.onclick=function(){ tf.classList.add('on'); th.classList.remove('on'); hv.style.display='none'; video.style.display=''; list.style.display=''; };
      th.onclick=function(){ th.classList.add('on'); tf.classList.remove('on'); hv.style.display=''; video.pause&&video.pause(); video.style.display='none'; list.style.display='none'; };
    }
    var cuts=(doc&&doc.cuts)||[];
    var latest=cuts.length? cuts[cuts.length-1] : null;
    var src=(latest&&latest.url)||m.movieUrl;
    if(src) video.src=src; else video.replaceWith(Object.assign(document.createElement('div'),{className:'state',textContent:'No film stitched yet.'}));
    if(cuts.length>1){
      var mk=document.createElement('div'); mk.className='pagemark'; mk.textContent='EARLIER CUTS'; list.appendChild(mk);
      cuts.slice().reverse().forEach(function(c,idx){
        var row=document.createElement('button'); row.className='cutrow'+(idx===0?' on':'');
        row.innerHTML='<span class="c-name">'+esc(c.name||('cut '+(cuts.length-idx)))+'</span>'
          +'<span class="c-meta">'+fmtDur(c.duration)+(c.stitchedAt?' \u00b7 '+fmt(c.stitchedAt):'')+'</span>';
        row.onclick=function(){
          video.src=c.url; video.play().catch(function(){});
          list.querySelectorAll('.cutrow').forEach(function(x){x.classList.remove('on')});
          row.classList.add('on');
        };
        list.appendChild(row);
      });
    }
  }).catch(function(){ if(m.movieUrl) video.src=m.movieUrl; });
}
// boot: boards + films + existing story notes
Promise.all([
  api('/api/story').then(function(r){return r.json()}).catch(function(){return {projects:[]}}),
  api('/api/writing/notes').then(function(r){return r.json()}).catch(function(){return {notes:[]}}),
  api('/api/movies').then(function(r){return r.json()}).catch(function(){return {movies:[]}})
]).then(function(res){
  projects=(res[0]&&res[0].projects)||[];
  ((res[1]&&res[1].notes)||[]).forEach(function(n){
    var did=String(n.dateId);
    if(did.indexOf('story-')!==0 && did.indexOf('movie-')!==0) return;
    var id=n.dateId+':'+n.blockId;
    notes[id]={ t:n.text||'', a:n.audioUrl||n.audioData||null };
    if(!notes[id].a) notes[id]=notes[id].t;
  });
  // Sort films onto their stories; the rest go behind the Films button.
  var pid={}; projects.forEach(function(p){ pid[p.id]=1; });
  filmsByStory={}; unmatchedFilms=[];
  (((res[2]&&res[2].movies)||[]).filter(function(m){return m.movieUrl||m.poster;})).forEach(function(m){
    if(m.storyId&&pid[m.storyId]){ (filmsByStory[m.storyId]=filmsByStory[m.storyId]||[]).push(m); }
    else unmatchedFilms.push(m);
  });
  Object.keys(filmsByStory).forEach(function(k){
    filmsByStory[k].sort(function(a,b){ return String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')); });
  });
  renderShelf();
  var fb=document.getElementById('filmsbtn');
  if(fb){ fb.style.display=unmatchedFilms.length? '':'none'; fb.onclick=openFilmsArchive; }
});
})();
</script>
"""

page = page.replace('__FONT__', font)
page = page.replace('__PILL_CSS__', PILL_CSS).replace('__PILL_HTML__', PILL_HTML).replace('__PILL_JS__', PILL_JS)
out = os.path.join(ROOT, 'public', 'storyroom.html')
open(out, 'w', encoding='utf-8').write(page)
print('built public/storyroom.html', round(len(page) / 1024), 'KB')
