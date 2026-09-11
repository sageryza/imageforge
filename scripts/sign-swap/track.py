import cv2, numpy as np, json
SRC='1789145082722-kxzefi.mp4'
c=cv2.VideoCapture(SRC); fr=[]
while True:
    ok,f=c.read()
    if not ok: break
    fr.append(f)
REF=48; A,B=16,65   # the shot with the sign
quad48=np.float32([[397.5,725],[462.5,721],[463.7,770],[398.7,773.7]])
# template: board plus a margin, in frame 48
x0,y0,x1,y1=380,705,480,795
gray=[cv2.cvtColor(f,cv2.COLOR_BGR2GRAY) for f in fr]
def ecc(tpl_gray, img_gray, init):
    crit=(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT, 200, 1e-6)
    w=init.astype(np.float32).copy()
    try:
        cc,w=cv2.findTransformECC(tpl_gray, img_gray, w, cv2.MOTION_HOMOGRAPHY, crit, None, 5)
    except cv2.error as e:
        return None,None
    return cc,w
# template = reference crop; warp maps template coords -> image coords, so compose with offset
tpl=gray[REF][y0:y1,x0:x1]
tpl=cv2.GaussianBlur(tpl,(3,3),0)
quads={}; scores={}
def run(order):
    init=np.array([[1,0,x0],[0,1,y0],[0,0,1]],np.float32)
    for k in order:
        img=cv2.GaussianBlur(gray[k],(3,3),0)
        cc,w=ecc(tpl,img,init)
        if w is None: print('fail',k); break
        init=w
        pts=quad48-np.float32([x0,y0])
        q=cv2.perspectiveTransform(pts.reshape(-1,1,2), w).reshape(-1,2)
        quads[k]=q.tolist(); scores[k]=float(cc)
run(range(REF,B+1)); run(range(REF-1,A-1,-1))
ks=sorted(quads); print('tracked',ks[0],ks[-1], 'min cc',min(scores.values()))
json.dump({'quads':{str(k):quads[k] for k in ks},'cc':{str(k):scores[k] for k in ks}}, open('track.json','w'))
# proof sheet: draw the quad on every 4th frame
tiles=[]
for k in ks[::4]:
    f=fr[k].copy(); q=np.int32(np.round(quads[k]))
    cv2.polylines(f,[q.reshape(-1,1,2)],True,(0,255,0),1)
    tiles.append(cv2.resize(f[600:864,300:496] if k>=32 else f[400:664,300:496],(196*2,264*2),interpolation=cv2.INTER_NEAREST))
rows=[np.hstack(tiles[i:i+7]) for i in range(0,len(tiles),7)]
w=max(r.shape[1] for r in rows); rows=[np.pad(r,((0,0),(0,w-r.shape[1]),(0,0))) for r in rows]
cv2.imwrite('track-proof.jpg',np.vstack(rows))
for k in ks: print(k, round(scores[k],3), np.round(quads[k][0],1).tolist(), np.round(quads[k][2],1).tolist())
