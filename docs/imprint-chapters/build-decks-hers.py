"""BUILD THE REAL LESSON DECKS WITH HER APPROVED COPY (Sophie, Aug 2026:
"the next step is just to build the lessons... don't rewrite the old lessons.
You could just copy them and then change the text").

Exactly that: each old deck page is copied verbatim (same template, same
tap-through, same look) and only the slides change — her approved copy from
the review page, the [[..]] review marks stripped to plain text. The old
pages are untouched (already superseded, still served). Each new deck posts
as a NEW page and is immediately superseded too — the Lessons hub is what
opens them, same as the old ones.

Two deliberate text-level changes, both from the approved review page:
- NO kickers. The old kickers were my words; the copy she approved has none.
- Images serve as WEBP (the house no-raw-PNG rule; every id verified live).

Slide bg colours are inherited from the old slide carrying the same image,
so each card keeps its sampled paper tone.
"""
import json, re, sys, urllib.request
from importlib.machinery import SourceFileLoader

# deck-godonly.html is the SERVED page — the server appended the shared
# autoscroll pill at serve time. Posting that back would double the pill, so
# the template is everything BEFORE the injection comment.
TEMPLATE = open('deck-godonly.html').read().split(
    '<!-- injected by the server')[0].rstrip() + '\n'
DECKS = json.load(open('decks.json'))

ALL = {}
for f in ('copy-batch1a.py', 'copy-batch1b.py', 'copy-batch2a.py',
          'copy-batch2b.py', 'copy-batch3.py'):
    ALL.update(SourceFileLoader(f[:-3].replace('-', '_'), f).load_module().LESSONS)
ALL['Valued Customer'] = SourceFileLoader('cc', 'coffee-copy.py').load_module().CARDS
assert set(ALL) == set(DECKS), (set(ALL) ^ set(DECKS))

def unmark(s):
    """[[mine]] -> mine (approved), **b** -> b. Verify nothing leaks."""
    s = re.sub(r'\[\[([^\]]+)\]\]', r'\1', s or '')
    s = re.sub(r'\*\*([^*]+)\*\*', r'\1', s)
    assert '[[' not in s and ']]' not in s, s
    return s

def img_id(url):
    return url.rsplit('/', 1)[-1].removesuffix('.webp') if url else ''

def build(title):
    old = DECKS[title]
    oldby = {s.get('img'): s for s in old['slides'] if s.get('img')}
    slides = []
    for c in ALL[title]:
        iid = img_id(c.get('img', ''))
        slides.append({
            'bg': (oldby.get(iid) or {}).get('bg', '#fdf9f3'),
            'img': iid,
            'kicker': '',
            'h': unmark(c.get('h', '')),
            'body': unmark(c.get('body', '')),
        })
    html = TEMPLATE
    html = re.sub(r'<title>.*?</title>',
                  '<title>' + title.replace('&', '&amp;') + '</title>', html)
    html = html.replace("witch-school/assets/", "witch-school/webp/")
    html = html.replace(".png\">", ".webp\">")
    # lambda replacement — a plain replacement string would have re.sub
    # process the JSON's own backslash escapes and corrupt the script
    payload = 'var slides=' + json.dumps(slides, ensure_ascii=False) + ';'
    html = re.sub(r'var slides\s*=\s*\[.*?\];', lambda m: payload,
                  html, flags=re.S)
    assert 'undefined' not in html and '.png' not in html
    assert html.count('witch-school/webp/') == 1 and '.webp">' in html
    return html, len(slides)

def post(title, html):
    body = json.dumps({'chat': 'deck-factory-story-room',
                       'title': title + ' — in your words',
                       'html': html}).encode()
    req = urllib.request.Request(
        'https://imageforge-q125.onrender.com/api/chatfeed/page',
        data=body, headers={'Content-Type': 'application/json'})
    r = json.loads(urllib.request.urlopen(req, timeout=60).read())
    assert r.get('ok'), r
    # straight to Superseded — the hub is what opens these, same as the old
    # decks; 21 rows must not flood the Current tab.
    req = urllib.request.Request(
        'https://imageforge-q125.onrender.com/api/chatfeed/page/%s/supersede' % r['id'],
        data=json.dumps({'superseded': True}).encode(),
        headers={'Content-Type': 'application/json'})
    assert json.loads(urllib.request.urlopen(req, timeout=30).read()).get('ok')
    return r['id']

if __name__ == '__main__':
    dry = '--post' not in sys.argv
    ids = {}
    for title in DECKS:
        html, n = build(title)
        if dry:
            print('OK  %-52s %2d slides  %6d bytes' % (title[:52], n, len(html)))
        else:
            new_id = post(title, html)
            ids[title] = {'old': DECKS[title]['id'], 'new': new_id, 'slides': n}
            print('POSTED %-48s %s -> %s' % (title[:48], DECKS[title]['id'], new_id))
    if not dry:
        json.dump(ids, open('deck-ids.json', 'w'), indent=1, ensure_ascii=False)
        print('wrote deck-ids.json')
