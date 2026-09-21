#!/usr/bin/env python3
"""Turn a handwritten glyph sheet (one picture of the alphabet in rows) into a
font — OTF (cubic) and TTF (quadratic) — with no font editor.

    python3 scripts/sheet-to-font.py docs/fonts/handwritten-sheet.png \
        --name "Sophie Hand" --out public/fonts/sophie-hand

How it reads the sheet: ink = dark AND unsaturated pixels (the green leaves
drop out), the outer 4% is cropped (the drawn border), rows are found by the
horizontal ink profile, each row is cut into glyphs by connected components
merged across tiny gaps (an i's dot, a t's bar, a colon's two dots), and the
glyphs are matched left-to-right to the ROWS spec below. Each glyph is
upscaled 4x from the grey original, thresholded, traced with potrace, and
scaled so the caps row's height is CAP_HEIGHT units. Baselines are per row
(the median bottom of the row's glyphs, so descenders don't pull it down).

Needs: pip install fonttools pillow numpy opencv-python-headless potracer
"""
import argparse, os, sys, statistics
import cv2, numpy as np, potrace
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

# The rows on the sheet, top to bottom, after the title rows. A row is a
# string of the characters it holds, left to right. Edit this for a sheet
# laid out differently.
ROWS = [
    'ABCDEFGHIJKLM',
    'NOPQRSTUVWXYZ',
    'abcdefghijklm',
    'nopqrstuvwxyz',
    '0123456789',
    '.,!?&@#$%()-+=:;“”’',
]
SKIP_ROWS_BEFORE = 1   # title band(s) above the first glyph row
UPM = 1000
CAP_HEIGHT = 700
SIDE = 65              # sidebearing, font units
SPACE = 300
DESCENDERS = set('gjpqy,;()$@')
ABOVE_X = set('bdfhklt')   # lowercase with ascenders (x-height is measured without them)
# Glyphs drawn as two strokes that should read as one: the pieces are bridged
# at their closest points before tracing (the sheet's y has a gap between its
# arm and its stem, which at text size reads as a stray tick — Sophie: "y is
# bad"). Dotted/two-part marks (i j ! ? : ; = % quotes) are NOT in here.
JOIN = set('y')
# A mark that is drawn lower on the sheet than it sits in type: align its TOP
# with another glyph's top. The sheet's apostrophe hangs at mid height and
# rendered "IT'S" as "IT,S".
ALIGN_TOP = {'\u2019': '\u201d'}

def ink_mask(im):
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    ink = ((gray < 140) & (hsv[..., 1] < 90)).astype(np.uint8)
    h, w = ink.shape
    m = np.zeros_like(ink); m[int(h*.04):int(h*.96), int(w*.04):int(w*.96)] = 1
    return ink & m, gray

def bands(ink, minh=8, thresh=3):
    rows = ink.sum(axis=1) > thresh
    out, s = [], None
    for y, v in enumerate(rows):
        if v and s is None: s = y
        if not v and s is not None:
            if y - s > minh: out.append((s, y))
            s = None
    return out

def glyph_boxes(ink, y0, y1, gap=3):
    band = ink[y0:y1]
    n, lab, stats, _ = cv2.connectedComponentsWithStats(band, 8)
    comps = sorted((int(s[0]), int(s[0]+s[2]), int(s[1]), int(s[1]+s[3])) for s in stats[1:] if s[4] >= 4)
    merged = []
    for c in comps:
        if merged and c[0] <= merged[-1][1] + gap:
            m = merged[-1]; merged[-1] = (min(m[0], c[0]), max(m[1], c[1]), min(m[2], c[2]), max(m[3], c[3]))
        else: merged.append(c)
    return [(x0, x1, y0+t, y0+b) for (x0, x1, t, b) in merged]

def trace(gray, box, scale=4, pad=3, join=False):
    x0, x1, y0, y1 = box
    crop = gray[y0-pad:y1+pad, x0-pad:x1+pad]
    big = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    big = cv2.GaussianBlur(big, (3, 3), 0)
    ink = big < 165
    if join: ink = bridge(ink)
    # potracer traces the False region as foreground
    path = potrace.Bitmap(~ink).trace(turdsize=6, alphamax=1.0, opticurve=True, opttolerance=0.2)
    origin = (x0-pad, y0-pad)
    return path, origin, scale

def bridge(ink):
    """Join the two largest pieces of a glyph with a stroke between their closest pixels."""
    n, lab, stats, _ = cv2.connectedComponentsWithStats(ink.astype(np.uint8), 8)
    if n <= 2: return ink
    big = sorted(range(1, n), key=lambda i: -stats[i][4])[:2]
    a = np.argwhere(lab == big[0]); b = np.argwhere(lab == big[1])
    # closest pair (sizes are a few thousand px, so the full distance table is fine)
    d = ((a[:, None, :] - b[None, :, :]) ** 2).sum(-1)
    i, j = np.unravel_index(d.argmin(), d.shape)
    # stroke width ≈ the median run of ink down the columns
    runs = [r for col in ink.T for r in np.diff(np.flatnonzero(np.diff(np.r_[0, col.astype(int), 0]))).tolist()[::2] if r > 0]
    w = max(3, int(np.median(runs)) if runs else 8)
    out = ink.astype(np.uint8).copy()
    cv2.line(out, (int(a[i][1]), int(a[i][0])), (int(b[j][1]), int(b[j][0])), 1, w)
    return out.astype(bool)

def draw(pen, path, origin, scale, ox, oy, k):
    """Feed potrace curves to a pen. Image px → font units: x' = (x/scale+ox0-ox)*k, y' = (oy - (y/scale+oy0))*k."""
    ox0, oy0 = origin
    def P(pt):
        return ((pt.x/scale + ox0 - ox) * k, (oy - (pt.y/scale + oy0)) * k)
    for curve in path:
        pen.moveTo(P(curve.start_point))
        for seg in curve:
            if seg.is_corner:
                pen.lineTo(P(seg.c)); pen.lineTo(P(seg.end_point))
            else:
                pen.curveTo(P(seg.c1), P(seg.c2), P(seg.end_point))
        pen.closePath()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet'); ap.add_argument('--name', default='Sheet Hand')
    ap.add_argument('--out', default='sheet-hand'); ap.add_argument('--debug', default='')
    a = ap.parse_args()
    im = cv2.imread(a.sheet); ink, gray = ink_mask(im)
    bs = bands(ink)[SKIP_ROWS_BEFORE:SKIP_ROWS_BEFORE+len(ROWS)]
    if len(bs) < len(ROWS): sys.exit(f'found {len(bs)} rows, need {len(ROWS)}')
    glyphs = {}   # char -> (box, baseline_px)
    for chars, (y0, y1) in zip(ROWS, bs):
        boxes = glyph_boxes(ink, max(0, y0-5), y1+5)
        if len(boxes) != len(chars):
            sys.exit(f'row {chars!r}: found {len(boxes)} glyphs, expected {len(chars)}: {[(b[0], b[1]-b[0]) for b in boxes]}')
        bottoms = [b[3] for c, b in zip(chars, boxes) if c not in DESCENDERS]
        base = statistics.median(bottoms)
        for c, b in zip(chars, boxes): glyphs[c] = (b, base)
    cap_px = statistics.median(glyphs[c][1] - glyphs[c][0][2] for c in 'BDEFHIKLNPRTUZ')
    k = CAP_HEIGHT / cap_px
    xh_px = statistics.median(glyphs[c][1] - glyphs[c][0][2] for c in 'nmuvwxz')
    print(f'cap {cap_px:.1f}px → {CAP_HEIGHT}u (k={k:.3f}); x-height {xh_px*k:.0f}u')
    if a.debug:
        dbg = im.copy()
        for c, (b, base) in glyphs.items():
            cv2.rectangle(dbg, (b[0], b[2]), (b[1], b[3]), (0, 0, 255), 1)
            cv2.line(dbg, (b[0], int(base)), (b[1], int(base)), (255, 0, 0), 1)
        cv2.imwrite(a.debug, dbg)

    order = ['.notdef', 'space'] + [c for row in ROWS for c in row]
    names = {c: (f'uni{ord(c):04X}' if not c.isalnum() else (c if c.islower() or c.isdigit() else c + '.cap')) for row in ROWS for c in row}
    # glyph names: caps get a plain name too; AGL-ish is fine for our use
    names = {c: ('uni%04X' % ord(c)) for row in ROWS for c in row}
    cmap = {ord(c): names[c] for c in names}
    cmap[32] = 'space'
    # aliases: straight quotes → the curly ones drawn on the sheet
    cmap[ord('"')] = names['”']; cmap[ord("'")] = names['’']; cmap[ord('‘')] = names['’']
    cmap[ord('`')] = names['’']
    glyph_order = ['.notdef', 'space'] + [names[c] for row in ROWS for c in row]

    cff_chars, tt_glyphs, widths, bounds = {}, {}, {}, {}
    for c, (box, base) in glyphs.items():
        path, origin, scale = trace(gray, box, join=(c in JOIN))
        x0, x1, y0, y1 = box
        if c in ALIGN_TOP: base += y0 - glyphs[ALIGN_TOP[c]][0][2]   # lift so its top matches
        adv = int(round((x1 - x0) * k + 2*SIDE))
        # draw into a recording via T2 pen (cubic) and TT pen via cu2qu
        t2 = T2CharStringPen(adv, None)
        draw(t2, path, origin, scale, x0 - SIDE/k, base, k)
        cff_chars[names[c]] = t2.getCharString()
        tt = TTGlyphPen(None)
        draw(Cu2QuPen(tt, 1.0), path, origin, scale, x0 - SIDE/k, base, k)
        tt_glyphs[names[c]] = tt.glyph()
        widths[names[c]] = adv
    for g in ('.notdef', 'space'):
        widths[g] = SPACE
        cff_chars[g] = T2CharStringPen(SPACE, None).getCharString()
        tt_glyphs[g] = TTGlyphPen(None).glyph()

    asc, desc = 900, -250
    family = a.name
    for fmt in ('otf', 'ttf'):
        fb = FontBuilder(UPM, isTTF=(fmt == 'ttf'))
        fb.setupGlyphOrder(glyph_order)
        fb.setupCharacterMap(cmap)
        if fmt == 'ttf':
            fb.setupGlyf(tt_glyphs)
        else:
            fb.setupCFF(family.replace(' ', ''), {'FullName': family, 'FamilyName': family}, cff_chars, {})
        metrics = {}
        for g in glyph_order:
            if fmt == 'ttf':
                gl = tt_glyphs[g]; lsb = gl.xMin if hasattr(gl, 'xMin') else 0
            else:
                bp = BoundsPen(None); cff_chars[g].draw(bp); lsb = int(bp.bounds[0]) if bp.bounds else 0
            metrics[g] = (widths[g], lsb)
        fb.setupHorizontalMetrics(metrics)
        fb.setupHorizontalHeader(ascent=asc, descent=desc)
        fb.setupNameTable({'familyName': family, 'styleName': 'Regular', 'uniqueFontIdentifier': f'{family} Regular', 'fullName': family, 'psName': family.replace(' ', '') + '-Regular', 'version': 'Version 1.0'})
        fb.setupOS2(sTypoAscender=asc, sTypoDescender=desc, sTypoLineGap=0, usWinAscent=asc, usWinDescent=-desc, sxHeight=int(xh_px*k), sCapHeight=CAP_HEIGHT, achVendID='SOPH')
        fb.setupPost()
        if fmt == 'ttf': fb.setupMaxp()
        out = f'{a.out}.{fmt}'
        fb.save(out); print('wrote', out, os.path.getsize(out), 'bytes')

if __name__ == '__main__':
    main()
