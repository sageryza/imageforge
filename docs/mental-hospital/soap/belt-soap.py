import json,urllib.request,os,html as H
B='https://imageforge-q125.onrender.com'; CHAT='soap-pill-scene'; SHEET='belt-soap'
def post(path,body):
    r=urllib.request.Request(B+'/api/chatfeed/'+path,data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
    return json.load(urllib.request.urlopen(r))
jobs=json.load(open('jobs-soap.json'))
state=json.load(open('belt-soap-state.json')) if os.path.exists('belt-soap-state.json') else {}
ver=state.get('ver',0)+1
tx=json.load(urllib.request.urlopen(B+'/api/chatfeed/verdict?chat=%s&sheet=%s'%(CHAT,SHEET))).get('texts',{})
def vlen(u): return '15s' if u.endswith('f3j8qh.mp4') else '25s' if 'a59ab8' in u else '4s'
secs=[]
for n,j in enumerate(jobs,1):
    k=j['key']; vids=[v for v in j['videos'] if v[1]]; pend=[v for v in j['videos'] if not v[1]]
    s=tx.get(k+'.s') or str(j['secs']); p=tx.get(k+'.p') or j['text']; pre=tx.get(k+'.pre') or j.get('pre') or ''
    minetxt=tx.get(k+'.mine') if (k+'.mine') in tx else '\n\n'.join(j['mine'])
    minebox='<details class="text"><summary>reference lines — mine, sent before your words (tap to edit)</summary><textarea class="p" data-key="%s" data-field="mine" spellcheck="false">%s</textarea><div class="saved" id="sv-%s-mine"></div></details>'%(k,H.escape(minetxt),k)
    prebox=('<details class="text" open><summary>what came before (yours, sent first)</summary><textarea class="p" data-key="%s" data-field="pre" spellcheck="false">%s</textarea><div class="saved" id="sv-%s-pre"></div></details>'%(k,H.escape(pre),k)) if pre else ''
    sends=' · '.join(['Seedance 2.5','480p','3:4','audio on']+['Video%d = %s'%(i+1,H.escape(v[0])) for i,v in enumerate(j['videos'])]+['Image%d = %s'%(i+1,H.escape(im[0])) for i,im in enumerate(j['images'])])
    films=''.join('<p class="vid">Video%d — <a href="%s" target="_blank">%s</a> · %s</p>'%(i+1,H.escape(v[1]),H.escape(v[0]),vlen(v[1])) for i,v in enumerate(vids))
    pending=''.join('<p class="pend">Video%d — %s — NOT MADE YET</p>'%(j['videos'].index(v)+1,H.escape(v[0])) for v in pend)
    stills=''.join('<figure><img loading="lazy" src="%s"><figcaption>Image%d — %s</figcaption></figure>'%(H.escape(im[1]),i+1,H.escape(im[0])) for i,im in enumerate(j['images']))
    mine=''
    note=('<p class="mine">%s</p>'%H.escape(j['note'])) if j['note'] else ''
    secs.append('''<section class="card" id="j-%(k)s" data-key="%(k)s" data-item="%(k)s">
<h2>%(n)d · %(t)s<span class="st">%(st)s</span></h2>
%(minebox)s%(prebox)s<details class="text" open><summary>your words</summary>
<textarea class="p" data-key="%(k)s" spellcheck="false">%(p)s</textarea><div class="saved" id="sv-%(k)s"></div></details>
<div class="attached">
<div class="row"><label>seconds <input class="secs" data-key="%(k)s" value="%(s)s" inputmode="numeric"></label><span class="cost" data-key="%(k)s"></span></div>
<p class="sends">%(sends)s</p>
%(films)s%(pending)s
<div class="refs">%(stills)s</div>
%(mine)s%(note)s
</div></section>'''%dict(minebox=minebox,prebox=prebox,k=k,n=n,t=H.escape(j['title']),st=H.escape(j['status']),p=H.escape(p),s=H.escape(s),sends=sends,films=films,pending=pending,stills=stills,mine=mine,note=note))
TOC=' · '.join('<a href="#j-%s">%d %s</a>'%(j['key'],i+1,H.escape(j['title'].split(' — ')[1] if ' — ' in j['title'] else j['title'])) for i,j in enumerate(jobs))
page='''<meta charset="utf-8"><link rel="stylesheet" href="/compare.css"><script src="/compare.js"></script>
<style>
.deck{display:flex;align-items:flex-start;overflow-x:auto;overflow-y:visible;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none} .deck::-webkit-scrollbar{display:none}
.card h2,.card .sends,.card .vid,.card .pend,.card .text summary{margin-right:58px}
.card{flex:0 0 100%;scroll-snap-align:start;scroll-snap-stop:always;box-sizing:border-box;padding:6px 14px 60px}
h2{font-size:16px;margin:0 0 6px} .st{display:block;font-size:11px;font-weight:400;color:#8a8176;text-transform:uppercase;letter-spacing:.04em;margin-top:2px}
.text summary{cursor:pointer;font-size:12px;text-decoration:underline;color:#6b6257;margin-bottom:6px}
textarea.p{width:100%;box-sizing:border-box;font-family:inherit;font-size:16px;line-height:1.5;padding:10px;border:1px solid #cfc6b6;border-radius:6px;background:#fff;resize:none;min-height:100px}
.saved{font-size:11px;color:#8a8176;min-height:14px;margin-top:3px} .saved.bad{color:#b5473c;font-weight:600}
.attached{margin-top:14px;padding-top:10px;border-top:1px solid #e3dccd}
.row{display:flex;align-items:center;gap:12px;font-size:13px;margin:0 0 8px} .row input{width:56px;font-family:inherit;font-size:16px;padding:4px 6px;border:1px solid #cfc6b6;border-radius:6px;background:#fff} .cost{color:#6b6257}
.sends{font-size:12px;color:#6b6257;line-height:1.5;margin:0 0 8px}
.pend{font-size:12px;color:#b5473c;margin:4px 0} .vid{font-size:12px;margin:4px 0} .vid a{color:inherit}
.refs{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:6px;margin:8px 0 12px} .refs figure{margin:0;position:relative} .refs img{width:100%;display:block;border-radius:0} .refs figcaption{position:static;display:block;font-size:10px;line-height:1.3;color:#6b6257;margin-top:3px;background:none;padding:0}
p.mine{font-size:12px;color:#8a8176;margin:6px 0 0} pre.mine{font:inherit;font-size:12px;color:#8a8176;white-space:pre-wrap;margin:4px 0 0;padding:6px 8px;border:1px dashed #cfc6b6;border-radius:6px}
.nav{display:flex;align-items:center;justify-content:space-between;padding:6px 0 8px;margin-right:64px;font-size:13px}
.nav button{font:inherit;border:1px solid #cfc6b6;border-radius:6px;background:#fff;padding:6px 12px}
</style>
<h1>The soap pill scene</h1>
<div class="nav"><button id="prev" type="button">‹ back</button><span id="pos"></span><button id="next" type="button">next ›</button></div>
<div class="deck" id="deck">__SECS__</div>
<script>
var CHAT='__CHAT__', SHEET='__SHEET__', LIMIT=8000;
function post(body){ return fetch('/api/chatfeed/verdict',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); }
function cost(k){ var s=parseInt(document.querySelector('.secs[data-key="'+k+'"]').value)||0; document.querySelector('.cost[data-key="'+k+'"]').textContent='$'+(s*0.15).toFixed(2)+' at 15¢/s'; }
document.querySelectorAll('.p[data-key]').forEach(function(ta){ var k=ta.getAttribute('data-key'), f=ta.getAttribute('data-field')||'p', sv=document.getElementById('sv-'+k+(f==='p'?'':'-'+f)), timer=null;
  function fit(){ta.style.height='auto'; ta.style.height=(ta.scrollHeight+2)+'px';} fit(); ta.closest('details').addEventListener('toggle',fit);
  function pieces(t){ var n=t.split(/\\r?\\n/).filter(function(l){return /^[ \\t]*cut[ \\t.!:]*$/i.test(l);}).length; return n?(' · '+(n+1)+' pieces'):''; }
  // A SAVE IS READ BACK, NEVER TRUSTED (2026-09-08, Sophie, after a 2,343-character scene lost its tail to a silent slice: "a stupid error that's gonna lose my edits"). Nothing is cut on the way out; over LIMIT the box refuses and says by how much; after every save the sheet is re-read and the box says so if the server kept less than it was sent.
  function bad(m){ sv.textContent=m; sv.classList.add('bad'); } function good(m){ sv.textContent=m; sv.classList.remove('bad'); }
  function save(t){ if(t.length>LIMIT){ bad('NOT SAVED — '+(t.length-LIMIT)+' characters over the box limit of '+LIMIT); return; }
    post({chat:CHAT,sheet:SHEET,item:k+'.'+f,text:t}).then(function(r){return r.json();}).then(function(j){ if(j.chars!=null && j.chars<t.length) throw new Error('short');
      return fetch('/api/chatfeed/verdict?chat='+encodeURIComponent(CHAT)+'&sheet='+encodeURIComponent(SHEET)).then(function(r){return r.json();}).then(function(d){ var kept=(d.texts||{})[k+'.'+f]; if(typeof kept==='string' && kept.length<t.length) throw new Error('short'); good('saved'+pieces(t)); });
    }).catch(function(e){ bad(e && e.message==='short' ? 'NOT SAVED WHOLE — the server kept less than you typed; copy your text somewhere safe' : 'not saved'); }); }
  ta.addEventListener('input',function(){ fit(); var t=ta.value; sv.textContent='…'+pieces(t); clearTimeout(timer); timer=setTimeout(function(){ save(t); },700); });
  window.addEventListener('pagehide',function(){ if(!timer) return; clearTimeout(timer); timer=null; try{ navigator.sendBeacon('/api/chatfeed/verdict', new Blob([JSON.stringify({chat:CHAT,sheet:SHEET,item:k+'.'+f,text:ta.value.slice(0,LIMIT)})],{type:'application/json'})); }catch(e){} });
});
document.querySelectorAll('.secs').forEach(function(inp){ var k=inp.getAttribute('data-key'); cost(k); inp.addEventListener('input',function(){ cost(k); post({chat:CHAT,sheet:SHEET,item:k+'.s',text:inp.value}); }); });
var deck=document.getElementById('deck'), cards=[].slice.call(deck.children), pos=document.getElementById('pos');
function at(){ return Math.round(deck.scrollLeft/deck.clientWidth); }
function go(i){ i=Math.max(0,Math.min(cards.length-1,i)); deck.scrollTo({left:i*deck.clientWidth,behavior:'smooth'}); }
function paintPos(){ pos.textContent=(at()+1)+' / '+cards.length; try{localStorage.setItem('beltsoap.at',at());}catch(e){} }
deck.addEventListener('scroll',function(){ clearTimeout(window.__pt); window.__pt=setTimeout(paintPos,80); });
document.getElementById('prev').onclick=function(){go(at()-1);}; document.getElementById('next').onclick=function(){go(at()+1);};
var h=(location.hash||'').replace('#j-',''); var start=cards.findIndex(function(c){return c.getAttribute('data-key')===h;}); if(start<0){ try{start=parseInt(localStorage.getItem('beltsoap.at'))||0;}catch(e){start=0;} }
setTimeout(function(){ deck.scrollLeft=start*deck.clientWidth; paintPos(); window.scrollTo(0,0); },50);
window.__compareNotes({chat:CHAT,sheet:'belt-soap-notes'});
window.__compareHelp({html:'<p class="toc">__TOC__</p><p>Five cards, scene 43 of your script — the soap pill — your words verbatim in the box. Type <b>cut</b> on a line of its own to split a scene; the line under the box counts the pieces. Fold the box (fold it with the underlined word). Above your words, folded: the reference lines of mine that go in front of them — open the fold to edit them. Under the line is what would go with it: seconds, the videos (playable), the stills. Nothing on this page is sent or wired until you say so.</p>'});
</script>
'''
page=page.replace('__CHAT__',CHAT).replace('__SHEET__',SHEET).replace('__TOC__',TOC).replace('__SECS__','\n'.join(secs))
open('belt-soap.html','w').write(page)
d=post('page',{'chat':CHAT,'title':'The soap pill scene v%d'%ver,'html':page}); print(d.get('id'),d.get('warnings'))
for old in state.get('ids',[]): post('page/'+old+'/supersede',{'superseded':True})
json.dump({'ver':ver,'ids':[d['id']]},open('belt-soap-state.json','w'))
