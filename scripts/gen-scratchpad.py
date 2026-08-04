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

page = r"""<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>Scratch Pad</title>
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
.wrap{max-width:34em; margin:0 auto; padding:5vh 5vw 16vh;}
.no{font-family:-apple-system,'Helvetica Neue',sans-serif; font-size:11px; letter-spacing:.34em; color:var(--ink2); text-transform:uppercase;}
/* The floating autoscroll pill is fixed over the top-right corner, so the
   header row stops 56px short of it — the inbox button sits left of that. */
header{display:flex; align-items:center; gap:10px; padding-right:56px; min-height:34px;}
header .no{flex:1;}
.iconbtn{width:34px; height:34px; flex:none; display:flex; align-items:center; justify-content:center;
  border:1px solid var(--line); border-radius:6px; background:var(--barbg); color:var(--ink); padding:0;}
.iconbtn svg{width:17px; height:17px;}
.state{font-style:italic; color:var(--ink2); text-align:center; padding:4em 1em; line-height:1.5;}
/* Four to a row; incomplete rows CENTER (Sophie: the first beat lands in the
   middle of the top, not the left — flex + justify-content does exactly that,
   and a full row still fills the width). */
#pad{display:flex; flex-wrap:wrap; justify-content:center; gap:12px; margin-top:1.4em;}
.beat{position:relative; width:calc(25% - 9px); aspect-ratio:2/3; border:1.5px solid var(--line); border-radius:4px;
  background:var(--barbg); padding:0; overflow:hidden; cursor:pointer;}
.beat img{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block;}
.beat.c-mustard{border:3px solid var(--mustard);}
.beat.c-green{border:3px solid var(--green);}
.beat.c-blue{border:3px solid var(--blue);}
.beat.c-pink{border:3px solid var(--pink);}
.slot{width:calc(25% - 9px); aspect-ratio:2/3; border:1.5px dashed var(--ink2); border-radius:4px; background:none; padding:0; cursor:pointer;}
/* ── overlays ─────────────────────────────────────────────────────── */
.sheet{position:fixed; inset:0; background:var(--paper); z-index:40; overflow-y:auto; -webkit-overflow-scrolling:touch;}
.sheet .wrap{padding-top:3vh;}
#inboxgrid{display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:1.2em;}
#inboxgrid button{aspect-ratio:2/3; border:1px solid var(--line); border-radius:4px; background:var(--barbg);
  padding:0; overflow:hidden; cursor:pointer;}
#inboxgrid button img{width:100%; height:100%; object-fit:cover; display:block;}
#inboxgrid button.used{opacity:.35;}
#beatpop{position:fixed; inset:0; z-index:50; display:flex; flex-direction:column; align-items:center;
  justify-content:center; gap:20px; background:rgba(20,17,12,.82); padding:5vw;}
/* The art stays THUMBNAIL-sized in the popup (Sophie: the chosen art isn't
   big) — openBeat() copies the pad tile's pixel width onto it. */
#beatpop img{border:3px solid var(--line); border-radius:4px; background:var(--barbg); display:block; height:auto;}
#beatpop img.c-mustard{border-color:var(--mustard);} #beatpop img.c-green{border-color:var(--green);}
#beatpop img.c-blue{border-color:var(--blue);} #beatpop img.c-pink{border-color:var(--pink);}
.chips{display:flex; gap:16px;}
.chip{width:36px; height:36px; border-radius:50%; border:1.5px solid rgba(255,255,255,.55); padding:0; cursor:pointer;}
.chip.on{outline:2.5px solid #fff; outline-offset:3px;}
.chip.gray{background:#8a8377;} .chip.mustard{background:var(--mustard);}
.chip.green{background:var(--green);} .chip.blue{background:var(--blue);} .chip.pink{background:var(--pink);}
#pnote{width:min(80vw,22em); box-sizing:border-box; font-family:'EBGaramond',Georgia,serif; font-size:17px;
  line-height:1.4; color:var(--ink); background:var(--barbg); border:1px solid var(--line); border-radius:6px;
  padding:10px 12px; resize:none;}
</style>
<div class="wrap">
  <header>
    <div class="no">Scratch pad</div>
    <button class="iconbtn" id="inboxbtn" aria-label="Hearted in the Playground"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></button>
  </header>
  <div id="pad"></div>
  <div class="state" id="empty" hidden>Empty page — the button top right opens what you hearted in the Playground.</div>
</div>

<div class="sheet" id="inbox" hidden>
  <div class="wrap">
    <header>
      <button class="iconbtn" id="inboxclose" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
      <div class="no">From the Playground</div>
    </header>
    <div id="inboxgrid"></div>
    <div class="state" id="inboxempty" hidden>Nothing hearted in the Playground yet.</div>
  </div>
</div>

<div id="beatpop" hidden>
  <img id="popimg" alt="">
  <div class="chips">
    <button class="chip gray" data-c=""></button>
    <button class="chip mustard" data-c="mustard"></button>
    <button class="chip green" data-c="green"></button>
    <button class="chip blue" data-c="blue"></button>
    <button class="chip pink" data-c="pink"></button>
  </div>
  <textarea id="pnote" rows="3"></textarea>
</div>

<script>
var TOKEN='__STUDIO_TOKEN__';
function api(p,opts){opts=opts||{};opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});
  if(TOKEN)opts.headers['x-studio-token']=TOKEN;return fetch('/api/scratchpad'+p,opts);}
var beats=[], inboxItems=[], pending=null, popBeat=null;

function lock(v){document.body.style.overflow=v?'hidden':'';}

function render(){
  var pad=document.getElementById('pad'); pad.innerHTML='';
  document.getElementById('empty').hidden=Boolean(beats.length||pending);
  function slot(at){
    var s=document.createElement('button'); s.className='slot'; s.setAttribute('aria-label','Place here');
    s.onclick=function(ev){ev.stopPropagation(); place(at);};
    pad.appendChild(s);
  }
  beats.forEach(function(b,i){
    if(pending) slot(i);
    var el=document.createElement('button'); el.className='beat'+(b.color?' c-'+b.color:'');
    var im=document.createElement('img'); im.src=b.url; im.alt=''; el.appendChild(im);
    el.onclick=function(ev){ev.stopPropagation(); if(pending)return; openBeat(b);};
    pad.appendChild(el);
  });
  if(pending&&beats.length) slot(beats.length);
}

function load(){
  api('').then(function(r){return r.json()}).then(function(d){beats=d.beats||[];render();});
}

/* ── the inbox: hearted Playground images, 4 to a row ─────────────── */
document.getElementById('inboxbtn').onclick=function(){
  document.getElementById('inbox').hidden=false; lock(true);
  api('/inbox').then(function(r){return r.json()}).then(function(d){
    inboxItems=d.items||[];
    var g=document.getElementById('inboxgrid'); g.innerHTML='';
    document.getElementById('inboxempty').hidden=Boolean(inboxItems.length);
    var onPad={}; beats.forEach(function(b){onPad[b.url]=1;});
    inboxItems.forEach(function(it){
      var el=document.createElement('button'); if(onPad[it.url])el.className='used';
      var im=document.createElement('img'); im.src=it.url; im.alt=''; im.loading='lazy'; el.appendChild(im);
      // stopPropagation matters: this click must not reach the document-level
      // cancel handler, which would clear the placing mode it just started.
      el.onclick=function(ev){ev.stopPropagation(); pick(it);};
      g.appendChild(el);
    });
  });
};
document.getElementById('inboxclose').onclick=function(){
  document.getElementById('inbox').hidden=true; lock(false);
};

function pick(it){
  document.getElementById('inbox').hidden=true; lock(false);
  if(!beats.length){ place(0, it); return; }
  pending=it; render();
}
function place(at, it){
  it=it||pending; if(!it)return; pending=null;
  var src={runId:it.runId,i:it.i,prompt:it.prompt,model:it.model,engine:it.engine,quality:it.quality};
  api('/add',{method:'POST',body:JSON.stringify({url:it.url,at:at,src:src})})
    .then(function(r){return r.json()})
    .then(function(d){if(d.beats)beats=d.beats;render();});
  render();
}
/* tapping anywhere that is not a slot quietly cancels placing */
document.addEventListener('click',function(){ if(pending){pending=null;render();} });

/* ── the beat popup: the art at THUMBNAIL size, frame color, text ─── */
function openBeat(b){
  popBeat=b;
  var im=document.getElementById('popimg');
  // Same size as it sits on the pad — the popup never blows the art up.
  var tile=document.querySelector('#pad .beat');
  im.style.width=(tile?tile.offsetWidth:90)+'px';
  im.src=b.url; im.className=b.color?'c-'+b.color:'';
  document.querySelectorAll('.chip').forEach(function(c){
    c.classList.toggle('on',(c.getAttribute('data-c')||null)===(b.color||null));
  });
  document.getElementById('pnote').value=b.text||'';
  document.getElementById('beatpop').hidden=false; lock(true);
}
/* A chip sets the frame color and the popup STAYS open (there's a text box
   here now); tapping the scrim is what closes it. */
document.querySelectorAll('.chip').forEach(function(c){
  c.onclick=function(ev){
    ev.stopPropagation();
    var col=c.getAttribute('data-c')||null;
    if(!popBeat)return;
    popBeat.color=col;
    document.getElementById('popimg').className=col?'c-'+col:'';
    document.querySelectorAll('.chip').forEach(function(x){
      x.classList.toggle('on',(x.getAttribute('data-c')||null)===col);
    });
    api('/color',{method:'POST',body:JSON.stringify({id:popBeat.id,color:col})})
      .then(function(r){return r.json()})
      .then(function(d){if(d.beats)beats=d.beats;});
  };
});
document.getElementById('pnote').onclick=function(ev){ev.stopPropagation();};
function saveNote(){
  if(!popBeat)return;
  var t=document.getElementById('pnote').value;
  if(t===(popBeat.text||''))return;
  popBeat.text=t;
  api('/text',{method:'POST',body:JSON.stringify({id:popBeat.id,text:t})})
    .then(function(r){return r.json()})
    .then(function(d){if(d.beats)beats=d.beats;});
}
function closeBeat(){saveNote(); document.getElementById('beatpop').hidden=true; popBeat=null; lock(false); render();}
document.getElementById('beatpop').onclick=function(ev){ if(ev.target===this)closeBeat(); };

load();
</script>
"""

out = os.path.join(ROOT, 'public', 'scratchpad.html')
open(out, 'w').write(page.replace('__FONT__', font))
print('built public/scratchpad.html', round(len(page) / 1024), 'KB (+font)')
