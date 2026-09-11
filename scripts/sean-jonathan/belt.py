#!/usr/bin/env python3
"""Sean & Jonathan — the draft belt.

2026-09-11, Sophie, handing over the script: *"take the beginning of my original
sean jonathan scene that has the videos that says who's who · make a belt · with
a footage button per scene"* — and, first word of the message, *"through
atlas"*.

The twin of `scripts/ticky-tack/belt.py` (the newest belt builder, and the one
that already carries the Send-to-Footage button). Three differences, each of
them something she said:

1.  **THE SCENES ARE HER `cut`s AND NOBODY ELSE'S.** `docs/sean-jonathan/
    script.md` holds her dictation verbatim and this file splits it on a line
    reading only `cut`. No scene is added, dropped, merged, reordered or tidied
    — the Story Timeline's rule ("did u add delete or change my words · if so
    undo") applied to a script. The card NAMES are mine and are the only words
    on the page that are.

2.  **THE WHO'S-WHO BLOCK IS HERS, LIFTED OFF HER OWN JOB.** `docs/sean-
    jonathan/refs.json` carries the opening lines of footage job
    `86532d0c923d401a8b29060dd673670a` — her original Sean/Jonathan scene — with
    the two reference videos in HER slot order ([Video1] jonathan, [Video2]
    sean). It rides the header box on every card, where she can edit it. The
    only line in that box that is mine is `setting:`, and it names the room and
    nothing else (the never-describe-a-reference rule).

3.  **ATLAS, 3:4, 15 SECONDS.** Both of her Sean/Jonathan clips were Mini · 480p
    · 3:4 · 15s · sound on, through Atlas, so that is what a card hands over —
    not the ward film's landscape 16:9, which is a different film. The seconds
    box is hers and Mini takes 4-15.

Nothing on the page is sent. The button writes the hand-off (`footage_handoff`)
and walks her to `/footage`, where the star is still her tap.

The saver is the 2026-09-08 read-back one: over the limit the box REFUSES and
says by how much, nothing is cut on the way out, and every save is read back off
the sheet. `node scripts/test-belt-save-guard.js` sweeps this file.

    python3 scripts/sean-jonathan/belt.py
    python3 scripts/sean-jonathan/belt.py --post [--supersede <id>]
"""
import html, json, os, re, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(os.path.dirname(HERE), '..', 'docs', 'sean-jonathan')
SCRIPT_MD = os.path.join(DOCS, 'script.md')
REFS_JSON = os.path.join(DOCS, 'refs.json')
BASE = 'https://imageforge-q125.onrender.com'
CHAT = 'sean-jonathan-script'
SHEET = 'belt-seanjonathan'
TITLE = 'Sean & Jonathan — the draft belt'
LIMIT = 8000

# Mini · 480p · 3:4 · sound on, through Atlas — her own two clips' shape.
MODEL, RES, RATIO, SECS = 'mini', '480p', '3:4', 15
ATLAS_PER_SEC = 1.1  # ¢/s, Atlas Mini 480p while the sale holds — read live on /footage

# A name and a room per scene, in her order. MINE, not hers — the only words on
# the page that are. The room line says the room and never what a picture shows.
SCENES = [
    ('1', 'The tea party',
     "setting: jonathan's apartment — the small round dining table, the window, a rose bush below it."),
    ('2', 'Get out',
     "setting: jonathan's apartment — the front door, then the skylight in the roof above him."),
    ('3', 'Weeks pass',
     "setting: jonathan's apartment — a wall calendar, his easy chair, then the kitchen and its oven."),
    ('4', 'The white paint',
     "setting: jonathan's apartment — his desk, standing, then the bathroom and the shower."),
    ('5', 'Bedtime',
     "setting: jonathan's apartment — his bed, night, moonlight coming in at the end."),
    ('6', 'A whole new world',
     "setting: the apartment, then outside — a field of rose petals, then swings at a park."),
]


def scenes():
    """Her script, split at HER `cut` lines and nowhere else."""
    src = open(SCRIPT_MD, encoding='utf-8').read()
    body = src.split('<!-- SCENES BEGIN -->', 1)[1].split('<!-- SCENES END -->', 1)[0]
    parts = [p.strip('\n') for p in re.split(r'(?m)^[ \t]*cut[ \t.!:]*$', body)]
    return [p.strip() for p in parts if p.strip()]


def refs():
    return json.load(open(REFS_JSON, encoding='utf-8'))


def build():
    e = html.escape
    parts, R = scenes(), refs()
    if len(parts) != len(SCENES):
        raise SystemExit('her script has %d scenes, SCENES names %d — name them, '
                         'never re-split her words' % (len(parts), len(SCENES)))
    # what the footage page reads: url · kind · poster · name, in HER slot order
    refjson = json.dumps([{k: r[k] for k in ('url', 'kind', 'poster', 'name') if k in r}
                          for r in R['refs']])
    cards, toc = [], []
    for (n, name, room), words in zip(SCENES, parts):
        k = 'sj-%s' % n
        header = R['whosWho'] + '\n\n' + room
        cards.append(
            '<section class="card" id="j-%s" data-key="%s" data-item="%s">\n'
            '<h2>%s · %s</h2>\n'
            '<div class="attached">'
            '<div class="refs">%s</div>'
            '<div class="row"><label>seconds <input class="secs" data-key="%s" type="number" min="4" max="15" value="%d"></label>'
            '<a class="tofoot" href="/footage" data-key="%s" data-title="%s">send to Footage ›</a></div>'
            '<p class="cost" data-key="%s"></p>'
            '<script type="application/json" class="refjson" data-key="%s">%s</script>'
            '</div>\n'
            '<details class="text"><summary>who’s who (yours — goes out above the scene)</summary>'
            '<textarea class="p" data-key="%s" data-field="mine" spellcheck="false">%s</textarea>'
            '<div class="saved" id="sv-%s-mine"></div></details>\n'
            '<details class="text" open><summary>the scene (your words)</summary>'
            '<textarea class="p" data-key="%s" spellcheck="false">%s</textarea>'
            '<div class="saved" id="sv-%s"></div></details>\n'
            '</section>' % (
                k, k, k, e(n), e(name),
                ''.join('<span class="ref"><img src="%s" alt=""><b>%s</b> %s</span>'
                        % (e(r['poster']), e(r['_slot']), e(r['_who'])) for r in R['refs']),
                k, SECS, k, e('%s · %s' % (n, name)), k, k, refjson,
                k, e(header), k, k, e(words), k))
        toc.append('<a href="#j-%s">%s %s</a>' % (k, e(n), e(name)))

    help_html = (
        '<p><b>Nothing on this page is sent.</b> One card a scene, split where '
        '<i>you</i> put <i>cut</i> — six of them, in the order you dictated. The scene '
        'box holds your own words and is yours to change; a line with only <i>cut</i> on it '
        'splits a card into pieces.</p>'
        '<p><i>Who’s who</i> is the beginning of your first Sean &amp; Jonathan scene, '
        'word for word, with the same two videos in the same slots — <b>[Video1]</b> '
        'jonathan, <b>[Video2]</b> sean. It goes out above the scene. The only line in that '
        'box I wrote is <i>setting:</i>, and it names the room and nothing else.</p>'
        '<p>Every card is Seedance 2.0 Mini · 480p · 3:4 · sound on, '
        '<b>through Atlas Cloud</b> — the shape both of your clips last night were. '
        'Seconds open at 15, which is what you set both times; Mini takes 4–15. At '
        'Atlas’s ~1.1¢ a second that is about ~16.5¢ a card, ~$1 for all six. '
        '<b>Send to Footage</b> fills the box on the Footage page with the header, the scene '
        'and both videos — the star there is still yours.</p>'
        '<p class="toc">' + ' · '.join(toc) + '</p>')

    return CSS + (
        '<h1>%s</h1>\n'
        '<div class="nav"><button id="prev" type="button">‹ back</button>'
        '<span id="pos"></span><button id="next" type="button">next ›</button></div>\n'
        '<div class="deck" id="deck">%s</div>\n'
        '<script>\n%s\n%s\n</script>\n'
    ) % (e(TITLE), '\n'.join(cards), SCRIPT % (CHAT, SHEET, LIMIT, ATLAS_PER_SEC),
         'window.__compareHelp({html:%s});' % json.dumps(help_html))


CSS = """<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="stylesheet" href="/compare.css"><script src="/compare.js"></script>
<script src="/caretkeep.js"></script>
<style>
.deck{display:flex;align-items:flex-start;overflow-x:auto;overflow-y:visible;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none} .deck::-webkit-scrollbar{display:none}
.card h2,.card .text summary{margin-right:58px}
.card{flex:0 0 100%;scroll-snap-align:start;scroll-snap-stop:always;box-sizing:border-box;padding:6px 14px 60px}
h2{font-size:16px;margin:0 0 8px}
.text summary{cursor:pointer;font-size:12px;text-decoration:underline;color:#6b6257;margin-bottom:6px}
textarea.p{width:100%;box-sizing:border-box;font-family:inherit;font-size:16px;line-height:1.5;padding:10px;border:1px solid #cfc6b6;border-radius:6px;background:#fff;resize:none;min-height:100px}
.saved{font-size:11px;color:#8a8176;min-height:14px;margin-top:3px} .saved.bad{color:#b5473c;font-weight:600}
/* THE SEND ROW IS AT THE TOP OF THE CARD, and that is measured: a 894-character
   scene in a box fitted to its own words puts a footer button ~600px down a
   844px phone, so the one control this page exists for was below the fold on
   every card. Chrome above, her words below. */
.attached{margin:0 58px 12px 0;padding-bottom:10px;border-bottom:1px solid #e3dccd}
.refs{display:flex;gap:10px;margin:0 0 10px;flex-wrap:wrap}
.ref{display:flex;align-items:center;gap:6px;font-size:12px;color:#6b6257}
.ref img{width:34px;height:44px;object-fit:cover;border-radius:4px;border:1px solid #e3dccd;background:#efe9dc}
.ref b{font-weight:600;color:#3a352e}
/* ONE LINE: the seconds she sets, and the button. PHOTOGRAPHED at 390pt — with
   the price on it too the row wrapped to THREE lines and the button ended up
   alone on the last one. The price is a fact about the tap, not a control, so
   it sits quietly under them. */
.row{display:flex;align-items:center;gap:10px;font-size:13px;margin:0}
.row input{width:56px;font-family:inherit;font-size:16px;padding:4px 6px;border:1px solid #cfc6b6;border-radius:6px;background:#fff}
p.cost{font-size:12px;color:#8a8176;margin:6px 0 0}
.tofoot{margin-left:auto;display:inline-block;font:inherit;font-size:13px;padding:7px 12px;border:1px solid #2b2622;border-radius:6px;color:#2b2622;background:#fff;text-decoration:none}
.nav{display:flex;align-items:center;justify-content:space-between;padding:6px 0 8px;margin-right:64px;font-size:13px}
.nav button{font:inherit;border:1px solid #cfc6b6;border-radius:6px;background:#fff;padding:6px 12px}
</style>
"""

SCRIPT = r"""
var CHAT='%s', SHEET='%s', LIMIT=%d, PERSEC=%s;
function post(body){ return fetch('/api/chatfeed/verdict',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); }
// A PRICE ON AN ATLAS CARD WEARS A TILDE — Atlas has no billing API and no
// charge here has ever been read back against an estimate.
function cost(k){ var s=parseInt(document.querySelector('.secs[data-key="'+k+'"]').value)||0; document.querySelector('.cost[data-key="'+k+'"]').textContent='~'+(s*PERSEC).toFixed(1)+'¢ at ~'+PERSEC+'¢/s (Atlas Mini 480p)'; }
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
// Her edits come back on the next open and WIN over the words baked into the
// page — the posted html is the script as she dictated it, the sheet is what
// she has typed since.
fetch('/api/chatfeed/verdict?chat='+encodeURIComponent(CHAT)+'&sheet='+encodeURIComponent(SHEET)).then(function(r){return r.json();}).then(function(d){ var T=d.texts||{};
  document.querySelectorAll('.p[data-key]').forEach(function(ta){ var k=ta.getAttribute('data-key'), f=ta.getAttribute('data-field')||'p', v=T[k+'.'+f];
    if(typeof v==='string' && v.length){ ta.value=v; ta.style.height='auto'; ta.style.height=(ta.scrollHeight+2)+'px'; } });
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
  localStorage.setItem('footage_handoff',JSON.stringify({prompt:(mine.trim()?mine.trim()+'\n\n':'')+words,refs:refs,model:'mini',seconds:s,res:'480p',ratio:'3:4',from:CHAT,title:a.getAttribute('data-title'),at:Date.now()}));
 }catch(e){} }); });
document.querySelectorAll('.secs').forEach(function(inp){ var k=inp.getAttribute('data-key'); cost(k); inp.addEventListener('input',function(){ cost(k); post({chat:CHAT,sheet:SHEET,item:k+'.s',text:inp.value}); }); });
var deck=document.getElementById('deck'), cards=[].slice.call(deck.children), pos=document.getElementById('pos');
function at(){ return Math.round(deck.scrollLeft/deck.clientWidth); }
function go(i){ i=Math.max(0,Math.min(cards.length-1,i)); deck.scrollTo({left:i*deck.clientWidth,behavior:'smooth'}); }
function paintPos(){ pos.textContent=(at()+1)+' / '+cards.length; try{localStorage.setItem('beltsj.at',at());}catch(e){} }
deck.addEventListener('scroll',function(){ clearTimeout(window.__pt); window.__pt=setTimeout(paintPos,80); });
document.getElementById('prev').onclick=function(){go(at()-1);}; document.getElementById('next').onclick=function(){go(at()+1);};
var h=(location.hash||'').replace('#j-',''); var start=cards.findIndex(function(c){return c.getAttribute('data-key')===h;}); if(start<0){ try{start=parseInt(localStorage.getItem('beltsj.at'))||0;}catch(e){start=0;} }
setTimeout(function(){ deck.scrollLeft=start*deck.clientWidth; paintPos(); window.scrollTo(0,0); },50);
window.__compareNotes({chat:CHAT,sheet:'belt-seanjonathan-notes'});
"""


def post(body, supersede=None):
    req = urllib.request.Request(
        BASE + '/api/chatfeed/page',
        data=json.dumps({'chat': CHAT, 'title': TITLE, 'html': body}).encode(),
        headers={'content-type': 'application/json'})
    out = json.loads(urllib.request.urlopen(req).read())
    print(json.dumps(out, indent=1))
    if supersede:
        r2 = urllib.request.Request(BASE + '/api/chatfeed/page/%s/supersede' % supersede,
                                    data=b'{}', headers={'content-type': 'application/json'})
        print(urllib.request.urlopen(r2).read().decode())
    return out


if __name__ == '__main__':
    body = build()
    out = os.path.join(HERE, 'belt.html')
    open(out, 'w').write(body)
    parts = scenes()
    print('%s  %d bytes  %d cards  longest scene %d chars  (limit %d)'
          % (out, len(body), len(parts), max(len(p) for p in parts), LIMIT))
    if '--post' in sys.argv:
        i = sys.argv.index('--supersede') if '--supersede' in sys.argv else -1
        post(body, sys.argv[i + 1] if i > 0 else None)
