#!/usr/bin/env python3
"""Find the MOMENT OF DISCOVERY across all banked NDE transcripts: the instant an
experiencer REALIZES communication is happening without spoken words (no lips
moving, hearing thoughts, 'and then I realized…'). Tighter than a general
telepathy mention. gpt-4o-mini, one pass per transcript."""
import json, os, sys, time, urllib.request

SERVER = "https://imageforge-q125.onrender.com"
KEY = os.environ["OPENAI_API_KEY"]
MODEL = "gpt-4o-mini"
OUT = sys.argv[1] if len(sys.argv) > 1 else "/home/user/telepathy-discovery.json"

def fetch_json(url, tries=6):
    for k in range(tries):
        try:
            return json.load(urllib.request.urlopen(url, timeout=120))
        except Exception:
            if k == tries - 1:
                raise
            time.sleep(3 * (k + 1))

SYS = """You are finding clips for a supercut about the exact MOMENT a near-death experiencer DISCOVERS that communication on the other side happens WITHOUT spoken words — the moment of realizing/noticing it, the dawning awareness.

Include ONLY the moment they first NOTICE or REALIZE this. Signals:
- they realize no one's lips or mouth are moving
- they notice no words were spoken yet they understood perfectly
- the instant they realize they are hearing thoughts, not speech / hearing with the mind, not the ears
- explicit realization language: "and then I realized…", "that's when I noticed…", "it dawned on me…", "I suddenly understood that…"

STRICTLY EXCLUDE:
- a flat statement that it "was telepathic" with no moment of realizing it
- an ordinary description of a conversation
- generic 'we communicated' with no discovery beat

LEAN TOWARD INCLUSION. This is a first-pass net, not the final cut — a human curates afterward, so RECALL matters more than precision. If a passage plausibly shows the person noticing or realizing communication is happening without speech — even a borderline or implicit case — INCLUDE it and say so in "why" (mark uncertainty with a leading "maybe:"). Only leave out passages that clearly have nothing to do with wordless communication. It's fine to return 2-3 per interview.

For each moment return the SENTENCE(S) the experiencer actually says that carry (or hint at) the realization, and the mm:ss where it begins (read it from the transcript's time markers).

Return STRICT JSON:
{"moments": [ {"quote": verbatim sentence(s), "timeSec": integer seconds where it begins, "why": one short line naming the discovery cue, prefixed "maybe:" if borderline} ] }
If this transcript truly has nothing, return {"moments": []}."""

def ts_text(t):
    segs = t.get("segments") or []
    buckets, b = [], None
    for s in segs:
        k = int(s["start"] // 10) * 10
        if not b or b["t"] != k:
            if b:
                buckets.append(b)
            b = {"t": k, "text": ""}
        b["text"] += (" " if b["text"] else "") + s["text"]
    if b:
        buckets.append(b)
    out = "\n".join(f"[{x['t']//60:02d}:{x['t']%60:02d}] {x['text']}" for x in buckets)
    return out[:120000]

def openai_json(user):
    body = {"model": MODEL,
            "messages": [{"role": "system", "content": SYS}, {"role": "user", "content": user}],
            "response_format": {"type": "json_object"}, "temperature": 0}
    req = urllib.request.Request("https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    for attempt in range(3):
        try:
            d = json.load(urllib.request.urlopen(req, timeout=180))
            return json.loads(d["choices"][0]["message"]["content"])
        except Exception:
            if attempt == 2:
                raise
            time.sleep(4)
    return {}

vids = fetch_json(f"{SERVER}/api/nde/videos?limit=200")["videos"]
vids = [v for v in vids if v.get("status") in ("extracted", "transcribed") and v.get("transcriptChars")]
print(f"Scanning {len(vids)} transcripts for the DISCOVERY-of-telepathy moment…\n")
cands = []
for i, v in enumerate(vids, 1):
    full = fetch_json(f"{SERVER}/api/nde/videos/{v['videoId']}")
    tr = full.get("transcript")
    if not tr:
        continue
    name = full.get("experiencerName") or full.get("title", "")
    try:
        out = openai_json(f"Experiencer: {name}\nInterview: {full.get('title','')}\n\nTRANSCRIPT (mm:ss markers):\n\n{ts_text(tr)}")
    except Exception as e:
        print(f"[{i}/{len(vids)}] {name[:30]} — ERROR {e}")
        continue
    ms = out.get("moments") or []
    for m in ms:
        q = (m.get("quote") or "").strip()
        if not q:
            continue
        cands.append({"videoId": v["videoId"], "experiencer": name, "title": full.get("title", ""),
                      "quote": q, "timeSec": int(m.get("timeSec") or 0),
                      "why": (m.get("why") or "").strip(), "audioUrl": full.get("audioUrl")})
    print(f"[{i}/{len(vids)}] {name[:34]:34s} — {len(ms)} discovery moment(s)")
    json.dump(cands, open(OUT, "w"), indent=2, ensure_ascii=False)

print(f"\n{len(cands)} discovery candidates → {OUT}")
