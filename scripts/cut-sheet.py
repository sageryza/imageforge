#!/usr/bin/env python3
"""Cut a grid sheet into its individual drawings.

A faithful port of the house cutter in imageforge/vectorize.js:
  gutters()  - find the real gutter near each nominal grid line, so a drawing
               the model nudged off-centre still gets cut on white paper.
  cutout()   - flood-fill the paper away from the four corners, drop a small
               fragment that has intruded from a neighbour, trim to the ink.
"""
import sys, os, json
import numpy as np
from PIL import Image
from collections import deque

INK = 245          # luma below this counts as ink
TOL = 22           # how far off pure white the paper may drift
PAD = 0.04         # padding round the trimmed drawing, as a share of its size


def luma(a):
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def cuts_on(ink, n, length):
    """Where to cut a run of `length` px into `n` cells, gutter-aware."""
    at, missed = [0], []
    reach = length // n // 3        # a third of a cell either side
    for k in range(1, n):
        want = round(k * length / n)
        best = None
        x = max(1, want - reach)
        stop = min(length - 2, want + reach)
        while x <= stop:
            if ink[x] != 0:
                x += 1
                continue
            e = x
            while e + 1 < length and ink[e + 1] == 0:
                e += 1
            if best is None or e - x > best[1] - best[0]:
                best = (x, e)
            x = e + 1
        if best:
            at.append(round((best[0] + best[1]) / 2))
        else:
            at.append(want)
            missed.append(want)
    at.append(length)
    return at, missed


def gutters(arr, cols, rows):
    ink = luma(arr) < INK
    col_ink = ink.sum(axis=0)
    row_ink = ink.sum(axis=1)
    x, mx = cuts_on(col_ink, cols, arr.shape[1])
    y, my = cuts_on(row_ink, rows, arr.shape[0])
    return x, y, len(mx) + len(my)


def cutout(cell):
    """Paper -> transparent, fragments dropped, trimmed to the drawing."""
    h, w = cell.shape[:2]
    near = (cell[..., 0] >= 255 - TOL) & (cell[..., 1] >= 255 - TOL) & (cell[..., 2] >= 255 - TOL)
    bg = np.zeros((h, w), bool)
    q = deque()
    for i, j in ((0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)):
        if near[i, j] and not bg[i, j]:
            bg[i, j] = True
            q.append((i, j))
    while q:
        i, j = q.popleft()
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            a, b = i + di, j + dj
            if 0 <= a < h and 0 <= b < w and not bg[a, b] and near[a, b]:
                bg[a, b] = True
                q.append((a, b))
    fg = ~bg
    if fg.sum() < 40:
        return None                      # nothing was drawn in this cell

    # Drop a small fragment that has intruded from a neighbouring cell:
    # small AND touching the border is what an intrusion looks like.
    lab = np.zeros((h, w), np.int32)
    n = 0
    sizes, touches = [0], [False]
    for si in range(h):
        for sj in range(w):
            if not fg[si, sj] or lab[si, sj]:
                continue
            n += 1
            size = 0
            touch = False
            lab[si, sj] = n
            st = [(si, sj)]
            while st:
                i, j = st.pop()
                size += 1
                if i == 0 or j == 0 or i == h - 1 or j == w - 1:
                    touch = True
                for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    a, b = i + di, j + dj
                    if 0 <= a < h and 0 <= b < w and fg[a, b] and not lab[a, b]:
                        lab[a, b] = n
                        st.append((a, b))
            sizes.append(size)
            touches.append(touch)
    biggest = max(sizes)
    for k in range(1, n + 1):
        if touches[k] and sizes[k] < biggest * 0.06:
            fg[lab == k] = False
    if fg.sum() < 40:
        return None

    ys, xs = np.where(fg)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    pad = int(round(max(y1 - y0, x1 - x0) * PAD))
    y0 = max(0, y0 - pad); x0 = max(0, x0 - pad)
    y1 = min(h - 1, y1 + pad); x1 = min(w - 1, x1 + pad)

    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = cell
    out[..., 3] = np.where(fg, 255, 0)
    return out[y0:y1 + 1, x0:x1 + 1]


def cut(path, cols, rows, outdir, stem):
    arr = np.array(Image.open(path).convert('RGB'))
    x, y, missed = gutters(arr, cols, rows)
    os.makedirs(outdir, exist_ok=True)
    made, blank = [], []
    for r in range(rows):
        for c in range(cols):
            k = r * cols + c + 1
            cell = arr[y[r]:y[r + 1], x[c]:x[c + 1]]
            piece = cutout(cell)
            if piece is None:
                blank.append(k)
                continue
            name = f'{stem}-{k:02d}.png'
            Image.fromarray(piece, 'RGBA').save(os.path.join(outdir, name))
            made.append({'n': k, 'row': r + 1, 'col': c + 1,
                         'file': name, 'w': piece.shape[1], 'h': piece.shape[0]})
    return {'sheet': stem, 'grid': [cols, rows], 'missedGutters': missed,
            'cells': made, 'blank': blank}


if __name__ == '__main__':
    src, cols, rows, outdir, stem = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
    print(json.dumps(cut(src, cols, rows, outdir, stem)))
