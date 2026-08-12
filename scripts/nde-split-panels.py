#!/usr/bin/env python3
"""Cut a multi-panel page into its separate panels.

The panel trick: draw N scenes as one image with a hard ink border on the exact
middle, then slice — so a 2¢ low-quality page is 1¢ a panel (2-up) or 0.5¢ a
panel (2x2). Geometry matters:

  2-up  1536x1024 → two 768x1024 panels (3:4 portrait)
  2x2   1024x1536 → four 512x768 panels (2:3 portrait — the film's aspect)

  python3 nde-split-panels.py <image.webp> <2up|2x2> [outdir]
  python3 nde-split-panels.py <prompts.json> --auto [outdir]

With --auto it reads a renderer prompts.json and splits every record carrying a
"split" field, naming the pieces from that record's "ids" list when present.

The cut trims `--gutter` px (default 6) off each inside edge so the drawn ink
border doesn't survive as a black stripe down one side of a panel.
"""
import json, os, sys

from PIL import Image

LAYOUTS = {
    "2up": (2, 1),   # columns, rows
    "2x2": (2, 2),
    "1x2": (1, 2),   # stacked pair
}


def split(path, layout, outdir, gutter=6, ids=None):
    cols, rows = LAYOUTS[layout]
    im = Image.open(path).convert("RGB")
    W, H = im.size
    cw, ch = W // cols, H // rows
    stem = os.path.splitext(os.path.basename(path))[0]
    out = []
    for r in range(rows):
        for c in range(cols):
            # Trim the gutter only on edges that touch a neighbour.
            x0 = c * cw + (gutter if c > 0 else 0)
            x1 = (c + 1) * cw - (gutter if c < cols - 1 else 0)
            y0 = r * ch + (gutter if r > 0 else 0)
            y1 = (r + 1) * ch - (gutter if r < rows - 1 else 0)
            i = r * cols + c
            name = (ids[i] if ids and i < len(ids) else f"{stem}-{i + 1}")
            dest = os.path.join(outdir, name + ".webp")
            im.crop((x0, y0, x1, y1)).save(dest, "WEBP", quality=92)
            out.append(dest)
            print(f"  {name}: {x1 - x0}x{y1 - y0} → {dest}")
    return out


def main():
    src = sys.argv[1]
    auto = "--auto" in sys.argv
    rest = [a for a in sys.argv[2:] if not a.startswith("--")]
    outdir = rest[-1] if (rest and (auto or len(rest) > 1)) else os.path.dirname(src) or "."
    os.makedirs(outdir, exist_ok=True)

    if auto:
        recs = json.load(open(src))
        base = os.path.dirname(os.path.abspath(src))
        for rec in recs:
            sp = rec.get("split")
            if not rec.get("file") or not sp:
                continue
            layout = sp if isinstance(sp, str) else sp.get("layout")
            ids = None if isinstance(sp, str) else sp.get("ids")
            print(f"{rec['id']} ({layout}):")
            split(os.path.join(base, os.path.basename(rec["file"])) if not os.path.exists(rec["file"])
                  else rec["file"], layout, outdir, ids=ids)
        return

    split(src, rest[0], outdir)


if __name__ == "__main__":
    main()
