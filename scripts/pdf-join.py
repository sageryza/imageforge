#!/usr/bin/env python3
"""pdf-join.py — several PDFs into ONE, in order, and optionally into the Dump
(2026-09-05, Sophie: "make 1 pdf w everything"). Pages are copied as they
are — nothing re-rendered, nothing rescaled — so a letter sheet stays exactly
the sheet it was.

  python3 scripts/pdf-join.py --out <file.pdf> [--go] [--bundle "…"] a.pdf b.pdf …
"""
import json, os, sys, urllib.request
from urllib.parse import urlencode

BASE = os.environ.get('FORGE_BASE', 'https://imageforge-q125.onrender.com')

def arg(name, dflt=None):
    a = sys.argv
    return a[a.index('--' + name) + 1] if '--' + name in a and a.index('--' + name) + 1 < len(a) else dflt

def main():
    import pymupdf
    out = arg('out')
    bundle = arg('bundle', 'Storyboard print')
    skip = set()
    for n in ('out', 'bundle'):
        if '--' + n in sys.argv:
            i = sys.argv.index('--' + n); skip.update({i, i + 1})
    files = [a for i, a in enumerate(sys.argv[1:], 1) if i not in skip and not a.startswith('--')]
    doc = pymupdf.open()
    for f in files:
        src = pymupdf.open(f)
        doc.insert_pdf(src)
        print(f'{os.path.basename(f)}: {src.page_count} pages')
    doc.save(out, garbage=3, deflate=True)
    print(f'{out}: {doc.page_count} pages, {os.path.getsize(out) / 1e6:.1f}MB')
    if '--go' in sys.argv:
        q = urlencode({'bundle': bundle, 'filename': os.path.basename(out)})
        req = urllib.request.Request(BASE + '/api/drop/upload-file?' + q, data=open(out, 'rb').read(),
                                     headers={'Content-Type': 'application/pdf'}, method='POST')
        with urllib.request.urlopen(req, timeout=300) as r:
            body = json.load(r)
        if not body.get('ok'):
            raise SystemExit('upload failed: ' + json.dumps(body))
        print('uploaded', BASE + '/api/drop/file/' + body['item']['id'])

if __name__ == '__main__':
    main()
