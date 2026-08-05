#!/usr/bin/env python3
"""Hoonies (the black-line woodcut smallies) → transparent cutouts + the loading GIF.

The hoonies arrive as line art on white paper. A white square is fine on a white
card and wrong everywhere else — over the cream quiz cards, over the dark witch
theme — which is why the loading animation needs a version with the paper cut
away. This does both halves of that:

  cutouts  every source image as a transparent PNG, trimmed to the ink
  gif      those cutouts as one animated GIF with a transparent background

GIF transparency is 1-bit, so the ink keeps a short gray ramp (never lighter
than --max-ink) and everything above the ink threshold is cut. A pale
antialiased edge would read as a white halo on a dark background — the ramp
stops short of that on purpose. Frames are written with disposal=2 (restore to
background) or every frame would stack on the one before it.

Usage:
  python3 scripts/hoonie-cutouts.py <src-dir> --out <png-dir> --gif public/hoonie-loading-clear.gif
  python3 scripts/hoonie-cutouts.py <src-dir> --gif out.gif --size 300 --ms 200 --max 60

Needs Pillow + numpy (local tool, not a server dependency):
  pip3 install Pillow numpy
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

IMG_EXT = ('.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff')


def otsu(gray):
    """Split ink from paper. Scans differ (pure white to warm 240s), so the
    threshold is computed per image rather than fixed."""
    hist = np.bincount(gray.ravel(), minlength=256).astype(float)
    total = hist.sum()
    omega = np.cumsum(hist) / total
    mu = np.cumsum(hist * np.arange(256)) / total
    mu_t = mu[-1]
    denom = omega * (1 - omega)
    denom[denom == 0] = 1e-9
    between = (mu_t * omega - mu) ** 2 / denom
    return int(np.argmax(between))


def despeckle(mask, min_neighbors=2):
    """Drop lone ink pixels — scan grain that survives the threshold and shows
    up as dirt once the paper is gone."""
    p = np.pad(mask.astype(np.uint8), 1)
    n = sum(p[dy:dy + mask.shape[0], dx:dx + mask.shape[1]]
            for dy in (0, 1, 2) for dx in (0, 1, 2)) - mask
    return mask & (n >= min_neighbors)


def cutout(path, max_ink=190, feather=18):
    """One source image → RGBA with the paper removed, trimmed to the ink."""
    im = Image.open(path).convert('L')
    gray = np.asarray(im, dtype=np.uint8)
    t = otsu(gray)
    mask = despeckle(gray <= t)
    if not mask.any():
        return None

    # Alpha ramps across `feather` levels above the threshold so edges keep some
    # softness; anything paler than that is paper and goes fully transparent.
    alpha = np.clip((t + feather - gray.astype(np.int16)) * (255.0 / max(feather, 1)), 0, 255)
    keep = np.pad(mask, 1)
    near = np.zeros_like(mask)
    for dy in (0, 1, 2):
        for dx in (0, 1, 2):
            near |= keep[dy:dy + mask.shape[0], dx:dx + mask.shape[1]]
    alpha = np.where(near, alpha, 0).astype(np.uint8)

    ink = np.clip(gray, 0, max_ink).astype(np.uint8)
    rgba = np.dstack([ink, ink, ink, alpha])
    out = Image.fromarray(rgba, 'RGBA')
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


def to_frame(rgba, levels=4, max_ink=190):
    """RGBA → paletted frame: index 0 transparent, the rest a short gray ramp."""
    a = np.asarray(rgba)[:, :, 3]
    ink = np.asarray(rgba)[:, :, 0].astype(np.int16)
    step = max_ink / (levels - 1)
    idx = np.clip(np.round(ink / step), 0, levels - 1).astype(np.uint8) + 1
    idx = np.where(a >= 128, idx, 0).astype(np.uint8)
    frame = Image.fromarray(idx, 'P')
    pal = [255, 255, 255]                                   # 0 = transparent
    for i in range(levels):
        v = int(round(i * step))
        pal += [v, v, v]
    frame.putpalette(pal + [0, 0, 0] * (256 - levels - 1))
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
    ap.add_argument('--max-ink', type=int, default=190)
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
        cut = cutout(os.path.join(args.src, f), max_ink=args.max_ink)
        if cut is None:
            print('  blank, skipped:', f)
            continue
        if args.out:
            cut.save(os.path.join(args.out, os.path.splitext(f)[0] + '.png'))
        kept.append(f)
        if args.gif:
            frames.append(to_frame(on_canvas(cut, args.size, args.pad), max_ink=args.max_ink))

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
