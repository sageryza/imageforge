"""Her messages, unioned from both transcript extractions, keyed to chapters.

Shared by build-hers.py and build-hers2.py so the two pages can never
disagree about which message is which — the id is (chapter, ordinal), so a
classification written against it stays pointed at the same words.
"""
import json, pathlib
from importlib.machinery import SourceFileLoader

HERE = pathlib.Path(__file__).parent
OLD = json.loads((HERE / 'raw-messages.json').read_text())
FRESH = json.loads((HERE / 'raw-fresh.json').read_text())
D = SourceFileLoader('d', str(HERE / 'chapters-data.py')).load_module()
LAST_END = 616

def load():
    seen, hers = set(), []
    for m in OLD + FRESH:
        if m.get('who') != 'sophie':
            continue
        k = (m.get('at'), (m.get('text') or '').strip())
        if not k[1] or k in seen:
            continue
        seen.add(k)
        hers.append(m)
    hers.sort(key=lambda m: m['at'])

    bounds = []
    for i, (start, title, _l1, _l2) in enumerate(D.CHAPTERS):
        end = D.CHAPTERS[i + 1][0] if i + 1 < len(D.CHAPTERS) else LAST_END
        sl = OLD[start:end]
        if sl:
            bounds.append({'id': 'ch%02d' % (i + 1), 'title': title,
                           'from': sl[0]['at'], 'to': sl[-1]['at']})
    bounds.sort(key=lambda b: b['from'])

    def chapter_of(at):
        if bounds and at > bounds[-1]['to']:
            return None                      # newer than the spine → "Since then"
        hit = None
        for b in bounds:
            if at >= b['from']:
                hit = b
        return hit

    groups, order = {}, []
    for m in hers:
        b = chapter_of(m['at'])
        key = b['id'] if b else 'since'
        if key not in groups:
            groups[key] = {'title': b['title'] if b else 'Since then', 'msgs': []}
            order.append(key)
        g = groups[key]
        m = dict(m)
        m['mid'] = '%s.%d' % (key, len(g['msgs']) + 1)
        g['msgs'].append(m)
    return [(k, groups[k]) for k in order], hers
