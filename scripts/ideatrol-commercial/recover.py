#!/usr/bin/env python3
"""Recover the 10 orphaned wan predictions, start s11 with backoff, download all."""
import os, time, requests

ROOT = os.path.dirname(os.path.abspath(__file__))
RP_KEY = os.environ["REPLICATE_API_TOKEN"]
H = {"Authorization": f"Bearer {RP_KEY}"}
WAN_VERSION = "4eaf2b01d3bf70d8a2e00b219efeb7cb415855ad18b7dacdc4cae664a73a6eea"
S11_URL = "https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/commercials/ideatrol/crops/s11.png"
S11_MOTION = "wind blows her hair; she lifts the glowing bulb slightly; camera slowly pulls back; warm dusk light"

def log(m): print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)

# map recent predictions back to scenes by their input image url
found = {}
url = "https://api.replicate.com/v1/predictions"
for _ in range(3):
    d = requests.get(url, headers=H, timeout=60).json()
    for p in d.get("results", []):
        img = (p.get("input") or {}).get("image", "")
        if "commercials/ideatrol/crops/" in img:
            sid = img.rsplit("/", 1)[1].split(".")[0]
            if sid not in found:
                found[sid] = p["id"]
    url = d.get("next")
    if not url or len(found) >= 10:
        break
log(f"recovered predictions: {sorted(found)}")

# start s11 with 429 backoff
if not os.path.exists(os.path.join(ROOT, "clips", "s11.mp4")) and "s11" not in found:
    for attempt in range(8):
        r = requests.post("https://api.replicate.com/v1/predictions", headers=H,
            json={"version": WAN_VERSION, "input": {
                "image": S11_URL, "prompt": S11_MOTION, "resolution": "480p",
                "num_frames": 121, "frames_per_second": 16,
                "interpolate_output": True, "go_fast": True}}, timeout=60)
        if r.status_code == 429:
            log(f"s11 429, backing off ({attempt+1})")
            time.sleep(20 * (attempt + 1))
            continue
        r.raise_for_status()
        found["s11"] = r.json()["id"]
        log("s11 started")
        break

t0 = time.time()
pending = dict(found)
for sid in list(pending):
    if os.path.exists(os.path.join(ROOT, "clips", f"{sid}.mp4")):
        del pending[sid]
while pending and time.time() - t0 < 1500:
    time.sleep(8)
    for sid, pid in list(pending.items()):
        d = requests.get(f"https://api.replicate.com/v1/predictions/{pid}",
                         headers=H, timeout=60).json()
        st = d.get("status")
        if st == "succeeded":
            out = d["output"]
            u = out[0] if isinstance(out, list) else out
            data = requests.get(u, timeout=300).content
            open(os.path.join(ROOT, "clips", f"{sid}.mp4"), "wb").write(data)
            log(f"clip {sid} downloaded ({len(data)//1024}KB)")
            del pending[sid]
        elif st in ("failed", "canceled"):
            log(f"clip {sid} FAILED: {d.get('error')} — will let pipeline retry")
            del pending[sid]
if pending:
    raise SystemExit(f"still pending after timeout: {list(pending)}")
log("recovery done")
