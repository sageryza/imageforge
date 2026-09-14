"""Score how close a generated face is to the original, with SFace embeddings.

Cosine similarity between face embeddings. OpenCV's own guidance for this model
puts the same-identity threshold at 0.363 cosine. Higher is closer.
"""
import cv2, numpy as np, os, glob, importlib.util
spec=importlib.util.spec_from_file_location('ft','facetool.py'); ft=importlib.util.module_from_spec(spec); spec.loader.exec_module(ft)
SF = cv2.FaceRecognizerSF.create(os.path.join(os.path.dirname(os.path.abspath(__file__)),'models','sface.onnx'),'')

def feats(img, pick='biggest'):
    h,w = img.shape[:2]
    det = ft.detector(w,h,0.5); _,fa = det.detect(img)
    if fa is None or not len(fa): return None
    f = max(fa,key=lambda z:z[2]*z[3]) if pick=='biggest' else min(fa,key=lambda z:z[0])
    aligned = SF.alignCrop(img, f)
    return SF.feature(aligned)

def sim(a,b):
    if a is None or b is None: return None
    return float(SF.match(a,b,cv2.FaceRecognizerSF_FR_COSINE))

def clip_score(ref_img, frame_dir, pick='biggest', every=6):
    """Average similarity across the clip's frames — one frame can be a fluke."""
    r = feats(ref_img, pick)
    vals=[]
    for f in sorted(glob.glob(os.path.join(frame_dir,'*.png')))[::every]:
        im=cv2.imread(f)
        if im is None: continue
        v=sim(r, feats(im, pick))
        if v is not None: vals.append(v)
    if not vals: return None
    return {'n':len(vals),'mean':round(float(np.mean(vals)),4),
            'best':round(float(max(vals)),4),'worst':round(float(min(vals)),4)}
