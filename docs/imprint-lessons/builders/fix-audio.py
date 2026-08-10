import subprocess, os
FF='/home/user/imageforge/node_modules/ffmpeg-static/ffmpeg'
M='/root/.claude/uploads/4cd68f55-e85c-5f19-a4e7-e11874ba9625/26e93833-17th_St_205.m4a'
os.chdir('/tmp/claude-0/-home-user/4cd68f55-e85c-5f19-a4e7-e11874ba9625/scratchpad')
os.makedirs('t2', exist_ok=True)
SPANS=[(9.4,14.3),(23.8,26.9),(43.0,51.5),(55.2,59.0),(63.7,69.4),(76.8,85.4),
 (118.0,120.4),(135.7,141.2),(160.2,162.4),(176.7,184.0),(292.9,297.1),(297.9,304.0),
 (389.0,396.2),(420.8,427.9),(455.6,458.2),(472.0,480.7),(512.9,515.3),(516.8,523.2),
 (638.8,642.9),(650.4,653.4),(678.7,685.4),(700.7,704.5),(737.0,748.9)]
def run(a):
    r=subprocess.run(a,capture_output=True,text=True)
    if r.returncode: print('ERR',r.stderr[-300:])
parts=[]
for i,(s,e) in enumerate(SPANS):
    d=e-s; o=f't2/s{i:02d}.wav'
    af=f'afade=t=in:st=0:d=0.03,afade=t=out:st={max(0,d-0.06):.3f}:d=0.06'
    run([FF,'-y','-v','error','-ss',str(s),'-to',str(e),'-i',M,'-af',af,'-ar','44100','-ac','2',o])
    parts.append(o)
open('t2/list.txt','w').write(''.join(f"file '{os.path.abspath(p)}'\n" for p in parts))
# concat WITH re-encode (not -c copy) -> single clean wav
run([FF,'-y','-v','error','-f','concat','-safe','0','-i','t2/list.txt','-c:a','pcm_s16le','-ar','44100','-ac','2','t2/vo.wav'])
# level check
r=subprocess.run([FF,'-i','t2/vo.wav','-af','volumedetect','-f','null','/dev/null'],capture_output=True,text=True)
for ln in r.stderr.splitlines():
    if 'mean_volume' in ln or 'max_volume' in ln or 'Duration' in ln: print(ln.strip())
# mux with existing good video, gentle loudnorm
run([FF,'-y','-v','error','-i','tight/video.mp4','-i','t2/vo.wav','-af','loudnorm=I=-15:TP=-1.5:LRA=11',
     '-c:v','copy','-c:a','aac','-b:a','192k','-ar','44100','-ac','2','-movflags','+faststart','-shortest',
     'valued-customer-tiktok.mp4'])
r=subprocess.run([FF,'-i','valued-customer-tiktok.mp4','-af','volumedetect','-f','null','/dev/null'],capture_output=True,text=True)
print('=== FINAL ===')
for ln in r.stderr.splitlines():
    if 'mean_volume' in ln or 'max_volume' in ln or 'Duration' in ln or 'Audio' in ln: print(ln.strip())
