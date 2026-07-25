#!/usr/bin/env python3
"""Objective edge check for a stitched montage: slice it back into clips (by the
per-clip durations the cutter printed), Whisper each slice, and compare its
first/last words to the expected quote's head/tail. Flags leading/trailing
stray words and missing words — no human ear required.

  python3 nde-verify-cuts.py <montage.mp3> <durations csv> <order.json>"""
import json, os, re, subprocess, sys, tempfile, urllib.request, uuid

KEY = os.environ["OPENAI_API_KEY"]
MONTAGE, DURS, ORDER = sys.argv[1], [float(x) for x in sys.argv[2].split(",")], sys.argv[3]
cands = json.load(open(ORDER))
tmp = tempfile.mkdtemp(prefix="verify-")

def norm(s):
    return re.sub(r"[^a-z0-9 ]", "", s.lower()).split()

def whisper_text(path):
    boundary = uuid.uuid4().hex
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\nwhisper-1\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.mp3\"\r\n"
            f"Content-Type: audio/mpeg\r\n\r\n").encode() + open(path, "rb").read() + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request("https://api.openai.com/v1/audio/transcriptions", data=body,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": f"multipart/form-data; boundary={boundary}"})
    return json.load(urllib.request.urlopen(req, timeout=120)).get("text", "")

off = 0.0
problems = 0
for i, (dur, c) in enumerate(zip(DURS, cands), 1):
    seg = os.path.join(tmp, f"s{i}.mp3")
    subprocess.run(["ffmpeg", "-y", "-ss", str(off), "-t", str(dur), "-i", MONTAGE,
                    "-c:a", "libmp3lame", "-q:a", "4", seg],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    heard = norm(whisper_text(seg))
    q = norm(c.get("quote", ""))
    name = c.get("experiencer", "?")[:28]
    issues = []
    if heard and q:
        # leading junk: heard words before the quote's first words appear
        if q[:2] != heard[:2] and " ".join(q[:2]) in " ".join(heard[:6]):
            lead = heard[:" ".join(heard).find(" ".join(q[:2])) and heard.index(q[0])]
            issues.append(f"leading extra: «{' '.join(heard[:3])}…»")
        elif q[0] not in heard[:3]:
            issues.append(f"start mismatch: heard «{' '.join(heard[:4])}» want «{' '.join(q[:4])}»")
        # trailing junk: words after the quote's tail
        tail = q[-2:]
        ht = heard[-4:]
        if tail[-1] not in ht:
            issues.append(f"end: heard «…{' '.join(heard[-4:])}» want «…{' '.join(q[-3:])}»")
    status = "OK " if not issues else "!! "
    problems += bool(issues)
    print(f"{status}[{i:2d}] {name:28s} {'; '.join(issues) if issues else 'edges clean'}")
    off += dur
print(f"\n{problems} clip(s) flagged of {len(DURS)}")
