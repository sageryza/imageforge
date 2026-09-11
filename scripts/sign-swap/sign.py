import cv2, numpy as np, json, sys, subprocess, imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont
SRC='1789145082722-kxzefi.mp4'
WORDS=sys.argv[1:] or ['CONDEMNED','SCHEDULED FOR','DEMOLITION']
OUT='sign-'+'-'.join(w.lower().replace(' ','_') for w in WORDS)+'.mp4'
c=cv2.VideoCapture(SRC); fr=[]
while True:
    ok,f=c.read()
    if not ok: break
    fr.append(f)
T=json.load(open('track.json')); quads={int(k):np.float32(v) for k,v in T['quads'].items()}
# smooth the corner tracks a little (3-frame) so the sign never jitters
ks=sorted(quads); arr=np.stack([quads[k] for k in ks])
sm=arr.copy()
for i in range(1,len(ks)-1): sm[i]=(arr[i-1]+2*arr[i]+arr[i+1])/4
quads={k:sm[i] for i,k in enumerate(ks)}
W,H=260,190; S=4
rect=np.float32([[0,0],[W,0],[W,H],[0,H]])
REF=48
def torect(k):
    Hm=cv2.getPerspectiveTransform(quads[k],rect)
    return Hm, cv2.warpPerspective(fr[k],Hm,(W,H),flags=cv2.INTER_CUBIC)
# ink mask from the reference board: dark strokes on the pale board
_,r0=torect(REF); g0=cv2.cvtColor(r0,cv2.COLOR_BGR2GRAY)
med=np.median(g0[20:-20,20:-20]); ink=(g0<med-22).astype(np.uint8)*255
ink[:10,:]=0; ink[-8:,:]=0; ink[:,:10]=0; ink[:,-10:]=0
ink=cv2.dilate(ink,np.ones((33,27),np.uint8))
cv2.imwrite('inkmask.png',ink)
# the English letters, drawn once at 4x
def textmask():
    im=Image.new('L',(W,H),0); d=ImageDraw.Draw(im)
    n=len(WORDS); big=WORDS[0]; small=WORDS[1:]
    fb=ImageFont.truetype('/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',56)
    # shrink the big line to fit
    while d.textlength(big,font=fb)>W-36: fb=ImageFont.truetype(fb.path,fb.size-2)
    fs=ImageFont.truetype('/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',22)
    for w in small:
        while d.textlength(w,font=fs)>W-40: fs=ImageFont.truetype(fs.path,fs.size-1)
    hb=fb.size; hs=fs.size; gap=10
    total=hb+ (gap+len(small)*(hs+6))
    y=(H-total)//2-4
    d.text(((W-d.textlength(big,font=fb))/2,y),big,255,font=fb); y+=hb+gap
    for w in small:
        d.text(((W-d.textlength(w,font=fs))/2,y),w,255,font=fs); y+=hs+6
    m=np.array(im).astype(np.float32)/255
    # weathered ink: chip the letters a little, soften like the source
    rng=np.random.default_rng(7); noise=cv2.GaussianBlur(rng.random((H,W)).astype(np.float32),(0,0),2.2)
    m*=np.clip(0.55+noise*0.9,0,1)
    m=cv2.GaussianBlur(m,(0,0),1.6)
    return np.clip(m,0,1)
tm=textmask(); cv2.imwrite('textmask.png',(tm*255).astype(np.uint8))
# composite mask: the board interior, inset and feathered
inner=np.zeros((H,W),np.uint8); cv2.rectangle(inner,(9,9),(W-10,H-10),255,-1)
inner=cv2.GaussianBlur(inner,(0,0),3).astype(np.float32)/255
out=[f.copy() for f in fr]
for k in ks:
    Hm,r=torect(k)
    g=cv2.cvtColor(r,cv2.COLOR_BGR2GRAY)
    strokes=(g<np.median(g[20:-20,20:-20])-18)&(ink>0)
    inkcol=np.median(r[strokes].reshape(-1,3),axis=0) if strokes.sum()>50 else np.median(r[ink>0].reshape(-1,3),axis=0)
    dark=((g<np.median(g[20:-20,20:-20])-16).astype(np.uint8)*255); dark[:10,:]=0; dark[-9:,:]=0; dark[:,:12]=0; dark[:,-12:]=0
    m=cv2.bitwise_or(ink,cv2.dilate(dark,np.ones((9,9),np.uint8)))
    clean=cv2.inpaint(r,m,6,cv2.INPAINT_TELEA)
    clean=cv2.GaussianBlur(clean,(0,0),1.0)
    a=tm[...,None]*0.92
    new=(clean*(1-a)+inkcol*a).astype(np.uint8)
    back=cv2.warpPerspective(new,Hm,(496,864),flags=cv2.WARP_INVERSE_MAP|cv2.INTER_LINEAR)
    am=cv2.warpPerspective(inner,Hm,(496,864),flags=cv2.WARP_INVERSE_MAP|cv2.INTER_LINEAR)[...,None]
    out[k]=(fr[k]*(1-am)+back*am).astype(np.uint8)
# proof
tiles=[]
for k in [16,22,28,34,40,48,56,65]:
    cy=int(quads[k][:,1].mean()); ya=max(0,min(864-160,cy-80))
    tiles.append(cv2.resize(out[k][ya:ya+160,340:496],(156*3,160*3),interpolation=cv2.INTER_CUBIC))
cv2.imwrite('sign-proof.jpg',np.vstack([np.hstack(tiles[:4]),np.hstack(tiles[4:])]))
cv2.imwrite('sign-frame48.jpg',out[48])
# encode video, then mux the original audio back on
ff=imageio_ffmpeg.get_ffmpeg_exe()
p=subprocess.Popen([ff,'-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','496x864','-r','24','-i','-','-i',SRC,'-map','0:v','-map','1:a?','-c:v','libx264','-preset','slow','-crf','15','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',OUT],stdin=subprocess.PIPE)
for f in out: p.stdin.write(f.tobytes())
p.stdin.close(); p.wait(); print('wrote',OUT,p.returncode)
