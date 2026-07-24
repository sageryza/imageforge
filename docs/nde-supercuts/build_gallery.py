#!/usr/bin/env python3
"""Compare-tab gallery: each montage paired with its illustration + audio/video player."""
import json, html, urllib.request

B = "https://storage.googleapis.com/deckfactory-43176.firebasestorage.app"
CARDS = [
    ("Talking Without Words", "telepathy", f"{B}/nde-supercuts/telepathy-finish-sentences.mp4", "video", "38 people realizing no words were spoken"),
    ("Not My Body", "not-my-body", f"{B}/nde-supercuts/not-my-body.mp3", "audio", "9 people not recognizing their own body"),
    ("Colors Not From Here", "colors", f"{B}/nde-supercuts/colors-not-from-here.mp4", "video", "the colors that don't exist on earth"),
    ("More Real Than Real", "realer", f"{B}/nde-supercuts/realer-than-real.mp3", "audio", "“it made this life feel like the dream”"),
    ("I Knew Everything", "universal", f"{B}/nde-supercuts/universal-knowledge.mp3", "audio", "every question answered at once"),
    ("Music Not of This World", "music", f"{B}/nde-supercuts/music-sound.mp3", "audio", "angelic choirs, the grass singing"),
    ("The Grass", "grass", f"{B}/nde-supercuts/grass.mp3", "audio", "“the grass was alive — it loved me”"),
    ("Watching My Life", "life-review", f"{B}/nde-supercuts/life-review.mp3", "audio", "the life review"),
    ("Home", "welcomed", f"{B}/nde-supercuts/welcomed-home.mp3", "audio", "“I was finally home”"),
]

cards = []
for title, pid, media, kind, sub in CARDS:
    img = f"{B}/nde-panels/{pid}.webp"
    player = (f'<video controls preload="none" playsinline poster="{img}" src="{media}"></video>'
              if kind == "video" else f'<audio controls preload="none" src="{media}"></audio>')
    cards.append(
        f'<div class="card"><img loading="lazy" src="{img}" alt="{html.escape(title)}">'
        f'<h2>{html.escape(title)}</h2><p class="sub">{html.escape(sub)}</p>{player}</div>')

page = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NDE Supercuts — illustrated</title>
<style>
  * {{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; }}
  body {{ margin:0; background:#100f1a; color:#F2EEE2; padding:22px 14px 90px;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }}
  .wrap {{ max-width:560px; margin:0 auto; }}
  header {{ text-align:center; margin-bottom:18px; }}
  h1 {{ font-size:24px; margin:0 0 6px; }}
  .lead {{ color:#9a9ab4; font-size:14px; margin:0; }}
  .card {{ background:#191830; border:1px solid #2a2947; border-radius:12px;
    padding:12px; margin:18px 0; }}
  .card img {{ width:100%; border-radius:8px; display:block; background:#000; }}
  .card h2 {{ font-size:19px; margin:12px 2px 2px; color:#F2EEE2; }}
  .sub {{ margin:0 2px 10px; color:#7c7c96; font-size:13px; font-style:italic; }}
  audio, video {{ width:100%; border-radius:6px; display:block; }}
  video {{ background:#000; }}
  .foot {{ text-align:center; color:#6b6b86; font-size:12px; margin-top:26px; }}
</style></head><body><div class="wrap">
<header><h1>NDE Supercuts — illustrated</h1>
<p class="lead">One illustration per montage, in the dreamy pencil style. Tap the player under each to hear it. First-pass panels — art per clip comes next.</p></header>
{''.join(cards)}
<p class="foot">Anthony Chene interviews · {len(CARDS)} montages</p>
</div></body></html>"""

open("/home/user/out/gallery.html", "w").write(page)
r = json.load(urllib.request.urlopen(urllib.request.Request(
    "https://imageforge-q125.onrender.com/api/chatfeed/page",
    data=json.dumps({"chat": "anthony-chene-nde-pipeline",
                     "title": "NDE Supercuts — illustrated", "html": page}).encode(),
    headers={"Content-Type": "application/json"}), timeout=90))
print("posted:", json.dumps(r))
