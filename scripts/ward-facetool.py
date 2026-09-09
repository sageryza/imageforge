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

def eyebar(src, dst, height_frac=0.34, width_pad=0.30, blur_k=0.55, mode='blur',
           feather_k=0.25, debug=False, blur=None):
    """Blur a band over the eyes — the ByteDance filter's key.

    height_frac / width_pad size the band in units of the inter-eye distance,
    so a "narrower bar" is a smaller height_frac and the same numbers mean the
    same thing on any face at any size. D-narrower (0.34 / 0.30) is the rung
    measured to pass on 2026-09-09; both axes have a floor and neither trades
    for the other, so this is close to the minimum.

    THE BAND IS ROTATED ONTO THE EYE LINE. An axis-aligned rectangle only
    covers a level head: the doctor's still sits at 11 degrees and half his
    right eye stayed readable, which ByteDance refused (measured 2026-09-09).
    Most faces in this film are turned or tilted, so this is the common case,
    not the corner one.

    blur_k SCALES THE BLUR TO THE FACE: a fixed radius is a cosmetic smudge on
    a 400px face and a hard censor slab on a 56px one. `blur` (a fixed radius)
    is kept only so an older call still runs.
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
        re_, le = (float(fa[4]), float(fa[5])), (float(fa[6]), float(fa[7]))
        cx, cy = (re_[0] + le[0]) / 2.0, (re_[1] + le[1]) / 2.0
        d = float(np.hypot(le[0] - re_[0], le[1] - re_[1])) or float(fa[2]) * 0.4
        ang = float(np.degrees(np.arctan2(le[1] - re_[1], le[0] - re_[0])))
        bw, bh = max(4.0, d * (1 + 2 * width_pad)), max(2.0, d * height_frac)
        k = int(blur) if blur is not None else max(3, int(d * blur_k))
        k = max(3, k | 1)
        if mode == 'blur':
            blurred = cv2.GaussianBlur(img, (k, k), 0)
        elif mode == 'pixel':
            n, m = max(2, w // max(2, k)), max(2, h // max(2, k))
            blurred = cv2.resize(cv2.resize(img, (n, m), interpolation=cv2.INTER_AREA),
                                 (w, h), interpolation=cv2.INTER_NEAREST)
        else:
            blurred = np.zeros_like(img)
        # a rotated-rect mask on the eye axis, feathered, composited once
        mask = np.zeros((h, w), np.float32)
        # THE FEATHER IS DRAWN OUTSIDE THE BAND, NOT INTO IT. Blurring a mask
        # whose band is 75px tall with a 55px kernel drops the peak well below
        # 1.0, so the "blur" becomes a weak blend and the eyes stay readable —
        # measured 2026-09-09, it is what made the rotated bar refuse where the
        # axis-aligned one passed. So the rect is grown by the feather radius
        # first and the kernel is capped against the band's own height.
        f = max(0, int(min(d * feather_k, bh / 3.0)))
        box = cv2.boxPoints(((cx, cy), (bw + 2 * f, bh + 2 * f), ang)).astype(np.int32)
        cv2.fillConvexPoly(mask, box, 1.0)
        if f > 0:
            kk = max(3, f | 1)
            mask = cv2.GaussianBlur(mask, (kk, kk), 0)
        m3 = mask[..., None]
        out = (blurred * m3 + out * (1 - m3)).astype(out.dtype)
        boxes.append([int(cx - bw / 2), int(cy - bh / 2), int(bw), int(bh), k, round(ang, 1)])
    if debug:
        for fa in faces:
            re_, le = (float(fa[4]), float(fa[5])), (float(fa[6]), float(fa[7]))
            cx, cy = (re_[0] + le[0]) / 2.0, (re_[1] + le[1]) / 2.0
            d = float(np.hypot(le[0]-re_[0], le[1]-re_[1])) or float(fa[2])*0.4
            ang = float(np.degrees(np.arctan2(le[1]-re_[1], le[0]-re_[0])))
            box = cv2.boxPoints(((cx, cy), (d*(1+2*width_pad), d*height_frac), ang)).astype(np.int32)
            cv2.polylines(out, [box], True, (0, 0, 255), 1)
    cv2.imwrite(dst, out)
    return {'src': src, 'dst': dst, 'w': w, 'h': h, 'bars': boxes, 'mode': mode,
            'height_frac': height_frac, 'width_pad': width_pad, 'blur_k': blur_k,
            'feather_k': feather_k}


def eyedots(src, dst, r_frac=0.18, mode='solid'):
    """Two solid discs on the pupils instead of one bar — the logical endpoint
    of 'smaller draws closer'. r_frac is the radius in units of the inter-eye
    distance."""
    img = cv2.imread(src)
    if img is None: raise SystemExit('cannot read ' + src)
    h, w = img.shape[:2]
    det = detector(w, h, 0.5)
    _, faces = det.detect(img)
    if faces is None or not len(faces): raise SystemExit('no face found in ' + src)
    out = img.copy(); spots = []
    for fa in faces:
        re_, le = (float(fa[4]), float(fa[5])), (float(fa[6]), float(fa[7]))
        d = float(np.hypot(le[0] - re_[0], le[1] - re_[1])) or float(fa[2]) * 0.4
        r = max(2, int(d * r_frac))
        for (ex, ey) in (re_, le):
            cv2.circle(out, (int(ex), int(ey)), r, (0, 0, 0), -1)
            spots.append([int(ex), int(ey), r])
    cv2.imwrite(dst, out)
    return {'src': src, 'dst': dst, 'spots': spots, 'r_frac': r_frac}

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
