#!/usr/bin/env python3
# hub.py — THE SCENES (2026-09-10, Sophie: "a compare page with each scene
# that needs to be shot as a rounded square button, all beige with an icon for
# that scene chosen from listed icons and one word that describes it set apart
# from all the other scenes. The buttons can be five to a row and will maybe
# change it to seven or eight to a row depending on how many there are. the
# icons and text can be white").
#
# One button per card in jobs.json (film order, 128 of them). Nothing on this
# page sends anything and nothing is stored: it is a way IN — a tap opens that
# scene's own card on the draft belt (#j-<key>), which is where her words, her
# seconds and the Send to Footage button live.
#
# FIVE TO A ROW IS ONE NUMBER — `--cols` on :root. Seven or eight is editing
# that one line (she said she may change it); there is deliberately no control
# for it on the page.
# THE ICON AND THE WORD PER CARD LIVE IN icons.json, not in this file, so a
# later chat can change one pair without touching code. Every word is
# DIFFERENT from every other ("set apart"), and this build FAILS on a
# duplicate rather than posting a page with two scenes called the same thing.
# The icons are Lucide line icons, INLINED (the page makes no external
# request) — fetched once from unpkg and cached in icons-svg.json.
#
#   python3 hub.py            posts the next version and supersedes the last
#   HUB_DRY=1 python3 hub.py  writes hub.html and posts nothing
#
# belt.py re-runs this after it posts, so the links can never point at a
# superseded belt.
import json, os, re, urllib.request, html as H, collections

B     = 'https://imageforge-q125.onrender.com'
CHAT  = os.environ.get('HUB_CHAT', 'new-script-draft')
TITLE = os.environ.get('HUB_TITLE', "The Nautchaug Boyfriend's — the scenes")
HERE  = os.path.dirname(os.path.abspath(__file__)) or '.'
STATE = os.path.join(HERE, 'hub-state.json')
CACHE = os.path.join(HERE, 'icons-svg.json')
COLS  = os.environ.get('HUB_COLS', '5')          # five to a row; 7 or 8 is this number

def post(path, body):
    r = urllib.request.Request(B + '/api/chatfeed/' + path, data=json.dumps(body).encode(),
                              headers={'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(r))

jobs  = json.load(open(os.path.join(HERE, 'jobs.json')))
icons = json.load(open(os.path.join(HERE, 'icons.json')))
belt  = json.load(open(os.path.join(HERE, 'belt-state.json')))
BELT  = (belt.get('ids') or [None])[0]
if not BELT: raise SystemExit('no belt id in belt-state.json — post the belt first')

# --- the two things that must be true before a page is built -----------------
missing = [j['key'] for j in jobs if j['key'] not in icons]
if missing: raise SystemExit('icons.json has no pair for: %s' % ', '.join(missing))
words = [icons[j['key']]['word'] for j in jobs]
dupes = sorted(w for w, n in collections.Counter(words).items() if n > 1)
if dupes: raise SystemExit('a word must be different on every button — repeated: %s' % ', '.join(dupes))

# --- the icons, inlined ------------------------------------------------------
# One fetch per icon name, ever: the body is cached in icons-svg.json so a
# rebuild needs no network for these and the page carries no external request.
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
def glyph(name):
    if name not in cache:
        url = 'https://unpkg.com/lucide-static@latest/icons/%s.svg' % name
        try: raw = urllib.request.urlopen(url, timeout=30).read().decode()
        except Exception as e: raise SystemExit('icon %s did not fetch (%s) — %s' % (name, e, url))
        m = re.search(r'<svg\b[^>]*>(.*)</svg>', raw, re.S)
        if not m: raise SystemExit('icon %s: nothing inside its <svg> — %s' % (name, url))
        cache[name] = re.sub(r'\s+', ' ', m.group(1)).strip()
    return ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>' % cache[name])

cells, lastep = [], None
for n, j in enumerate(jobs, 1):
    k = j['key']; pair = icons[k]
    if j['ep'] != lastep:
        cells.append('<p class="ep">%s</p>' % H.escape(j['ep'])); lastep = j['ep']
    cells.append('<a class="b" href="/api/chatfeed/page/%s#j-%s" aria-label="%s" title="%s">%s<span>%s</span></a>'
                 % (BELT, k, H.escape('%d · %s' % (n, j['title'])), H.escape('%d · %s' % (n, j['title'])),
                    glyph(pair['icon']), H.escape(pair['word'])))
json.dump(cache, open(CACHE, 'w'), indent=0, sort_keys=True)

page = '''<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="stylesheet" href="/compare.css">
<style>
:root{--cols:__COLS__;--beige:#a89372}
/* THE GRID ENDS BEFORE THE PILL'S COLUMN. The injected autoscroll pill is
   position:fixed in the top-right (x~326-374, y 14-197 at 390pt), so every row
   passes under it on the way up — and every cell here is a tappable control,
   so the whole grid stops 64px short rather than only its first row. */
.grid{display:grid;grid-template-columns:repeat(var(--cols),1fr);gap:6px;margin-right:64px}
.b{container-type:inline-size;aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
   background:var(--beige);border:0;border-radius:6px;color:#fff;text-decoration:none;padding:2px;-webkit-tap-highlight-color:transparent}
.b:active{background:#95815f}
.b svg{width:20px;height:20px;width:36cqw;height:36cqw;display:block;color:#fff}
.b span{font:700 8px/1 -apple-system,'Helvetica Neue',sans-serif;font-size:15cqw;letter-spacing:.02em;text-transform:uppercase;white-space:nowrap;color:#fff}
.ep{grid-column:1/-1;font:700 10px/1.2 -apple-system,'Helvetica Neue',sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--ink2);margin:14px 0 0}
.ep:first-child{margin-top:2px}
</style>
<div class="wrap">
<h1>__TITLE__</h1>
<div class="grid">__CELLS__</div>
</div>
<script src="/compare.js"></script>
<script>
(function(){
  window.__compareHelp({html:'<p><b>Every scene that has to be shot, in film order.</b> One button a scene: its own word, and a tap opens that scene\\'s card on the draft belt — your words, the references, the seconds, and Send to Footage. Nothing here sends anything.</p><p>Five to a row for now; seven or eight is one number in hub.py when you want them smaller.</p>'});
})();
</script>
'''
page = (page.replace('__COLS__', COLS).replace('__TITLE__', H.escape(TITLE))
            .replace('__CELLS__', '\n'.join(cells)))
open(os.path.join(HERE, 'hub.html'), 'w').write(page)
print(len(jobs), 'buttons ·', len(set(words)), 'distinct words · belt', BELT)

if os.environ.get('HUB_DRY'):
    print('dry — hub.html written, nothing posted'); raise SystemExit
state = json.load(open(STATE)) if os.path.exists(STATE) else {}
ver = state.get('ver', 0) + 1
d = post('page', {'chat': CHAT, 'title': '%s v%d' % (TITLE, ver), 'html': page})
print(d.get('id'), d.get('warnings'))
for old in state.get('ids', []):
    post('page/' + old + '/supersede', {'superseded': True})
json.dump({'ver': ver, 'ids': [d['id']]}, open(STATE, 'w'))
