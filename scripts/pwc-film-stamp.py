# The FAIL stamp SLAMS ON now instead of being printed from frame one.
#
# Sophie (2026-08-27): the card was ChatGPT's, so redrawing it is allowed —
# "we actually have a good bad thing for the Tinder that you could look into."
# That is the judge deck's GOOD/BAD rubber stamp (her own Decision Deck v3
# artboard, docs/decision-deck/): in at 2.5x and blurred, invisible until it
# is nearly down, an overshoot, then settled in 560ms. Those are the values
# used here.
#
# The stamp ART is HER OWN — extracted from the original card by red chroma
# (the one saturated-red thing on a sepia card), so the settled final frame is
# pixel-for-pixel the card as she made it. The card underneath is the
# inpainted clean plate (gpt-image-2 /edits over a stamp-region mask; the
# model's pixels are composited back ONLY inside that region).
#
# Contact lands on the thud already in the mix: the v5 fail-thud was placed at
# the camera's FAIL arrival (beat 1.84), so the stamp uses the same beat and
# the camera, the sound and the slam are one instant.
import math
from PIL import Image, ImageFilter

STAGES = 17          # 0.567s at 30fps
CONTACT = 10         # frame the stamp hits (the thud)

# (stamp png, ink bbox in card px, card size, beat in 1.25x clip time)
STAMPS = {
 "05-technique-3-the-friend.png":
   ("stamp-cut.png", (457, 772, 1102, 1152), (1122, 1402), 1.84),
}

def build_stages(stamp_path, out_dir, page_w, page_h):
    """Write STAGES RGBA pngs of the slam on a canvas 2.6x the settled stamp.
    Returns (canvas_w, canvas_h) — the caller centres it on the ink bbox."""
    import os
    os.makedirs(out_dir, exist_ok=True)
    st = Image.open(stamp_path).convert("RGBA")
    sw, sh = int(st.width*page_w), int(st.height*page_h)
    st = st.resize((sw, sh), Image.LANCZOS)
    cw, ch = int(sw*2.6), int(sh*2.6)
    for i in range(STAGES):
        img = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        if i < CONTACT:
            t = i/CONTACT
            scale = 2.5 - (2.5-0.96)*(t*t)          # accelerates down
            alpha = 0.0 if t < 0.45 else (t-0.45)/0.55*0.9
            blur  = 14*(1-t)
            rot   = -5.0*(1-t)
        else:
            k = i - CONTACT                          # overshoot -> settle
            scale = [0.96, 1.02, 0.99, 1.0, 1.0, 1.0, 1.0][min(k, 6)]
            alpha, blur, rot = 1.0, 0.0, 0.0
        if alpha <= 0:
            img.save(f"{out_dir}/{i:03d}.png"); continue
        fr = st.resize((max(2,int(sw*scale)), max(2,int(sh*scale))), Image.LANCZOS)
        if rot: fr = fr.rotate(rot, expand=True, resample=Image.BICUBIC)
        if blur > 0.5: fr = fr.filter(ImageFilter.GaussianBlur(blur))
        if alpha < 1.0:
            a = fr.getchannel("A").point(lambda p: int(p*alpha))
            fr.putalpha(a)
        img.alpha_composite(fr, ((cw-fr.width)//2, (ch-fr.height)//2))
        img.save(f"{out_dir}/{i:03d}.png")
    return cw, ch
