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

def ellipse_pts(cx, cy, rx, ry, seed, turns=1.14, tilt=0.0):
    """A circle drawn by hand: it overshoots, and the radius breathes."""
    r = _rng(seed)
    a0 = r()*6.283
    # three low-frequency wobbles — enough to read as human, never as a scribble
    w = [(0.06+0.05*r(), 2+int(3*r()), r()*6.283) for _ in range(3)]
    n, pts = 190, []
    for i in range(n+1):
        t = i/n*turns*6.283 + a0
        k = 1.0 + sum(a*math.sin(f*t+p) for a, f, p in w)
        # a hand tightens slightly as it comes round again
        k *= 1.0 - 0.05*(i/n)
        x, y = rx*k*math.cos(t), ry*k*math.sin(t)
        xr = x*math.cos(tilt) - y*math.sin(tilt)
        yr = x*math.sin(tilt) + y*math.cos(tilt)
        pts.append((cx+xr, cy+yr))
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
        # three passes at slightly different offsets/alpha = ink, not a vector
        for ox, oy, a, ww in ((0, 0, 235, width),
                              (1.2, -0.8, 120, max(1, width-3)),
                              (-1.0, 1.1, 90, max(1, width-4))):
            d.line([(x+ox, y+oy) for x, y in seg],
                   fill=colour+(a,), width=int(ww), joint="curve")
        img.save(os.path.join(out_dir, f"{s:03d}.png"))
    return x0, y0, w, h
