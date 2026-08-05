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
.wrap{max-width:34em; margin:0 auto; padding:calc(env(safe-area-inset-top,0px) + 8px) 5vw 16vh;}
.no{font-family:-apple-system,'Helvetica Neue',sans-serif; font-size:11px; letter-spacing:.34em; color:var(--ink2); text-transform:uppercase;}
/* SCRATCH PAD is the header: centered on its own line at the VERY top (the
   old 5vh wrap padding left it stranded mid-page in the app — Sophie's
   screenshot). The buttons live on the title row below, right-aligned and
   stopping 56px short of the pill's corner, so nothing overlaps the word. */
header{display:block; text-align:center; padding:6px 0 0;}
.titlerow{display:flex; align-items:center; gap:10px; padding-right:56px; margin-top:.4em;}
.titlerow #title{flex:1; min-width:0; margin:0;}
.sheethead{display:flex; align-items:center; gap:10px; padding:6px 56px 0 0;}
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
/* The beat's words, small, under the tile — tap to hear them in her voice. */
.bcap{font-size:.72em; line-height:1.3; color:var(--ink); background:none; border:none; padding:0;
  font-family:'EBGaramond',Georgia,serif; text-align:left; cursor:pointer; overflow-wrap:break-word;}
.bcap.busy{opacity:.45;}
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
#speak{width:34px; height:34px; display:flex; align-items:center; justify-content:center; padding:0;
  border:1.5px solid rgba(255,255,255,.55); border-radius:6px; background:none; color:#fff; cursor:pointer;}
#speak svg{width:17px; height:17px;}
#speak.busy{opacity:.45;}
/* An empty beat's popup: the blank paper tile with ONE icon in its middle —
   tap it for the Playground (the in-popup art generator comes later). */
#popblank{aspect-ratio:2/3; border:3px solid var(--line); border-radius:4px; background:var(--barbg);
  display:flex; align-items:center; justify-content:center; color:var(--ink2); padding:0; cursor:pointer;}
#popblank svg{width:26px; height:26px;}
#popblank.c-mustard{border-color:var(--mustard);} #popblank.c-green{border-color:var(--green);}
#popblank.c-blue{border-color:var(--blue);} #popblank.c-pink{border-color:var(--pink);}
#lightbox{position:fixed; inset:0; z-index:60; display:flex; align-items:center; justify-content:center;
  background:rgba(20,17,12,.94); padding:3vw;}
#lightbox img{max-width:94vw; max-height:88vh; border-radius:4px;}
</style>
<div class="wrap">
  <header>
    <div class="no">Scratch pad</div>
  </header>
  <div class="titlerow">
    <div id="title" contenteditable="true" spellcheck="false"></div>
    <button class="iconbtn" id="addbtn" aria-label="Add an empty beat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg></button>
    <button class="iconbtn" id="inboxbtn" aria-label="Hearted in the Playground"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></button>
  </div>
  <div id="pad"></div>
  <div class="state" id="empty" hidden>Empty page — the button top right opens what you hearted in the Playground.</div>
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
  <img id="popimg" alt="">
  <button id="popblank" hidden aria-label="Make its art in the Playground"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg></button>
  <div class="chips">
    <button class="chip gray" data-c=""></button>
    <button class="chip mustard" data-c="mustard"></button>
    <button class="chip green" data-c="green"></button>
    <button class="chip blue" data-c="blue"></button>
    <button class="chip pink" data-c="pink"></button>
  </div>
  <textarea id="pnote" rows="3"></textarea>
  <button id="speak" aria-label="Hear it in your voice"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/></svg></button>
</div>

<div id="lightbox" hidden><img id="lbimg" alt=""></div>

<script>
var TOKEN='__STUDIO_TOKEN__';
function api(p,opts){opts=opts||{};opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});
  if(TOKEN)opts.headers['x-studio-token']=TOKEN;return fetch('/api/scratchpad'+p,opts);}
var beats=[], inboxItems=[], pending=null, popBeat=null, padTitle='';
var player=new Audio();

function lock(v){document.body.style.overflow=v?'hidden':'';}

/* One shared player so a new tap replaces what's speaking, never stacks. */
function speakBeat(b, el){
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
    var wrap=document.createElement('div'); wrap.className='beatwrap';
    var el=document.createElement('button'); el.className='beat'+(b.color?' c-'+b.color:'');
    if(b.url){ var im=document.createElement('img'); im.src=b.url; im.alt=''; el.appendChild(im); }
    el.onclick=function(ev){ev.stopPropagation(); if(pending)return; openBeat(b);};
    wrap.appendChild(el);
    if(b.text){
      var cap=document.createElement('button'); cap.className='bcap'; cap.textContent=b.text;
      cap.onclick=function(ev){ev.stopPropagation(); if(pending)return; speakBeat(b, cap);};
      wrap.appendChild(cap);
    }
    pad.appendChild(wrap);
  });
  if(pending&&beats.length) slot(beats.length);
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

function load(){
  api('').then(function(r){return r.json()}).then(function(d){
    beats=d.beats||[]; padTitle=d.title||'';
    renderTitle(); render();
  });
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
  if(b.url){ im.style.width=w; im.src=b.url; im.className=b.color?'c-'+b.color:''; }
  else { bl.style.width=w; bl.className=b.color?'c-'+b.color:''; }
  document.querySelectorAll('.chip').forEach(function(c){
    c.classList.toggle('on',(c.getAttribute('data-c')||null)===(b.color||null));
  });
  document.getElementById('pnote').value=b.text||'';
  document.getElementById('beatpop').hidden=false; lock(true);
}
/* The blank tile's icon: make its art in the Playground. ?from=scratchpad
   tells that page to show a way back here. */
document.getElementById('popblank').onclick=function(ev){
  ev.stopPropagation();
  location.href='/playground?from=scratchpad';
};
/* A chip sets the frame color and the popup STAYS open (there's a text box
   here now); tapping the scrim is what closes it. */
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
function closeBeat(){saveNote(); document.getElementById('beatpop').hidden=true; popBeat=null; lock(false); render();}
document.getElementById('beatpop').onclick=function(ev){ if(ev.target===this)closeBeat(); };

load();
</script>
"""

out = os.path.join(ROOT, 'public', 'scratchpad.html')
open(out, 'w').write(page.replace('__FONT__', font))
print('built public/scratchpad.html', round(len(page) / 1024), 'KB (+font)')
