#!/usr/bin/env python3
"""Build an NDE supercut video from the banked clips: person after person,
each clip playing over a flat card showing their name + quote. Runs in the
cloud session (ffmpeg + the public clip URLs) — no laptop."""
import json, os, re, subprocess, sys, tempfile, urllib.request

SERVER = "https://imageforge-q125.onrender.com"
THEMES_FILE = "/home/user/nde-themes.json"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
BG = "0x141422"       # deep ink, flat (no gradients)
C_LABEL = "0x7c7c96"  # muted lavender-grey
C_QUOTE = "0xF2EEE2"  # warm off-white
C_NAME = "0xE0A94A"   # gold
W, H = 1280, 720
SECTIONS = [("colors", "THE COLORS"), ("telepathy", "TALKING MIND TO MIND")]
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/nde-supercut-colors-telepathy.mp4"

tmp = tempfile.mkdtemp(prefix="supercut-")

def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip()
    try: return float(out)
    except: return 8.0

def wrap(text, width=36):
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > width:
            lines.append(cur); cur = w
        else:
            cur = (cur + " " + w).strip()
    if cur: lines.append(cur)
    return "\n".join(lines[:8])

def textfile(name, content):
    p = os.path.join(tmp, name)
    with open(p, "w") as f:
        f.write(content.replace("%", "\\%"))
    return p

def draw(tf, font, size, color, y):
    # y can be an expression; center horizontally
    return (f"drawtext=textfile='{tf}':fontfile='{font}':fontsize={size}:fontcolor={color}:"
            f"x=(w-text_w)/2:y={y}:line_spacing=12:text_align=C")

# ── theme data (experiencer + quote in the same order the clips were numbered) ──
themes = {t["key"]: t for t in json.load(open(THEMES_FILE))["themes"]}
clips = [c for c in json.load(urllib.request.urlopen(f"{SERVER}/api/nde/clips?run=original"))["clips"]]
by_theme = {}
for c in clips:
    parts = c["path"].split("/")
    if len(parts) == 2:
        by_theme.setdefault(parts[0], []).append(c)

segments = []
seg_i = 0

def add_title(title):
    global seg_i
    tf = textfile(f"t{seg_i}.txt", title)
    seg = os.path.join(tmp, f"seg{seg_i:03d}.mp4"); seg_i += 1
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c={BG}:s={W}x{H}:r=30:d=2.4",
         "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "2.4",
         "-vf", draw(tf, FONT_B, 60, C_QUOTE, "(h-text_h)/2"),
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30",
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-shortest", seg])
    segments.append(seg)

def add_clip(theme_title, name, quote, url):
    global seg_i
    mp3 = os.path.join(tmp, f"a{seg_i}.mp3")
    urllib.request.urlretrieve(url, mp3)
    d = dur(mp3)
    lf = textfile(f"l{seg_i}.txt", theme_title)
    qf = textfile(f"q{seg_i}.txt", wrap(quote))
    nf = textfile(f"n{seg_i}.txt", name)
    vf = ",".join([
        draw(lf, FONT, 26, C_LABEL, "80"),
        draw(qf, FONT_B, 42, C_QUOTE, "(h-text_h)/2"),
        draw(nf, FONT, 30, C_NAME, "h-130"),
    ])
    seg = os.path.join(tmp, f"seg{seg_i:03d}.mp4"); seg_i += 1
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c={BG}:s={W}x{H}:r=30:d={d+0.2}",
         "-i", mp3, "-vf", vf, "-map", "0:v", "-map", "1:a",
         "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30",
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-shortest", seg])
    segments.append(seg)

for key, title in SECTIONS:
    hits = themes[key]["hits"]
    files = sorted(by_theme.get(key, []), key=lambda c: c["path"])
    if not files:
        print(f"no clips for {key}"); continue
    add_title(title)
    for c in files:
        m = re.match(r"(\d+)_", c["path"].split("/")[1])
        idx = int(m.group(1)) - 1 if m else 0
        hit = hits[idx] if 0 <= idx < len(hits) else {}
        name = hit.get("experiencer", "").strip() or "—"
        quote = (hit.get("quote", "") or "").strip().strip('"')
        print(f"  {key} [{idx+1}] {name}: {quote[:50]}")
        add_clip(f"· {title.lower()} ·", name, f"“{quote}”", c["url"])

# concat (re-encode so timestamps are clean)
listf = os.path.join(tmp, "list.txt")
with open(listf, "w") as f:
    for s in segments:
        f.write(f"file '{s}'\n")
run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", listf,
     "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", OUT])
print(f"\nWrote {OUT} ({len(segments)} segments)")
