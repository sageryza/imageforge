#!/usr/bin/env python3
"""ward-eyecolor.py — is the drawn eye a real iris or a black blob?

Built 2026-09-09 to settle a disagreement between two chats: `mom-character-clip`
reported that references masked with a SOLID black bar draw black, iris-less
eyes, where a blur keeps the eye colour. Sophie confirmed the symptom.

The measure is eye brightness AS A FRACTION OF THE SAME FACE'S brightness —
the raw value is mostly a statement about the scene's lighting, so comparing
two clips on it says nothing. YuNet gives the face box and the two eye
landmarks; the patch is 0.11 of the inter-eye distance, which is about eye
sized on any face because it scales with the face.

    python3 scripts/ward-eyecolor.py '[["a.mp4","blur"],["b.mp4","black"]]'

It also writes eyes-<label>.png, a strip of the crops it measured — LOOK AT
THEM. On a face whose eyes are half closed or downcast the number is measuring
an eyelid, and only the crops say so.

Measured on Sophie, one face, three maskings: blur 0.739, solid bar 0.732,
solid dots 0.736 — inside a percent of each other, all three with a readable
iris and a catchlight. Full write-up: docs/mental-hospital/mini-pipeline.md.
"""
import cv2, numpy as np, os, sys, json, subprocess, glob, shutil
FF='/home/user/imageforge/node_modules/ffmpeg-static/ffmpeg'
YU='models/yunet.onnx'
def frames(mp4,out,every=8):
    if os.path.isdir(out): shutil.rmtree(out)
    os.makedirs(out)
    subprocess.run([FF,'-v','error','-i',mp4,'-vf',f'select=not(mod(n\\,{every}))','-vsync','0',f'{out}/f%03d.png'],check=True)
    return sorted(glob.glob(f'{out}/*.png'))
def face(img):
    h,w=img.shape[:2]
    d=cv2.FaceDetectorYN.create(YU,'',(w,h),0.6,0.3,5000); d.setInputSize((w,h))
    n,f=d.detect(img)
    if f is None or len(f)==0: return None
    return sorted(f,key=lambda r:-r[2]*r[3])[0]
def run(mp4,label,every=8,save=None):
    fs=frames(mp4,'/tmp/ec2_'+label,every); rows=[]; crops=[]
    for fp in fs:
        img=cv2.imread(fp); f=face(img)
        if f is None: continue
        x,y,w,h=[int(v) for v in f[:4]]
        fc=img[max(0,y):y+h, max(0,x):x+w]
        if fc.size==0: continue
        faceV=float(cv2.cvtColor(fc,cv2.COLOR_BGR2HSV)[:,:,2].mean())
        re_,le_=(f[4],f[5]),(f[6],f[7])
        d=float(np.hypot(le_[0]-re_[0],le_[1]-re_[1])); r=max(3,int(round(d*0.11)))
        for i,pt in enumerate((re_,le_)):
            X,Y=int(round(pt[0])),int(round(pt[1]))
            p=img[max(0,Y-r):Y+r+1, max(0,X-r):X+r+1]
            if p.size==0: continue
            hsv=cv2.cvtColor(p,cv2.COLOR_BGR2HSV)
            V=float(hsv[:,:,2].mean())
            rows.append(dict(rel=V/faceV if faceV else 0, S=float(hsv[:,:,1].mean()),
                             hi=float((hsv[:,:,2]>200).mean()), faceV=faceV, V=V))
            if save and len(crops)<12 and i==0:
                crops.append(cv2.resize(p,(96,96),interpolation=cv2.INTER_NEAREST))
    if not rows: return None
    if save and crops:
        cv2.imwrite(save, np.hstack(crops))
    m=lambda k: round(float(np.mean([r[k] for r in rows])),3)
    return dict(label=label, n=len(rows),
                eyeV_over_faceV=m('rel'), eyeS=round(m('S'),1),
                catchlight_pct=round(m('hi')*100,1), eyeV=round(m('V'),1), faceV=round(m('faceV'),1))
if __name__=='__main__':
    out=[]
    for mp4,lab in json.loads(sys.argv[1]):
        s=run(mp4,lab,save=f'eyes-{lab}.png'); print(json.dumps(s)); out.append(s)
    json.dump(out,open('eyecolor2.json','w'),indent=1)
