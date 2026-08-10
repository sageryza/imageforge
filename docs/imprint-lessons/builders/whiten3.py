import sys, numpy as np
from PIL import Image
from scipy import ndimage
def whiten(inp, outp, tol=46, mode='all'):
    im = Image.open(inp).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    h,w,_ = a.shape
    if mode=='top':
        cpts=[(2,2),(2,w-3)]           # top corners only
    else:
        cpts=[(2,2),(2,w-3),(h-3,2),(h-3,w-3)]
    bg = np.array([a[y,x] for (y,x) in cpts]).mean(0)
    dist = np.sqrt(((a-bg)**2).sum(2))
    mask = dist <= tol
    lbl,n = ndimage.label(mask)
    if mode=='top':
        border = set(np.unique(lbl[0]))          # only top row seeds the fill
    else:
        border = set(np.unique(np.concatenate([lbl[0],lbl[-1],lbl[:,0],lbl[:,-1]])))
    border.discard(0)
    bgmask = np.isin(lbl, list(border))
    out = np.asarray(im).copy(); out[bgmask]=[255,255,255]
    Image.fromarray(out).save(outp)
    print(f'{outp}: {bgmask.mean()*100:.1f}% ({mode}, bg={bg.astype(int)})')
if __name__=='__main__':
    whiten(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv)>3 else 46, sys.argv[4] if len(sys.argv)>4 else 'all')
