"""sheet.py out.png cols scale files... : contact sheet"""
import sys
from PIL import Image, ImageDraw
out, cols, scale = sys.argv[1], int(sys.argv[2]), float(sys.argv[3])
fs = sys.argv[4:]
ims = [Image.open(f).convert('RGB') for f in fs]
ims = [im.resize((int(im.width * scale), int(im.height * scale))) for im in ims]
w = max(i.width for i in ims); h = max(i.height for i in ims) + 14
rows = (len(ims) + cols - 1) // cols
o = Image.new('RGB', (cols * (w + 6), rows * (h + 6)), '#666')
d = ImageDraw.Draw(o)
for k, (im, f) in enumerate(zip(ims, fs)):
    x = (k % cols) * (w + 6); y = (k // cols) * (h + 6)
    d.text((x + 2, y), f.split('/')[-1][-12:], fill='white')
    o.paste(im, (x, y + 14))
o.save(out); print(out, o.size)
