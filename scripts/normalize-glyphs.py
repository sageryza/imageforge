#!/usr/bin/env python3
"""Make every hand-drawn app glyph fill the SAME share of its own viewBox.

WHY THIS EXISTS (measured Aug 2026, after Sophie: "they all seem to be a
different size"). `ToolGlyph` in RootView.swift sizes a custom icon with ONE
rule — a frame of 0.86 x the SF-Symbol point size beside it — because an SF
Symbol draws only ~0.75 of its point size in ink while custom art fills its
frame. That rule is only correct if every custom glyph fills the same share of
its own box. They did not:

    playground  1.000   (bled to the top and bottom edges, no margin at all)
    testtube    0.923
    quilt       0.853

`.scaledToFit()` scales by the LONGER side, so at one nominal size the
Playground rendered ~17% larger than the quilt. No frame number can fix that —
the difference is in the ART, so this normalizes the art and leaves the one
Swift rule alone.

An earlier pass got this wrong by measuring ONE glyph and assuming the others
matched (testtube.svg's own comment claimed it filled "the same share the
Playground glyph fills" — it was 0.923 against 1.000). So this measures every
file, by rendering it, instead of trusting any comment.

Usage:  python3 scripts/normalize-glyphs.py [--check] [--target 0.90]
        --check  measures and reports only; exits 1 if any glyph is off.
"""
import argparse, os, re, subprocess, sys, tempfile

ART = os.path.join(os.path.dirname(__file__), "..", "ios", "ImageForge", "Assets.xcassets")
GLYPHS = ["Playground/playground", "Quilt/quilt", "TestTube/testtube"]
CHROME = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"
PX = 640          # render size; viewBox units are PX/64
TOL = 0.005       # a glyph within half a percent of target is fine


def render_bbox(svg_path, work):
    """Ink bounding box of an SVG, in 0..1 fractions of its own box."""
    from PIL import Image
    import numpy as np
    html = os.path.join(work, "g.html")
    png = os.path.join(work, "g.png")
    with open(html, "w") as f:
        f.write(f'<html><body style="margin:0;background:#fff">'
                f'<img src="file://{os.path.abspath(svg_path)}" '
                f'style="width:{PX}px;height:{PX}px;display:block"></body></html>')
    if os.path.exists(png):
        os.remove(png)
    subprocess.run([CHROME, "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
                    f"--window-size={PX},{PX}", f"--screenshot={png}", f"file://{html}"],
                   capture_output=True, cwd=work)
    im = np.array(Image.open(png).convert("L"))
    ys, xs = np.where(im < 200)
    if not len(xs):
        raise SystemExit(f"{svg_path}: rendered blank")
    return (xs.min() / PX, xs.max() / PX, ys.min() / PX, ys.max() / PX)


def wrap(svg_text, tx, ty, s):
    """Wrap the drawing in one normalizing transform, replacing a previous one."""
    open_tag = re.match(r"\s*<svg[^>]*>", svg_text)
    head, body = svg_text[:open_tag.end()], svg_text[open_tag.end():]
    body = re.sub(r'\s*<g class="norm"[^>]*>(.*)</g>\s*(?=</svg>)', r"\1", body,
                  flags=re.S)
    body = body.rsplit("</svg>", 1)
    inner = body[0]
    g = f'\n  <g class="norm" transform="translate({tx:.4f} {ty:.4f}) scale({s:.5f})">'
    return f"{head}{g}{inner}</g>\n</svg>\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", type=float, default=0.90,
                    help="share of the viewBox the ink should fill (default 0.90)")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    bad = False
    with tempfile.TemporaryDirectory() as work:
        for g in GLYPHS:
            folder, name = g.split("/")
            path = os.path.join(ART, f"{folder}.imageset", f"{name}.svg")
            x0, x1, y0, y1 = render_bbox(path, work)
            fill = max(x1 - x0, y1 - y0)
            off = abs(fill - args.target)
            print(f"{name:11s} fills {fill:.3f} of its box "
                  f"({'ok' if off <= TOL else 'OFF by %+.3f' % (fill - args.target)})")
            if off <= TOL:
                continue
            bad = True
            if args.check:
                continue
            # Scale about the ink's own centre so the result is centred too.
            s = args.target / fill
            cx, cy = (x0 + x1) / 2 * 64, (y0 + y1) / 2 * 64
            text = open(path).read()
            open(path, "w").write(wrap(text, 32 - s * cx, 32 - s * cy, s))
            x0, x1, y0, y1 = render_bbox(path, work)
            print(f"{'':11s}  -> {max(x1 - x0, y1 - y0):.3f}, "
                  f"centred at ({(x0 + x1) / 2:.3f}, {(y0 + y1) / 2:.3f})")

    if args.check and bad:
        sys.exit(1)


if __name__ == "__main__":
    main()
