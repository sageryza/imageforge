import sys, numpy as np
from PIL import Image
from scipy import ndimage
def whiten(inp, outp, tol=46):
    im = Image.open(inp).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    h,w,_ = a.shape
    corners = np.array([a[2,2],a[2,w-3],a[h-3,2],a[h-3,w-3]])
    bg = corners.mean(0)
    dist = np.sqrt(((a-bg)**2).sum(2))
    mask = dist <= tol
    lbl,n = ndimage.label(mask)  # 4-conn
    border = set(np.unique(np.concatenate([lbl[0],lbl[-1],lbl[:,0],lbl[:,-1]])))
    border.discard(0)
    bgmask = np.isin(lbl, list(border))
    out = np.asarray(im).copy()
    out[bgmask] = [255,255,255]
    Image.fromarray(out).save(outp)
    frac = bgmask.mean()
    print(f'{outp}: whitened {frac*100:.1f}% (bg={bg.astype(int)})')
if __name__=='__main__':
    whiten(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv)>3 else 46)
