#!/usr/bin/env python3
"""All-themes finder: ONE pass over every banked transcript, returning genuine
moments for every supercut theme with a TIGHT definition each (like colors).
Paying the transcript cost once instead of per-theme."""
import json, os, sys, time, urllib.request

SERVER = "https://imageforge-q125.onrender.com"
KEY = os.environ["OPENAI_API_KEY"]
MODEL = "gpt-5.6-sol"
OUT = sys.argv[1] if len(sys.argv) > 1 else "/home/user/theme-candidates.json"

# key -> tight definition. Each must be about the OTHERWORLDLY/NDE quality,
# not an ordinary mention. Empty results are expected and fine.
THEMES = {
  "colors": "the EXTRAORDINARY colors of the other realm — colors never seen on earth, indescribable, more vivid/luminous than earthly color, beyond the visible spectrum. NOT ordinary color mentions (blue sky, brown water, gold light alone).",
  "telepathy": "communicating MIND TO MIND without spoken words — thoughts or feelings transmitted directly, 'no words were spoken', hearing/understanding without ears.",
  "love-peace": "an OVERWHELMING, all-encompassing unconditional love or peace far beyond any earthly feeling — the defining emotion of the experience. NOT a casual 'it was peaceful'.",
  "sent-back": "being told or realizing they MUST return to their body — 'you have to go back', 'it's not your time', a command or choice to return.",
  "reluctance": "actively NOT wanting to come back — wanting to stay, being upset/angry/heartbroken to return to the body.",
  "being-presence": "encountering a BEING or PRESENCE of light there — a guide, a luminous figure, a divine presence. NOT a deceased relative (that's its own theme).",
  "deceased": "meeting a specific DECEASED loved one, relative, friend, or pet on the other side.",
  "out-of-body": "seeing their OWN physical body or the scene from outside or above it.",
  "life-review": "REVIEWING scenes of their life, sometimes re-living them or feeling what others felt.",
  "realer-than-real": "the experience being MORE REAL, vivid, or solid than ordinary earthly life — 'more real than this', 'this world feels like the dream'.",
  "oneness": "a sense that EVERYTHING IS CONNECTED / all is one / merging or dissolving into everything.",
  "universal-knowledge": "suddenly KNOWING EVERYTHING — total understanding, every question answered, a 'download' of all knowledge.",
  "timelessness": "TIME not existing there — no time, everything at once, time meaningless.",
  "welcomed-home": "a profound feeling of being HOME — of return, belonging, deep familiarity ('I was finally home').",
  "music-sound": "hearing EXTRAORDINARY music, tones, harmonics, or sound unlike anything earthly.",
}

def fetch_json(url, tries=6):
    for k in range(tries):
        try: return json.load(urllib.request.urlopen(url, timeout=120))
        except Exception:
            if k == tries - 1: raise
            time.sleep(3 * (k + 1))

theme_block = "\n".join(f'- "{k}": {v}' for k, v in THEMES.items())
SYS = f"""You are indexing near-death-experience interviews to build SUPERCUTS — for each theme, many different people describing the SAME thing.

Scan ONE transcript and, for EACH theme below, return the moments that GENUINELY match its tight definition. Be strict: an ordinary or passing mention does NOT count — only the real, vivid, on-theme moment. Most themes will have 0-2 moments in any given interview; empty is expected and correct. Never force a match.

THEMES:
{theme_block}

For each match return the SENTENCE(S) the person actually says, and the mm:ss where it begins (read the transcript's time markers).

Return STRICT JSON, keyed by theme:
{{"themes": {{ "<theme-key>": [ {{"quote": verbatim sentence(s), "timeSec": integer seconds where it begins}} ], ... }}}}
ALSO — DISCOVERY: if you notice a DISTINCTIVE, RECURRING near-death element that would make a good supercut but is NOT in the list above (e.g. a border/point of no return, being shown the future, a specific landscape or garden, a life's-purpose message, a specific creature), include it under a NEW short kebab-case key you invent. Only do this for something specific and likely to recur across many accounts — not a one-off.

Only include theme keys that have at least one match. If the whole transcript matches nothing, return {{"themes": {{}}}}."""

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

def openai_json(user):
    body = {"model": MODEL, "messages": [{"role": "system", "content": SYS}, {"role": "user", "content": user}],
            "response_format": {"type": "json_object"}, "reasoning_effort": "medium"}
    req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    for attempt in range(3):
        try:
            d = json.load(urllib.request.urlopen(req, timeout=240))
            return json.loads(d["choices"][0]["message"]["content"])
        except Exception:
            if attempt == 2: raise
            time.sleep(4)
    return {}

vids = fetch_json(f"{SERVER}/api/nde/videos?limit=200")["videos"]
vids = [v for v in vids if v.get("status") in ("extracted", "transcribed") and v.get("transcriptChars")]
print(f"Scanning {len(vids)} transcripts for all {len(THEMES)} themes in one pass…\n")
by_theme = {k: [] for k in THEMES}
for i, v in enumerate(vids, 1):
    full = fetch_json(f"{SERVER}/api/nde/videos/{v['videoId']}")
    tr = full.get("transcript")
    if not tr: continue
    name = full.get("experiencerName") or full.get("title", "")
    try:
        out = openai_json(f"Experiencer: {name}\nInterview: {full.get('title','')}\n\nTRANSCRIPT (mm:ss markers):\n\n{ts_text(tr)}")
    except Exception as e:
        print(f"[{i}/{len(vids)}] {name[:30]} — ERROR {e}"); continue
    found = out.get("themes") or {}
    n = 0
    for key, moments in found.items():
        if key not in by_theme: by_theme[key] = []  # discovered theme
        for m in (moments or []):
            q = (m.get("quote") or "").strip()
            if not q: continue
            by_theme[key].append({"videoId": v["videoId"], "experiencer": name, "title": full.get("title",""),
                                   "quote": q, "timeSec": int(m.get("timeSec") or 0), "audioUrl": full.get("audioUrl")})
            n += 1
    print(f"[{i}/{len(vids)}] {name[:32]:32s} — {n} moment(s) across {len([k for k in found if found[k]])} themes")
    json.dump(by_theme, open(OUT, "w"), indent=2, ensure_ascii=False)  # save as we go

print(f"\nSaved → {OUT}")
print("Per-theme totals:")
for k in sorted(by_theme, key=lambda x: -len(by_theme[x])):
    print(f"  {len(by_theme[k]):3d}  {k}")
