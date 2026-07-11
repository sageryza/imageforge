import json, base64, re, html
from difflib import SequenceMatcher

import os
ROOT=os.path.join(os.path.dirname(__file__),'..')
WD=os.path.join(ROOT,'docs','dating-book','working-drafts')
feat=json.load(open(os.path.join(WD,'featured2.json')))
orig=json.load(open(os.path.join(WD,'originals.json')))
font=base64.b64encode(open(os.path.join(ROOT,'ios','ImageForge','EBGaramond.ttf'),'rb').read()).decode()
ORDER=["Griffin","David","Jake","Blake","Louis","Patrick","Trevor","Gabriel"]
byname={e["name"]:e for e in feat}

def smart(s):
    s=s.replace('...','…')
    s=re.sub(r"(^|[\s(\[])'", r'\1‘', s)
    s=s.replace("'","’")
    s=re.sub(r'(^|[\s(\[])"', r'\1“', s)
    s=s.replace(' - ',' — ').replace('--','—')
    s=s.replace('"','”')
    return s
def esc(x): return html.escape(x, quote=False)
def norm(w): return re.sub(r"[^\w]","",w.lower().replace("’","'"))
def sentences(t):
    parts=re.split(r'(?<=[.!?”])\s+(?=[A-Z“I])', t)
    return [p.strip() for p in parts if p.strip()]
PN=["PAGE ONE","PAGE TWO","PAGE THREE"]

def render_marked(words,flags):
    out=[];i=0
    while i<len(words):
        j=i
        while j<len(words) and flags[j]==flags[i]: j+=1
        seg=esc(' '.join(words[i:j]))
        out.append(('<mark>'+seg+'</mark>') if flags[i] else seg); i=j
    return ' '.join(out)

sections=""; index_rows=""; DATES=[]
for no,name in enumerate(ORDER,1):
    e=byname[name]; key=name.lower()
    pages=[smart(p) for p in e["pages"]]
    blocks=[]
    for pi,page in enumerate(pages):
        chunk=[]
        for s in sentences(page):
            chunk.append(s)
            if len(' '.join(chunk).split())>=55:
                blocks.append((pi,' '.join(chunk).split())); chunk=[]
        if chunk: blocks.append((pi,' '.join(chunk).split()))
    all_my=[w for _,ws in blocks for w in ws]
    a=[norm(w) for w in all_my]; b=[norm(w) for w in smart(orig[name]).split()]
    flags=[True]*len(a)
    for tag,i1,i2,j1,j2 in SequenceMatcher(None,a,b,autojunk=False).get_opcodes():
        if tag=="equal":
            for k in range(i1,i2): flags[k]=False
    pct=round(100*sum(flags)/max(1,len(flags)))
    chtml=""; lastp=-1; pos=0; bi=0
    for pi,ws in blocks:
        if pi!=lastp: chtml+=f'<div class="pagemark">{PN[pi]}</div>\n'; lastp=pi
        f=flags[pos:pos+len(ws)]; pos+=len(ws)
        nid=f"{key}:c{bi}"
        chtml+=(f'<div class="block" data-i="{nid}"><p>{render_marked(ws,f)}</p>'
                f'<button class="addnote" data-i="{nid}">+ note</button><div class="notewrap" id="nw-{key}-c{bi}"></div></div>\n')
        bi+=1
    ohtml=""; oi=0
    for para in [l.strip() for l in orig[name].split("\n") if l.strip() and l.strip()!="![]()"]:
        nid=f"{key}:o{oi}"
        ohtml+=(f'<div class="block" data-i="{nid}"><p>{esc(smart(para))}</p>'
                f'<button class="addnote" data-i="{nid}">+ note</button><div class="notewrap" id="nw-{key}-o{oi}"></div></div>\n')
        oi+=1
    DATES.append({
        "id":key, "no":no, "name":name, "dek":smart(e["dek"]), "pages":len(pages),
        "claudeBlocks":[{"page":pi,"spans":None} for pi,_ in blocks],  # filled below
        "original":[l.strip() for l in orig[name].split("\n") if l.strip() and l.strip()!='![]()'],
    })
    # spans: rebuild per block from flags
    pos2=0
    spanned=[]
    for pi,ws in blocks:
        f2=flags[pos2:pos2+len(ws)]; pos2+=len(ws)
        spans=[];i2=0
        while i2<len(ws):
            j2=i2
            while j2<len(ws) and f2[j2]==f2[i2]: j2+=1
            spans.append({"t":" ".join(ws[i2:j2]),"c":bool(f2[i2])}); i2=j2
        spanned.append({"page":pi,"spans":spans})
    DATES[-1]["claudeBlocks"]=spanned
    npages=len(pages)
    index_rows+=(f'<button class="row" data-d="{key}"><span class="r-no">no.&#8201;{no:02d}</span>'
                 f'<span class="r-body"><span class="r-name">{esc(name)}</span>'
                 f'<span class="r-dek">{esc(smart(e["dek"]))}</span></span>'
                 f'<span class="r-meta"><span class="r-pg">{npages} {"page" if npages==1 else "pages"}</span>'
                 f'<span class="r-notes" id="cnt-{key}"></span></span></button>\n')
    sections+=f"""<section class="date" id="d-{key}" style="display:none">
<header><div class="no">no.&#8201;{no:02d} · someone i met once</div><h1>{esc(name)}</h1>
<div class="rule"></div><div class="dek">{esc(smart(e["dek"]))}</div></header>
<div class="tabs"><div class="seg"><button class="tab on" data-v="c">Claude&rsquo;s</button><button class="tab" data-v="o">Mine</button></div></div>
<div class="legend"><mark>red</mark>&nbsp;= words Claude changed or added ({pct}%) · tap text to pause autoscroll</div>
<div class="verC">{chtml}</div>
<div class="verO" style="display:none">{ohtml}</div>
<div class="endmark">&#10086;</div>
<div class="summary"><h2>Your notes on {esc(name)}</h2><div class="slist"></div>
<button class="btn primary copybtn" data-d="{key}" style="margin-top:.5em">Copy notes</button></div>
</section>\n"""

page=f"""<title>Someone I Met Once — read &amp; note</title>
<style>
@font-face{{font-family:'EBGaramond';font-weight:400 700;font-display:swap;src:url(data:font/ttf;base64,{font}) format('truetype');}}
:root{{ --paper:#f6f2e9; --ink:#26221c; --ink2:#8a8377; --line:#d9d2c2; --rose:#a5586a; --chg:#b3443f; --barbg:#fffdf7; }}
@media (prefers-color-scheme: dark){{:root{{--paper:#191713; --ink:#e8e2d6; --ink2:#97907f; --line:#37322a; --rose:#c98a99; --chg:#e08b84; --barbg:#211e19;}}}}
:root[data-theme="dark"]{{--paper:#191713; --ink:#e8e2d6; --ink2:#97907f; --line:#37322a; --rose:#c98a99; --chg:#e08b84; --barbg:#211e19;}}
:root[data-theme="light"]{{--paper:#f6f2e9; --ink:#26221c; --ink2:#8a8377; --line:#d9d2c2; --rose:#a5586a; --chg:#b3443f; --barbg:#fffdf7;}}
html{{background:var(--paper);}}
body{{margin:0; background:var(--paper); color:var(--ink); font-family:'EBGaramond',Georgia,serif;}}
.wrap{{max-width:34em; margin:0 auto; padding:5vh 6vw 22vh;}}
.no{{font-family:-apple-system,'Helvetica Neue',sans-serif; font-size:11px; letter-spacing:.34em; color:var(--ink2); text-transform:uppercase;}}
h1{{font-weight:600; font-size:2.7em; line-height:1; margin:.15em 0 .3em;}}
.rule{{height:1px; background:var(--line); margin:1.1em 0;}}
.dek{{font-style:italic; color:var(--ink2); font-size:1.1em;}}
#home h1{{font-size:2.2em; margin:.2em 0 .1em;}}
#home .sub{{font-style:italic; color:var(--ink2); margin-bottom:2.2em;}}
.row{{display:flex; gap:14px; align-items:baseline; width:100%; text-align:left; background:none; border:none; border-bottom:1px solid var(--line);
  padding:18px 2px; cursor:pointer; color:var(--ink); font-family:'EBGaramond',Georgia,serif;}}
.row:focus-visible{{outline:2px solid var(--rose);}}
.r-no{{font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.25em; color:var(--ink2); text-transform:uppercase; min-width:3.4em;}}
.r-body{{flex:1; display:flex; flex-direction:column; gap:2px;}}
.r-name{{font-size:1.45em; font-weight:600;}}
.r-dek{{font-style:italic; color:var(--ink2); font-size:.98em;}}
.r-meta{{display:flex; flex-direction:column; align-items:flex-end; gap:3px;}}
.r-pg{{font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.12em; color:var(--ink2); text-transform:uppercase;}}
.r-notes{{font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.08em; color:var(--rose);}}
.tabs{{position:sticky; top:0; z-index:5; display:flex; gap:8px; padding:12px 62px 12px 58px; background:color-mix(in srgb, var(--paper) 93%, transparent); backdrop-filter:blur(6px);}}
.seg{{flex:1; display:flex; border:1.5px solid var(--ink); border-radius:999px; overflow:hidden; background:var(--paper);}}
.tab{{flex:1; font-family:-apple-system,'Helvetica Neue',sans-serif; font-size:12px; letter-spacing:.1em; text-transform:uppercase;
  border:none; background:transparent; color:var(--ink); padding:9px 0; cursor:pointer;}}
.tab + .tab{{border-left:1.5px solid var(--ink);}}
.tab.on{{background:color-mix(in srgb, var(--chg) 18%, var(--paper)); font-weight:600;}}
.tab:focus-visible{{outline:2px solid var(--rose);}}
.legend{{font-family:-apple-system,sans-serif; font-size:11px; color:var(--ink2); letter-spacing:.05em; margin:.6em 0 2em;}}
.legend mark{{background:none; color:var(--chg); font-family:'EBGaramond',serif; font-size:14px; font-style:italic;}}
mark{{background:none; color:var(--chg);}}
.pagemark{{font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.3em; color:var(--ink2); margin:3em 0 1.4em; text-transform:uppercase;}}
.block{{margin:0 0 1.35em;}}
.block p{{font-size:19px; line-height:1.72; margin:0;}}
.addnote{{display:block; margin:.35em 0 0 auto; background:none; border:none; color:var(--ink2); opacity:.55;
  font-family:-apple-system,sans-serif; font-size:11px; letter-spacing:.12em; text-transform:uppercase; cursor:pointer; padding:4px 2px;}}
.addnote:focus-visible{{outline:2px solid var(--rose); border-radius:4px;}}
.notehead{{display:flex; align-items:center; gap:8px; margin-bottom:6px;}}
.micbtn{{width:38px; height:32px; border-radius:6px; border:1px solid var(--line); background:var(--barbg); color:var(--ink2); cursor:pointer; display:flex; align-items:center; justify-content:center;}}
.micbtn.rec{{background:color-mix(in srgb, var(--chg) 20%, var(--paper)); border-color:var(--chg); color:var(--chg);}}
.micbtn:focus-visible{{outline:2px solid var(--rose);}}
.miclbl{{font-family:-apple-system,sans-serif; font-size:11px; color:var(--ink2); letter-spacing:.05em;}}
.notebox textarea{{width:100%; box-sizing:border-box; min-height:70px; font-family:'EBGaramond',Georgia,serif; font-size:16px;
  background:var(--barbg); color:var(--ink); border:1px solid var(--line); border-radius:6px; padding:10px;}}
.noteactions{{display:flex; gap:8px; margin-top:6px;}}
.btn{{font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.08em; text-transform:uppercase;
  border:1px solid var(--line); background:var(--barbg); color:var(--ink); border-radius:6px; padding:8px 14px; cursor:pointer;}}
.btn.primary{{border-color:var(--rose); color:var(--rose);}}
.btn:focus-visible{{outline:2px solid var(--rose);}}
.savednote{{margin:.6em 0 0; padding:.1em 0 .1em 1em; border-left:2px solid var(--rose); color:var(--rose); font-style:italic; font-size:16.5px; line-height:1.55; white-space:pre-wrap;}}
.savednote .del{{background:none; border:none; color:var(--ink2); font-size:11px; cursor:pointer; margin-left:8px; font-family:-apple-system,sans-serif; text-transform:uppercase; letter-spacing:.1em;}}
.summary{{margin-top:4em; border-top:1px solid var(--line); padding-top:2em; display:none;}}
.summary h2{{font-weight:600; font-size:1.4em; margin:0 0 1em;}}
.summary .s-item{{margin:0 0 1.2em; font-size:16px; line-height:1.5;}}
.summary .s-quote{{color:var(--ink2); font-style:italic;}}
.summary .s-note{{color:var(--rose);}}
.endmark{{text-align:center; color:var(--ink2); margin-top:3.5em; font-size:1.2em;}}
.float{{position:fixed; top:max(14px, env(safe-area-inset-top)); right:max(14px,4vw); z-index:9; display:none; flex-direction:column; gap:8px; align-items:center;}}
body.reading .float{{display:flex;}}
.fbtn{{width:48px; height:44px; border-radius:6px; border:1px solid var(--line); background:var(--barbg); color:var(--ink);
  font-size:17px; cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,.09); display:flex; align-items:center; justify-content:center;}}
.fbtn.on{{background:color-mix(in srgb, var(--chg) 18%, var(--paper)); border-color:var(--chg); color:var(--chg);}}
.fbtn.small{{width:48px; height:32px; font-size:15px; color:var(--ink2);}}
.fbtn:focus-visible{{outline:2px solid var(--rose);}}
#spd{{font-family:-apple-system,sans-serif; font-size:10px; color:var(--ink2); font-variant-numeric:tabular-nums;}}
.backwrap{{position:fixed; top:max(14px, env(safe-area-inset-top)); left:max(14px,4vw); z-index:9; display:none;}}
body.reading .backwrap{{display:block;}}
#back{{width:44px; height:44px; border-radius:6px; border:1px solid var(--line); background:var(--barbg); color:var(--ink2);
  font-size:20px; cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,.09);}}
#toast{{position:fixed; bottom:max(20px, env(safe-area-inset-bottom)); left:50%; transform:translateX(-50%);
  background:var(--ink); color:var(--paper); font-family:-apple-system,sans-serif; font-size:12px; letter-spacing:.06em;
  padding:8px 14px; border-radius:6px; opacity:0; transition:opacity .25s; pointer-events:none;}}
@media (prefers-reduced-motion: reduce){{ #toast{{transition:none;}} }}
</style>
<div class="backwrap"><button id="back" aria-label="Back to the list">&#8249;</button></div>
<div class="float">
  <button class="fbtn" id="up" aria-label="Scroll up"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg></button>
  <button class="fbtn" id="down" aria-label="Scroll down"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>
  <button class="fbtn small" id="slow" aria-label="Slower">&minus;</button>
  <span id="spd">0.6&times;</span>
  <button class="fbtn small" id="fast" aria-label="Faster">+</button>
</div>
<div class="wrap">
<section id="home">
  <div class="no">someone i met once · working drafts</div>
  <h1>The Dates</h1>
  <div class="sub">Tap a date to read. Two versions inside — mine and Claude&rsquo;s, with every change in red.</div>
  {index_rows}
</section>
{sections}
</div>
<div id="toast"></div>
<script>
(function(){{
var notes={{}}, store=null, cur=null;
var TOKEN='__STUDIO_TOKEN__';
function api(path,opt){{ opt=opt||{{}}; opt.headers=Object.assign({{'x-studio-token':TOKEN,'Content-Type':'application/json'}},opt.headers||{{}}); return fetch(path,opt); }}
try{{ localStorage.setItem('__t','1'); localStorage.removeItem('__t'); store=localStorage; }}catch(e){{}}
if(store){{ try{{ notes=JSON.parse(store.getItem('dates-notes-v1')||'{{}}'); }}catch(e){{ notes={{}}; }} }}
function nwId(id){{ return 'nw-'+id.replace(':','-'); }}
function docId(id){{ return id.replace(/[^a-zA-Z0-9_-]/g,'_'); }}
function syncNote(id){{
  var n=notes[id];
  if(n===undefined){{ api('/api/writing/notes/'+docId(id),{{method:'DELETE'}}).catch(function(){{}}); return; }}
  var body={{ key:id, dateId:id.split(':')[0], blockId:id.split(':')[1], version:id.split(':')[1][0],
    excerpt:excerpt(id), text:(typeof n==='string')?n:(n.t||'') }};
  if(n&&typeof n==='object'&&n.a&&n.a.slice(0,5)==='data:') body.audio=n.a;
  api('/api/writing/notes',{{method:'POST',body:JSON.stringify(body)}})
    .then(function(r){{return r.json()}})
    .then(function(d){{ if(d&&d.audioUrl&&notes[id]&&typeof notes[id]==='object'){{ notes[id].a=d.audioUrl; mirror(); }} }})
    .catch(function(){{ toast('Offline — note kept on this phone'); }});
}}
function mirror(){{ if(store) try{{ store.setItem('dates-notes-v1', JSON.stringify(notes)); }}catch(e){{}} }}
var lastChanged=null;
function persist(id){{ mirror(); renderSummaries(); renderCounts(); if(id!==undefined) syncNote(id); }}
api('/api/writing/notes').then(function(r){{return r.json()}}).then(function(d){{
  if(!d||!d.notes) return;
  d.notes.forEach(function(n){{
    var id=n.dateId+':'+n.blockId;
    notes[id]={{ t:n.text||'', a:n.audioUrl||n.audioData||null }};
    if(!notes[id].a) notes[id]=notes[id].t;
    renderNote(id);
  }});
  mirror(); renderSummaries(); renderCounts();
}}).catch(function(){{}});
function excerpt(id){{
  var p=document.querySelector('.block[data-i="'+id+'"] p');
  var t=p?p.textContent:''; return t.length>70? t.slice(0,70)+'…' : t;
}}
function noteText(id){{ var n=notes[id]; return (typeof n==='string')? n : (n&&n.t||''); }}
function noteAudio(id){{ var n=notes[id]; return (n&&typeof n==='object'&&n.a)||null; }}
function renderNote(id){{
  var wrap=document.getElementById(nwId(id)); if(!wrap) return; wrap.innerHTML='';
  if(notes[id]){{
    var d=document.createElement('div'); d.className='savednote';
    d.textContent=noteText(id);
    if(noteAudio(id)){{ var au=document.createElement('audio'); au.controls=true; au.src=noteAudio(id); au.style.display='block'; au.style.marginTop='6px'; au.style.width='100%'; d.appendChild(au); }}
    var del=document.createElement('button'); del.className='del'; del.textContent='remove';
    del.onclick=function(){{ delete notes[id]; persist(id); renderNote(id); }};
    d.appendChild(del); wrap.appendChild(d);
  }}
}}
function renderSummaries(){{
  document.querySelectorAll('section.date').forEach(function(sec){{
    var key=sec.id.slice(2); var sum=sec.querySelector('.summary'); var list=sec.querySelector('.slist');
    var keys=Object.keys(notes).filter(function(id){{return id.split(':')[0]===key}}).sort();
    if(!keys.length){{ sum.style.display='none'; return; }}
    sum.style.display='block'; list.innerHTML='';
    keys.forEach(function(id){{
      var d=document.createElement('div'); d.className='s-item';
      var tag=id.split(':')[1][0]==='c'?'Claude&rsquo;s version':'my original';
      d.innerHTML='<div class="s-quote">['+tag+'] &ldquo;'+excerpt(id).replace(/</g,'&lt;')+'&rdquo;</div>';
      var n=document.createElement('div'); n.className='s-note'; n.textContent=noteText(id)+(noteAudio(id)?' [voice note]':''); d.appendChild(n);
      list.appendChild(d);
    }});
  }});
}}
function renderCounts(){{
  document.querySelectorAll('.r-notes').forEach(function(el){{
    var key=el.id.slice(4);
    var n=Object.keys(notes).filter(function(id){{return id.split(':')[0]===key}}).length;
    el.textContent = n? (n+(n===1?' note':' notes')) : '';
  }});
}}
document.querySelectorAll('.addnote').forEach(function(btn){{
  btn.onclick=function(){{
    stop();
    var id=btn.dataset.i, wrap=document.getElementById(nwId(id));
    if(wrap.querySelector('.notebox')){{ wrap.querySelector('textarea').focus(); return; }}
    var box=document.createElement('div'); box.className='notebox';
    var head=document.createElement('div'); head.className='notehead';
    var mic=document.createElement('button'); mic.className='micbtn'; mic.setAttribute('aria-label','Record a voice note');
    mic.innerHTML='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>';
    var micLbl=document.createElement('span'); micLbl.className='miclbl'; micLbl.textContent='';
    head.appendChild(mic); head.appendChild(micLbl);
    var ta=document.createElement('textarea'); ta.value=noteText(id); ta.placeholder='Your note…';
    var pendingAudio=noteAudio(id);
    var acts=document.createElement('div'); acts.className='noteactions';
    var save=document.createElement('button'); save.className='btn primary'; save.textContent='Save';
    var cancel=document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancel';
    var cancelled=false, saved=false;
    function doSave(){{
      if(saved||cancelled) return; saved=true;
      var v=ta.value.trim();
      if(v||pendingAudio) notes[id]= pendingAudio? {{t:v,a:pendingAudio}} : v; else delete notes[id];
      persist(id); box.remove(); renderNote(id);
    }}
    save.onclick=doSave;
    cancel.onmousedown=function(){{ cancelled=true; }};
    cancel.onclick=function(){{ box.remove(); renderNote(id); }};
    ta.addEventListener('blur',function(){{ setTimeout(function(){{ if(!cancelled&&!saved&&!recording&&document.body.contains(box)&&!box.contains(document.activeElement)) doSave(); }},180); }});
    var recording=false, mrec=null;
    mic.onclick=function(){{
      if(recording){{ mrec.stop(); return; }}
      if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||typeof MediaRecorder==='undefined'){{ toast('Mic not available here \u2014 voice notes will work in the app'); return; }}
      navigator.mediaDevices.getUserMedia({{audio:true}}).then(function(stream){{
        var chunks=[]; mrec=new MediaRecorder(stream);
        mrec.ondataavailable=function(e){{ if(e.data.size) chunks.push(e.data); }};
        mrec.onstop=function(){{
          stream.getTracks().forEach(function(t){{t.stop()}});
          recording=false; mic.classList.remove('rec'); micLbl.textContent='voice note attached';
          var blob=new Blob(chunks,{{type:mrec.mimeType||'audio/webm'}});
          if(blob.size>2500000){{ toast('Recording too long to keep here \u2014 keep them under ~2 min'); return; }}
          var r=new FileReader(); r.onload=function(){{ pendingAudio=r.result; }}; r.readAsDataURL(blob);
        }};
        mrec.start(); recording=true; mic.classList.add('rec'); micLbl.textContent='recording\u2026 tap to stop';
      }}, function(){{ toast('Mic not available here \u2014 voice notes will work in the app'); }});
    }};
    acts.appendChild(save); acts.appendChild(cancel);
    box.appendChild(head); box.appendChild(ta); box.appendChild(acts);
    wrap.innerHTML=''; wrap.appendChild(box); ta.focus();
  }};
}});
Object.keys(notes).forEach(renderNote); renderSummaries(); renderCounts();

function open(key){{
  cur=key;
  document.getElementById('home').style.display='none';
  document.querySelectorAll('section.date').forEach(function(s){{ s.style.display = s.id==='d-'+key?'':'none'; }});
  document.body.classList.add('reading');
  window.scrollTo(0,0);
}}
function goHome(){{
  stop(); cur=null;
  document.querySelectorAll('section.date').forEach(function(s){{ s.style.display='none'; }});
  document.getElementById('home').style.display='';
  document.body.classList.remove('reading');
  window.scrollTo(0,0);
}}
document.querySelectorAll('.row').forEach(function(r){{ r.onclick=function(){{ open(r.dataset.d); }}; }});
document.getElementById('back').onclick=goHome;
document.querySelectorAll('section.date .tabs').forEach(function(tabs){{
  var sec=tabs.closest('section');
  tabs.querySelectorAll('.tab').forEach(function(t){{
    t.onclick=function(){{
      stop();
      tabs.querySelectorAll('.tab').forEach(function(x){{x.classList.toggle('on',x===t)}});
      sec.querySelector('.verC').style.display = t.dataset.v==='c'?'':'none';
      sec.querySelector('.verO').style.display = t.dataset.v==='o'?'':'none';
      sec.querySelector('.legend').style.display = t.dataset.v==='c'?'':'none';
    }};
  }});
}});

var playing=false, raf=null, last=null, speed=0.6, dir=1, acc=0;
var upBtn=document.getElementById('up'), downBtn=document.getElementById('down');
function step(ts){{
  if(!playing) return;
  if(last!=null){{
    acc += dir*(ts-last)/1000*42*speed;
    var move = acc>0 ? Math.floor(acc) : Math.ceil(acc);
    if(move!==0){{ window.scrollBy(0,move); acc-=move; }}
    var atEnd = dir>0 ? (window.innerHeight+window.scrollY>=document.body.scrollHeight-4) : (window.scrollY<=2);
    if(atEnd) stop(); }}
  last=ts; raf=requestAnimationFrame(step);
}}
function paint(){{ upBtn.classList.toggle('on', playing&&dir<0); downBtn.classList.toggle('on', playing&&dir>0); }}
function start(d){{ dir=d; playing=true; last=null; acc=0; paint(); raf=requestAnimationFrame(step); }}
function stop(){{ playing=false; if(raf) cancelAnimationFrame(raf); paint(); }}
upBtn.onclick=function(){{ (playing&&dir<0)?stop():start(-1); }};
downBtn.onclick=function(){{ (playing&&dir>0)?stop():start(1); }};
document.querySelector('.wrap').addEventListener('click',function(e){{
  if(playing && !e.target.closest('button') && !e.target.closest('.notebox')) stop();
}});
document.getElementById('slow').onclick=function(){{ speed=Math.max(.1,+(speed-0.1).toFixed(1)); document.getElementById('spd').textContent=speed.toFixed(1)+'\\u00d7'; }};
document.getElementById('fast').onclick=function(){{ speed=Math.min(2,+(speed+0.1).toFixed(1)); document.getElementById('spd').textContent=speed.toFixed(1)+'\\u00d7'; }};
function toast(m){{ var t=document.getElementById('toast'); t.textContent=m; t.style.opacity=1; setTimeout(function(){{t.style.opacity=0}},1800); }}
document.querySelectorAll('.copybtn').forEach(function(b){{
  b.onclick=function(){{
    var key=b.dataset.d;
    var keys=Object.keys(notes).filter(function(id){{return id.split(':')[0]===key}}).sort();
    if(!keys.length){{ toast('No notes yet'); return; }}
    var out='Notes on '+key.charAt(0).toUpperCase()+key.slice(1)+':\\n'+keys.map(function(id){{
      var tag=id.split(':')[1][0]==='c'?"[Claude's version]":"[my original]";
      var body=noteText(id)+(noteAudio(id)?' [voice note]':'');
      return tag+' \\u201c'+excerpt(id)+'\\u201d\\n\\u2192 '+body; }}).join('\\n\\n');
    function ok(){{ toast('Copied \\u2014 paste it to Claude'); }}
    function fallback(){{ var ta=document.createElement('textarea'); ta.value=out; document.body.appendChild(ta); ta.select();
      try{{ document.execCommand('copy'); ok(); }}catch(e){{ toast('Select & copy from this list'); }} ta.remove(); }}
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(out).then(ok,fallback); else fallback();
  }};
}});
}})();
</script>
"""
open(os.path.join(ROOT,'public','writing.html'),'w',encoding='utf-8').write(page)
json.dump({"updated":None,"dates":DATES}, open(os.path.join(WD,'dates.json'),'w',encoding='utf-8'), ensure_ascii=False)
print("built public/writing.html", round(len(page)/1024),"KB and dates.json")
