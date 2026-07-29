#!/usr/bin/env python3
"""
Seamless crystal wallpaper generator.

Builds a repeating tile from the watercolor crystal cutouts in sources/.
Seamlessness is guaranteed structurally: every crystal is composited nine
times, at the placement point and at all eight +/- tile-width/height
offsets, so a crystal that runs off one edge reappears on the opposite
edge pixel-for-pixel. Nothing is ever clipped at a boundary, so there is
no seam to fix afterwards.

Layout is a jittered brick grid: one crystal per cell, alternate rows
offset half a cell, position jittered inside the cell and rotation/scale
randomized per instance. Even coverage, no visible rows or columns.

Usage:  python3 make_pattern.py [version ...]
"""

import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "sources")
OUT = os.path.join(HERE, "out")

TILE = 2400  # px, square repeat


# ----------------------------------------------------------------- sprites

def clean(im, level=214, feather=2, erode=0, largest_only=False):
    """Strip the white sticker halo some of the cutouts carry.

    Two steps. First a flood fill inward from outside the silhouette
    through near-white low-saturation pixels — so only white actually
    connected to the outside goes, and an interior white (moonstone's
    whole body) is enclosed by stone, never reached, never touched.
    Then a few passes of erosion to take the anti-aliased ghost the
    flood fill leaves behind, which otherwise reads as a pale outline
    against a dark background.

    `level` is the min-channel a pixel must exceed to count as halo;
    lower is more aggressive. Tuned per sprite in CLEANUP.
    """
    im = ImageOps.expand(im, 4)  # guarantee a transparent border to fill from
    a = np.array(im).astype(np.int16)
    rgb, alpha = a[..., :3], a[..., 3]
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    whitish = (mn > level) & (sat < 0.18)

    lab, _ = ndimage.label((alpha < 128) | whitish)
    outside = set(np.unique(np.concatenate(
        [lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]]))) - {0}
    alpha[np.isin(lab, list(outside)) & (alpha >= 128)] = 0

    soft = (mn > level - 22) & (sat < 0.22)
    for _ in range(feather):
        edge = alpha < 128
        nb = np.zeros_like(edge)
        nb[1:, :] |= edge[:-1, :]
        nb[:-1, :] |= edge[1:, :]
        nb[:, 1:] |= edge[:, :-1]
        nb[:, :-1] |= edge[:, 1:]
        alpha[soft & nb & ~edge] = 0

    # Celestite's white margin is also traced in ink, and an ink line is
    # not white — no threshold reaches it. Pulling the silhouette in past
    # the line is the only thing that does.
    if erode:
        keep = ndimage.binary_erosion(
            alpha >= 128, ndimage.generate_binary_structure(2, 1), iterations=erode)
        alpha[~keep] = 0

    # Drop debris the trimming leaves stranded (celestite's loose base rock).
    if largest_only:
        lab, n = ndimage.label(alpha >= 128)
        if n > 1:
            sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
            alpha[lab != int(np.argmax(sizes)) + 1] = 0

    a[..., 3] = alpha
    return Image.fromarray(a.astype(np.uint8), "RGBA")


# Per-sprite halo aggressiveness. Celestite's is a thick painted white
# margin drawn with an ink contour, so it needs the full treatment;
# moonstone is itself white, so it gets a high threshold or the flood
# fill starts eating the stone.
CLEANUP = {
    "celestite": {"level": 196, "feather": 4, "erode": 16, "largest_only": True},
    "moonstone": {"level": 232, "feather": 1},
    "halite": {"level": 214, "feather": 2},
}


def load(name):
    im = Image.open(os.path.join(SRC, name + ".png")).convert("RGBA")
    if name in CLEANUP:  # the rest are already clean — don't touch them
        im = clean(im, **CLEANUP[name])
    box = im.getbbox()
    return im.crop(box) if box else im


def shape(sprite, target, angle, size_by="edge"):
    """Scale a sprite to `target` px, then rotate it.

    Two ways to call two stones "the same size", and they do not agree
    when one is a long shard and the other a fat lump:

      edge — same longest edge, i.e. each fits the same bounding square.
             Literal, but a slim crystal then reads as the smaller one.
      area — same amount of painted pixels, so they carry equal visual
             weight. `target` is the side of the equivalent square.
    """
    w, h = sprite.size
    if size_by == "area":
        painted = int((np.array(sprite)[..., 3] >= 128).sum())
        k = target / max(1.0, math.sqrt(painted))
    else:
        k = target / max(w, h)
    im = sprite.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    if angle:
        im = im.rotate(angle, resample=Image.BICUBIC, expand=True)
    return im


# ----------------------------------------------------------------- placing

def paste_wrapped(canvas, sprite, cx, cy, size):
    """Composite one sprite and its eight wrapped ghosts. This is the
    whole seamlessness trick — PIL clips the off-canvas copies for us."""
    w, h = sprite.size
    x0, y0 = round(cx - w / 2), round(cy - h / 2)
    for dx in (-size, 0, size):
        for dy in (-size, 0, size):
            canvas.paste(sprite, (x0 + dx, y0 + dy), sprite)


def layer_spots(layer, crystals, rng):
    """One jittered brick grid's worth of placements."""
    grid = layer["grid"]
    cell = TILE / grid
    jit = cell * layer["jitter"]
    off = layer.get("offset", 0.0) * cell

    spots, recent = [], []
    for r in range(grid):
        for c in range(grid):
            choices = [n for n in crystals if n not in recent] or crystals
            name = rng.choice(choices)
            recent = (recent + [name])[-layer.get("spacing", 3):]
            cx = (c + 0.5) * cell + (cell / 2 if r % 2 else 0) + off
            cy = (r + 0.5) * cell + off
            spots.append({
                "name": name,
                "x": (cx + rng.uniform(-jit, jit)) % TILE,
                "y": (cy + rng.uniform(-jit, jit)) % TILE,
                "angle": rng.uniform(*layer["rotate"]),
                "size": layer["size"] * rng.uniform(*layer["scale"]),
                "size_by": layer.get("size_by", "edge"),
            })
    return spots


def build(version, shift=(0, 0)):
    cfg = VERSIONS[version]
    rng = random.Random(cfg["seed"])

    sprites = {n: load(n) for n in cfg["crystals"]}
    canvas = Image.new("RGBA", (TILE, TILE), cfg["bg"])

    # Big specimens first, then a smaller fill layer tucked into the gaps
    # on an offset grid — one grid alone always reads as rows.
    spots = []
    for layer in cfg["layers"]:
        spots += layer_spots(layer, cfg["crystals"], rng)

    # Shuffle paint order, or every crystal would overlap its neighbour in
    # the same direction and the whole thing would read as shingles.
    rng.shuffle(spots)

    for s in spots:
        paste_wrapped(canvas, shape(sprites[s["name"]], s["size"], s["angle"], s["size_by"]),
                      (s["x"] + shift[0]) % TILE, (s["y"] + shift[1]) % TILE, TILE)

    return canvas.convert("RGB")


def verify(version):
    """Prove the tile really repeats, rather than eyeballing the proof.

    Sliding every crystal half a tile across and rebuilding must give
    exactly the same picture as taking the original tile and rolling the
    pixels half a tile across. That can only hold if the content wraps
    perfectly at both edges — a seam would show up as a band of
    mismatched pixels straight through the middle.
    """
    a = np.array(build(version)).astype(int)
    b = np.array(build(version, shift=(TILE // 2, TILE // 2))).astype(int)
    rolled = np.roll(a, (TILE // 2, TILE // 2), axis=(0, 1))
    diff = np.abs(rolled - b)
    return diff.max(), diff.mean()


# ---------------------------------------------------------------- versions

BIG = {"grid": 5, "size": 440, "scale": (0.86, 1.14), "rotate": (-30, 30),
       "jitter": 0.22, "spacing": 5}
FILL = {"grid": 5, "size": 240, "scale": (0.78, 1.12), "rotate": (-40, 40),
        "jitter": 0.26, "spacing": 5, "offset": 0.5}

# pyrite is deliberately left out of every version: it is the one cutout
# with a cast shadow painted into it, and against a flat ground that reads
# as a smudge rather than a shadow.
# Same size everywhere: one grid, no scale variation. Jitter and rotation
# stay, or a uniform grid reads as a spreadsheet.
UNIFORM_EDGE = {"grid": 5, "size": 430, "scale": (1.0, 1.0), "rotate": (-30, 30),
                "jitter": 0.20, "spacing": 5, "size_by": "edge"}
UNIFORM_AREA = {"grid": 5, "size": 322, "scale": (1.0, 1.0), "rotate": (-32, 32),
                "jitter": 0.26, "spacing": 5, "size_by": "area"}

ALL13 = ["aquamarine", "fluorite", "danburite", "halite", "celestite",
         "spirit-quartz", "opal", "garnet", "rose-quartz",
         "moonstone", "aragonite", "tourmaline", "lapis-lazuli"]
COOL = ["aquamarine", "lapis-lazuli", "fluorite", "moonstone",
        "spirit-quartz", "opal", "tourmaline", "celestite"]
WARM = ["aragonite", "garnet", "rose-quartz", "halite",
        "danburite", "tourmaline", "spirit-quartz"]

VERSIONS = {
    # --- white ground, every crystal the same size (sized by painted area,
    # so a slim shard and a fat lump carry equal weight) ---
    "v4-white-full-spectrum": {"bg": "#FFFFFF", "crystals": ALL13,
                               "layers": [UNIFORM_AREA], "seed": 11},
    "v5-white-cool": {"bg": "#FFFFFF", "crystals": COOL,
                      "layers": [UNIFORM_AREA], "seed": 27},
    "v6-white-warm": {"bg": "#FFFFFF", "crystals": WARM,
                      "layers": [UNIFORM_AREA], "seed": 5},

    # Everything, on warm bone — the whole collection as one pattern.
    "v1-full-spectrum": {
        "bg": "#EFE7DA",
        "crystals": ["aquamarine", "fluorite", "danburite", "halite", "celestite",
                     "spirit-quartz", "opal", "garnet", "rose-quartz",
                     "moonstone", "aragonite", "tourmaline", "lapis-lazuli"],
        "layers": [BIG, FILL], "seed": 11,
    },
    # Cool half on deep ink — lapis gold and the iridescents (opal,
    # moonstone) do the lifting against dark.
    "v2-deep-water": {
        "bg": "#151E33",
        "crystals": ["aquamarine", "lapis-lazuli", "fluorite", "moonstone",
                     "spirit-quartz", "opal", "tourmaline", "celestite"],
        "layers": [BIG, FILL], "seed": 27,
    },
    # Warm half on soft clay — rust, garnet, blush, smoky.
    "v3-clay-and-ember": {
        "bg": "#E6D2C2",
        "crystals": ["aragonite", "garnet", "rose-quartz", "halite",
                     "danburite", "tourmaline", "spirit-quartz"],
        "layers": [BIG, FILL], "seed": 5,
    },
}


# ------------------------------------------------------------------ output

def proof(tile, reps=2, width=1400):
    """A reps x reps wall of the tile — where a seam would show up."""
    w = tile.width
    sheet = Image.new("RGB", (w * reps, w * reps))
    for i in range(reps):
        for j in range(reps):
            sheet.paste(tile, (i * w, j * w))
    return sheet.resize((width, width), Image.LANCZOS)


def main(which):
    os.makedirs(OUT, exist_ok=True)
    for name in which:
        tile = build(name)
        tile.save(os.path.join(OUT, f"{name}-tile.png"))
        tile.resize((1000, 1000), Image.LANCZOS).save(
            os.path.join(OUT, f"{name}-preview.png"))
        proof(tile).save(os.path.join(OUT, f"{name}-proof2x2.png"))
        print(f"{name}: tile {tile.size[0]}x{tile.size[1]} + 2x2 proof")


if __name__ == "__main__":
    main(sys.argv[1:] or list(VERSIONS))
