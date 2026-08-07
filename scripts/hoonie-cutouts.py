#!/usr/bin/env python3
"""Hoonies (the black-line woodcut smallies) → transparent cutouts + the loading GIF.

The hoonies arrive as line art on white paper. A white square is fine on a white
card and wrong everywhere else — over the cream quiz cards, over the dark witch
theme — which is why the loading animation needs a version with the paper cut
away. This does both halves of that:

  cutouts  every source image as a transparent PNG, trimmed to the ink
  gif      those cutouts as one animated GIF with a transparent background

The cut is the same corner flood-fill the pastel house style uses
(`whitenBackground()` in server.js): the background color is sampled from the
four CORNERS and only pixels border-connected to it are cleared, so interior
whites walled off by ink survive and — the part that matters — every kept pixel
keeps its ORIGINAL color. Nothing is grayscaled or remapped: warm ink stays
warm. (The first version of this script quantized everything to neutral gray,
which read cold/greenish on the app's cream surfaces.)

GIF transparency is 1-bit; each frame quantizes its own real colors with index
0 reserved for the cleared paper, and frames use disposal=2 or they'd stack.

Usage:
  python3 scripts/hoonie-cutouts.py <src-dir> --out <png-dir> --gif public/hoonie-loading-clear.gif
  python3 scripts/hoonie-cutouts.py <src-dir> --gif out.gif --size 300 --ms 200 --max 60

Needs Pillow + numpy + scipy (local tool, not a server dependency):
  pip3 install Pillow numpy scipy
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

IMG_EXT = ('.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff')


def cutout(path, tol=46):
    """One source image → RGBA with the paper cleared, trimmed to the ink.
    Port of server.js whitenBackground(): corner-sampled background color,
    border-connected flood fill, original pixels kept everywhere else."""
    rgb = np.asarray(Image.open(path).convert('RGB'), dtype=np.int16)
    h, w = rgb.shape[:2]
    corners = [rgb[2, 2], rgb[2, w - 3], rgb[h - 3, 2], rgb[h - 3, w - 3]]
    bg = np.mean(corners, axis=0)
    near = ((rgb - bg) ** 2).sum(axis=2) <= tol * tol

    labels, _ = ndimage.label(near)
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    edge = edge[edge != 0]
    paper = np.isin(labels, edge)

    if paper.all():
        return None
    alpha = np.where(paper, 0, 255).astype(np.uint8)
    out = Image.fromarray(np.dstack([rgb.astype(np.uint8), alpha]), 'RGBA')
    box = out.getbbox()
    return out.crop(box) if box else out


def on_canvas(img, size, pad):
    """Centre a cutout on a square canvas at a consistent visual size."""
    inner = size - 2 * pad
    w, h = img.size
    s = min(inner / w, inner / h)
    img = img.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.paste(img, ((size - img.size[0]) // 2, (size - img.size[1]) // 2))
    return canvas


def to_frame(rgba, colors=7):
    """RGBA → paletted frame: index 0 transparent, the rest the frame's own
    colors (adaptive palette), so the ink keeps its real tone."""
    a = np.asarray(rgba)[:, :, 3]
    # Quantize against white so palette entries near the edge stay clean.
    flat = Image.new('RGB', rgba.size, (255, 255, 255))
    flat.paste(rgba, (0, 0), rgba)
    q = flat.quantize(colors=colors, method=Image.MEDIANCUT)
    idx = np.asarray(q, dtype=np.uint8) + 1                  # shift: 0 = transparent
    idx = np.where(a >= 128, idx, 0).astype(np.uint8)
    frame = Image.fromarray(idx, 'P')
    pal = q.getpalette()[:colors * 3]
    frame.putpalette([255, 255, 255] + pal + [0, 0, 0] * (256 - colors - 1))
    return frame


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('--out', help='directory for the transparent PNG cutouts')
    ap.add_argument('--gif', help='write the animated GIF here')
    ap.add_argument('--size', type=int, default=360)
    ap.add_argument('--pad', type=int, default=24)
    ap.add_argument('--ms', type=int, default=200)
    ap.add_argument('--max', type=int, default=0, help='cap the frame count (0 = all)')
    ap.add_argument('--tol', type=int, default=46, help='background match tolerance (whitenBackground default)')
    ap.add_argument('--skip', default='', help='comma-separated basenames to leave out')
    args = ap.parse_args()

    skip = {s.strip() for s in args.skip.split(',') if s.strip()}
    files = sorted(f for f in os.listdir(args.src)
                   if f.lower().endswith(IMG_EXT) and f not in skip and os.path.splitext(f)[0] not in skip)
    if not files:
        sys.exit('no images in ' + args.src)

    if args.out:
        os.makedirs(args.out, exist_ok=True)

    frames, kept = [], []
    for f in files:
        cut = cutout(os.path.join(args.src, f), tol=args.tol)
        if cut is None:
            print('  blank, skipped:', f)
            continue
        if args.out:
            cut.save(os.path.join(args.out, os.path.splitext(f)[0] + '.png'))
        kept.append(f)
        if args.gif:
            frames.append(to_frame(on_canvas(cut, args.size, args.pad)))

    print(f'{len(kept)} cutouts' + (f' → {args.out}' if args.out else ''))

    if args.gif:
        if args.max:
            step = max(1, len(frames) // args.max)
            frames = frames[::step][:args.max]
        frames[0].save(args.gif, save_all=True, append_images=frames[1:], loop=0,
                       duration=args.ms, transparency=0, disposal=2, optimize=False)
        print(f'{len(frames)} frames → {args.gif} ({os.path.getsize(args.gif) / 1024:.0f} KB)')


if __name__ == '__main__':
    main()
