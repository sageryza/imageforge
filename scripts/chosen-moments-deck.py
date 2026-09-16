#!/usr/bin/env python3
"""EVERY date moment across the three Moments pages, one swipe card each.

The face of a card is the date's name and ONE SHORT LINE — Sophie, 2026-09-15:
"shorten each to main action, ex 'salamanders fucking in a cup'", then "not the
action / just simpler / less description" and "all / not hearts". So the line
is the plainest possible naming of the thing, not a sentence about it, and the
deck holds all of them rather than only the ones she hearted.

Everything longer rides behind the deck's one "?": her own note where she left
one, the caption, then the moment as it was written. The moments themselves are
READ live out of the source pages' frozen `__pageData`, and her notes off their
verdict sheets, so nothing here is retyped:

  GET /api/chatfeed/page/<pageId>?embed=1                     -> __pageData.items
  GET /api/chatfeed/verdict?chat=<chat>&sheet=page-<pageId>   -> texts {id: note}

A moment with no short line here is REFUSED loudly rather than shipped carrying
its long sentence — a long line is the thing this deck exists to end.

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
TITLE = 'Every date moment, said simply (v1)'

PAGES = {
    'bBk6eDYXB34zP0w2F7oq': 'portland-dates-moments',
    'ZBHieLM5kV2kRareeskB': 'portland-dates-moments',
    'pBOKEIZJ4SuNwI1swJTf': 'sophie-portland-dates-blake',
}

# The deck's ORDER is the dates in book order, as the source pages deal them —
# so this list is the running order as well as the copy.
SHORT = [
    # David
    ('d-graters', 'two cheese graters'),
    ('d-cats', 'a car full of cats'),
    ('d-carseat', 'a car seat in the living room'),
    ('d-cm', 'his height in centimeters'),
    ('d-chai', 'he drank her chai'),
    ('d-goodbye', 'a goodbye in the kitchen'),
    ('d-phones', 'two phones, cats and dreams'),
    # Griffin
    ('g-sala', 'salamanders fucking in a cup'),
    ('g-chalk', 'a chalkboard of polite ways to say no'),
    ('g-sloth', 'a sloth, not moving'),
    ('g-chain', 'six cuddlers crossing the street'),
    ('g-vote', 'everyone on their chairs but her'),
    ('g-lego', 'a lego collection and eggs'),
    # Jon
    ('j-check', 'she paid'),
    ('j-books', 'library returns'),
    ('j-armor', 'armor made for a very small warrior'),
    ('j-crowns', 'clay people at a table in crowns'),
    ('j-rain', 'his rain gear and hers'),
    ('j-alpha', 'one date standing up as the other sits down'),
    # Pratfaller
    ('p-entry', 'a stranger taking the next stool'),
    ('p-drink', 'a drink with no alcohol in it'),
    ('p-paper', 'one receipt for everything'),
    ('p-bike', 'falling off the back of his bike'),
    ('p-couch', 'the roommate on the couch'),
    ('p-cakes', 'pancakes and a little speaker'),
    # Sean
    ('s-outlet', 'an outlet at the bottom of a telephone pole'),
    ('s-menu', 'asking for a dinner menu'),
    ('s-beaverton', 'a man waiting in a parked car'),
    ('s-corner', 'a bare corner, cars going past'),
    ('s-wheel', 'a driver not smiling'),
    ('s-dance', 'everyone dancing'),
    # Matt
    ('m-chickens', 'nothing but chickens'),
    ('m-guitar', 'one blurry photo of a red guitar'),
    ('m-perch', 'found at the telephone pole'),
    ('m-sweaty', 'a girl sweating in her car'),
    ('m-bath', 'a call taken on the bathtub'),
    ('m-tab', 'a debit card left at the bar'),
    # Kyle
    ('k-curtsy', 'a curtsy in her evening gown'),
    ('k-chin', 'a chin that comes to a point'),
    ('k-solo', 'a drum solo in a tiny room'),
    ('k-subs', 'a footlong and a six inch'),
    ('k-chai', "a chai she didn't want"),
    ('k-stick', 'a drumstick in his belly button'),
    # Jake
    ('ja-window', 'watching him smoke through the glass'),
    ('ja-chess', 'one pawn against ten pieces'),
    ('ja-thomas', 'a toy-train backpack held like a clutch'),
    ('ja-koala', 'a koala hanging off him'),
    ('ja-hatch', 'a head through a hole in the floor'),
    ('ja-table', 'one person at a four-person table'),
    # Blake
    ('b-directions', 'directions past three fallen trees'),
    ('b-wrongbus', 'the wrong side of the city'),
    ('b-tree', 'a man sitting on a fallen tree'),
    ('b-deer', 'drinking from the water fountain'),
    ('b-storygame', 'stories on little pads of paper'),
    ('b-bus', 'silence on the bus, his arm around her'),
    # Louis
    ('l-ball', 'a man on a yoga ball'),
    ('l-job', 'a job application, mid-date'),
    ('l-hats', 'trying on hats'),
    ('l-hip', 'a hand on his hip'),
    ('l-jungle', 'vines on the ceiling, ayahuasca next'),
    ('l-breathing', 'asleep on the far side of the bed'),
    # Robin
    ('r-cider', 'a six pack at 4am'),
    ('r-farm', 'plastic horses knocked down with a bowling pin'),
    ('r-boner', 'the morning report'),
    ('r-hockey', 'the co-captain he never got over'),
    ('r-cardate', 'a date in a car with Sarah'),
    ('r-eggs', 'broken eggs, burnt black'),
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
    missing = [i for i in cards if i not in short]
    if missing:
        raise SystemExit('a moment with no short line (write one, do not ship the '
                         'long one): ' + ', '.join(sorted(missing)))
    items = []
    for iid, line in SHORT:
        src = cards.get(iid)
        if not src:
            continue          # the source page dropped it
        said = []
        if notes.get(iid):
            said.append({'when': 'your note', 'text': notes[iid]})
        if src.get('caption'):
            said.append({'when': 'the caption', 'text': src['caption']})
        if src.get('text'):
            said.append({'when': 'the moment', 'text': src['text']})
        items.append({
            'id': iid,
            'who': src.get('who', ''),
            # the face is the name and the line, nothing else (her "less
            # description" — the caption is a second sentence on the card)
            'text': line,
            'label': src.get('label', ''),
            'said': said,
        })
    return {
        'chat': CHAT, 'title': TITLE, 'template': 'deck',
        # stamp off: a deck of the whole pile is a collection, not a verdict
        # she has already given
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
