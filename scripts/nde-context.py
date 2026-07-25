#!/usr/bin/env python3
"""Print generous context windows around body-recognition triggers so I can read
and curate by hand. Local corpus only, no LLM."""
import json, os, re, sys

CORPUS = "/home/user/out/corpus"
TRIGGERS = [
    r"didn'?t know it was", r"didn'?t recogni[sz]e", r"didn'?t (know|realize) (it|that|who|this)",
    r"whose body", r"who(?:'s| is| was) that (?:on|lying|laying|man|woman|person|guy|lady|down)",
    r"it was me\b", r"\bthat was me\b", r"that'?s me\b",
    r"i saw (?:my|a) (?:own )?body", r"saw my own body", r"my body (?:lying|laying|on the|down)",
    r"look(?:ing|ed) (?:at|down at|down on) (?:my|the|that) body",
    r"that'?s my body|that is my body|there was my body|there'?s my body",
    r"felt sorry for (?:her|him|that)|hope (?:she|he)(?:'?s| is| was) (?:ok|okay|alright|going)",
    r"poor (?:man|woman|girl|guy|thing|lady|soul)\b",
    r"i (?:thought|realized)[^.]{0,20}(?:poor|hope|that person|who is|whose)",
]
pats = [re.compile(t, re.I) for t in TRIGGERS]

def clean(t):
    m = re.match(r"(?:the )?near[- ]death experiences? of (.+)", t or "", re.I)
    return m.group(1).strip().rstrip(".") if m else (t or "")

for fn in sorted(os.listdir(CORPUS)):
    d = json.load(open(os.path.join(CORPUS, fn)))
    segs = d.get("segments") or []
    if not segs:
        continue
    offsets, texts, pos = [], [], 0
    for s in segs:
        txt = (s.get("text") or "").strip()
        offsets.append(pos); texts.append(txt); pos += len(txt) + 1
    full = " ".join(texts)
    seen = []
    for pat in pats:
        for mt in pat.finditer(full):
            st = mt.start()
            if any(abs(st - p) < 200 for p in seen):
                continue
            seen.append(st)
            # segment for time
            si = 0
            for k, off in enumerate(offsets):
                if off <= st:
                    si = k
                else:
                    break
            t = int(segs[si].get("start") or 0)
            ctx = full[max(0, st - 160):st + 200].strip()
            print(f"### {clean(d['title'])[:34]}  [{t//60:02d}:{t%60:02d}]  ({d['videoId']})")
            print(f"    …{ctx}…\n")
