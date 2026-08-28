#!/usr/bin/env python3
"""Film a still page — slow zooms and drifts across one image, cut together.

    python3 scripts/comic-zoom.py shots.json out.mp4
    python3 scripts/comic-zoom.py shots.json out.mp4 --audio dad.m4a --fit-audio
    python3 scripts/comic-zoom.py shots.json --stills /tmp/frames   # check framing, no render

Why not ffmpeg's zoompan: it rounds the zoom to whole pixels every frame, so a
slow push judders. Here every frame is a float-precision crop resized with
LANCZOS (PIL's `resize(box=…)` takes a subpixel box), piped raw into ffmpeg —
smooth at any speed, and pan + zoom can move at once.

THE SHOT LIST (json):

    {
      "page":  "docs/movies/assets/daddy-flying-page.jpg",
      "size":  [1080, 1620],          # 2:3 portrait, her phone rule
      "fps":   30,
      "dissolve": 0.6,                # seconds of cross-fade between shots
      "shots": [
        {"name":"the whole page", "from":"page", "to":"page", "zoom":1.06, "sec":4.5},
        {"name":"daddy",   "from":[72,43,466,388], "to":[95,60,250,208], "sec":5},
        {"name":"Dave",    "from":[597,744,466,477], "to":[700,800,240,246], "sec":6, "ease":"out"}
      ]
    }

  from / to  a rect [x, y, w, h] in the PAGE's own pixels, or "page" for all of
             it, or "prev" for exactly where the last shot ended (use it at
             every join meant to read as one continuous move — a rect that is
             merely close leaves the cross-fade visibly ghosting two copies of
             the page), or the name of an entry in "boxes" (a dict of named
             rects, so a shot list reads like a shot list). Each rect is grown to the
             canvas's aspect around its own centre, so you frame what matters
             and never do the arithmetic.
  zoom       shorthand: `to` = `from` pushed in by this factor (1.06 = a slow
             creep). Ignored when `to` is given.
  sec        how long the move takes. ease: "inout" (default), "in", "out",
             "linear".
  dissolve   this shot's own cross-fade in, overriding the film's. Set 0 on a
             shot that CONTINUES the last one (see "prev") — a continued move
             must not be blended, only cut into.
  line       what the narrator says over this shot. With --voice, the shot is
             timed to the take: `sec` becomes lead + the line's real length +
             tail, so the camera arrives when the words do. A shot with no line
             is a beat of silence and keeps its own `sec`.

    python3 scripts/comic-zoom.py shots.json out.mp4 --voice ZOw6P0YnswJ6JNjpj9wF

TTS renders on eleven_multilingual_v2 — NEVER eleven_v3, which collapses a
clone's likeness (`docs/narration-voice-settings.md`). Takes are cached by
(voice, model, text), so re-cutting the film re-spends nothing; only an edited
line is re-rendered. The narration bed is assembled in PCM, never from AAC
pieces — AAC priming adds ~24ms per join and walks the voice off the pictures.

The camera itself is local ffmpeg + PIL: a render with no new lines costs nothing.
"""

import argparse, hashlib, json, os, shutil, struct, subprocess, sys, wave
from PIL import Image

# ---------------------------------------------------------------- geometry

def as_rect(spec, page_rect, boxes):
    """A shot's rect spec -> [x, y, w, h] in page pixels."""
    if spec is None:
        return None
    if isinstance(spec, str):
        if spec == "page":
            return list(page_rect)
        if spec in boxes:
            return as_rect(boxes[spec], page_rect, boxes)
        raise SystemExit(f"comic-zoom: no box named {spec!r}")
    if len(spec) != 4:
        raise SystemExit(f"comic-zoom: a rect is [x,y,w,h], got {spec!r}")
    return [float(v) for v in spec]


def fit_aspect(rect, aspect):
    """Grow a rect around its centre until it matches the canvas aspect (w/h)."""
    x, y, w, h = rect
    cx, cy = x + w / 2, y + h / 2
    if w / h > aspect:
        h = w / aspect
    else:
        w = h * aspect
    return [cx - w / 2, cy - h / 2, w, h]


def push(rect, factor):
    x, y, w, h = rect
    cx, cy = x + w / 2, y + h / 2
    w, h = w / factor, h / factor
    return [cx - w / 2, cy - h / 2, w, h]


def clamp(rect, stage_w, stage_h):
    """Keep the frame on the stage — slide it in, and only shrink as a last resort."""
    x, y, w, h = rect
    if w > stage_w or h > stage_h:
        k = min(stage_w / w, stage_h / h)
        cx, cy = x + w / 2, y + h / 2
        w, h = w * k, h * k
        x, y = cx - w / 2, cy - h / 2
    x = min(max(x, 0), stage_w - w)
    y = min(max(y, 0), stage_h - h)
    return [x, y, w, h]


EASE = {
    "linear": lambda t: t,
    "in": lambda t: t * t,
    "out": lambda t: 1 - (1 - t) ** 2,
    "inout": lambda t: 3 * t * t - 2 * t * t * t,
}


def lerp_rect(a, b, t):
    """Centre moves linearly; the zoom moves geometrically, which is what reads
    as a steady push — halving the width takes as long from 900px as from 450."""
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    w = aw * (bw / aw) ** t
    h = ah * (bh / ah) ** t
    cx = (ax + aw / 2) + ((bx + bw / 2) - (ax + aw / 2)) * t
    cy = (ay + ah / 2) + ((by + bh / 2) - (ay + ah / 2)) * t
    return [cx - w / 2, cy - h / 2, w, h]


# ---------------------------------------------------------------- the stage

def build_stage(page, size, margin):
    """The page on its own paper, big enough that a whole-page shot has air
    around it. Shot coordinates stay in the page's own pixels — the offset is
    added here, once."""
    pw, ph = page.size
    aspect = size[0] / size[1]
    # the whole page, framed to the canvas, plus margin
    want_w, want_h = pw * (1 + margin), ph * (1 + margin)
    if want_w / want_h > aspect:
        want_h = want_w / aspect
    else:
        want_w = want_h * aspect
    sw, sh = int(round(want_w)), int(round(want_h))
    stage = Image.new("RGB", (sw, sh), paper_colour(page))
    ox, oy = (sw - pw) // 2, (sh - ph) // 2
    stage.paste(page, (ox, oy))
    return stage, (ox, oy)


def paper_colour(page):
    """The page's own border colour, so the margin is paper and not a matte."""
    small = page.resize((60, 60), Image.LANCZOS)
    px = small.load()
    edge = [px[x, y] for x in range(60) for y in range(60)
            if x < 2 or y < 2 or x > 57 or y > 57]
    edge.sort(key=lambda c: sum(c))
    return edge[len(edge) // 2]


# ---------------------------------------------------------------- the render

def load_shots(path):
    with open(path) as fh:
        spec = json.load(fh)
    root = os.path.dirname(os.path.abspath(path))
    page_path = spec["page"]
    if not os.path.isabs(page_path) and not os.path.exists(page_path):
        page_path = os.path.join(root, page_path)
    spec["_page_path"] = page_path
    return spec


def plan(spec):
    """-> (stage image, [shot dicts with absolute from/to rects and durations])"""
    page = Image.open(spec["_page_path"]).convert("RGB")
    size = tuple(spec.get("size", [1080, 1620]))
    stage, (ox, oy) = build_stage(page, size, spec.get("margin", 0.06))
    aspect = size[0] / size[1]
    page_rect = [0, 0, page.size[0], page.size[1]]
    boxes = spec.get("boxes", {})

    shots, prev = [], None
    for raw in spec["shots"]:
        def stage_rect(spec_):
            """A shot's rect, on the stage, framed to the canvas."""
            r = as_rect(spec_, page_rect, boxes)
            return clamp(fit_aspect([r[0] + ox, r[1] + oy, r[2], r[3]], aspect), *stage.size)

        # "prev" = exactly where the last shot ended. Anything else at a join
        # leaves the two frames a few pixels apart and the cross-fade ghosts.
        if raw.get("from") == "prev" and prev is not None:
            a = list(prev)
        else:
            a = stage_rect(raw.get("from", "page"))
        if raw.get("to") == "prev" and prev is not None:
            b = list(prev)
        elif raw.get("to") is not None:
            b = stage_rect(raw["to"])
        else:
            b = clamp(push(a, float(raw.get("zoom", 1.0))), *stage.size)
        prev = b
        shots.append({
            "name": raw.get("name", ""),
            "line": raw.get("line", ""),
            "dis_raw": raw.get("dissolve"),
            "a": a, "b": b,
            "sec": float(raw.get("sec", 4)),
            "ease": EASE[raw.get("ease", "inout")],
        })
    return stage, shots, size


# ---------------------------------------------------------------- narration

EL_MODEL = "eleven_multilingual_v2"          # never eleven_v3 — it loses the clone
EL_SETTINGS = {"stability": 0.5, "similarity_boost": 0.75,
               "style": 0, "use_speaker_boost": True}
SR = 44100


def tts(text, voice, cache):
    """One line in one voice -> a wav path. Cached by (voice, model, text)."""
    os.makedirs(cache, exist_ok=True)
    key = hashlib.sha1(f"{voice}|{EL_MODEL}|{json.dumps(EL_SETTINGS, sort_keys=True)}|{text}"
                       .encode()).hexdigest()[:16]
    wav = os.path.join(cache, key + ".wav")
    if os.path.exists(wav):
        return wav, False
    mp3 = os.path.join(cache, key + ".mp3")
    key_env = os.environ.get("ELEVENLABS_API_KEY")
    if not key_env:
        raise SystemExit("comic-zoom: --voice needs ELEVENLABS_API_KEY")
    body = json.dumps({"text": text, "model_id": EL_MODEL, "voice_settings": EL_SETTINGS})
    r = subprocess.run(
        ["curl", "-sS", "-X", "POST", "-o", mp3, "-w", "%{http_code}",
         f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128",
         "-H", f"xi-api-key: {key_env}", "-H", "content-type: application/json",
         "-d", body], capture_output=True, text=True)
    if r.stdout.strip() != "200":
        detail = open(mp3, "rb").read()[:300].decode("utf-8", "replace") if os.path.exists(mp3) else ""
        raise SystemExit(f"comic-zoom: elevenlabs said {r.stdout.strip()} {detail}")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", mp3,
                    "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le", wav], check=True)
    os.remove(mp3)
    return wav, True


def narrate(shots, voice, cache, lead, tail, quiet=False):
    """Render every line, then let each line's real length set its shot's `sec`."""
    spent = 0
    for s in shots:
        if not s.get("line"):
            continue
        path, fresh = tts(s["line"], voice, cache)
        spent += len(s["line"]) if fresh else 0
        s["wav"] = path
        s["dur"] = probe_duration(path)
        s["sec"] = max(s.get("sec", 0), lead + s["dur"] + tail)
        if not quiet:
            print(f"  [{'new ' if fresh else 'cache'}] {s['dur']:4.1f}s  {s['name']}: {s['line'][:60]}")
    if not quiet:
        print(f"[tts] {spent} characters rendered this run "
              f"(~${spent * 0.00022:.2f} of ElevenLabs credit)")


def build_bed(shots, starts, total, lead, out):
    """The narration track: each take laid at its own shot's start, silence
    between. Assembled as PCM — AAC pieces would drift under the pictures."""
    buf = bytearray(int(total * SR) * 2 + 2)
    for s, st in zip(shots, starts):
        if not s.get("wav"):
            continue
        with wave.open(s["wav"], "rb") as w:
            frames = w.readframes(w.getnframes())
        at = int((st + lead) * SR) * 2
        end = min(at + len(frames), len(buf))
        if end > at:
            buf[at:end] = frames[:end - at]
    with wave.open(out, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(bytes(buf))
    return out


def frame_at(stage, rect, size):
    x, y, w, h = rect
    return stage.resize(size, Image.LANCZOS, box=(x, y, x + w, y + h))


def render(spec, out, audio=None, fit_audio=False, voice=None, cache=None,
           quiet=False):
    stage, shots, size = plan(spec)
    fps = int(spec.get("fps", 30))
    dissolve = float(spec.get("dissolve", 0.6))
    lead = float(spec.get("lead", 0.45))     # the camera moves first, then he speaks
    tail = float(spec.get("tail", 0.7))      # and the shot holds after the line

    if voice:
        narrate(shots, voice, cache or "/tmp/comic-zoom-tts", lead, tail, quiet)

    # Each shot's own cross-fade IN. A shot that continues the previous move
    # (from: "prev", or the same rect) must set 0: during an overlap the
    # outgoing shot is still travelling while the incoming one waits at its
    # start rect, so ANY blend there shows two copies of the page at once.
    for i, s in enumerate(shots):
        d = s.get("dis_raw")
        s["dis"] = 0.0 if i == 0 else float(dissolve if d is None else d)

    if fit_audio and audio:
        want = probe_duration(audio)
        have = sum(s["sec"] for s in shots) - sum(s["dis"] for s in shots)
        k = want / have
        for s in shots:
            s["sec"] *= k
        if not quiet:
            print(f"[fit] stretched the shots x{k:.3f} to the {want:.1f}s of audio")

    # a shot starts its own dissolve before the one before it ends
    starts, t = [], 0.0
    for s in shots:
        t -= s["dis"]
        starts.append(t)
        t += s["sec"]
    total = t
    n_frames = max(1, int(round(total * fps)))

    if voice:
        audio = build_bed(shots, starts, total, lead,
                          os.path.splitext(out)[0] + ".narration.wav")

    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{size[0]}x{size[1]}", "-r", str(fps), "-i", "-"]
    if audio:
        cmd += ["-i", audio]
    cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", "18",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
    if audio:
        cmd += ["-c:a", "aac", "-b:a", "192k", "-shortest"]
    cmd += [out]

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(n_frames):
        now = i / fps
        live = []
        for s, st in zip(shots, starts):
            if st - 1e-6 <= now < st + s["sec"]:
                live.append((s, (now - st) / s["sec"]))
        if not live:
            live = [(shots[-1], 1.0)]
        img = None
        for s, u in live:
            f = frame_at(stage, lerp_rect(s["a"], s["b"], s["ease"](min(max(u, 0), 1))), size)
            if img is None:
                img = f
            else:
                # the incoming shot fades up over its own dissolve
                w = min(max(u * s["sec"] / s["dis"], 0), 1) if s["dis"] > 0 else 1
                img = Image.blend(img, f, w)
        proc.stdin.write(img.tobytes())
        if not quiet and i % (fps * 5) == 0:
            print(f"  {now:5.1f}s / {total:.1f}s", flush=True)
    proc.stdin.close()
    if proc.wait() != 0:
        raise SystemExit("comic-zoom: ffmpeg failed")
    if not quiet:
        print(f"[done] {out}  {total:.1f}s  {n_frames} frames")
    return total


def stills(spec, outdir):
    """First and last frame of every shot — check the framing before rendering."""
    stage, shots, size = plan(spec)
    os.makedirs(outdir, exist_ok=True)
    for i, s in enumerate(shots):
        slug = (s["name"] or f"shot{i}").replace(" ", "-").replace("/", "-")
        for tag, rect in (("a", s["a"]), ("b", s["b"])):
            p = os.path.join(outdir, f"{i:02d}-{slug}-{tag}.jpg")
            frame_at(stage, rect, size).save(p, quality=88)
            print(p)


def probe_duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                          "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True).stdout.strip()
    return float(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("shots")
    ap.add_argument("out", nargs="?")
    ap.add_argument("--audio", help="voiceover to lay under the whole film")
    ap.add_argument("--fit-audio", action="store_true",
                    help="stretch every shot proportionally to the audio's length")
    ap.add_argument("--voice", metavar="ID",
                    help="ElevenLabs voice id — speaks each shot's `line` and times "
                         "the shot to it (Steve Ryza, her dad: ZOw6P0YnswJ6JNjpj9wF)")
    ap.add_argument("--tts-cache", default="/tmp/comic-zoom-tts",
                    help="where rendered takes are kept, so a re-cut re-spends nothing")
    ap.add_argument("--stills", metavar="DIR",
                    help="write each shot's first and last frame instead of rendering")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        raise SystemExit("comic-zoom: needs ffmpeg on PATH")
    spec = load_shots(args.shots)

    if args.stills:
        stills(spec, args.stills)
        return
    if not args.out:
        raise SystemExit("comic-zoom: give me an output file (or --stills DIR)")
    render(spec, args.out, audio=args.audio, fit_audio=args.fit_audio,
           voice=args.voice, cache=args.tts_cache, quiet=args.quiet)


if __name__ == "__main__":
    main()
