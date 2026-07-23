#!/usr/bin/env python3
"""Tight 'colors of the realm' finder across all banked NDE transcripts.
Only the moments where the experiencer describes the EXTRAORDINARY, otherworldly
colors they saw during the NDE — not ordinary color mentions."""
import json, os, re, sys, urllib.request

SERVER = "https://imageforge-q125.onrender.com"
KEY = os.environ["OPENAI_API_KEY"]
MODEL = "gpt-5.6-sol"
OUT = sys.argv[1] if len(sys.argv) > 1 else "/home/user/colors-candidates.json"

def fetch_json(url, tries=5):
    import time
    for k in range(tries):
        try:
            return json.load(urllib.request.urlopen(url, timeout=120))
        except Exception as e:
            if k==tries-1: raise
            time.sleep(3*(k+1))


SYS = """You are finding clips for a supercut about the EXTRAORDINARY COLORS people report seeing during a near-death experience.

Include ONLY moments where the experiencer describes the colors of the other realm/afterlife as UNLIKE anything on earth — for example: colors they had never seen before, indescribable colors, colors more vivid/luminous/alive than earthly color, more colors than the human eye can normally see, colors beyond the visible spectrum, colors that don't exist here.

STRICTLY EXCLUDE:
- ordinary color mentions (a blue sky, brown muddy water, a red car, someone's green shirt, gold light alone)
- color used only as a passing detail or metaphor
- anything that isn't specifically about the OTHERWORLDLY quality of the colors themselves

For each qualifying moment return the SENTENCE(S) the experiencer actually says about the colors, and the mm:ss where it begins (read it from the transcript's time markers).

Return STRICT JSON:
{"moments": [ {"quote": verbatim sentence(s) about the extraordinary colors, "timeSec": integer seconds where it begins, "why": one short line confirming it's about the realm's extraordinary colors} ] }
If this transcript has no such moment, return {"moments": []}. Empty is fine — most won't have one."""

def ts_text(t):
    segs = t.get("segments") or []
    buckets, b = [], None
    for s in segs:
        k = int(s["start"] // 10) * 10
        if not b or b["t"] != k:
            if b: buckets.append(b)
            b = {"t": k, "text": ""}
        b["text"] += (" " if b["text"] else "") + s["text"]
    if b: buckets.append(b)
    out = "\n".join(f"[{x['t']//60:02d}:{x['t']%60:02d}] {x['text']}" for x in buckets)
    return out[:120000]

def openai_json(system, user):
    body = {"model": MODEL, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "response_format": {"type": "json_object"}, "reasoning_effort": "medium"}
    req = urllib.request.Request("https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode(), headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    for attempt in range(3):
        try:
            d = json.load(urllib.request.urlopen(req, timeout=180))
            return json.loads(d["choices"][0]["message"]["content"])
        except Exception as e:
            if attempt == 2: raise
    return {}

vids = fetch_json(f"{SERVER}/api/nde/videos?limit=200")["videos"]
vids = [v for v in vids if v.get("status") in ("extracted", "transcribed") and v.get("transcriptChars")]
print(f"Scanning {len(vids)} transcripts for genuine 'colors of the realm' moments…\n")
candidates = []
for i, v in enumerate(vids, 1):
    full = fetch_json(f"{SERVER}/api/nde/videos/{v['videoId']}")
    tr = full.get("transcript")
    if not tr: continue
    name = full.get("experiencerName") or full.get("title", "")
    try:
        out = openai_json(SYS, f"Experiencer: {name}\nInterview: {full.get('title','')}\n\nTRANSCRIPT (mm:ss markers):\n\n{ts_text(tr)}")
    except Exception as e:
        print(f"[{i}/{len(vids)}] {name[:30]} — ERROR {e}"); continue
    ms = out.get("moments") or []
    for m in ms:
        candidates.append({"videoId": v["videoId"], "experiencer": name, "title": full.get("title",""),
                           "quote": (m.get("quote") or "").strip(), "timeSec": int(m.get("timeSec") or 0),
                           "why": (m.get("why") or "").strip(),
                           "audioUrl": full.get("audioUrl")})
    print(f"[{i}/{len(vids)}] {name[:34]:34s} — {len(ms)} colors moment(s)")
json.dump(candidates, open(OUT, "w"), indent=2, ensure_ascii=False)
print(f"\n{len(candidates)} colors candidates across {len(vids)} interviews → {OUT}")
for c in candidates:
    print(f"  {c['experiencer'][:22]:22s} [{c['timeSec']//60:02d}:{c['timeSec']%60:02d}]  {c['quote'][:70]}")
