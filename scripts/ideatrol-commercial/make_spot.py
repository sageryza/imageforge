#!/usr/bin/env python3
"""Generalized fake-pill commercial engine. Usage: make_spot.py <slug>
Reads spots.json; renders VO -> stills -> wan 480p clips -> stitch -> upload.
Resumable: skips any file that already exists. Reuses the IDEATROL piano bed.
"""
import base64, json, os, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
import requests

SLUG = sys.argv[1]
HOME = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HOME, "spots", SLUG)
for d in ("vo", "stills", "crops", "clips", "parts", "out"):
    os.makedirs(os.path.join(ROOT, d), exist_ok=True)
SPOT = json.load(open(os.path.join(HOME, "spots.json")))[SLUG]

FFMPEG = os.path.join(HOME, "node_modules/ffmpeg-static/ffmpeg")
FFPROBE = os.path.join(HOME, "node_modules/ffprobe-static/bin/linux/x64/ffprobe")
EL_KEY = os.environ["ELEVENLABS_API_KEY"]
OA_KEY = os.environ["OPENAI_API_KEY"]
RP_KEY = os.environ["REPLICATE_API_TOKEN"]
WAN_VERSION = "4eaf2b01d3bf70d8a2e00b219efeb7cb415855ad18b7dacdc4cae664a73a6eea"
PIANO = os.path.join(HOME, "out", "piano.mp3")
COST = {"images": 0.0, "clips": 0.0}

BW = ("Cinematic still from a 2000s American prescription-drug television "
      "commercial, black and white, desaturated, melancholy, soft diffused "
      "lighting, gentle depth of field, shot on 35mm film, photorealistic. ")
CO = ("Cinematic still from a 2000s American prescription-drug television "
      "commercial, warm golden lighting, soft diffused light, gentle depth of "
      "field, shot on 35mm film, photorealistic. ")

def log(m): print(f"[{time.strftime('%H:%M:%S')}] {SLUG}: {m}", flush=True)

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"cmd failed: {' '.join(str(c) for c in cmd[:6])}...\n{r.stderr[-2000:]}")
    return r

def dur_of(p):
    return float(run([FFPROBE, "-v", "quiet", "-show_entries", "format=duration",
                      "-of", "csv=p=0", p]).stdout.strip())

def upload(path, dest, ctype):
    return run(["node", os.path.join(HOME, "upload.mjs"), path, dest, ctype]).stdout.strip().splitlines()[-1]

def style_of(sc):
    if sc.get("nochar"):
        return ""
    pre = BW if sc.get("bw") else CO
    return pre + SPOT["char_line"]

# ── VO ───────────────────────────────────────────────────────────────
def tts(seg):
    fin = os.path.join(ROOT, "vo", f"{seg['id']}.mp3")
    if os.path.exists(fin):
        return dur_of(fin)
    voice = SPOT["announcer"] if seg["v"] == "A" else SPOT["character"]
    raw = fin + ".raw.mp3"
    r = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128",
        headers={"xi-api-key": EL_KEY},
        json={"text": seg["text"], "model_id": "eleven_multilingual_v2",
              "voice_settings": {"stability": 0.5, "similarity_boost": 0.75,
                                 "style": 0, "use_speaker_boost": True}},
        timeout=120)
    r.raise_for_status()
    open(raw, "wb").write(r.content)
    if seg.get("tempo", 1.0) != 1.0:
        run([FFMPEG, "-y", "-i", raw, "-filter:a", f"atempo={seg['tempo']}", fin])
        os.remove(raw)
    else:
        os.replace(raw, fin)
    return dur_of(fin)

log("stage 1: VO")
D = {}
for seg in SPOT["segments"]:
    D[seg["id"]] = tts(seg)
    log(f"VO {seg['id']}: {D[seg['id']]:.2f}s")

# ── Timeline ─────────────────────────────────────────────────────────
sdur = {sc["id"]: 0.0 for sc in SPOT["scenes"]}
for seg in SPOT["segments"]:
    total = seg.get("pre", 0.3) + D[seg["id"]] + seg.get("post", 0.6)
    for sid in seg["scenes"]:
        sdur[sid] += total / len(seg["scenes"])
for sc in SPOT["scenes"]:
    if sc.get("endcard"):
        sdur[sc["id"]] = max(4.0, sdur[sc["id"]] + 0.6)
    else:
        sdur[sc["id"]] = max(2.5, sdur[sc["id"]])
starts, t = {}, 0.0
for sc in SPOT["scenes"]:
    starts[sc["id"]] = t
    t += sdur[sc["id"]]
TOTAL = t
voplan, prev_end = [], 0.0
for seg in SPOT["segments"]:
    off = max(prev_end, starts[seg["scenes"][0]]) + seg.get("pre", 0.3)
    voplan.append((seg["id"], round(off, 3)))
    prev_end = off + D[seg["id"]]
log(f"timeline: {TOTAL:.1f}s over {len(SPOT['scenes'])} scenes")

# ── Stills ───────────────────────────────────────────────────────────
def gen_still(sc):
    path = os.path.join(ROOT, "stills", f"{sc['id']}.png")
    if os.path.exists(path):
        return
    prompt = style_of(sc) + sc["content"]
    for attempt in range(3):
        try:
            model = "gpt-image-2" if attempt < 2 else "gpt-image-1"
            r = requests.post("https://api.openai.com/v1/images/generations",
                headers={"Authorization": f"Bearer {OA_KEY}"},
                json={"model": model, "prompt": prompt,
                      "size": "1536x1024", "quality": "medium", "n": 1},
                timeout=300)
            r.raise_for_status()
            open(path, "wb").write(base64.b64decode(r.json()["data"][0]["b64_json"]))
            COST["images"] += 0.06
            log(f"still {sc['id']} done")
            return
        except Exception as e:
            body = getattr(getattr(e, 'response', None), 'text', '')[:200]
            log(f"still {sc['id']} attempt {attempt+1} failed: {e} {body}")
            time.sleep(5)
    raise RuntimeError(f"still {sc['id']} failed 3x")

log("stage 2: stills")
with ThreadPoolExecutor(4) as ex:
    list(ex.map(gen_still, SPOT["scenes"]))

log("stage 3: crop + upload")
still_urls, crop_urls = {}, {}
for sc in SPOT["scenes"]:
    sid = sc["id"]
    full = os.path.join(ROOT, "stills", f"{sid}.png")
    crop = os.path.join(ROOT, "crops", f"{sid}.png")
    if not os.path.exists(crop):
        run([FFMPEG, "-y", "-i", full, "-vf", "crop=1536:864:0:80", crop])
    still_urls[sid] = upload(full, f"commercials/{SLUG}/stills/{sid}.png", "image/png")
    crop_urls[sid] = upload(crop, f"commercials/{SLUG}/crops/{sid}.png", "image/png")

# ── Clips ────────────────────────────────────────────────────────────
def start_clip(sid, frames):
    for attempt in range(8):
        r = requests.post("https://api.replicate.com/v1/predictions",
            headers={"Authorization": f"Bearer {RP_KEY}"},
            json={"version": WAN_VERSION,
                  "input": {"image": crop_urls[sid], "prompt": SPOT["motion"][sid],
                            "resolution": "480p", "num_frames": frames,
                            "frames_per_second": 16, "interpolate_output": True,
                            "go_fast": True}},
            timeout=60)
        if r.status_code == 429:
            log(f"clip {sid} rate-limited, backoff {attempt+1}")
            time.sleep(20 * (attempt + 1))
            continue
        r.raise_for_status()
        return r.json()["id"]
    raise RuntimeError(f"clip {sid} rate-limited 8x")

log("stage 4: animate")
pending = {}
for sc in SPOT["scenes"]:
    sid = sc["id"]
    if sc.get("endcard") or os.path.exists(os.path.join(ROOT, "clips", f"{sid}.mp4")):
        continue
    frames = 81 if sdur[sid] <= 5.3 else 121
    pending[sid] = (start_clip(sid, frames), frames)
    log(f"clip {sid} started ({frames}f)")
    time.sleep(2)
t0 = time.time()
while pending and time.time() - t0 < 1800:
    time.sleep(8)
    for sid, (pid, frames) in list(pending.items()):
        d = requests.get(f"https://api.replicate.com/v1/predictions/{pid}",
                         headers={"Authorization": f"Bearer {RP_KEY}"}, timeout=60).json()
        st = d.get("status")
        if st == "succeeded":
            out = d["output"]
            u = out[0] if isinstance(out, list) else out
            data = requests.get(u, timeout=300).content
            open(os.path.join(ROOT, "clips", f"{sid}.mp4"), "wb").write(data)
            COST["clips"] += 0.08 if frames > 81 else 0.06
            log(f"clip {sid} done ({len(data)//1024}KB)")
            del pending[sid]
        elif st in ("failed", "canceled"):
            log(f"clip {sid} FAILED: {d.get('error')} — retrying once")
            pending[sid] = (start_clip(sid, frames), frames)
if pending:
    raise RuntimeError(f"clips timed out: {list(pending)}")

# ── Assemble ─────────────────────────────────────────────────────────
log("stage 5: assemble")
parts = []
for sc in SPOT["scenes"]:
    sid = sc["id"]
    dur = sdur[sid]
    part = os.path.join(ROOT, "parts", f"{sid}.mp4")
    parts.append(part)
    if sc.get("endcard"):
        run([FFMPEG, "-y", "-loop", "1", "-t", str(dur),
             "-i", os.path.join(ROOT, "crops", f"{sid}.png"),
             "-vf", "scale=854:480,setsar=1,fps=30",
             "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", part])
        continue
    clip = os.path.join(ROOT, "clips", f"{sid}.mp4")
    clen = dur_of(clip)
    base = "scale=854:480:force_original_aspect_ratio=increase,crop=854:480,setsar=1"
    if dur > clen + 0.4:
        ratio = min(dur / clen, 1.6)
        pad = max(0.0, dur - clen * ratio) + 0.2
        vf = f"{base},setpts=PTS*{ratio:.4f},fps=30,tpad=stop_mode=clone:stop_duration={pad:.3f}"
    else:
        vf = f"{base},fps=30,tpad=stop_mode=clone:stop_duration=0.2"
    run([FFMPEG, "-y", "-i", clip, "-vf", vf, "-t", str(dur), "-an",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", part])
    log(f"part {sid}: clip {clen:.2f}s -> scene {dur:.2f}s")

concat_txt = os.path.join(ROOT, "parts", "list.txt")
open(concat_txt, "w").write("".join(f"file '{p}'\n" for p in parts))
video = os.path.join(ROOT, "out", "video.mp4")
run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", concat_txt, "-c", "copy", video])

inputs, filters, mixes = [], [], []
base_i = 0
if os.path.exists(PIANO):
    inputs += ["-stream_loop", "-1", "-i", PIANO]
    filters.append(f"[0:a]aresample=44100,aformat=channel_layouts=stereo,"
                   f"volume=0.13,afade=t=in:d=1.5,"
                   f"afade=t=out:st={TOTAL-3:.2f}:d=3,atrim=0:{TOTAL:.3f}[mus]")
    mixes.append("[mus]")
    base_i = 1
for j, (segid, off) in enumerate(voplan):
    inputs += ["-i", os.path.join(ROOT, "vo", f"{segid}.mp3")]
    ms = int(off * 1000)
    filters.append(f"[{base_i+j}:a]aresample=44100,aformat=channel_layouts=stereo,"
                   f"adelay={ms}|{ms}[v{j}]")
    mixes.append(f"[v{j}]")
fc = (";".join(filters) + f";{''.join(mixes)}amix=inputs={len(mixes)}:"
      f"duration=longest:normalize=0,alimiter=limit=0.95,atrim=0:{TOTAL:.3f}[out]")
audio = os.path.join(ROOT, "out", "audio.m4a")
run([FFMPEG, "-y"] + inputs + ["-filter_complex", fc, "-map", "[out]",
     "-t", str(TOTAL), "-c:a", "aac", "-b:a", "192k", audio])

final = os.path.join(ROOT, "out", f"{SLUG}-draft-480p-v1.mp4")
run([FFMPEG, "-y", "-i", video, "-i", audio, "-c:v", "copy", "-c:a", "copy",
     "-movflags", "+faststart", "-shortest", final])
log(f"final: {os.path.getsize(final)//1024}KB, {dur_of(final):.1f}s")

log("stage 6: upload")
final_url = upload(final, f"commercials/{SLUG}/{SLUG}-draft-480p-v1.mp4", "video/mp4")
clip_urls = {}
for sc in SPOT["scenes"]:
    sid = sc["id"]
    p = os.path.join(ROOT, "clips", f"{sid}.mp4")
    if os.path.exists(p):
        clip_urls[sid] = upload(p, f"commercials/{SLUG}/clips/{sid}.mp4", "video/mp4")

manifest = {
    "slug": SLUG, "final_url": final_url, "total_seconds": round(TOTAL, 1),
    "scene_durations": sdur, "voplan": voplan, "vo_durations": D,
    "stills": {sc["id"]: {"url": still_urls[sc["id"]], "crop": crop_urls[sc["id"]],
                          "style": style_of(sc), "content": sc["content"]}
               for sc in SPOT["scenes"]},
    "clips": clip_urls,
    "cost": {**COST, "total": round(sum(COST.values()), 2)},
}
open(os.path.join(ROOT, "manifest.json"), "w").write(json.dumps(manifest, indent=2))
log(f"DONE. cost ≈ ${sum(COST.values()):.2f}. {final_url}")
