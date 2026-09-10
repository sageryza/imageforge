import json,urllib.request,os,html as H
# belt.py — THE NAUTCHAUG DRAFT BELT (2026-09-09). One swipe deck, film order,
# one card per main shot of her script (jobs.json, built by cards.py — her
# words verbatim), every card wired for Seedance 2.0 MINI · 480p · 16:9 ·
# sound on through Atlas Cloud (1.1¢/s on the sale; APIFRAME is the other
# door at 4¢/s). Nothing on the page sends anything: her seconds and her
# edits save on verdict sheet `belt-nautchaug`; a clip goes out only on her
# "go" for that exact card. Lifted from docs/mental-hospital/belt/belt-md.py
# (the read-back saver and the deck are byte-for-byte that page's).
B='https://imageforge-q125.onrender.com'
CHAT=os.environ.get('BELT_CHAT','new-script-draft'); SHEET='belt-nautchaug'
KEYS=[k for k in os.environ.get('BELT_KEYS','').split(',') if k]
TITLE=os.environ.get('BELT_TITLE',"The Nautchaug Boyfriend's — the draft belt")
STATE='belt-state.json'
def post(path,body):
    r=urllib.request.Request(B+'/api/chatfeed/'+path,data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
    return json.load(urllib.request.urlopen(r))
jobs=json.load(open('jobs.json'))
if KEYS: jobs=[j for j in jobs if j['key'] in KEYS]
left=json.load(open('left-out.json'))
state=json.load(open(STATE)) if os.path.exists(STATE) else {}
ver=state.get('ver',0)+1
tx=json.load(urllib.request.urlopen(B+'/api/chatfeed/verdict?chat=%s&sheet=%s'%(CHAT,SHEET))).get('texts',{})
secs=[]; lastep=None
import json as _j
for n,j in enumerate(jobs,1):
    k=j['key']
    s=tx.get(k+'.s') or str(j['secs']); p=tx.get(k+'.p') or j['text']
    mine=tx.get(k+'.mine') if (k+'.mine') in tx else '\n\n'.join(j['mine'])
    ephead=('<p class="ep">%s</p>'%H.escape(j['ep'])) if j['ep']!=lastep else ''; lastep=j['ep']
    minebox='<details class="text"><summary>header lines (mine, sent before your words — edit them)</summary><textarea class="p" data-key="%s" data-field="mine" spellcheck="false">%s</textarea><div class="saved" id="sv-%s-mine"></div></details>'%(k,H.escape(mine),k)
    sends=' · '.join(['Seedance 2.0 Mini','480p','16:9','sound on','Atlas Cloud']+['Image%d = %s'%(i+1,H.escape(im[0])) for i,im in enumerate(j['images'])])
    stills=''.join('<figure><img loading="lazy" src="%s"><figcaption>Image%d — %s</figcaption></figure>'%(H.escape(im[1]),i+1,H.escape(im[0])) for i,im in enumerate(j['images']))
    others=[c for c in j['cast'] if c!='sophie']
    cast='<p class="mine">in the shot: %s — %s</p>'%(H.escape(', '.join(j['cast'])), 'Sophie from image 1; everyone else drawn from your words on their first clip, then carried forward from that clip' if others else 'from image 1')
    note=('<p class="mine">%s</p>'%H.escape(j['note'])) if j['note'] else ''
    secs.append('''<section class="card" id="j-%(k)s" data-key="%(k)s" data-item="%(k)s">
%(ephead)s<h2>%(n)d · %(t)s<span class="st">%(st)s</span></h2>
%(minebox)s<details class="text" open><summary>your words</summary>
<textarea class="p" data-key="%(k)s" spellcheck="false">%(p)s</textarea><div class="saved" id="sv-%(k)s"></div></details>
<div class="attached">
<div class="row"><label>seconds <input class="secs" data-key="%(k)s" value="%(s)s" inputmode="numeric"></label><span class="cost" data-key="%(k)s"></span></div>
<p class="sends">%(sends)s</p>
<div class="refs">%(stills)s</div>
%(cast)s%(note)s
<p class="sendrow"><a class="tofoot" href="https://imageforge-q125.onrender.com/footage" target="_blank" rel="noopener" data-key="%(k)s" data-title="%(t)s">Send to Footage ›</a><script type="application/json" class="refjson" data-key="%(k)s">%(refjson)s</script></p>
</div></section>'''%dict(ephead=ephead,minebox=minebox,k=k,n=n,t=H.escape(j['title']),st=H.escape(j['status']),p=H.escape(p),s=H.escape(s),sends=sends,stills=stills,cast=cast,note=note,refjson=_j.dumps([{'url':im[1],'kind':'image','name':im[0]} for im in j['images']]).replace('</','<\\/')))
TOC=' · '.join('<a href="#j-%s">%d %s</a>'%(j['key'],i+1,H.escape(j['title'])) for i,j in enumerate(jobs))
LEFT=''.join('<li>%s</li>'%H.escape(x) for x in left)
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
.ep{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#8a8176;margin:0 0 4px}
.sendrow{margin:0 0 10px} .tofoot{display:inline-block;font:inherit;font-size:13px;padding:7px 12px;border:1px solid #2b2622;border-radius:6px;color:#2b2622;background:#fff;text-decoration:none}
.sends{font-size:12px;color:#6b6257;line-height:1.5;margin:0 0 8px}
.pend{font-size:12px;color:#b5473c;margin:4px 0} .vid{font-size:12px;margin:4px 0} .vid a{color:inherit}
.refs{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:6px;margin:8px 0 12px} .refs figure{margin:0;position:relative} .refs img{width:100%;display:block;border-radius:0} .refs figcaption{position:static;display:block;font-size:10px;line-height:1.3;color:#6b6257;margin-top:3px;background:none;padding:0}
p.mine{font-size:12px;color:#8a8176;margin:6px 0 0} pre.mine{font:inherit;font-size:12px;color:#8a8176;white-space:pre-wrap;margin:4px 0 0;padding:6px 8px;border:1px dashed #cfc6b6;border-radius:6px}
.nav{display:flex;align-items:center;justify-content:space-between;padding:6px 0 8px;margin-right:64px;font-size:13px}
.nav button{font:inherit;border:1px solid #cfc6b6;border-radius:6px;background:#fff;padding:6px 12px}
</style>
<h1>__TITLE__</h1>
<div class="nav"><button id="prev" type="button">‹ back</button><span id="pos"></span><button id="next" type="button">next ›</button></div>
<div class="deck" id="deck">__SECS__</div>
<script>
var CHAT='__CHAT__', SHEET='__SHEET__', LIMIT=8000;
function post(body){ return fetch('/api/chatfeed/verdict',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); }
function cost(k){ var s=parseInt(document.querySelector('.secs[data-key="'+k+'"]').value)||0; document.querySelector('.cost[data-key="'+k+'"]').textContent=(s*1.1).toFixed(1)+'¢ at 1.1¢/s (Atlas Mini 480p) · '+(s*4)+'¢ on APIFRAME'; }
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
  window.addEventListener('pagehide',function(){ if(!timer) return; clearTimeout(timer); timer=null; try{ navigator.sendBeacon('/api/chatfeed/verdict', new Blob([JSON.stringify({chat:CHAT,sheet:SHEET,item:k+'.'+f,text:ta.value.slice(0,LIMIT)})],{type:'application/json'})); }catch(e){} });
});
// SEND TO FOOTAGE (2026-09-10, Sophie: "add a button to each scene that automatically puts all the right references in the same text to footage so I can edit it or press go myself"). The button is a real link to the Footage tool — on her phone the app opens the tool, in a browser it is a tab — and before it goes it writes the hand-off the Footage page reads on its next open (localStorage `footage_handoff`, same origin): my header lines + her words as the prompt, the card's stills as the references, Mini · her seconds · 480p · 16:9. Nothing is sent by this tap; the star on the Footage page is still hers.
document.querySelectorAll('.tofoot').forEach(function(a){ a.addEventListener('click',function(){ var k=a.getAttribute('data-key'); try{
  var mine=(document.querySelector('.p[data-key="'+k+'"][data-field="mine"]')||{}).value||''; var words=(document.querySelector('.p[data-key="'+k+'"]:not([data-field])')||{}).value||'';
  var refs=JSON.parse(document.querySelector('.refjson[data-key="'+k+'"]').textContent||'[]'); var s=parseInt(document.querySelector('.secs[data-key="'+k+'"]').value)||4;
  localStorage.setItem('footage_handoff',JSON.stringify({prompt:(mine.trim()?mine.trim()+'\\n\\n':'')+words,refs:refs,model:'mini',seconds:s,res:'480p',ratio:'16:9',from:CHAT,title:a.getAttribute('data-title'),at:Date.now()}));
 }catch(e){} }); });
document.querySelectorAll('.secs').forEach(function(inp){ var k=inp.getAttribute('data-key'); cost(k); inp.addEventListener('input',function(){ cost(k); post({chat:CHAT,sheet:SHEET,item:k+'.s',text:inp.value}); }); });
var deck=document.getElementById('deck'), cards=[].slice.call(deck.children), pos=document.getElementById('pos');
function at(){ return Math.round(deck.scrollLeft/deck.clientWidth); }
function go(i){ i=Math.max(0,Math.min(cards.length-1,i)); deck.scrollTo({left:i*deck.clientWidth,behavior:'smooth'}); }
function paintPos(){ pos.textContent=(at()+1)+' / '+cards.length; try{localStorage.setItem('beltnau.at',at());}catch(e){} }
deck.addEventListener('scroll',function(){ clearTimeout(window.__pt); window.__pt=setTimeout(paintPos,80); });
document.getElementById('prev').onclick=function(){go(at()-1);}; document.getElementById('next').onclick=function(){go(at()+1);};
var h=(location.hash||'').replace('#j-',''); var start=cards.findIndex(function(c){return c.getAttribute('data-key')===h;}); if(start<0){ try{start=parseInt(localStorage.getItem('beltnau.at'))||0;}catch(e){start=0;} }
setTimeout(function(){ deck.scrollLeft=start*deck.clientWidth; paintPos(); window.scrollTo(0,0); },50);
window.__compareNotes({chat:CHAT,sheet:'belt-nautchaug-notes'});
window.__compareHelp({html:'<p><b>Nothing on this page is sent.</b> One card per main shot of your script, film order, your words verbatim in the box (edit them; a line with only <i>cut</i> on it splits a card into pieces). Every card is Seedance 2.0 Mini · 480p · landscape 16:9 · sound on, through Atlas Cloud at 1.1¢ a second (4s = 4.4¢; all 128 cards at 4s = about $5.60). Seconds are yours to set (Mini takes 4–15). The header lines above your words are mine and say only who is in which image and the setting — never what a picture shows. Sophie rides as image 1 (her jazz frame in the dress for episode one, her intake frame for the hospital); everyone else is drawn from your words on their first clip and carried forward from that clip after it lands. A clip goes out only on your go for that card.</p><p class="toc">__TOC__</p><p>Left out (main shots only):</p><ul>__LEFT__</ul>'});
</script>
'''
page=page.replace('__TITLE__',H.escape(TITLE)).replace('__LEFT__',LEFT).replace('__CHAT__',CHAT).replace('__SHEET__',SHEET).replace('__TOC__',TOC).replace('__SECS__','\n'.join(secs))
open('belt.html','w').write(page)
if os.environ.get('BELT_DRY'): print('dry — belt.html written, nothing posted'); raise SystemExit
d=post('page',{'chat':CHAT,'title':'%s v%d'%(TITLE,ver),'html':page}); print(d.get('id'),d.get('warnings'))
for old in state.get('ids',[]): post('page/'+old+'/supersede',{'superseded':True})
json.dump({'ver':ver,'ids':[d['id']]},open(STATE,'w'))
# AND THE SCENE HUB IS RE-POSTED RIGHT AFTER (2026-09-10). Every button on
# /hub points at a card on THIS belt by page id, so a new belt version would
# leave 128 links on a superseded page. hub.py is re-run from this directory
# and can never fail the belt: its trouble is printed and nothing else.
try:
    import subprocess,sys
    subprocess.run([sys.executable,'hub.py'],cwd=os.path.dirname(os.path.abspath(__file__)) or '.',check=False)
except Exception as e:
    print('hub not re-posted:',e)

