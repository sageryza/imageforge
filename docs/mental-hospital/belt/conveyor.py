import json,urllib.request,sys,re,html as H
B='https://imageforge-q125.onrender.com'
def post(path,body):
    r=urllib.request.Request(B+'/api/chatfeed/'+path,data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
    return json.load(urllib.request.urlopen(r))
jobs=json.load(open('jobs.json'))
state=json.load(open('conveyor-state.json')) if __import__('os').path.exists('conveyor-state.json') else {}
ver=state.get('ver',0)+1
tx=json.load(urllib.request.urlopen(B+'/api/chatfeed/verdict?chat=severance-api-multiple-frames&sheet=conveyor')).get('texts',{})
secs=[]
for j in jobs:
    k=j['key']; vids=[v for v in j['videos'] if v[1]]; pend=[v for v in j['videos'] if not v[1]]
    vtot=sum(15.1 if v[1].endswith('f3j8qh.mp4') else (25 if 'a59ab8' in v[1] else 4) for v in vids)
    sends=' · '.join(['Seedance 2.5','480p','3:4','audio on']+['Video%d = %s'%(i+1,H.escape(v[0])) for i,v in enumerate(j['videos'])]+['Image%d = %s'%(i+1,H.escape(im[0])) for i,im in enumerate(j['images'])])
    films=''.join('<p class="vid">Video%d — <a href="%s" target="_blank">%s</a> · %s</p>'%(i+1,H.escape(v[1]),H.escape(v[0]),('15s' if v[1].endswith('f3j8qh.mp4') else '25s' if 'a59ab8' in v[1] else '4s')) for i,v in enumerate(vids))
    stills=''.join('<figure><img loading="lazy" src="%s"><figcaption>Image%d — %s</figcaption></figure>'%(H.escape(im[1]),i+1,H.escape(im[0])) for i,im in enumerate(j['images']))
    pending=''.join('<p class="pend">Video%d — %s — NOT MADE YET</p>'%(j['videos'].index(v)+1,H.escape(v[0])) for v in pend)
    s=tx.get(k+'.s') or str(j['secs']); p=tx.get(k+'.p') or j['prompt']
    before=''
    m=re.match(r'^(\d+[ab]?)([b-e])$',k)
    if m:
        pk=m.group(1)+chr(ord(m.group(2))-1); prev=next((x for x in jobs if x['key']==pk),None)
        if prev:
            pt=tx.get(pk+'.p') or prev['prompt']; i=pt.find('setting:'); body=pt[pt.find('\n\n',i)+2:] if i>=0 else pt
            before='<details class="before"><summary>what comes before this card (the end of %s)</summary><div>%s</div></details>'%(H.escape(pk),H.escape(body).replace('\n','<br>'))
    secs.append('''<section class="card" id="j-%(k)s" data-key="%(k)s" data-item="%(k)s">
<h2>%(n)d · %(t)s<span class="st">%(st)s</span></h2>
<p class="sends">%(sends)s</p>
%(films)s%(pending)s
<div class="refs">%(stills)s</div>
<div class="row"><label>seconds <input class="secs" data-key="%(k)s" value="%(s)s" inputmode="numeric"></label><span class="cost" data-key="%(k)s"></span></div>
%(before)s
<textarea class="p" data-key="%(k)s" spellcheck="false">%(p)s</textarea><div class="saved" id="sv-%(k)s"></div>
<p class="mine">mine: %(mine)s</p>
</section>'''%dict(k=k,n=jobs.index(j)+1,t=H.escape(j['title']),st=H.escape(j['status']),sends=sends,films=films,pending=pending,stills=stills,s=H.escape(s),p=H.escape(p),mine=H.escape(j['mine']),before=before))
TOC=' · '.join('<a href="#j-%s">%d %s</a>'%(j['key'],i+1,H.escape(j['title'].split(' — ')[0])) for i,j in enumerate(jobs)); SECS='\n'.join(secs)
page='''<meta charset="utf-8"><link rel="stylesheet" href="/compare.css"><script src="/compare.js"></script>
<style>
.deck{display:flex;align-items:flex-start;overflow-x:auto;overflow-y:visible;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none} .deck::-webkit-scrollbar{display:none}
.card h2,.card .sends,.card .vid,.card .pend{margin-right:58px}
.card{flex:0 0 100%;scroll-snap-align:start;scroll-snap-stop:always;box-sizing:border-box;padding:6px 14px 60px}
h2{font-size:16px;margin:0 0 6px} .st{display:block;font-size:11px;font-weight:400;color:#8a8176;text-transform:uppercase;letter-spacing:.04em;margin-top:2px}
.sends{font-size:12px;color:#6b6257;line-height:1.5;margin:0 0 8px}
.pend{font-size:12px;color:#b5473c;margin:4px 0} .vid{font-size:12px;margin:4px 0} .vid a{color:inherit}
.refs{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:6px 6px;margin:8px 0 34px} .refs figure{margin:0;position:relative} .refs img{width:100%;display:block;border-radius:0} .refs figcaption{position:static;display:block;font-size:10px;line-height:1.3;color:#6b6257;margin-top:3px;background:none;padding:0}
.row{display:flex;align-items:center;gap:12px;font-size:13px;margin:8px 0 6px} .row input{width:56px;font-family:inherit;font-size:16px;padding:4px 6px;border:1px solid #cfc6b6;border-radius:6px;background:#fff} .cost{color:#6b6257}
textarea.p{width:100%;box-sizing:border-box;font-family:inherit;font-size:16px;line-height:1.5;padding:10px;border:1px solid #cfc6b6;border-radius:6px;background:#fff;resize:none;min-height:100px}
.before{font-size:13px;line-height:1.5;color:#6b6257;margin:6px 0} .before summary{cursor:pointer;font-size:12px;text-decoration:underline} .before div{padding:6px 0 0;white-space:normal}
.saved{font-size:11px;color:#8a8176;min-height:14px;margin-top:3px} .saved.bad{color:#b5473c;font-weight:600} .mine{font-size:12px;color:#8a8176;margin:4px 0 0}
.nav{display:flex;align-items:center;justify-content:space-between;padding:6px 0 8px;margin-right:64px;font-size:13px}
.nav button{font:inherit;border:1px solid #cfc6b6;border-radius:6px;background:#fff;padding:6px 12px}
</style>
<h1>The conveyor belt</h1>
<div class="nav"><button id="prev" type="button">‹ back</button><span id="pos"></span><button id="next" type="button">next ›</button></div>
<div class="deck" id="deck"><section class="card script" id="j-script" data-key="script">
<h2>Script</h2>
<p class="sends"><b>cut</b> on its own line separates scenes.</p>
<textarea class="p" id="script" spellcheck="false"></textarea><div class="saved" id="sv-script"></div>
</section>__SECS__</div>
<script>
var CHAT='severance-api-multiple-frames', SHEET='conveyor', LIMIT=8000;
var PROJECT='ward';   // the footage project a Send-to-Footage lands on
function post(body){ return fetch('/api/chatfeed/verdict',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); }
function cost(k){ var s=parseInt(document.querySelector('.secs[data-key="'+k+'"]').value)||0; document.querySelector('.cost[data-key="'+k+'"]').textContent='$'+(s*0.15).toFixed(2)+' at 15¢/s'; }
document.querySelectorAll('.p[data-key]').forEach(function(ta){ var k=ta.getAttribute('data-key'), sv=document.getElementById('sv-'+k), timer=null;
  function fit(){ta.style.height='auto'; ta.style.height=(ta.scrollHeight+2)+'px';} fit();
  function pieces(t){ var n=t.split(/\\r?\\n/).filter(function(l){return /^[ \\t]*cut[ \\t.!:]*$/i.test(l);}).length; return n?(' · '+(n+1)+' pieces'):''; }
  // A SAVE IS READ BACK, NEVER TRUSTED (2026-09-08, Sophie, after a 2,343-character scene lost its tail to a silent slice: "a stupid error that's gonna lose my edits"). Nothing is cut on the way out; over LIMIT the box refuses and says by how much; after every save the sheet is re-read and the box says so if the server kept less than it was sent.
  function bad(m){ sv.textContent=m; sv.classList.add('bad'); } function good(m){ sv.textContent=m; sv.classList.remove('bad'); }
  function save(t){ if(t.length>LIMIT){ bad('NOT SAVED — '+(t.length-LIMIT)+' characters over the box limit of '+LIMIT); return; }
    post({chat:CHAT,sheet:SHEET,item:k+'.p',text:t}).then(function(r){return r.json();}).then(function(j){ if(j.chars!=null && j.chars<t.length) throw new Error('short');
      return fetch('/api/chatfeed/verdict?chat='+encodeURIComponent(CHAT)+'&sheet='+encodeURIComponent(SHEET)).then(function(r){return r.json();}).then(function(d){ var kept=(d.texts||{})[k+'.p']; if(typeof kept==='string' && kept.length<t.length) throw new Error('short'); good('saved'+pieces(t)); });
    }).catch(function(e){ bad(e && e.message==='short' ? 'NOT SAVED WHOLE — the server kept less than you typed; copy your text somewhere safe' : 'not saved'); }); }
  ta.addEventListener('input',function(){ fit(); var t=ta.value; sv.textContent='…'+pieces(t); clearTimeout(timer); timer=setTimeout(function(){ save(t); },700); });
  window.addEventListener('pagehide',function(){ if(!timer) return; clearTimeout(timer); timer=null; try{ navigator.sendBeacon('/api/chatfeed/verdict', new Blob([JSON.stringify({chat:CHAT,sheet:SHEET,item:k+'.p',text:ta.value.slice(0,LIMIT)})],{type:'application/json'})); }catch(e){} });
  window.addEventListener('pagehide',function(){ if(!timer) return; clearTimeout(timer); timer=null; try{ navigator.sendBeacon('/api/chatfeed/verdict', new Blob([JSON.stringify({chat:CHAT,sheet:SHEET,item:k+'.p',text:ta.value.slice(0,LIMIT)})],{type:'application/json'})); }catch(e){} });
});
document.querySelectorAll('.secs').forEach(function(inp){ var k=inp.getAttribute('data-key'); cost(k); inp.addEventListener('input',function(){ cost(k); post({chat:CHAT,sheet:SHEET,item:k+'.s',text:inp.value}); }); });
(function(){ var ta=document.getElementById('script'), sv=document.getElementById('sv-script'), timer=null;
  function fit(){ ta.style.height='auto'; ta.style.height=Math.max(160,ta.scrollHeight+4)+'px'; }
  function save(){ var t=ta.value; sv.textContent='…'; return fetch('/api/chatfeed/script',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat:CHAT,text:t})}).then(function(r){ sv.textContent=r.ok?'saved':'not saved'; }).catch(function(){ sv.textContent='not saved'; }); }
  fetch('/api/chatfeed/script?chat='+CHAT).then(function(r){return r.json();}).then(function(d){ if(d&&typeof d.text==='string'&&!ta.value){ ta.value=d.text; fit(); } }).catch(function(){});
  ta.addEventListener('input',function(){ fit(); clearTimeout(timer); timer=setTimeout(function(){ timer=null; save(); },700); });
  window.addEventListener('pagehide',function(){ if(!timer) return; clearTimeout(timer); timer=null; try{ navigator.sendBeacon('/api/chatfeed/script', new Blob([JSON.stringify({chat:CHAT,text:ta.value})],{type:'application/json'})); }catch(e){} });
  fit();
})();
var deck=document.getElementById('deck'), cards=[].slice.call(deck.children), pos=document.getElementById('pos');
function at(){ return Math.round(deck.scrollLeft/deck.clientWidth); }
function go(i){ i=Math.max(0,Math.min(cards.length-1,i)); deck.scrollTo({left:i*deck.clientWidth,behavior:'smooth'}); }
function paintPos(){ pos.textContent=(at()+1)+' / '+cards.length; try{localStorage.setItem('conveyor.at',at());}catch(e){} }
deck.addEventListener('scroll',function(){ clearTimeout(window.__pt); window.__pt=setTimeout(paintPos,80); });
document.getElementById('prev').onclick=function(){go(at()-1);}; document.getElementById('next').onclick=function(){go(at()+1);};
var h=(location.hash||'').replace('#j-',''); var start=cards.findIndex(function(c){return c.getAttribute('data-key')===h;}); if(start<0){ try{start=parseInt(localStorage.getItem('conveyor.at'))||0;}catch(e){start=0;} }
setTimeout(function(){ deck.scrollLeft=start*deck.clientWidth; paintPos(); window.scrollTo(0,0); },50);
window.__compareNotes({chat:'severance-api-multiple-frames',sheet:'conveyor-notes'});
window.__compareHelp({html:'<p class="toc">__TOC__</p><p>The Script card comes first: paste as many scenes as you like, the word cut on its own line between them; it saves as you type and I read it from here. Then swipe sideways, one shot per card. Every shot waiting to be sent, in order. Each one says exactly what goes to the model: the videos (playable), the stills, the seconds and the words. Change the seconds or the words here and they save; say go with the number and that is what gets sent.</p>'});
</script>
'''.replace('__TOC__',TOC).replace('__SECS__',SECS)
if False: dict(toc=' · '.join('<a href="#j-%s">%d %s</a>'%(j['key'],i+1,H.escape(j['title'].split(' — ')[0])) for i,j in enumerate(jobs)),secs='\n'.join(secs))
open('conveyor.html','w').write(page)
d=post('page',{'chat':'severance-api-multiple-frames','title':'The conveyor belt v%d'%ver,'html':page}); print(d.get('id'),d.get('warnings'))
for old in state.get('ids',[])+state.get('retire',[]): post('page/'+old+'/supersede',{'superseded':True})
json.dump({'ver':ver,'ids':[d['id']]},open('conveyor-state.json','w'))
S=__import__('os').environ.get('CLAUDE_CODE_REMOTE_SESSION_ID','').replace('cse_','')

