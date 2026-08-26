"""Hand-drawn markup — sloppy circles and arrows that draw themselves on.

Sophie: "maybe draw some sloppy circles over what you're talking about in white
or red ink". Everything here is deterministic (seeded per annotation) so a
re-render produces the identical stroke; nothing may wobble differently between
takes of the same film.
"""
import math, os
from PIL import Image, ImageDraw

PAD = 90            # room for the stroke to wander outside the target box
STAGES = 14         # frames in the draw-on
RED   = (196, 48, 34)
WHITE = (245, 242, 236)

def _rng(seed):
    s = seed & 0xFFFFFFFF
    def nxt():
        nonlocal s
        s = (1103515245*s + 12345) & 0x7FFFFFFF
        return s / 0x7FFFFFFF
    return nxt

def ellipse_pts(cx, cy, rx, ry, seed, turns=1.04, tilt=None):
    """A circle drawn quickly by hand: round, slightly off, ends just crossing.

    Sophie: "just like a bad circle not like a weird shape" — so the wobble is
    small and low-frequency (it reads as an unsteady hand), the loop closes
    almost exactly once instead of spiralling round again, and the radius does
    not taper. An earlier version overshot 1.14 turns with 3 large wobbles and
    came out as a shape rather than a circle.
    """
    r = _rng(seed)
    a0 = r()*6.283
    if tilt is None: tilt = (r()-0.5)*0.5
    # two gentle wobbles only, and shallow ones
    w = [(0.018+0.016*r(), 2, r()*6.283), (0.012+0.012*r(), 3, r()*6.283)]
    # a hand-drawn circle is rarely perfectly round: bias one axis a little
    sx, sy = 1.0+(r()-0.5)*0.07, 1.0+(r()-0.5)*0.07
    n, pts = 170, []
    for i in range(n+1):
        t = i/n*turns*6.283 + a0
        k = 1.0 + sum(a*math.sin(f*t+p) for a, f, p in w)
        x, y = rx*k*sx*math.cos(t), ry*k*sy*math.sin(t)
        xr = x*math.cos(tilt) - y*math.sin(tilt)
        yr = x*math.sin(tilt) + y*math.cos(tilt)
        pts.append((cx+xr, cy+yr))
    return pts

def line_pts(x0, y0, x1, y1, seed):
    """A plain hand-drawn stroke, no head — an underline, or a traced
    sightline. Gentler bow than the arrow shaft: an underline that bows 5% of
    its own length climbs into the words it is underlining."""
    r = _rng(seed)
    n, pts = 60, []
    dx, dy = x1-x0, y1-y0
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy/L, dx/L
    # Bow stays UNDER ±0.6% of the length: the NOTICE THINGS underline lives
    # in a ~12px channel between the baseline and its box edge, and the first
    # cut's ±2% bow climbed into the letters — it read as a strike-through.
    bow = (r()-0.5)*0.012*L
    for i in range(n+1):
        t = i/n
        off = bow*math.sin(math.pi*t) + (r()-0.5)*1.5
        pts.append((x0+dx*t+nx*off, y0+dy*t+ny*off))
    return pts

def arrow_pts(x0, y0, x1, y1, seed):
    """A wobbly shaft plus a two-stroke head. Returned as one path so the
    draw-on reaches the head last, the way a hand would."""
    r = _rng(seed)
    n, pts = 60, []
    dx, dy = x1-x0, y1-y0
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy/L, dx/L
    bow = (r()-0.5)*0.10*L          # a drawn line is never straight
    for i in range(n+1):
        t = i/n
        off = bow*math.sin(math.pi*t) + (r()-0.5)*2.5
        pts.append((x0+dx*t+nx*off, y0+dy*t+ny*off))
    ang = math.atan2(dy, dx)
    hl = max(26, 0.20*L)
    for s in (+1, -1):
        a = ang + math.pi + s*0.42
        head = [(x1, y1)]
        for i in range(1, 9):
            t = i/8
            head.append((x1+math.cos(a)*hl*t + (r()-0.5)*3,
                         y1+math.sin(a)*hl*t + (r()-0.5)*3))
        pts += head
    return pts

def render(pts, colour, width, out_dir, stages=STAGES):
    """Write `stages` PNGs, each showing more of the stroke. Returns
    (x, y, w, h) of the canvas in the same space the points were given in."""
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    x0, y0 = int(min(xs)-PAD), int(min(ys)-PAD)
    w, h = int(max(xs)-min(xs)+2*PAD), int(max(ys)-min(ys)+2*PAD)
    local = [(p[0]-x0, p[1]-y0) for p in pts]
    os.makedirs(out_dir, exist_ok=True)
    for s in range(stages):
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        k = max(2, int(len(local)*(s+1)/stages))
        seg = local[:k]
        # ONE solid pass. Overlapping passes at partial alpha read as a faded
        # double-stroke, which is what she was seeing.
        d.line(seg, fill=colour+(255,), width=int(width), joint="curve")
        img.save(os.path.join(out_dir, f"{s:03d}.png"))
    return x0, y0, w, h
