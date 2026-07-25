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
TIGHT = os.environ.get("TIGHT") == "1"   # cut ONLY the punch-phrase, no sentence expansion
FINISH = os.environ.get("FINISH") == "1"  # cut the COMPLETE sentence containing the phrase (finish the thought)
AUDIO_ONLY = os.environ.get("AUDIO_ONLY") == "1"  # just stitch the voice clips (no cards) — art goes on top later
FINISH_PAUSE = os.environ.get("FINISH_TO_PAUSE") == "1"  # extend each clip end to the speaker's next pause (finish the thought)
FINISH_GAP = float(os.environ.get("FINISH_GAP", "0.45"))  # a pause this long counts as a sentence end
FINISH_CAP = int(os.environ.get("FINISH_CAP", "12"))      # never extend more than this many words
WHOLE = os.environ.get("WHOLE") == "1"  # cut the ENTIRE quote (opening words → closing words), then to next pause
ALIGN = os.environ.get("ALIGN", "1") == "1"  # repair Whisper's drifting word times via forced alignment (local, free)
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
MAX_TIGHT = float(os.environ.get("MAX_TIGHT", "12"))   # drop a tight clip longer than this (bad match)
MAX_FINISH = float(os.environ.get("MAX_FINISH", "20"))  # drop a finish-the-sentence clip longer than this
CACHE = os.environ.get("WCACHE", "/home/user/whisper-cache")
ACACHE = os.environ.get("ACACHE", "/home/user/align-cache")
os.makedirs(CACHE, exist_ok=True)
os.makedirs(ACACHE, exist_ok=True)
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
    span = _phrase_span(win_json, phrase)
    if not span:
        return None
    wi_start, wi_end = span
    t0, t1 = clamp_bounds(words, wi_start, wi_end)
    text = re.sub(r"\s+", " ", " ".join(words[i]["word"].strip() for i in range(wi_start, wi_end + 1))).strip()
    return (t0, t1, text)

def _phrase_span(win_json, phrase):
    """Word indices (start,end) of the best CONTIGUOUS match of `phrase` in the
    audio words — the reliable anchor everything else hangs off. None if weak."""
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
    if not best or best[0] < 0.5:
        return None
    return (best[1], best[2])

def find_quote_sentence(win_json, phrase, quote):
    """FINISH: pick the ONE sentence in the person's quote that contains the
    punch-phrase, anchor on the phrase's audio position, then extend outward by
    that sentence's word count on each side. Caption = the quote's own
    punctuated sentence. Returns a long span for a no-punctuation run-on quote
    (the whole quote reads as one 'sentence') — the caller falls back to a tight
    phrase cut in that case."""
    words = win_json.get("words") or []
    q = (quote or "").strip()
    span = _phrase_span(win_json, phrase)
    if not q or not span:
        return None
    pi_start, pi_end = span
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", q) if s.strip()] or [q]
    pn = norm(phrase or "")
    def cover(sent):
        sn = norm(sent)
        if not sn or not pn:
            return 0
        return sum(b.size for b in difflib.SequenceMatcher(a=pn, b=sn, autojunk=False).get_matching_blocks())
    target = max(sentences, key=cover) if pn else sentences[0]
    tnorm = norm(target)
    n_before, n_after = 0, 0
    if pn and tnorm:
        blocks = [b for b in difflib.SequenceMatcher(a=pn, b=tnorm, autojunk=False).get_matching_blocks() if b.size > 0]
        if blocks:
            n_before = blocks[0].b
            n_after = (len(tnorm) - 1) - min(len(tnorm) - 1, blocks[-1].b + blocks[-1].size - 1)
    wi_start = max(0, pi_start - n_before)
    wi_end = min(len(words) - 1, pi_end + n_after)
    # guard: the chosen sentence must actually match the audio we're about to cut,
    # else the picker grabbed the wrong sentence — signal a tight fallback
    audio_txt = " ".join(words[i]["word"].strip() for i in range(wi_start, wi_end + 1))
    if difflib.SequenceMatcher(a=norm(target), b=norm(audio_txt), autojunk=False).ratio() < 0.45:
        return None
    if FINISH_PAUSE:  # extend the END to the speaker's next real pause so the thought completes
        steps = 0
        while wi_end < len(words) - 1 and steps < FINISH_CAP:
            if words[wi_end + 1]["start"] - words[wi_end]["end"] >= FINISH_GAP:
                break
            wi_end += 1; steps += 1
    t0, t1 = clamp_bounds(words, wi_start, wi_end)
    return (t0, t1, target)

def detect_silences(path):
    """Real silences in the waveform via ffmpeg silencedetect — ground truth the
    Whisper timestamps lack (they drift 100ms-1s; documented, it's why WhisperX
    exists). A cut placed INSIDE a detected silence cannot clip a word."""
    p = subprocess.run(["ffmpeg", "-i", path, "-af", "silencedetect=noise=-32dB:d=0.2",
                        "-f", "null", "-"], capture_output=True, text=True)
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", p.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", p.stderr)]
    sil, ei = [], 0
    for s in starts:
        while ei < len(ends) and ends[ei] <= s:
            ei += 1
        sil.append((s, ends[ei] if ei < len(ends) else s + 0.5))
    return sil

def snap_to_silence(rs, re_, silences):
    """Move both cut points into real silences near the Whisper-derived bounds.
    End: first silence starting within [-0.45,+1.3]s of the target — close enough
    to finish the word/thought, near enough not to drag in the next sentence.
    Start: the silence ending just before the first word. No match → keep as-is."""
    re2 = re_
    for s, e in silences:
        if re_ - 0.05 <= s <= re_ + 1.0:  # forward-only: never eat the last word
            re2 = s + min(0.18, max(0.05, (e - s) * 0.4))
            break
    rs2 = rs
    cand = None
    for s, e in silences:
        if rs - 0.35 <= e <= rs + 0.15:  # only a silence that truly abuts the first word
            cand = (s, e)
    if cand:
        s, e = cand
        rs2 = max(s, e - min(0.15, max(0.04, (e - s) * 0.4)))
    if re2 <= rs2 + 0.4:
        return rs, re_  # degenerate snap — keep originals
    return rs2, re2

def clamp_bounds(words, wi_start, wi_end):
    """Gap-aware clip bounds: pad outward for a natural feel, but NEVER past the
    midpoint of the silence to the neighboring word — fixed padding used to
    swallow the first syllable of the speaker's NEXT word, which sounds exactly
    like the clip stopping mid-word."""
    t0 = words[wi_start]["start"]
    if wi_start > 0:
        gap = t0 - words[wi_start - 1]["end"]
        t0 -= min(0.15, max(0.02, gap * 0.5))
    else:
        t0 -= 0.15
    t1 = words[wi_end]["end"]
    if wi_end < len(words) - 1:
        gap = words[wi_end + 1]["start"] - t1
        t1 += min(0.30, max(0.03, gap * 0.5))
    else:
        t1 += 0.30
    return max(0, t0), t1

def find_whole_quote(win_json, quote):
    """Cut the ENTIRE quote: locate its opening words and its closing words in
    the audio and span between them (so every sentence in the quote is kept),
    then extend to the next real pause so nothing trails off mid-thought."""
    words = win_json.get("words") or []
    qw = norm(quote)
    if not words or len(qw) < 3:
        return None
    head = " ".join(qw[:min(6, len(qw))])
    tail = " ".join(qw[-min(6, len(qw)):])
    hs = _phrase_span(win_json, head)
    if not hs:
        return None
    ts = _phrase_span(win_json, tail)
    wi_start = hs[0]
    wi_end = ts[1] if (ts and ts[1] >= wi_start) else hs[1]
    # NO word-by-word extension here — it used to drag in fragments of the next
    # sentence ("because if I had to…"). The silence snap finishes the thought.
    t0, t1 = clamp_bounds(words, wi_start, wi_end)
    text = re.sub(r"\s+", " ", " ".join(words[i]["word"].strip() for i in range(wi_start, wi_end + 1))).strip()
    return (t0, t1, text)

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
audio_clips = []  # AUDIO_ONLY: normalized voice clips to stitch
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
if not AUDIO_ONLY:
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
        if ALIGN and wj.get("words"):
            acf = os.path.join(ACACHE, f"{c.get('videoId','x')}_{win_start}.json")
            if os.path.exists(acf):
                wj = {**wj, "words": json.load(open(acf))}
            else:
                wav16 = os.path.join(tmp, f"w{i}.wav")
                run(["ffmpeg","-y","-i",win,"-ar","16000","-ac","1",wav16])
                sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
                from nde_align import align_words
                aligned = align_words(wav16, wj["words"])
                json.dump(aligned, open(acf, "w"))
                wj = {**wj, "words": aligned}
        phrase = (c.get("phrase") or "").strip()
        if WHOLE:
            found = find_whole_quote(wj, quote) or find_sentence(wj, quote)
            if not found:
                print(f"  [{i}] {name}: no match in audio, skip"); continue
        elif TIGHT and phrase:
            found = find_phrase(wj, phrase)
            if not found:
                # phrase isn't really in this window (bad timestamp) — dropping
                # beats pasting the caption over unrelated audio
                print(f"  [{i}] {name}: no tight phrase match in window, dropping"); continue
        elif FINISH and phrase:
            found = find_quote_sentence(wj, phrase, quote)
            if found and (found[1] - found[0]) > MAX_FINISH:
                found = None  # no-punctuation run-on → prefer a clean tight cut
            if not found:
                # wrong-sentence or run-on → clean tight phrase beats a ramble
                found = find_phrase(wj, phrase)
            if not found:
                print(f"  [{i}] {name}: no phrase match in window, dropping"); continue
        else:
            found = find_sentence(wj, quote)
            if not found:
                print(f"  [{i}] {name}: no match in audio, skip"); continue
        rs, re_, text = found
        if TIGHT and (re_ - rs) > MAX_TIGHT:
            print(f"  [{i}] {name}: tight match too long ({re_-rs:.1f}s), dropping"); continue
        if FINISH and (re_ - rs) > MAX_FINISH:
            print(f"  [{i}] {name}: sentence too long ({re_-rs:.1f}s), dropping"); continue
        rs, re_ = snap_to_silence(rs, re_, detect_silences(win))
        clip = os.path.join(tmp, f"c{i}.mp3")
        run(["ffmpeg","-y","-ss",str(rs),"-to",str(re_),"-i",win,"-c:a","libmp3lame","-q:a","3",clip])
        if AUDIO_ONLY:
            nrm = os.path.join(tmp, f"a{i}.mp3")
            # micro-fades on the edges (editor standard) — any residual edge is inaudible
            run(["ffmpeg","-y","-i",clip,"-af",
                 "loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=0.03,areverse,afade=t=in:d=0.10,areverse",
                 "-ar","44100","-ac","1","-c:a","libmp3lame","-q:a","2",nrm])
            audio_clips.append(nrm)
        else:
            clip_card(f"· {TITLE.lower()} ·", name, f"“{text}”", clip)
        kept += 1
        print(f"  [{i}] {name}: {re_-rs:.1f}s  “{text[:60]}”")
    except Exception as e:
        print(f"  [{i}] {name}: ERROR {str(e)[:80]}")

if AUDIO_ONLY:
    listf = os.path.join(tmp, "al.txt")
    open(listf,"w").write("".join(f"file '{s}'\n" for s in audio_clips))
    run(["ffmpeg","-y","-f","concat","-safe","0","-i",listf,
         "-ar","44100","-ac","1","-c:a","libmp3lame","-q:a","2",OUT])
    print(f"\nWrote {OUT} — {kept} audio clips")
else:
    listf = os.path.join(tmp, "l.txt")
    open(listf,"w").write("".join(f"file '{s}'\n" for s in segments))
    run(["ffmpeg","-y","-f","concat","-safe","0","-i",listf,
         "-c:v","libx264","-pix_fmt","yuv420p","-r","30","-c:a","aac","-b:a","192k","-ar","48000","-ac","2",OUT])
    print(f"\nWrote {OUT} — {kept} clips")
