#!/usr/bin/env python3
"""pdf-pages.py — a webp of every page of a PDF, so a print sheet can be SEEN
on a Compare page instead of only linked (2026-09-05, Sophie: "let me view
the simil sheets not just links"). Optionally uploads each page to the Dump.

  python3 scripts/pdf-pages.py <file.pdf> [--out dir] [--width 1100] [--go] [--bundle "Print previews"]

Prints one line per page: the local file, and the Dump url after --go. Needs
pymupdf (pip install pymupdf) — rendered on our own box, no model call.
"""
import io, json, os, sys, urllib.request

BASE = os.environ.get('FORGE_BASE', 'https://imageforge-q125.onrender.com')

def arg(name, dflt=None):
    a = sys.argv
    return a[a.index('--' + name) + 1] if '--' + name in a and a.index('--' + name) + 1 < len(a) else dflt

def upload(path, bundle):
    from urllib.parse import urlencode
    q = urlencode({'bundle': bundle, 'filename': os.path.basename(path)})
    req = urllib.request.Request(BASE + '/api/drop/upload-file?' + q, data=open(path, 'rb').read(),
                                 headers={'Content-Type': 'image/webp'}, method='POST')
    with urllib.request.urlopen(req, timeout=120) as r:
        body = json.load(r)
    if not body.get('ok'):
        raise SystemExit('upload failed: ' + json.dumps(body))
    return body['item']['url']

def main():
    import pymupdf
    from PIL import Image
    src = sys.argv[1]
    out = arg('out', os.path.dirname(src) or '.')
    width = int(arg('width', 1100))
    go = '--go' in sys.argv
    bundle = arg('bundle', 'Print previews')
    os.makedirs(out, exist_ok=True)
    stem = os.path.splitext(os.path.basename(src))[0]
    doc = pymupdf.open(src)
    result = []
    for i, page in enumerate(doc):
        zoom = width / page.rect.width
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
        f = os.path.join(out, f'{stem}-p{i + 1}.webp')
        img.save(f, 'WEBP', quality=82)
        row = {'page': i + 1, 'file': f}
        if go:
            row['url'] = upload(f, bundle)
        result.append(row)
        print(f"{f} {row.get('url', '')}")
    json.dump({'pdf': src, 'pages': result}, open(os.path.join(out, stem + '.pages.json'), 'w'))

if __name__ == '__main__':
    main()
