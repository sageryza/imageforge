#!/usr/bin/env python3
"""Compare page: collapsible per-clip transcript. Tap a name to expand the
included dialogue; a nested toggle reveals what comes after the current cut."""
import json, os, re, html, urllib.request

CORPUS = "/home/user/out/corpus"
clips = json.load(open("/home/user/realer-v4-order.json"))

def load(vid):
    return json.load(open(os.path.join(CORPUS, f"{vid}.json")))

def clean_name(t):
    m = re.match(r"(?:the )?near[- ]death experiences? of (.+)", t or "", re.I)
    return m.group(1).strip().rstrip(".") if m else (t or "")

def find_ci(hay, needle):
    if not needle.strip():
        return -1
    pat = re.compile(r"\s+".join(re.escape(w) for w in needle.split()), re.I)
    m = pat.search(hay)
    return m.start() if m else -1

cards = []
for i, c in enumerate(clips, 1):
    d = load(c["videoId"])
    full = re.sub(r"\s+", " ", d.get("full") or "")
    q = re.sub(r"\s+", " ", (c.get("quote") or "").strip())
    qwords = q.split()
    start = find_ci(full, " ".join(qwords[:5])) if qwords else -1
    if start < 0:
        pos = 0
        for s in (d.get("segments") or []):
            if s.get("start", 0) >= c["timeSec"]:
                break
            pos += len((s.get("text") or "").strip()) + 1
        start = pos
    tail = " ".join(qwords[-5:]) if len(qwords) >= 5 else q
    te = find_ci(full[start:], tail)
    end = start + te + len(tail) if te >= 0 else start + len(q)
    end = min(end, len(full))
    included = html.escape(full[start:end].strip())
    after = html.escape(full[end:end + 480].strip())
    nm = html.escape(clean_name(c.get("experiencer", "")))
    cards.append(
        f'<details class="clip"><summary><span class="n">{i}</span><span class="nm">{nm}</span></summary>'
        f'<div class="body"><p class="inc">{included}</p>'
        f'<details class="after"><summary>+ show what comes after</summary>'
        f'<p class="aft">{after}…</p></details></div></details>')

page = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Realer — mark the stop points</title>
<style>
  * {{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; }}
  body {{ margin:0; background:#100f1a; color:#F2EEE2; padding:22px 16px 90px;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; line-height:1.55; }}
  .wrap {{ max-width:620px; margin:0 auto; }}
  header {{ text-align:center; margin-bottom:14px; }}
  h1 {{ font-size:22px; margin:0 0 6px; }}
  .lead {{ color:#9a9ab4; font-size:14px; margin:0; }}
  details.clip {{ background:#191830; border:1px solid #2a2947; border-radius:8px; margin:10px 0; overflow:hidden; }}
  details.clip > summary {{ list-style:none; cursor:pointer; padding:14px 15px;
    display:flex; align-items:center; gap:11px; font-size:16px; }}
  details.clip > summary::-webkit-details-marker {{ display:none; }}
  details.clip[open] > summary {{ border-bottom:1px solid #2a2947; }}
  .n {{ color:#141422; background:#E0A94A; font-weight:700; font-size:13px; border-radius:6px; padding:1px 9px; min-width:26px; text-align:center; }}
  .nm {{ color:#F2EEE2; font-weight:600; }}
  .body {{ padding:12px 15px 15px; }}
  .inc {{ margin:0; color:#F2EEE2; font-size:16px; }}
  details.after {{ margin-top:12px; }}
  details.after > summary {{ list-style:none; cursor:pointer; display:inline-block;
    color:#9a9ab4; font-size:13px; background:#24233f; border:1px solid #34335a;
    border-radius:6px; padding:5px 11px; }}
  details.after > summary::-webkit-details-marker {{ display:none; }}
  .aft {{ margin:10px 0 0; color:#6f6f8c; font-size:15px; font-style:italic; }}
  .foot {{ text-align:center; color:#6b6b86; font-size:12px; margin-top:26px; }}
</style></head><body><div class="wrap">
<header><h1>Realer than Real — mark the stop points</h1>
<p class="lead">Tap a name to see what's in that clip now. Tap “show what comes after” to see the dialogue that continues past the current cut. Then tell me, per clip, the last words you want it to end on.</p></header>
{''.join(cards)}
<p class="foot">{len(clips)} clips · say e.g. “clip 5, stop after ‘it's not a hallucination’”</p>
</div></body></html>"""

open("/home/user/out/realer-transcript.html", "w").write(page)
r = json.load(urllib.request.urlopen(urllib.request.Request(
    "https://imageforge-q125.onrender.com/api/chatfeed/page",
    data=json.dumps({"chat": "anthony-chene-nde-pipeline",
                     "title": "Realer — mark the stop points", "html": page}).encode(),
    headers={"Content-Type": "application/json"}), timeout=90))
print("posted:", json.dumps(r))
