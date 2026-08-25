import os, struct, subprocess
import shots
FF = os.environ.get("FFMPEG", "ffmpeg")
OUT = "seg3"; os.makedirs(OUT, exist_ok=True)
W_OUT, H_OUT, FPS = 1080, 1920, 30
BOX_W, BOX_H = 1080, 1800
OVER   = 1.05   # headroom the slow drift lives in
MAX_UP = 2.45   # hard ceiling on upscale — past this the grain turns to mush

def png_size(p):
    return struct.unpack(">II", open(p,"rb").read(33)[16:24])
def even(x): return max(2, int(round(x/2))*2)

idx, segs, widened = 0, [], []
for fname, card_dur, shotlist in shots.CARDS:
    path = os.path.join("cards", fname)
    W, H = png_size(path)
    prev = 0.0
    for (fx0, fy0, fx1, fy1, end, label) in shotlist:
        dur = round(end - prev, 3); prev = end
        rx, ry = fx0*W, fy0*H
        rw, rh = (fx1-fx0)*W, (fy1-fy0)*H
        # widen anything that would upscale past the ceiling, around its centre
        fit = min(BOX_W/rw, BOX_H/rh)
        if fit > MAX_UP:
            g = fit/MAX_UP
            cx, cy = rx+rw/2, ry+rh/2
            nw, nh = min(W, rw*g), min(H, rh*g)
            rx, ry = min(max(cx-nw/2,0), W-nw), min(max(cy-nh/2,0), H-nh)
            rw, rh = nw, nh
            widened.append((label, round(fit,2), round(min(BOX_W/rw,BOX_H/rh),2)))
            fit = min(BOX_W/rw, BOX_H/rh)
        # open the rect out by OVER so the drift has somewhere to travel
        ow, oh = min(W, rw*OVER), min(H, rh*OVER)
        ox = min(max(rx-(ow-rw)/2, 0), W-ow)
        oy = min(max(ry-(oh-rh)/2, 0), H-oh)
        fw, fh = even(rw*fit), even(rh*fit)
        sw, sh = even(ow*fit), even(oh*fit)
        mdx, mdy = max(0, sw-fw), max(0, sh-fh)
        d = 1 if idx % 2 == 0 else -1
        x0, x1 = (0.0, 1.0) if d > 0 else (1.0, 0.0)
        y0, y1 = (0.3, 0.7) if d > 0 else (0.7, 0.3)
        fc = (
          f"[0:v]scale={W_OUT}:{H_OUT}:force_original_aspect_ratio=increase,"
          f"crop={W_OUT}:{H_OUT},boxblur=42:2,eq=brightness=-0.16:saturation=0.5[bg];"
          f"[0:v]crop={even(ow)}:{even(oh)}:{int(ox)}:{int(oy)},"
          f"scale={sw}:{sh}:flags=lanczos,"
          f"crop={fw}:{fh}:x='{mdx}*({x0}+({x1}-{x0})*min(1,t/{dur}))'"
          f":y='{mdy}*({y0}+({y1}-{y0})*min(1,t/{dur}))'[fg];"
          f"[bg][fg]overlay=(W-w)/2:(H-h)/2,fps={FPS},format=yuv420p[v]"
        )
        out = f"{OUT}/{idx:02d}.mp4"
        subprocess.run([FF,"-y","-loop","1","-t",str(dur),"-i",path,
            "-filter_complex",fc,"-map","[v]","-an","-c:v","libx264",
            "-crf","16","-preset","medium",out,"-loglevel","error"], check=True)
        segs.append(out)
        print(f"{idx:02d} {dur:5.2f}s  up{fit:4.2f}  {fw}x{fh}  {label}")
        idx += 1
with open("concat3.txt","w") as f:
    for s in segs: f.write(f"file '{s}'\n")
print(f"\n{len(segs)} shots; {len(widened)} widened to respect the {MAX_UP}x ceiling:")
for w in widened: print('   ', w)
