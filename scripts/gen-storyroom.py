#!/usr/bin/env python3
# Story Room — the movie asset boards in the Writing Room's frame.
# Generates public/storyroom.html (served gated at /storyroom). Unlike the
# Writing Room, content is fetched LIVE from /api/story on every open, so
# board changes need no deploy at all. Notes reuse /api/writing/notes with
# keys "story-<project>:b<beat>" so any chat can read and apply them.
import base64, os

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
.wrap{max-width:34em; margin:0 auto; padding:5vh 6vw 22vh;}
.no{font-family:-apple-system,'Helvetica Neue',sans-serif; font-size:11px; letter-spacing:.34em; color:var(--ink2); text-transform:uppercase;}
h1{font-weight:600; font-size:2.5em; line-height:1; margin:.15em 0 .3em;}
.rule{height:1px; background:var(--line); margin:1.1em 0;}
.sub{font-style:italic; color:var(--ink2); margin-bottom:2em;}
.shelfgrid{display:grid; grid-template-columns:repeat(3,1fr); gap:20px 14px;}
.tile{display:flex; flex-direction:column; gap:0; background:none; border:none; padding:0; cursor:pointer;
  color:var(--ink); font-family:'EBGaramond',Georgia,serif; text-align:center; min-width:0;}
.tile:focus-visible{outline:2px solid var(--rose); border-radius:4px;}
.t-cover{display:block; aspect-ratio:5/7; border:1px solid var(--line); background:var(--barbg); border-radius:4px; overflow:hidden;}
.t-cover img{width:100%; height:100%; object-fit:cover; display:block;}
.t-blank{display:flex; align-items:center; justify-content:center;}
.t-blank span{font-size:2.2em; font-style:italic; color:var(--ink2);}
.t-name{font-size:1.12em; font-weight:600; line-height:1.15; margin-top:7px;}
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
.zcell img{width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:4px; display:block;}
.zcell .zph{width:100%; aspect-ratio:1/1; border:1px dashed var(--line); border-radius:4px;}
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
.float{position:fixed; top:max(14px, env(safe-area-inset-top)); right:max(14px,4vw); z-index:9; display:flex; flex-direction:column; gap:8px; align-items:center;}
.vseg{display:flex; flex-direction:column; width:46px; border:1.5px solid var(--ink); border-radius:999px; overflow:hidden; background:var(--paper); box-shadow:0 2px 10px rgba(0,0,0,.09);}
.vseg button{border:none; background:transparent; color:var(--ink); height:46px; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0;}
.vseg button + button{border-top:1.5px solid var(--ink);}
.vseg button.on{background:color-mix(in srgb, var(--chg) 18%, var(--paper)); color:var(--chg);}
#spd{font-family:-apple-system,sans-serif; font-size:10px; color:var(--ink2); font-variant-numeric:tabular-nums;}
.backwrap{position:fixed; top:max(14px, env(safe-area-inset-top)); left:max(14px,4vw); z-index:9; display:none;}
body.reading .backwrap{display:block;}
#back{width:44px; height:44px; border-radius:6px; border:1px solid var(--line); background:var(--barbg); color:var(--ink2); font-size:20px; cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,.09);}
#toast{position:fixed; bottom:max(20px, env(safe-area-inset-bottom)); left:50%; transform:translateX(-50%);
  background:var(--ink); color:var(--paper); font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.06em;
  padding:8px 14px; border-radius:6px; opacity:0; transition:opacity .25s; pointer-events:none;}
@media (prefers-reduced-motion: reduce){ #toast{transition:none;} }
</style>
<div class="backwrap"><button id="back" aria-label="Back to the shelf">&#8249;</button></div>
<div class="float">
  <div class="vseg">
    <button id="vtop" aria-label="Scroll up / faster"></button>
    <button id="vmid" aria-label="Play or pause autoscroll"></button>
    <button id="vbot" aria-label="Scroll down / slower"></button>
  </div>
  <span id="spd">0.6&times;</span>
</div>
<div class="wrap">
  <section id="home">
    <div class="no">deck factory &middot; story room</div>
    <h1>The Boards</h1>
    <div class="rule"></div>
    <div class="sub">Tap a project to read it through &mdash; your narration with the art in place. &ldquo;+ note&rdquo; under any beat sends me a comment.</div>
    <div id="shelf"><div class="state">Loading the boards&hellip;</div></div>
    <div class="pagemark" id="filmsmark" style="display:none">THE FILMS</div>
    <div id="films"></div>
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

var projects=[], notes={}, cur=null;
var STATUS={ok:'approved', cand:'candidate', draft:'storyboard', miss:'no art yet'};

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

function renderShelf(){
  var el=document.getElementById('shelf');
  if(!projects.length){ el.innerHTML='<div class="state">No boards synced yet — they\\u2019ll appear here as soon as a project lands in the studio.</div>'; return; }
  el.innerHTML='';
  var grid=document.createElement('div'); grid.className='shelfgrid'; el.appendChild(grid);
  projects.forEach(function(p){
    var beats=(p.beats||[]).length;
    var n=Object.keys(notes).filter(function(id){return id.split(':')[0]==='story-'+p.id}).length;
    var b=document.createElement('button'); b.className='tile';
    b.innerHTML=(p.cover? '<span class="t-cover"><img alt="" loading="lazy" src="'+esc(p.cover)+'"></span>'
                        : '<span class="t-cover t-blank"><span>'+esc((p.title||p.id||'?').slice(0,1))+'</span></span>')
      +'<span class="t-name">'+esc(p.title||p.id)+'</span>'
      +'<span class="t-meta">'+beats+(beats===1?' beat':' beats')
      +(n? '<span class="r-notes">'+n+(n===1?' note':' notes')+'</span>':'')+'</span>';
    b.onclick=function(){ openProj(p); };
    grid.appendChild(b);
  });
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
  stop();
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
  cur=p;
  var sec=document.getElementById('proj'); sec.innerHTML='';
  var head=document.createElement('header');
  head.innerHTML='<div class="no">story room &middot; '+((p.beats||[]).length)+' beats</div><h1>'+esc(p.title||p.id)+'</h1><div class="rule"></div>';
  sec.appendChild(head);
  // Beats / Grid pill
  var tabs=document.createElement('div'); tabs.className='tabs';
  var seg=document.createElement('div'); seg.className='seg';
  var tb=document.createElement('button'); tb.className='tab on'; tb.textContent='Beats';
  var tg=document.createElement('button'); tg.className='tab'; tg.textContent='Grid';
  seg.appendChild(tb); seg.appendChild(tg); tabs.appendChild(seg); sec.appendChild(tabs);
  var beatsView=document.createElement('div');
  var gridView=document.createElement('div'); gridView.style.display='none';
  sec.appendChild(beatsView); sec.appendChild(gridView);
  tb.onclick=function(){ stop(); tb.classList.add('on'); tg.classList.remove('on'); beatsView.style.display=''; gridView.style.display='none'; };
  tg.onclick=function(){ stop(); tg.classList.add('on'); tb.classList.remove('on'); gridView.style.display=''; beatsView.style.display='none'; };
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
      cell.innerHTML=(c.url? '<img alt="" loading="lazy" src="'+esc(c.url)+'">' : '<div class="zph"></div>')
        +'<span class="zno">'+(bi+1)+'</span>';
      cell.onclick=function(){ tb.onclick(); var t=beatsView.querySelector('[data-beat="'+bi+'"]'); if(t) t.scrollIntoView({block:'start'}); };
      zg.appendChild(cell);
    });
  });
  (p.beats||[]).forEach(function(beat,bi){
    var pm=document.createElement('div'); pm.className='pagemark'; pm.textContent='BEAT '+String(bi+1).padStart(2,'0'); pm.setAttribute('data-beat',bi); beatsView.appendChild(pm);
    var vo=document.createElement('p');
    if(beat.vo){ vo.className='vo'; vo.textContent=beat.vo; } else { vo.className='vo none'; vo.textContent='(no narration for this beat)'; }
    beatsView.appendChild(vo);
    var cards=document.createElement('div'); cards.className='cards';
    (beat.cards||[]).forEach(function(c){
      var f=document.createElement('figure'); f.className='card';
      var st=c.status||'miss';
      f.innerHTML=(c.url? '<img alt="" loading="lazy" src="'+esc(c.url)+'">' : '<div class="ph">no art yet</div>');
      var cap=document.createElement('figcaption'); cap.textContent=c.label||'';
      var stb=document.createElement('button'); stb.className='st '+st; stb.textContent='\u00b7 '+(STATUS[st]||st);
      stb.title='Tap to change status';
      stb.onclick=function(ev){
        ev.stopPropagation();
        var order=['ok','cand','draft','miss'];
        var cur=order.indexOf(c.status||'miss');
        var next=order[(cur+1)%order.length];
        var prev=c.status; c.status=next;
        stb.className='st '+next; stb.textContent='\u00b7 '+(STATUS[next]||next);
        api('/api/story/status',{method:'POST',body:JSON.stringify({projectId:p.id, beat:bi, card:(beat.cards||[]).indexOf(c), status:next})})
          .then(function(r){ if(!r.ok) throw 0; })
          .catch(function(){ c.status=prev; stb.className='st '+(prev||'miss'); stb.textContent='\u00b7 '+(STATUS[prev]||prev||'no art yet'); toast('Couldn\u2019t save the status'); });
      };
      cap.appendChild(stb); f.appendChild(cap);
      cards.appendChild(f);
    });
    if((beat.cards||[]).length) beatsView.appendChild(cards);
    var id=noteKey(p.id,bi);
    var artBtn=document.createElement('button'); artBtn.className='addnote'; artBtn.textContent='+ art';
    artBtn.onclick=function(){
      stop();
      var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
      inp.onchange=function(){
        var f=inp.files&&inp.files[0]; if(!f) return;
        var img=new Image();
        img.onload=function(){
          var max=1400, sc=Math.min(1, max/Math.max(img.width,img.height));
          var cv=document.createElement('canvas'); cv.width=Math.round(img.width*sc); cv.height=Math.round(img.height*sc);
          cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
          var dataUrl=cv.toDataURL('image/jpeg',0.88);
          toast('Uploading art\u2026');
          api('/api/story/art',{method:'POST',body:JSON.stringify({projectId:p.id, beat:bi, label:f.name.replace(/\.[^.]+$/,''), image:dataUrl})})
            .then(function(r){return r.json()})
            .then(function(d){
              if(!d.ok) throw new Error(d.error||'failed');
              beat.cards=beat.cards||[];
              beat.cards.push({label:f.name.replace(/\.[^.]+$/,''), status:'cand', url:d.url});
              toast('Art added as candidate');
              openProj(p);
            })
            .catch(function(e){ toast('Upload failed: '+String(e.message||e).slice(0,60)); });
        };
        img.src=URL.createObjectURL(f);
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
  var em=document.createElement('div'); em.className='endmark'; em.innerHTML='&#10086;'; sec.appendChild(em);
  document.getElementById('home').style.display='none';
  sec.style.display='';
  document.body.classList.add('reading');
  window.scrollTo(0,0);
  if(jumpBeat!==undefined){ var t=beatsView.querySelector('[data-beat="'+jumpBeat+'"]'); if(t) t.scrollIntoView({block:'start'}); }
}
function goHome(){
  stop(); cur=null;
  document.getElementById('proj').style.display='none';
  document.getElementById('home').style.display='';
  document.body.classList.remove('reading');
  renderShelf();
  window.scrollTo(0,0);
}
document.getElementById('back').onclick=goHome;

// autoscroll pill (same as the Writing Room)
var playing=false, raf=null, last=null, speed=0.6, dir=1, acc=0;
var vtop=document.getElementById('vtop'), vmid=document.getElementById('vmid'), vbot=document.getElementById('vbot');
var I={
 up:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
 down:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
 play:'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
 pause:'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="4.5" height="16" rx="1"/><rect x="14.5" y="4" width="4.5" height="16" rx="1"/></svg>',
 plus:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
 minus:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 12h14"/></svg>'
};
function showSpd(){ document.getElementById('spd').textContent=speed.toFixed(1)+'\\u00d7'; }
function paint(){
  if(playing){ vtop.innerHTML=I.plus; vbot.innerHTML=I.minus; vmid.innerHTML=I.pause; vmid.classList.add('on'); }
  else{ vtop.innerHTML=I.up; vbot.innerHTML=I.down; vmid.innerHTML=I.play; vmid.classList.remove('on'); }
  showSpd();
}
function step(ts){
  if(!playing) return;
  if(last!=null){
    acc += dir*(ts-last)/1000*42*speed;
    var move = acc>0 ? Math.floor(acc) : Math.ceil(acc);
    if(move!==0){ window.scrollBy(0,move); acc-=move; }
    var atEnd = dir>0 ? (window.innerHeight+window.scrollY>=document.body.scrollHeight-4) : (window.scrollY<=2);
    if(atEnd) stop(); }
  last=ts; raf=requestAnimationFrame(step);
}
function start(d){ dir=d; playing=true; last=null; acc=0; paint(); raf=requestAnimationFrame(step); }
function stop(){ playing=false; if(raf) cancelAnimationFrame(raf); paint(); }
vtop.onclick=function(){ if(playing){ speed=Math.min(2,+(speed+0.1).toFixed(1)); showSpd(); } else start(-1); };
vbot.onclick=function(){ if(playing){ speed=Math.max(.1,+(speed-0.1).toFixed(1)); showSpd(); } else start(1); };
vmid.onclick=function(){ playing? stop() : start(dir||1); };
paint();
document.querySelector('.wrap').addEventListener('click',function(e){
  if(e.target.closest('button')||e.target.closest('.notebox')||e.target.closest('audio')||e.target.closest('a')||e.target.closest('img')) return;
  if(!document.body.classList.contains('reading')) return;
  playing? stop() : start(1);
});

function renderFilms(films){
  var mark=document.getElementById('filmsmark'), el=document.getElementById('films');
  el.innerHTML='';
  if(!films.length){ mark.style.display='none'; return; }
  mark.style.display='';
  var grid=document.createElement('div'); grid.className='shelfgrid'; el.appendChild(grid);
  films.forEach(function(m){
    var b=document.createElement('button'); b.className='tile';
    b.innerHTML=(m.poster? '<span class="t-cover"><img alt="" loading="lazy" src="'+esc(m.poster)+'"></span>'
                         : '<span class="t-cover t-blank"><span>'+esc((m.title||m.id||'?').slice(0,1))+'</span></span>')
      +'<span class="t-name">'+esc(m.title||m.id)+'</span>'
      +'<span class="t-meta">'+(m.sceneCount||0)+' scenes'+(m.movieUrl?'':' \u00b7 no film yet')+'</span>';
    b.onclick=function(){ openFilm(m); };
    grid.appendChild(b);
  });
}
function openFilm(m){
  cur={film:m.id};
  var sec=document.getElementById('proj'); sec.innerHTML='';
  var head=document.createElement('header');
  head.innerHTML='<div class="no">the films</div><h1>'+esc(m.title||m.id)+'</h1><div class="rule"></div>';
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
        cell.innerHTML='<img alt="" loading="lazy" src="'+esc(h.url)+'"><span class="zno">sc '+h.no+'</span>';
        cell.onclick=function(){
          var lb=document.getElementById('lightbox');
          lb.innerHTML='<img alt="" src="'+esc(h.url)+'">';
          lb.style.display='flex';
          lb.onclick=function(){ lb.style.display='none'; lb.innerHTML=''; };
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
  renderShelf();
  renderFilms(((res[2]&&res[2].movies)||[]).filter(function(m){return m.movieUrl||m.poster;}));
});
})();
</script>
"""

page = page.replace('__FONT__', font)
out = os.path.join(ROOT, 'public', 'storyroom.html')
open(out, 'w', encoding='utf-8').write(page)
print('built public/storyroom.html', round(len(page) / 1024), 'KB')
