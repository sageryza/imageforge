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
# THE NEW COPY, per chapter number — the 4th level (Sophie: "add one more
# section so there's four, where the new copy will go so I can read it first
# before you add it to the cards"). v7: EVERY lesson recopied from her own
# words (Substack essays, the Read People booklet, her chat dictations) —
# the coffee was already hers ("that one's already in my words"). Each
# lesson sits on the chapter where it was born; a chapter carrying several
# lessons separates them with heading cards (kicker 'the lesson' + title).
ALL_COPY = {}
for _f in ('copy-batch1a.py', 'copy-batch1b.py', 'copy-batch2a.py',
           'copy-batch2b.py', 'copy-batch3.py'):
    ALL_COPY.update(SourceFileLoader(_f[:-3].replace('-', '_'), _f)
                    .load_module().LESSONS)

def deck(title):
    return ALL_COPY[title]          # KeyError = a title typo; fail loud

def multi(*titles):
    cards = []
    for t in titles:
        cards.append({'kicker': 'the lesson', 'h': t})
        cards += deck(t)
    return cards

COPY = {
    3: deck('Astrology — is it stupid, and how it works'),
    4: deck('ADHD & Autism — cluster, spectrum, genes'),
    5: multi('General Dysphoria', 'Synthetic Learning Syndrome'),
    6: multi('God Only Works in Mysterious Ways',
             'My Experiment with Manifestation',
             'In Case You’re Curious (Manifestation, Part II)',
             'For the Hate of the Game',
             'Animal Magic', 'Art Is Forgiving', 'Instrumentalism, Part I'),
    7: deck('What’s the Difference Between OCD and Witchcraft?'),
    8: multi('Inside & Outside Thoughts', 'What Do You Want to Wake Up To?',
             'Two Questions, Not One'),
    9: deck('The Metaphor Machine'),
    10: multi('How to Read People — I. Actions & Intentions',
              'How to Read People — II. The Pattern Collector',
              'How to Read People — III. Expert Mode'),
    11: SourceFileLoader('cc', 'coffee-copy.py').load_module().CARDS,
    14: deck('Where Do You Crop Art?'),
}
assert len(ALL_COPY) == 20, 'expected 20 recopied lessons, got %d' % len(ALL_COPY)
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
    if (i+1) in COPY:
        row['copy'] = {'cards': COPY[i+1]}
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
<title>Imprint — the chapters v7</title>
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
