#!/usr/bin/env python3
"""The chapters, second variation — only her words, summarised in her terms.

Sophie, Aug 2026: "I want the same artifact, a second variation of it, where
the raw content is just my messages and the level two is just summarising my
messages. You can take out the technical stuff that we got wrong — like when
we were going back-and-forth about the Mason images. I'm mostly looking for
the ones where I described how I wanted the stories to be. If you take a lot
of stuff out, just keep track of what you took out so I can ask you about it."

So: same engine, same rows, same icons as the chapters page — three things
different.
  1. LEVEL 3 is her messages ONLY, verbatim. Nothing of mine.
  2. LEVEL 2 summarises HER MESSAGES, not the work that came out of them
     (hers-summaries.py). A summary of what got built would be the other
     artifact again.
  3. A chapter is FILTERED (hers-cuts.py) and every removed message is
     listed at the bottom with its reason, so "taken out" never means
     "gone quiet" — she can ask about any line by name.

A chapter left with nothing kept is dropped from the spine rather than shown
empty, and says so in the left-out list.
"""
import json, html, pathlib, sys, re
from importlib.machinery import SourceFileLoader

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))
H = SourceFileLoader('h', str(HERE / 'hers-data.py')).load_module()
C = SourceFileLoader('c', str(HERE / 'hers-cuts.py')).load_module()
S = SourceFileLoader('s', str(HERE / 'hers-summaries.py')).load_module()

# the icons ride across from the chapters page so the pair reads as one set
ICON = SourceFileLoader('bc', str(HERE / 'chapters-icons.py')).load_module().ICON
IBASE = ('https://storage.googleapis.com/'
         'deckfactory-43176.firebasestorage.app/lesson-icons/')

D = SourceFileLoader('d', str(HERE / 'chapters-data.py')).load_module()
KIND = D.KIND

groups, hers = H.load()
MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
stamp = lambda iso: MONTH[int(iso[5:7]) - 1] + ' ' + str(int(iso[8:10]))

rows, dropped, empty_chapters = [], [], []
for key, g in groups:
    kept = [m for m in g['msgs'] if m['mid'] not in C.CUT]
    for m in g['msgs']:
        if m['mid'] in C.CUT:
            why, what = C.CUT[m['mid']]
            dropped.append({'mid': m['mid'], 'chapter': g['title'],
                            'why': why, 'what': what})
    if not kept:
        empty_chapters.append((key, g['title'], len(g['msgs'])))
        continue
    a, b = stamp(kept[0]['at']), stamp(kept[-1]['at'])
    l1, l2 = S.S.get(key, ('', ''))
    assert l1 and l2, 'no summary written for %s (%s)' % (key, g['title'])
    n = int(key[2:]) if key.startswith('ch') else None
    row = {
        'id': key, 'title': g['title'],
        'when': a if a == b else a + '–' + b,
        'l1': l1, 'l2': l2, 'kind': KIND.get(g['title'], 'build'),
        'msgs': [{'who': 'sophie', 'at': m['at'], 'text': m['text']} for m in kept],
    }
    if n in ICON:
        row['icon'] = IBASE + ICON[n] + '.webp'
    rows.append(row)

kept_total = sum(len(r['msgs']) for r in rows)
print('sections:', len(rows), '| kept:', kept_total, 'of', len(hers),
      '| dropped:', len(dropped))
assert kept_total + len(dropped) == len(hers), 'a message went missing'
for k, t, n in empty_chapters:
    print('  chapter dropped whole:', k, t, '(%d messages)' % n)

# ── the left-out list, grouped by reason ────────────────────────────────────
e = lambda s: html.escape(s or '', quote=True)
blocks = []
for why in C.ORDER:
    items = [d for d in dropped if d['why'] == why]
    if not items:
        continue
    lis = ''.join('<li><span class="hz-c">%s</span>%s</li>'
                  % (e(d['chapter']), e(d['what'])) for d in items)
    blocks.append('<div class="hz-g"><h3>%s<span class="hz-n">%d</span></h3>'
                  '<ul>%s</ul></div>' % (e(C.LABEL[why]), len(items), lis))

whole = ''
if empty_chapters:
    whole = ('<p class="hz-w">Two chapters came out empty and are not on the '
             'list above: <b>%s</b>. Every message in them is in this list.</p>'
             % e(' and '.join('%s (%d)' % (t, n) for _k, t, n in empty_chapters)))

CSS = """
.hz{margin:52px 0 0;border-top:1px solid var(--line);padding-top:26px}
.hz h2{font:700 11px/1.3 -apple-system,sans-serif;letter-spacing:.16em;
  text-transform:uppercase;color:var(--gold);margin:0 0 6px}
.hz .hz-s{font-size:15px;line-height:1.55;color:var(--ink2);margin:0 0 20px}
.hz-g{margin:0 0 20px}
.hz-g h3{display:flex;align-items:baseline;gap:8px;font:400 12px/1.3 -apple-system,sans-serif;
  letter-spacing:.09em;text-transform:uppercase;color:var(--ink);
  border-bottom:1px solid var(--line);padding-bottom:6px;margin:0 0 2px}
.hz-n{margin-left:auto;color:var(--ink2)}
.hz-g ul{list-style:none;margin:0;padding:0}
.hz-g li{font-size:14.5px;line-height:1.5;color:var(--ink);
  padding:8px 0;border-bottom:1px solid var(--line)}
.hz-g li:last-child{border-bottom:0}
.hz-c{display:block;font:400 10px/1.4 -apple-system,sans-serif;letter-spacing:.07em;
  text-transform:uppercase;color:var(--ink2);margin-bottom:2px}
.hz-w{font-size:14.5px;line-height:1.55;color:var(--ink);margin:18px 0 0}
"""

data = json.dumps(rows, ensure_ascii=False).replace('</', '<\\/')

page = f'''<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Imprint — the chapters, in your words</title>
<link rel="stylesheet" href="/compare.css">
<style>{CSS}</style>

<div class="wrap">
  <!-- No eyebrow, no tagline (Sophie, Aug 2026: "keep the title, but get
       rid of the gold text above it and the tagline below it"). chapters.js
       also hides both, which is what takes them off pages already posted. -->
  <h1>The chapters, in your words</h1>
  <div id="chapters"></div>

  <section class="hz">
    <h2>What I left out</h2>
    <p class="hz-s">{len(dropped)} messages, by why. Ask me about any of them and
      I&rsquo;ll put it back.</p>
    {''.join(blocks)}
    {whole}
  </section>
</div>

<script src="/compare.js"></script>
<script src="/chapters.js"></script>
<script id="cxdata" type="application/json">{data}</script>
<script>
(function () {{
  var chapters = JSON.parse(document.getElementById('cxdata').textContent);
  // Same icons as the chapters page (chapters-icons.py is the one copy), so
  // the two artifacts read as a pair rather than two different documents.
  // Its own verdict sheet — her notes here answer HER messages, not the work.
  window.__chapters({{
    chat: 'deck-factory-story-room', sheet: 'chapters-hers', chapters: chapters
  }});
}})();
</script>'''

(HERE / 'hers2-page.html').write_text(page)
print('page:', round(len(page) / 1e6, 2), 'MB')
