#!/usr/bin/env python3
"""Split the hoonie loading GIF into N disjoint-frame variants.

WHY THIS EXISTS (Aug 2026, Sophie): the three Synchronicity boxes draw at the
same time and were showing the IDENTICAL hoonie at the identical moment — "they
should be asynchronous so you see different hoonies."

The obvious fix — same file, different query string per box — was MEASURED and
does not work: Chromium keeps GIF animations in step regardless of the URL
(0/12 samples had all three boxes on different frames, exactly as with one
shared URL). So the files themselves have to differ.

Each variant takes every Nth frame, so the three sets never overlap: box 0
cycles hoonies 0,3,6…, box 1 gets 1,4,7…, box 2 gets 2,5,8…. Three genuinely
different animations, and because the frames are DIVIDED rather than copied the
three files together weigh about what the single file did.

Frames are copied in P mode with their own palette and transparency index
untouched — never through RGBA — because re-quantizing is what turned an
earlier cut greeny on the app's cream (see the loading-animation note in
CLAUDE.md).

    python3 scripts/hoonie-split-gif.py [--src public/hoonie-loading-clear.gif]
                                        [--parts 3] [--out public]
"""
import argparse
import os
from PIL import Image


def split(src, parts, out_dir):
    im = Image.open(src)
    n = im.n_frames
    duration = im.info.get("duration", 200)
    loop = im.info.get("loop", 0)
    base = os.path.splitext(os.path.basename(src))[0]

    written = []
    for p in range(parts):
        idxs = list(range(p, n, parts))
        frames = []
        for i in idxs:
            im.seek(i)
            # .copy() of a seeked GIF frame keeps mode P + that frame's palette.
            frames.append(im.copy())
        dst = os.path.join(out_dir, f"{base}-{p}.gif")
        first, rest = frames[0], frames[1:]
        save_kw = dict(save_all=True, append_images=rest, duration=duration,
                       loop=loop, disposal=2, optimize=False)
        # Carry the transparency index through, or the cut-out background
        # fills in and every hoonie sits on a white square.
        if "transparency" in im.info:
            save_kw["transparency"] = im.info["transparency"]
        first.save(dst, **save_kw)
        written.append((dst, len(idxs), os.path.getsize(dst)))
    return written, n, os.path.getsize(src)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="public/hoonie-loading-clear.gif")
    ap.add_argument("--parts", type=int, default=3)
    ap.add_argument("--out", default="public")
    a = ap.parse_args()

    written, n, src_bytes = split(a.src, a.parts, a.out)
    total = sum(w[2] for w in written)
    print(f"source: {a.src}  {n} frames  {src_bytes/1024:.0f}KB")
    for dst, cnt, size in written:
        print(f"  → {dst}  {cnt} frames  {size/1024:.0f}KB")
    print(f"total {total/1024:.0f}KB across {a.parts} files "
          f"({total/src_bytes:.2f}x the single file)")


if __name__ == "__main__":
    main()
