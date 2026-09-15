import json,os,subprocess,re
SP=os.environ['SP']
FF=subprocess.run(['node','-p','require("ffmpeg-static")'],capture_output=True,text=True,cwd='/home/user/imageforge').stdout.strip()
man={m['url']:m for m in json.load(open(SP+'/manifest.json'))}
sp=json.load(open(SP+'/sophie-spans.json'))
out=SP+'/sophie'; os.makedirs(out,exist_ok=True)
def slug(s): return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')[:46]
for i,s in enumerate(sp,1):
    src=man[s['url']]['file']
    d=s['t1']-s['t0']
    fi=min(0.012,d/6); fo=min(0.020,d/6)
    name=f"{i:02d}-{s['kind'][:4]}-{s['cn']}-{slug(s['text'])}.wav"
    p=os.path.join(out,name); s['cut']=p; s['cutname']=name
    subprocess.run([FF,'-y','-v','error','-ss',f"{s['t0']:.3f}",'-t',f"{d:.3f}",'-i',src,'-vn','-ac','1',
                    '-af',f'afade=t=in:st=0:d={fi:.3f},afade=t=out:st={d-fo:.3f}:d={fo:.3f}',
                    '-c:a','pcm_s16le',p],check=True)
json.dump(sp,open(SP+'/sophie-spans.json','w'),indent=1)
tot=sum(s['secs'] for s in sp)
print('cut',len(sp),'files, %.1fs (%.1f min)'%(tot,tot/60))
print('narration %.0fs · scene %.0fs'%(sum(s['secs'] for s in sp if s['kind']=='narration'),sum(s['secs'] for s in sp if s['kind']=='scene')))
