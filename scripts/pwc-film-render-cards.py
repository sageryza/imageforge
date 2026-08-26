"""Render each card as ONE continuously-moving camera shot, with hand-drawn
markup that draws itself on over whatever the line is about.

The markup lives in PAGE space and is composited BEFORE the camera, so a circle
zooms and drifts with the thing it is circling instead of floating over the
frame. The page is 2x the output because zoompan rounds x/y to whole input
pixels — at 1x a slow push visibly stair-steps.
"""
import json, os, struct, subprocess
import shots, marks, ink

FF = os.environ.get("FFMPEG", "ffmpeg")
OUT = "seg7"; os.makedirs(OUT, exist_ok=True)
for d in ("pages", "ann"): os.makedirs(d, exist_ok=True)
W, H, FPS = 1080, 1920, 30
PW, PH = W*2, H*2
BOX_W, BOX_H = 1080*2, 1800*2
MAX_UP, MOVE, LEADIN = 2.45, 0.90, 0.35
INK_W = 15          # stroke at page scale — thinner, her ask

def png_size(p): return struct.unpack(">II", open(p,"rb").read(33)[16:24])
def even(x): return max(2, int(round(x/2))*2)

vod = json.load(open("vodur.json"))
manifest = []
for fname, clip, lead, tail, shotlist in shots.CARDS:
    src = os.path.join("cards", fname)
    cw, ch = png_size(src)
    page = f"pages/{fname}"
    fit = min(BOX_W/cw, BOX_H/ch)
    fw, fh = even(cw*fit), even(ch*fit)
    subprocess.run([FF,"-y","-i",src,"-filter_complex",
        f"[0:v]scale={PW}:{PH}:force_original_aspect_ratio=increase,crop={PW}:{PH},"
        f"boxblur=84:2,eq=brightness=-0.16:saturation=0.5[bg];"
        f"[0:v]scale={fw}:{fh}:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[v]",
        "-map","[v]","-frames:v","1",page,"-loglevel","error"], check=True)
    cx0, cy0 = (PW-fw)/2, (PH-fh)/2
    U0 = fw/cw
    ratio = vod["old"][clip] / vod["new"][clip]
    dur = round(lead + vod["new"][clip] + tail, 3)

    # ---- the markup for this card, drawn in PAGE coordinates ----
    anns = []
    for kind, g, beat, seed, label in marks.MARKS.get(fname, []):
        if kind == "circle":
            u, v, ru, rv = g
            pts = ink.ellipse_pts(cx0+u*fw, cy0+v*fh, ru*fw, rv*fh, seed)
        else:
            u0, v0, u1, v1 = g
            pts = ink.arrow_pts(cx0+u0*fw, cy0+v0*fh, cx0+u1*fw, cy0+v1*fh, seed)
        ax, ay, aw, ah = ink.render(pts, ink.WHITE, INK_W, f"ann/{seed}")
        anns.append({"seed": seed, "x": ax, "y": ay,
                     "t": round(lead + beat*ratio, 3), "label": label})

    # ---- states ----
    states = []
    for (fx0, fy0, fx1, fy1, beat, label) in shotlist:
        rx, ry = cx0+fx0*fw, cy0+fy0*fh
        rw, rh = (fx1-fx0)*fw, (fy1-fy0)*fh
        z = min(PW/rw, PH/rh)
        if (z/2)*U0 > MAX_UP: z = MAX_UP*2/U0
        z = max(1.0, z)
        vw, vh = PW/z, PH/z
        px = min(max(rx+rw/2-vw/2, 0), PW-vw)
        py = min(max(ry+rh/2-vh/2, 0), PH-vh)
        states.append({"t": max(0.0, lead+beat*ratio), "z": z,
                       "cx": (px+vw/2)/PW, "cy": (py+vh/2)/PH})

    def expr(mk):
        parts = []
        for i in range(1, len(states)):
            a, b = states[i-1], states[i]
            t0 = max(a["t"], b["t"]-LEADIN)
            t1 = min(b["t"]+(MOVE-LEADIN), dur)
            if t1-t0 < 0.45:
                t0 = max(a["t"], t1-0.45)
                if t1-t0 < 0.25: t1 = min(dur, t0+0.25)
            p = f"(clip((on/{FPS}-{t0:.3f})/{t1-t0:.3f},0,1))"
            s = f"({p}*{p}*(3-2*{p}))"
            parts.append((t1, f"({mk(a)}+({mk(b)}-{mk(a)})*{s})"))
        e = mk(states[-1])
        for t1, seg in reversed(parts):
            e = f"if(lt(on/{FPS},{t1:.3f}),{seg},{e})"
        return e
    zt  = expr(lambda s: f"{s['z']:.5f}")
    cxt = expr(lambda s: f"{s['cx']:.6f}")
    cyt = expr(lambda s: f"{s['cy']:.6f}")
    xe = f"clip(({cxt})*{PW}-({PW}/zoom)/2,0,{PW}-{PW}/zoom)"
    ye = f"clip(({cyt})*{PH}-({PH}/zoom)/2,0,{PH}-{PH}/zoom)"

    n = int(round(dur*FPS))
    ins = ["-loop","1","-t",str(dur),"-r",str(FPS),"-i",page]
    fc, last = [], "[0:v]"
    fc.append(f"[0:v]format=rgba[b0]"); last = "[b0]"
    for i, a in enumerate(anns, start=1):
        ins += ["-framerate",str(FPS),"-i",f"ann/{a['seed']}/%03d.png"]
        fc.append(f"[{i}:v]format=rgba,"
                  f"tpad=start_duration={a['t']}:start_mode=add:color=0x00000000,"
                  f"tpad=stop_mode=clone:stop_duration=600[a{i}]")
        fc.append(f"{last}[a{i}]overlay={a['x']}:{a['y']}:format=auto[b{i}]")
        last = f"[b{i}]"
    fc.append(f"{last}zoompan=z='{zt}':x='{xe}':y='{ye}':d=1:s={W}x{H}:fps={FPS},"
              f"format=yuv420p[v]")
    out = f"{OUT}/{fname.split('-')[0]}.mp4"
    subprocess.run([FF,"-y"]+ins+["-filter_complex",";".join(fc),"-map","[v]",
        "-frames:v",str(n),"-c:v","libx264","-crf","16","-preset","medium",
        out,"-loglevel","error"], check=True)
    manifest.append({"file": out, "dur": dur, "clip": clip, "lead": lead,
                     "vo": vod["new"][clip], "marks": [a["label"] for a in anns]})
    print(f"{out}  {dur:6.2f}s  {len(states):2d} moves  {len(anns)} marks  {[a['label'] for a in anns]}")
json.dump(manifest, open("cards7.json","w"), indent=1)
print("\ncards total %.2fs"%sum(m["dur"] for m in manifest))
