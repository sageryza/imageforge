#!/usr/bin/env python3
"""
mpc_order_builder.py
--------------------
Generate an MPC Autofill XML order from a folder of your OWN card images, so the
MPC Autofill desktop tool can auto-fill it straight into MakePlayingCards.com.

This is the fulfilment tail of the Deck Factory pipeline: a deck's art (made in
ChatGPT / the Forge) becomes card image files; this script turns that folder into
the order.xml the community MPC Autofill desktop tool reads. That tool drives the
browser and places every card, so we never build (or maintain) a from-scratch
uploader against MPC's site.

    art (files)  ->  [this script]  order.xml  ->  MPC Autofill desktop  ->  MPC

This script does NOT talk to MakePlayingCards. It only builds the .xml. You still
run the upload with the desktop tool (https://mpcfill.com /
github.com/chilli-axe/mpc-autofill), which signs into your MPC account, fills
every slot, and auto-saves the project for you to review and check out by hand.

FOLDER CONVENTION (defaults)
    my_deck/
        fronts/            one image per card front (required)
            01_wolf.png
            02_owl.png
            ...
        back.png           OPTIONAL: one shared back for the whole deck
        backs/             OPTIONAL: per-card backs (use INSTEAD of back.png)
            01_wolf.png     matched to fronts by filename stem (or by sort order)
            02_owl.png

    - Use back.png (or back.jpg, etc.) for a single shared back.
    - Use a backs/ folder when every card has its own back (e.g. an oracle deck
      with text on each card back).
    - Card ORDER follows a natural sort of the front filenames, so number them
      (01_, 02_, ... or 001_ for big decks) if order matters.

USAGE
    python mpc_order_builder.py my_deck
    python mpc_order_builder.py my_deck --stock "(S33) Superior Smooth" --foil
    python mpc_order_builder.py my_deck --match order   # match backs by position

OUTPUT
    my_deck/order.xml   (references images by path relative to my_deck/)

Run the desktop tool from the deck folder, e.g.:
    autofill --directory my_deck
so the relative paths resolve. Then review the saved project in your MPC account
and check out by hand.

NOTE: images should already be print-ready (include MPC's 1/8" bleed). This
script does not resize or add bleed.

XML dialect: matches the MPC Autofill "XML Schema Specification" (chilli-axe wiki).
Each <card> carries a <sourceType> of "Local File" so the desktop tool loads the
image from disk instead of trying Google Drive; <slots> is a comma-separated slot
list; stock strings are the exact values MPC's XML accepts. Confirmed against the
schema, but the desktop tool is the source of truth — do the 2-3 card smoke test
below before a full deck run.
"""

import argparse
import os
import re
import sys
import xml.etree.ElementTree as ET
from xml.dom import minidom

# MPC accepts these formats (JPG, BMP, PNG, GIF, TIFF, PDF).
SUPPORTED_EXTS = (".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tif", ".tiff", ".pdf")

# MPC Autofill deck-size brackets (smallest tier >= your card count is chosen).
# Overridable with --bracket. Vendors/products can differ slightly; verify in the
# tool if a bracket looks off.
DEFAULT_BRACKETS = [18, 36, 55, 72, 90, 108, 126, 144, 162,
                    180, 198, 216, 234, 396, 504, 612]

# Stock strings exactly as MPC's XML accepts them. Keys are lowercase aliases so a
# friendly name ("superior", "linen") resolves to the canonical value; an already
# canonical string passes through untouched.
STOCK_CANONICAL = {
    "(s30) standard smooth": "(S30) Standard Smooth",
    "(s33) superior smooth": "(S33) Superior Smooth",
    "(m31) linen": "(M31) Linen",
    "(p10) plastic": "(P10) Plastic",
    # friendly aliases
    "standard": "(S30) Standard Smooth",
    "s30": "(S30) Standard Smooth",
    "superior": "(S33) Superior Smooth",
    "smooth": "(S33) Superior Smooth",
    "s33": "(S33) Superior Smooth",
    "linen": "(M31) Linen",
    "m31": "(M31) Linen",
    "plastic": "(P10) Plastic",
    "p10": "(P10) Plastic",
}
DEFAULT_STOCK = "(S30) Standard Smooth"


def normalize_stock(s):
    """Map a friendly/loose stock name to the exact string MPC's XML accepts."""
    if not s:
        return DEFAULT_STOCK
    return STOCK_CANONICAL.get(s.strip().lower(), s)


def natural_key(s):
    """Sort so card2 < card10 (numbers compared as numbers)."""
    return [int(t) if t.isdigit() else t.lower()
            for t in re.split(r"(\d+)", s)]


def list_images(folder):
    """Return image files in a folder, natural-sorted by filename."""
    if not os.path.isdir(folder):
        return []
    files = [f for f in os.listdir(folder)
             if f.lower().endswith(SUPPORTED_EXTS)
             and os.path.isfile(os.path.join(folder, f))]
    return sorted(files, key=natural_key)


def find_shared_back(project_dir):
    """Look for a single back.<ext> file in the project root."""
    for ext in SUPPORTED_EXTS:
        candidate = os.path.join(project_dir, "back" + ext)
        if os.path.isfile(candidate):
            return "back" + ext
    return None


def pick_bracket(count, brackets):
    for b in brackets:
        if count <= b:
            return b
    return brackets[-1]  # cap; larger orders get split by the desktop tool


def add_card(parent, rel_path, slots):
    """Append a <card> for a local-file image. slots is an int or list of ints."""
    if isinstance(slots, (list, tuple)):
        slots_str = ",".join(str(s) for s in slots)
    else:
        slots_str = str(slots)
    base = os.path.basename(rel_path)
    card = ET.SubElement(parent, "card")
    ET.SubElement(card, "id").text = rel_path              # local relative path
    ET.SubElement(card, "sourceType").text = "Local File"  # load from disk, not Drive
    ET.SubElement(card, "slots").text = slots_str
    ET.SubElement(card, "name").text = base
    ET.SubElement(card, "query").text = os.path.splitext(base)[0]
    return card


def build_order(project_dir, args):
    stock = normalize_stock(args.stock)

    fronts_dir = os.path.join(project_dir, args.fronts)
    front_files = list_images(fronts_dir)
    if not front_files:
        sys.exit(f"ERROR: no images found in {fronts_dir}\n"
                 f"       Put one image per card front there "
                 f"({', '.join(SUPPORTED_EXTS)}).")

    n = len(front_files)
    bracket = args.bracket or pick_bracket(n, DEFAULT_BRACKETS)
    if n > bracket:
        print(f"NOTE: {n} cards exceeds bracket {bracket}. The desktop tool will "
              f"offer to split this across multiple MPC orders.")

    # slot index -> front filename
    front_by_slot = {i: fname for i, fname in enumerate(front_files)}

    # ---- resolve backs -------------------------------------------------
    backs_dir = os.path.join(project_dir, args.backs)
    per_card_back_files = list_images(backs_dir)
    shared_back = args.shared_back or find_shared_back(project_dir)

    # slot index -> back filename (relative to project_dir)
    back_by_slot = {}
    default_cardback = None  # relative path used as MPC's default back

    if per_card_back_files:
        if shared_back:
            print("NOTE: found both a backs/ folder and a shared back image. "
                  "Using the per-card backs/ folder.")
        if args.match == "name":
            # match each back to the front with the same filename stem
            front_stem_to_slot = {}
            for slot, fname in front_by_slot.items():
                front_stem_to_slot[os.path.splitext(fname)[0].lower()] = slot
            matched_slots = set()
            for bname in per_card_back_files:
                stem = os.path.splitext(bname)[0].lower()
                slot = front_stem_to_slot.get(stem)
                if slot is None:
                    print(f"  WARNING: back '{bname}' has no matching front "
                          f"filename; skipping it.")
                    continue
                back_by_slot[slot] = os.path.join(args.backs, bname)
                matched_slots.add(slot)
            missing = [front_by_slot[s] for s in sorted(front_by_slot)
                       if s not in matched_slots]
            if missing:
                print(f"  WARNING: {len(missing)} front(s) have no matching back "
                      f"by name; they will use the default back. First few: "
                      f"{missing[:5]}")
        else:  # match == "order"
            if len(per_card_back_files) != n:
                print(f"  WARNING: {len(per_card_back_files)} backs vs {n} fronts. "
                      f"Matching by position; extras/shortfalls use the default "
                      f"back.")
            for slot in range(min(n, len(per_card_back_files))):
                back_by_slot[slot] = os.path.join(args.backs,
                                                  per_card_back_files[slot])

        if not back_by_slot:
            sys.exit("ERROR: a backs/ folder was found but nothing matched. "
                     "Check filenames, or use --match order.")
        # MPC requires a single default cardback; use slot 0's back if present,
        # else the lowest-numbered matched back.
        if 0 in back_by_slot:
            default_cardback = back_by_slot[0]
        else:
            first_slot = min(back_by_slot)
            default_cardback = back_by_slot[first_slot]

    elif shared_back:
        default_cardback = shared_back  # already relative to project_dir

    else:
        sys.exit("ERROR: no back image found.\n"
                 "       Add a shared 'back.png' in the deck folder, OR a "
                 "'backs/' folder with one image per card,\n"
                 "       OR pass --shared-back path/to/back.png")

    # ---- build XML -----------------------------------------------------
    root = ET.Element("order")

    details = ET.SubElement(root, "details")
    ET.SubElement(details, "quantity").text = str(n)
    ET.SubElement(details, "bracket").text = str(bracket)
    ET.SubElement(details, "stock").text = stock
    ET.SubElement(details, "foil").text = "true" if args.foil else "false"

    fronts_el = ET.SubElement(root, "fronts")
    for slot in range(n):
        fname = front_by_slot[slot]
        add_card(fronts_el, os.path.join(args.fronts, fname), slot)

    # per-card back overrides: emit one for every slot whose back differs from
    # the default cardback (the default already covers the rest).
    override_slots = [s for s in sorted(back_by_slot)
                      if back_by_slot[s] != default_cardback]
    if override_slots:
        backs_el = ET.SubElement(root, "backs")
        for slot in override_slots:
            add_card(backs_el, back_by_slot[slot], slot)

    # cardback is a bare image reference; the tool infers "Local File" from the
    # fact that it's a valid relative path.
    ET.SubElement(root, "cardback").text = default_cardback

    # pretty-print
    rough = ET.tostring(root, encoding="utf-8")
    pretty = minidom.parseString(rough).toprettyxml(indent="  ")

    out_path = os.path.join(project_dir, args.out)
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(pretty)

    return out_path, n, bracket, stock, default_cardback, len(back_by_slot)


def main():
    p = argparse.ArgumentParser(
        description="Generate an MPC Autofill XML order from a folder of your "
                    "own card images.")
    p.add_argument("project_dir", help="deck folder (contains a fronts/ folder)")
    p.add_argument("--fronts", default="fronts",
                   help="subfolder of card fronts (default: fronts)")
    p.add_argument("--backs", default="backs",
                   help="subfolder of per-card backs (default: backs)")
    p.add_argument("--shared-back", default=None,
                   help="path to a single shared back image (overrides auto-detect)")
    p.add_argument("--match", choices=["name", "order"], default="name",
                   help="how to pair per-card backs to fronts (default: name)")
    p.add_argument("--stock", default=DEFAULT_STOCK,
                   help='card stock as MPC lists it, or a friendly alias '
                        '(standard/superior/linen/plastic). '
                        'Default: "(S30) Standard Smooth"')
    p.add_argument("--foil", action="store_true", help="mark the order as foil")
    p.add_argument("--bracket", type=int, default=None,
                   help="override the deck-size bracket (else auto)")
    p.add_argument("--out", default="order.xml",
                   help="output filename (default: order.xml)")
    args = p.parse_args()

    if not os.path.isdir(args.project_dir):
        sys.exit(f"ERROR: {args.project_dir} is not a folder.")

    out_path, n, bracket, stock, cardback, n_backs = build_order(
        args.project_dir, args)

    print("\nDone.")
    print(f"  Cards (fronts): {n}")
    print(f"  Bracket:        {bracket}")
    print(f"  Stock:          {stock}")
    print(f"  Foil:           {'yes' if args.foil else 'no'}")
    print(f"  Default back:   {cardback}")
    print(f"  Per-card backs: {n_backs if n_backs else '0 (shared back)'}")
    print(f"  Written to:     {out_path}")
    print("\nNext: run the MPC Autofill desktop tool from the deck folder, e.g.")
    print(f"  autofill --directory {args.project_dir}")
    print("Then review the saved project in your MPC account and check out.")


if __name__ == "__main__":
    main()
