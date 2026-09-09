import cv2, numpy as np, json, sys, os
YU='models/yunet.onnx'
def faces(img):
    h,w=img.shape[:2]
    d=cv2.FaceDetectorYN.create(YU,'',(w,h),0.6,0.3,5000); d.setInputSize((w,h))
    n,f=d.detect(img)
    return [] if f is None else sorted(f,key=lambda r:r[0])
def run(mp4,label,every=8,minface=60):
    cap=cv2.VideoCapture(mp4); i=0; rows=[]; crops=[]; facecrops=[]
    while True:
        ok,img=cap.read()
        if not ok: break
        if i%every==0:
            for f in faces(img):
                x,y,w,h=[int(v) for v in f[:4]]
                if h<minface: continue
                fc=img[max(0,y):y+h,max(0,x):x+w]
                if fc.size==0: continue
                faceV=float(cv2.cvtColor(fc,cv2.COLOR_BGR2HSV)[:,:,2].mean())
                re_,le_=(f[4],f[5]),(f[6],f[7])
                dd=float(np.hypot(le_[0]-re_[0],le_[1]-re_[1])); r=max(3,int(round(dd*0.11))); R=max(6,int(round(dd*0.28)))
                for k,pt in enumerate((re_,le_)):
                    X,Y=int(round(pt[0])),int(round(pt[1]))
                    p=img[max(0,Y-r):Y+r+1,max(0,X-r):X+r+1]
                    if p.size==0: continue
                    hsv=cv2.cvtColor(p,cv2.COLOR_BGR2HSV)
                    rows.append(dict(rel=float(hsv[:,:,2].mean())/faceV, S=float(hsv[:,:,1].mean()), hi=float((hsv[:,:,2]>200).mean()), h=h))
                    if k==0 and len(crops)<14:
                        big=img[max(0,Y-R):Y+R+1,max(0,X-int(R*1.6)):X+int(R*1.6)+1]
                        if big.size: crops.append(cv2.resize(big,(120,80),interpolation=cv2.INTER_CUBIC))
                if len(facecrops)<7: facecrops.append(cv2.resize(fc,(80,100)))
        i+=1
    if crops:
        strip=np.hstack(crops); cv2.putText(strip,label,(4,14),cv2.FONT_HERSHEY_SIMPLEX,0.45,(0,0,255),1)
        cv2.imwrite(f'eyes/{label}.png',strip)
    if facecrops: cv2.imwrite(f'eyes/{label}-faces.png',np.hstack(facecrops))
    if not rows: return dict(label=label,n=0)
    m=lambda k: round(float(np.mean([q[k] for q in rows])),3)
    return dict(label=label,n=len(rows),eyeV_over_faceV=m('rel'),eyeS=round(m('S'),1),catch=round(m('hi')*100,1),meanFaceH=int(np.mean([q['h'] for q in rows])))
out=[]
for mp4,lab in json.loads(sys.argv[1]):
    r=run(mp4,lab); print(json.dumps(r)); out.append(r)
json.dump(out,open('eyes/eyes.json','w'),indent=1)
