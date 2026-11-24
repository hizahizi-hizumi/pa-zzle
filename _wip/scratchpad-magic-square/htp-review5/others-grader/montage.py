# usage: python3 montage.py out.png img1 img2 ... (horizontal, scaled to same height)
import sys
from PIL import Image, ImageDraw
out = sys.argv[1]; files = sys.argv[2:]
ims = []
for f in files:
    try: ims.append(Image.open(f).convert('RGB'))
    except Exception: ims.append(Image.new('RGB', (200, 200), 'white'))
H = max(i.height for i in ims)
scale = float(__import__('os').environ.get('SCALE', '1'))
ims = [i.resize((int(i.width*scale), int(i.height*scale))) for i in ims]
H = max(i.height for i in ims)
W = sum(i.width for i in ims) + 12*(len(ims)-1)
m = Image.new('RGB', (W, H), (255, 0, 255))
x = 0
for i in ims:
    m.paste(i, (x, 0)); x += i.width + 12
m.save(out)
