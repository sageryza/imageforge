"""Build the PWC Training Film audio bed: narration + period music + projector.

  python3 scripts/pwc-film-audio.py            # writes mix.wav

Expects, relative to the working directory:
  vo/    narration from scripts/pwc-film-vo.sh
  mus/   A-head.wav B-bed.wav C-bed.wav D-sting.wav, cut from the Coronet
         title sequences named in docs/pwc-training-film-reel.md
Set FFMPEG to a binary if ffmpeg is not on PATH.

The offsets below ARE the edit — keep them in step with the card lengths in
scripts/pwc-film-build.sh."""
import subprocess, os
FF = os.environ.get("FFMPEG", "ffmpeg")
TOTAL = 123.25

VO = [  # (file, start)
    ("vo/01-title.mp3",       3.80),
    ("vo/02-mistake.mp3",    12.60),
    ("vo/03-t1.mp3",         31.00),
    ("vo/04-t2.mp3",         45.40),
    ("vo/05a-watcher.mp3",   62.30),
    ("vo/05b-friend.mp3",    65.07),
    ("vo/06-eyecontact.mp3", 70.55),
    ("vo/07-graduation.mp3", 94.55),
]
# faint period bed, pieces sequenced so nothing loops audibly
BED = [("mus/B-bed.wav",12.0),("mus/C-bed.wav",32.5),("mus/B-bed.wav",53.0),("mus/C-bed.wav",73.5)]

ins, fc, mixl = [], [], []
n = 0
def add(path):
    global n
    ins.extend(["-i", path]); n += 1; return n-1

# narration
for path, st in VO:
    i = add(path)
    fc.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=stereo,"
              f"adelay={int(st*1000)}|{int(st*1000)},volume=1.0[v{i}]")
    mixl.append(f"[v{i}]")

# head music: full under the countdown/title, ducked once narration starts
i = add("mus/A-head.wav")
fc.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=stereo,"
          f"volume='if(lt(t,3.3),0.62,if(lt(t,4.6),0.62-0.48*(t-3.3)/1.3,0.14))':eval=frame,"
          f"afade=t=in:st=0:d=0.5,afade=t=out:st=12.6:d=2.4,"
          f"adelay=0|0[v{i}]")
mixl.append(f"[v{i}]")

# faint bed
for path, st in BED:
    i = add(path)
    fc.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=stereo,volume=0.075,"
              f"afade=t=in:st=0:d=2.5,afade=t=out:st=17.5:d=3.0,"
              f"adelay={int(st*1000)}|{int(st*1000)}[v{i}]")
    mixl.append(f"[v{i}]")

# closing sting, swelling under "notice things"
i = add("mus/D-sting.wav")
fc.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=stereo,volume=0.55,"
          f"afade=t=in:st=0:d=1.2,afade=t=out:st=5.6:d=1.4,"
          f"adelay=116300|116300[v{i}]")
mixl.append(f"[v{i}]")

# projector: tape hiss + motor rumble with shutter flutter
fc.append(f"anoisesrc=c=pink:a=0.9:d={TOTAL}:r=44100,aformat=channel_layouts=stereo,"
          f"highpass=f=2000,lowpass=f=8500,volume=0.05[hiss]")
fc.append(f"anoisesrc=c=brown:a=0.9:d={TOTAL}:r=44100,aformat=channel_layouts=stereo,"
          f"lowpass=f=95,tremolo=f=24:d=0.35,volume=0.10[motor]")
mixl += ["[hiss]", "[motor]"]

fc.append("".join(mixl) + f"amix=inputs={len(mixl)}:normalize=0:dropout_transition=0,"
          f"alimiter=limit=0.95,atrim=0:{TOTAL},aformat=channel_layouts=stereo[out]")

cmd = [FF, "-y"] + ins + ["-filter_complex", ";".join(fc), "-map", "[out]",
       "-c:a", "pcm_s16le", "mix.wav", "-loglevel", "error"]
subprocess.run(cmd, check=True)
print("wrote mix.wav")
