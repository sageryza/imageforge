#!/usr/bin/env python3
"""File a finished reel: Assets labels+captions+prompts, My Creations, pin.
Usage: file_reel.py <slug> <labels.json> "<pin title>"
labels.json: {"scene_or_extra_id": ["label", "<url override or empty>"], ...}
"""
import json, os, subprocess, sys, requests

SLUG, LABELS_PATH, PIN_TITLE = sys.argv[1], sys.argv[2], sys.argv[3]
HOME = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HOME, "reels", SLUG)
m = json.load(open(os.path.join(ROOT, "manifest.json")))
LABELS = json.load(open(LABELS_PATH))
BASE = "https://imageforge-q125.onrender.com"
# Chat identity comes from the running session, never hardcoded — a later
# session reusing a hardcoded slug/session files into the WRONG chat.
SESSION = os.environ.get("CLAUDE_CODE_REMOTE_SESSION_ID", "").removeprefix("cse_")
CHAT = os.environ.get("FORGE_CHAT") or requests.get(
    f"{BASE}/api/chatfeed/name", params={"chat": "", "session": SESSION},
    timeout=30).json()["chat"]
ENV = {**os.environ, "NODE_PATH": os.path.join(HOME, "node_modules"),
       "GALLERY_UID": os.environ.get("GALLERY_UID", "kWNQSEqZ4mdLMsd1QZgDP7UFc1m1")}

ok = 0
items = []
for sid, (label, override) in LABELS.items():
    st = (m.get("stills", {}).get(sid) or {})
    url = override or st.get("url")
    if not url:
        print(f"skip {sid}: no url")
        continue
    r = requests.post(f"{BASE}/api/gallery", json={
        "assetsOnly": True, "chat": CHAT, "url": url,
        "description": label, "prompt": "gpt-image-2 · medium"}, timeout=30)
    ok += 1 if r.ok else 0
    if st.get("content"):
        items.append({"url": url,
                      "style": (st.get("style") or "(no style prefix)") +
                               " [1024x1536 · medium]",
                      "content": st["content"]})
if items:
    r = requests.post(f"{BASE}/api/gallery/assets/prompt",
                      json={"chat": CHAT, "items": items}, timeout=60)
    print(f"assets: {ok} labeled; prompts saved={r.json().get('saved')}")

for sid, (label, override) in LABELS.items():
    st = (m.get("stills", {}).get(sid) or {})
    url = override or st.get("url")
    local = os.path.join(ROOT, "stills", f"{sid}.png")
    if not url or not os.path.exists(local):
        continue
    mt = int(os.path.getmtime(local) * 1000)
    p = subprocess.run(
        ["node", "scripts/post-to-gallery.js", "--url", url,
         "--prompt", (st.get("content") or label)[:400], "--model", "gpt-image-2",
         "--quality", "medium", "--source", "claude", "--created", str(mt)],
        cwd="/home/user/imageforge", env=ENV, capture_output=True, text=True)
    if p.returncode != 0:
        print(f"creations {sid} FAILED: {p.stderr[-150:]}")
print("creations posted")

if PIN_TITLE != "-":
    r = requests.post(f"{BASE}/api/chatfeed/pin", json={
        "chat": CHAT, "session": SESSION, "url": m["final_url"],
        "title": PIN_TITLE}, timeout=30)
    print("pin:", r.status_code, r.json().get("ok"))
