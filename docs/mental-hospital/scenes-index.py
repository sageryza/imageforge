#!/usr/bin/env python3
"""The ward film — the scenes.

One button a scene, in film order; a tap opens that scene's card on whichever
belt page holds it. A duplicate of the Nautchaug Boyfriend's scenes page
(new-script-draft, SfBrS6hdiBoxRAELU8NJ) in LIGHT BLUE, Sophie's ask 2026-09-10.

Nothing here sends anything. It is an index: the belt pages stay the place a
clip is written, priced and sent.

The ward film's scenes live on SEVEN belt pages across seven chats (see
belt/VERSIONS.md), so every tile carries its own page id. Where two pages hold
the same scene the NEWEST one wins — the dedupe is in SCENES below, by hand.

  python3 docs/mental-hospital/scenes-index.py          # write scenes-index.html
  python3 docs/mental-hospital/scenes-index.py --post   # post/repost it
"""
import json, os, sys, urllib.request, html

HERE  = os.path.dirname(os.path.abspath(__file__))
BASE  = os.environ.get('FORGE_BASE', 'https://imageforge-q125.onrender.com')
CHAT  = os.environ.get('SCENES_CHAT', 'ward-film-page-duplicate')
STATE = os.path.join(HERE, 'scenes-index-state.json')
ICONS = json.load(open(os.path.join(HERE, 'scenes-index-icons.json')))

# The live belt pages this index points at (audited 2026-09-10).
P1   = '8WsD85HMC9tUtIBY6vIg'  # Part One — the belt v2          · part-one-city-powers
PILL = 'pTSa4G367QwuUTiVqcBC'  # The pill scenes v2               · pull-scenes-risperdal
SOAP = 'k0BlUzAwvf99O641q4P4'  # The soap pill scene v10          · soap-pill-scene
MD   = 'KMGpzR0LNsbk1nVobmEl'  # Her scenes — the belt v10        · hospital-night-film
BODY = 'co8OW3LLEQjeKPKQ1oOK'  # The beautiful body — the belt v1 · video-editing-continuity
OH   = 'wgrby6PbhSJLyPxmNv6s'  # Two scenes — shock, the door v19 · hospital-severance-rough-cut

# (section, [(page, anchor, word, icon, full title)])
SCENES = [
 ('Part one — the city', [
   (P1, 'j-p1-00', 'storm',    'cloud-lightning', 'Wesleyan — under the bed in the storm'),
   (P1, 'j-p1-01', 'city',     'building-2',      'Into the city — after dropping out'),
   (P1, 'j-p1-02', 'taxi',     'car-taxi-front',  'The taxi — good things come in small packages'),
   (P1, 'j-p1-03', 'wear',     'shirt',           'What to wear — the mirror'),
 ]),
 ('Part one — the dance', [
   (P1, 'j-p1-d%d' % i, 'dance %d' % (i + 1), 'music',
    'The dance — %d of 9' % (i + 1)) for i in range(9)
 ]),
 ('Part one — the gloves', [
   (P1, 'j-p1-g%d' % i, 'gloves %d' % (i + 1), 'hand',
    'The gloves — %d of 9' % (i + 1)) for i in range(9)
 ]),
 ('The ward — the pills', [
   (PILL, 'j-13',  'meds',     'pill',           'Morning meds — the jolly nurse'),
   (PILL, 'j-21',  'sluggish', 'battery-low',    '"It just made me sluggish" — the pill on the desk, the orange'),
   (SOAP, 'j-43a', 'edna',     'user-round',     "Nurse Edna — you're lucky, wan peel, the half pill, veery good"),
   (SOAP, 'j-43b', 'cup',      'cup-soda',       'Nurse Edna — the pill in the cup, eet eez ahp to you'),
   (SOAP, 'j-43c', 'soap',     'droplets',       'The soap — the window over New York, the bar of soap, the cup'),
   (SOAP, 'j-43d', 'station',  'clipboard-list', "The nurses' station — I've decided, good job"),
   (SOAP, 'j-43e', 'crayon',   'pencil',         'The half pill takes hold — crayon, butter, sugar, the push-up'),
   (PILL, 'j-47',  'name',     'tag',            'The pill-cup sculpture — "Sage, that\'s a nice name"'),
 ]),
 ('The ward — the sculptures', [
   (MD, 'j-md-23a1', 'pockets',    'boxes',   'The montage — the tray and the pockets'),
   (MD, 'j-md-23a2', 'sculptures', 'shapes',  'The montage — the tape sculptures at night'),
   (MD, 'j-md-23b',  'basura',     'trash-2', 'The sculptures gone — esta es basura'),
   (MD, 'j-md-23c',  'drawer',     'archive', 'The sculptures gone — Mary and Juanita, the city, the drawer'),
 ]),
 ('The ward — Yolanda', [
   (BODY, 'j-yol-aud', 'audition',  'mic-vocal',       'Yolanda + the young male nurse — the audition'),
   (BODY, 'j-24a',     'skinny',    'person-standing', 'Yolanda and the young male nurse — I uze to be so skeeny'),
   (BODY, 'j-24b1',    'lithium 1', 'message-circle',  'Yolanda and the young male nurse — the lithium speech, part 1'),
   (BODY, 'j-24b2',    'lithium 2', 'message-circle',  'Yolanda and the young male nurse — the lithium speech, part 2'),
   (BODY, 'j-24c',     'chair',     'armchair',        "Yolanda and the young male nurse — the nurse's reply, the chair buckles"),
 ]),
 ("The ward — Ms. O'Hara", [
   (OH, 'j-ohara-aud', 'o’hara',  'users-round', "Ms. O'Hara + her two nurses — the audition"),
   (OH, 'j-36a1',      'straps',       'lock',        'Ms. O\'Hara — the straps, "where are they taking you?"'),
   (OH, 'j-36aA',      'stretcher',    'ambulance',   "Ms. O'Hara — clip A: the stretcher passes, her memory"),
   (OH, 'j-36aA2',     'retake',       'repeat',      "Ms. O'Hara — clip A v2: the same, no nail bite at the end"),
   (OH, 'j-36a2',      'reach',        'grab',        'Ms. O\'Hara — "to help your miiind", wheeled away, the hand reach'),
   (OH, 'j-36b',       'goblins',      'ghost',       "Ms. O'Hara — ghosts and goblins, ready to be wheeled"),
   (OH, 'j-37',        'escort',       'footprints',  'Walking beside the stretcher — be a good girl and go back to your room'),
 ]),
 ('The ward — the hallway', [
   (PILL, 'j-42', 'goodbye', 'hand-heart',  'The hallway goodbye'),
   (OH,   'j-48', 'door',    'door-closed', "The end of the hallway — take the pill / don't take the pill"),
 ]),
 ('The climax', [
   (MD, 'j-md-31a', 'judge',      'gavel',       'Climax 3 — Tomorrow? → the judge'),
   (MD, 'j-md-31b', 'grin',       'smile',       'Climax 3 — the grin, the ghost, You can go now'),
   (MD, 'j-md-32b', 'float',      'waves',       'Climax 4 — the hall float, the mirror'),
   (MD, 'j-md-33',  'speech',     'megaphone',   'Climax 5 — the speech at the mirror'),
   (MD, 'j-md-34',  'breakdown',  'heart-crack', 'Climax 6 — the hall breakdown'),
 ]),
]

HELP = ("<p><b>Every scene of the ward film that has to be shot, in film order.</b> "
        "One button a scene: its own word, and a tap opens that scene's card on the belt "
        "page that holds it — your words, the references, the seconds, and Send. "
        "Nothing here sends anything.</p>"
        "<p>The ward film's scenes are spread over seven belt pages in seven chats, so the "
        "buttons land in different places; where two pages held the same scene, the newest "
        "one won.</p>")


def esc(s):
    return html.escape(s, quote=True)


def svg(name):
    return ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>'
            % ICONS[name])


def build():
    n, tiles = 0, []
    for section, rows in SCENES:
        tiles.append('<p class="ep">%s</p>' % esc(section))
        for page, anchor, word, icon, title in rows:
            n += 1
            lab = '%d · %s' % (n, title)
            tiles.append(
                '<a class="b" href="/api/chatfeed/page/%s#%s" aria-label="%s" title="%s">%s<span>%s</span></a>'
                % (page, anchor, esc(lab), esc(lab), svg(icon), esc(word)))
    return n, HEAD + '\n'.join(tiles) + TAIL % json.dumps(HELP)


HEAD = """<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="stylesheet" href="/compare.css">
<style>
/* LIGHT BLUE, her ask 2026-09-10 — the same key as the Nautchaug scenes page,
   in blue instead of beige. The ink outline and the ink word stay near-black:
   at 55px a blue-on-blue label is the first thing that stops reading. */
:root{--cols:5;--tile:#cfe3f2;--edge:#98bcd8;--tileink:#12212b}
/* THE GRID ENDS BEFORE THE PILL'S COLUMN. The injected autoscroll pill is
   position:fixed in the top-right (x~326-374, y 14-197 at 390pt), so every row
   passes under it on the way up — and every cell here is a tappable control,
   so the whole grid stops 64px short rather than only its first row. */
.grid{display:grid;grid-template-columns:repeat(var(--cols),1fr);gap:11px 6px;margin-right:64px}
.b{container-type:inline-size;aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
   background:var(--tile);border:1.5px solid var(--tileink);border-radius:8px;color:var(--tileink);text-decoration:none;padding:2px;-webkit-tap-highlight-color:transparent;
   box-shadow:0 3px 0 var(--edge),0 3px 0 1.5px var(--tileink)}
/* PRESSED = the tile drops onto its own shadow. No gradient anywhere: the 3-D
   is one flat darker blue wall under a flat face, outlined with the same
   near-black as the tile, so it reads as a physical key at 55px. */
.b:active{transform:translateY(3px);box-shadow:0 0 0 var(--edge),0 0 0 1.5px var(--tileink)}
.b svg{width:20px;height:20px;width:36cqw;height:36cqw;display:block;color:var(--tileink)}
.b span{font:700 8px/1 -apple-system,'Helvetica Neue',sans-serif;font-size:15cqw;letter-spacing:.02em;text-transform:uppercase;white-space:nowrap;color:var(--tileink)}
.ep{grid-column:1/-1;font:700 10px/1.2 -apple-system,'Helvetica Neue',sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--ink2);margin:14px 0 0}
.ep:first-child{margin-top:2px}
</style>
<div class="wrap">
<h1>__TITLE__</h1>
<div class="grid">"""

TAIL = """</div>
</div>
<script src="/compare.js"></script>
<script>
(function(){ window.__compareHelp({html: %s}); })();
</script>
"""


def main():
    st = {'ver': 0, 'ids': []}
    if os.path.exists(STATE):
        st = json.load(open(STATE))
    ver = st['ver'] + 1 if '--post' in sys.argv else max(st['ver'], 1)
    title = 'The ward film — the scenes v%d' % ver
    n, page = build()
    page = page.replace('__TITLE__', esc(title))
    open(os.path.join(HERE, 'scenes-index.html'), 'w').write(page)
    print('%d scenes, %d bytes — %s' % (n, len(page), title))
    if '--post' not in sys.argv:
        return
    body = json.dumps({'chat': CHAT, 'title': title, 'html': page}).encode()
    req = urllib.request.Request(BASE + '/api/chatfeed/page', body,
                                 {'Content-Type': 'application/json'})
    r = json.load(urllib.request.urlopen(req, timeout=90))
    print('posted', r.get('id'), 'warnings:', r.get('warnings'))
    for old in st['ids']:
        try:
            urllib.request.urlopen(urllib.request.Request(
                '%s/api/chatfeed/page/%s/supersede' % (BASE, old), b'{}',
                {'Content-Type': 'application/json'}), timeout=30)
            print('superseded', old)
        except Exception as e:
            print('supersede failed', old, e)
    json.dump({'ver': ver, 'ids': [r['id']]}, open(STATE, 'w'))
    print('%s/api/chatfeed/page/%s' % (BASE, r['id']))


if __name__ == '__main__':
    main()
