import subprocess, os, json, math
FF='/home/user/imageforge/node_modules/ffmpeg-static/ffmpeg'
FP='/home/user/imageforge/node_modules/ffprobe-static/bin/linux/x64/ffprobe'
M='/root/.claude/uploads/4cd68f55-e85c-5f19-a4e7-e11874ba9625/26e93833-17th_St_205.m4a'
os.chdir('/tmp/claude-0/-home-user/4cd68f55-e85c-5f19-a4e7-e11874ba9625/scratchpad')
os.makedirs('tight', exist_ok=True)

# beat = (name, clipfile_or_None, still_or_None, [ (start,end), ... ])
BEATS=[
 ('wallet',   None, 'clips/cf-wallet.png',   [(9.4,14.3),(23.8,26.9)]),
 ('wired',    'clips/1-wired.mp4', None,      [(43.0,51.5)]),
 ('highway',  'clips/2-highway.mp4', None,    [(55.2,59.0),(63.7,69.4)]),
 ('track',    'clips/3-track.mp4', None,      [(76.8,85.4)]),
 ('crowd',    None, 'clips/cf-crowd.png',     [(118.0,120.4),(135.7,141.2)]),
 ('siren',    'clips/4-siren.mp4', None,      [(160.2,162.4),(176.7,184.0)]),
 ('ride',     None, 'clips/cf-ride.png',      [(292.9,297.1),(297.9,304.0)]),
 ('parkedcar','clips/5-parkedcar.mp4', None,  [(389.0,396.2)]),
 ('meth',     None, 'clips/cf-meth.png',      [(420.8,427.9)]),
 ('valued',   None, 'clips/cf-valued.png',    [(455.6,458.2),(472.0,480.7)]),
 ('arrested', None, 'clips/cf-arrested.png',  [(512.9,515.3),(516.8,523.2)]),
 ('jail',     None, 'clips/cf-jail.png',      [(638.8,642.9),(650.4,653.4)]),
 ('sunrise',  None, 'clips/cf-sunrise.png',   [(678.7,685.4)]),
 ('penny',    'clips/6-penny.mp4', None,      [(700.7,704.5),(737.0,748.9)]),
]

def run(args):
    r=subprocess.run(args, capture_output=True, text=True)
    if r.returncode!=0: print('ERR', ' '.join(args[:6]), r.stderr[-400:])
    return r

def dur(f):
    r=subprocess.run([FP,'-v','error','-show_entries','format=duration','-of','default=nk=1:nw=1',f],capture_output=True,text=True)
    return float(r.stdout.strip())

# 1) per-beat audio (concat its spans with tiny fades), measure duration
beat_durs=[]
audio_parts=[]
for i,(name,clip,still,spans) in enumerate(BEATS):
    parts=[]
    for j,(s,e) in enumerate(spans):
        out=f'tight/a{i}_{j}.wav'
        d=e-s
        af=f'afade=t=in:st=0:d=0.03,afade=t=out:st={max(0,d-0.05):.3f}:d=0.05'
        run([FF,'-y','-v','error','-i',M,'-ss',str(s),'-to',str(e),'-af',af,'-ar','44100','-ac','2',out])
        parts.append(out)
    # concat parts
    lst=f'tight/al{i}.txt'
    open(lst,'w').write(''.join(f"file '{os.path.abspath(p)}'\n" for p in parts))
    ao=f'tight/beat{i}.wav'
    run([FF,'-y','-v','error','-f','concat','-safe','0','-i',lst,'-c','copy',ao])
    bd=dur(ao); beat_durs.append(bd); audio_parts.append(ao)
    print(f'beat {i} {name}: {bd:.2f}s')

total=sum(beat_durs)
print(f'TOTAL VO: {total:.1f}s')

# 2) per-beat video of exactly beat_durs[i]
vid_parts=[]
for i,(name,clip,still,spans) in enumerate(BEATS):
    T=beat_durs[i]; vo=f'tight/v{i}.mp4'
    if clip:
        loops=max(0, math.ceil(T/5.0)-1)
        run([FF,'-y','-v','error','-stream_loop',str(loops),'-i',clip,'-t',f'{T:.3f}',
             '-vf','scale=624:624,fps=16,setsar=1','-c:v','libx264','-pix_fmt','yuv420p','-an',vo])
    else:
        frames=max(2,int(round(T*16)))
        zp=f"scale=1248:1248,zoompan=z='min(zoom+0.0006,1.10)':d={frames}:s=624x624:fps=16,setsar=1"
        run([FF,'-y','-v','error','-loop','1','-t',f'{T:.3f}','-i',still,'-vf',zp,
             '-c:v','libx264','-pix_fmt','yuv420p','-an',vo])
    vid_parts.append(vo)

# 3) concat video, concat audio, mux
open('tight/vall.txt','w').write(''.join(f"file '{os.path.abspath(p)}'\n" for p in vid_parts))
run([FF,'-y','-v','error','-f','concat','-safe','0','-i','tight/vall.txt','-c:v','libx264','-pix_fmt','yuv420p','tight/video.mp4'])
open('tight/aall.txt','w').write(''.join(f"file '{os.path.abspath(p)}'\n" for p in audio_parts))
run([FF,'-y','-v','error','-f','concat','-safe','0','-i','tight/aall.txt','-c','copy','tight/audio.wav'])
run([FF,'-y','-v','error','-i','tight/video.mp4','-i','tight/audio.wav',
     '-af','loudnorm=I=-16:TP=-1.5','-c:v','copy','-c:a','aac','-b:a','160k','-movflags','+faststart','-shortest',
     'valued-customer-tiktok.mp4'])
print('final:', dur('valued-customer-tiktok.mp4'),'s')
