import cv2, numpy as np, json
SRC='1789145082722-kxzefi.mp4'
c=cv2.VideoCapture(SRC); fr=[]
while True:
    ok,f=c.read()
    if not ok: break
    fr.append(f)
gray=[cv2.cvtColor(f,cv2.COLOR_BGR2GRAY) for f in fr]
T=json.load(open('track.json')); quads={int(k):np.float32(v) for k,v in T['quads'].items()}; cc=T['cc']
REF=48; x0,y0,x1,y1=380,705,480,795
quad48=np.float32([[397.5,725],[462.5,721],[463.7,770],[398.7,773.7]])
tpl=cv2.GaussianBlur(gray[REF][y0:y1,x0:x1],(3,3),0)
# board-only template for coarse matching (less background)
bt=cv2.GaussianBlur(gray[REF][721:774,397:464],(3,3),0)
crit=(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT, 300, 1e-6)
prev=None
for k in range(29,15,-1):
    g=cv2.GaussianBlur(gray[k],(3,3),0)
    # coarse: template match in the right half, y band around previous
    r=cv2.matchTemplate(g[:,300:],bt,cv2.TM_CCOEFF_NORMED)
    _,mx,_,loc=cv2.minMaxLoc(r); tx,ty=loc[0]+300,loc[1]
    dx,dy=tx-397,ty-721
    init=np.array([[1,0,x0+dx],[0,1,y0+dy],[0,0,1]],np.float32)
    try:
        s,w=cv2.findTransformECC(tpl,g,init.copy(),cv2.MOTION_HOMOGRAPHY,crit,None,5)
    except cv2.error:
        s,w=None,init
    q=cv2.perspectiveTransform((quad48-np.float32([x0,y0])).reshape(-1,1,2),w).reshape(-1,2)
    # sanity: keep the board size near the reference; else fall back to translation
    wid=np.linalg.norm(q[1]-q[0]); 
    if s is None or abs(wid-65)>8: q=quad48+np.float32([dx,dy]); s=-1
    quads[k]=q; cc[str(k)]=float(s) if s is not None else -1
    print(k,'match',round(mx,2),(dx,dy),'ecc',None if s is None else round(s,3), np.round(q[0],1).tolist(), round(float(wid),1))
ks=sorted(quads)
json.dump({'quads':{str(k):quads[k].tolist() for k in ks},'cc':cc}, open('track.json','w'))
tiles=[]
for k in range(16,66,3):
    f=fr[k].copy(); q=np.int32(np.round(quads[k]))
    cv2.polylines(f,[q.reshape(-1,1,2)],True,(0,255,0),1)
    cy=int(quads[k][:,1].mean()); ya=max(0,min(864-200,cy-100))
    tiles.append(cv2.resize(f[ya:ya+200,330:496],(166*2,200*2),interpolation=cv2.INTER_NEAREST))
rows=[np.hstack(tiles[i:i+6]) for i in range(0,len(tiles),6)]
w=max(r.shape[1] for r in rows); rows=[np.pad(r,((0,0),(0,w-r.shape[1]),(0,0))) for r in rows]
cv2.imwrite('track-proof.jpg',np.vstack(rows))
