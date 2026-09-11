#!/usr/bin/env python3
"""Sean & Jonathan — the draft belt.

2026-09-11, Sophie, handing over the script: *"take the beginning of my original
sean jonathan scene that has the videos that says who's who · make a belt · with
a footage button per scene"* — and, first word of the message, *"through
atlas"*. Then, an hour later, two more scenes and *"slot these in best order."*

The twin of `scripts/ticky-tack/belt.py` (the newest belt builder, and the one
that already carries the Send-to-Footage button). What is different here, and
each of them is something she said:

1.  **THE BELT IS THE FILM IN ORDER, SHOT SCENES INCLUDED.** Two scenes are
    already drawn (the night of 2026-09-10, on `/footage`) and they are the
    first two cards, carrying the clip she can play and the prompt the door
    really received, read back off the job log into `docs/sean-jonathan/
    shot.json`. Without them "best order" is invisible: the new kitchen scene
    would sit at the top of a belt with nothing in front of it.

2.  **HER WORDS DECIDE THE ORDER, NOT ME.** They chain end to end — the drawn
    scene 2 ends *"we have to sleep in the same bed"*, the bed scene opens
    *"no it doesn't"* and ends *"rubs into the kitchen"*, the kitchen scene
    opens *"now they are in the kitchen together"*, and the tea party opens
    *"sean takes fancy tea cups … out of the kitchen cabinet"*. `RUNNING` below
    is that chain written down; the reason for each link is in `script.md`.

3.  **A KEY IS IDENTITY, A NUMBER IS A POSITION.** Her typed edits live on the
    verdict sheet under the card's key, so a card keeps its key forever and the
    number on its heading is just where it currently sits. That is why the tea
    party is still `sj-1` while it is the FIFTH card. Renumbering the keys would
    re-point every note and every edit at a different scene — the mistake the
    Compare pages' "an item's id is its identity" rule exists to stop.

4.  **THE SCENES ARE HER `cut`s.** `script.md` holds her dictation verbatim and
    this file splits it on a line reading only `cut`. The one split she did not
    mark herself is the seam in her second message, and *"slot these in best
    order"* is what authorizes it — she is saying they are separable pieces. It
    is written down in `script.md` where she can see it.

5.  **THE WHO'S-WHO BLOCK IS HERS, LIFTED OFF HER OWN JOB.** `refs.json` carries
    the opening of footage job `86532d0c…` with the two reference videos in HER
    slot order ([Video1] jonathan, [Video2] sean). A card that is a literal
    CONTINUATION of a clip that already exists chains off that clip instead —
    which is what she did herself for the drawn scene 2.

6.  **ATLAS, 3:4, 15 SECONDS** — the shape both of her own clips were, not the
    ward film's landscape 16:9, which is a different film.

Nothing on the page is sent. The button writes the hand-off (`footage_handoff`)
and walks her to `/footage`, where the star is still her tap.

The saver is the 2026-09-08 read-back one: over the limit the box REFUSES and
says by how much, nothing is cut on the way out, and every save is read back off
the sheet. `node scripts/test-belt-save-guard.js` sweeps this file.

    python3 scripts/sean-jonathan/belt.py
    python3 scripts/sean-jonathan/belt.py --post [--supersede <id>]
"""
import html, json, os, re, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(os.path.dirname(HERE), '..', 'docs', 'sean-jonathan')
SCRIPT_MD = os.path.join(DOCS, 'script.md')
REFS_JSON = os.path.join(DOCS, 'refs.json')
SHOT_JSON = os.path.join(DOCS, 'shot.json')
TYPOS_JSON = os.path.join(DOCS, 'typos.json')
CONT_JSON = os.path.join(DOCS, 'continuity.json')
BASE = 'https://imageforge-q125.onrender.com'
CHAT = 'sean-jonathan-script'
SHEET = 'belt-seanjonathan'
# A NEW VERSION IS A NEW PAGE and the title says which — the house rule for
# anything posted, because a posted page is frozen and her Compare tab shows
# them side by side. Bump this and supersede the one it replaces.
VERSION = 10
TITLE = 'Sean & Jonathan — the draft belt v%d' % VERSION
LIMIT = 8000

# Mini · 480p · 3:4 · sound on, through Atlas — her own two clips' shape.
MODEL, RES, RATIO, SECS = 'mini', '480p', '3:4', 15
ATLAS_PER_SEC = 1.1  # ¢/s, Atlas Mini 480p while the sale holds — read live on /footage

# Where a shot scene's own header stops and its action starts. DECLARED rather
# than guessed: her two prompts are on file word for word, and a clever rule
# that missed would silently move her words between two boxes.
SHOT_SPLIT = {
    '86532d0c923d401a8b29060dd673670a': 'jonathan and sean stand on the carpet',
    'b1341353f59c439b98a9ea8f727abc83': 'jonathan: "hey! that\'s my couch!"',
}

# TITLES THAT ARE SOMEONE ELSE'S, AND WHAT IS MEASURED ABOUT THEM. Seedance 2.0
# took a Disney cease-and-desist on 2026-02-13 (with Paramount Skydance, Netflix,
# Warner Bros. Discovery, Sony and Universal behind it) and ByteDance said on
# 02-15 it would stop generating IP-protected characters. There is a measured
# OUTPUT gate: a clip draws for a full minute and then fails with "the output
# video may be related to copyright restrictions" (error 1012004). It is
# PROBABILISTIC and per MODEL — it refused a plain reference-free dialogue prompt
# twice on 2.0 Fast and drew the same prompt on Mini, which is what this belt
# uses. A blocked job is UNBILLED, so finding out costs nothing but the wait.
# Naming a title in the prompt is the thing most likely to trip it; the scene
# almost always works without the name.
IP_TITLES = {
    'the lion king': 'Disney — the studio that sent the cease-and-desist',
    'a whole new world': 'Disney (Aladdin)',
    'willy wonka': 'Warner Bros.',
}

# THE LIVING ROOM IS CARRIED IN WORDS, NOT BY A STILL (2026-09-11, Sophie: "ok
# the loving room is in the video so leave the stills out ... the living room is
# described in words, keep the words for all the living room scenes"). Her
# reference videos are shot in it — the new one, IMG_4816, is jonathan sitting on
# that green rug in front of that couch — so a still of it would be the same fact
# twice. ONE constant, appended to every scene set in it, so the description
# cannot drift from card to card. The words are what the two drawn clips really
# show, read off them rather than invented.
LIVING_ROOM = ('the living room — the brown leather couch, the green plaid rug, '
               'cream walls, a framed print, a tall plant in the corner')

# THE RUNNING ORDER. `key` is identity and never moves; the number on the card
# is its position in this list. `src` says where the words come from:
#   shot:<job id>   her prompt as the door received it, plus the clip
#   one:<n>         the nth scene of her first message (split at her `cut`s)
#   two:<n>         the nth scene of her second message
# `room` is MINE — one line, the room and nothing else. `chain` names a card
# whose CLIP this one continues; its reference is that clip rather than the
# who's-who pair, which is how she drew the second scene herself.
RUNNING = [
    dict(key='sj-a', name='The couch', src='shot:86532d0c923d401a8b29060dd673670a'),
    dict(key='sj-b', name='My couch, my bedroom', src='shot:b1341353f59c439b98a9ea8f727abc83'),
    dict(key='sj-c', name='I just moved IN', src='two:1', chain='sj-b',
         room="setting: jonathan's apartment — the bed, then the bedroom doorway."),
    dict(key='sj-d', name='The kitchen', src='two:2',
         room="setting: jonathan's apartment — the kitchen, its cupboards, a vase of flowers, the oven."),
    dict(key='sj-6', name='A whole new world', src='one:6', living=True,
         room="setting: jonathan's apartment — then outside, a field of rose petals, then swings at a park."),
    dict(key='sj-1', name='The tea party', src='one:1',
         room="setting: jonathan's apartment — the small round dining table, the window, a rose bush below it."),
    dict(key='sj-2', name='Get out', src='one:2', living=True,
         room="setting: jonathan's apartment — the front door, then the skylight in the roof above him."),
    dict(key='sj-3', name='Weeks pass', src='one:3', living=True,
         room="setting: jonathan's apartment — a wall calendar, his easy chair, then the kitchen and its oven."),
    dict(key='sj-4', name='The white paint', src='one:4',
         room="setting: jonathan's apartment — his desk, standing, then the bathroom and the shower."),
    dict(key='sj-5', name='Bedtime', src='one:5',
         room="setting: jonathan's apartment — his bed, night, moonlight coming in at the end."),
    dict(key='sj-e', name='The rain', src='three:1', living=True,
         room="setting: jonathan's apartment — the window with rain on it, the television."),
]


def continuity():
    """What the model invents, and which later cards have to match it.

    2026-09-11, Sophie: "we need to take screenshots of any rooms it invents or
    objects that repeat." Ten scenes drawn as ten clips means the apartment is
    invented ten times over; the reference videos carry the two men and nothing
    carried the rooms. A thing is grabbed once out of the clip that establishes
    it (`scripts/sean-jonathan/grab-still.js`, free) and then rides as a
    reference IMAGE on every card in its `neededBy`.
    """
    return json.load(open(CONT_JSON, encoding='utf-8'))['things']


def fixes():
    return json.load(open(TYPOS_JSON, encoding='utf-8'))['fixes']


def correct(text, fx, tally):
    """Her typos, fixed on the way onto the page — never in her own files.

    2026-09-11, Sophie: "fix those two typos. are there anymore". `script.md`
    and `shot.json` keep her words exactly as she said them, because they are
    the record; every correction is one auditable line in `typos.json` and the
    card says how many landed on it. A `find` that matches more than once
    anywhere in the script REFUSES the build — a fix that silently matched
    twice would rewrite a scene she never looked at.
    """
    for f in fx:
        n = text.count(f['find'])
        if n:
            tally[f['find']] = tally.get(f['find'], 0) + n
            text = text.replace(f['find'], f['replace'])
    return text


def block(tag):
    """Her script, split at HER `cut` lines and nowhere else."""
    src = open(SCRIPT_MD, encoding='utf-8').read()
    body = src.split('<!-- %s BEGIN -->' % tag, 1)[1].split('<!-- %s END -->' % tag, 1)[0]
    parts = [p.strip('\n') for p in re.split(r'(?m)^[ \t]*cut[ \t.!:]*$', body)]
    return [p.strip() for p in parts if p.strip()]


def sources():
    R = json.load(open(REFS_JSON, encoding='utf-8'))
    shot = {s['id']: s for s in json.load(open(SHOT_JSON, encoding='utf-8'))['shot']}
    return R, shot, block('SCENES'), block('SCENES-2'), block('SCENES-3')


def split_shot(job):
    """Her own header and her own action, as the door received them."""
    mark = SHOT_SPLIT[job['id']]
    i = job['prompt'].find(mark)
    if i < 0:
        raise SystemExit('the split marker is not in job %s — her prompt moved, and '
                         'nothing may guess where her header stops' % job['id'])
    return job['prompt'][:i].strip(), job['prompt'][i:].strip()


def plan():
    """Every card resolved: its words, its header, its references, its clip."""
    R, shot, one, two, three = sources()
    fx, tally = fixes(), {}
    things = continuity()
    pair = R['refs']
    out = []
    for i, c in enumerate(RUNNING):
        kind, _, arg = c['src'].partition(':')
        clip = None
        if kind == 'shot':
            job = shot[arg]
            head, words = split_shot(job)
            secs = job['seconds']
            refs = [dict(r, _slot='[Video%d]' % (n + 1),
                         _who=next((p['_who'] for p in pair if p['url'] == r['url']),
                                   'the clip before'))
                    for n, r in enumerate(job['refs'])]
            clip = dict(url=job['video'], poster=job['poster'], seconds=job['seconds'],
                        at=job['sentAt'])
        else:
            words = {'one': one, 'two': two, 'three': three}[kind][int(arg) - 1]
            secs = SECS
            if c.get('chain'):
                prev = next(p for p in out if p['key'] == c['chain'])
                if not prev.get('clip'):
                    raise SystemExit('%s chains off %s, which has no clip yet'
                                     % (c['key'], c['chain']))
                refs = [dict(url=prev['clip']['url'], kind='video',
                             poster=prev['clip']['poster'], name=prev['name'],
                             _slot='[Video1]', _who='the clip before')]
                head = 'this scene continues [Video1].\n\n' + c['room']
            else:
                refs = [dict(r) for r in pair]
                room = c['room']
                if c.get('living'):
                    room = ("setting: jonathan's apartment — " + LIVING_ROOM + '. '
                            + c['room'].split('—', 1)[1].strip())
                head = R['whosWho'] + '\n\n' + room
        # THE CONTINUITY STILLS RIDE AFTER THE VIDEOS. Images and videos are
        # slotted separately by the footage page, so adding one can never move
        # [Video1]/[Video2] out from under her who's-who block. A still that has
        # not been grabbed yet simply does not ride — the card says so instead.
        # MY OWN LINES — the two things no still and no video can carry, her own
        # question answered. Read off the drawn clips, never invented, and named
        # on the card as mine so nothing of mine is ever in her prompt unsaid.
        mine_lines = [m['line'] for m in R.get('mineLines', [])
                      if m['on'] == 'all' or c['key'] in m['on']]
        # HERS come after mine and are kept apart, so the card can say which is
        # which — a note she called after watching a clip come back is not the
        # same kind of thing as one I read off a clip myself.
        her_lines = [m['line'] for m in R.get('herLines', [])
                     if m['on'] == 'all' or c['key'] in m['on']]
        if mine_lines or her_lines:
            head = head + '\n\n' + '\n\n'.join(mine_lines + her_lines)
        needs = [t for t in things if c['key'] in (t.get('neededBy') or [])]
        got = [t for t in needs if t.get('still')]
        for m, t in enumerate(got):
            refs.append(dict(url=t['still'], kind='image', poster=t['still'],
                             name=t['name'], _slot='[Image%d]' % (m + 1), _who=t['name']))
        if got:
            head = head + '\n\n' + '\n'.join(
                t['line'].replace('[SLOT]', '[Image%d]' % (m + 1))
                for m, t in enumerate(got))
        invents = [t for t in things if t.get('establishedOn') == c['key']]
        named = sorted({t for t in IP_TITLES if t in words.lower()})
        before = words
        mine = {}
        words = correct(words, fx, mine)
        for k2, v in mine.items():
            tally[k2] = tally.get(k2, 0) + v
        out.append(dict(c, n=i + 1, words=words, head=head, refs=refs, clip=clip,
                        secs=secs, shot=(kind == 'shot'), fixed=sum(mine.values()),
                        raw=before, invents=invents, named=named, mineLines=mine_lines,
                        herLines=her_lines,
                        waiting=[t for t in needs if not t.get('still')]))

    # EVERY FIX MUST HAVE LANDED, EXACTLY ONCE. A `find` that stopped matching
    # (her words moved) would fail silently and leave the typo on the page; one
    # that matched twice would rewrite a scene she never looked at.
    for f in fx:
        n = tally.get(f['find'], 0)
        if n != 1:
            raise SystemExit('the fix %r matched %d times, not once — check '
                             'docs/sean-jonathan/typos.json against her words'
                             % (f['find'][:48], n))

    # THE CAST IS THE LAST CARD, NOT A SCENE (2026-09-11, Sophie: "can u also add
    # the original two [reference videos] in case i find better videos"). The two
    # videos that say who is who, on the belt where she can play them and judge
    # them — no seconds, no price, no Footage button, because nothing about it is
    # a shot.
    out.append(dict(key='sj-cast', name='The cast', n=len(out) + 1, cast=True,
                    refs=[dict(r) for r in pair], shot=False, fixed=0, clip=None,
                    secs=0, words='', head='', raw='', invents=[], waiting=[], named=[],
                    mineLines=[], herLines=[],
                    stills=[t for t in things if t.get('still')]))
    return out


def notes(c, label, e):
    """The three quiet lines under a card's controls: what was corrected, what to
    screenshot once this scene draws, and what this scene is still waiting for.

    Named by CARD rather than by key — `sj-d` means nothing to her, "4 · The
    kitchen" does.
    """
    out = []
    if c['fixed']:
        out.append('<p class="fixnote">%d typo%s fixed — your own words otherwise, '
                   'word for word</p>' % (c['fixed'], '' if c['fixed'] == 1 else 's'))
    grab = [t for t in c['invents'] if t.get('neededBy') and not t.get('still')]
    if grab:
        out.append('<p class="grab">screenshot once it draws: %s</p>' % ' · '.join(
            '<b>%s</b> (for %s)' % (e(t['name']), e(' and '.join(label[x] for x in t['neededBy'])))
            for t in grab))
    if c.get('mineLines'):
        out.append('<p class="grab">two lines in that header are <b>mine</b>, not yours: %s '
                   'Both are read off the clips you have already drawn — nothing else carries '
                   'them.</p>' % e(' '.join('“%s”' % x for x in c['mineLines'])))
    if c.get('herLines'):
        out.append('<p class="grab">and <b>%s</b> — yours, after watching it come back.</p>'
                   % e(' '.join('“%s”' % x for x in c['herLines'])))
    if c.get('named'):
        out.append('<p class="ip">this names <b>%s</b> (%s) — a drawn clip can fail on '
                   'copyright at the far end. It is unbilled, so it is worth sending as '
                   'written; if it trips, the scene works with the title out of the words.</p>'
                   % (e(' and '.join(c['named'])),
                      e(' · '.join(IP_TITLES[t].rstrip('.') for t in c['named']))))
    if c['waiting']:
        froms = []
        for t in c['waiting']:
            if label[t['establishedOn']] not in froms:
                froms.append(label[t['establishedOn']])
        out.append('<p class="grab">waiting on a screenshot of <b>%s</b> — from %s. '
                   'It rides here the moment it is grabbed.</p>'
                   % (e(' and '.join(t['name'] for t in c['waiting'])), e(' and '.join(froms))))
    return ''.join(out)


def build():
    e = html.escape
    cards, toc, films = [], [], []
    cs = plan()
    label = {c['key']: '%d · %s' % (c['n'], c['name']) for c in cs}
    for c in cs:
        k = c['key']
        # THE CAST CARD IS NOT A SHOT — no seconds, no price, no Footage button.
        # It is the two videos that say who is who, where she can play them and
        # judge them (2026-09-11: "in case i find better videos").
        if c.get('cast'):
            for m, r in enumerate(c['refs']):
                films.append(('%s-%d' % (k, m + 1), r['url'],
                              '%s  %s' % (r['_slot'], r['_who']), r.get('name', '')))
            cards.append(
                '<section class="card" id="j-%s" data-key="%s" data-item="%s">\n'
                '<h2>%s · %s<span class="tag">reference</span></h2>\n'
                '<p class="done">The two videos that say who is who. They ride every card '
                'that is not a continuation, in this order — so [Video1] and [Video2] mean '
                'the same two people on every scene.</p>\n%s'
                '<p class="done">Found a better video of one of them? Put it in the Dump and '
                'say which — it swaps here and on all ten scenes at once, and nothing else '
                'about the belt moves.</p>%s\n</section>' % (
                    k, k, k, e(str(c['n'])), e(c['name']),
                    ''.join('<div class="film" id="film-%s-%d"></div>' % (k, m + 1)
                            for m, r in enumerate(c['refs'])),
                    ('<h3>the rooms so far</h3><p class="done">Screenshots of what the model '
                     'invented, pulled out of the clips that made them. Each one rides the '
                     'later cards that have to match it.</p><div class="stills">%s</div>'
                     % ''.join('<figure><img src="%s" alt=""><figcaption>%s</figcaption></figure>'
                               % (e(t['still']), e(t['name'])) for t in c['stills']))
                    if c.get('stills') else ''))
            toc.append('<a href="#j-%s">%s %s</a>' % (k, e(str(c['n'])), e(c['name'])))
            continue
        # what the footage page reads: url · kind · poster · name, in slot order
        refjson = json.dumps([{x: r[x] for x in ('url', 'kind', 'poster', 'name') if x in r}
                              for r in c['refs']])
        shotline = ''
        if c['shot']:
            films.append((k, c['clip']['url'], c['name'],
                          '%ds · drawn %s' % (c['clip']['seconds'], c['clip']['at'][:10])))
            shotline = ('<p class="done">the boxes hold what the door really received%s.</p>'
                        '<div class="film" id="film-%s"></div>'
                        % (', tidied' if c['fixed'] else '', k))
        cards.append(
            '<section class="card" id="j-%s" data-key="%s" data-item="%s">\n'
            '<h2>%s · %s%s</h2>\n%s'
            '<div class="attached">'
            '<div class="refs">%s</div>'
            '<div class="row"><label>seconds <input class="secs" data-key="%s" type="number" min="4" max="15" value="%d"></label>'
            '<a class="tofoot" href="/footage" data-key="%s" data-title="%s">%s ›</a></div>'
            '<p class="cost" data-key="%s"></p>%s'
            '<script type="application/json" class="refjson" data-key="%s">%s</script>'
            '</div>\n'
            '<details class="text"><summary>%s</summary>'
            '<textarea class="p" data-key="%s" data-field="mine" spellcheck="false">%s</textarea>'
            '<div class="saved" id="sv-%s-mine"></div></details>\n'
            '<details class="text" open><summary>the scene (your words)</summary>'
            '<textarea class="p" data-key="%s" spellcheck="false">%s</textarea>'
            '<div class="saved" id="sv-%s"></div></details>\n'
            '</section>' % (
                k, k, k, e(str(c['n'])), e(c['name']),
                '<span class="tag">shot</span>' if c['shot'] else '', shotline,
                ''.join('<span class="ref"><img src="%s" alt=""><b>%s</b> %s</span>'
                        % (e(r['poster']), e(r['_slot']), e(r['_who'])) for r in c['refs']),
                k, c['secs'], k, e('%s · %s' % (c['n'], c['name'])),
                'shoot it again' if c['shot'] else 'send to Footage', k,
                notes(c, label, e),
                k, refjson,
                'continues the clip before (yours)'
                if c.get('chain') else 'who’s who (yours)',
                k, e(c['head']), k, k, e(c['words']), k))
        toc.append('<a href="#j-%s">%s %s</a>' % (k, e(str(c['n'])), e(c['name'])))

    help_html = (
        '<p><b>Nothing on this page is sent.</b> The whole film in order, one card a '
        'scene. The first two are <b>already shot</b> — their clip is on the card and '
        'their boxes hold the prompt the door really received. The rest are yours to '
        'shoot; a line with only <i>cut</i> on it splits a card into pieces.</p>'
        '<p><b>The order is read off your own words, not chosen.</b> Scene 2 ends '
        '“we have to sleep in the same bed”; <i>I just moved IN</i> opens '
        '“no it doesn’t” and ends “rubs into the kitchen”; '
        '<i>the kitchen</i> opens “now they are in the kitchen together”; and '
        'the tea party opens “sean takes fancy tea cups … out of the kitchen '
        'cabinet”. The two you just sent came run together with no <i>cut</i>, so I '
        'split them at the line break you left and put the bed one first.</p>'
        '<p><i>Who’s who</i> is the beginning of your first scene, word for word, '
        'with the same two videos in the same slots — <b>[Video1]</b> jonathan, '
        '<b>[Video2]</b> sean. <i>I just moved IN</i> carries the clip before it '
        'instead, the way you drew scene 2. The only line in that box I wrote is '
        '<i>setting:</i>, and it names the room and nothing else.</p>'
        '<p><b>The rooms are screenshots now.</b> The model invents the apartment '
        'once per clip, so a still of each room is pulled out of the clip that made it '
        '(free — a frame off our own box) and rides every later card that has to match '
        'it, as <b>[Image1]</b>. The living room, the bedroom and what they are wearing '
        'are grabbed already; the kitchen, the oven and the dining table are waiting on '
        'their scenes being drawn, and each card says which it is missing. The last card '
        'shows them all.</p>'
        '<p><b>Your typos are fixed on the page and nowhere else.</b> Your own files keep '
        'every word as you said it; each fix is one line in <i>typos.json</i> and a card '
        'says how many landed on it. The last card is <b>the cast</b> — the two reference '
        'videos, playable, so you can swap one if you find better.</p>'
        '<p>Every card is Seedance 2.0 Mini · 480p · 3:4 · sound on, '
        '<b>through Atlas Cloud</b>. Seconds open at 15, which is what you set both '
        'times; Mini takes 4–15. At Atlas’s ~1.1¢ a second that is about '
        '~16.5¢ a card. <b>Send to Footage</b> fills the box on the Footage page with '
        'the header, the scene and the references — the star there is still yours.</p>'
        '<p class="toc">' + ' · '.join(toc) + '</p>')

    filmjs = ''.join(
        "window.__filmRow({url:%s,label:%s,meta:%s,mount:'#film-%s'});\n"
        % (json.dumps(u), json.dumps(l), json.dumps(m), k) for k, u, l, m in films)

    return CSS + (
        '<h1>%s</h1>\n'
        '<div class="nav"><button id="prev" type="button">‹ back</button>'
        '<span id="pos"></span><button id="next" type="button">next ›</button></div>\n'
        '<div class="deck" id="deck">%s</div>\n'
        '<script>\n%s\n%s\n%s\n</script>\n'
    ) % (e(TITLE), '\n'.join(cards), SCRIPT % (CHAT, SHEET, LIMIT, ATLAS_PER_SEC),
         filmjs, 'window.__compareHelp({html:%s});' % json.dumps(help_html))


CSS = """<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="stylesheet" href="/compare.css"><script src="/compare.js"></script>
<script src="/caretkeep.js"></script>
<style>
.deck{display:flex;align-items:flex-start;overflow-x:auto;overflow-y:visible;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none} .deck::-webkit-scrollbar{display:none}
.card h2,.card .text summary,.card .done,.card .film{margin-right:58px}
.card{flex:0 0 100%;scroll-snap-align:start;scroll-snap-stop:always;box-sizing:border-box;padding:6px 14px 60px}
h2{font-size:16px;margin:0 0 8px}
.tag{display:inline-block;margin-left:8px;font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#6b6257;border:1px solid #cfc6b6;border-radius:6px;padding:1px 6px;vertical-align:2px}
p.done{font-size:12px;color:#8a8176;margin:0 0 8px}
p.fixnote{font-size:11px;color:#8a8176;margin:6px 0 0;font-style:italic}
p.grab{font-size:11px;color:#6b6257;margin:6px 0 0}
p.grab b{font-weight:600;color:#3a352e}
p.ip{font-size:11px;color:#6b6257;margin:6px 0 0}
p.ip b{font-weight:600;color:#3a352e}
/* SCOPED TO THE CARD — compare.css styles h3 at its own serif size and wins on
   a bare tag selector, so this read as a big heading until it was photographed. */
.card h3{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#8a8176;margin:16px 58px 6px 0;font-weight:600;font-family:inherit}
.stills{display:flex;gap:10px;flex-wrap:wrap;margin-right:58px}
.stills figure{margin:0;width:98px}
/* THE BOX IS RESERVED BEFORE THE PICTURE LANDS — 3:4, the shape every clip on
   this film is. Without it the figure collapses to nothing while the image
   loads and the captions land on each other (photographed). */
.stills img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:6px;border:1px solid #e3dccd;display:block;background:#efe9dc}
.stills figcaption{font-size:11px;color:#8a8176;margin-top:4px;line-height:1.3}
.film{margin:0 0 12px}
.text summary{cursor:pointer;font-size:12px;text-decoration:underline;color:#6b6257;margin-bottom:6px}
textarea.p{width:100%;box-sizing:border-box;font-family:inherit;font-size:16px;line-height:1.5;padding:10px;border:1px solid #cfc6b6;border-radius:6px;background:#fff;resize:none;min-height:100px}
.saved{font-size:11px;color:#8a8176;min-height:14px;margin-top:3px} .saved.bad{color:#b5473c;font-weight:600}
/* THE SEND ROW IS AT THE TOP OF THE CARD, and that is measured: a 894-character
   scene in a box fitted to its own words puts a footer button ~600px down an
   844px phone, so the one control this page exists for was below the fold on
   every card. Chrome above, her words below. */
.attached{margin:0 58px 12px 0;padding-bottom:10px;border-bottom:1px solid #e3dccd}
.refs{display:flex;gap:10px;margin:0 0 10px;flex-wrap:wrap}
.ref{display:flex;align-items:center;gap:6px;font-size:12px;color:#6b6257}
.ref img{width:34px;height:44px;object-fit:cover;border-radius:4px;border:1px solid #e3dccd;background:#efe9dc}
.ref b{font-weight:600;color:#3a352e}
/* ONE LINE: the seconds she sets, and the button. PHOTOGRAPHED at 390pt — with
   the price on it too the row wrapped to THREE lines and the button ended up
   alone on the last one. The price is a fact about the tap, not a control, so
   it sits quietly under them. */
.row{display:flex;align-items:center;gap:10px;font-size:13px;margin:0}
.row input{width:56px;font-family:inherit;font-size:16px;padding:4px 6px;border:1px solid #cfc6b6;border-radius:6px;background:#fff}
p.cost{font-size:12px;color:#8a8176;margin:6px 0 0}
.tofoot{margin-left:auto;display:inline-block;font:inherit;font-size:13px;padding:7px 12px;border:1px solid #2b2622;border-radius:6px;color:#2b2622;background:#fff;text-decoration:none}
.nav{display:flex;align-items:center;justify-content:space-between;padding:6px 0 8px;margin-right:64px;font-size:13px}
.nav button{font:inherit;border:1px solid #cfc6b6;border-radius:6px;background:#fff;padding:6px 12px}
</style>
"""

SCRIPT = r"""
var CHAT='%s', SHEET='%s', LIMIT=%d, PERSEC=%s;
function post(body){ return fetch('/api/chatfeed/verdict',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); }
// A PRICE ON AN ATLAS CARD WEARS A TILDE — Atlas has no billing API and no
// charge here has ever been read back against an estimate.
function cost(k){ var s=parseInt(document.querySelector('.secs[data-key="'+k+'"]').value)||0; document.querySelector('.cost[data-key="'+k+'"]').textContent='~'+(s*PERSEC).toFixed(1)+'¢ at ~'+PERSEC+'¢/s (Atlas Mini 480p)'; }
document.querySelectorAll('.p[data-key]').forEach(function(ta){ var k=ta.getAttribute('data-key'), f=ta.getAttribute('data-field')||'p', sv=document.getElementById('sv-'+k+(f==='p'?'':'-'+f)), timer=null;
  function fit(){ta.style.height='auto'; ta.style.height=(ta.scrollHeight+2)+'px';} fit(); ta.closest('details').addEventListener('toggle',fit);
  function pieces(t){ var n=t.split(/\r?\n/).filter(function(l){return /^[ \t]*cut[ \t.!:]*$/i.test(l);}).length; return n?(' · '+(n+1)+' pieces'):''; }
  // A SAVE IS READ BACK, NEVER TRUSTED (2026-09-08, Sophie, after a 2,343-character
  // scene lost its tail to a silent slice: "a stupid error that's gonna lose my
  // edits"). Nothing is cut on the way out; over LIMIT the box refuses and says by
  // how much; after every save the sheet is re-read and the box says so if the
  // server kept less than it was sent.
  function bad(m){ sv.textContent=m; sv.classList.add('bad'); } function good(m){ sv.textContent=m; sv.classList.remove('bad'); }
  function save(t){ if(t.length>LIMIT){ bad('NOT SAVED — '+(t.length-LIMIT)+' characters over the box limit of '+LIMIT); return; }
    post({chat:CHAT,sheet:SHEET,item:k+'.'+f,text:t}).then(function(r){return r.json();}).then(function(j){ if(j.chars!=null && j.chars<t.length) throw new Error('short');
      return fetch('/api/chatfeed/verdict?chat='+encodeURIComponent(CHAT)+'&sheet='+encodeURIComponent(SHEET)).then(function(r){return r.json();}).then(function(d){ var kept=(d.texts||{})[k+'.'+f]; if(typeof kept==='string' && kept.length<t.length) throw new Error('short'); good('saved'+pieces(t)); });
    }).catch(function(e){ bad(e && e.message==='short' ? 'NOT SAVED WHOLE — the server kept less than you typed; copy your text somewhere safe' : 'not saved'); }); }
  ta.addEventListener('input',function(){ fit(); var t=ta.value; sv.textContent='…'+pieces(t); clearTimeout(timer); timer=setTimeout(function(){ save(t); },700); });
  window.addEventListener('pagehide',function(){ if(!timer) return; clearTimeout(timer); timer=null; try{ navigator.sendBeacon('/api/chatfeed/verdict', new Blob([JSON.stringify({chat:CHAT,sheet:SHEET,item:k+'.'+f,text:ta.value.slice(0,LIMIT)})],{type:'application/json'})); }catch(e){} });
});
// Her edits come back on the next open and WIN over the words baked into the
// page — the posted html is the script as she dictated it, the sheet is what she
// has typed since. A card's KEY is its identity and never moves, so a scene
// slotted in ahead of it can never re-point her edits at different words.
fetch('/api/chatfeed/verdict?chat='+encodeURIComponent(CHAT)+'&sheet='+encodeURIComponent(SHEET)).then(function(r){return r.json();}).then(function(d){ var T=d.texts||{};
  document.querySelectorAll('.p[data-key]').forEach(function(ta){ var k=ta.getAttribute('data-key'), f=ta.getAttribute('data-field')||'p', v=T[k+'.'+f];
    if(typeof v==='string' && v.length){ ta.value=v; ta.style.height='auto'; ta.style.height=(ta.scrollHeight+2)+'px'; } });
  document.querySelectorAll('.secs').forEach(function(inp){ var k=inp.getAttribute('data-key'), s=T[k+'.s']; if(s){ inp.value=s; cost(k); } });
}).catch(function(){});
// SEND TO FOOTAGE (2026-09-10, Sophie: "add a button to each scene that
// automatically puts all the right references in the same text to footage so I can
// edit it or press go myself"). A real link to the Footage tool; before it goes it
// writes the hand-off that page reads on its next open (localStorage
// `footage_handoff`, same origin). Nothing is sent by this tap; the star on the
// Footage page is still hers.
document.querySelectorAll('.tofoot').forEach(function(a){ a.addEventListener('click',function(){ var k=a.getAttribute('data-key'); try{
  var mine=(document.querySelector('.p[data-key="'+k+'"][data-field="mine"]')||{}).value||''; var words=(document.querySelector('.p[data-key="'+k+'"]:not([data-field])')||{}).value||'';
  var refs=JSON.parse(document.querySelector('.refjson[data-key="'+k+'"]').textContent||'[]'); var s=parseInt(document.querySelector('.secs[data-key="'+k+'"]').value)||4;
  localStorage.setItem('footage_handoff',JSON.stringify({prompt:(mine.trim()?mine.trim()+'\n\n':'')+words,refs:refs,model:'mini',seconds:s,res:'480p',ratio:'3:4',from:CHAT,title:a.getAttribute('data-title'),at:Date.now()}));
 }catch(e){} }); });
document.querySelectorAll('.secs').forEach(function(inp){ var k=inp.getAttribute('data-key'); cost(k); inp.addEventListener('input',function(){ cost(k); post({chat:CHAT,sheet:SHEET,item:k+'.s',text:inp.value}); }); });
var deck=document.getElementById('deck'), cards=[].slice.call(deck.children), pos=document.getElementById('pos');
function at(){ return Math.round(deck.scrollLeft/deck.clientWidth); }
function go(i){ i=Math.max(0,Math.min(cards.length-1,i)); deck.scrollTo({left:i*deck.clientWidth,behavior:'smooth'}); }
function paintPos(){ pos.textContent=(at()+1)+' / '+cards.length; try{localStorage.setItem('beltsj.at',at());}catch(e){} }
deck.addEventListener('scroll',function(){ clearTimeout(window.__pt); window.__pt=setTimeout(paintPos,80); });
document.getElementById('prev').onclick=function(){go(at()-1);}; document.getElementById('next').onclick=function(){go(at()+1);};
var h=(location.hash||'').replace('#j-',''); var start=cards.findIndex(function(c){return c.getAttribute('data-key')===h;}); if(start<0){ try{start=parseInt(localStorage.getItem('beltsj.at'))||0;}catch(e){start=0;} }
setTimeout(function(){ deck.scrollLeft=start*deck.clientWidth; paintPos(); window.scrollTo(0,0); },50);
window.__compareNotes({chat:CHAT,sheet:'belt-seanjonathan-notes'});
"""


def post(body, supersede=None):
    req = urllib.request.Request(
        BASE + '/api/chatfeed/page',
        data=json.dumps({'chat': CHAT, 'title': TITLE, 'html': body}).encode(),
        headers={'content-type': 'application/json'})
    out = json.loads(urllib.request.urlopen(req).read())
    print(json.dumps(out, indent=1))
    if supersede:
        r2 = urllib.request.Request(BASE + '/api/chatfeed/page/%s/supersede' % supersede,
                                    data=b'{}', headers={'content-type': 'application/json'})
        print(urllib.request.urlopen(r2).read().decode())
    return out


if __name__ == '__main__':
    body = build()
    out = os.path.join(HERE, 'belt.html')
    open(out, 'w').write(body)
    cs = plan()
    print('%s  %d bytes  %d cards (%d shot)  longest scene %d chars  (limit %d)'
          % (out, len(body), len(cs), sum(1 for c in cs if c['shot']),
             max(len(c['words']) for c in cs), LIMIT))
    for c in cs:
        print('  %2d %-6s %-22s %s' % (c['n'], c['key'], c['name'],
                                       ' · '.join(r['_slot'] + ' ' + r['_who'] for r in c['refs'])))
    if '--post' in sys.argv:
        i = sys.argv.index('--supersede') if '--supersede' in sys.argv else -1
        post(body, sys.argv[i + 1] if i > 0 else None)
