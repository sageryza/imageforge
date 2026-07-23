#!/usr/bin/env python3
"""Precise supercut builder. For each candidate {videoId, quote, timeSec,
audioUrl}, it LISTENS (Whisper word timestamps on a window of the real audio),
snaps the cut to the complete sentence(s), so no word is chopped and the
on-screen text is EXACTLY what's spoken. Then renders name+quote cards.

  node/py nde-supercut-precise.py <candidates.json> "SECTION TITLE" <out.mp4>
"""
import json, os, re, subprocess, sys, tempfile, urllib.request, difflib

KEY = os.environ["OPENAI_API_KEY"]
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
BG, C_LABEL, C_QUOTE, C_NAME = "0x141422", "0x7c7c96", "0xF2EEE2", "0xE0A94A"
W, H = 1280, 720

CAND = sys.argv[1]
TITLE = sys.argv[2] if len(sys.argv) > 2 else "THE COLORS"
OUT = sys.argv[3] if len(sys.argv) > 3 else "/tmp/nde-precise.mp4"
tmp = tempfile.mkdtemp(prefix="precise-")

def run(a): subprocess.run(a, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def norm(s): return re.sub(r"[^a-z0-9 ]", "", s.lower()).split()

def whisper_words(path):
    """OpenAI verbose_json with word+segment timestamps."""
    import http.client, mimetypes, uuid
    boundary = uuid.uuid4().hex
    fields = {"model": "whisper-1", "response_format": "verbose_json",
              "timestamp_granularities[]": "word"}
    body = b""
    for k, v in fields.items():
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    with open(path, "rb") as f: data = f.read()
    body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.mp3\"\r\n"
             f"Content-Type: audio/mpeg\r\n\r\n").encode() + data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request("https://api.openai.com/v1/audio/transcriptions", data=body,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": f"multipart/form-data; boundary={boundary}"})
    return json.load(urllib.request.urlopen(req, timeout=180))

def find_sentence(win_json, quote):
    """Return (rel_start, rel_end, text) of the complete sentence(s) matching quote."""
    words = win_json.get("words") or []
    segs = win_json.get("segments") or []
    if not words:
        return None
    ww = [norm(w["word"])[0] if norm(w["word"]) else "" for w in words]
    qw = norm(quote)
    sm = difflib.SequenceMatcher(a=qw, b=ww, autojunk=False)
    blocks = [b for b in sm.get_matching_blocks() if b.size > 0]
    if not blocks:
        return None
    b0, bn = blocks[0], blocks[-1]
    wi_start = b0.b
    wi_end = min(len(words) - 1, bn.b + bn.size - 1)
    t0, t1 = words[wi_start]["start"], words[wi_end]["end"]
    # expand to whole Whisper segments (clean sentence boundaries)
    text_parts, s0, s1 = [], t0, t1
    if segs:
        overlapping = [s for s in segs if s["end"] > t0 and s["start"] < t1]
        if overlapping:
            s0 = min(s["start"] for s in overlapping)
            s1 = max(s["end"] for s in overlapping)
            text_parts = [s["text"].strip() for s in overlapping]
    text = " ".join(text_parts).strip() or quote
    return (max(0, s0 - 0.15), s1 + 0.35, text)

def wrap(text, width=38):
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > width: lines.append(cur); cur = w
        else: cur = (cur + " " + w).strip()
    if cur: lines.append(cur)
    return "\n".join(lines[:8])

def tf(name, content):
    p = os.path.join(tmp, name)
    open(p, "w").write(content.replace("%", "\\%")); return p

def draw(f, font, size, color, y):
    return (f"drawtext=textfile='{f}':fontfile='{font}':fontsize={size}:fontcolor={color}:"
            f"x=(w-text_w)/2:y={y}:line_spacing=12:text_align=C")

segments = []
seg_i = 0

def title_card(title):
    global seg_i
    t = tf(f"t{seg_i}.txt", title); seg = os.path.join(tmp, f"s{seg_i:03d}.mp4"); seg_i += 1
    run(["ffmpeg","-y","-f","lavfi","-i",f"color=c={BG}:s={W}x{H}:r=30:d=2.4",
         "-f","lavfi","-i","anullsrc=r=48000:cl=stereo","-t","2.4",
         "-vf",draw(t,FONT_B,60,C_QUOTE,"(h-text_h)/2"),
         "-c:v","libx264","-pix_fmt","yuv420p","-r","30","-c:a","aac","-b:a","192k","-ar","48000","-ac","2","-shortest",seg])
    segments.append(seg)

def clip_card(label, name, quote_text, clip_mp3):
    global seg_i
    d = float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",clip_mp3],
        capture_output=True,text=True).stdout.strip() or 8)
    lf,qf,nf = tf(f"l{seg_i}.txt",label), tf(f"q{seg_i}.txt",wrap(quote_text)), tf(f"n{seg_i}.txt",name)
    vf = ",".join([draw(lf,FONT,26,C_LABEL,"80"),draw(qf,FONT_B,40,C_QUOTE,"(h-text_h)/2"),draw(nf,FONT,30,C_NAME,"h-130")])
    seg = os.path.join(tmp, f"s{seg_i:03d}.mp4"); seg_i += 1
    run(["ffmpeg","-y","-f","lavfi","-i",f"color=c={BG}:s={W}x{H}:r=30:d={d+0.2}","-i",clip_mp3,
         "-vf",vf,"-map","0:v","-map","1:a","-af","loudnorm=I=-16:TP=-1.5:LRA=11",
         "-c:v","libx264","-pix_fmt","yuv420p","-r","30","-c:a","aac","-b:a","192k","-ar","48000","-ac","2","-shortest",seg])
    segments.append(seg)

cands = json.load(open(CAND))
print(f"{len(cands)} candidates → precise cutting\n")
title_card(TITLE)
kept = 0
for i, c in enumerate(cands, 1):
    url, quote, t = c.get("audioUrl"), c.get("quote",""), int(c.get("timeSec") or 0)
    name = c.get("experiencer","—")
    if not url:
        print(f"  [{i}] {name}: no audio, skip"); continue
    win_start = max(0, t - 25)
    win = os.path.join(tmp, f"w{i}.mp3")
    try:
        run(["ffmpeg","-y","-ss",str(win_start),"-t","80","-i",url,"-c:a","libmp3lame","-q:a","4",win])
        wj = whisper_words(win)
        found = find_sentence(wj, quote)
        if not found:
            print(f"  [{i}] {name}: no match in audio, skip"); continue
        rs, re_, text = found
        clip = os.path.join(tmp, f"c{i}.mp3")
        run(["ffmpeg","-y","-ss",str(rs),"-to",str(re_),"-i",win,"-c:a","libmp3lame","-q:a","3",clip])
        clip_card(f"· {TITLE.lower()} ·", name, f"“{text}”", clip)
        kept += 1
        print(f"  [{i}] {name}: {re_-rs:.1f}s  “{text[:60]}”")
    except Exception as e:
        print(f"  [{i}] {name}: ERROR {str(e)[:80]}")

listf = os.path.join(tmp, "l.txt")
open(listf,"w").write("".join(f"file '{s}'\n" for s in segments))
run(["ffmpeg","-y","-f","concat","-safe","0","-i",listf,
     "-c:v","libx264","-pix_fmt","yuv420p","-r","30","-c:a","aac","-b:a","192k","-ar","48000","-ac","2",OUT])
print(f"\nWrote {OUT} — {kept} clips")
