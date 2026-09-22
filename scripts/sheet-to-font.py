#!/usr/bin/env python3
"""Turn a handwritten (or lettered) glyph sheet into a font — OTF (cubic) and
TTF (quadratic) — with no font editor.

    python3 scripts/sheet-to-font.py docs/fonts/sophie-hand.json

The spec is JSON:
  name        the family name
  out         output path without extension (both .otf and .ttf are written)
  sources     a list of sheets, in order. The FIRST is the base; every later
              sheet ADDS glyphs the base lacks and files the ones it already
              has as ALTERNATES (`a.alt1`, `a.alt2`…) behind a `calt` feature
              that cycles them, so a repeated letter is drawn a different way
              each time — the thing that makes a handwriting font read as
              handwriting rather than a stamp (Sophie, 2026-09-21: "shud we add
              these for variants").
    sheet     the picture
    rows      the characters of each glyph row, left to right, top to bottom
    bands     which ink bands on the sheet those rows are (0-based, top down;
              a title, a drawing or a rule line is a band too) — run with
              --bands to print them
    left      crop this fraction off the left (a sheet with labels down the
              left edge); default 0.04, and 0.04 comes off every other edge
    join      glyphs drawn as two strokes that should read as one: the pieces
              are bridged at their closest points before tracing (the first
              sheet's y had a gap between arm and stem — "y is bad")
    gap       px between pieces that still count as one glyph (default 3; a
              serif with hairlines that break up at the threshold wants ~16
              on its caps rows), or a list with one gap per row — a caps row
              needs a wide one and a punctuation row a narrow one ("? &")
    dark      grey level below which a pixel is ink when finding glyphs
              (default 140; a light serif wants ~175) · traceDark the same
              for the 4x trace (default 165)
    level     groups of characters that share one height on a TYPESET sheet
              (["A…Z0…9"] for caps, ["aceimnorsuvwxz", "bdfhklt"] for a
              lowercase face): each glyph is scaled so its top meets the
              group's median top. Not for handwriting — the unevenness is
              the point there.
    side      side bearing in font units (default 65) — measured off the
              sheet's own title lines so the default spacing IS the sheet's
              (title 140, subtitle 80) · space the space glyph's width
    blur      false traces the plain cubic upscale with no smoothing, and with
              traceDark at the mid-grey between paper and ink (~130) the
              outline sits on the stroke's true edge — the sheet's own weight
              (a photographed serif; handwriting keeps the default)
    thin      px shaved off each side of every stroke at the 4x trace; the
              hairlines a shave would erase are kept whole
    alignTop  {glyph: otherGlyph} — lift a mark so its top matches another's
              (the sheet's apostrophe hung at mid height: IT'S read as IT,S)
  paste       also write <out>-paste.ttf: every glyph is its own PNG crop of
              the sheet (sbix), the pixels untouched — see paste_font
  lowerToCaps a caps-only font draws lowercase with the caps (the title face)
  capsToLower a lowercase-only font draws caps with the lowercase (the italic)

How it reads a sheet: ink = dark AND unsaturated pixels (watercolour leaves and
lemons drop out), rows are the horizontal ink profile, each row is cut into
glyphs by connected components merged across tiny gaps (an i's dot, a t's bar,
a colon's two dots), each glyph is upscaled 4x from the grey original,
thresholded and traced with potrace, and scaled so the caps row is CAP_HEIGHT
units (or the x-height X_HEIGHT units when a sheet has no caps). Baselines are
per row (the median bottom of the row's glyphs, so descenders don't pull it).

Needs: pip install fonttools pillow numpy opencv-python-headless potracer
"""
import argparse, json, os, sys, statistics
import cv2, numpy as np, potrace
from fontTools.fontBuilder import FontBuilder
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib.tables._s_b_i_x import table__s_b_i_x
from fontTools.ttLib.tables.sbixStrike import Strike
from fontTools.ttLib.tables.sbixGlyph import Glyph as SbixGlyph
from PIL import Image
import io

UPM = 1000
CAP_HEIGHT = 700
X_HEIGHT = 460
SIDE = 65              # sidebearing, font units
SPACE = 300
DESCENDERS = set('gjpqyf,;()[]{}$@Q/\\')
CAP_REF = 'BDEFHIKLNPRTUZ'
X_REF = 'nmuvwxz'
# straight/ASCII marks drawn on no sheet → the curly ones that are
ALIASES = {'"': '”', "'": '’', '‘': '’', '`': '’', '—': '-', '–': '-'}

def gname(c):
    return 'uni%04X' % ord(c)

def ink_mask(im, left, dark=140):
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    ink = ((gray < dark) & (hsv[..., 1] < 90)).astype(np.uint8)
    h, w = ink.shape
    m = np.zeros_like(ink); m[int(h*.04):int(h*.96), int(w*left):int(w*.96)] = 1
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

def thin_strokes(ink, px):
    """Take `px` off each side of every stroke, but leave anything the shave
    would delete outright (hairlines, serif tips) at its full width. A
    photographed serif traces fat — the anti-aliased halo and the upscale's
    blur both land inside the threshold — measured 1.7x the sheet's stems on
    the subtitle face (Sophie: "is the subtitle font thicker than i have u")."""
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2*px+1, 2*px+1))
    u8 = ink.astype(np.uint8)
    core = cv2.erode(u8, k)
    opened = cv2.dilate(core, k)
    hair = u8 & (1 - opened)          # what an opening removes: the thin parts
    return ((core | hair) > 0)

def bridge(ink):
    """Join the two largest pieces of a glyph with a stroke between their closest pixels."""
    n, lab, stats, _ = cv2.connectedComponentsWithStats(ink.astype(np.uint8), 8)
    if n <= 2: return ink
    big = sorted(range(1, n), key=lambda i: -stats[i][4])[:2]
    a = np.argwhere(lab == big[0]); b = np.argwhere(lab == big[1])
    d = ((a[:, None, :] - b[None, :, :]) ** 2).sum(-1)
    i, j = np.unravel_index(d.argmin(), d.shape)
    runs = [r for col in ink.T for r in np.diff(np.flatnonzero(np.diff(np.r_[0, col.astype(int), 0]))).tolist()[::2] if r > 0]
    w = max(3, int(np.median(runs)) if runs else 8)
    out = ink.astype(np.uint8).copy()
    cv2.line(out, (int(a[i][1]), int(a[i][0])), (int(b[j][1]), int(b[j][0])), 1, w)
    return out.astype(bool)

def trace(gray, box, scale=4, pad=5, join=False, dark=165, thin=0, blur=True):
    x0, x1, y0, y1 = box
    crop = gray[max(0, y0-pad):y1+pad, max(0, x0-pad):x1+pad]
    big = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    if blur: big = cv2.GaussianBlur(big, (3, 3), 0)
    ink = big < dark
    if join: ink = bridge(ink)
    if thin: ink = thin_strokes(ink, thin)
    # potracer traces the False region as foreground
    path = potrace.Bitmap(~ink).trace(turdsize=6, alphamax=1.0, opticurve=True, opttolerance=0.2)
    rows = np.flatnonzero(ink.any(axis=1))
    top = max(0, y0-pad) + (rows[0] / scale if len(rows) else 0)
    return path, (max(0, x0-pad), max(0, y0-pad)), scale, top

def draw(pen, path, origin, scale, ox, oy, k):
    """Image px → font units: x' = (x/scale+ox0-ox)*k, y' = (oy-(y/scale+oy0))*k."""
    ox0, oy0 = origin
    def P(pt): return ((pt.x/scale + ox0 - ox) * k, (oy - (pt.y/scale + oy0)) * k)
    for curve in path:
        pen.moveTo(P(curve.start_point))
        for seg in curve:
            if seg.is_corner: pen.lineTo(P(seg.c)); pen.lineTo(P(seg.end_point))
            else: pen.curveTo(P(seg.c1), P(seg.c2), P(seg.end_point))
        pen.closePath()

def read_sheet(src, print_bands=False):
    """→ {char: (box, baseline_px)}, k (px→units), x-height px, gray image."""
    im = cv2.imread(src['sheet'])
    if im is None: sys.exit('no such sheet: ' + src['sheet'])
    ink, gray = ink_mask(im, src.get('left', 0.04), src.get('dark', 140))
    bs = bands(ink)
    if print_bands:
        for i, b in enumerate(bs): print(f'  band {i}: y {b[0]}-{b[1]} ({b[1]-b[0]}px)')
        return None, None, None, None
    idx = src.get('bands') or list(range(1, 1 + len(src['rows'])))
    glyphs = {}
    gaps = src.get('gap', 3); gaps = gaps if isinstance(gaps, list) else [gaps] * len(src['rows'])
    for chars, bi, gap in zip(src['rows'], idx, gaps):
        y0, y1 = bs[bi]
        boxes = glyph_boxes(ink, max(0, y0-5), y1+5, gap=gap)
        if len(boxes) != len(chars):
            sys.exit(f'{src["sheet"]} row {chars!r}: found {len(boxes)} glyphs, expected {len(chars)}: {[(b[0], b[1]-b[0]) for b in boxes]}')
        base = statistics.median([b[3] for c, b in zip(chars, boxes) if c not in DESCENDERS] or [b[3] for b in boxes])
        for c, b in zip(chars, boxes): glyphs[c] = (b, base)
    caps = [glyphs[c][1] - glyphs[c][0][2] for c in CAP_REF if c in glyphs]
    xs = [glyphs[c][1] - glyphs[c][0][2] for c in X_REF if c in glyphs]
    if caps: k = CAP_HEIGHT / statistics.median(caps)
    elif xs: k = X_HEIGHT / statistics.median(xs)
    else: sys.exit('no letters to scale by')
    xh = statistics.median(xs) * k if xs else X_HEIGHT
    print(f'{os.path.basename(src["sheet"])}: {len(glyphs)} glyphs, k={k:.3f}, x-height {xh:.0f}u')
    return glyphs, k, xh, gray

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('spec'); ap.add_argument('--bands', action='store_true', help='print the ink bands of each sheet and stop')
    a = ap.parse_args()
    spec = json.load(open(a.spec))
    if a.bands:
        for src in spec['sources']: print(src['sheet']); read_sheet(src, True)
        return

    cff, ttg, widths, pasted = {}, {}, {}, {}
    def add(name, gray, box, base, k, join, dark=165, level=None, thin=0, SIDE=SIDE, blur=True):
        path, origin, scale, top = trace(gray, box, join=join, dark=dark, thin=thin, blur=blur)
        # LEVELLING (a typeset sheet): every glyph in a level group is scaled so
        # its top lands where the group's median top lands — at 22px a serif's
        # hairline top is caught on one letter and missed on the next, and the
        # caps came out five different sizes (Sophie: "subtitles are all
        # different sizes"). Uniform scale, so the shape is untouched.
        if level:
            k = k * level / ((base - top) * k)
        x0, x1, y0, y1 = box
        adv = int(round((x1 - x0) * k + 2*SIDE))
        t2 = T2CharStringPen(adv, None); draw(t2, path, origin, scale, x0 - SIDE/k, base, k)
        cff[name] = t2.getCharString()
        tt = TTGlyphPen(None); draw(Cu2QuPen(tt, 1.0), path, origin, scale, x0 - SIDE/k, base, k)
        ttg[name] = tt.glyph(); widths[name] = adv

    base_chars = {}          # char → glyph name
    alts = {}                # char → [alt glyph names]
    xheight = X_HEIGHT
    for si, src in enumerate(spec['sources']):
        glyphs, k, xh, gray = read_sheet(src)
        if si == 0: xheight = xh
        join = set(src.get('join', '')); align = src.get('alignTop', {})
        level = {}   # char → target top height (units) for the glyphs in a level group
        for group in src.get('level', []):
            tops = {}
            for c in group:
                if c in glyphs:
                    _, _, _, top = trace(gray, glyphs[c][0], dark=src.get('traceDark', 165), thin=src.get('thin', 0))
                    tops[c] = (glyphs[c][1] - top) * k
            if tops:
                med = statistics.median(tops.values())
                for c in tops: level[c] = med
        for c, (box, base) in glyphs.items():
            if c in align and align[c] in glyphs: base += box[2] - glyphs[align[c]][0][2]
            if c not in base_chars:
                base_chars[c] = gname(c); add(gname(c), gray, box, base, k, c in join, src.get('traceDark', 165), level.get(c), src.get('thin', 0), src.get('side', SIDE), src.get('blur', True))
                pasted[gname(c)] = (gray, box, base, k, src.get('side', SIDE))
            else:
                n = gname(c) + '.alt%d' % (len(alts.get(c, [])) + 1)
                alts.setdefault(c, []).append(n); add(n, gray, box, base, k, c in join, src.get('traceDark', 165), level.get(c), src.get('thin', 0), src.get('side', SIDE), src.get('blur', True))

    for g in ('.notdef', 'space'):
        sp = spec.get('space', SPACE); widths[g] = sp; cff[g] = T2CharStringPen(sp, None).getCharString(); ttg[g] = TTGlyphPen(None).glyph()
    order = ['.notdef', 'space'] + [base_chars[c] for c in base_chars] + [n for c in alts for n in alts[c]]
    cmap = {32: 'space'}
    for c, n in base_chars.items(): cmap[ord(c)] = n
    for c, to in ALIASES.items():
        if ord(c) not in cmap and to in base_chars: cmap[ord(c)] = base_chars[to]
    if spec.get('lowerToCaps'):
        for c in 'abcdefghijklmnopqrstuvwxyz':
            if ord(c) not in cmap and c.upper() in base_chars: cmap[ord(c)] = base_chars[c.upper()]
    if spec.get('capsToLower'):
        for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
            if ord(c) not in cmap and c.lower() in base_chars: cmap[ord(c)] = base_chars[c.lower()]

    # calt: cycle the alternates. With sets S0 (base) … Sn, a glyph from set i
    # followed by one of the same character set moves it to set i+1 (mod n+1),
    # so a run of letters walks through every drawing before repeating.
    fea = ''
    nalt = max((len(v) for v in alts.values()), default=0)
    if nalt:
        chars = [c for c in alts if len(alts[c]) == nalt]   # only chars every sheet drew
        sets = [[base_chars[c] for c in chars]] + [[alts[c][i] for c in chars] for i in range(nalt)]
        cls = ''.join(f'@s{i} = [{" ".join(s)}];\n' for i, s in enumerate(sets))
        rules = ''.join(f'  sub @s{i} @s{i}\' by @s{(i+1) % (nalt+1)};\n' for i in range(nalt+1))
        all_ = ' '.join(f'@s{i}' for i in range(nalt+1))
        fea = f'{cls}feature calt {{\n  lookup cycle {{\n{rules}  }} cycle;\n}} calt;\n'
        # the lookup fires left to right, so a run reads s0 s1 s2 s0 s1 …

    family = spec['name']; asc, desc = 900, -250
    for fmt in ('otf', 'ttf'):
        fb = FontBuilder(UPM, isTTF=(fmt == 'ttf'))
        fb.setupGlyphOrder(order); fb.setupCharacterMap(cmap)
        if fmt == 'ttf': fb.setupGlyf(ttg)
        else: fb.setupCFF(family.replace(' ', ''), {'FullName': family, 'FamilyName': family}, cff, {})
        metrics = {}
        for g in order:
            if fmt == 'ttf': gl = ttg[g]; lsb = getattr(gl, 'xMin', 0) or 0
            else: bp = BoundsPen(None); cff[g].draw(bp); lsb = int(bp.bounds[0]) if bp.bounds else 0
            metrics[g] = (widths[g], lsb)
        fb.setupHorizontalMetrics(metrics); fb.setupHorizontalHeader(ascent=asc, descent=desc)
        style = spec.get('style', 'Regular')
        fb.setupNameTable({'familyName': family, 'styleName': style, 'uniqueFontIdentifier': f'{family} {style}',
                           'fullName': family if style == 'Regular' else f'{family} {style}',
                           'psName': family.replace(' ', '') + '-' + style.replace(' ', ''), 'version': 'Version 1.0'})
        fb.setupOS2(sTypoAscender=asc, sTypoDescender=desc, sTypoLineGap=0, usWinAscent=asc, usWinDescent=-desc,
                    sxHeight=int(xheight), sCapHeight=CAP_HEIGHT, achVendID='SOPH',
                    fsSelection=(0x40 if style == 'Regular' else 0x01) | 0x80)
        fb.setupPost()
        if fmt == 'ttf': fb.setupMaxp()
        if fea: addOpenTypeFeaturesFromString(fb.font, fea)
        out = f'{spec["out"]}.{fmt}'; fb.save(out)
        print('wrote', out, os.path.getsize(out), 'bytes', f'({len(order)} glyphs, {nalt} alternate sets)')
    if spec.get('paste'):
        paste_font(spec, pasted, order, cmap, widths, family, spec.get('style', 'Regular'), asc, desc, xheight)

def paste_font(spec, entries, order, cmap, widths, family, style, asc, desc, xheight):
    """PASTE, not trace: every glyph carries its own crop of the sheet as a PNG
    (Apple's sbix table — iPhone, Mac, Safari; Chrome reads it too). The paper
    is knocked out to alpha from the grey level, so the ink's weight, edges and
    grain are the sheet's, byte for byte (Sophie: "why can't u paste the
    characters in"). It does not scale past the sheet's own resolution — a
    22px letter drawn at 200px is a soft 22px letter — which is what the vector
    face is for; both are written."""
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(order); fb.setupCharacterMap(cmap)
    fb.setupGlyf({g: TTGlyphPen(None).glyph() for g in order})
    fb.setupHorizontalMetrics({g: (widths[g], 0) for g in order})
    fb.setupHorizontalHeader(ascent=asc, descent=desc)
    fb.setupNameTable({'familyName': family + ' Paste', 'styleName': style, 'uniqueFontIdentifier': f'{family} Paste {style}',
                       'fullName': family + ' Paste' if style == 'Regular' else f'{family} Paste {style}',
                       'psName': family.replace(' ', '') + 'Paste-' + style.replace(' ', ''), 'version': 'Version 1.0'})
    fb.setupOS2(sTypoAscender=asc, sTypoDescender=desc, sTypoLineGap=0, usWinAscent=asc, usWinDescent=-desc, sxHeight=int(xheight), sCapHeight=CAP_HEIGHT, achVendID='SOPH')
    fb.setupPost(); fb.setupMaxp()
    # one strike per sheet scale: ppem = px per em on that sheet
    strikes = {}
    for name, (gray, box, base, k, side) in entries.items():
        ppem = int(round(UPM / k))
        x0, x1, y0, y1 = box
        crop = gray[y0:y1, x0:x1].astype(np.float32)
        paper = float(np.percentile(gray, 90)); black = float(max(0, min(np.percentile(crop, 2), 60)))
        alpha = np.clip((paper - crop) / (paper - black), 0, 1)
        rgba = np.zeros((crop.shape[0], crop.shape[1], 4), np.uint8); rgba[..., 3] = (alpha * 255).astype(np.uint8)
        buf = io.BytesIO(); Image.fromarray(rgba, 'RGBA').save(buf, 'PNG')
        st = strikes.setdefault(ppem, Strike(ppem=ppem, resolution=72))
        g = SbixGlyph(glyphName=name, graphicType='png ', imageData=buf.getvalue(),
                      originOffsetX=int(round(side / k)), originOffsetY=int(round(base - y1)))
        st.glyphs[name] = g
    sbix = table__s_b_i_x(); sbix.version = 1; sbix.flags = 1; sbix.strikes = strikes
    for st in strikes.values():
        for g in order:
            if g not in st.glyphs: st.glyphs[g] = SbixGlyph(glyphName=g)
    fb.font['sbix'] = sbix
    out = f'{spec["out"]}-paste.ttf'; fb.save(out)
    print('wrote', out, os.path.getsize(out), 'bytes', f'(pasted, {len(strikes)} strike)')

if __name__ == '__main__':
    main()
