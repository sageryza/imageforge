# mix.py <video.mp4|frames.txt> <out.mp4> <duration> <json sounds [[file,at,gain],...]> [--frames]
import json,subprocess,sys
FF='/home/user/imageforge/node_modules/ffmpeg-static/ffmpeg'
src,out,dur,sounds=sys.argv[1],sys.argv[2],float(sys.argv[3]),json.loads(sys.argv[4])
frames='--frames' in sys.argv
cmd=[FF,'-loglevel','error','-y']
if frames: cmd+=['-f','concat','-safe','0','-fflags','+genpts','-i',src]
else: cmd+=['-i',src]
cmd+=['-f','lavfi','-t',str(dur),'-i','anullsrc=r=44100:cl=stereo']
for f,at,g in sounds: cmd+=['-i',f]
fl=[]; labels=['[1:a]']
for i,(f,at,g) in enumerate(sounds):
    fl.append(f'[{i+2}:a]volume={g},adelay={int(at*1000)}|{int(at*1000)}[s{i}]'); labels.append(f'[s{i}]')
fl.append(''.join(labels)+f'amix=inputs={len(labels)}:normalize=0:dropout_transition=0,atrim=0:{dur}[a]')
vf='scale=-2:864,pad=496:864:(ow-iw)/2:(oh-ih)/2:color=#1a1a1a,setsar=1' if frames else 'scale=496:864:force_original_aspect_ratio=decrease,pad=496:864:(ow-iw)/2:(oh-ih)/2:color=#1a1a1a,setsar=1'
cmd+=['-filter_complex',';'.join(fl),'-map','0:v','-map','[a]','-vf',vf,'-vsync','cfr','-r','24','-t',str(dur),'-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k',out]
subprocess.run(cmd,check=True); print('ok',out)
