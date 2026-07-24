#!/usr/bin/env python3
"""Build the 'telepathy long version — reading script' Compare page: every
person's full passage, in the sequence I'd cut them, grouped into movements."""
import json, re, html, urllib.request

d = json.load(open("/home/user/telepathy-tight.json"))

# display name per candidate index (doc-title sources → Anonymous · <source>)
NAMES = {
    0: "Anonymous · A Spiritual Renaissance", 1: "Darius J. Wright",
    2: "Anonymous · Who We Are", 3: "Anonymous · Remembering Who We Are",
    4: "Anonymous · Renaissance", 5: "Anonymous · Renaissance",
    7: "Jeff", 8: "Penny Wittbrodt", 9: "Penny Wittbrodt", 10: "Gabe Poirot",
    11: "Jonathan Ashford", 12: "Malcolm Nair", 13: "Malcolm Nair",
    14: "Peggy", 15: "Peggy", 16: "Heidi", 17: "Ingrid", 18: "Ingrid",
    19: "Ray", 20: "Ray", 21: "Nadia", 22: "Nadia", 23: "Rob Gentile",
    24: "Rob Gentile", 25: "Graeme", 26: "Chris Batts", 27: "Tricia Barker",
    28: "Tricia Barker", 29: "Karen Thomas", 30: "Scott Drummond",
    31: "Jane Thompson", 32: "Tammy Lee Anderson", 33: "Tammy Lee Anderson",
    34: "Dr. Mary Helen Hensley", 35: "Landon", 36: "Deborah",
    37: "Julien Chameroy · Doorway to Oneness", 38: "Julien Chameroy · Doorway to Oneness",
}

MOVEMENTS = [
    ("I — “No words were spoken”", "The flat declaration, said again and again.",
     [9, 16, 36, 25, 21, 24, 2, 20, 7]),
    ("II — Talking mind to mind", "They reach for the same word for it: telepathic.",
     [5, 11, 19, 23, 28, 27, 33, 13, 15]),
    ("III — “I could hear their thoughts”", "Hearing without ears — thoughts, not sound.",
     [4, 12, 30, 17, 3, 26, 10, 18, 31, 38, 37, 14, 8, 1, 29, 0, 22]),
    ("IV — Beyond words", "Not just talk without speech — a complete knowing.",
     [32, 34, 35]),
]

def tidy(q):
    q = (q or "").strip()
    if q and q[0].islower():
        q = q[0].upper() + q[1:]
    if q and q[-1] not in ".!?”\"":
        q += "."
    return q

cards = []
n = 0
for title, blurb, idxs in MOVEMENTS:
    cards.append(f'<div class="mv"><h3>{html.escape(title)}</h3><p class="mvsub">{html.escape(blurb)}</p></div>')
    for i in idxs:
        n += 1
        nm = html.escape(NAMES.get(i, d[i].get("experiencer", "")))
        q = html.escape(tidy(d[i].get("quote", "")))
        cards.append(
            f'<div class="q"><div class="qh"><span class="num">{n}</span>'
            f'<span class="nm">{nm}</span></div><p class="qt">“{q}”</p></div>')

body = "\n".join(cards)
page = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Telepathy — long version (script)</title>
<style>
  * {{ box-sizing: border-box; -webkit-tap-highlight-color: transparent; }}
  body {{ margin:0; background:#100f1a; color:#F2EEE2; padding:22px 16px 90px;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; line-height:1.6; }}
  .wrap {{ max-width:680px; margin:0 auto; }}
  header {{ text-align:center; margin-bottom:6px; }}
  h1 {{ font-size:25px; margin:0 0 6px; }}
  .sub {{ color:#9a9ab4; font-size:14px; margin:0 auto; max-width:520px; }}
  .meta {{ color:#E0A94A; font-size:13px; margin-top:10px; }}
  .mv {{ margin:30px 0 4px; border-top:1px solid #2a2947; padding-top:20px; }}
  .mv h3 {{ font-size:13px; letter-spacing:2px; text-transform:uppercase; color:#E0A94A; margin:0 0 4px; }}
  .mvsub {{ color:#7c7c96; font-size:13px; margin:0; font-style:italic; }}
  .q {{ margin:16px 0; }}
  .qh {{ display:flex; align-items:baseline; gap:10px; margin-bottom:4px; }}
  .num {{ color:#5a5a78; font-size:13px; min-width:22px; }}
  .nm {{ color:#cdc9dd; font-size:14px; font-weight:600; letter-spacing:.3px; }}
  .qt {{ margin:0 0 0 32px; color:#F2EEE2; font-size:16px; }}
  .foot {{ text-align:center; color:#6b6b86; font-size:12px; margin-top:30px; }}
</style></head><body><div class="wrap">
<header><h1>Telepathy — the long version</h1>
<p class="sub">Every person's full passage, in the order I'd cut them. This is the reading script for the ~8–10 minute version — nothing trimmed, each thought whole.</p>
<p class="meta">{n} people · 4 movements · read top to bottom</p></header>
{body}
<p class="foot">Anthony Chene interviews · drop or reorder anything and I'll cut to match</p>
</div></body></html>"""

open("/home/user/out/telepathy-script.html", "w").write(page)
req = urllib.request.Request("https://imageforge-q125.onrender.com/api/chatfeed/page",
    data=json.dumps({"chat": "anthony-chene-nde-pipeline",
                     "title": "Telepathy — long version (reading script)",
                     "html": page}).encode(),
    headers={"Content-Type": "application/json"})
r = json.load(urllib.request.urlopen(req, timeout=90))
print(f"{n} passages posted →", json.dumps(r))
