import sys, numpy as np
from PIL import Image
from scipy import ndimage
f=sys.argv[1]
im=np.asarray(Image.open(f).convert('RGB')).astype(int)
r,g,b=im[...,0],im[...,1],im[...,2]
white=(r>200)&(g>200)&(b>200)&(abs(r-b)<30)
white=ndimage.binary_closing(white,iterations=6); white=ndimage.binary_fill_holes(white)
lab,n=ndimage.label(white)
rows=[]
for sl in ndimage.find_objects(lab):
    h=sl[0].stop-sl[0].start; w=sl[1].stop-sl[1].start
    if w*h<20000: continue
    # a turned card's box is bigger than the card: use the blob's own pixel area and the minimum-area rectangle instead
    ys,xs=np.nonzero(lab[sl]==lab[sl].max()); pts=np.stack([xs,ys],1).astype(float)
    pts-=pts.mean(0); cov=np.cov(pts.T); ev,evec=np.linalg.eigh(cov); proj=pts@evec
    L=proj[:,1].max()-proj[:,1].min(); S=proj[:,0].max()-proj[:,0].min()
    rows.append((sl[1].start,sl[0].start,round(S),round(L),round(L/S,3)))
rows.sort(key=lambda t:(t[1]//200,t[0]))
for x,y,w,h,ar in rows: print(f'  card at ({x},{y}): {w}x{h}  tall/wide={ar}')
ws=[t[2] for t in rows]; hs=[t[3] for t in rows]
print(f'  {len(rows)} cards · width {min(ws)}-{max(ws)} ({(max(ws)-min(ws))*100//min(ws)}%) · height {min(hs)}-{max(hs)} ({(max(hs)-min(hs))*100//min(hs)}%) · ratio {min(t[4] for t in rows)}-{max(t[4] for t in rows)} (real 1.40)')
