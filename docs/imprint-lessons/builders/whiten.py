import sys
from PIL import Image, ImageDraw
def whiten(inp, outp, thresh=48):
    im = Image.open(inp).convert('RGB')
    w,h = im.size
    seeds = [(2,2),(w-3,2),(2,h-3),(w-3,h-3)]
    for s in seeds:
        ImageDraw.floodfill(im, s, (255,255,255), thresh=thresh)
    im.save(outp)
if __name__=='__main__':
    whiten(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv)>3 else 48)
    print('done', sys.argv[2])
