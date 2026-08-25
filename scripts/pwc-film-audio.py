"""PWC Training Film audio: narration + period music bed + projector.

Card offsets are READ from timing.json, which render_shots.py measures off the
real encoded segments — so the voice can never drift from the picture the way
it would if both sides hard-coded the same intended numbers.
"""
import json, os, subprocess
FF = os.environ.get("FFMPEG", "ffmpeg")
T = json.load(open("timing.json")); S = {int(k): v for k, v in T["starts"].items()}
TOTAL = T["total"]

# (file, absolute start). +0.5 into its card, except the friend card, which
# opens wide for 1.4s and then holds a beat between the whisper and the reply.
VO = [
    ("vof/01-title.mp3",       S[0] + 0.50),
    ("vof/02-mistake.mp3",     S[1] + 0.50),
    ("vof/03-t1.mp3",          S[2] + 0.50),
    ("vof/04-t2.mp3",          S[3] + 0.50),
    ("vof/05a-watcher.mp3",    S[4] + 1.40),
    ("vof/05b-friend.mp3",     S[4] + 3.94),
    ("vof/06-eyecontact.mp3",  S[5] + 0.50),
    ("vof/07-graduation.mp3",  S[6] + 0.50),
]
# The bed runs CONTINUOUSLY from the title to the closing sting. v2 stopped it
# at 94s and left ~22s of the graduation card carrying only hiss — Sophie heard
# the hole and asked whether it was deliberate. It was not.
# (file, start, fade-out start within the piece)
# Spaced 15s, NOT the pieces' full 20.5s: a piece's fade-out begins at 17.5,
# so the next must be fully up by then or the handover dips to near-silence.
# At 20s spacing that measured -61dB twice — an audible hole at every seam.
BED = [("mus/B-bed.wav", 11.0, 17.5), ("mus/C-bed.wav", 26.0, 17.5),
       ("mus/B-bed.wav", 41.0, 17.5), ("mus/C-bed.wav", 56.0, 17.5),
       ("mus/B-bed.wav", 71.0, 17.5), ("mus/C-bed.wav", 86.0, 17.5)]
STING_AT = 103.8

ins, fc, mixl, n = [], [], [], 0
def add(p):
    global n
    ins.extend(["-i", p]); n += 1; return n - 1

for path, st in VO:
    i = add(path)
    fc.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=stereo,"
              f"adelay={int(st*1000)}|{int(st*1000)}[v{i}]"); mixl.append(f"[v{i}]")

i = add("mus/A-head.wav")
fc.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=stereo,"
          f"volume='if(lt(t,3.3),0.62,if(lt(t,4.6),0.62-0.48*(t-3.3)/1.3,0.14))':eval=frame,"
          f"afade=t=in:st=0:d=0.5,afade=t=out:st=12.6:d=2.4[v{i}]"); mixl.append(f"[v{i}]")

for path, st, fo in BED:
    i = add(path)
    fc.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=stereo,volume=0.075,"
              f"afade=t=in:st=0:d=2.5,afade=t=out:st={fo}:d=3.0,"
              f"adelay={int(st*1000)}|{int(st*1000)}[v{i}]"); mixl.append(f"[v{i}]")

i = add("mus/D-sting.wav")
fc.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=stereo,volume=0.55,"
          f"afade=t=in:st=0:d=1.2,afade=t=out:st=5.6:d=1.4,"
          f"adelay={int(STING_AT*1000)}|{int(STING_AT*1000)}[v{i}]"); mixl.append(f"[v{i}]")

fc.append(f"anoisesrc=c=pink:a=0.9:d={TOTAL}:r=44100,aformat=channel_layouts=stereo,"
          f"highpass=f=2000,lowpass=f=8500,volume=0.05[hiss]")
fc.append(f"anoisesrc=c=brown:a=0.9:d={TOTAL}:r=44100,aformat=channel_layouts=stereo,"
          f"lowpass=f=95,tremolo=f=24:d=0.35,volume=0.10[motor]")
mixl += ["[hiss]", "[motor]"]
fc.append("".join(mixl) + f"amix=inputs={len(mixl)}:normalize=0:dropout_transition=0,"
          f"alimiter=limit=0.95,atrim=0:{TOTAL}[out]")
subprocess.run([FF,"-y"]+ins+["-filter_complex",";".join(fc),"-map","[out]",
                "-c:a","pcm_s16le","mix3.wav","-loglevel","error"], check=True)
print("wrote mix3.wav")
for p, st in VO: print(f"  {st:7.2f}  {os.path.basename(p)}")
