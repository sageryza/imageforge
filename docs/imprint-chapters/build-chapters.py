import json, sys, html
sys.path.insert(0, '.')
from importlib.machinery import SourceFileLoader
D = SourceFileLoader('d', 'chapters-data.py').load_module()

ms = json.load(open('raw-messages.json'))
LAST_END = 616   # her 'chapters' ask starts here; this page is its answer
chs = D.CHAPTERS
MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

def stamp(iso):
    return MONTH[int(iso[5:7])-1] + ' ' + str(int(iso[8:10]))

ICON = SourceFileLoader('ci', 'chapters-icons.py').load_module().ICON
IBASE = ('https://storage.googleapis.com/'
         'deckfactory-43176.firebasestorage.app/lesson-icons/')

out = []
for i,(start, title, l1, l2) in enumerate(chs):
    end = chs[i+1][0] if i+1 < len(chs) else LAST_END
    slice_ = ms[start:end]
    if not slice_:
        print('EMPTY CHAPTER:', title); continue
    a, b = stamp(slice_[0]['at']), stamp(slice_[-1]['at'])
    row = {
        'id': 'ch%02d' % (i+1),
        'title': title,
        'when': a if a == b else a + '–' + b,
        'l1': l1, 'l2': l2, 'kind': D.KIND.get(title, 'build'),
        'msgs': [{'who': m['who'], 'at': m['at'], 'text': m['text']} for m in slice_],
    }
    if (i+1) in ICON:
        row['icon'] = IBASE + ICON[i+1] + '.webp'
    out.append(row)

missing = sorted(set(ICON) - {int(c['id'][2:]) for c in out})
assert not missing, 'icon for a chapter that does not exist: %s' % missing
print('icons placed:', sum('icon' in c for c in out), 'of', len(ICON))

data = json.dumps(out, ensure_ascii=False)
covered = sum(len(c['msgs']) for c in out)
print('chapters:', len(out), '| messages covered:', covered, 'of', len(ms))
print('payload:', round(len(data)/1e6, 2), 'MB')

page = '''<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Imprint — the chapters v5</title>
<link rel="stylesheet" href="/compare.css">

<div class="wrap">
  <!-- No eyebrow, no tagline (Sophie, Aug 2026: "keep the title, but get
       rid of the gold text above it and the tagline below it"). chapters.js
       also hides both, which is what takes them off pages already posted. -->
  <h1>The chapters</h1>
  <div id="chapters"></div>
</div>

<script src="/compare.js"></script>
<script src="/chapters.js"></script>
<script id="cxdata" type="application/json">__DATA__</script>
<script>
(function () {
  var chapters = JSON.parse(document.getElementById('cxdata').textContent);
  // Every icon rides ON its chapter (see chapters-icons.py) — cut out
  // of the PASTEL VARIANT lesson sheet as 96px webp display copies, never the
  // 1MB originals. Deliberately NO per-kind `icons` map: that is what put the
  // snake on four rows at once, and Sophie asked for one drawing each. A
  // chapter with no icon of its own keeps the plain coloured dot.
  window.__chapters({
    chat: 'deck-factory-story-room', sheet: 'chapters', chapters: chapters
  });
})();
</script>
'''.replace('__DATA__', data.replace('</', '<\\/'))
open('chapters-page.html','w').write(page)
print('page:', round(len(page)/1e6, 2), 'MB')
