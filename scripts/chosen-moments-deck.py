#!/usr/bin/env python3
"""The date moments Sophie HEARTED, one swipe card each, cut to the action in it.

Her ticks live on the verdict sheets of the three Moments compare pages, and the
moments themselves live in those pages' frozen `__pageData` — so the chosen set
is READ live, never retyped:

  GET /api/chatfeed/verdict?chat=<chat>&sheet=page-<pageId>   -> items {id: true}
  GET /api/chatfeed/page/<pageId>?embed=1                     -> __pageData.items

The SHORT LINE is the one thing written by hand (Sophie, 2026-09-15: "shorten
each to main action, ex 'salamanders fucking in a cup'") — the action in the
moment and nothing else. Everything longer rides behind the deck's one "?": her
own note where she left one, then the moment as it was written. A card she
hearted that has no short line here is REFUSED loudly rather than shipped with a
sentence on it — a long line is the thing this deck exists to end.

  python3 scripts/chosen-moments-deck.py              # print the POST body
  python3 scripts/chosen-moments-deck.py --post       # post it into the chat

SOURCE PAGES
  bBk6eDYXB34zP0w2F7oq  Moments - first five dates (v2)     portland-dates-moments
  ZBHieLM5kV2kRareeskB  Moments - Matt, Kyle, Jake (v2)     portland-dates-moments
  pBOKEIZJ4SuNwI1swJTf  Moments - blake, louis, robin (v2)  sophie-portland-dates-blake
"""
import json
import re
import sys
import urllib.request

LIVE = 'https://imageforge-q125.onrender.com'
CHAT = 'date-moments-tinder-compare'
TITLE = 'Chosen moments — the action in each (v1)'

PAGES = {
    'bBk6eDYXB34zP0w2F7oq': 'portland-dates-moments',
    'ZBHieLM5kV2kRareeskB': 'portland-dates-moments',
    'pBOKEIZJ4SuNwI1swJTf': 'sophie-portland-dates-blake',
}

# The deck's ORDER is hers — the dates in book order, as the source pages deal
# them — so this list is the running order as well as the copy.
SHORT = [
    ('d-graters', 'two cheese graters for one block of cheddar'),
    ('p-entry', 'sitting down next to her like a stranger'),
    ('p-drink', 'swapping her drink for one without alcohol'),
    ('p-paper', 'paying for the drinks she had before he got there'),
    ('p-bike', 'falling off the back of his bike'),
    ('p-couch', 'the roommate put on the couch for the night'),
    ('p-cakes', 'pancakes next to a little speaker'),
    ('s-beaverton', 'a man waiting in his parked car in Beaverton'),
    ('m-bath', 'taking his call on the edge of the bathtub'),
    ('k-chin', 'a chin coming to a point like a witch'),
    ('k-stick', 'a drumstick in his belly button'),
    ('ja-chess', 'one white pawn against ten black pieces'),
    ('ja-thomas', "carrying her Thomas the Tank Engine backpack like a clutch"),
    ('ja-hatch', 'her head through a hole in the loft floor'),
    ('ja-table', 'alone at a four-person table'),
    ('b-tree', 'sitting on a fallen tree for two hours'),
]

HELP = ('The moments you chose, one per card, cut down to the action in it. '
        '♥ keeps the line as the drawing, ✕ means the action is wrong — and the '
        'box between them is where you rewrite it. The "?" holds your note and '
        'the longer version of the moment.')


def get(url):
    return urllib.request.urlopen(url, timeout=60).read().decode('utf-8')


def read_pages():
    """Every moment card, every heart of hers, and every note — read live."""
    cards, chosen, notes = {}, [], {}
    for pid, chat in PAGES.items():
        html = get(f'{LIVE}/api/chatfeed/page/{pid}?embed=1')
        m = re.search(r'var __pageData = (\{.*?\});\s*window\.__pageViews', html, re.S)
        for it in (json.loads(m.group(1))['items'] if m else []):
            cards[it['id']] = it
        v = json.loads(get(f'{LIVE}/api/chatfeed/verdict?chat={chat}&sheet=page-{pid}'))
        chosen += [i for i, ok in (v.get('items') or {}).items() if ok is True]
        for iid, t in (v.get('texts') or {}).items():
            # her note rides the sheet with its "— me:" marker on the front
            notes[iid] = re.sub(r'^\s*[-—]\s*me:\s*', '', str(t)).strip()
    return cards, chosen, notes


def build():
    cards, chosen, notes = read_pages()
    short = dict(SHORT)
    missing = [i for i in chosen if i not in short]
    if missing:
        raise SystemExit('hearted with no short line (write one, do not ship the '
                         'long one): ' + ', '.join(sorted(missing)))
    items = []
    for iid, line in SHORT:
        if iid not in chosen:
            continue          # she took the heart off; the card goes with it
        src = cards.get(iid, {})
        said = []
        if notes.get(iid):
            said.append({'when': 'your note', 'text': notes[iid]})
        if src.get('text'):
            said.append({'when': 'the moment', 'text': src['text']})
        items.append({
            'id': iid,
            'who': src.get('who', ''),
            'text': line,
            'caption': src.get('caption', ''),
            'label': src.get('label', ''),
            'said': said,
        })
    return {
        'chat': CHAT, 'title': TITLE, 'template': 'deck',
        # stamp off: this is a deck of things she ALREADY chose, so a GOOD
        # stamp on every card would say nothing (the collection rule)
        'data': {'items': items, 'browse': True, 'stamp': False, 'help': HELP},
    }


def main():
    body = build()
    if '--post' not in sys.argv:
        print(json.dumps(body, ensure_ascii=False))
        return
    req = urllib.request.Request(
        f'{LIVE}/api/chatfeed/page',
        data=json.dumps(body).encode('utf-8'),
        headers={'Content-Type': 'application/json'})
    print(urllib.request.urlopen(req, timeout=120).read().decode('utf-8'))


if __name__ == '__main__':
    main()
