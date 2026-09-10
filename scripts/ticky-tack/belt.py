#!/usr/bin/env python3
"""The Ticky Tack film — the draft belt.

The twin of "The Nautchaug Boyfriend's — the draft belt" (2026-09-10, Sophie:
"have it connect to a belt like nautchaug boyfriend script"): one card a scene
in a horizontally snapping deck, anchored `#j-tt-<n>` so the red scenes page
lands on the card its button names.

ONE DIFFERENCE FROM THE NAUTCHAUG BELT, AND IT IS THE POINT. There, the box
holds her SCRIPT, which she wrote. There is no Ticky Tack script — there is the
book — so the passage rides in a READ-ONLY fold ("from the book", her own words,
the lines named below) and the box she writes in ships EMPTY, per the house rule.
That also removes the whole truncation class: the longest passage here is ~15,000
characters, nearly twice the 8,000 a box can save, and nothing may cut her words.

The saver is the 2026-09-08 one: over the limit the box REFUSES and says by how
much, and every save is read back off the sheet.
`node scripts/test-belt-save-guard.js` sweeps this file.

    python3 scripts/ticky-tack/belt.py
    python3 scripts/ticky-tack/belt.py --post [--supersede <id>]
"""
import html, json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BOOK = os.path.join(os.path.dirname(HERE), '..', 'docs', 'ticky-tack', 'ticky-tack.md')
BASE = 'https://imageforge-q125.onrender.com'
CHAT = 'ticky-tack-film-page-dupe'
SHEET = 'belt-tickytack'
TITLE = 'Ticky Tack — the draft belt'
LIMIT = 8000

# (n, word, section, setting line, [(first line, last line) in ticky-tack.md])
SCENES = [
 ('1','The Rite Aid','Shoot first — the climax',
  'setting: a Rite Aid on Weidler, Portland, morning. she is pushing a wheelchair.',[(1220,1263)]),
 ('2','The bus stop','Shoot first — the climax',
  'setting: a bus stop outside the store, then the bus, Portland, late morning.',[(1266,1299)]),
 ('3','Alex and Alex','Shoot first — the climax',
  'setting: an upstairs landing of five brown doors, then a stranger’s apartment.',[(1302,1351)]),
 ('4','Home','Shoot first — the climax',
  'setting: her own house — a tiny blue room upstairs, a party downstairs, night.',[(1354,1390)]),
 ('5','The reunion','Shoot first — the climax',
  'setting: the alcove outside Whole Foods, the 44 bus, then her porch, night.',[(1392,1428)]),

 ('6','The very beginning','Shoot next — the two beginnings',
  'setting: a bus stop under two fluorescents on a dark winding road out of town.',[(30,60),(104,107)]),
 ('7','Meeting Thomas','Shoot next — the two beginnings',
  'setting: the roadside by the freeway, then an intersection, then under a tree. night.',[(110,173)]),

 ('8','The morning after','Five moments with Thomas that must stay',
  'setting: a quiet residential street at dawn, then a low wall.',[(188,207)]),
 ('9','The $5 dress','Five moments with Thomas that must stay',
  'setting: Belmont, a shop with a $5 bin outside, midday sun.',[(490,509)]),
 ('10','The ducks','Five moments with Thomas that must stay',
  'setting: a pond at dusk.',[(566,569)]),
 ('11','Ticky Tack','Five moments with Thomas that must stay',
  'setting: behind a metal box, and the houses high on the hill above them.',[(778,801)]),
 ('12','Christmas morning','Five moments with Thomas that must stay',
  'setting: a street in the late afternoon, the light going grey.',[(592,601)]),

 ('13','The choke','Hers, must stay',
  'setting: hot cement, the two of them tangled on the ground.',[(470,487)]),
 ('14',"Powell’s",'Hers, must stay',
  'setting: inside Powell’s — a bench among the shelves, and the bathroom mirror.',[(236,247)]),
 ('15','The car accident','Hers, must stay',
  'setting: a quiet street by People’s Co-op, her arms piled with things.',[(606,645)]),
 ('16','The raw egg','Hers, must stay',
  'setting: the pavement in front of the co-op, a parked car blocking the view.',[(654,667)]),
 ('17','The orange trail','Hers, must stay',
  'setting: a crossing, then side streets, then caution tape and orange flags.',[(700,717)]),
 ('17a','The red dress','Hers, must stay',
  'setting: a bougie clothing store, Lana Del Rey playing, a too-tiny mirror.',[(1032,1041)]),
 ('17b','The train','Hers, must stay',
  'setting: an old above-ground train at dark, tracks and telephone lines.',[(1044,1053)]),
 ('17c','The Black','Hers, must stay',
  'setting: a park bathroom at night, then the curb, then an outside hallway with a fan.',[(1054,1151)]),
 ('17d','The slap','Hers, must stay',
  'setting: a main street at night, then the door of an apartment.',[(1154,1181)]),
 ('17e','The wheelchair','Hers, must stay',
  'setting: outside St. John’s at night, then a little free library, then morning.',[(1190,1215)]),

 ('18','The hotel','Secondary — recommend keeping',
  'setting: a grand red hotel lobby with black leather couches, morning.',[(208,233)]),
 ('19','The voter man','Secondary — recommend keeping',
  'setting: on the train, a man with a clipboard.',[(284,289)]),
 ('20','The Winning Spot','Secondary — recommend keeping',
  'setting: a dive bar across the street, and the sunny pavement outside it.',[(326,347)]),
 ('21','The free pizza','Secondary — recommend keeping',
  'setting: a refurbished pool hall with red light, a party inside, a parking lot.',[(362,393)]),
 ('22','The night she floats','Secondary — recommend keeping',
  'setting: a street of three-storey houses at night, an enclosure by the stairs.',[(428,451)]),
 ('23','The coffee','Secondary — recommend keeping',
  'setting: a foggy morning street, a parking meter, bushes.',[(454,463)]),
 ('24','The bus dare','Secondary — recommend keeping',
  'setting: a road at night, wet leaves, a bus coming fast.',[(754,761)]),
 ('25','The leaving and the catching','Secondary — recommend keeping',
  'setting: the co-op, a bridge, train tracks, then her old house at night.',[(670,697)]),
 ('26','“Have a baby?”','Secondary — recommend keeping',
  'setting: a yellow plush couch-thing on the pavement.',[(836,851)]),
 ('27','The juice','Secondary — recommend keeping',
  'setting: a juice shop, then the cement outside, then a hill of trash.',[(854,863)]),
 ('28','The split','Secondary — recommend keeping',
  'setting: downtown Portland at night — a trendy bar, a fortune teller’s pink table, a parking garage, a lit alcove.',[(914,955)]),
 ('30','The two Toms','Secondary — recommend keeping',
  'setting: a grocery store’s peanut butter aisle, then a picnic table outside a restaurant.',[(978,1013)]),
 ('31','The taxi','Secondary — recommend keeping',
  'setting: a main street at night, then the back of a taxi, then the freeway.',[(1178,1189)]),

 ('32','The bridge bench','Montage / can go',
  'setting: a bench near the bridge, a beautiful nonchalant day.',[(256,265)]),
 ('33','French fries','Montage / can go',
  'setting: a fast food counter and the pavement outside, him on a payphone.',[(268,273)]),
 ('34','The flag and the pigeons','Montage / can go',
  'setting: coming off the train, then a curb, birds rising off a building at sunset.',[(300,323)]),
 ('35','Nice Dream','Montage / can go',
  'setting: walking, the light going out of the sky.',[(350,359)]),
 ('36','The blankets man','Montage / can go',
  'setting: under a tree at night, a mesh of leaves overhead; then morning.',[(396,413)]),
 ('37','The dancing woman','Montage / can go',
  'setting: on a city bus, two men arguing about a transfer.',[(418,425)]),
 ('38','The noodles','Montage / can go',
  'setting: a Chinese restaurant, a two-person table; then a dusty blue truck of bananas.',[(512,533)]),
 ('39','The pee attempts','Montage / can go',
  'setting: a new neighbourhood — a swing, a tree, a lawn mower, a pickup truck.',[(558,565)]),
 ('40','The chemicals rants','Montage / can go',
  'setting: a side street full of spiny balls fallen from a tree.',[(536,555)]),
 ('41','The statue and the food cart','Montage / can go',
  'setting: a roundabout with a gold statue of a man on a horse; then a food cart at dusk; then a green van.',[(572,583)]),
 ('42','Peanut butter samples','Montage / can go',
  'setting: inside a grocery store, then a brick enclosure outside it.',[(740,751)]),
 ('43','The jeep and the books','Montage / can go',
  'setting: an open jeep, a little free library, then under a tree in the rain.',[(724,737)]),
 ('44','Odds and ends','Montage / can go',
  'setting: neighbourhood streets over several days — a box of food, a curb, a festival, a fence.',[(804,833),(866,909)]),
]


def book_lines():
    return open(BOOK, encoding='utf-8').read().split('\n')


def passage(spans, lines):
    out = []
    for a, b in spans:
        chunk = '\n'.join(lines[a - 1:b]).strip()
        if out:
            out.append('        *        *        *')
        out.append(chunk)
    # A blank line between paragraphs, the way the book reads.
    return '\n\n'.join(p for p in '\n\n'.join(out).split('\n\n') if p.strip())


def build():
    e = html.escape
    lines = book_lines()
    cards, toc = [], []
    seen = None
    for n, name, section, setting, spans in SCENES:
        k = 'tt-%s' % n
        head = '<p class="ep">%s</p>' % e(section) if section != seen else ''
        seen = section
        cards.append(
            '<section class="card" id="j-%s" data-key="%s" data-item="%s">\n'
            '%s<h2>%s · %s<span class="st">waiting for words</span></h2>\n'
            '<details class="text"><summary>header lines (mine, sent before your words — edit them)</summary>'
            '<textarea class="p" data-key="%s" data-field="mine" spellcheck="false">%s</textarea>'
            '<div class="saved" id="sv-%s-mine"></div></details>\n'
            '<details class="text"><summary>from the book (your words — read only)</summary>'
            '<pre class="src">%s</pre></details>\n'
            '<details class="text" open><summary>your words</summary>'
            '<textarea class="p" data-key="%s" spellcheck="false"></textarea>'
            '<div class="saved" id="sv-%s"></div></details>\n'
            '<div class="attached">'
            '<div class="row"><label>seconds <input class="secs" data-key="%s" type="number" min="4" max="15" value="4"></label>'
            '<span class="cost" data-key="%s"></span></div>'
            '<div class="sendrow"><a class="tofoot" href="/footage" data-key="%s" data-title="%s">send to Footage ›</a></div>'
            '<script type="application/json" class="refjson" data-key="%s">[]</script>'
            '<p class="mine">no references on file yet — the clip draws from the words alone.</p>'
            '</div>\n</section>' % (
                k, k, k, head, e(n), e(name), k, e(setting), k,
                e(passage(spans, lines)), k, k, k, k, k, e('%s · %s' % (n, name)), k))
        toc.append('<a href="#j-%s">%s %s</a>' % (k, e(n), e(name)))

    help_html = (
        '<p><b>Nothing on this page is sent.</b> One card a scene, in the order you '
        'said to shoot them. <i>From the book</i> is your own words, read only — the '
        'passage that scene comes out of. The box under it is empty and is yours: what '
        'the clip should show. A line with only <i>cut</i> on it splits a card into pieces.</p>'
        '<p>Every card is Seedance 2.0 Mini · 480p · landscape 16:9 · sound on, through '
        'Atlas Cloud at 1.1¢ a second (4s = 4.4¢; all 48 cards at 4s = about $2.10). '
        'Seconds are yours to set (Mini takes 4–15). The header lines above your words are '
        'mine and say only the setting — never what a picture shows. There are no reference '
        'images on file yet. A clip goes out only on your go for that card.</p>'
        '<p class="toc">' + ' · '.join(toc) + '</p>')

    return CSS + (
        '<h1>%s</h1>\n'
        '<div class="nav"><button id="prev" type="button">‹ back</button>'
        '<span id="pos"></span><button id="next" type="button">next ›</button></div>\n'
        '<div class="deck" id="deck">%s</div>\n'
        '<script>\n%s\n%s\n</script>\n'
    ) % (e(TITLE), '\n'.join(cards), SCRIPT % (CHAT, SHEET, LIMIT), 'window.__compareHelp({html:%s});' % json.dumps(help_html))


CSS = """<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="stylesheet" href="/compare.css"><script src="/compare.js"></script>
<style>
.deck{display:flex;align-items:flex-start;overflow-x:auto;overflow-y:visible;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none} .deck::-webkit-scrollbar{display:none}
.card h2,.card .sends,.card .pend,.card .text summary{margin-right:58px}
.card{flex:0 0 100%;scroll-snap-align:start;scroll-snap-stop:always;box-sizing:border-box;padding:6px 14px 60px}
h2{font-size:16px;margin:0 0 6px} .st{display:block;font-size:11px;font-weight:400;color:#8a8176;text-transform:uppercase;letter-spacing:.04em;margin-top:2px}
.text summary{cursor:pointer;font-size:12px;text-decoration:underline;color:#6b6257;margin-bottom:6px}
textarea.p{width:100%;box-sizing:border-box;font-family:inherit;font-size:16px;line-height:1.5;padding:10px;border:1px solid #cfc6b6;border-radius:6px;background:#fff;resize:none;min-height:100px}
/* THE BOOK IS READ ONLY — a <pre>, never a textarea. The longest passage here is
   about 15,000 characters, nearly twice what a box can save, and nothing may cut
   her words. */
pre.src{font:inherit;font-size:15px;line-height:1.5;white-space:pre-wrap;margin:0;padding:10px;border:1px solid #e3dccd;border-radius:6px;background:#fbf8f1;color:#3a352e}
.saved{font-size:11px;color:#8a8176;min-height:14px;margin-top:3px} .saved.bad{color:#b5473c;font-weight:600}
.attached{margin-top:14px;padding-top:10px;border-top:1px solid #e3dccd}
.row{display:flex;align-items:center;gap:12px;font-size:13px;margin:0 0 8px} .row input{width:56px;font-family:inherit;font-size:16px;padding:4px 6px;border:1px solid #cfc6b6;border-radius:6px;background:#fff} .cost{color:#6b6257}
.ep{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#8a8176;margin:0 0 4px}
.sendrow{margin:0 0 10px} .tofoot{display:inline-block;font:inherit;font-size:13px;padding:7px 12px;border:1px solid #2b2622;border-radius:6px;color:#2b2622;background:#fff;text-decoration:none}
p.mine{font-size:12px;color:#8a8176;margin:6px 0 0}
.nav{display:flex;align-items:center;justify-content:space-between;padding:6px 0 8px;margin-right:64px;font-size:13px}
.nav button{font:inherit;border:1px solid #cfc6b6;border-radius:6px;background:#fff;padding:6px 12px}
</style>
"""

SCRIPT = r"""
var CHAT='%s', SHEET='%s', LIMIT=%d;
function post(body){ return fetch('/api/chatfeed/verdict',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); }
function cost(k){ var s=parseInt(document.querySelector('.secs[data-key="'+k+'"]').value)||0; document.querySelector('.cost[data-key="'+k+'"]').textContent=(s*1.1).toFixed(1)+'¢ at 1.1¢/s (Atlas Mini 480p) · '+(s*4)+'¢ on APIFRAME'; }
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
// The saved words come back on the next open — a card is where she left it.
fetch('/api/chatfeed/verdict?chat='+encodeURIComponent(CHAT)+'&sheet='+encodeURIComponent(SHEET)).then(function(r){return r.json();}).then(function(d){ var T=d.texts||{};
  document.querySelectorAll('.p[data-key]').forEach(function(ta){ var k=ta.getAttribute('data-key'), f=ta.getAttribute('data-field')||'p', v=T[k+'.'+f];
    if(typeof v==='string' && v.length && !ta.value){ ta.value=v; ta.style.height='auto'; ta.style.height=(ta.scrollHeight+2)+'px'; if(f==='p'){ var c=document.querySelector('.card[data-key="'+k+'"] .st'); if(c) c.textContent='written'; } } });
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
function paintPos(){ pos.textContent=(at()+1)+' / '+cards.length; try{localStorage.setItem('belttt.at',at());}catch(e){} }
deck.addEventListener('scroll',function(){ clearTimeout(window.__pt); window.__pt=setTimeout(paintPos,80); });
document.getElementById('prev').onclick=function(){go(at()-1);}; document.getElementById('next').onclick=function(){go(at()+1);};
var h=(location.hash||'').replace('#j-',''); var start=cards.findIndex(function(c){return c.getAttribute('data-key')===h;}); if(start<0){ try{start=parseInt(localStorage.getItem('belttt.at'))||0;}catch(e){start=0;} }
setTimeout(function(){ deck.scrollLeft=start*deck.clientWidth; paintPos(); window.scrollTo(0,0); },50);
window.__compareNotes({chat:CHAT,sheet:'belt-tickytack-notes'});
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
    lines = book_lines()
    longest = max(SCENES, key=lambda s: len(passage(s[4], lines)))
    print('%s  %d bytes  %d cards  longest passage %d chars (%s)'
          % (out, len(body), len(SCENES), len(passage(longest[4], lines)), longest[1]))
    if '--post' in sys.argv:
        i = sys.argv.index('--supersede') if '--supersede' in sys.argv else -1
        post(body, sys.argv[i + 1] if i > 0 else None)
