#!/usr/bin/env python3
# mockup-lay.py — lay the REAL card fronts onto a drawn product mockup, every
# card at ONE exact size (2026-09-22, Sophie, on the animal deck mockups:
# "wait the cards aren't keeping size!" · "still looks wrong · measure").
#
# gpt-image-2 REDRAWS the cards it is shown: measured on the table shots the
# cards came out 4-9% apart in width, 1.27-1.49 tall-to-wide against a real
# card's 1.40, and the animals subtly redrawn — and no wording in the prompt
# holds it (the "most important rule" take still ran 5% apart). So the model
# draws the SCENE — the table, the light, where each card lies and how it is
# turned — and this script puts the print files on top, exact by construction:
#
#   1. find every card the model drew (a white, card-sized blob), its centre,
#      its angle and the rectangle it fills;
#   2. match each one to a front by LOOKS (a small grey thumbnail of the drawn
#      card against each front), so the order on the table never matters;
#   3. lay every front at the SAME width and height — big enough to cover the
#      largest card the model drew, so nothing of the redrawn card shows —
#      turned the way the model turned it, with a soft shadow of its own.
#
#   python3 scripts/mockup-lay.py <take.png|webp> --fronts <dir> --out <laid.png> [--report r.json]
#
# The fronts are flashcard-compose.py's 825x1125 files WITH the 1/8in bleed; the
# printed card is the inner 750x1050 (5:7), and that is what is laid. A card the
# model drew in perspective (a hand holding one up) is not a flat rectangle and
# is LEFT ALONE, named in the report — this fixes the table shots, where the
# size complaint lives. No model call; nothing is spent.
import sys, os, json, argparse, math
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument('take'); ap.add_argument('--fronts', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--report'); ap.add_argument('--bleed', type=int, default=37)
ap.add_argument('--min-area', type=int, default=20000)
ap.add_argument('--ratio', type=float, default=1.4)       # a poker card, 3.5 / 2.5
ap.add_argument('--shadow', type=float, default=0.28)     # opacity of the laid card's own shadow
A = ap.parse_args()

im = Image.open(A.take).convert('RGB')
W, H = im.size
arr = np.asarray(im).astype(int)
r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]

# 1. the drawn cards: white blobs (the card face) — the same test mockup-measure.py uses
white = (r > 200) & (g > 200) & (b > 200) & (abs(r - b) < 30)
white = ndimage.binary_closing(white, iterations=6)
white = ndimage.binary_fill_holes(white)
lab, n = ndimage.label(white)

def blobs(mask):
    """every white blob as its pixel set (x, y), the small ones dropped"""
    lab, n = ndimage.label(mask)
    out = []
    for k, sl in enumerate(ndimage.find_objects(lab), 1):
        h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
        if w * h < A.min_area: continue
        ys, xs = np.nonzero(lab[sl] == k)
        out.append(np.stack([xs + sl[1].start, ys + sl[0].start], 1))
    return out

def measure(pts):
    pts = pts.astype(float)
    c = pts.mean(0); q = pts - c
    ev, evec = np.linalg.eigh(np.cov(q.T))
    long_axis = evec[:, 1]; short_axis = evec[:, 0]
    proj_l = q @ long_axis; proj_s = q @ short_axis
    L = proj_l.max() - proj_l.min(); S = proj_s.max() - proj_s.min()
    return c, L, S, len(pts) / max(1.0, L * S), long_axis

def split(pts):
    """TWO CARDS SET DOWN TOUCHING read as one blob (the hippo and the rabbit on
    the loose take): erode the blob until it falls into pieces, then grow each
    piece back inside the original outline. A blob that never splits is
    returned as it came."""
    x0, y0 = pts.min(0); x1, y1 = pts.max(0)
    m = np.zeros((y1 - y0 + 1, x1 - x0 + 1), bool); m[pts[:, 1] - y0, pts[:, 0] - x0] = True
    for it in range(4, 60, 4):
        er = ndimage.binary_erosion(m, iterations=it)
        lab2, n2 = ndimage.label(er)
        sizes = ndimage.sum(er, lab2, range(1, n2 + 1))
        big = [k + 1 for k, s in enumerate(sizes) if s > A.min_area / 4]
        if len(big) >= 2:
            # hand every pixel of the original blob to the nearest surviving piece
            seeds = np.where(np.isin(lab2, big), lab2, 0)
            _, idx = ndimage.distance_transform_edt(seeds == 0, return_indices=True)
            owner = seeds[idx[0], idx[1]] * m
            return [np.stack([np.nonzero(owner == k)[1] + x0, np.nonzero(owner == k)[0] + y0], 1) for k in big]
        if not er.any(): break
    return [pts]

cards = []
raw = blobs(white)
pieces = []
for pts in raw:
    c, L, S, fill, _ = measure(pts)
    pieces += split(pts) if (fill < 0.88 and L / S > 1.75) else [pts]
for pts in pieces:
    pts = pts.astype(float)
    c = pts.mean(0); q = pts - c
    ev, evec = np.linalg.eigh(np.cov(q.T))
    long_axis = evec[:, 1]; short_axis = evec[:, 0]
    proj_l = q @ long_axis; proj_s = q @ short_axis
    L = proj_l.max() - proj_l.min(); S = proj_s.max() - proj_s.min()
    fill = len(pts) / max(1.0, L * S)   # a flat rectangle fills its own box; a card in perspective or two touching cards do not
    # the angle of the card's long (tall) axis, measured from vertical, in degrees
    ang = math.degrees(math.atan2(long_axis[0], long_axis[1]))
    if ang > 90: ang -= 180
    if ang < -90: ang += 180
    cards.append({'cx': float(c[0]), 'cy': float(c[1]), 'w': float(S), 'h': float(L), 'angle': float(ang), 'fill': float(fill), 'ratio': float(L / S), 'px': int(len(pts))})
cards.sort(key=lambda t: (t['cy'] // 200, t['cx']))

flat = [c for c in cards if c['fill'] > 0.88 and 1.15 < c['ratio'] < 1.75]
skipped = [c for c in cards if c not in flat]
if not flat:
    print('no flat cards found'); sys.exit(1)

# 2. the fronts, bleed trimmed, and a grey thumbnail of each for matching
files = sorted(f for f in os.listdir(A.fronts) if f.lower().endswith('.png'))
fronts = []
for f in files:
    fr = Image.open(os.path.join(A.fronts, f)).convert('RGB')
    fw, fh = fr.size
    fr = fr.crop((A.bleed, A.bleed, fw - A.bleed, fh - A.bleed))
    fronts.append({'file': f, 'im': fr, 'thumb': np.asarray(fr.convert('L').resize((40, 56), Image.LANCZOS)).astype(float)})

def drawn_thumb(c):
    # cut the drawn card out square to its own axes: rotate the take so the card stands upright, then crop its box
    rot = im.rotate(-c['angle'], resample=Image.BICUBIC, center=(c['cx'], c['cy']))
    box = (int(c['cx'] - c['w'] / 2), int(c['cy'] - c['h'] / 2), int(c['cx'] + c['w'] / 2), int(c['cy'] + c['h'] / 2))
    return np.asarray(rot.crop(box).convert('L').resize((40, 56), Image.LANCZOS)).astype(float)

def dist(a, b):
    a = a - a.mean(); b = b - b.mean()
    return float(np.abs(a - b).mean())

# greedy one-to-one assignment on the smallest difference; a front is used once
pairs = []
cost = [[dist(drawn_thumb(c), f['thumb']) for f in fronts] for c in flat]
used_c, used_f = set(), set()
for ci, fi, d in sorted(((ci, fi, cost[ci][fi]) for ci in range(len(flat)) for fi in range(len(fronts))), key=lambda t: t[2]):
    if ci in used_c or fi in used_f: continue
    used_c.add(ci); used_f.add(fi); pairs.append((flat[ci], fronts[fi], d))

# 3. ONE size for every card: wide enough and tall enough to cover the largest the model drew, at the real 5:7
cw = max(max(c['w'] for c in flat), max(c['h'] for c in flat) / A.ratio) + 2
cw = int(round(cw)); ch = int(round(cw * A.ratio))
rad = int(round(cw * 37 / 750))   # a printed card's 1/8in corner
out = im.convert('RGBA')
for c, f, d in sorted(pairs, key=lambda p: (p[0]['cy'], p[0]['cx'])):
    face = f['im'].resize((cw, ch), Image.LANCZOS).convert('RGBA')
    mask = Image.new('L', (cw, ch), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, cw - 1, ch - 1), radius=rad, fill=255)
    face.putalpha(mask)
    # the card's own soft shadow: its silhouette, blurred, a little down and right
    pad = 24
    layer = Image.new('RGBA', (cw + 2 * pad, ch + 2 * pad), (0, 0, 0, 0))
    sh = Image.new('RGBA', (cw + 2 * pad, ch + 2 * pad), (0, 0, 0, 0))
    sh.paste(Image.new('RGBA', (cw, ch), (20, 14, 8, int(255 * A.shadow))), (pad + 3, pad + 5), mask)
    sh = sh.filter(ImageFilter.GaussianBlur(6))
    layer.alpha_composite(sh); layer.alpha_composite(face, (pad, pad))
    layer = layer.rotate(c['angle'], resample=Image.BICUBIC, expand=True)
    out.alpha_composite(layer, (int(round(c['cx'] - layer.width / 2)), int(round(c['cy'] - layer.height / 2))))

out.convert('RGB').save(A.out, quality=95)
rep = {'card': [cw, ch], 'laid': [{'front': f['file'], 'at': [round(c['cx']), round(c['cy'])], 'angle': round(c['angle'], 2), 'drawn': [round(c['w']), round(c['h'])], 'match': round(d, 1)} for c, f, d in pairs],
       'skipped': [{'at': [round(c['cx']), round(c['cy'])], 'drawn': [round(c['w']), round(c['h'])], 'fill': round(c['fill'], 2), 'ratio': round(c['ratio'], 2)} for c in skipped],
       'unused_fronts': [f['file'] for f in fronts if f not in [p[1] for p in pairs]]}
if A.report: json.dump(rep, open(A.report, 'w'), indent=1)
print(f"laid {len(pairs)} of {len(cards)} drawn cards at {cw}x{ch} (ratio {ch/cw:.2f}); skipped {len(skipped)}; unused fronts {len(rep['unused_fronts'])}")
for c, f, d in pairs: print(f"  {f['file']:<22} at ({c['cx']:.0f},{c['cy']:.0f}) turned {c['angle']:+.1f}° over a {c['w']:.0f}x{c['h']:.0f} drawing (match {d:.1f})")
for c in skipped: print(f"  skipped a {c['drawn'][0] if 'drawn' in c else c['w']:.0f}x{c['h']:.0f} blob at ({c['cx']:.0f},{c['cy']:.0f}) fill {c['fill']:.2f} ratio {c['ratio']:.2f}")
