#!/usr/bin/env python3
"""A flat-colour card PNG -> a clean SVG.

Built for the Gravity Lock teaching cards (pastel line art, no shading), which
are cut out of 2x2 sheets and therefore only ~512px of picture each. Tracing
one gives back art that is sharp at any size — a print, a big tile, a phone at
3x — from one ~150KB file, in about two seconds, with no model and no cost.

Usage:  python3 scripts/vectorize-card.py in.png out.svg [--fills 4]

    --fills is how many colours the drawing really has, NOT counting the black
    line and the white paper. The weight card (grey hammer head, pink handle,
    mint feather, lilac moon) is 4. Too many and a cluster gets spent on noise;
    too few and two real colours merge.

The whole job is FLATTENING the picture correctly; vtracer then traces an image
that already has exactly `fills + 2` colours in it, so it emits one layer per
real colour instead of the 100+ near-duplicates it finds in a raw render.

Three things about the flattening are load-bearing, and each one produced a
visibly wrong result when it was missing (v1 shipped without the first, and
Sophie caught both faults it caused: "it doesn't quite capture the colors, and
there's, like, some extra lines around"):

1. THE ANTI-ALIASED BAND BESIDE EVERY LINE IS NOT A COLOUR. It is a ramp from
   ink to paper that passes straight through the range the real fills occupy,
   so a palette built over it spends a whole cluster on the ramp — and the
   trace then wears that colour as a pale halo along every line. `band`
   dilates the ink mask and excludes that collar from the palette entirely.

2. THE PALETTE IS K-MEANS, NOT A QUANTISER. PIL's MAXCOVERAGE picks colours to
   span the gamut, which is exactly wrong for flat art: the grey hammer head
   (210,204,209) and the lilac moon (214,207,232) sit 23 RGB units apart, so it
   merged them and the hammer came out lilac — or, chasing the extremes, sage
   green. K-means minimises within-cluster variance, so its centres land ON the
   dense flat colours. Each cluster is then painted its MEDIAN real colour, so
   what comes out is what went in.

3. LABELS PROPAGATE, NOT COLOURS. Every pixel that is not a confident fill
   (the collar, the crater rims) takes the LABEL of the nearest one via a
   distance transform, so no blended in-between colour is ever invented — and
   it is weighed against the distance to the nearest paper pixel, or a fill
   colour gets painted into the open space beside a line.

A median filter first kills the paper grain gpt-image-2 leaves in the flats
(without it the moon comes out mottled), and a median filter on the LABEL map
kills stray single-pixel assignments inside an otherwise flat area.

vtracer writes no viewBox, so this adds one — without it the SVG does not
scale, which is the entire point of having it.
"""
import argparse, os, time
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
import vtracer


def kmeans(X, k, iters=40, seed=0):
    """Plain Lloyd's on RGB. Seeded, so the same card always traces the same."""
    rng = np.random.default_rng(seed)
    C = X[rng.choice(len(X), k, replace=False)].astype(np.float64)
    for _ in range(iters):
        lab = ((X[:, None, :] - C[None]) ** 2).sum(-1).argmin(1)
        new = np.array([X[lab == j].mean(0) if (lab == j).any() else C[j]
                        for j in range(k)])
        if np.allclose(new, C, atol=.4):
            return new
        C = new
    return C


def flatten(src, fills=4, ink=150, paper=243, band=3, median=3, upscale=3, smooth=9):
    """The card as exactly `fills + 2` flat colours: the fills, ink, and paper."""
    im = Image.open(src)
    if im.mode in ('RGBA', 'LA'):                    # a cut-out: put it on paper
        bg = Image.new('RGB', im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        im = bg
    im = im.convert('RGB')
    if median:
        im = im.filter(ImageFilter.MedianFilter(median))
    if upscale > 1:
        im = im.resize((im.width * upscale, im.height * upscale), Image.LANCZOS)

    a = np.array(im).astype(np.float64)
    lum = a @ [0.299, 0.587, 0.114]
    inkm, paperm = lum < ink, lum > paper
    edge = ndimage.binary_dilation(inkm, iterations=band)   # see (1)
    solid = ~inkm & ~paperm & ~edge

    pix = a[solid]
    C = kmeans(pix[::max(1, len(pix) // 40000)], fills)     # see (2)
    labs = ((pix[:, None, :] - C[None]) ** 2).sum(-1).argmin(1)
    cols = np.array([np.median(pix[labs == j], 0).round() for j in range(fills)]
                    ).astype(np.uint8)

    LAB = np.full(solid.shape, -1, np.int16)
    LAB[solid] = labs
    if smooth:
        # The window sees -1 wherever a pixel is not a fill, so near any line the
        # median comes back -1 — and a -1 that reaches the paint step becomes
        # cluster 0. That is what put pink crescents inside the moon's craters
        # and along the feather's spine: cluster 0 happened to be the pink.
        # Keep only the smoothed labels that are real ones.
        sm = ndimage.median_filter(np.where(solid, LAB, -1).astype(np.int16), size=smooth)
        good = solid & (sm >= 0)
        LAB[good] = sm[good]

    dF, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)  # see (3)
    dP = ndimage.distance_transform_edt(~paperm)
    picked = LAB[iy, ix]
    assert picked.min() >= 0, 'a pixel was left unlabelled — it would be painted cluster 0'
    flat = cols[picked]
    flat[paperm | (~solid & ~inkm & (dP <= dF))] = 255
    flat[inkm] = 26
    return Image.fromarray(flat), [tuple(int(v) for v in c) for c in cols]


def vectorize(src, out, fills=4, speckle=10, **kw):
    t0 = time.time()
    flat, cols = flatten(src, fills=fills, **kw)
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
    return cols, os.path.getsize(out) / 1024, time.time() - t0


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('src')
    p.add_argument('out')
    p.add_argument('--fills', type=int, default=4, help='colours besides ink and paper')
    p.add_argument('--ink', type=int, default=150, help='luminance below this is line')
    p.add_argument('--paper', type=int, default=243, help='luminance above this is paper')
    p.add_argument('--band', type=int, default=3, help='px of anti-aliased collar to exclude')
    p.add_argument('--flat', help='also write the flattened raster here, to eyeball it')
    a = p.parse_args()
    if a.flat:
        f, _ = flatten(a.src, fills=a.fills, ink=a.ink, paper=a.paper, band=a.band)
        f.save(a.flat)
    cols, kb, secs = vectorize(a.src, a.out, fills=a.fills, ink=a.ink,
                               paper=a.paper, band=a.band)
    print(f'{a.out}  {len(cols)} fills {cols}  {kb:.0f}KB  {secs:.1f}s')
