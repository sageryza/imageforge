"""THE LESSONS, IN HER WORDS — one row per LESSON (Sophie, Aug 2026: "why
don't you just split up all the lessons so they're each their own little
thingy, and for now hide everything that's not a lesson").

The chapters page filed each recopied lesson under the chapter that made it,
so three of them shared a row and 'What Do You Want to Wake Up To?' was
invisible until she scrolled inside chapter 8. Here the LESSON is the row.

Same engine (chapters.js), COPY-ONLY shape: no chapter carries l1/l2/msgs,
so the engine builds no level bar and every row opens straight into its
rewritten copy. Nothing about the chapters artifact changes — it is still
there, superseded.
"""
import json
from importlib.machinery import SourceFileLoader

ALL = {}
for f in ('copy-batch1a.py', 'copy-batch1b.py', 'copy-batch2a.py',
          'copy-batch2b.py', 'copy-batch3.py'):
    ALL.update(SourceFileLoader(f[:-3].replace('-', '_'), f).load_module().LESSONS)
ALL['Valued Customer'] = SourceFileLoader('cc', 'coffee-copy.py').load_module().CARDS

IBASE = ('https://storage.googleapis.com/'
         'deckfactory-43176.firebasestorage.app/lesson-icons/')

# The 21 lesson icons already cut from the pastel sheet, in the Lessons hub's
# own order — each drawing belongs to the lesson it was drawn for, so the row
# wears its own picture instead of borrowing its chapter's.
ORDER = [
    ('li-01-adhd-autism',                'ADHD & Autism — cluster, spectrum, genes'),
    ('li-02-general-dysphoria',          'General Dysphoria'),
    ('li-03-two-questions-not-one',      'Two Questions, Not One'),
    ('li-04-inside-outside-thoughts',    'Inside & Outside Thoughts'),
    ('li-05-the-metaphor-machine',       'The Metaphor Machine'),
    ('li-06-where-do-you-crop-art',      'Where Do You Crop Art?'),
    ('li-07-art-is-forgiving',           'Art Is Forgiving'),
    ('li-08-astrology',                  'Astrology — is it stupid, and how it works'),
    ('li-09-instrumentalism-part-i',     'Instrumentalism, Part I'),
    ('li-10-animal-magic',               'Animal Magic'),
    ('li-11-ocd-witchcraft',             'What’s the Difference Between OCD and Witchcraft?'),
    ('li-12-god-only-works-in-mysterious', 'God Only Works in Mysterious Ways'),
    ('li-13-synthetic-learning-syndrome', 'Synthetic Learning Syndrome'),
    ('li-14-for-the-hate-of-the-game',   'For the Hate of the Game'),
    ('li-15-what-do-you-want-to-wake-up-', 'What Do You Want to Wake Up To?'),
    ('li-16-valued-customer',            'Valued Customer'),
    ('li-17-i-actions-intentions',       'How to Read People — I. Actions & Intentions'),
    ('li-18-ii-the-pattern-collector',   'How to Read People — II. The Pattern Collector'),
    ('li-19-iii-expert-mode',            'How to Read People — III. Expert Mode'),
    ('li-20-my-experiment-with-manifesta', 'My Experiment with Manifestation'),
    ('li-21-in-case-you-re-curious-part-', 'In Case You’re Curious (Manifestation, Part II)'),
]

missing = [t for _, t in ORDER if t not in ALL]
assert not missing, 'no recopy for: %s' % missing
extra = sorted(set(ALL) - {t for _, t in ORDER})
assert not extra, 'recopy with no row: %s' % extra

def slug(icon):
    return icon.split('-', 2)[2].strip('-') or icon   # li-08-astrology → astrology

out = []
for icon, title in ORDER:
    cards = ALL[title]
    mine = sum(1 for c in cards
               if '[[' in (c.get('body', '') + c.get('h', '')))
    out.append({
        'id': 'ls-' + icon.split('-')[1] + '-' + slug(icon)[:24],
        'title': title,
        # the slot the date used to hold: how much there is, and how much of
        # it is still mine — the two things she needs before tapping in.
        'when': '%d cards · %d mine' % (len(cards), mine) if mine
                else '%d cards · all yours' % len(cards),
        'icon': IBASE + icon + '.webp',
        'kind': 'lesson',
        'copy': {'cards': cards},
    })

data = json.dumps(out, ensure_ascii=False)
print('lessons:', len(out), '| cards:', sum(len(c['copy']['cards']) for c in out))
print('payload:', round(len(data) / 1e6, 3), 'MB')

page = '''<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>The lessons, in your words</title>
<link rel="stylesheet" href="/compare.css">

<div class="wrap">
  <h1>The lessons, in your words</h1>
  <div id="chapters"></div>
</div>

<script src="/compare.js"></script>
<script src="/chapters.js"></script>
<script id="cxdata" type="application/json">__DATA__</script>
<script>
(function () {
  var lessons = JSON.parse(document.getElementById('cxdata').textContent);
  // One row per LESSON. No row carries l1/l2/msgs, so chapters.js builds no
  // level bar and every row opens straight into its rewritten copy.
  window.__chapters({
    chat: 'deck-factory-story-room', sheet: 'lessons-copy', chapters: lessons
  });
  // Forward-compatible fallback: if this page is opened against an engine
  // deployed BEFORE the copy-only shape existed, the bar is still built and
  // starts on 'gist', which has nothing to show. Put it on copy and take it
  // away. A no-op on the current engine, and it costs one query.
  var bar = document.querySelector('.cx-lv');
  if (bar) {
    var tabs = bar.querySelectorAll('button');
    if (tabs.length === 4) tabs[3].click();
    bar.style.display = 'none';
  }
})();
</script>
'''.replace('__DATA__', data.replace('</', '<\\/'))
open('lessons-copy-page.html', 'w').write(page)
print('page:', round(len(page) / 1e6, 3), 'MB')
