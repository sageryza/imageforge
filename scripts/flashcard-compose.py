# flashcard-compose.py — put a picked picture on a white poker card with its
# name under it, at MPC print size (825x1125 = 2.75x3.75in @ 300 DPI, the 1/8in
# bleed included), then hand the folder to scripts/mpc_card_prep.py +
# scripts/mpc_order_builder.py. Written for the fruit flash-card trial
# (2026-09-20, Sophie: "trial run in ur container would be good" · "upscale
# changes art") — the picture rides at 2in wide, so a 532-1024px original lands
# at 260-500 DPI with only a plain resize, no model upscale anywhere.
#
#   python3 scripts/flashcard-compose.py cards.txt --src <dir> [--full <dir>] \
#       --font <ttf> --out deck
#
# cards.txt: one line per card, `Name | <url or filename>` (a header line is
# skipped). --full is preferred over --src when both hold the file (the
# fruit/full copy is the original; fruit/card is the 640px display copy).
# Measured on the 15 fruit cards: worst stretch x1.13 (lime, 532px), the rest
# downscale. The back is a plain cream placeholder until one is designed.
import os,glob,json
from PIL import Image, ImageDraw, ImageFont
DPI=300; BLEED=int(0.125*DPI)  # 37 (37.5 rounded)
W,H=int(2.75*DPI),int(3.75*DPI)   # 825x1125
TW,TH=int(2.5*DPI),int(3.5*DPI)   # 750x1050
PIC=int(TW*0.80)                  # 600
import argparse
ap=argparse.ArgumentParser(); ap.add_argument('cards'); ap.add_argument('--src',default='src'); ap.add_argument('--full',default='full'); ap.add_argument('--font',required=True); ap.add_argument('--out',default='deck')
# --caps --size --track: the name in capitals, at a size and a letter-spacing
# (em) that match the flash-card page (2026-09-22, the animal deck's Lemon
# Hand caps at 10px/.24em on a 170px card ≈ 52px/.24em on this one).
ap.add_argument('--caps',action='store_true'); ap.add_argument('--size',type=int,default=64); ap.add_argument('--track',type=float,default=0.12)
# --pic --gap --bottom: the card's geometry as FRACTIONS OF THE TRIM WIDTH, so a
# card can copy a flash-card page's proportions exactly (2026-09-26, Sophie on
# the animal deck's v2 print files: "the spacing looks wrong" — measured off
# the approved hearts page at 172px: picture .70 of the card wide, .227 of air
# between the picture and the name's letters, the letters .137 up from the
# bottom edge). --pic alone keeps the old centred block; --bottom anchors the
# block from the bottom by the glyphs' own box, the way the page sits.
ap.add_argument('--pic',type=float,default=0.80); ap.add_argument('--gap',type=float,default=None); ap.add_argument('--bottom',type=float,default=None)
A=ap.parse_args()
PIC=int(TW*A.pic)
font=ImageFont.truetype(A.font, A.size)
try: font.set_variation_by_name('Medium')
except Exception: pass
names=[l.split('|') for l in open(A.cards).read().strip().split('\n')[1:]]
os.makedirs(A.out+'/fronts',exist_ok=True); report=[]
for i,(name,url) in enumerate(names,1):
    name=name.strip(); fn=os.path.basename(url.strip())
    cands=[]
    for d in (A.full,A.src):
        p=f'{d}/{fn}'
        try: im=Image.open(p); im.load(); cands.append((im.size[0],p,im))
        except Exception: pass
    sz,p,im=cands[0]   # the original (full/) when it exists, else the card copy
    im=im.convert('RGB')
    scale=PIC/im.size[0]
    pic=im.resize((PIC,PIC),Image.LANCZOS)
    card=Image.new('RGB',(W,H),'white')
    d=ImageDraw.Draw(card)
    text=name.upper() if A.caps else name.lower(); ls=int(A.size*A.track)
    tw=sum(d.textlength(c,font=font) for c in text)+ls*(len(text)-1)
    th=A.size; gap=int(TW*A.gap) if A.gap is not None else int(0.16*PIC)
    if A.bottom is not None:
        # anchor by the letters' own box: bbox top/bottom relative to the draw origin
        bt=min(font.getbbox(c)[1] for c in text if c.strip()); bb=max(font.getbbox(c)[3] for c in text if c.strip())
        ybot=BLEED+TH-int(TW*A.bottom)          # where the glyphs' bottom lands
        y=ybot-bb; top=y+bt-gap-PIC
    else:
        block=PIC+gap+th
        top=BLEED+(TH-block)//2; y=top+PIC+gap
    card.paste(pic,((W-PIC)//2,top))
    x=(W-tw)/2
    for c in text:
        d.text((x,y),c,font=font,fill=(38,34,28)); x+=d.textlength(c,font=font)+ls
    out=f'{A.out}/fronts/{i:02d}-{name.lower().replace(" ","-")}.png'
    card.save(out,dpi=(DPI,DPI))
    report.append({'name':name,'source':p,'source_px':sz,'placed_px':PIC,'scale':round(scale,3),'dpi_on_card':round(sz/2.0)})
back=Image.new('RGB',(W,H),(250,246,238)); back.save(A.out+'/back.png',dpi=(DPI,DPI))
json.dump(report,open(A.out+'-report.json','w'),indent=1)
for r in report: print(r)
