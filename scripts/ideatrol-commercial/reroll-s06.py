#!/usr/bin/env python3
"""Re-roll s06 (product shot) as s06b with the fictional generic name, re-stitch."""
import base64, os, subprocess, time, requests

ROOT = os.path.dirname(os.path.abspath(__file__))
FF = os.path.join(ROOT, "node_modules/ffmpeg-static/ffmpeg")
H = {"Authorization": f"Bearer {os.environ['REPLICATE_API_TOKEN']}"}
WAN = "4eaf2b01d3bf70d8a2e00b219efeb7cb415855ad18b7dacdc4cae664a73a6eea"

PROMPT = ("Product shot from a television pharmaceutical commercial: an amber "
          "prescription pill bottle with a clean white label; the label reads "
          "IDEATROL in large letters, and beneath it in smaller letters "
          "FRIVOLAMINE BESYLATE and EXTENDED RELEASE TABLETS 25 mg; the bottle "
          "stands on a seamless soft white studio background, bathed in warm "
          "golden light, gentle glow, photorealistic.")
MOTION = ("the pill bottle rotates slowly on its axis; glints of warm light; "
          "soft sparkle particles drift")

def log(m): print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)
def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[-1500:])
    return r

still = os.path.join(ROOT, "stills", "s06b.png")
if not os.path.exists(still):
    r = requests.post("https://api.openai.com/v1/images/generations",
        headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
        json={"model": "gpt-image-2", "prompt": PROMPT, "size": "1536x1024",
              "quality": "medium", "n": 1}, timeout=300)
    r.raise_for_status()
    open(still, "wb").write(base64.b64decode(r.json()["data"][0]["b64_json"]))
    log("s06b still done")

crop = os.path.join(ROOT, "crops", "s06b.png")
run([FF, "-y", "-i", still, "-vf", "crop=1536:864:0:80", crop])
up = lambda f, d, c: run(["node", os.path.join(ROOT, "upload.mjs"), f, d, c]).stdout.strip().splitlines()[-1]
still_url = up(still, "commercials/ideatrol/stills/s06b.png", "image/png")
crop_url = up(crop, "commercials/ideatrol/crops/s06b.png", "image/png")
log(f"uploaded: {still_url}")

clip = os.path.join(ROOT, "clips", "s06b.mp4")
if not os.path.exists(clip):
    for attempt in range(8):
        r = requests.post("https://api.replicate.com/v1/predictions", headers=H,
            json={"version": WAN, "input": {"image": crop_url, "prompt": MOTION,
                  "resolution": "480p", "num_frames": 81, "frames_per_second": 16,
                  "interpolate_output": True, "go_fast": True}}, timeout=60)
        if r.status_code == 429:
            time.sleep(20 * (attempt + 1)); continue
        r.raise_for_status(); break
    pid = r.json()["id"]
    while True:
        time.sleep(8)
        d = requests.get(f"https://api.replicate.com/v1/predictions/{pid}", headers=H, timeout=60).json()
        if d["status"] == "succeeded":
            out = d["output"]; u = out[0] if isinstance(out, list) else out
            open(clip, "wb").write(requests.get(u, timeout=300).content)
            log("s06b clip done"); break
        if d["status"] in ("failed", "canceled"):
            raise SystemExit(f"clip failed: {d.get('error')}")

# rebuild part s06 (scene duration 5.0s) from the new clip, re-concat, re-mux
run([FF, "-y", "-i", clip,
     "-vf", "scale=854:480:force_original_aspect_ratio=increase,crop=854:480,"
            "setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=0.4",
     "-t", "5.0", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p",
     "-preset", "fast", os.path.join(ROOT, "parts", "s06.mp4")])
run([FF, "-y", "-f", "concat", "-safe", "0",
     "-i", os.path.join(ROOT, "parts", "list.txt"), "-c", "copy",
     os.path.join(ROOT, "out", "video.mp4")])
final = os.path.join(ROOT, "out", "ideatrol-draft-480p-v1.mp4")
run([FF, "-y", "-i", os.path.join(ROOT, "out", "video.mp4"),
     "-i", os.path.join(ROOT, "out", "audio.m4a"),
     "-c:v", "copy", "-c:a", "copy", "-movflags", "+faststart", "-shortest", final])
print(up(final, "commercials/ideatrol/ideatrol-draft-480p-v1.mp4", "video/mp4"))
print(up(clip, "commercials/ideatrol/clips/s06b.mp4", "video/mp4"))
log("re-stitch done")
