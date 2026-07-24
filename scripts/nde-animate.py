#!/usr/bin/env python3
"""Animate a still panel with Kling v2.1 (image-to-video), then slow it down in
ffmpeg for the slow-motion look (motion is natural; the slowdown is the effect).

  python3 nde-animate.py <image_url> "<motion prompt>" <out.mp4>
env: KLING_DUR (5|10, default 5), SLOW (default 2.0)"""
import json, os, subprocess, sys, time, urllib.request

KEY = os.environ["REPLICATE_API_TOKEN"]
VERSION = "daad218feb714b03e2a1ac445986aebb9d05243cd00da2af17be2e4049f48f69"  # kwaivgi/kling-v2.1
IMG, PROMPT, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
DUR = int(os.environ.get("KLING_DUR", "5"))
SLOW = float(os.environ.get("SLOW", "2.0"))

def api(method, url, data=None):
    req = urllib.request.Request(url, data=(json.dumps(data).encode() if data else None), method=method,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=120))

pred = api("POST", "https://api.replicate.com/v1/predictions", {"version": VERSION,
    "input": {"start_image": IMG, "prompt": PROMPT, "duration": DUR,
              "negative_prompt": "blurry, distorted, warping, morphing faces, extra limbs, text, watermark"}})
pid = pred["id"]
print("prediction", pid, "…")
for _ in range(180):
    p = api("GET", f"https://api.replicate.com/v1/predictions/{pid}")
    if p["status"] in ("succeeded", "failed", "canceled"):
        break
    time.sleep(5)
if p["status"] != "succeeded":
    print("FAILED:", p.get("error")); sys.exit(1)
out = p["output"]
url = out if isinstance(out, str) else out[0]
raw = OUT.replace(".mp4", "-raw.mp4")
urllib.request.urlretrieve(url, raw)
subprocess.run(["ffmpeg", "-y", "-i", raw, "-filter:v", f"setpts={SLOW}*PTS", "-an",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", OUT], check=True,
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", OUT],
                   capture_output=True, text=True).stdout.strip()
print(f"wrote {OUT} ({d}s, {SLOW}x slow)")
