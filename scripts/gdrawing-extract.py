#!/usr/bin/env python3
"""Pull the ORIGINAL full-size images out of a Google Drawing.

Why this exists: a Google Drawing full of scanned artwork is a container, and
the pictures inside it are the only surviving copies of scans Sophie no longer
has the originals of. Every other export flattens them —

  File ▸ Download ▸ PNG/JPEG  → one flat image at SCREEN size (~1056x816)
  the Drive API's export endpoint → hard ~10MB cap, so a big drawing 400s
                                    with "File too large for export"

— but the SVG export embeds each placed image as its own base64 blob at the
size Google stored it, so splitting the SVG apart gives every picture back
individually at full resolution. That is the whole trick.

Usage:
    python3 scripts/gdrawing-extract.py <drawing-url-or-id> [-o OUTDIR] [--list]

The drawing must be reachable by link ("Anyone with the link", Viewer is
enough) — this fetches the same public export URL a browser would, with no
Google credentials. A restricted drawing answers 401 and the script says so.

Dependencies: none (stdlib only), same as scripts/nde-grab-local.py.

Notes on what comes out:
  * Duplicates are skipped — the same picture placed twice in the drawing is
    one file here, and drawings copied from other drawings repeat a lot.
  * Dimensions are reported. Anything sitting EXACTLY on 2500px is suspicious:
    that is Google's resize ceiling on upload, so the original was bigger and
    got scaled down. Anything under it is the size Sophie uploaded. (Do not
    read 2048 as a cap — PNGs come out at 2500 too; 2048 is just a common
    export size. An earlier guess got this wrong.)
  * Bytes are Google's re-encode, not the byte-for-byte original file: same
    pixels, metadata stripped.
"""
import argparse
import base64
import hashlib
import os
import re
import struct
import sys
import urllib.request

EXPORT = 'https://docs.google.com/drawings/d/{}/export/svg'
# Google scales anything larger than this down on upload.
RESIZE_CAP = 2500


def drawing_id(s):
    """Accept a full /drawings/d/<id>/edit URL or a bare id."""
    m = re.search(r'/drawings/d/([A-Za-z0-9_-]+)', s)
    return m.group(1) if m else s.strip()


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=600) as r:
        return r.read()


def dimensions(b):
    """(width, height), extension — by magic number, no image library."""
    if b[:8] == b'\x89PNG\r\n\x1a\n':
        w, h = struct.unpack('>II', b[16:24])
        return w, h, 'png'
    if b[:2] == b'\xff\xd8':
        i = 2
        while i < len(b) - 9:
            if b[i] != 0xFF:
                i += 1
                continue
            marker = b[i + 1]
            if marker in (0xC0, 0xC1, 0xC2, 0xC3):
                h, w = struct.unpack('>HH', b[i + 5:i + 9])
                return w, h, 'jpg'
            i += 2 + struct.unpack('>H', b[i + 2:i + 4])[0]
    return None, None, 'bin'


def extract(svg_text):
    """Every embedded image, de-duplicated by content, in document order."""
    out = []
    seen = set()
    for fmt, b64 in re.findall(r'href="data:image/([a-z+]+);base64,([^"]+)"', svg_text):
        try:
            raw = base64.b64decode(b64)
        except Exception:
            continue
        digest = hashlib.md5(raw).hexdigest()
        if digest in seen:
            continue
        seen.add(digest)
        w, h, ext = dimensions(raw)
        out.append({'bytes': raw, 'w': w, 'h': h, 'ext': ext, 'md5': digest})
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('drawing', help='Google Drawing URL or id')
    ap.add_argument('-o', '--out', default='drawing-images', help='output directory')
    ap.add_argument('--list', action='store_true', help='report what is inside, write nothing')
    args = ap.parse_args()

    did = drawing_id(args.drawing)
    print(f'fetching SVG export of {did} …', file=sys.stderr)
    try:
        blob = fetch(EXPORT.format(did))
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            sys.exit('Not link-shared. In the drawing: Share ▸ General access ▸ '
                     '"Anyone with the link" (Viewer is enough), then re-run.')
        raise
    svg = blob.decode('utf-8', errors='replace')
    print(f'  {len(blob) / 1048576:.1f} MB of SVG', file=sys.stderr)

    images = extract(svg)
    if not images:
        sys.exit('No embedded images found — the drawing may be all vector shapes.')

    if not args.list:
        os.makedirs(args.out, exist_ok=True)
    capped = 0
    for i, im in enumerate(images, 1):
        name = f'{i:02d}.{im["ext"]}'
        big = max(im['w'] or 0, im['h'] or 0) == RESIZE_CAP
        capped += big
        note = '  [at Google\'s 2500px cap — the original was bigger]' if big else ''
        print(f'{name}  {im["w"]}x{im["h"]}  {len(im["bytes"]) // 1024} KB{note}')
        if not args.list:
            with open(os.path.join(args.out, name), 'wb') as f:
                f.write(im['bytes'])

    where = 'would write' if args.list else f'wrote to {args.out}/'
    print(f'\n{where}: {len(images)} unique image(s), {capped} downscaled by Google.',
          file=sys.stderr)


if __name__ == '__main__':
    main()
