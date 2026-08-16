#!/usr/bin/env python3
"""Instagram-reel engine (portrait 2:3). Usage: make_reel.py <slug>
Scene kinds: live (gpt still + wan), dream (style-ref edit + wan),
chat/appui/memui (self-rendered crisp UI frames), endcard (self-rendered).
Message pops + doorbell synthesized locally. Resumable like make_spot.
"""
import base64, json, os, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
import requests

SLUG = sys.argv[1]
HOME = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HOME, "reels", SLUG)
for d in ("vo", "stills", "frames", "clips", "parts", "out", "sfx"):
    os.makedirs(os.path.join(ROOT, d), exist_ok=True)
REEL = json.load(open(os.path.join(HOME, "reels.json")))[SLUG]

FFMPEG = os.path.join(HOME, "node_modules/ffmpeg-static/ffmpeg")
FFPROBE = os.path.join(HOME, "node_modules/ffprobe-static/bin/linux/x64/ffprobe")
EL_KEY = os.environ["ELEVENLABS_API_KEY"]
OA_KEY = os.environ["OPENAI_API_KEY"]
RP_KEY = os.environ["REPLICATE_API_TOKEN"]
WAN_VERSION = "4eaf2b01d3bf70d8a2e00b219efeb7cb415855ad18b7dacdc4cae664a73a6eea"
STYLE_REF = "/home/user/imageforge/refs/dream-mystery.jpg"
W, H = 480, 720
COST = {"images": 0.0, "clips": 0.0, "music": 0.0}

LIVE_CO = ("Vertical cinematic still from a warm romantic short-film style social "
           "media commercial, natural golden lighting, soft depth of field, "
           "photorealistic. ")
LIVE_BW = ("Vertical cinematic still from a social media commercial, black and "
           "white, desaturated, deadpan comedy framing, soft depth of field, "
           "photorealistic. ")

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

# ── gpt stills ───────────────────────────────────────────────────────
def gen_image(path, prompt, size, edit_ref=None):
    if os.path.exists(path):
        return
    for attempt in range(3):
        try:
            if edit_ref:
                with open(edit_ref, "rb") as f:
                    r = requests.post("https://api.openai.com/v1/images/edits",
                        headers={"Authorization": f"Bearer {OA_KEY}"},
                        data={"model": "gpt-image-2", "prompt": prompt,
                              "size": size, "quality": "medium", "n": "1"},
                        files=[("image[]", ("style-ref.jpg", f, "image/jpeg"))],
                        timeout=300)
                COST["images"] += 0.07
            else:
                r = requests.post("https://api.openai.com/v1/images/generations",
                    headers={"Authorization": f"Bearer {OA_KEY}"},
                    json={"model": "gpt-image-2", "prompt": prompt,
                          "size": size, "quality": "medium", "n": 1},
                    timeout=300)
                COST["images"] += 0.06
            r.raise_for_status()
            open(path, "wb").write(base64.b64decode(r.json()["data"][0]["b64_json"]))
            log(f"image {os.path.basename(path)} done")
            return
        except Exception as e:
            body = getattr(getattr(e, "response", None), "text", "")[:200]
            log(f"image {os.path.basename(path)} attempt {attempt+1} failed: {e} {body}")
            time.sleep(5)
    raise RuntimeError(f"image failed 3x: {path}")

def still_prompt(sc):
    chars = "".join(REEL["chars"][c] for c in sc.get("chars", []))
    pre = LIVE_BW if sc.get("bw") else LIVE_CO
    return pre + chars + sc["content"]

DREAM_PRE = ("Draw this scene entirely in the hand-drawn style of the attached "
             "reference image, but leave the caption strip at the bottom of the "
             "card completely BLANK — no words, no letters, no text anywhere in "
             "the image. ")

# ── UI frame HTML ────────────────────────────────────────────────────
BODY = ("margin:0;width:512px;height:768px;overflow:hidden;"
        "font-family:-apple-system,'Segoe UI',Roboto,sans-serif;")


def b64img(p):
    return "data:image/png;base64," + base64.b64encode(open(p, "rb").read()).decode()

def chat_html(states_msgs, typing, header):
    rows = ""
    for who, text in states_msgs:
        me = who == "me"
        style = (
            "align-self:flex-end;background:#3f7cff;border-radius:18px 18px 5px 18px;"
            if me else
            "align-self:flex-start;background:#2a2a33;border-radius:18px 18px 18px 5px;")
        rows += (f"<div style='{style}color:#fff;padding:11px 15px;max-width:72%;"
                 f"font-size:17px;line-height:1.35'>{text}</div>")
    if typing:
        me = typing == "me"
        style = ("align-self:flex-end;background:#3f7cff;border-radius:18px 18px 5px 18px;"
                 if me else
                 "align-self:flex-start;background:#2a2a33;border-radius:18px 18px 18px 5px;")
        rows += (f"<div style='{style}color:#aab;padding:13px 17px;font-size:16px;"
                 f"letter-spacing:3px'>&#9679;&#9679;&#9679;</div>")
    return f"""<body style="{BODY}background:#0d0d12;display:flex;flex-direction:column">
<div style="padding:46px 0 14px;text-align:center;border-bottom:1px solid #1d1d24">
  <div style="width:52px;height:52px;border-radius:50%;background:#3a3a46;color:#fff;
    font-size:22px;line-height:52px;margin:0 auto 8px">{header[0]}</div>
  <div style="color:#e8e8ee;font-size:15px">{header}</div>
</div>
<div style="flex:1;display:flex;flex-direction:column;gap:10px;padding:20px 16px;
  justify-content:flex-end">{rows}</div>
<div style="margin:0 14px 24px;height:40px;border-radius:20px;background:#1a1a21;
  color:#555;font-size:15px;line-height:40px;padding-left:16px">Message</div>
</body>"""

def appui_html(thumb_path, highlight):
    btn = ("<div style='margin-top:12px;display:inline-block;background:#6b5aa0;"
           "color:#f0eaf8;font-size:15px;padding:9px 22px;border-radius:6px'>read</div>"
           if highlight else "")
    ring = "box-shadow:0 0 0 3px #6b5aa0;" if highlight else ""
    return f"""<body style="{BODY}background:#17131f;text-align:center">
<div style="padding-top:56px;color:#e8e2f2;font-family:Georgia,serif;font-size:30px">dreams</div>
<div style="color:#7d738f;font-size:13px;margin-top:4px">the night feed</div>
<div style="margin:36px 26px 0;background:#221c2e;border-radius:12px;padding:14px;{ring}">
  <img src="{b64img(thumb_path)}" style="width:100%;height:330px;object-fit:cover;border-radius:8px">
  <div style="color:#e8e2f2;font-size:17px;margin-top:12px;text-align:left">last night &middot; Maya</div>
  <div style="color:#7d738f;font-size:13px;margin-top:3px;text-align:left">&#9789; a dream about someone</div>
  {btn}
</div>
</body>"""

def memui_html(card_path, caption, idx, total, sub="Sophie &middot; ages 6&ndash;8"):
    dots = "".join(
        f"<span style='display:inline-block;width:7px;height:7px;border-radius:50%;"
        f"margin:0 4px;background:{'#22201b' if i == idx else '#d8cfb8'}'></span>"
        for i in range(total))
    return f"""<body style="{BODY}background:#faf4e6;text-align:center">
<div style="padding-top:52px;color:#22201b;font-family:Georgia,serif;font-size:24px;
  letter-spacing:0.04em">Memory Library</div>
<div style="color:#8a8371;font-size:13px;font-style:italic;margin-top:4px">{sub}</div>
<div style="margin:30px 30px 0;background:#fffdf6;border:1px solid #e3dbc6;border-radius:6px;
  padding:14px">
  <img src="{b64img(card_path)}" style="width:100%;height:420px;object-fit:cover;border-radius:4px">
  <div style="color:#22201b;font-family:Georgia,serif;font-style:italic;font-size:19px;
    margin:16px 6px 8px">{caption}</div>
</div>
<div style="margin-top:22px">{dots}</div>
</body>"""

WPAL = {"bg": "#14101c", "panel": "#221a30", "gold": "#c9a86a", "ink": "#ece5f4",
        "dim": "#8d81a6"}

def witui_html(st):
    v = st["view"]
    P = WPAL
    if v == "lock":
        return f"""<body style="{BODY}background:#0a0812;text-align:center;color:#ece5f4">
<div style="padding-top:170px;font-size:26px;color:#8d81a6">{st.get('date', 'Wednesday')}</div>
<div style="font-size:110px;font-weight:200;margin-top:6px">{st['text']}</div>
</body>"""
    if v == "entry":
        return f"""<body style="{BODY}background:{P['bg']};color:{P['ink']}">
<div style="padding:54px 0 12px;text-align:center;font-family:Georgia,serif;
  font-size:26px;color:{P['gold']}">Book of Shadows</div>
<div style="text-align:center"><span style="display:inline-block;border:1px solid {P['gold']};
  color:{P['gold']};font-size:13px;padding:5px 14px;border-radius:6px">{st.get('type', 'A synchronicity')}</span></div>
<div style="margin:30px 26px 0;background:{P['panel']};border-radius:10px;padding:22px;
  min-height:220px;font-family:Georgia,serif;font-size:21px;line-height:1.5;
  color:{P['ink']}">{st['text']}<span style="color:{P['gold']}">&#9615;</span></div>
<div style="text-align:center;margin-top:26px"><span style="display:inline-block;
  background:{P['gold']};color:#14101c;font-size:16px;padding:11px 34px;
  border-radius:6px">Save to the book</span></div>
</body>"""
    if v == "feed":
        rows = ""
        for r in st["rows"]:
            hl = f"border:1px solid {P['gold']};" if r.get("mine") else ""
            rows += (f"<div style='margin:0 26px 12px;background:{P['panel']};{hl}"
                     f"border-radius:10px;padding:16px 18px;text-align:left'>"
                     f"<div style='font-family:Georgia,serif;font-size:17px;"
                     f"line-height:1.45'>{r['text']}</div>"
                     f"<div style='color:{P['dim']};font-size:13px;margin-top:6px'>{r['who']}</div></div>")
        return f"""<body style="{BODY}background:{P['bg']};color:{P['ink']};text-align:center">
<div style="padding:54px 0 4px;font-family:Georgia,serif;font-size:26px;
  color:{P['gold']}">Tonight, near you</div>
<div style="color:{P['dim']};font-size:13px;font-style:italic;margin-bottom:24px">
  synchronicities from the last day</div>
{rows}
</body>"""
    rows = ""
    for r in st["rows"]:
        rows += (f"<div style='margin:0 26px 10px;padding:14px 16px;background:{P['panel']};"
                 f"border-radius:8px;text-align:left'>"
                 f"<span style='color:{P['gold']};font-size:12px'>{r['tag']}</span>"
                 f"<div style='font-family:Georgia,serif;font-size:16px;margin-top:4px'>{r['text']}</div></div>")
    return f"""<body style="{BODY}background:{P['bg']};color:{P['ink']};text-align:center">
<div style="padding:54px 0 4px;font-family:Georgia,serif;font-size:26px;
  color:{P['gold']}">Book of Shadows</div>
<div style="color:{P['dim']};font-size:13px;font-style:italic;margin-bottom:22px">
  readings, synchronicities, spell work and dreams &mdash; in one place</div>
{rows}
</body>"""

def endcard_html(style):
    if style == "witch":
        return f"""<body style="{BODY}background:#14101c;text-align:center">
<div style="padding-top:290px;color:#c9a86a;font-family:Georgia,serif;font-size:42px">Secretly a Witch</div>
<div style="color:#8d81a6;font-family:Georgia,serif;font-style:italic;font-size:21px;
  margin-top:18px">Someone else saw it too.</div>
</body>"""
    if style == "witchbook":
        return f"""<body style="{BODY}background:#14101c;text-align:center">
<div style="padding-top:290px;color:#c9a86a;font-family:Georgia,serif;font-size:42px">Secretly a Witch</div>
<div style="color:#8d81a6;font-family:Georgia,serif;font-style:italic;font-size:21px;
  margin-top:18px">Keep the book.</div>
</body>"""
    if style == "dreams":
        return f"""<body style="{BODY}background:#17131f;text-align:center">
<div style="padding-top:280px;color:#f0eaf8;font-family:Georgia,serif;font-size:64px">dreams</div>
<div style="color:#b9aed2;font-family:Georgia,serif;font-style:italic;font-size:21px;
  margin-top:18px">read the dream.</div>
</body>"""
    return f"""<body style="{BODY}background:#faf4e6;text-align:center">
<div style="padding-top:270px;color:#22201b;font-family:Georgia,serif;font-size:40px;
  letter-spacing:0.08em">MEMORY<br>LIBRARY</div>
<div style="color:#444033;font-family:Georgia,serif;font-style:italic;font-size:21px;
  margin-top:20px">Skip the small talk.</div>
<div style="color:#8a8371;font-size:16px;margin-top:34px;
  font-family:-apple-system,sans-serif">incaseofamnesia.com</div>
</body>"""

# ── 1. VO ────────────────────────────────────────────────────────────
D = {}
for seg in REEL.get("segments", []):
    fin = os.path.join(ROOT, "vo", f"{seg['id']}.mp3")
    if not os.path.exists(fin):
        voice = REEL["announcer"] if seg["v"] == "A" else REEL["character"]
        r = requests.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128",
            headers={"xi-api-key": EL_KEY},
            json={"text": seg["text"], "model_id": "eleven_multilingual_v2",
                  "voice_settings": {"stability": 0.5, "similarity_boost": 0.75,
                                     "style": 0, "use_speaker_boost": True}},
            timeout=120)
        r.raise_for_status()
        open(fin, "wb").write(r.content)
    D[seg["id"]] = dur_of(fin)
    log(f"VO {seg['id']}: {D[seg['id']]:.2f}s")

# ── 2. gpt stills (live/dream/memui cards) ──────────────────────────
jobs = []
for sc in REEL["scenes"]:
    if sc["kind"] == "live":
        jobs.append((os.path.join(ROOT, "stills", f"{sc['id']}.png"),
                     still_prompt(sc), "1024x1536", None))
    elif sc["kind"] == "dream":
        jobs.append((os.path.join(ROOT, "stills", f"{sc['id']}.png"),
                     DREAM_PRE + sc["content"], "1024x1536", STYLE_REF))
    elif sc["kind"] == "memui":
        for card in sc["cards"]:
            jobs.append((os.path.join(ROOT, "stills", f"{card['id']}.png"),
                         DREAM_PRE + card["content"], "1024x1024", STYLE_REF))
log(f"stage 2: {len(jobs)} gpt images")
with ThreadPoolExecutor(4) as ex:
    list(ex.map(lambda j: gen_image(*j), jobs))

# ── 3. UI frames ─────────────────────────────────────────────────────
shots, frame_plan = [], {}
for sc in REEL["scenes"]:
    sid = sc["id"]
    if sc["kind"] == "chat":
        frame_plan[sid] = []
        for i, st in enumerate(sc["states"]):
            f = os.path.join(ROOT, "frames", f"{sid}-{i}.png")
            frame_plan[sid].append((f, st["hold"], st.get("pop", False)))
            shots.append({"file": f, "html": chat_html(
                st["msgs"], st.get("typing"), REEL.get("chat_header", ""))})
    elif sc["kind"] == "appui":
        thumb = os.path.join(ROOT, "stills", f"{sc['embed']}.png")
        frame_plan[sid] = []
        for i, hold in enumerate(sc["dur_states"]):
            f = os.path.join(ROOT, "frames", f"{sid}-{i}.png")
            frame_plan[sid].append((f, hold, i == 0))
            shots.append({"file": f, "html": appui_html(thumb, i == 1)})
    elif sc["kind"] == "memui":
        frame_plan[sid] = []
        for i, (hold, card) in enumerate(zip(sc["dur_states"], sc["cards"])):
            f = os.path.join(ROOT, "frames", f"{sid}-{i}.png")
            frame_plan[sid].append((f, hold, True))
            shots.append({"file": f, "html": memui_html(
                os.path.join(ROOT, "stills", f"{card['id']}.png"),
                card["caption"], i, len(sc["cards"]),
                **({"sub": REEL["mem_sub"]} if REEL.get("mem_sub") else {}))})
    elif sc["kind"] == "witui":
        frame_plan[sid] = []
        for i, st in enumerate(sc["states"]):
            f = os.path.join(ROOT, "frames", f"{sid}-{i}.png")
            frame_plan[sid].append((f, st["hold"], st.get("pop", False)))
            shots.append({"file": f, "html": witui_html(st)})
    elif sc["kind"] == "endcard":
        f = os.path.join(ROOT, "frames", f"{sid}.png")
        frame_plan[sid] = [(f, sc["dur"], False)]
        shots.append({"file": f, "html": endcard_html(sc["style"])})
shots_json = os.path.join(ROOT, "frames", "shots.json")
open(shots_json, "w").write(json.dumps(shots))
run(["node", os.path.join(HOME, "chat_shot.mjs"), shots_json])
log(f"stage 3: {len(shots)} UI frames rendered")

# ── 4. timeline ──────────────────────────────────────────────────────
sdur = {}
for sc in REEL["scenes"]:
    if sc["kind"] in ("chat", "appui", "memui", "witui", "endcard"):
        sdur[sc["id"]] = sum(h for _, h, _ in frame_plan[sc["id"]])
    else:
        sdur[sc["id"]] = sc["dur"]
for seg in REEL.get("segments", []):
    need = seg["off"] + D[seg["id"]] + 0.5
    if need > sdur[seg["scene"]]:
        sdur[seg["scene"]] = need
starts, t = {}, 0.0
for sc in REEL["scenes"]:
    starts[sc["id"]] = t
    t += sdur[sc["id"]]
TOTAL = t
log(f"timeline: {TOTAL:.1f}s over {len(REEL['scenes'])} scenes")

# ── 5. wan clips ─────────────────────────────────────────────────────
def start_clip(sid, image_url, motion, frames):
    for attempt in range(8):
        r = requests.post("https://api.replicate.com/v1/predictions",
            headers={"Authorization": f"Bearer {RP_KEY}"},
            json={"version": WAN_VERSION,
                  "input": {"image": image_url, "prompt": motion,
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

still_urls = {}
pending = {}
for sc in REEL["scenes"]:
    sid = sc["id"]
    if sc["kind"] not in ("live", "dream"):
        continue
    still = os.path.join(ROOT, "stills", f"{sid}.png")
    still_urls[sid] = upload(still, f"commercials/reels/{SLUG}/stills/{sid}.png", "image/png")
    if os.path.exists(os.path.join(ROOT, "clips", f"{sid}.mp4")):
        continue
    frames = 81 if sdur[sid] <= 5.3 else 121
    pending[sid] = (start_clip(sid, still_urls[sid], sc["motion"], frames), frames, sc["motion"])
    log(f"clip {sid} started ({frames}f)")
    time.sleep(2)
t0 = time.time()
while pending and time.time() - t0 < 1800:
    time.sleep(8)
    for sid, (pid, frames, motion) in list(pending.items()):
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
            pending[sid] = (start_clip(sid, still_urls[sid], motion, frames), frames, motion)
if pending:
    raise RuntimeError(f"clips timed out: {list(pending)}")

# ── 6. music + sfx ───────────────────────────────────────────────────
piano = os.path.join(ROOT, "out", "music.mp3")
if not os.path.exists(piano):
    try:
        ver = requests.get("https://api.replicate.com/v1/models/meta/musicgen",
                           headers={"Authorization": f"Bearer {RP_KEY}"}, timeout=60
                           ).json()["latest_version"]["id"]
        r = requests.post("https://api.replicate.com/v1/predictions",
            headers={"Authorization": f"Bearer {RP_KEY}"},
            json={"version": ver, "input": {"prompt": REEL["music"], "duration": 30,
                  "model_version": "stereo-large", "output_format": "mp3"}},
            timeout=60)
        r.raise_for_status()
        pid = r.json()["id"]
        for _ in range(120):
            time.sleep(5)
            d = requests.get(f"https://api.replicate.com/v1/predictions/{pid}",
                             headers={"Authorization": f"Bearer {RP_KEY}"}, timeout=60).json()
            if d.get("status") == "succeeded":
                out = d["output"]
                u = out[0] if isinstance(out, list) else out
                open(piano, "wb").write(requests.get(u, timeout=300).content)
                COST["music"] += 0.05
                log("music done")
                break
            if d.get("status") in ("failed", "canceled"):
                piano = None
                break
    except Exception as e:
        log(f"music error (continuing): {e}")
        piano = None

pop = os.path.join(ROOT, "sfx", "pop.wav")
bell = os.path.join(ROOT, "sfx", "bell.wav")
if not os.path.exists(pop):
    run([FFMPEG, "-y", "-f", "lavfi",
         "-i", "sine=frequency=880:duration=0.09",
         "-af", "volume=0.5,afade=t=in:d=0.005,afade=t=out:st=0.04:d=0.05", pop])
if not os.path.exists(bell):
    run([FFMPEG, "-y", "-f", "lavfi",
         "-i", "sine=frequency=659:duration=0.45",
         "-f", "lavfi", "-i", "sine=frequency=523:duration=0.6",
         "-filter_complex",
         "[0:a]afade=t=out:st=0.15:d=0.3,adelay=0|0[a];"
         "[1:a]afade=t=out:st=0.2:d=0.4,adelay=350|350[b];"
         "[a][b]amix=inputs=2:normalize=0,volume=0.5[out]",
         "-map", "[out]", bell])

events = []
for sc in REEL["scenes"]:
    sid = sc["id"]
    if sid in frame_plan:
        tt = starts[sid]
        for f, hold, popflag in frame_plan[sid]:
            if popflag:
                events.append((tt, pop))
            tt += hold
    if sc.get("sfx") == "doorbell":
        events.append((starts[sid] + 0.3, bell))

# ── 7. assemble ──────────────────────────────────────────────────────
parts = []
SC = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1"
for sc in REEL["scenes"]:
    sid = sc["id"]
    dur = sdur[sid]
    part = os.path.join(ROOT, "parts", f"{sid}.mp4")
    parts.append(part)
    if sc["kind"] in ("chat", "appui", "memui", "witui", "endcard"):
        minis = []
        for i, (f, hold, _) in enumerate(frame_plan[sid]):
            mini = os.path.join(ROOT, "parts", f"{sid}-{i}.mp4")
            minis.append(mini)
            run([FFMPEG, "-y", "-loop", "1", "-t", f"{hold:.3f}", "-i", f,
                 "-vf", f"{SC},fps=30", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                 "-preset", "fast", mini])
        if len(minis) == 1:
            os.replace(minis[0], part)
        else:
            lst = os.path.join(ROOT, "parts", f"{sid}-list.txt")
            open(lst, "w").write("".join(f"file '{m}'\n" for m in minis))
            run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", part])
        continue
    clip = os.path.join(ROOT, "clips", f"{sid}.mp4")
    clen = dur_of(clip)
    if dur > clen + 0.4:
        ratio = min(dur / clen, 1.6)
        pad = max(0.0, dur - clen * ratio) + 0.2
        vf = f"{SC},setpts=PTS*{ratio:.4f},fps=30,tpad=stop_mode=clone:stop_duration={pad:.3f}"
    else:
        vf = f"{SC},fps=30,tpad=stop_mode=clone:stop_duration=0.2"
    run([FFMPEG, "-y", "-i", clip, "-vf", vf, "-t", str(dur), "-an",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", part])
    log(f"part {sid}: clip {clen:.2f}s -> {dur:.2f}s")

lst = os.path.join(ROOT, "parts", "list.txt")
open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
video = os.path.join(ROOT, "out", "video.mp4")
run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", video])

inputs, filters, mixes = [], [], []
idx = 0
if piano:
    inputs += ["-stream_loop", "-1", "-i", piano]
    filters.append(f"[{idx}:a]aresample=44100,aformat=channel_layouts=stereo,"
                   f"volume=0.16,afade=t=in:d=1.0,"
                   f"afade=t=out:st={TOTAL-2.5:.2f}:d=2.5,atrim=0:{TOTAL:.3f}[mus]")
    mixes.append("[mus]")
    idx += 1
for seg in REEL.get("segments", []):
    inputs += ["-i", os.path.join(ROOT, "vo", f"{seg['id']}.mp3")]
    ms = int((starts[seg["scene"]] + seg["off"]) * 1000)
    filters.append(f"[{idx}:a]aresample=44100,aformat=channel_layouts=stereo,"
                   f"adelay={ms}|{ms}[s{idx}]")
    mixes.append(f"[s{idx}]")
    idx += 1
for at, sfile in events:
    inputs += ["-i", sfile]
    ms = int(at * 1000)
    filters.append(f"[{idx}:a]aresample=44100,aformat=channel_layouts=stereo,"
                   f"adelay={ms}|{ms}[s{idx}]")
    mixes.append(f"[s{idx}]")
    idx += 1
fc = (";".join(filters) + f";{''.join(mixes)}amix=inputs={len(mixes)}:"
      f"duration=longest:normalize=0,alimiter=limit=0.95,atrim=0:{TOTAL:.3f}[out]")
audio = os.path.join(ROOT, "out", "audio.m4a")
run([FFMPEG, "-y"] + inputs + ["-filter_complex", fc, "-map", "[out]",
     "-t", str(TOTAL), "-c:a", "aac", "-b:a", "192k", audio])

final = os.path.join(ROOT, "out", f"{SLUG}-reel-draft-v1.mp4")
run([FFMPEG, "-y", "-i", video, "-i", audio, "-c:v", "copy", "-c:a", "copy",
     "-movflags", "+faststart", "-shortest", final])
log(f"final: {os.path.getsize(final)//1024}KB, {dur_of(final):.1f}s")

final_url = upload(final, f"commercials/reels/{SLUG}/{SLUG}-reel-draft-v1.mp4", "video/mp4")
manifest = {
    "slug": SLUG, "final_url": final_url, "total_seconds": round(TOTAL, 1),
    "scene_durations": sdur,
    "stills": {sc["id"]: {"url": still_urls.get(sc["id"]),
                          "style": (LIVE_BW if sc.get("bw") else LIVE_CO) +
                                   "".join(REEL["chars"][c] for c in sc.get("chars", []))
                                   if sc["kind"] == "live" else
                                   (DREAM_PRE + " [style ref: dream-mystery.jpg attached]"
                                    if sc["kind"] == "dream" else ""),
                          "content": sc.get("content", "")}
               for sc in REEL["scenes"] if sc["kind"] in ("live", "dream")},
    "memcards": {c["id"]: {"caption": c["caption"], "content": c["content"]}
                 for sc in REEL["scenes"] if sc["kind"] == "memui"
                 for c in sc["cards"]},
    "cost": {**COST, "total": round(sum(COST.values()), 2)},
}
open(os.path.join(ROOT, "manifest.json"), "w").write(json.dumps(manifest, indent=2))
log(f"DONE. cost ≈ ${sum(COST.values()):.2f}. {final_url}")
