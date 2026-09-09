#!/usr/bin/env python3
"""Face/sharpness tooling for pulling Seedance reference stills out of clips.

Two jobs:
  scan   — score every frame of a folder: sharpness + face box + eye landmarks
  bar    — put a blurred bar over the eyes of a still (the filter's key)
Nothing here draws or sends anything; it is ffmpeg/opencv on our own box.
"""
import cv2, numpy as np, json, sys, os, glob

MODEL = os.environ.get('YUNET', os.path.join(os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else '.', 'models', 'yunet.onnx'))

def detector(w, h, thr=0.6):
    d = cv2.FaceDetectorYN.create(MODEL, "", (w, h), thr, 0.3, 5000)
    return d

def sharpness(gray):
    """Variance of the Laplacian — the standard 'is this frame crisp' score."""
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())

def scan(folder, out):
    files = sorted(glob.glob(os.path.join(folder, '*.png')) + glob.glob(os.path.join(folder, '*.jpg')))
    rows, det, dims = [], None, None
    for i, f in enumerate(files):
        img = cv2.imread(f)
        if img is None: continue
        h, w = img.shape[:2]
        if dims != (w, h):
            det, dims = detector(w, h), (w, h)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, faces = det.detect(img)
        row = {'file': os.path.basename(f), 'w': w, 'h': h, 'sharp': round(sharpness(gray), 1)}
        if faces is not None and len(faces):
            # biggest face on the frame
            fa = max(faces, key=lambda x: x[2] * x[3])
            x, y, fw, fh = [float(v) for v in fa[:4]]
            lm = [[float(fa[4 + 2 * k]), float(fa[5 + 2 * k])] for k in range(5)]
            fx0, fy0 = max(0, int(x)), max(0, int(y))
            fcrop = gray[fy0:int(y + fh), fx0:int(x + fw)]
            row.update(face=[round(x, 1), round(y, 1), round(fw, 1), round(fh, 1)],
                       score=round(float(fa[-1]), 3),
                       facearea=round(fw * fh / (w * h) * 100, 2),
                       facesharp=round(sharpness(fcrop), 1) if fcrop.size else 0.0,
                       lm=[[round(a, 1), round(b, 1)] for a, b in lm])
        rows.append(row)
    json.dump(rows, open(out, 'w'), indent=1)
    return rows

def eyebar(src, dst, height_frac=0.45, width_pad=0.40, blur_k=0.55, mode='blur',
           feather_k=0.25, debug=False, blur=None):
    """Blur a band over the eyes — the ByteDance filter's key.

    height_frac / width_pad size the band in units of the inter-eye distance,
    so a "narrower bar" is a smaller height_frac.

    blur_k SCALES THE BLUR TO THE FACE and that is the whole point: a fixed
    radius is a cosmetic smudge on a 400px face and a hard black censor slab
    on a 56px one — measured 2026-09-09 on this set. The kernel is
    blur_k x the inter-eye distance. `blur` (a fixed radius) is kept only so
    an older call still runs.
    """
    img = cv2.imread(src)
    if img is None: raise SystemExit('cannot read ' + src)
    h, w = img.shape[:2]
    det = detector(w, h, 0.5)
    _, faces = det.detect(img)
    if faces is None or not len(faces):
        raise SystemExit('no face found in ' + src)
    out = img.copy()
    boxes = []
    for fa in faces:
        re_, le = (fa[4], fa[5]), (fa[6], fa[7])
        cx, cy = (re_[0] + le[0]) / 2.0, (re_[1] + le[1]) / 2.0
        d = float(np.hypot(le[0] - re_[0], le[1] - re_[1])) or float(fa[2]) * 0.4
        bw, bh = d * (1 + 2 * width_pad), d * height_frac
        x0, x1 = int(max(0, cx - bw / 2)), int(min(w, cx + bw / 2))
        y0, y1 = int(max(0, cy - bh / 2)), int(min(h, cy + bh / 2))
        if x1 <= x0 or y1 <= y0: continue
        band = out[y0:y1, x0:x1]
        k = int(blur) if blur is not None else max(3, int(d * blur_k))
        k = max(3, k | 1)
        if mode == 'blur':
            new_ = cv2.GaussianBlur(band, (k, k), 0)
        elif mode == 'pixel':
            n = max(2, int(band.shape[1] / max(2, k)))
            m = max(2, int(band.shape[0] / max(2, k)))
            new_ = cv2.resize(cv2.resize(band, (n, m), interpolation=cv2.INTER_AREA),
                              (band.shape[1], band.shape[0]), interpolation=cv2.INTER_NEAREST)
        else:
            new_ = np.zeros_like(band)
        f = max(0, int(d * feather_k))
        if f > 0:
            # feather the seam so it reads as an artifact, not a censor bar
            mask = np.zeros((band.shape[0] + 2 * f, band.shape[1] + 2 * f), np.float32)
            mask[f:f + band.shape[0], f:f + band.shape[1]] = 1.0
            kk = max(3, f | 1)
            mask = cv2.GaussianBlur(mask, (kk, kk), 0)[f:f + band.shape[0], f:f + band.shape[1]]
            mask = mask[..., None]
            new_ = (new_ * mask + band * (1 - mask)).astype(band.dtype)
        out[y0:y1, x0:x1] = new_
        boxes.append([x0, y0, x1 - x0, y1 - y0, k])
    if debug:
        for b in boxes: cv2.rectangle(out, (b[0], b[1]), (b[0]+b[2], b[1]+b[3]), (0, 0, 255), 1)
    cv2.imwrite(dst, out)
    return {'src': src, 'dst': dst, 'w': w, 'h': h, 'bars': boxes, 'mode': mode,
            'height_frac': height_frac, 'width_pad': width_pad, 'blur_k': blur_k,
            'feather_k': feather_k}

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'scan':
        rows = scan(sys.argv[2], sys.argv[3])
        wf = [r for r in rows if 'face' in r]
        print(f'{len(rows)} frames, {len(wf)} with a face -> {sys.argv[3]}')
    elif cmd == 'bar':
        kw = dict(a.split('=', 1) for a in sys.argv[4:])
        for k in ('height_frac', 'width_pad'): 
            if k in kw: kw[k] = float(kw[k])
        for k in ('blur', 'feather'):
            if k in kw: kw[k] = int(kw[k])
        if 'debug' in kw: kw['debug'] = kw['debug'] == '1'
        print(json.dumps(eyebar(sys.argv[2], sys.argv[3], **kw)))
