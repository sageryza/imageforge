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
ap=argparse.ArgumentParser(); ap.add_argument('cards'); ap.add_argument('--src',default='src'); ap.add_argument('--full',default='full'); ap.add_argument('--font',required=True); ap.add_argument('--out',default='deck'); A=ap.parse_args()
font=ImageFont.truetype(A.font, 64)
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
    text=name.lower(); ls=int(64*0.12)
    tw=sum(d.textlength(c,font=font) for c in text)+ls*(len(text)-1)
    th=64; gap=int(0.16*PIC)
    block=PIC+gap+th
    top=BLEED+(TH-block)//2
    card.paste(pic,((W-PIC)//2,top))
    x=(W-tw)/2; y=top+PIC+gap
    for c in text:
        d.text((x,y),c,font=font,fill=(38,34,28)); x+=d.textlength(c,font=font)+ls
    out=f'{A.out}/fronts/{i:02d}-{name.lower().replace(" ","-")}.png'
    card.save(out,dpi=(DPI,DPI))
    report.append({'name':name,'source':p,'source_px':sz,'placed_px':PIC,'scale':round(scale,3),'dpi_on_card':round(sz/2.0)})
back=Image.new('RGB',(W,H),(250,246,238)); back.save(A.out+'/back.png',dpi=(DPI,DPI))
json.dump(report,open(A.out+'-report.json','w'),indent=1)
for r in report: print(r)
