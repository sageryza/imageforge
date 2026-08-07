#!/usr/bin/env python3
"""Rebuild scripts/gen-chats.py's template FROM the live public/chats.html.

Why this exists: gen-chats.py holds the whole Chats page as a string, and the
page gets edited directly all the time (several chats work this repo at once).
Every time that happened the template silently went stale, so the next person
who ran the generator REVERTED shipped work — it had already happened twice
before this script existed, and the second time it also swallowed another
chat's `body.ontop` overlay fix. Hand-resyncing is fiddly (the font is a 1MB
base64 blob and three shared-pill blocks have to become placeholders again),
which is exactly why it kept being skipped.

So: edit the page, then run this, then commit both. It substitutes the pieces
gen-chats.py injects at build time back into placeholders — matching each block
EXACTLY, so anything the page has beyond them (page-owned rules that happen to
sit nearby) is left alone — and then verifies the round trip by rebuilding and
diffing against the page it started from. A mismatch is a hard failure, never a
silent partial write.

    python3 scripts/resync-gen-chats.py [--check]

--check verifies without writing (exit 1 if the template is stale).

ORDER MATTERS: edit the page, THEN resync. Running gen-chats.py first
overwrites public/chats.html from the stale template and your edit is gone —
that happened while writing this script, which is the whole point of it.
"""
import base64, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from pill import PILL_CSS, PILL_HTML, PILL_JS   # noqa: E402

GEN = os.path.join(HERE, 'gen-chats.py')
PAGE = os.path.join(ROOT, 'public', 'chats.html')
FONT_TTF = os.path.join(ROOT, 'ios', 'ImageForge', 'EBGaramond.ttf')


def build_template_body(page):
    """The page with every build-time injection turned back into its placeholder."""
    font = base64.b64encode(open(FONT_TTF, 'rb').read()).decode()
    subs = [(font, '__FONT__'), (PILL_CSS, '__PILL_CSS__'),
            (PILL_HTML, '__PILL_HTML__'), (PILL_JS, '__PILL_JS__')]
    for needle, placeholder in subs:
        n = page.count(needle)
        if n != 1:
            raise SystemExit(
                f'resync: expected exactly one {placeholder} block in the page, found {n}.\n'
                '  The page was probably built from an older scripts/pill.py — rebuild it\n'
                '  with `python3 scripts/gen-chats.py` first, or fix the drift by hand.')
        page = page.replace(needle, placeholder)
    if '"""' in page:
        raise SystemExit('resync: the page contains a triple quote, which would break the r""" template.')
    return page


def main():
    check = '--check' in sys.argv
    page = open(PAGE, encoding='utf-8').read()
    old = open(GEN, encoding='utf-8').read()
    body = build_template_body(page)
    head = old.split('page = r"""', 1)[0]
    tail = old.rsplit('"""', 1)[1]
    new = head + 'page = r"""' + body + '"""' + tail

    if new == old:
        print('gen-chats.py already matches public/chats.html — nothing to do.')
        return 0
    if check:
        print('gen-chats.py is STALE — run `python3 scripts/resync-gen-chats.py`.', file=sys.stderr)
        return 1

    # Verify before committing to it: run the new generator with its output
    # redirected to a temp file, and require the page it produces to be
    # byte-identical to the one we read. The probe lives IN scripts/ so its own
    # `from pill import …` and its ROOT (../) still resolve the way the real
    # generator's do.
    with tempfile.TemporaryDirectory() as td:
        probe = os.path.join(HERE, '.gen-chats-probe.py')
        outfile = os.path.join(td, 'chats.html')
        open(probe, 'w', encoding='utf-8').write(new.replace(
            "os.path.join(ROOT, 'public', 'chats.html')", repr(outfile)))
        try:
            subprocess.run([sys.executable, probe], check=True, stdout=subprocess.DEVNULL)
            built = open(outfile, encoding='utf-8').read()
        finally:
            os.remove(probe)
    if built != page:
        raise SystemExit('resync: round trip FAILED — the rebuilt page differs from public/chats.html. '
                         'Not writing; resolve the difference by hand.')

    open(GEN, 'w', encoding='utf-8').write(new)
    print('resynced scripts/gen-chats.py from public/chats.html (round trip verified).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
