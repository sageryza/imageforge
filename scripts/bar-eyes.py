#!/usr/bin/env python3
"""bar-eyes.py — paint a solid black bar over a rectangle of a photo.

The still half of the reference-filter trick (CLAUDE.md, "A SEEDANCE JOB WITH
NO VIDEO REFERENCE GOES THROUGH OPENROUTER"): ByteDance's input check reads a
reference photo's EYES, and covering them — a soft blur (2026-09-08) or a hard
black bar (2026-09-09) — is what gets a real photo accepted. The likeness
rides on the rest of the face, so the reference still works.

It does NOT find the eyes. Face detection was one more dependency for a job
that is two numbers off a screenshot, and a bar landing an inch low is worse
than no bar; look at the picture, read the coordinates, check the result.

    python3 scripts/bar-eyes.py in.jpg out.jpg 390 725 900 825

Coordinates are x0 y0 x1 y1 in the ORIGINAL pixels. Everything outside the
rectangle is untouched apart from the JPEG re-encode a composite costs
(quality 95, no chroma subsampling).

Two things it cannot do anything about, both measured 2026-09-09 on a Daniel
Radcliffe press photo:
  - a VIDEO reference is screened for a person, not a face, so barring the
    eyes on every frame does not help — that job is APIFRAME's;
  - clearing the input check is not the whole road. A famous face drew for a
    full minute and was then refused on the OUTPUT, "may be related to
    copyright restrictions".
"""
import sys
from PIL import Image, ImageDraw


def main(argv):
    if len(argv) != 7:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    src, out = argv[1], argv[2]
    x0, y0, x1, y1 = (int(n) for n in argv[3:7])
    im = Image.open(src).convert('RGB')
    w, h = im.size
    if not (0 <= x0 < x1 <= w and 0 <= y0 < y1 <= h):
        print(f'bar {x0},{y0},{x1},{y1} is outside the {w}x{h} picture', file=sys.stderr)
        return 2
    ImageDraw.Draw(im).rectangle([x0, y0, x1, y1], fill=(0, 0, 0))
    im.save(out, 'JPEG', quality=95, subsampling=0)
    print(f'{out} {w}x{h} bar {x0},{y0} -> {x1},{y1}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
