"""Render each card as ONE continuously-moving camera shot.

v3 hard-cut between framings. Sophie asked for the Chicago reel's move instead:
"they show the full page and then they zoom in on certain areas and you can see
the zoom." So each card is a single zoompan path over a pre-built 9:16 PAGE
(blurred backdrop + the card fitted into it) — full page first, then a visible
push into each area as its beat lands.

The page is rendered at 2x the output so zoompan's integer x/y stepping lands on
half-output-pixels; at 1x a slow push visibly stair-steps.
"""
import json, os, struct, subprocess
import shots

FF = os.environ.get("FFMPEG", "ffmpeg")
OUT = "seg4"; os.makedirs(OUT, exist_ok=True); os.makedirs("pages", exist_ok=True)
W, H, FPS = 1080, 1920, 30
PW, PH = W*2, H*2          # the page
BOX_W, BOX_H = 1080*2, 1800*2
MAX_UP = 2.45              # upscale ceiling on the ORIGINAL card pixels
MOVE   = 0.90              # how long a move takes
LEADIN = 0.35              # a move starts this far before its beat, so it ARRIVES on the word

def png_size(p): return struct.unpack(">II", open(p,"rb").read(33)[16:24])
def even(x): return max(2, int(round(x/2))*2)

vod = json.load(open("vodur.json"))
TEMPO = shots.BEAT_TEMPO

manifest = []
for fname, clip, lead, tail, shotlist in shots.CARDS:
    src = os.path.join("cards", fname)
    cw, ch = png_size(src)
    # --- the page: blurred backdrop + the card fitted, at 2x ---
    page = f"pages/{fname}"
    fit = min(BOX_W/cw, BOX_H/ch)
    fw, fh = even(cw*fit), even(ch*fit)
    subprocess.run([FF,"-y","-i",src,"-filter_complex",
        f"[0:v]scale={PW}:{PH}:force_original_aspect_ratio=increase,crop={PW}:{PH},"
        f"boxblur=84:2,eq=brightness=-0.16:saturation=0.5[bg];"
        f"[0:v]scale={fw}:{fh}:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[v]",
        "-map","[v]","-frames:v","1",page,"-loglevel","error"], check=True)
    cx0, cy0 = (PW-fw)/2, (PH-fh)/2          # where the card sits on the page
    U0 = fw/cw                                # page upscale of the card

    # --- beats rescaled from the tempo they were measured at to this render's ---
    ratio = vod["old"][clip] / vod["new"][clip]
    dur = round(lead + vod["new"][clip] + tail, 3)

    states, widened = [], []
    for (fx0, fy0, fx1, fy1, beat, label) in shotlist:
        rx, ry = cx0 + fx0*fw, cy0 + fy0*fh
        rw, rh = (fx1-fx0)*fw, (fy1-fy0)*fh
        z = min(PW/rw, PH/rh)
        up = (z/2) * U0 * 1.0                 # output px per ORIGINAL card px
        if up > MAX_UP:                       # widen around the centre
            z = MAX_UP*2/U0
            widened.append(label)
        z = max(1.0, z)                       # never below the full page
        vw, vh = PW/z, PH/z
        px = min(max(rx+rw/2 - vw/2, 0), PW-vw)
        py = min(max(ry+rh/2 - vh/2, 0), PH-vh)
        t = lead + beat*ratio                 # arrival time inside the card
        states.append({"t": max(0.0, t), "z": z,
                       "cx": (px+vw/2)/PW, "cy": (py+vh/2)/PH, "label": label})

    # --- build the piecewise path: hold, then ease into the next state ---
    def expr(key, mk):
        parts = []
        for i in range(1, len(states)):
            a, b = states[i-1], states[i]
            t0 = max(a["t"], b["t"] - LEADIN)
            t1 = min(b["t"] + (MOVE - LEADIN), dur)
            # a move must be long enough to READ as a move — she asked to see
            # the zoom. Steal from the front before letting it get shorter.
            if t1 - t0 < 0.45:
                t0 = max(a["t"], t1 - 0.45)
                if t1 - t0 < 0.25: t1 = min(dur, t0 + 0.25)
            # smoothstep so a move accelerates and settles instead of snapping
            p = f"(clip((on/{FPS}-{t0:.3f})/{t1-t0:.3f},0,1))"
            s = f"({p}*{p}*(3-2*{p}))"
            parts.append((t1, f"({mk(a)}+({mk(b)}-{mk(a)})*{s})"))
        e = mk(states[-1])
        for t1, seg in reversed(parts):
            e = f"if(lt(on/{FPS},{t1:.3f}),{seg},{e})"
        return e

    zt  = expr("z",  lambda s: f"{s['z']:.5f}")
    cxt = expr("cx", lambda s: f"{s['cx']:.6f}")
    cyt = expr("cy", lambda s: f"{s['cy']:.6f}")
    # zoompan wants the window's top-left in INPUT pixels
    xe = f"clip(({cxt})*{PW}-({PW}/zoom)/2,0,{PW}-{PW}/zoom)"
    ye = f"clip(({cyt})*{PH}-({PH}/zoom)/2,0,{PH}-{PH}/zoom)"
    n = int(round(dur*FPS))
    out = f"{OUT}/{fname.split('-')[0]}.mp4"
    subprocess.run([FF,"-y","-i",page,"-vf",
        f"zoompan=z='{zt}':x='{xe}':y='{ye}':d={n}:s={W}x{H}:fps={FPS},format=yuv420p",
        "-frames:v",str(n),"-c:v","libx264","-crf","16","-preset","medium",
        out,"-loglevel","error"], check=True)
    manifest.append({"file": out, "dur": dur, "clip": clip, "lead": lead,
                     "vo": vod["new"][clip], "shots": len(states)})
    print(f"{out}  {dur:6.2f}s  {len(states):2d} moves  "
          f"z {min(s['z'] for s in states):.2f}-{max(s['z'] for s in states):.2f}"
          + (f"   widened: {widened}" if widened else ""))

json.dump(manifest, open("cards4.json","w"), indent=1)
print("\ncards total %.2fs"%sum(m["dur"] for m in manifest))
