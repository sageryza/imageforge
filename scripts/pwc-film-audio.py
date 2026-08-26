"""PWC Training Film audio: narration + period music bed + projector.

Card offsets are READ from timing4.json, which the card renderer measures off
the real encoded segments, so the voice cannot drift from the picture.
"""
import json, os, subprocess
FF = os.environ.get("FFMPEG", "ffmpeg")
T = json.load(open("timing4.json"))
S = {int(k): v for k, v in T["starts"].items()}
C = T["cards"]; TOTAL = T["total"]
VOD = "vof2"

VO = []
for i, c in enumerate(C):
    if c["clip"] == "05b-friend":
        # the friend card: the whisper lands first, then the narrator answers
        VO.append((f"{VOD}/05a-watcher.mp3", S[i] + c["lead"] - 2.54))
    VO.append((f"{VOD}/{c['clip']}.mp3", S[i] + c["lead"]))

FIRST = S[1]                      # the bed starts with the first content card
STING = TOTAL - 6.6               # swells under "notice things", runs to black
# Spaced 15s, NOT the pieces' full 20.5s: a piece starts fading at 17.5, so at
# 20s spacing every handover dipped to -61dB — an audible hole at each seam.
BED, t = [], FIRST
while t < STING - 6:
    BED.append(("mus/B-bed.wav" if len(BED) % 2 == 0 else "mus/C-bed.wav", t,
                17.5 if t + 20.5 < STING else max(4.0, STING - t - 3.0)))
    t += 15.0

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
          f"adelay={int(STING*1000)}|{int(STING*1000)}[v{i}]"); mixl.append(f"[v{i}]")
fc.append(f"anoisesrc=c=pink:a=0.9:d={TOTAL}:r=44100,aformat=channel_layouts=stereo,"
          f"highpass=f=2000,lowpass=f=8500,volume=0.05[hiss]")
fc.append(f"anoisesrc=c=brown:a=0.9:d={TOTAL}:r=44100,aformat=channel_layouts=stereo,"
          f"lowpass=f=95,tremolo=f=24:d=0.35,volume=0.10[motor]")
mixl += ["[hiss]", "[motor]"]
fc.append("".join(mixl) + f"amix=inputs={len(mixl)}:normalize=0:dropout_transition=0,"
          f"alimiter=limit=0.95,atrim=0:{TOTAL}[out]")
subprocess.run([FF,"-y"]+ins+["-filter_complex",";".join(fc),"-map","[out]",
                "-c:a","pcm_s16le","mix4.wav","-loglevel","error"], check=True)
print("wrote mix4.wav  total %.2f  sting %.2f"%(TOTAL, STING))
for p, st in VO: print(f"  {st:7.2f}  {os.path.basename(p)}")
print("  bed:", [(os.path.basename(b[0])[0], round(b[1],1), round(b[2],1)) for b in BED])
