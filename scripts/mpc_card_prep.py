#!/usr/bin/env python3
"""
mpc_card_prep.py
----------------
Make card art press-ready for MakePlayingCards (MPC): correct trim size, 1/8"
bleed, and 300 DPI. This is the step BETWEEN "art out of ChatGPT / the Forge" and
`mpc_order_builder.py` — the order builder assumes the images are already
print-ready; this is what makes them print-ready.

    raw art  ->  [this script]  press-ready PNGs  ->  mpc_order_builder.py  ->  order.xml

Why it's needed: gpt-image / ChatGPT art is typically ~1024x1536 at screen
resolution with NO bleed. MPC cuts every card with a 1/8" tolerance, so the
design must extend 1/8" PAST the cut line on all sides or you get white slivers at
the edges. A poker card is 2.5"x3.5" finished; with bleed that's 2.75"x3.75", and
at 300 DPI that's 825x1125 px. This script produces exactly that.

MODES (how to reconcile art that has no bleed with a card that needs it)
    cover   (default) scale the art to FILL the whole card+bleed rectangle and
            center-crop the small overflow. Full edge-to-edge bleed, no mirrored
            seams. Best for full-bleed illustrations. A sliver of the art's edges
            is cropped (reported per image) — keep important content away from the
            very edge.
    extend  scale the art to the TRIM size (center-cropped to the card's aspect),
            then MANUFACTURE the bleed by mirroring the outer edge pixels outward.
            Nothing inside the cut line is lost; the bleed is a reflected
            extension. Best when the art IS exactly the card face.
    fit     scale the art to FIT inside the trim with no crop (whole image kept),
            pad to the trim with a background color, then extend that into the
            bleed. Use when you can't lose any of the art and are OK with a
            border.

USAGE
    # one image
    python mpc_card_prep.py card.png
    # a flat folder of images
    python mpc_card_prep.py my_images/
    # a deck folder (fronts/ + backs/ or back.png) -> prepped deck folder
    python mpc_card_prep.py my_deck/ --out my_deck_print
    # then:
    python mpc_order_builder.py my_deck_print

    Options: --size {poker,bridge,tarot,square,mini,jumbo}  --mode {cover,extend,fit}
             --dpi 300  --bleed 0.125  --bg white  --proof  --out PATH

Requires Pillow:  pip install Pillow
"""

import argparse
import os
import sys

try:
    from PIL import Image, ImageOps, ImageDraw
except ImportError:
    sys.exit("ERROR: Pillow is required. Install it with:  pip install Pillow")

SUPPORTED_EXTS = (".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tif", ".tiff")

# Finished (trim) card sizes in inches, MPC's common products.
CARD_SIZES = {
    "poker":  (2.5, 3.5),
    "bridge": (2.25, 3.5),
    "tarot":  (2.75, 4.75),
    "square": (2.5, 2.5),
    "mini":   (1.75, 2.5),
    "jumbo":  (3.5, 5.0),
}

BG_COLORS = {"white": (255, 255, 255), "black": (0, 0, 0)}


def px(inches, dpi):
    return int(round(inches * dpi))


def parse_bg(bg):
    if bg in BG_COLORS:
        return BG_COLORS[bg]
    s = bg.lstrip("#")
    if len(s) == 6:
        try:
            return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))
        except ValueError:
            pass
    sys.exit(f"ERROR: unrecognized --bg '{bg}' (use white, black, or #rrggbb).")


def flatten(img, bg_rgb):
    """Drop alpha onto a solid background; MPC prints on opaque stock."""
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        img = img.convert("RGBA")
        canvas = Image.new("RGB", img.size, bg_rgb)
        canvas.paste(img, mask=img.split()[-1])
        return canvas
    return img.convert("RGB")


def extend_to_full(img_trim, full_w, full_h, off_x, off_y):
    """Place a trim-sized image at (off_x, off_y) inside a full-size canvas and
    fill the four margins + corners by mirroring the trim's edge pixels. Handles
    uneven (off-by-one) margins, since 1/8" at 300 DPI is 37.5 px."""
    w, h = img_trim.size
    left, top = off_x, off_y
    right, bottom = full_w - w - off_x, full_h - h - off_y
    canvas = Image.new("RGB", (full_w, full_h))
    canvas.paste(img_trim, (left, top))
    if left > 0:
        s = img_trim.crop((0, 0, min(left, w), h)).transpose(Image.FLIP_LEFT_RIGHT)
        canvas.paste(s, (left - s.size[0], top))
    if right > 0:
        s = img_trim.crop((w - min(right, w), 0, w, h)).transpose(Image.FLIP_LEFT_RIGHT)
        canvas.paste(s, (left + w, top))
    if top > 0:
        s = img_trim.crop((0, 0, w, min(top, h))).transpose(Image.FLIP_TOP_BOTTOM)
        canvas.paste(s, (left, top - s.size[1]))
    if bottom > 0:
        s = img_trim.crop((0, h - min(bottom, h), w, h)).transpose(Image.FLIP_TOP_BOTTOM)
        canvas.paste(s, (left, top + h))
    # corners: reflect through both axes (rotate 180)
    cw, ch = min(left, w), min(top, h)
    if left > 0 and top > 0:
        canvas.paste(img_trim.crop((0, 0, cw, ch)).transpose(Image.ROTATE_180),
                     (left - cw, top - ch))
    cw, ch = min(right, w), min(top, h)
    if right > 0 and top > 0:
        canvas.paste(img_trim.crop((w - cw, 0, w, ch)).transpose(Image.ROTATE_180),
                     (left + w, top - ch))
    cw, ch = min(left, w), min(bottom, h)
    if left > 0 and bottom > 0:
        canvas.paste(img_trim.crop((0, h - ch, cw, h)).transpose(Image.ROTATE_180),
                     (left - cw, top + h))
    cw, ch = min(right, w), min(bottom, h)
    if right > 0 and bottom > 0:
        canvas.paste(img_trim.crop((w - cw, h - ch, w, h)).transpose(Image.ROTATE_180),
                     (left + w, top + h))
    return canvas


def prep_image(src_path, geom, mode, bg_rgb, want_proof):
    """Return (print_img, proof_img_or_None, notes[])."""
    trim_w, trim_h = geom["trim"]
    full_w, full_h = geom["full"]
    off_x, off_y = geom["off"]
    dpi = geom["dpi"]
    notes = []

    img = Image.open(src_path)
    img = flatten(img, bg_rgb)
    sw, sh = img.size

    # Effective print resolution: how many source px land across the trim.
    eff_dpi = min(sw / (trim_w / dpi), sh / (trim_h / dpi))
    if eff_dpi < dpi - 1:
        notes.append(f"low-res: art resolves to ~{eff_dpi:.0f} DPI at trim "
                     f"(MPC likes {dpi}); it will be upscaled and may look soft")

    if mode == "cover":
        out = ImageOps.fit(img, (full_w, full_h), method=Image.LANCZOS,
                           centering=(0.5, 0.5))
        # report how much of the art got cropped to fill the card aspect
        scale = max(full_w / sw, full_h / sh)
        cropped_w = max(0, sw * scale - full_w)
        cropped_h = max(0, sh * scale - full_h)
        if cropped_w > 1 or cropped_h > 1:
            notes.append(f"cropped ~{cropped_w / scale:.0f}x{cropped_h / scale:.0f} "
                         f"src-px ({cropped_w / dpi:.2f}\"x{cropped_h / dpi:.2f}\") "
                         f"to fill the card")
    elif mode == "extend":
        trim_img = ImageOps.fit(img, (trim_w, trim_h), method=Image.LANCZOS,
                                centering=(0.5, 0.5))
        out = extend_to_full(trim_img, full_w, full_h, off_x, off_y)
    elif mode == "fit":
        inner = ImageOps.contain(img, (trim_w, trim_h), method=Image.LANCZOS)
        trim_img = Image.new("RGB", (trim_w, trim_h), bg_rgb)
        trim_img.paste(inner, ((trim_w - inner.size[0]) // 2,
                               (trim_h - inner.size[1]) // 2))
        out = extend_to_full(trim_img, full_w, full_h, off_x, off_y)
    else:
        raise ValueError(mode)

    proof = None
    if want_proof:
        proof = out.convert("RGB").copy()
        d = ImageDraw.Draw(proof)
        safe = geom["safe_inset"]
        # trim line (red) = where MPC cuts; safe zone (cyan) = keep content inside
        d.rectangle([off_x, off_y, off_x + trim_w - 1, off_y + trim_h - 1],
                    outline=(255, 40, 40), width=max(2, dpi // 100))
        d.rectangle([off_x + safe, off_y + safe,
                     off_x + trim_w - safe - 1, off_y + trim_h - safe - 1],
                    outline=(0, 200, 220), width=max(2, dpi // 150))

    return out, proof, notes


def iter_folder_images(folder):
    for f in sorted(os.listdir(folder)):
        if f.lower().endswith(SUPPORTED_EXTS) and \
                os.path.isfile(os.path.join(folder, f)):
            yield f


def save_print(img, path, dpi):
    img.save(path, format="PNG", dpi=(dpi, dpi))


def process_one(src, dst, geom, args, bg_rgb, proof_dir=None):
    out, proof, notes = prep_image(src, geom, args.mode, bg_rgb, args.proof)
    save_print(out, dst, geom["dpi"])
    tag = "  " + os.path.basename(dst)
    print(f"{tag}  ->  {out.size[0]}x{out.size[1]}px @ {geom['dpi']}dpi"
          + (f"   [{'; '.join(notes)}]" if notes else ""))
    if proof is not None and proof_dir is not None:
        os.makedirs(proof_dir, exist_ok=True)
        pstem = os.path.splitext(os.path.basename(dst))[0]
        proof.save(os.path.join(proof_dir, pstem + "_proof.png"),
                   dpi=(geom["dpi"], geom["dpi"]))
    return notes


def build_geom(args):
    if args.size not in CARD_SIZES:
        sys.exit(f"ERROR: unknown --size '{args.size}'. "
                 f"Choose from: {', '.join(CARD_SIZES)}")
    tw_in, th_in = CARD_SIZES[args.size]
    dpi = args.dpi
    # Full size is derived from TOTAL inches so it matches the spec exactly
    # (poker: 2.75x3.75in -> 825x1125px). Bleed can differ by 1px per side because
    # 1/8" at 300 DPI is 37.5 px; the offset centers the trim within the full.
    trim = (px(tw_in, dpi), px(th_in, dpi))
    full = (px(tw_in + 2 * args.bleed, dpi), px(th_in + 2 * args.bleed, dpi))
    off = ((full[0] - trim[0]) // 2, (full[1] - trim[1]) // 2)
    return {
        "trim": trim, "full": full, "off": off, "dpi": dpi,
        "safe_inset": px(args.bleed, dpi),  # safe margin = one bleed inside trim
        "size_name": args.size, "inches": (tw_in, th_in),
    }


def main():
    p = argparse.ArgumentParser(
        description="Make card art press-ready for MakePlayingCards "
                    "(trim size + 1/8\" bleed + 300 DPI).")
    p.add_argument("input", help="an image, a folder of images, or a deck folder "
                                  "(with a fronts/ subfolder)")
    p.add_argument("--out", default=None,
                   help="output path (default: <input>_print)")
    p.add_argument("--size", default="poker",
                   help=f"card size: {', '.join(CARD_SIZES)} (default: poker)")
    p.add_argument("--mode", choices=["cover", "extend", "fit"], default="cover",
                   help="how to handle bleed/aspect (default: cover)")
    p.add_argument("--dpi", type=int, default=300, help="output DPI (default: 300)")
    p.add_argument("--bleed", type=float, default=0.125,
                   help="bleed per side in inches (default: 0.125)")
    p.add_argument("--bg", default="white",
                   help="background for transparency/padding: white, black, or "
                        "#rrggbb (default: white)")
    p.add_argument("--proof", action="store_true",
                   help="also write _proof images with trim + safe-zone guides "
                        "(review only; never sent to print)")
    args = p.parse_args()

    geom = build_geom(args)
    bg_rgb = parse_bg(args.bg)
    tw, th = geom["inches"]
    print(f"Target: {args.size} {tw}\"x{th}\" + {args.bleed}\" bleed = "
          f"{geom['full'][0]}x{geom['full'][1]}px @ {geom['dpi']}dpi  "
          f"(mode: {args.mode})")

    if not os.path.exists(args.input):
        sys.exit(f"ERROR: {args.input} does not exist.")

    all_notes = []

    # ---- single image ----
    if os.path.isfile(args.input):
        stem, _ = os.path.splitext(os.path.basename(args.input))
        out = args.out or (stem + "_print.png")
        if os.path.isdir(out):
            out = os.path.join(out, stem + "_print.png")
        proof_dir = os.path.dirname(os.path.abspath(out)) or "."
        all_notes += process_one(args.input, out, geom, args, bg_rgb, proof_dir)
        print(f"\nDone. Wrote {out}")
        return

    # ---- deck folder (has fronts/) ----
    fronts_dir = os.path.join(args.input, "fronts")
    is_deck = os.path.isdir(fronts_dir)

    out_root = args.out or (os.path.normpath(args.input) + "_print")
    os.makedirs(out_root, exist_ok=True)

    if is_deck:
        n = 0
        # fronts/
        out_fronts = os.path.join(out_root, "fronts")
        os.makedirs(out_fronts, exist_ok=True)
        print("fronts/")
        for f in iter_folder_images(fronts_dir):
            stem = os.path.splitext(f)[0]
            dst = os.path.join(out_fronts, stem + ".png")
            all_notes += process_one(os.path.join(fronts_dir, f), dst, geom, args,
                                     bg_rgb, os.path.join(out_root, "proof", "fronts"))
            n += 1
        # backs/ (per-card)
        backs_dir = os.path.join(args.input, "backs")
        if os.path.isdir(backs_dir):
            out_backs = os.path.join(out_root, "backs")
            os.makedirs(out_backs, exist_ok=True)
            print("backs/")
            for f in iter_folder_images(backs_dir):
                stem = os.path.splitext(f)[0]
                dst = os.path.join(out_backs, stem + ".png")
                all_notes += process_one(os.path.join(backs_dir, f), dst, geom, args,
                                         bg_rgb, os.path.join(out_root, "proof", "backs"))
        # shared back.<ext>
        for ext in SUPPORTED_EXTS:
            cand = os.path.join(args.input, "back" + ext)
            if os.path.isfile(cand):
                print("back" + ext)
                all_notes += process_one(cand, os.path.join(out_root, "back.png"),
                                         geom, args, bg_rgb,
                                         os.path.join(out_root, "proof"))
                break
        print(f"\nDone. {n} fronts prepped. Deck folder ready for the order builder:")
        print(f"  python mpc_order_builder.py {out_root}")
    else:
        # ---- flat folder of images ----
        imgs = list(iter_folder_images(args.input))
        if not imgs:
            sys.exit(f"ERROR: no images in {args.input} "
                     f"({', '.join(SUPPORTED_EXTS)}).")
        for f in imgs:
            stem = os.path.splitext(f)[0]
            dst = os.path.join(out_root, stem + ".png")
            all_notes += process_one(os.path.join(args.input, f), dst, geom, args,
                                     bg_rgb, os.path.join(out_root, "proof"))
        print(f"\nDone. {len(imgs)} images prepped to {out_root}")

    if any("low-res" in nt for nt in all_notes):
        print("\nHeads up: some art resolved below 300 DPI at card size. It will "
              "print, but consider regenerating those at a higher resolution.")


if __name__ == "__main__":
    main()
