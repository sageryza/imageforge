#!/usr/bin/env python3
"""File a finished spot: Assets labels+captions+prompts, My Creations posts, pin.
Usage: file_spot.py <slug> <labels.json> "<pin title>"
labels.json = {"scene_id": "label", ...}
"""
import json, os, subprocess, sys, requests

SLUG, LABELS_PATH, PIN_TITLE = sys.argv[1], sys.argv[2], sys.argv[3]
HOME = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HOME, "spots", SLUG)
m = json.load(open(os.path.join(ROOT, "manifest.json")))
LABELS = json.load(open(LABELS_PATH))
BASE = "https://imageforge-q125.onrender.com"
CHAT = "fictional-pill-commercial"
SESSION = "01Em65jpY2vw2daUnGVYZBtQ"
REPO = "/home/user/imageforge"
ENV = {**os.environ,
       "NODE_PATH": os.path.join(HOME, "node_modules"),
       "GALLERY_UID": "kWNQSEqZ4mdLMsd1QZgDP7UFc1m1"}

ok = err = 0
items = []
for sid, label in LABELS.items():
    st = m["stills"][sid]
    r = requests.post(f"{BASE}/api/gallery", json={
        "assetsOnly": True, "chat": CHAT, "url": st["url"],
        "description": label, "prompt": "gpt-image-2 · medium"}, timeout=30)
    ok += 1 if r.ok else 0
    err += 0 if r.ok else 1
    style = st["style"] if st["style"] else "(single blended prompt — no separate style half)"
    items.append({"url": st["url"], "style": style + " [1536x1024 · medium]",
                  "content": st["content"]})
r = requests.post(f"{BASE}/api/gallery/assets/prompt",
                  json={"chat": CHAT, "items": items}, timeout=60)
print(f"assets: {ok} labeled, {err} errors; prompts saved={r.json().get('saved')}")

for sid, label in LABELS.items():
    st = m["stills"][sid]
    mt = int(os.path.getmtime(os.path.join(ROOT, "stills", f"{sid}.png")) * 1000)
    p = subprocess.run(
        ["node", "scripts/post-to-gallery.js", "--url", st["url"],
         "--prompt", st["content"][:400], "--model", "gpt-image-2",
         "--quality", "medium", "--source", "claude", "--created", str(mt)],
        cwd=REPO, env=ENV, capture_output=True, text=True)
    if p.returncode != 0:
        print(f"creations {sid} FAILED: {p.stderr[-200:]}")
print("creations posted")

r = requests.post(f"{BASE}/api/chatfeed/pin", json={
    "chat": CHAT, "session": SESSION, "url": m["final_url"],
    "title": PIN_TITLE}, timeout=30)
print("pin:", r.status_code, r.json().get("ok"))
