#!/usr/bin/env python3
"""Re-voice the PROOF episode's narration with a different ElevenLabs voice and
rebuild its stills video — the interview clips are untouched, only the narrator
changes.

The TTS settings are EXACTLY the ones editor.js ships with (model eleven_v3,
the `[quietly] ` prefix, stability .4 / similarity .8 / style .3 / speaker
boost, then atempo 1.12 + loudnorm I=-16); only `--voice` differs. `--samples`
renders one line each way (with and without the whisper prefix) for an A/B
against the saved originals instead of rebuilding the film.

  python3 scripts/nde-revoice.py --voice <id> --tag newvoice [--samples-only]

Needs ELEVENLABS_API_KEY, ffmpeg/ffprobe, and the PROOF working files under
/home/user/out/ep1 (narration lines, cut clips, pastel panels).
"""
import argparse, json, os, subprocess, sys, urllib.request

EP = "/home/user/out/ep1"
PAS = f"{EP}/pastel"
KEY = os.environ.get("ELEVENLABS_API_KEY", "")

# editor.js NARRATION_* — do not drift from it
MODEL = "eleven_v3"
PREFIX = "[quietly] "
TEMPO = 1.12
SETTINGS = {"stability": 0.4, "similarity_boost": 0.8, "style": 0.3, "use_speaker_boost": True}

# The shipped running order: each narration line and the file it replaces.
LINES = [
    ("q00-open", "Everyone in this video came back from the edge of death. With proof."),
    ("q02-penny", "From inside her coma, Penny had been watching her family in the waiting room."),
    ("q03-darius", "Darius had drifted into a friend's house without his body."),
    ("q04-hensley", "The man who found her body came to her hospital room."),
    ("q05-tricia", "While surgeons revived her, Tricia drifted down the hall."),
    ("q06-landon", "Landon flatlined in an ambulance, watching from above."),
    ("q08-nancy", "On the other side, Nancy noticed cheap perfume and cigarette smoke. Later, she asked her sister."),
    ("q11-treadmill", "His sister left her body too, and watched their dad on the treadmill."),
    ("q12-chene", "And the man who filmed every one of these interviews. This is why he started."),
]
# c09/Pegi was cut from the episode; c07 and c10 run with no narration in front.
SEGMENTS = [  # (panel id, clip file, narration key or None)
    ("plate", "c01", "q00-open"), ("penny", "c02", "q02-penny"),
    ("darius", "c03", "q03-darius"), ("hensley", "c04", "q04-hensley"),
    ("tricia", "c05", "q05-tricia"), ("landon", "c06", "q06-landon"),
    ("malcolm", "c07", None), ("nancy", "c08", "q08-nancy"),
    ("peter", "c10", None), ("treadmill", "c11", "q11-treadmill"),
    ("chene", "c12", "q12-chene"),
]
W, H, FPS = 512, 768, 24


def run(args):
    p = subprocess.run(args, capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError(" ".join(args[:6]) + " …\n" + p.stderr[-1500:])
    return p


def dur(path):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                      "-of", "csv=p=0", path]).stdout.strip())


def tts(text, voice, out, whisper=True, plain=False, raw=False):
    """One narration line. Default = the exact editor.js path. `plain` strips
    the choices about how the narrator sounds (whisper tag, voice-settings
    override, speed-up) and leaves only the loudness match, so a film still
    mixes at the same level as the interview clips. `raw` keeps the untouched
    bytes ElevenLabs returned — nothing applied at all."""
    payload = {"text": ("" if plain else (PREFIX if whisper else "")) + text,
               "model_id": MODEL}
    if not plain:
        payload["voice_settings"] = SETTINGS
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128",
        data=body, headers={"xi-api-key": KEY, "content-type": "application/json",
                            "accept": "audio/mpeg"})
    tmp = out + ".raw.mp3"
    with urllib.request.urlopen(req, timeout=180) as r, open(tmp, "wb") as f:
        f.write(r.read())
    if raw:
        os.replace(tmp, out)
        return out
    chain = "loudnorm=I=-16:TP=-1.5:LRA=11" if plain else \
            f"atempo={TEMPO},loudnorm=I=-16:TP=-1.5:LRA=11"
    run(["ffmpeg", "-y", "-i", tmp, "-af", chain,
         "-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", "-q:a", "2", out])
    os.remove(tmp)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", required=True)
    ap.add_argument("--tag", required=True, help="filename tag for this voice")
    ap.add_argument("--samples-only", action="store_true")
    ap.add_argument("--plain", action="store_true",
                    help="no whisper tag, no voice-settings override, no speed-up")
    ap.add_argument("--raw", action="store_true",
                    help="with --samples-only: no loudness match either — untouched bytes")
    ap.add_argument("--outdir", default=f"{EP}/revoice")
    args = ap.parse_args()
    if not KEY:
        sys.exit("ELEVENLABS_API_KEY is not set")
    os.makedirs(args.outdir, exist_ok=True)
    O = args.outdir

    # A/B samples: the opening line both ways, to sit beside the saved originals
    # (norm-n00-open.mp3 = old voice plain, norm-q00-open.mp3 = old voice whispered).
    text0 = LINES[0][1]
    if args.plain:
        one = tts(text0, args.voice, f"{O}/sample-{args.tag}.mp3",
                  plain=True, raw=args.raw)
        print(f"sample {'raw' if args.raw else 'plain'} {dur(one):.2f}s  {one}")
    else:
        plain = tts(text0, args.voice, f"{O}/sample-{args.tag}-plain.mp3", whisper=False)
        quiet = tts(text0, args.voice, f"{O}/sample-{args.tag}-quiet.mp3", whisper=True)
        print(f"sample plain   {dur(plain):.2f}s  {plain}")
        print(f"sample whisper {dur(quiet):.2f}s  {quiet}")
    if args.samples_only:
        return

    # Every narration line in the new voice, shipped settings.
    narr = {}
    for key, text in LINES:
        out = f"{O}/{args.tag}-{key}.mp3"
        if not os.path.exists(out):
            tts(text, args.voice, out, plain=args.plain)
        narr[key] = out
        print(f"  narration {key}: {dur(out):.2f}s (was {dur(f'{EP}/norm-{key}.mp3'):.2f}s)")

    # Rebuild the episode audio: same structure as list-v6.txt, new narration.
    parts, seg_parts = [], []
    for i, (panel, clip, key) in enumerate(SEGMENTS):
        buf = []
        if i:
            buf.append(f"{EP}/sil3.mp3")           # spacer rides with the story
        if key:
            buf.append(narr[key])
            if i == 0:
                buf.append(f"{EP}/sil3.mp3")       # the opener's spacer follows it
        buf.append(f"{EP}/clips/{clip}.mp3")
        seg_parts.append((panel, buf))
        parts += buf
    listfile = f"{O}/list-{args.tag}.txt"
    open(listfile, "w").write("".join(f"file '{p}'\n" for p in parts))
    audio = f"{O}/PROOF-{args.tag}.mp3"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", listfile,
         "-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", "-q:a", "2", audio])
    total = dur(audio)
    print(f"\naudio {total:.1f}s → {audio}")

    # One still per story, held for that story's whole segment, then muxed.
    segdir = f"{O}/seg"
    os.makedirs(segdir, exist_ok=True)
    seg_files, acc = [], 0.0
    for i, (panel, buf) in enumerate(seg_parts):
        d = sum(dur(p) for p in buf)
        if i == len(seg_parts) - 1:
            d = max(0.5, total - acc)             # last segment absorbs concat drift
        acc += d
        out = f"{segdir}/{i:02d}-{panel}.mp4"
        run(["ffmpeg", "-y", "-loop", "1", "-i", f"{PAS}/{panel}.webp", "-t", f"{d:.3f}",
             "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
                    f"setsar=1,fps={FPS}", "-pix_fmt", "yuv420p", "-c:v", "libx264",
             "-preset", "veryfast", "-crf", "20", out])
        seg_files.append(out)
        print(f"  seg {i:02d} {panel:10} {d:6.2f}s")
    concat = f"{O}/segs-{args.tag}.txt"
    open(concat, "w").write("".join(f"file '{p}'\n" for p in seg_files))
    silent = f"{O}/silent-{args.tag}.mp4"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", silent])
    video = f"{EP}/PROOF-ep1-pastel-stills-{args.tag}.mp4"
    run(["ffmpeg", "-y", "-i", silent, "-i", audio, "-map", "0:v", "-map", "1:a",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", video])
    print(f"\nvideo {dur(video):.1f}s → {video}")


if __name__ == "__main__":
    main()
