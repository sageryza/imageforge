"""Download a clip, extract every frame, score faces, save the best stills."""
import cv2, numpy as np, json, os, sys, subprocess, math, urllib.request, importlib.util
FF = '/home/user/imageforge/node_modules/ffmpeg-static/ffmpeg'
spec = importlib.util.spec_from_file_location('ft', 'facetool.py'); ft = importlib.util.module_from_spec(spec); spec.loader.exec_module(ft)

def fetch(url, dst):
    if os.path.exists(dst) and os.path.getsize(dst) > 1000: return dst
    urllib.request.urlretrieve(url, dst); return dst

def frames(mp4, outdir, fps=None):
    os.makedirs(outdir, exist_ok=True)
    if os.listdir(outdir): return outdir
    cmd = [FF, '-hide_banner', '-loglevel', 'error', '-i', mp4]
    if fps: cmd += ['-vf', 'fps=%s' % fps]
    else: cmd += ['-vsync', '0']
    cmd += ['-q:v', '1', os.path.join(outdir, 'f%04d.png')]
    subprocess.run(cmd, check=True); return outdir

def analyse(folder):
    det, dims, rows = None, None, []
    for f in sorted(os.listdir(folder)):
        if not f.endswith('.png'): continue
        img = cv2.imread(os.path.join(folder, f))
        if img is None: continue
        h, w = img.shape[:2]
        if dims != (w, h): det, dims = ft.detector(w, h, 0.55), (w, h)
        _, faces = det.detect(img)
        if faces is None or not len(faces): continue
        for fa in faces:
            x, y, fw, fh = [float(v) for v in fa[:4]]
            if fw < 12 or fh < 12: continue
            c = img[max(0, int(y)):int(y+fh), max(0, int(x)):int(x+fw)]
            if c.size == 0: continue
            g = cv2.cvtColor(cv2.resize(c, (128, 128)), cv2.COLOR_BGR2GRAY)
            rex, rey, lex, ley, nx = fa[4], fa[5], fa[6], fa[7], fa[8]
            d = float(np.hypot(lex-rex, ley-rey)) or 1
            rows.append({'file': f, 'w': w, 'h': h,
                         'face': [round(x,1), round(y,1), round(fw,1), round(fh,1)],
                         'crisp': round(float(cv2.Laplacian(g, cv2.CV_64F).var()), 1),
                         'yaw': round(float(abs(nx-(rex+lex)/2))/d, 2),
                         'tilt': round(float(abs(ley-rey))/d, 2),
                         'nfaces': len(faces), 'conf': round(float(fa[-1]), 3)})
    return rows

if __name__ == '__main__':
    key, url = sys.argv[1], sys.argv[2]
    mp4 = 'src/%s.mp4' % key
    fetch(url, mp4)
    fd = frames(mp4, 'frames/%s' % key)
    rows = analyse(fd)
    json.dump(rows, open('scan-%s.json' % key, 'w'), indent=1)
    n = len(set(r['file'] for r in rows))
    print('%s: %d frames with faces, %d face rows' % (key, n, len(rows)))
