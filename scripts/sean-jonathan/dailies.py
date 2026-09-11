#!/usr/bin/env python3
"""The dailies — every clip drawn so far, in film order, playable in this chat.

2026-09-11, Sophie: "can i see them AS SOON as they're done?" then "i want to
see them now." The Footage feed has them the second they land, but it is newest
FIRST and mixed in with everything else she has ever drawn, so watching her own
film in order means hunting. This is one Compare page: a `__filmRow` per clip,
in the belt's own running order, each named by its card.

IT COSTS NOTHING — one read of the job log and one page post. It draws nothing.
Re-run it as clips land; each run is a new version that supersedes the last.

    python3 scripts/sean-jonathan/dailies.py               # dry
    python3 scripts/sean-jonathan/dailies.py --post [--supersede <id>]
"""
import html, json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import belt

BASE, CHAT = belt.BASE, belt.CHAT
STATE = os.path.join(HERE, 'dailies-state.json')

# Which job is which card. A job id is the only honest key — two takes of one
# card share a title, and a title is the prompt's first 70 characters, which on
# this film is the same who's-who block on every card.
JOBS = [
    ('sj-a', '86532d0c923d401a8b29060dd673670a', ''),
    ('sj-b', 'b1341353f59c439b98a9ea8f727abc83', ''),
    ('sj-c', 'f326c81f859b4bf4b3b295462a1efd71', ''),
    ('sj-d', '000c61c2f3e54e03a51bea256df5b3af', ''),
    ('sj-1', '18904a5141bd4642a9d4c65c7aea72c6', ''),
    ('sj-3', '6839d29e2ab345a5a3ea653cc7f855f5', ''),
    ('sj-4', 'bad0417adf9f483c8e4c9a423b176bbd', ''),
    ('sj-5', 'df785dd454284ef88327ee1e8bdeeb26', ''),
    ('sj-6', '21e5ff92c58440049f152e14319557c4', 'sound on'),
    ('sj-6', '0a68e157e54c4789a36ce657bda68771', 'silent'),
    ('sj-e', '4abab7f1fdd345fe9fdd79f406890332', ''),
]


def jobs():
    u = BASE + '/api/footage/jobs?limit=60'
    return {j['id']: j for j in json.loads(urllib.request.urlopen(u, timeout=180).read()).get('jobs', [])}


def build():
    e = html.escape
    cards = {c['key']: c for c in belt.plan()}
    live = jobs()
    rows, films, done, waiting, failed = [], [], 0, 0, 0
    for key, jid, tag in JOBS:
        c = cards.get(key)
        if not c:
            continue
        j = live.get(jid) or {}
        st = j.get('status') or 'not sent'
        name = '%d · %s' % (c['n'], c['name']) + (' (%s)' % tag if tag else '')
        mount = 'f-' + jid[:8]
        if st == 'done' and j.get('video'):
            done += 1
            films.append((mount, j['video'], name,
                          '%ds · %s' % (j.get('seconds') or 0,
                                        (j.get('drewMs') and '%dm %02ds' % divmod(round(j['drewMs'] / 1000), 60)) or '')))
            body = '<div class="film" id="%s"></div>' % mount
        elif st == 'failed':
            failed += 1
            body = '<p class="bad">%s</p>' % e(j.get('why') or j.get('error') or 'failed')
        else:
            waiting += 1
            body = '<p class="wait">%s — about three minutes each</p>' % e(st)
        rows.append('<section class="row" data-item="%s"><h2>%s</h2>%s</section>'
                    % (e(jid[:12]), e(name), body))

    title = 'Sean & Jonathan — the dailies'
    help_html = (
        '<p><b>Every clip so far, in film order.</b> Tap one to play it. This page is '
        'built from the job log, so it is exactly what came back — nothing here draws '
        'anything and nothing here is sent.</p>'
        '<p>Leave a note on any clip with the <b>+</b> in its corner and I will read it '
        'next time you write. The belt is where the words and the references live; this '
        'is just for watching.</p>')

    filmjs = ''.join(
        "window.__filmRow({url:%s,label:%s,meta:%s,mount:'#%s'});\n"
        % (json.dumps(u), json.dumps(l), json.dumps(m), k) for k, u, l, m in films)

    help_html = ('<p><b>%d drawn · %d still drawing%s.</b></p>' % (
        done, waiting, ' · %d failed' % failed if failed else '')) + help_html
    head = ''
    return CSS + ('<h1>%s</h1>\n%s\n%s\n<script>\n%s\nwindow.__compareNotes({chat:%s,sheet:"dailies-notes"});\n'
                  'window.__compareHelp({html:%s});\n</script>\n'
                  % (e(title), head, '\n'.join(rows), filmjs,
                     json.dumps(CHAT), json.dumps(help_html))), title, done, waiting


CSS = """<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="stylesheet" href="/compare.css"><script src="/compare.js"></script>
<style>
.wrap>h1{margin-right:64px}
.row{margin:0 0 18px;padding:0 0 14px;border-bottom:1px solid #e3dccd}
.row:last-child{border-bottom:0}
.row h2{font-size:15px;margin:0 0 8px;margin-right:64px}
.film{margin:0}
p.wait{font-size:12px;color:#8a8176;margin:0;font-style:italic}
p.bad{font-size:12px;color:#b5473c;margin:0}
</style>
"""


def post(body, title, supersede=None):
    req = urllib.request.Request(
        BASE + '/api/chatfeed/page',
        data=json.dumps({'chat': CHAT, 'title': title, 'html': body}).encode(),
        headers={'content-type': 'application/json'})
    out = json.loads(urllib.request.urlopen(req, timeout=180).read())
    print(json.dumps(out, indent=1))
    if supersede:
        r2 = urllib.request.Request(BASE + '/api/chatfeed/page/%s/supersede' % supersede,
                                    data=b'{}', headers={'content-type': 'application/json'})
        print(urllib.request.urlopen(r2, timeout=120).read().decode())
    return out


if __name__ == '__main__':
    body, title, done, waiting = build()
    open(os.path.join(HERE, 'dailies.html'), 'w').write(body)
    print('%d bytes · %d drawn · %d drawing' % (len(body), done, waiting))
    if '--post' in sys.argv:
        prev = None
        if os.path.exists(STATE):
            prev = json.load(open(STATE)).get('id')
        i = sys.argv.index('--supersede') if '--supersede' in sys.argv else -1
        out = post(body, title, sys.argv[i + 1] if i > 0 else prev)
        json.dump({'id': out.get('id')}, open(STATE, 'w'))
