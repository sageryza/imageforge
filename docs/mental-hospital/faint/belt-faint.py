#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""The faint — her five clips, as a belt.

Built 2026-09-10 from her own rewrite ("here's the rewritten version as 5 longer
clips, keeping the continuity context but giving Seedance room to actually direct
the scene"). One card a clip in a horizontally snapping deck.

Copied from `scripts/ticky-tack/belt.py`, which is the NEWEST copy of the builder
per `docs/mental-hospital/belt/VERSIONS.md` — it carries the 2026-09-08 saver (a
save is read back, nothing is cut, over the limit the box refuses and says by how
much) AND the 2026-09-10 "send to Footage" button. `node
scripts/test-belt-save-guard.js` sweeps this file.

Three differences from the ticky-tack belt, all because these words already exist:
  * her words ship IN the box (they are hers — this is not pre-written text),
  * every card carries its wired reference stills as thumbnails,
  * the shape is the current plan: 2.0 Mini · 480p · landscape 16:9 · sound on,
    through Atlas Cloud at 1.1c a second.

NOTHING HERE IS SENT. The star on the Footage page is still hers.

    python3 docs/mental-hospital/faint/belt-faint.py           # write the html only
    python3 docs/mental-hospital/faint/belt-faint.py --post    # post it into the chat
"""
import html, io, json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = 'https://imageforge-q125.onrender.com'
CHAT = os.environ.get('BELT_CHAT', 'sophie-hospital-scene')
SHEET = 'belt-faint'
TITLE = 'The faint — five clips'
LIMIT = 8000
RATE = 1.1  # cents a second, Atlas Cloud, 2.0 Mini 480p (read live off its own model list)


def post(path, body):
    r = urllib.request.Request(BASE + '/api/chatfeed/' + path,
                               data=json.dumps(body).encode(),
                               headers={'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(r))


def build(jobs):
    e = html.escape
    cards, toc, total = [], [], 0
    for n, j in enumerate(jobs, 1):
        k = j['key']
        total += j['secs']
        stills = ''.join(
            '<figure><img loading="lazy" src="%s"><figcaption>Image%d — %s</figcaption></figure>'
            % (e(im[1]), i + 1, e(im[0])) for i, im in enumerate(j['images']))
        refjson = json.dumps([{'url': im[1], 'kind': 'image', 'name': im[0]} for im in j['images']])
        sends = ' · '.join(['Seedance 2.0 Mini', '480p', 'landscape 16:9', 'sound on', 'Atlas Cloud']
                           + ['Image%d = %s' % (i + 1, e(im[0])) for i, im in enumerate(j['images'])])
        cards.append(
            '<section class="card" id="j-%(k)s" data-key="%(k)s" data-item="%(k)s">\n'
            '<h2>%(n)d · %(t)s<span class="st">%(st)s</span></h2>\n'
            '<details class="text"><summary>reference lines (mine, sent before your words — edit them)</summary>'
            '<textarea class="p" data-key="%(k)s" data-field="mine" spellcheck="false">%(mine)s</textarea>'
            '<div class="saved" id="sv-%(k)s-mine"></div></details>\n'
            # THE CONTROLS RIDE ABOVE HER WORDS ON THIS BELT, and only on this one.
            # Every other belt ships an EMPTY box, so its seconds and its send button
            # sit near the top by themselves. Here the box arrives holding a whole
            # scene — measured at 390x844, card 1's box is over 1,000px tall — so the
            # controls under it would be off the first screen on every card, which is
            # the one thing her "fit it on one screen" rule is about. The reference
            # thumbnails stay below: those are for reading, not for tapping.
            '<div class="attached top">'
            '<div class="row"><label>seconds <input class="secs" data-key="%(k)s" type="number" min="4" max="15" value="%(s)d"></label>'
            '<span class="cost" data-key="%(k)s"></span></div>'
            '<p class="mine">your target: %(target)s</p>'
            '<div class="sendrow"><a class="tofoot" href="/footage" data-key="%(k)s" data-title="%(dt)s">send to Footage ›</a></div>'
            '<script type="application/json" class="refjson" data-key="%(k)s">%(rj)s</script>'
            '</div>\n'
            '<details class="text" open><summary>your words</summary>'
            '<textarea class="p" data-key="%(k)s" spellcheck="false">%(p)s</textarea>'
            '<div class="saved" id="sv-%(k)s"></div></details>\n'
            '<details class="text"><summary>redo notes (yours)</summary>'
            '<textarea class="p" data-key="%(k)s" data-field="redo" spellcheck="false">%(redo)s</textarea>'
            '<div class="saved" id="sv-%(k)s-redo"></div></details>\n'
            # The "what goes with it" line reads as a CAPTION under the stills, not as
            # a paragraph in front of them — `POST /page` warns on prose between the
            # title and the first picture, and it is right: the pictures are the thing.
            '<div class="attached">'
            '<div class="refs">%(stills)s</div>'
            '<p class="sends">%(sends)s</p>'
            '</div>\n</section>' % dict(
                k=k, n=n, t=e(j['title']), st=e(j['status']), mine=e('\n\n'.join(j['mine'])),
                p=e(j['text']), redo=e(j.get('redo') or ''), s=j['secs'], target=e(j['target']),
                dt=e('%d · %s' % (n, j['title'])), rj=refjson, sends=sends, stills=stills))
        toc.append('<a href="#j-%s">%d %s</a>' % (k, n, e(j['title'])))

    help_html = (
        '<p><b>Nothing on this page is sent.</b> One card a clip, in order — the pill '
        'through “were you straining?”. Your words are in the box, verbatim, and are '
        'yours to change. A line with only <i>cut</i> on it splits a card into pieces.</p>'
        '<p>Every card is Seedance 2.0 Mini · 480p · landscape 16:9 · sound on, through '
        'Atlas Cloud at 1.1¢ a second. All five at your targets is %d seconds — about %d¢. '
        'Seconds are yours (Mini takes 4–15). The fold above your words holds the reference '
        'lines of mine that go in front of them; they name a picture by its slot and never '
        'say what is in it. <b>send to Footage</b> puts the whole job — words, references, '
        'model, seconds, shape — into the Footage tool so you can press the star yourself.</p>'
        '<p class="toc">%s</p>' % (total, round(total * RATE), ' · '.join(toc)))

    return CSS + (
        '<h1>%s</h1>\n'
        '<div class="nav"><button id="prev" type="button">‹ back</button>'
        '<span id="pos"></span><button id="next" type="button">next ›</button></div>\n'
        '<div class="deck" id="deck">%s</div>\n'
        '<script>\n%s\n%s\n</script>\n'
    ) % (e(TITLE), '\n'.join(cards), SCRIPT % (CHAT, SHEET, LIMIT, RATE),
         'window.__compareHelp({html:%s});' % json.dumps(help_html))


CSS = """<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="stylesheet" href="/compare.css"><script src="/compare.js"></script>
<style>
.deck{display:flex;align-items:flex-start;overflow-x:auto;overflow-y:visible;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none} .deck::-webkit-scrollbar{display:none}
.card h2,.card .sends,.card .text summary{margin-right:58px}
.card{flex:0 0 100%;scroll-snap-align:start;scroll-snap-stop:always;box-sizing:border-box;padding:6px 14px 60px}
h2{font-size:16px;margin:0 0 6px} .st{display:block;font-size:11px;font-weight:400;color:#8a8176;text-transform:uppercase;letter-spacing:.04em;margin-top:2px}
.text summary{cursor:pointer;font-size:12px;text-decoration:underline;color:#6b6257;margin-bottom:6px}
textarea.p{width:100%;box-sizing:border-box;font-family:inherit;font-size:16px;line-height:1.5;padding:10px;border:1px solid #cfc6b6;border-radius:6px;background:#fff;resize:none;min-height:100px}
.saved{font-size:11px;color:#8a8176;min-height:14px;margin-top:3px} .saved.bad{color:#b5473c;font-weight:600}
.attached{margin-top:14px;padding-top:10px;border-top:1px solid #e3dccd}
.attached.top{margin-top:6px;padding-top:0;padding-bottom:8px;border-top:0;border-bottom:1px solid #e3dccd}
.row{display:flex;align-items:center;gap:12px;font-size:13px;margin:0 0 8px} .row input{width:64px;font-family:inherit;font-size:16px;padding:4px 6px;border:1px solid #cfc6b6;border-radius:6px;background:#fff} .cost{color:#6b6257}
.sendrow{margin:8px 0 10px} .tofoot{display:inline-block;font:inherit;font-size:13px;padding:7px 12px;border:1px solid #2b2622;border-radius:6px;color:#2b2622;background:#fff;text-decoration:none}
.sends{font-size:12px;color:#6b6257;line-height:1.5;margin:0 0 8px}
.refs{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:6px;margin:8px 0 12px} .refs figure{margin:0} .refs img{width:100%;display:block;border-radius:0} .refs figcaption{font-size:10px;line-height:1.3;color:#6b6257;margin-top:3px}
p.mine{font-size:12px;color:#8a8176;margin:6px 0 0}
.nav{display:flex;align-items:center;justify-content:space-between;padding:6px 0 8px;margin-right:64px;font-size:13px}
.nav button{font:inherit;border:1px solid #cfc6b6;border-radius:6px;background:#fff;padding:6px 12px}
</style>
"""

SCRIPT = r"""
var CHAT='%s', SHEET='%s', LIMIT=%d, RATE=%s;
function post(body){ return fetch('/api/chatfeed/verdict',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); }
function cost(k){ var s=parseInt(document.querySelector('.secs[data-key="'+k+'"]').value)||0; document.querySelector('.cost[data-key="'+k+'"]').textContent=(s*RATE).toFixed(1)+'¢ at '+RATE+'¢/s (Atlas Mini 480p)'; }
document.querySelectorAll('.p[data-key]').forEach(function(ta){ var k=ta.getAttribute('data-key'), f=ta.getAttribute('data-field')||'p', sv=document.getElementById('sv-'+k+(f==='p'?'':'-'+f)), timer=null;
  function fit(){ta.style.height='auto'; ta.style.height=(ta.scrollHeight+2)+'px';} fit(); ta.closest('details').addEventListener('toggle',fit);
  function pieces(t){ var n=t.split(/\r?\n/).filter(function(l){return /^[ \t]*cut[ \t.!:]*$/i.test(l);}).length; return n?(' · '+(n+1)+' pieces'):''; }
  // A SAVE IS READ BACK, NEVER TRUSTED (2026-09-08, Sophie, after a 2,343-character
  // scene lost its tail to a silent slice: "a stupid error that's gonna lose my
  // edits"). Nothing is cut on the way out; over LIMIT the box refuses and says by
  // how much; after every save the sheet is re-read and the box says so if the
  // server kept less than it was sent.
  function bad(m){ sv.textContent=m; sv.classList.add('bad'); } function good(m){ sv.textContent=m; sv.classList.remove('bad'); }
  function save(t){ if(t.length>LIMIT){ bad('NOT SAVED — '+(t.length-LIMIT)+' characters over the box limit of '+LIMIT); return; }
    post({chat:CHAT,sheet:SHEET,item:k+'.'+f,text:t}).then(function(r){return r.json();}).then(function(j){ if(j.chars!=null && j.chars<t.length) throw new Error('short');
      return fetch('/api/chatfeed/verdict?chat='+encodeURIComponent(CHAT)+'&sheet='+encodeURIComponent(SHEET)).then(function(r){return r.json();}).then(function(d){ var kept=(d.texts||{})[k+'.'+f]; if(typeof kept==='string' && kept.length<t.length) throw new Error('short'); good('saved'+pieces(t)); });
    }).catch(function(e){ bad(e && e.message==='short' ? 'NOT SAVED WHOLE — the server kept less than you typed; copy your text somewhere safe' : 'not saved'); }); }
  ta.addEventListener('input',function(){ fit(); var t=ta.value; sv.textContent='…'+pieces(t); clearTimeout(timer); timer=setTimeout(function(){ save(t); },700); });
  window.addEventListener('pagehide',function(){ if(!timer) return; clearTimeout(timer); timer=null; try{ navigator.sendBeacon('/api/chatfeed/verdict', new Blob([JSON.stringify({chat:CHAT,sheet:SHEET,item:k+'.'+f,text:ta.value.slice(0,LIMIT)})],{type:'application/json'})); }catch(e){} });
});
// Her edits come back on the next open — a card is where she left it. Her saved
// text WINS over the words baked into the page.
fetch('/api/chatfeed/verdict?chat='+encodeURIComponent(CHAT)+'&sheet='+encodeURIComponent(SHEET)).then(function(r){return r.json();}).then(function(d){ var T=d.texts||{};
  document.querySelectorAll('.p[data-key]').forEach(function(ta){ var k=ta.getAttribute('data-key'), f=ta.getAttribute('data-field')||'p', v=T[k+'.'+f];
    if(typeof v==='string' && v.length){ ta.value=v; ta.style.height='auto'; ta.style.height=(ta.scrollHeight+2)+'px'; if(f==='p'){ var c=document.querySelector('.card[data-key="'+k+'"] .st'); if(c) c.textContent='your edit'; } } });
  document.querySelectorAll('.secs').forEach(function(inp){ var k=inp.getAttribute('data-key'), s=T[k+'.s']; if(s){ inp.value=s; cost(k); } });
}).catch(function(){});
// SEND TO FOOTAGE (2026-09-10, Sophie: "add a button to each scene that
// automatically puts all the right references in the same text to footage so I can
// edit it or press go myself"). A real link to the Footage tool; before it goes it
// writes the hand-off that page reads on its next open (localStorage
// `footage_handoff`, same origin). Nothing is sent by this tap; the star on the
// Footage page is still hers.
document.querySelectorAll('.tofoot').forEach(function(a){ a.addEventListener('click',function(){ var k=a.getAttribute('data-key'); try{
  var mine=(document.querySelector('.p[data-key="'+k+'"][data-field="mine"]')||{}).value||''; var words=(document.querySelector('.p[data-key="'+k+'"]:not([data-field])')||{}).value||'';
  var refs=JSON.parse(document.querySelector('.refjson[data-key="'+k+'"]').textContent||'[]'); var s=parseInt(document.querySelector('.secs[data-key="'+k+'"]').value)||4;
  localStorage.setItem('footage_handoff',JSON.stringify({prompt:(mine.trim()?mine.trim()+'\n\n':'')+words,refs:refs,model:'mini',seconds:s,res:'480p',ratio:'16:9',from:CHAT,title:a.getAttribute('data-title'),at:Date.now()}));
 }catch(e){} }); });
document.querySelectorAll('.secs').forEach(function(inp){ var k=inp.getAttribute('data-key'); cost(k); inp.addEventListener('input',function(){ cost(k); post({chat:CHAT,sheet:SHEET,item:k+'.s',text:inp.value}); }); });
var deck=document.getElementById('deck'), cards=[].slice.call(deck.children), pos=document.getElementById('pos');
function at(){ return Math.round(deck.scrollLeft/deck.clientWidth); }
function go(i){ i=Math.max(0,Math.min(cards.length-1,i)); deck.scrollTo({left:i*deck.clientWidth,behavior:'smooth'}); }
function paintPos(){ pos.textContent=(at()+1)+' / '+cards.length; try{localStorage.setItem('beltfaint.at',at());}catch(e){} }
deck.addEventListener('scroll',function(){ clearTimeout(window.__pt); window.__pt=setTimeout(paintPos,80); });
document.getElementById('prev').onclick=function(){go(at()-1);}; document.getElementById('next').onclick=function(){go(at()+1);};
var h=(location.hash||'').replace('#j-',''); var start=cards.findIndex(function(c){return c.getAttribute('data-key')===h;}); if(start<0){ try{start=parseInt(localStorage.getItem('beltfaint.at'))||0;}catch(e){start=0;} }
setTimeout(function(){ deck.scrollLeft=start*deck.clientWidth; paintPos(); window.scrollTo(0,0); },50);
window.__compareNotes({chat:CHAT,sheet:'belt-faint-notes'});
"""


def main():
    jobs = json.load(io.open(os.path.join(HERE, 'jobs-faint.json'), encoding='utf-8'))
    page = build(jobs)
    io.open(os.path.join(HERE, 'belt-faint.html'), 'w', encoding='utf-8').write(page)
    print('%d cards, %d bytes' % (len(jobs), len(page)))
    if '--post' not in sys.argv:
        return
    sf = os.path.join(HERE, 'belt-faint-state.json')
    state = json.load(io.open(sf, encoding='utf-8')) if os.path.exists(sf) else {}
    ver = state.get('ver', 0) + 1
    d = post('page', {'chat': CHAT, 'title': '%s v%d' % (TITLE, ver), 'html': page})
    print(d.get('id'), d.get('warnings'))
    for old in state.get('ids', []):
        post('page/' + old + '/supersede', {'superseded': True})
    json.dump({'ver': ver, 'ids': [d['id']]}, io.open(sf, 'w', encoding='utf-8'))


if __name__ == '__main__':
    main()
