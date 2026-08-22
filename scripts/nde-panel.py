#!/usr/bin/env python3
"""Render full-panel NDE illustrations in Sophie's dreamy 'pencil' style.
Attaches refs/dream-mystery.jpg as a pure STYLE reference on gpt-image-2's edits
endpoint (portrait, single full-bleed panel — no 2x2 grid, no text).

  python3 nde-panel.py <scenes.json> [outdir]
scenes.json: [{"id","prompt"}]   env PANEL_QUALITY=low|medium|high (default medium)"""
import base64, json, os, sys, urllib.request, uuid

KEY = os.environ["OPENAI_API_KEY"]
SCENES = sys.argv[1]
OUTDIR = sys.argv[2] if len(sys.argv) > 2 else "/home/user/out/panels"
STYLE_REF = os.environ.get("STYLE_REF", "/home/user/imageforge/refs/dream-mystery.jpg")
QUALITY = os.environ.get("PANEL_QUALITY", "medium")
os.makedirs(OUTDIR, exist_ok=True)

PREFIX = ("The FIRST attached image is a STYLE reference — copy its drawing style, "
          "linework, hand-drawn texture, and muted palette EXACTLY, but do NOT copy "
          "its content, subjects, or composition. ")
# ── THERE IS A NEWER TAIL FOR THIS REFERENCE — PICK ON PURPOSE (Aug 2026) ──
# The SUFFIX below is the ORIGINAL wording for refs/dream-mystery.jpg and it
# still renders exactly what this script was built for: a full-bleed VERTICAL
# panel with nothing else in the frame.
#
# Sophie's current wording (dictated 2026-08-22), live in `PL_GPT_STYLES.dreamy`
# in server.js (the Playground's Dreamy tile), differs in four ways:
#   • it names no orientation      — that tile's canvas toggles portrait/square
#   • a shorter style instruction  — just "copy its drawing style", without the
#                                    linework/texture/palette list above
#   • it ASKS FOR a hand-drawn border, "like the frames in the style
#     reference" — where this script bans borders outright
#   • no "no caption boxes"        — the reference IS a diary comic and its
#                                    boxes are part of the look
# (Her tail bans text too — "no text." — so that is no longer a difference.)
# It also repeats the anti-content rule at the END, because the tail is the
# last thing the model reads.
#
# NEITHER IS "the right one" — a full-bleed NDE panel genuinely wants the bans
# this file has, and a dream-feed page genuinely does not. If you are writing
# something new against this reference, read both and choose; if you are
# rewording, say which one you started from. Do not quietly copy this SUFFIX
# into a new surface on the assumption that it is current — that is exactly
# how the Playground tile shipped a day-stale tail.
SUFFIX = (" Render as ONE single full-bleed vertical illustration — a single image, "
          "NOT a grid, NOT split panels, no borders, no caption boxes, no text or lettering anywhere.")

def gen(prompt, refpath):
    boundary = uuid.uuid4().hex
    parts = []
    def field(name, val):
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{val}\r\n".encode())
    field("model", "gpt-image-2"); field("prompt", prompt)
    field("size", "1024x1536"); field("quality", QUALITY); field("output_format", "webp")
    with open(refpath, "rb") as f:
        img = f.read()
    parts.append((f"--{boundary}\r\nContent-Disposition: form-data; name=\"image[]\"; "
                  f"filename=\"ref.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n").encode() + img + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=b"".join(parts),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": f"multipart/form-data; boundary={boundary}"})
    d = json.load(urllib.request.urlopen(req, timeout=300))
    if d.get("error"):
        raise RuntimeError(d["error"]["message"])
    return base64.b64decode(d["data"][0]["b64_json"])

scenes = json.load(open(SCENES))
print(f"{len(scenes)} panels · style={STYLE_REF.split('/')[-1]} · quality={QUALITY}\n")
for s in scenes:
    try:
        img = gen(PREFIX + s["prompt"] + SUFFIX, STYLE_REF)
        p = os.path.join(OUTDIR, s["id"] + ".webp")
        open(p, "wb").write(img)
        print(f"  OK {s['id']}: {len(img)//1024} KB → {p}")
    except Exception as e:
        print(f"  ERR {s['id']}: {str(e)[:140]}")
