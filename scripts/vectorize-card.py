#!/usr/bin/env python3
"""A flat-colour card PNG -> a clean SVG.

Built for the Gravity Lock teaching cards (pastel line art, no shading), which
are cut out of 2x2 sheets and therefore only ~512px of picture each. Tracing
them gives back art that is sharp at any size — a print, a big tile, a phone at
3x — from one ~500KB file.

Usage:  python3 scripts/vectorize-card.py in.png out.svg [--colors 12]

Three steps, and the middle two are the ones that took the iterations:

1. MEDIAN FILTER kills the paper grain gpt-image-2 leaves in the flats. Without
   it the grain eats palette slots and the moon comes out mottled.

2. COLLAPSE THE ANTI-ALIASED RAMP (`ink` / `snap`). The soft edge between black
   ink and white paper is a run of mid-greys; every one of them earns its own
   traced layer, and the result wears a grey halo round every line. Pushing the
   dark end to ink and the light end to paper first removes the halo entirely.

3. QUANTISE A SATURATION-BOOSTED COPY, THEN PAINT EACH BIN ITS TRUE COLOUR. The
   grey hammer head (210,204,209) and the lilac moon (214,207,232) sit 23 RGB
   units apart, so a plain quantiser merges them and the hammer comes out
   lilac. Boosting chroma separates the bins; taking each bin's mean from the
   ORIGINAL pixels puts the real colours back.

vtracer's own colour mode is then given an already-flat image, so it emits one
layer per real colour instead of the 100+ near-duplicates it finds in a raw
render. It writes no viewBox, so we add one — without it the SVG will not scale.
"""
import argparse, os, time
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
import vtracer


def vectorize(src, out, colors=12, median=3, boost=2.2, upscale=3,
              ink=140, snap=250, speckle=12):
    t0 = time.time()
    im = Image.open(src)
    if im.mode in ('RGBA', 'LA'):                       # a cut-out: put it on paper
        bg = Image.new('RGB', im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        im = bg
    im = im.convert('RGB')
    if median:
        im = im.filter(ImageFilter.MedianFilter(median))
    if upscale > 1:
        im = im.resize((im.width * upscale, im.height * upscale), Image.LANCZOS)

    a = np.array(im).astype(np.int16)
    lum = a @ np.array([0.299, 0.587, 0.114])
    a[lum < ink] = [26, 26, 26]
    a[lum > snap] = [255, 255, 255]
    im = Image.fromarray(a.astype(np.uint8))

    pal = ImageEnhance.Color(im).enhance(boost).quantize(
        colors=colors, method=Image.Quantize.MAXCOVERAGE, dither=Image.Dither.NONE)
    bins = np.array(pal)
    orig = np.array(im).astype(np.float64).reshape(-1, 3)
    idx = bins.reshape(-1)
    true = np.zeros((colors, 3), np.uint8)
    for k in range(colors):
        m = idx == k
        if m.any():
            true[k] = orig[m].mean(0).round()
    flat = Image.fromarray(true[bins])

    tmp = out + '.flat.png'
    flat.save(tmp)
    vtracer.convert_image_to_svg_py(
        tmp, out, colormode='color', hierarchical='stacked', mode='spline',
        filter_speckle=speckle, color_precision=8, layer_difference=0,
        corner_threshold=60, length_threshold=4.0, splice_threshold=45)
    os.remove(tmp)

    s = open(out).read()
    w = flat.width
    if 'viewBox' not in s:
        open(out, 'w').write(s.replace(
            f'width="{w}" height="{w}"',
            f'viewBox="0 0 {w} {w}" width="{w}" height="{w}"', 1))
    return os.path.getsize(out) / 1024, time.time() - t0


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('src')
    p.add_argument('out')
    p.add_argument('--colors', type=int, default=12)
    p.add_argument('--median', type=int, default=3)
    p.add_argument('--ink', type=int, default=140, help='luminance below this becomes ink')
    p.add_argument('--snap', type=int, default=250, help='luminance above this becomes paper')
    a = p.parse_args()
    kb, secs = vectorize(a.src, a.out, colors=a.colors, median=a.median,
                         ink=a.ink, snap=a.snap)
    print(f'{a.out}  {kb:.0f}KB  {secs:.1f}s')
