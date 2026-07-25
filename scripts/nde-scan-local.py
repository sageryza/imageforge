#!/usr/bin/env python3
"""Free, no-LLM theme finder. Caches all transcripts locally (once), then regex-
searches each for a theme's cue phrases and emits supercut candidates with a
readable quote window + approx timeSec + audioUrl. I read/curate the hits by
hand (Whisper handles the precise cut later).

  python3 nde-scan-local.py <theme> <out.json>
themes: body  (didn't recognize their own body)  — add more patterns below."""
import json, os, re, sys, time, urllib.request

SERVER = "https://imageforge-q125.onrender.com"
CORPUS = "/home/user/out/corpus"
THEME = sys.argv[1] if len(sys.argv) > 1 else "body"
OUT = sys.argv[2] if len(sys.argv) > 2 else f"/home/user/{THEME}-cands.json"
os.makedirs(CORPUS, exist_ok=True)

def fetch_json(url, tries=6):
    for k in range(tries):
        try:
            return json.load(urllib.request.urlopen(url, timeout=120))
        except Exception:
            if k == tries - 1:
                raise
            time.sleep(3 * (k + 1))

def build_corpus():
    vids = fetch_json(f"{SERVER}/api/nde/videos?limit=200")["videos"]
    vids = [v for v in vids if v.get("status") in ("extracted", "transcribed") and v.get("transcriptChars")]
    for i, v in enumerate(vids, 1):
        p = os.path.join(CORPUS, f"{v['videoId']}.json")
        if os.path.exists(p):
            continue
        full = fetch_json(f"{SERVER}/api/nde/videos/{v['videoId']}")
        tr = full.get("transcript") or {}
        json.dump({"videoId": v["videoId"], "title": full.get("title", ""),
                   "audioUrl": full.get("audioUrl"),
                   "segments": tr.get("segments") or [], "full": tr.get("full") or ""},
                  open(p, "w"), ensure_ascii=False)
        print(f"  cached [{i}/{len(vids)}] {full.get('title','')[:44]}")
    return [os.path.join(CORPUS, f) for f in os.listdir(CORPUS) if f.endswith(".json")]

# theme → cue-phrase regexes (case-insensitive). Recall-leaning; I curate after.
PATTERNS = {
    "body": [
        r"did(?:n'?t| not) (?:know|realize|recogni[sz]e)[^.]{0,45}(?:it was me|that was me|my body|myself|was me|was my)",
        r"did(?:n'?t| not) recogni[sz]e (?:my|the|that|his|her)?\s*(?:own )?(?:body|self)",
        r"whose body (?:is|was) that",
        r"(?:realized|realised)[^.]{0,40}(?:it was me|that was me|(?:my|it was my) (?:own )?body|was my body)",
        r"(?:looking|looked) (?:at|down (?:at|on))[^.]{0,25}(?:the|my|a|this|that) (?:body|man|woman|person|guy|lady)",
        r"(?:hope|feel sorry|felt sorry|poor)[^.]{0,30}(?:she|he|that (?:man|woman|person|guy|lady))",
        r"(?:that|this) (?:poor )?(?:man|woman|guy|lady|person|body)[^.]{0,25}(?:on the (?:bed|table|floor|ground)|lying|laying)",
        r"who(?:'s| is| was) that (?:on the|lying|laying|man|woman|person)",
        r"i saw (?:a|my|this|the) body",
        r"that('?s| is| was) (?:my|me)\b[^.]{0,20}(?:body|down there|on the)",
    ],
}

def clean_name(title):
    t = (title or "").strip()
    m = re.match(r"(?:the )?near[- ]death experiences? of (.+)", t, re.I)
    if m:
        return m.group(1).strip().rstrip(".")
    return t

pats = [re.compile(p, re.I) for p in PATTERNS[THEME]]
files = build_corpus()
print(f"\nsearching {len(files)} transcripts for '{THEME}' cues…\n")
cands = []
for f in files:
    d = json.load(open(f))
    segs = d.get("segments") or []
    if not segs:
        continue
    # concat segment texts, track char-offset → segment index
    offsets, texts, pos = [], [], 0
    for si, s in enumerate(segs):
        txt = (s.get("text") or "").strip()
        offsets.append((pos, si)); texts.append(txt); pos += len(txt) + 1
    fulltext = " ".join(texts)
    hits = []
    for pat in pats:
        for mt in pat.finditer(fulltext):
            # find segment index for match start
            si = 0
            for off, idx in offsets:
                if off <= mt.start():
                    si = idx
                else:
                    break
            hits.append((si, mt.group(0)))
    if not hits:
        continue
    hits = sorted(set(hits))
    # merge nearby hits (within 6 segments) into one candidate, dedupe
    used = set()
    for si, snippet in hits:
        if si in used:
            continue
        for j in range(max(0, si - 6), si + 7):
            used.add(j)
        lo, hi = max(0, si - 1), min(len(segs) - 1, si + 4)
        quote = re.sub(r"\s+", " ", " ".join((segs[k].get("text") or "").strip() for k in range(lo, hi + 1))).strip()
        cands.append({"videoId": d["videoId"], "experiencer": clean_name(d["title"]),
                      "title": d["title"], "timeSec": int(segs[lo].get("start") or 0),
                      "audioUrl": d.get("audioUrl"), "match": snippet, "quote": quote})

json.dump(cands, open(OUT, "w"), indent=2, ensure_ascii=False)
print(f"{len(cands)} candidate windows → {OUT}\n")
for c in cands:
    print(f"— {c['experiencer'][:30]:30s} [{c['timeSec']//60:02d}:{c['timeSec']%60:02d}]  «{c['match'][:55]}»")
