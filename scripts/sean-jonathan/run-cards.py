#!/usr/bin/env python3
"""Send belt cards to Atlas, in dependency order.

2026-09-11, Sophie: *"can u run them all yourself, looking at the first kitchen
and dining room it draws and feeding it into the next one where it's relevant."*

Every job is built from the BELT — the same prompt, the same references, the
same seconds the card shows her — so what gets sent is what she has been reading,
and nothing is composed here. The waves are the continuity chain: a card whose
still comes out of another card cannot go until that card has drawn and the
frame has been LOOKED AT and grabbed.

    python3 scripts/sean-jonathan/run-cards.py --cards sj-c,sj-d          # dry
    python3 scripts/sean-jonathan/run-cards.py --cards sj-c,sj-d --go
    python3 scripts/sean-jonathan/run-cards.py --watch sj-c,sj-d

DRY BY DEFAULT, and it prints the exact prompt, every reference by slot, the
shape and the price — the read-back her "go" rule asks for.
"""
import json, sys, time, urllib.request, urllib.error
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import belt

BASE = belt.BASE
SESSION = 'sean-jonathan-script'


def api(path, body=None):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'content-type': 'application/json'})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=180).read())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()[:500]
        try:
            return json.loads(raw)
        except Exception:
            return {'error': 'HTTP %d %s' % (e.code, raw)}


def bodyFor(c, sound=True):
    """Exactly what the card's own Send to Footage button would hand over."""
    head = (c['head'].strip() + '\n\n') if c['head'].strip() else ''
    return dict(
        prompt=head + c['words'],
        model=belt.MODEL, seconds=c['secs'], resolution=belt.RES, ratio=belt.RATIO,
        sound=sound, door='atlascloud', returnLastFrame=True, session=SESSION,
        refs=[{k: r[k] for k in ('url', 'kind', 'poster', 'name') if k in r}
              for r in c['refs']])


def main():
    argv = sys.argv
    def arg(n):
        return argv[argv.index('--' + n) + 1] if '--' + n in argv else None

    if arg('watch'):
        want = arg('watch').split(',')
        while True:
            jobs = api('/api/footage/jobs?limit=60').get('jobs', [])
            by = {}
            for j in jobs:
                for k in want:
                    if (j.get('session') == SESSION or True) and j.get('__k') == k:
                        by[k] = j
            print(json.dumps({j['id'][:8]: [j['status'], (j.get('title') or '')[:40]]
                              for j in jobs[:len(want) + 2]}, indent=0))
            if all(j.get('status') in ('done', 'failed') for j in jobs[:len(want)]):
                return
            time.sleep(20)

    cards = {c['key']: c for c in belt.plan()}
    keys = (arg('cards') or '').split(',')
    keys = [k.strip() for k in keys if k.strip()]
    if not keys:
        raise SystemExit('--cards sj-c,sj-d')

    total = 0
    for k in keys:
        c = cards[k]
        b = bodyFor(c, '--silent' not in argv)
        est = api('/api/footage/estimate?model=%s&seconds=%d&resolution=%s&ratio=%s&hasVideo=1&door=atlascloud'
                  % (b['model'], b['seconds'], b['resolution'], b['ratio']))
        cents = est.get('cents')
        total += cents or 0
        print('=' * 72)
        print('%s  %d · %s   %s · %ds · %s · %s · sound on · Atlas   ~%s¢'
              % (k, c['n'], c['name'], b['model'], b['seconds'], b['resolution'],
                 b['ratio'], cents))
        for r in c['refs']:
            print('   %-9s %-18s %s' % (r['_slot'], r['_who'], r.get('name', '')))
        print('---')
        print(b['prompt'])
    print('=' * 72)
    print('%d cards  ~%.2f dollars' % (len(keys), total / 100.0))

    if '--go' not in argv:
        print('\nDRY — add --go to send.')
        return

    sound = '--silent' not in argv
    for k in keys:
        c = cards[k]
        out = api('/api/footage/jobs', bodyFor(c, sound))
        print('%-6s → %s' % (k, json.dumps(out)[:220]))
        time.sleep(1)


if __name__ == '__main__':
    main()
