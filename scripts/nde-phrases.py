#!/usr/bin/env python3
"""Add a `phrase` (the core punch-phrase, a verbatim substring of each quote) to
a candidates JSON, so the precise supercut cutter can anchor TIGHT/FINISH cuts.

  python3 nde-phrases.py <in.json> <out.json> "<focus: what the punch is about>"

One cheap gpt-4o-mini call over all quotes (pennies)."""
import json, os, sys, urllib.request

KEY = os.environ["OPENAI_API_KEY"]
IN = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else IN.replace(".json", "-tight.json")
FOCUS = sys.argv[3] if len(sys.argv) > 3 else "the single most striking moment"

cands = json.load(open(IN))
items = [{"i": i, "quote": c.get("quote", "")} for i, c in enumerate(cands)]

SYS = f"""You are trimming near-death-experience quotes for a rapid supercut.
For EACH quote, return the SHORTEST verbatim substring that captures {FOCUS}.
Rules:
- It MUST be an exact substring of that quote (same words, same order, copy it out).
- Prefer the punchiest few words that land the point; do not include lead-in filler.
- If nothing in the quote fits, return the whole quote.
Return STRICT JSON: {{"phrases": [{{"i": <index>, "phrase": "<verbatim substring>"}}]}}"""

body = {"model": "gpt-4o-mini",
        "messages": [{"role": "system", "content": SYS},
                     {"role": "user", "content": json.dumps(items, ensure_ascii=False)}],
        "response_format": {"type": "json_object"}, "temperature": 0}
req = urllib.request.Request("https://api.openai.com/v1/chat/completions",
    data=json.dumps(body).encode(),
    headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
out = json.loads(json.load(urllib.request.urlopen(req, timeout=180))["choices"][0]["message"]["content"])

by_i = {p["i"]: p["phrase"] for p in out.get("phrases", []) if "i" in p}
for i, c in enumerate(cands):
    c["phrase"] = (by_i.get(i) or c.get("quote", "")).strip()
json.dump(cands, open(OUT, "w"), indent=2, ensure_ascii=False)
print(f"{len(cands)} phrases → {OUT}")
for i, c in enumerate(cands):
    print(f"  [{i}] {c['phrase'][:70]}")
