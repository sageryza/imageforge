#!/usr/bin/env python3
"""Re-roll a spot's end-card still (as <sid>b), rebuild that part, re-stitch.
Usage: redo_endcard.py <slug> <scene_id>"""
import base64, json, os, subprocess, sys, time, requests

SLUG, SID = sys.argv[1], sys.argv[2]
HOME = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HOME, "spots", SLUG)
FF = os.path.join(HOME, "node_modules/ffmpeg-static/ffmpeg")
SPOT = json.load(open(os.path.join(HOME, "spots.json")))[SLUG]
m = json.load(open(os.path.join(ROOT, "manifest.json")))
sc = next(s for s in SPOT["scenes"] if s["id"] == SID)

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[-1500:])
    return r

still = os.path.join(ROOT, "stills", f"{SID}b.png")
if not os.path.exists(still):
    r = requests.post("https://api.openai.com/v1/images/generations",
        headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
        json={"model": "gpt-image-2", "prompt": sc["content"],
              "size": "1536x1024", "quality": "medium", "n": 1}, timeout=300)
    r.raise_for_status()
    open(still, "wb").write(base64.b64decode(r.json()["data"][0]["b64_json"]))
crop = os.path.join(ROOT, "crops", f"{SID}b.png")
run([FF, "-y", "-i", still, "-vf", "crop=1536:864:0:80", crop])
up = lambda f, d, c: run(["node", os.path.join(HOME, "upload.mjs"), f, d, c]).stdout.strip().splitlines()[-1]
surl = up(still, f"commercials/{SLUG}/stills/{SID}b.png", "image/png")
curl_ = up(crop, f"commercials/{SLUG}/crops/{SID}b.png", "image/png")

dur = m["scene_durations"][SID]
run([FF, "-y", "-loop", "1", "-t", str(dur), "-i", crop,
     "-vf", "scale=854:480,setsar=1,fps=30",
     "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast",
     os.path.join(ROOT, "parts", f"{SID}.mp4")])
run([FF, "-y", "-f", "concat", "-safe", "0",
     "-i", os.path.join(ROOT, "parts", "list.txt"), "-c", "copy",
     os.path.join(ROOT, "out", "video.mp4")])
final = os.path.join(ROOT, "out", f"{SLUG}-draft-480p-v1.mp4")
run([FF, "-y", "-i", os.path.join(ROOT, "out", "video.mp4"),
     "-i", os.path.join(ROOT, "out", "audio.m4a"),
     "-c:v", "copy", "-c:a", "copy", "-movflags", "+faststart", "-shortest", final])
furl = up(final, f"commercials/{SLUG}/{SLUG}-draft-480p-v1.mp4", "video/mp4")
m["stills"][f"{SID}b"] = {"url": surl, "crop": curl_, "style": "", "content": sc["content"]}
json.dump(m, open(os.path.join(ROOT, "manifest.json"), "w"), indent=2)
print(surl)
print(furl)
