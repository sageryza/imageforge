#!/usr/bin/env python3
"""Build the cut doc's two lanes from the belt's running order + the job log.

2026-09-11, Sophie: "once the whole movie s finished, stitch it together" ·
"maybe well us the og scenes, i kind of like them" — so the two she drew before
the belt existed lead the film, as cards 1 and 2.

The KEY of every piece is its BELT KEY. Keys are permanent (an anchor names one,
and the diff names them), and the belt's keys are already the film's identities,
so a scene keeps the same name in the script, on the belt and in the cut.

    python3 scripts/sean-jonathan/build-cut.py > cut.json
"""
import json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import belt

# belt key → the job that drew it. Where a card has two takes, the one named
# here is the take in the film; the other stays on the dailies for her to pick.
TAKE = [
    ('sj-a', '86532d0c923d401a8b29060dd673670a'),
    ('sj-b', 'b1341353f59c439b98a9ea8f727abc83'),
    ('sj-c', 'f326c81f859b4bf4b3b295462a1efd71'),
    ('sj-d', '000c61c2f3e54e03a51bea256df5b3af'),
    ('sj-1', '18904a5141bd4642a9d4c65c7aea72c6'),
    ('sj-2', '594ec76e2b9148088730d7b9a6fd2479'),
    ('sj-3', '6839d29e2ab345a5a3ea653cc7f855f5'),
    ('sj-4', 'bad0417adf9f483c8e4c9a423b176bbd'),
    ('sj-5', 'df785dd454284ef88327ee1e8bdeeb26'),
    # THE SILENT TAKE IS IN THE FILM, and that is a real choice rather than a
    # fallback: its prompt is her exact words, titles and all, and the gate only
    # ever blocked the SINGING. The song is laid in at the edit, which it had to
    # be anyway. The sounded take with the titles swapped is on the dailies.
    ('sj-6', '0a68e157e54c4789a36ce657bda68771'),
    ('sj-e', '4abab7f1fdd345fe9fdd79f406890332'),
]


def main():
    jobs = {j['id']: j for j in json.loads(urllib.request.urlopen(
        belt.BASE + '/api/footage/jobs?limit=60', timeout=180).read()).get('jobs', [])}
    cards = {c['key']: c for c in belt.plan()}
    clips, missing = [], []
    for key, jid in TAKE:
        j = jobs.get(jid) or {}
        if not j.get('video'):
            missing.append('%s (%s)' % (key, j.get('status') or 'no job'))
            continue
        c = cards[key]
        clips.append(dict(
            key=key, url=j['video'], title='%d · %s' % (c['n'], c['name']),
            poster=j.get('poster') or '', **{'in': 0}))
    if missing:
        sys.stderr.write('NOT IN THE CUT: ' + ', '.join(missing) + '\n')
    # `seconds` and `out` are left off ON PURPOSE — `set` probes every unknown
    # source and fills them, so the cut arrives knowing its lengths rather than
    # learning them on her phone and saving that as HER edit.
    json.dump({'clips': clips, 'sounds': []}, sys.stdout, indent=1)
    sys.stderr.write('%d pieces\n' % len(clips))


if __name__ == '__main__':
    main()
