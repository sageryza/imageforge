#!/usr/bin/env python3
"""IDEATROL commercial pipeline — 480p draft.
VO (ElevenLabs) -> stills (gpt-image-2 medium) -> clips (wan-2.2-i2v-fast 480p)
-> piano bed (musicgen) -> ffmpeg stitch -> Firebase Storage upload.
Everything logged; manifest.json written at the end for filing.
"""
import base64, json, os, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
import requests

ROOT = os.path.dirname(os.path.abspath(__file__))
FFMPEG = os.path.join(ROOT, "node_modules/ffmpeg-static/ffmpeg")
FFPROBE = os.path.join(ROOT, "node_modules/ffprobe-static/bin/linux/x64/ffprobe")
for d in ("vo", "stills", "crops", "clips", "parts", "out"):
    os.makedirs(os.path.join(ROOT, d), exist_ok=True)

EL_KEY = os.environ["ELEVENLABS_API_KEY"]
OA_KEY = os.environ["OPENAI_API_KEY"]
RP_KEY = os.environ["REPLICATE_API_TOKEN"]
BRIAN = "nPczCjzI2devNBz1zQrb"   # announcer
SARAH = "EXAVITQu4vr4xnSDxMaL"   # the woman
WAN_VERSION = "4eaf2b01d3bf70d8a2e00b219efeb7cb415855ad18b7dacdc4cae664a73a6eea"

COST = {"images": 0.0, "clips": 0.0, "music": 0.0}

def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)

def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        raise RuntimeError(f"cmd failed: {' '.join(cmd[:6])}...\n{r.stderr[-2000:]}")
    return r

def dur_of(path):
    r = run([FFPROBE, "-v", "quiet", "-show_entries", "format=duration",
             "-of", "csv=p=0", path])
    return float(r.stdout.strip())

def upload(path, dest, ctype):
    r = run(["node", os.path.join(ROOT, "upload.mjs"), path, dest, ctype], cwd=ROOT)
    return r.stdout.strip().splitlines()[-1]

# ── VO segments ──────────────────────────────────────────────────────
SEGS = {
    "seg1": (BRIAN, 1.0, "Do you lie awake at night... having concepts?"),
    "seg2": (SARAH, 1.0, "...a business... about drawing plants..."),
    "seg3": (BRIAN, 1.0, "Have you started a podcast, a puppet troupe, and a small press — this week? Do your loved ones flinch when you say, okay, hear me out?"),
    "seg4": (BRIAN, 1.0, "You may be living with C.I.O. — Chronic Idea Overproduction."),
    "seg5": (BRIAN, 1.0, "Introducing IDEATROL. IDEATROL works by gently binding to the brain's what-if receptors, so one idea can be finished... before the next four arrive."),
    "seg6": (BRIAN, 1.3, "IDEATROL is not for everyone. Do not take IDEATROL if you are a muse, married to a muse, or currently the eldest daughter of a whimsical family. Side effects may include: finishing things, alarming levels of follow-through, remembering why you walked into the room, sustained eye contact, spontaneous completion of taxes, and, in rare cases, boredom. Stop taking IDEATROL and call your doctor if you go more than four hours without a single idea, as this may be a sign of contentment. Ideas may return if you stop taking IDEATROL. In clinical trials, some patients reported that their one remaining idea was actually pretty good."),
    "seg7": (SARAH, 1.0, "Now... I just have the one."),
    "seg8": (BRIAN, 1.0, "IDEATROL. One thing at a time."),
    "seg9": (BRIAN, 1.35, "IDEATROL does not treat scope creep. Ask your doctor about scope creep."),
}

def tts_all():
    durs = {}
    for name, (voice, tempo, text) in SEGS.items():
        raw = os.path.join(ROOT, "vo", f"{name}.raw.mp3")
        fin = os.path.join(ROOT, "vo", f"{name}.mp3")
        if not os.path.exists(fin):
            r = requests.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128",
                headers={"xi-api-key": EL_KEY},
                json={"text": text, "model_id": "eleven_multilingual_v2",
                      "voice_settings": {"stability": 0.5, "similarity_boost": 0.75,
                                         "style": 0, "use_speaker_boost": True}},
                timeout=120)
            r.raise_for_status()
            open(raw, "wb").write(r.content)
            if tempo != 1.0:
                run([FFMPEG, "-y", "-i", raw, "-filter:a", f"atempo={tempo}", fin])
            else:
                os.replace(raw, fin)
        durs[name] = dur_of(fin)
        log(f"VO {name}: {durs[name]:.2f}s")
    return durs

# ── Stills ───────────────────────────────────────────────────────────
BW = ("Cinematic still from a 2000s American prescription-drug television "
      "commercial, black and white, desaturated, melancholy, soft diffused "
      "lighting, gentle depth of field, shot on 35mm film, photorealistic. ")
CO = ("Cinematic still from a 2000s American prescription-drug television "
      "commercial, warm golden lighting, soft diffused light, gentle depth of "
      "field, shot on 35mm film, photorealistic. ")
NE = ("Cinematic still from a 2000s American prescription-drug television "
      "commercial, soft diffused lighting, gentle depth of field, shot on 35mm "
      "film, photorealistic. ")
CHAR = ("The same woman appears: late 30s, shoulder-length wavy brown hair, "
        "kind tired face, sage-green cardigan over a cream top. ")

STILLS = {
    "s01": (BW + CHAR, "She sits at a kitchen table at 3 AM covered in seventeen open spiral notebooks and scribbled diagrams, head in her hands, lit by a single overhead light."),
    "s02": (BW + CHAR, "Extreme close-up of her face lit by soft lamplight, eyes wide, mid-whisper; in front of her on the table, ink sketches of houseplants."),
    "s03": (BW + CHAR, "She stands in a cluttered home office holding a podcast microphone in one hand with a felt puppet on the other hand, overwhelmed; behind her a small vintage letterpress printing machine and stacks of paper."),
    "s04": (BW + CHAR, "Her cheerful family at a dinner table exchange amused tired glances while she stands at the head of the table gesturing enthusiastically, presenting a big new idea."),
    "s05": (NE + CHAR, "She looks up toward a bright kitchen window as morning light pours in; the scene is black and white but warm golden color is blooming into it around her hopeful face."),
    "s06": ("", "Product shot from a television pharmaceutical commercial: an amber prescription pill bottle with a clean white label reading IDEATROL standing on a seamless soft white studio background, bathed in warm golden light, gentle glow, photorealistic."),
    "s07": (CO + CHAR, "In a bright morning kitchen she gently closes a single notebook and smiles with quiet relief; a houseplant on the windowsill."),
    "s08": (CO + CHAR, "She kayaks on a calm lake at golden hour, mountains behind, sunlight sparkling on the water, serene smile."),
    "s09": (CO + CHAR, "At a farmers market she hands a single neat manuscript tied with string to a golden retriever sitting attentively; flower and vegetable stalls behind."),
    "s10": (CO + CHAR, "She laughs with two friends over iced tea on a sunlit porch, relaxed, golden hour."),
    "s11": (CO + CHAR, "She stands alone on a porch at dusk in a gentle wind, hair blowing, holding a single softly glowing lightbulb in both hands like a treasure."),
    "s12": ("", "Minimal end card for a television pharmaceutical commercial: flat solid cream background, the word IDEATROL in large elegant dark serif capital letters centered, beneath it in smaller letters the tagline: One thing at a time. A small amber pill bottle sits below the text. Clean flat studio typography, no gradients."),
}

def gen_still(sid):
    path = os.path.join(ROOT, "stills", f"{sid}.png")
    if os.path.exists(path):
        return sid
    style, content = STILLS[sid]
    for attempt in range(3):
        try:
            model = "gpt-image-2" if attempt < 2 else "gpt-image-1"
            r = requests.post("https://api.openai.com/v1/images/generations",
                headers={"Authorization": f"Bearer {OA_KEY}"},
                json={"model": model, "prompt": style + content,
                      "size": "1536x1024", "quality": "medium", "n": 1},
                timeout=300)
            r.raise_for_status()
            b64 = r.json()["data"][0]["b64_json"]
            open(path, "wb").write(base64.b64decode(b64))
            COST["images"] += 0.06
            log(f"still {sid} done")
            return sid
        except Exception as e:
            log(f"still {sid} attempt {attempt+1} failed: {e}")
            time.sleep(5)
    raise RuntimeError(f"still {sid} failed 3x")

# ── Clips (wan-2.2-i2v-fast, 480p) ──────────────────────────────────
MOTION = {
    "s01": "black and white film. static camera slowly pushes in as the woman rubs her temples; papers shift slightly; the overhead light flickers gently",
    "s02": "black and white film. extreme close up; she whispers to herself, eyes darting; subtle breathing; slow push in",
    "s03": "black and white film. she looks back and forth between the microphone and the puppet, overwhelmed; slight handheld sway",
    "s04": "black and white film. she gestures excitedly pitching an idea; the family exchange glances and lean back wearily",
    "s05": "warm golden light grows across her face as she looks up slowly; dust motes drift in the light beam; color warming into the scene",
    "s06": "the pill bottle rotates slowly on its axis; glints of warm light; soft sparkle particles drift",
    "s07": "she gently closes the notebook, exhales, and smiles with relief; camera drifts slowly closer",
    "s08": "she paddles smoothly across sparkling water; slow tracking shot; gentle ripples; birds drift in the distance",
    "s09": "she hands the manuscript to the golden retriever, which takes it gently in its mouth, tail wagging; she smiles",
    "s10": "the three friends laugh together; she raises her glass; gentle breeze moves the plants",
    "s11": "wind blows her hair; she lifts the glowing bulb slightly; camera slowly pulls back; warm dusk light",
}

def start_clip(sid, image_url, frames):
    for attempt in range(8):
        r = requests.post("https://api.replicate.com/v1/predictions",
            headers={"Authorization": f"Bearer {RP_KEY}"},
            json={"version": WAN_VERSION,
                  "input": {"image": image_url, "prompt": MOTION[sid],
                            "resolution": "480p", "num_frames": frames,
                            "frames_per_second": 16, "interpolate_output": True,
                            "go_fast": True}},
            timeout=60)
        if r.status_code == 429:
            log(f"clip {sid} rate-limited, backing off ({attempt+1})")
            time.sleep(20 * (attempt + 1))
            continue
        r.raise_for_status()
        return r.json()["id"]
    raise RuntimeError(f"clip {sid}: rate-limited 8x")

def poll_clips(pending):
    t0 = time.time()
    while pending and time.time() - t0 < 1500:
        time.sleep(8)
        for sid, (pid, frames) in list(pending.items()):
            r = requests.get(f"https://api.replicate.com/v1/predictions/{pid}",
                             headers={"Authorization": f"Bearer {RP_KEY}"}, timeout=60)
            d = r.json()
            st = d.get("status")
            if st == "succeeded":
                out = d["output"]
                url = out[0] if isinstance(out, list) else out
                data = requests.get(url, timeout=300).content
                open(os.path.join(ROOT, "clips", f"{sid}.mp4"), "wb").write(data)
                COST["clips"] += 0.08 if frames > 81 else 0.06
                log(f"clip {sid} done ({len(data)//1024}KB)")
                del pending[sid]
            elif st in ("failed", "canceled"):
                log(f"clip {sid} FAILED: {d.get('error')}")
                pending[sid] = (start_clip(sid, pending_urls[sid], frames), frames)
                log(f"clip {sid} retried")
    if pending:
        raise RuntimeError(f"clips timed out: {list(pending)}")

# ── Music ────────────────────────────────────────────────────────────
def music_bed():
    path = os.path.join(ROOT, "out", "piano.mp3")
    if os.path.exists(path):
        return path
    try:
        r = requests.get("https://api.replicate.com/v1/models/meta/musicgen",
                         headers={"Authorization": f"Bearer {RP_KEY}"}, timeout=60)
        ver = r.json()["latest_version"]["id"]
        r = requests.post("https://api.replicate.com/v1/predictions",
            headers={"Authorization": f"Bearer {RP_KEY}"},
            json={"version": ver, "input": {
                "prompt": "soft gentle emotional solo piano, warm, hopeful, slow tempo, television commercial background music",
                "duration": 30, "model_version": "stereo-large",
                "output_format": "mp3"}},
            timeout=60)
        r.raise_for_status()
        pid = r.json()["id"]
        for _ in range(120):
            time.sleep(5)
            d = requests.get(f"https://api.replicate.com/v1/predictions/{pid}",
                             headers={"Authorization": f"Bearer {RP_KEY}"}, timeout=60).json()
            if d.get("status") == "succeeded":
                out = d["output"]
                url = out[0] if isinstance(out, list) else out
                open(path, "wb").write(requests.get(url, timeout=300).content)
                COST["music"] += 0.05
                log("music bed done")
                return path
            if d.get("status") in ("failed", "canceled"):
                log(f"music FAILED: {d.get('error')}")
                return None
    except Exception as e:
        log(f"music error (continuing without): {e}")
    return None

# ── Main ─────────────────────────────────────────────────────────────
log("=== stage 1: VO ===")
D = tts_all()

# timeline: list of (scene_id, duration); vo placements as (seg, abs_offset)
scenes, voplan = [], []
t = 0.0
def add(sid, dur):
    global t
    scenes.append((sid, round(dur, 3)))
    t += dur

voplan.append(("seg1", t + 0.8)); add("s01", 0.8 + D["seg1"] + 0.5)
voplan.append(("seg2", t + 0.3)); add("s02", 0.3 + D["seg2"] + 0.7)
s3t = 0.2 + D["seg3"] + 0.5
a = min(5.0, s3t * 0.5)
voplan.append(("seg3", t + 0.2)); add("s03", a); add("s04", s3t - a)
voplan.append(("seg4", t + 0.3)); add("s05", 0.3 + D["seg4"] + 0.8)
s5t = 0.2 + D["seg5"] + 0.7
a = min(5.0, s5t * 0.45)
voplan.append(("seg5", t + 0.2)); add("s06", a); add("s07", s5t - a)
s6t = 0.2 + D["seg6"] + 0.6
voplan.append(("seg6", t + 0.2))
add("s08", s6t / 3); add("s09", s6t / 3); add("s10", s6t / 3)
voplan.append(("seg7", t + 0.4))
voplan.append(("seg8", t + 0.4 + D["seg7"] + 0.7))
add("s11", 0.4 + D["seg7"] + 0.7 + D["seg8"] + 0.9)
voplan.append(("seg9", t + 0.4))
add("s12", max(4.0, 0.4 + D["seg9"] + 1.2))
TOTAL = t
log(f"timeline: {TOTAL:.1f}s over {len(scenes)} scenes")

log("=== stage 2: stills (gpt-image-2 medium) ===")
with ThreadPoolExecutor(4) as ex:
    list(ex.map(gen_still, STILLS.keys()))

log("=== stage 3: crop + upload stills ===")
still_urls, crop_urls = {}, {}
for sid in STILLS:
    full = os.path.join(ROOT, "stills", f"{sid}.png")
    crop = os.path.join(ROOT, "crops", f"{sid}.png")
    if not os.path.exists(crop):
        run([FFMPEG, "-y", "-i", full, "-vf", "crop=1536:864:0:80", crop])
    still_urls[sid] = upload(full, f"commercials/ideatrol/stills/{sid}.png", "image/png")
    crop_urls[sid] = upload(crop, f"commercials/ideatrol/crops/{sid}.png", "image/png")
    log(f"uploaded {sid}")

log("=== stage 4: animate (wan-2.2-i2v-fast 480p) ===")
sdur = dict(scenes)
pending, pending_urls = {}, {}
for sid in MOTION:
    if os.path.exists(os.path.join(ROOT, "clips", f"{sid}.mp4")):
        continue
    frames = 81 if sdur[sid] <= 5.3 else 121
    pending_urls[sid] = crop_urls[sid]
    pending[sid] = (start_clip(sid, crop_urls[sid], frames), frames)
    log(f"clip {sid} started ({frames}f)")
poll_clips(pending)

log("=== stage 5: music ===")
piano = music_bed()

log("=== stage 6: assemble ===")
parts = []
for sid, dur in scenes:
    part = os.path.join(ROOT, "parts", f"{sid}.mp4")
    parts.append(part)
    if sid == "s12":
        run([FFMPEG, "-y", "-loop", "1", "-t", str(dur),
             "-i", os.path.join(ROOT, "crops", "s12.png"),
             "-vf", "scale=854:480,setsar=1,fps=30",
             "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", part])
        continue
    clip = os.path.join(ROOT, "clips", f"{sid}.mp4")
    clen = dur_of(clip)
    pad = max(0.0, dur - clen) + 0.2
    run([FFMPEG, "-y", "-i", clip,
         "-vf", f"scale=854:480:force_original_aspect_ratio=increase,"
                f"crop=854:480,setsar=1,fps=30,"
                f"tpad=stop_mode=clone:stop_duration={pad:.3f}",
         "-t", str(dur), "-an",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", part])
    log(f"part {sid}: clip {clen:.2f}s -> scene {dur:.2f}s")

concat_txt = os.path.join(ROOT, "parts", "list.txt")
open(concat_txt, "w").write("".join(f"file '{p}'\n" for p in parts))
video = os.path.join(ROOT, "out", "video.mp4")
run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", concat_txt, "-c", "copy", video])

# audio: VO at absolute offsets + looped piano under
inputs, filters, mixes = [], [], []
base = 0
if piano:
    inputs += ["-stream_loop", "-1", "-i", piano]
    filters.append(f"[0:a]aresample=44100,aformat=channel_layouts=stereo,"
                   f"volume=0.13,afade=t=in:d=1.5,"
                   f"afade=t=out:st={TOTAL-3:.2f}:d=3,atrim=0:{TOTAL:.3f}[mus]")
    mixes.append("[mus]")
    base = 1
for j, (seg, off) in enumerate(voplan):
    inputs += ["-i", os.path.join(ROOT, "vo", f"{seg}.mp3")]
    ms = int(off * 1000)
    filters.append(f"[{base+j}:a]aresample=44100,aformat=channel_layouts=stereo,"
                   f"adelay={ms}|{ms}[v{j}]")
    mixes.append(f"[v{j}]")
n = len(mixes)
fc = ";".join(filters) + f";{''.join(mixes)}amix=inputs={n}:duration=longest:normalize=0,alimiter=limit=0.95,atrim=0:{TOTAL:.3f}[out]"
audio = os.path.join(ROOT, "out", "audio.m4a")
run([FFMPEG, "-y"] + inputs + ["-filter_complex", fc, "-map", "[out]",
     "-t", str(TOTAL), "-c:a", "aac", "-b:a", "192k", audio])

final = os.path.join(ROOT, "out", "ideatrol-draft-480p-v1.mp4")
run([FFMPEG, "-y", "-i", video, "-i", audio, "-c:v", "copy", "-c:a", "copy",
     "-movflags", "+faststart", "-shortest", final])
log(f"final: {final} ({os.path.getsize(final)//1024}KB, {dur_of(final):.1f}s)")

log("=== stage 7: upload final + clips ===")
final_url = upload(final, "commercials/ideatrol/ideatrol-draft-480p-v1.mp4", "video/mp4")
clip_urls = {}
for sid in MOTION:
    clip_urls[sid] = upload(os.path.join(ROOT, "clips", f"{sid}.mp4"),
                            f"commercials/ideatrol/clips/{sid}.mp4", "video/mp4")

manifest = {
    "final_url": final_url, "total_seconds": round(TOTAL, 1),
    "scenes": scenes, "voplan": voplan, "vo_durations": D,
    "stills": {sid: {"url": still_urls[sid], "crop": crop_urls[sid],
                     "style": STILLS[sid][0], "content": STILLS[sid][1]}
               for sid in STILLS},
    "clips": clip_urls, "motion": MOTION,
    "vo_text": {k: {"voice": "Brian" if v[0] == BRIAN else "Sarah",
                    "tempo": v[1], "text": v[2]} for k, v in SEGS.items()},
    "cost": {**COST, "total": round(sum(COST.values()), 2)},
}
open(os.path.join(ROOT, "manifest.json"), "w").write(json.dumps(manifest, indent=2))
log(f"DONE. cost ≈ ${sum(COST.values()):.2f}. final: {final_url}")
