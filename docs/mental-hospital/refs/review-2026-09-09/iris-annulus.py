import cv2,numpy as np,glob,sys,json
YU='models/yunet.onnx'
def faces(img):
    h,w=img.shape[:2]; d=cv2.FaceDetectorYN.create(YU,'',(w,h),0.6,0.3,5000); d.setInputSize((w,h)); n,f=d.detect(img); return [] if f is None else list(f)
def frontal(f):
    re_,le_,nose=(f[4],f[5]),(f[6],f[7]),(f[8],f[9]); mid=(re_[0]+le_[0])/2; d=abs(le_[0]-re_[0]); return d>0 and abs(nose[0]-mid)/d<0.25
def iris(img,pt,dd):
    X,Y=int(round(pt[0])),int(round(pt[1])); r1,r2=max(2,dd*0.045),max(4,dd*0.11)
    R=int(r2)+1; p=img[max(0,Y-R):Y+R+1,max(0,X-R):X+R+1]
    if p.shape[0]<2*R or p.shape[1]<2*R: return None
    yy,xx=np.mgrid[-R:R+1,-R:R+1]; rr=np.hypot(xx,yy); m=(rr>=r1)&(rr<=r2)
    lab=cv2.cvtColor(p,cv2.COLOR_BGR2LAB).astype(float); hsv=cv2.cvtColor(p,cv2.COLOR_BGR2HSV).astype(float)
    return lab[:,:,0][m].mean()*100/255, hsv[:,:,1][m].mean(), p[:,:,0][m].mean()-p[:,:,2][m].mean()  # L%, S, blue-minus-red
for mp4 in sys.argv[1:]:
    cap=cv2.VideoCapture(mp4); i=0; vals=[]
    while True:
        ok,img=cap.read()
        if not ok: break
        if i%6==0:
            for f in faces(img):
                if f[3]<150 or not frontal(f): continue
                re_,le_=(f[4],f[5]),(f[6],f[7]); dd=float(np.hypot(le_[0]-re_[0],le_[1]-re_[1]))
                for pt in (re_,le_):
                    v=iris(img,pt,dd)
                    if v: vals.append(v)
        i+=1
    if vals:
        a=np.array(vals); print(f"{mp4.split('/')[-1]:22} n={len(vals):3}  irisL%={a[:,0].mean():5.1f}  S={a[:,1].mean():5.1f}  blue-red={a[:,2].mean():+5.1f}")
    else: print(mp4,'no frontal face >=150px')
