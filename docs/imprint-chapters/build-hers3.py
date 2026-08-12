#!/usr/bin/env python3
"""The chapters, third cut — "literally just me describing things".

Same engine, same icons, same rows as the other two. The difference is the
filter: `hers-describing.py` holds an explicit KEEP list, because at this
depth the kept messages are the minority and naming them is honest where
naming the cuts would be a wall.

The record of what went: this page cannot list 127 messages one by one
without becoming the thing it removed, so it gives the count per chapter and
points at the previous version, which is SUPERSEDED and not deleted and
carries all 165.
"""
import json, html, pathlib, sys
from importlib.machinery import SourceFileLoader

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))
H = SourceFileLoader('h', str(HERE / 'hers-data.py')).load_module()
K = SourceFileLoader('k', str(HERE / 'hers-describing.py')).load_module()
ICON = SourceFileLoader('ci', str(HERE / 'chapters-icons.py')).load_module().ICON
D = SourceFileLoader('d', str(HERE / 'chapters-data.py')).load_module()
IBASE = ('https://storage.googleapis.com/'
         'deckfactory-43176.firebasestorage.app/lesson-icons/')

groups, hers = H.load()
MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
stamp = lambda iso: MONTH[int(iso[5:7]) - 1] + ' ' + str(int(iso[8:10]))

rows, gone, seen = [], [], set()
for key, g in groups:
    kept = [m for m in g['msgs'] if m['mid'] in K.KEEP]
    seen |= {m['mid'] for m in kept}
    if not kept:
        gone.append((g['title'], len(g['msgs'])))
        continue
    if len(kept) < len(g['msgs']):
        gone.append(None)                       # counted per chapter below
    a, b = stamp(kept[0]['at']), stamp(kept[-1]['at'])
    l1, l2 = K.S.get(key, ('', ''))
    assert l1 and l2, 'no summary written for %s (%s)' % (key, g['title'])
    n = int(key[2:]) if key.startswith('ch') else None
    row = {'id': key, 'title': g['title'],
           'when': a if a == b else a + '–' + b,
           'l1': l1, 'l2': l2, 'kind': D.KIND.get(g['title'], 'build'),
           'left': len(g['msgs']) - len(kept),
           'msgs': [{'who': 'sophie', 'at': m['at'], 'text': m['text']} for m in kept]}
    if n in ICON:
        row['icon'] = IBASE + ICON[n] + '.webp'
    rows.append(row)

stray = K.KEEP - seen
assert not stray, 'KEEP names a message that does not exist: %s' % sorted(stray)
kept_total = sum(len(r['msgs']) for r in rows)
dropped = len(hers) - kept_total
whole_chapters = [x for x in gone if x]
print('sections:', len(rows), 'of', len(groups),
      '| kept:', kept_total, 'of', len(hers), '| left out:', dropped)

e = lambda s: html.escape(s or '', quote=True)
lis = ''.join(
    '<li><span class="hz-c">%s</span>%s</li>' % (e(t), e('all %d messages' % n))
    for t, n in whole_chapters)

data = json.dumps(rows, ensure_ascii=False).replace('</', '<\\/')

CSS = """
.hz{margin:52px 0 0;border-top:1px solid var(--line);padding-top:26px}
.hz h2{font:700 11px/1.3 -apple-system,sans-serif;letter-spacing:.16em;
  text-transform:uppercase;color:var(--gold);margin:0 0 6px}
.hz p{font-size:15px;line-height:1.55;color:var(--ink);margin:0 0 16px}
.hz ul{list-style:none;margin:0;padding:0}
.hz li{font-size:14.5px;line-height:1.5;color:var(--ink);padding:8px 0;
  border-bottom:1px solid var(--line)}
.hz li:last-child{border-bottom:0}
.hz-c{display:block;font:400 10px/1.4 -apple-system,sans-serif;letter-spacing:.07em;
  text-transform:uppercase;color:var(--ink2);margin-bottom:2px}
"""

page = f'''<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Imprint — just the describing</title>
<link rel="stylesheet" href="/compare.css">
<style>{CSS}</style>

<div class="wrap">
  <!-- No eyebrow, no tagline (Sophie, Aug 2026: "keep the title, but get
       rid of the gold text above it and the tagline below it"). chapters.js
       also hides both, which is what takes them off pages already posted. -->
  <h1>Just the describing</h1>
  <div id="chapters"></div>

  <section class="hz">
    <h2>What I left out</h2>
    <p>{dropped} of your {len(hers)} messages: the questions, the direction,
      the corrections, the deciding between options. All of them are still on
      the previous version &mdash; superseded, not deleted &mdash; which holds
      all {len(hers)} and its own left-out list.</p>
    <p>{len(whole_chapters)} chapters have nothing left in them:</p>
    <ul>{lis}</ul>
  </section>
</div>

<script src="/compare.js"></script>
<script src="/chapters.js"></script>
<script id="cxdata" type="application/json">{data}</script>
<script>
(function () {{
  var chapters = JSON.parse(document.getElementById('cxdata').textContent);
  // Its own verdict sheet — a note here answers a description, not the work.
  window.__chapters({{
    chat: 'deck-factory-story-room', sheet: 'chapters-describing', chapters: chapters
  }});
}})();
</script>'''

(HERE / 'hers3-page.html').write_text(page)
print('page:', round(len(page) / 1e6, 3), 'MB | empty chapters:', len(whole_chapters))
