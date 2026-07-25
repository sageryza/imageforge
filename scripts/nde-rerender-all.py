#!/usr/bin/env python3
"""Re-render the whole montage library through the v7 pipeline (forced-aligned
cuts, silence snap capped at next word, micro-fades), then machine-verify each
montage's edges and bank to Firebase. Free except ~2c Whisper per verification."""
import json, os, re, subprocess, sys

BASE = "/home/user/imageforge"
OUT = "/home/user/out"

# name, candidates json, extra env, firebase dest
JOBS = [
    ("not-my-body",     "/home/user/body-all.json",       {}, "nde-supercuts/not-my-body.mp3"),
    ("universal",       "/home/user/universal-tight.json", {}, "nde-supercuts/universal-knowledge.mp3"),
    ("music",           "/home/user/music-tight.json",     {}, "nde-supercuts/music-sound.mp3"),
    ("grass",           "/home/user/grass-tight.json",     {}, "nde-supercuts/grass.mp3"),
    ("life-review",     "/home/user/life-review-tight.json", {}, "nde-supercuts/life-review.mp3"),
    ("welcomed",        "/home/user/welcomed-tight.json",  {}, "nde-supercuts/welcomed-home.mp3"),
    ("colors-audio",    "/home/user/colors-tight.json",    {}, "nde-supercuts/colors-audio.mp3"),
    ("telepathy-full",  "/home/user/telepathy-tight.json", {}, "nde-supercuts/telepathy-audio-full.mp3"),
    ("telepathy-tight", "/home/user/telepathy-tight.json", {"TIGHT": "1", "WHOLE": "0"}, "nde-supercuts/telepathy-audio-tight.mp3"),
]

summary = []
for name, cj, extra, dest in JOBS:
    mp3 = f"{OUT}/lib-{name}.mp3"
    env = {**os.environ, "WHOLE": "1", "AUDIO_ONLY": "1", "ALIGN": "1", **extra}
    r = subprocess.run(["python3", f"{BASE}/scripts/nde-supercut-precise.py", cj, name.upper(), mp3],
                       env=env, cwd=BASE, capture_output=True, text=True)
    lines = r.stdout.splitlines()
    durs = [m.group(1) for l in lines if (m := re.search(r"\]\s+[^:]+:\s+([\d.]+)s", l))]
    kept = len(durs)
    if not kept or not os.path.exists(mp3):
        summary.append({"name": name, "error": "cut failed", "tail": lines[-3:]})
        print(f"FAIL {name}: cut failed"); continue
    # verify edges (skip for tight mode — clips are sub-phrases of the quote by design)
    flagged = "-"
    if "TIGHT" not in extra:
        v = subprocess.run(["python3", f"{BASE}/scripts/nde-verify-cuts.py", mp3, ",".join(durs), cj],
                           cwd=BASE, capture_output=True, text=True)
        m = re.search(r"(\d+) clip\(s\) flagged", v.stdout)
        flagged = m.group(1) if m else "?"
        for l in v.stdout.splitlines():
            if l.startswith("!!"):
                print(f"   {name} {l}")
    up = subprocess.run(["node", "/home/user/out/upload.js", mp3, dest],
                        env=dict(os.environ, NODE_PATH=f"{BASE}/node_modules"),
                        capture_output=True, text=True)
    url = up.stdout.strip().splitlines()[-1] if up.returncode == 0 else "UPLOAD FAILED"
    dur = sum(float(d) for d in durs)
    summary.append({"name": name, "clips": kept, "dur": round(dur, 1), "flagged": flagged, "url": url})
    print(f"DONE {name}: {kept} clips, {dur:.0f}s, flagged={flagged}")
    json.dump(summary, open(f"{OUT}/rerender-summary.json", "w"), indent=2)

print("\n=== SUMMARY ===")
for s in summary:
    print(s)
