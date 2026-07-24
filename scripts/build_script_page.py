#!/usr/bin/env python3
"""Telepathy reading script, reorganized: my discovery-moment FAVORITES at the
top in the building order (Tammy → Gabe → the rest), everything else at the
bottom. Replaces the prior Compare page."""
import json, html, urllib.request

OLD_ID = "FtXebbnPCqH5RejKctnW"  # prior script page to replace
d = json.load(open("/home/user/telepathy-tight.json"))

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

# FAVORITES — the discovery moments, in the order we're building
# Tammy, Gabe, Heidi … building to Karen's specific story, ending on Landon (richest)
FAV = [33, 10, 16, 34, 12, 17, 18, 30, 26, 22, 29, 35]
# the rest, borderline first then the plain statements
MAYBE_REST = [2, 7, 8, 14, 19, 20, 21, 24, 25, 31, 36, 37]
UNMARKED_REST = [0, 1, 3, 4, 5, 9, 11, 13, 15, 23, 27, 28, 32, 38]

def tidy(q):
    q = (q or "").strip()
    if q and q[0].islower():
        q = q[0].upper() + q[1:]
    if q and q[-1] not in ".!?”\"":
        q += "."
    return q

def card(n, i, kind):
    cls = {"fav": "q disc", "maybe": "q maybe", "plain": "q"}[kind]
    tag = ('<span class="tag d">discovery</span>' if kind == "fav"
           else '<span class="tag m">maybe</span>' if kind == "maybe" else '')
    nm = html.escape(NAMES.get(i, d[i].get("experiencer", "")))
    q = html.escape(tidy(d[i].get("quote", "")))
    return (f'<div class="{cls}"><div class="qh"><span class="num">{n}</span>'
            f'<span class="nm">{nm}</span>{tag}</div><p class="qt">“{q}”</p></div>')

blocks, n = [], 0
blocks.append('<div class="mv"><h3>★ My picks — the discovery moments</h3>'
              '<p class="mvsub">In the order we\'re building: Tammy, then Gabe, then the rest. '
              'Each of these is the moment someone actually realizes the communication has no words.</p></div>')
for i in FAV:
    n += 1; blocks.append(card(n, i, "fav"))
blocks.append('<div class="mv"><h3>The rest</h3>'
              '<p class="mvsub">Statements about telepathy rather than the moment of discovering it. '
              '“maybe” = borderline; unmarked = a description, not a realization.</p></div>')
for i in MAYBE_REST:
    n += 1; blocks.append(card(n, i, "maybe"))
for i in UNMARKED_REST:
    n += 1; blocks.append(card(n, i, "plain"))

body = "\n".join(blocks)
fav_names = ", ".join(html.escape(NAMES[i]) for i in FAV)
page = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Telepathy — discovery picks (script)</title>
<style>
  * {{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; }}
  body {{ margin:0; background:#100f1a; color:#F2EEE2; padding:22px 16px 90px;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; line-height:1.6; }}
  .wrap {{ max-width:680px; margin:0 auto; }}
  header {{ text-align:center; margin-bottom:6px; }}
  h1 {{ font-size:25px; margin:0 0 6px; }}
  .sub {{ color:#9a9ab4; font-size:14px; margin:0 auto; max-width:520px; }}
  .meta {{ color:#9a9ab4; font-size:13px; margin-top:10px; }}
  .mv {{ margin:30px 0 4px; border-top:1px solid #2a2947; padding-top:20px; }}
  .mv h3 {{ font-size:14px; letter-spacing:1.5px; text-transform:uppercase; color:#E0A94A; margin:0 0 4px; }}
  .mvsub {{ color:#7c7c96; font-size:13px; margin:0; font-style:italic; }}
  .q {{ margin:16px 0; padding-left:12px; border-left:3px solid transparent; }}
  .q.disc {{ border-left-color:#E0A94A; background:#1b1930; border-radius:0 8px 8px 0; padding:10px 12px; }}
  .q.maybe {{ border-left-color:#3a3960; }}
  .qh {{ display:flex; align-items:baseline; gap:9px; margin-bottom:4px; flex-wrap:wrap; }}
  .num {{ color:#5a5a78; font-size:13px; min-width:22px; }}
  .nm {{ color:#cdc9dd; font-size:14px; font-weight:600; letter-spacing:.3px; }}
  .tag {{ font-size:11px; letter-spacing:1px; text-transform:uppercase; padding:2px 8px; border-radius:6px; }}
  .tag.d {{ background:#E0A94A; color:#141422; font-weight:600; }}
  .tag.m {{ background:#2a2947; color:#9a9ab4; }}
  .qt {{ margin:0; color:#F2EEE2; font-size:16px; }}
  .foot {{ text-align:center; color:#6b6b86; font-size:12px; margin-top:30px; }}
</style></head><body><div class="wrap">
<header><h1>Telepathy — discovery cut</h1>
<p class="sub">My favorites — the moments someone <b style="color:#E0A94A">realizes the communication has no words</b> — up top in build order. Everything else below.</p>
<p class="meta">{len(FAV)} picks · {n} total</p></header>
{body}
<p class="foot">Order so far: {fav_names} · a discovery re-scan is running to catch any I missed</p>
</div></body></html>"""

open("/home/user/out/telepathy-script.html", "w").write(page)
try:
    urllib.request.urlopen(urllib.request.Request(
        f"https://imageforge-q125.onrender.com/api/chatfeed/page/{OLD_ID}", method="DELETE"), timeout=60)
    print("deleted old page")
except Exception as e:
    print("delete skipped:", str(e)[:80])
r = json.load(urllib.request.urlopen(urllib.request.Request(
    "https://imageforge-q125.onrender.com/api/chatfeed/page",
    data=json.dumps({"chat": "anthony-chene-nde-pipeline",
                     "title": "Telepathy — discovery picks (script)", "html": page}).encode(),
    headers={"Content-Type": "application/json"}), timeout=90))
print(f"{len(FAV)} favorites, {n} total →", json.dumps(r))
