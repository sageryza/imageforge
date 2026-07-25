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
VERT = os.environ.get("VERTICAL") == "1"
TIGHT = os.environ.get("TIGHT") == "1"  # cut ONLY the punch-phrase, no sentence expansion
if VERT:
    W, H = 1080, 1920
    LABEL_SZ, QUOTE_SZ, NAME_SZ, TITLE_SZ = 38, 56, 42, 72
    LABEL_Y, NAME_Y, WRAP = "200", "h-300", 20
else:
    W, H = 1280, 720
    LABEL_SZ, QUOTE_SZ, NAME_SZ, TITLE_SZ = 26, 40, 30, 60
    LABEL_Y, NAME_Y, WRAP = "80", "h-130", 38

CAND = sys.argv[1]
TITLE = sys.argv[2] if len(sys.argv) > 2 else "THE COLORS"
OUT = sys.argv[3] if len(sys.argv) > 3 else "/tmp/nde-precise.mp4"
MAX_TIGHT = float(os.environ.get("MAX_TIGHT", "12"))  # drop a tight clip longer than this (bad match)
CACHE = os.environ.get("WCACHE", "/home/user/whisper-cache")
os.makedirs(CACHE, exist_ok=True)
tmp = tempfile.mkdtemp(prefix="precise-")

def run(a): subprocess.run(a, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def norm(s): return re.sub(r"[^a-z0-9 ]", "", s.lower()).split()

def clean_name(n):
    n = (n or "").strip()
    m = re.match(r"(?:the )?near[- ]death experiences? of (.+)", n, re.I)
    if m: return m.group(1).strip().rstrip(".")
    m = re.search(r"(?:interview with|with) ([A-Z][\w.'-]+(?: [A-Z][\w.'-]+){0,2})", n)
    if m: return m.group(1).strip()
    return n

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

def find_phrase(win_json, phrase):
    """TIGHT: return (rel_start, rel_end, text) of JUST the punch-phrase's word
    span. Slides a phrase-length window over the audio words and takes the
    best-matching CONTIGUOUS run — so a repeated word later in the clip can't
    stretch the cut across half a minute. Caption = the real audio words."""
    words = win_json.get("words") or []
    if not words:
        return None
    ww = [norm(w["word"])[0] if norm(w["word"]) else "" for w in words]
    pw = norm(phrase)
    if not pw:
        return None
    n = len(pw)
    best = None  # (ratio, start_idx, end_idx)
    for L in range(n, n + 4):  # allow whisper to insert up to 3 extra words
        for i in range(0, max(1, len(ww) - L + 1)):
            win = ww[i:i + L]
            if not win:
                continue
            r = difflib.SequenceMatcher(a=pw, b=win, autojunk=False).ratio()
            if best is None or r > best[0]:
                best = (r, i, min(i + L - 1, len(words) - 1))
    if not best or best[0] < 0.5:  # no trustworthy contiguous match
        return None
    _, wi_start, wi_end = best
    t0 = words[wi_start]["start"] - 0.12
    t1 = words[wi_end]["end"] + 0.28
    if t1 - t0 < 1.1:  # min length floor so a 3-word phrase isn't a blip
        pad = (1.1 - (t1 - t0)) / 2
        t0 -= pad; t1 += pad
    text = re.sub(r"\s+", " ", " ".join(words[i]["word"].strip() for i in range(wi_start, wi_end + 1))).strip()
    return (max(0, t0), t1, text)

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

def wrap(text, width=None):
    if width is None: width = WRAP
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
         "-vf",draw(t,FONT_B,TITLE_SZ,C_QUOTE,"(h-text_h)/2"),
         "-c:v","libx264","-pix_fmt","yuv420p","-r","30","-c:a","aac","-b:a","192k","-ar","48000","-ac","2","-shortest",seg])
    segments.append(seg)

def clip_card(label, name, quote_text, clip_mp3):
    global seg_i
    d = float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",clip_mp3],
        capture_output=True,text=True).stdout.strip() or 8)
    lf,qf,nf = tf(f"l{seg_i}.txt",label), tf(f"q{seg_i}.txt",wrap(quote_text)), tf(f"n{seg_i}.txt",name)
    vf = ",".join([draw(lf,FONT,LABEL_SZ,C_LABEL,LABEL_Y),draw(qf,FONT_B,QUOTE_SZ,C_QUOTE,"(h-text_h)/2"),draw(nf,FONT,NAME_SZ,C_NAME,NAME_Y)])
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
    name = clean_name(c.get("experiencer","—")) or "—"
    if not url:
        print(f"  [{i}] {name}: no audio, skip"); continue
    win_start = max(0, t - 25)
    win = os.path.join(tmp, f"w{i}.mp3")
    try:
        run(["ffmpeg","-y","-ss",str(win_start),"-t","80","-i",url,"-c:a","libmp3lame","-q:a","4",win])
        cachef = os.path.join(CACHE, f"{c.get('videoId','x')}_{win_start}.json")
        if os.path.exists(cachef):
            wj = json.load(open(cachef))
        else:
            wj = whisper_words(win)
            json.dump(wj, open(cachef, "w"))
        phrase = (c.get("phrase") or "").strip()
        if TIGHT and phrase:
            found = find_phrase(wj, phrase)
            if not found:
                # phrase isn't really in this window (bad timestamp) — dropping
                # beats pasting the caption over unrelated audio
                print(f"  [{i}] {name}: no tight phrase match in window, dropping"); continue
        else:
            found = find_sentence(wj, quote)
            if not found:
                print(f"  [{i}] {name}: no match in audio, skip"); continue
        rs, re_, text = found
        if TIGHT and (re_ - rs) > MAX_TIGHT:
            print(f"  [{i}] {name}: tight match too long ({re_-rs:.1f}s), dropping"); continue
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
