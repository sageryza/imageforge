import cv2,numpy as np,glob,json,sys
YU='models/yunet.onnx'
def faces(img):
    h,w=img.shape[:2]; d=cv2.FaceDetectorYN.create(YU,'',(w,h),0.6,0.3,5000); d.setInputSize((w,h)); n,f=d.detect(img); return [] if f is None else list(f)
def frontal(f):
    re_,le_,nose=(f[4],f[5]),(f[6],f[7]),(f[8],f[9]); mid=(re_[0]+le_[0])/2; d=abs(le_[0]-re_[0])
    return d>0 and abs(nose[0]-mid)/d<0.25
rows=[]; tiles=[]
for mp4 in sorted(glob.glob('clips/*-v2.mp4')):
    lab=mp4.split('/')[-1][:-4]; cap=cv2.VideoCapture(mp4); i=0; cands=[]; stats=[]
    while True:
        ok,img=cap.read()
        if not ok: break
        if i%6==0:
            for f in faces(img):
                x,y,w,h=[int(v) for v in f[:4]]
                if h<70 or not frontal(f): continue
                re_,le_=(f[4],f[5]),(f[6],f[7]); dd=float(np.hypot(le_[0]-re_[0],le_[1]-re_[1])); r=max(3,int(round(dd*0.11)))
                fc=img[max(0,y):y+h,max(0,x):x+w]; faceV=float(cv2.cvtColor(fc,cv2.COLOR_BGR2HSV)[:,:,2].mean())
                for pt in (re_,le_):
                    X,Y=int(round(pt[0])),int(round(pt[1])); p=img[max(0,Y-r):Y+r+1,max(0,X-r):X+r+1]
                    if p.size: hsv=cv2.cvtColor(p,cv2.COLOR_BGR2HSV); stats.append((float(hsv[:,:,2].mean())/faceV,float(hsv[:,:,1].mean())))
                # eye-region crop 2x
                cx=int((re_[0]+le_[0])/2); cy=int((re_[1]+le_[1])/2); ew=int(dd*1.1); eh=int(dd*0.45)
                crop=img[max(0,cy-eh):cy+eh,max(0,cx-ew):cx+ew]
                if crop.size: cands.append((h,crop))
        i+=1
    cands.sort(key=lambda c:-c[0]); picks=[]; seen=[]
    for h,c in cands:
        if len(picks)>=4: break
        picks.append(cv2.resize(c,(200,80),interpolation=cv2.INTER_CUBIC))
    if not picks: picks=[np.full((80,200,3),200,np.uint8)]
    while len(picks)<4: picks.append(np.full((80,200,3),255,np.uint8))
    strip=np.hstack(picks); cv2.putText(strip,lab,(3,12),cv2.FONT_HERSHEY_SIMPLEX,0.4,(0,0,255),1); tiles.append(strip)
    if stats: rows.append(dict(clip=lab,n=len(stats),rel=round(float(np.mean([s[0] for s in stats])),3),S=round(float(np.mean([s[1] for s in stats])),1)))
    else: rows.append(dict(clip=lab,n=0))
cv2.imwrite('eyes/v2-sheet.png',np.vstack(tiles))
for r in rows: print(r)
