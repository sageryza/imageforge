#!/usr/bin/env python3
"""Verify candidate quotes against the REAL transcript — drop hallucinations,
repair timestamps. A quote is kept only if most of it appears as one contiguous
run in the actual transcript. Fixes timeSec from the matching segment.

  python3 nde-verify-quotes.py <in.json> <out.json>"""
import json, re, sys, time, urllib.request, difflib

SERVER = "https://imageforge-q125.onrender.com"
IN = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else IN.replace(".json", "-verified.json")

def fetch_json(url, tries=6):
    for k in range(tries):
        try:
            return json.load(urllib.request.urlopen(url, timeout=120))
        except Exception:
            if k == tries - 1:
                raise
            time.sleep(3 * (k + 1))

def norm(s):
    return re.sub(r"[^a-z0-9 ]", " ", (s or "").lower()).split()

cands = json.load(open(IN))
tr_cache = {}
def get_tr(vid):
    if vid not in tr_cache:
        tr_cache[vid] = (fetch_json(f"{SERVER}/api/nde/videos/{vid}").get("transcript") or {})
    return tr_cache[vid]

kept, dropped = [], 0
for c in cands:
    q = (c.get("quote") or "").strip()
    qw = norm(q)
    # obvious placeholder / too-short → drop
    if q.endswith("…") or q.endswith("...") or len(qw) < 5:
        dropped += 1
        continue
    tr = get_tr(c["videoId"])
    segs = tr.get("segments") or []
    full_words = norm(tr.get("full") or " ".join(s.get("text", "") for s in segs))
    if not full_words:
        dropped += 1
        continue
    sm = difflib.SequenceMatcher(a=qw, b=full_words, autojunk=False)
    lm = sm.find_longest_match(0, len(qw), 0, len(full_words))
    contig = lm.size / len(qw)
    if contig < 0.6:  # not genuinely in the transcript → hallucinated
        dropped += 1
        continue
    # repair timeSec from the segment holding the quote's opening words
    head = " ".join(qw[:5])
    t = int(c.get("timeSec") or 0)
    for s in segs:
        if head and head in " ".join(norm(s.get("text", ""))):
            t = int(s.get("start", t)); break
    c["timeSec"] = t
    c["verify"] = round(contig, 2)
    kept.append(c)

json.dump(kept, open(OUT, "w"), indent=2, ensure_ascii=False)
print(f"{len(kept)} verified real · {dropped} dropped (hallucinated/placeholder/absent)")
