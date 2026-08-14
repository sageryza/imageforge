import subprocess, glob, os, sys, struct, math
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()

def frames(path, w=96, h=144, fps=4):
    # decode to tiny grayscale raw frames
    cmd=[FF,'-v','error','-i',path,'-vf',f'fps={fps},scale={w}:{h},format=gray','-f','rawvideo','-']
    out=subprocess.run(cmd,capture_output=True).stdout
    n=w*h
    return [out[i*n:(i+1)*n] for i in range(len(out)//n)]

def mad(a,b):
    return sum(abs(a[i]-b[i]) for i in range(len(a)))/len(a)

rows=[]
for f in sorted(glob.glob('clips/*.mp4')):
    fr=frames(f)
    if len(fr)<2: continue
    inter=[mad(fr[i],fr[i+1]) for i in range(len(fr)-1)]
    rows.append((os.path.basename(f)[:-4], sum(inter)/len(inter), max(inter), mad(fr[0],fr[-1]), len(fr)))
rows.sort(key=lambda r:-r[3])
print(f"{'clip':40s} {'mean/frame':>10s} {'peak':>7s} {'first→last':>10s} {'frames':>6s}")
for r in rows:
    print(f"{r[0]:40s} {r[1]:10.2f} {r[2]:7.2f} {r[3]:10.2f} {r[4]:6d}")
