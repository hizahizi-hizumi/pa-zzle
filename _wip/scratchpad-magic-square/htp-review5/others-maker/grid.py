"""grid.py out.png maxw files... : stack before|after pairs vertically. files given as pairs (before after)."""
import sys
from PIL import Image, ImageDraw
out = sys.argv[1]; maxw = int(sys.argv[2]); files = sys.argv[3:]
rows = []
for i in range(0, len(files), 2):
    ims = []
    for p in files[i:i+2]:
        try:
            im = Image.open(p).convert('RGB')
        except FileNotFoundError:
            im = Image.new('RGB', (100, 40), '#f0c')
        if im.width > maxw:
            im = im.resize((maxw, int(im.height * maxw / im.width)))
        ims.append(im)
    w = sum(im.width for im in ims) + 30
    h = max(im.height for im in ims) + 22
    row = Image.new('RGB', (w, h), '#777')
    d = ImageDraw.Draw(row)
    x = 10
    for lab, im, p in zip(('BEFORE', 'AFTER'), ims, files[i:i+2]):
        d.text((x, 3), lab + ' ' + p.split('/')[-1][:60], fill='white')
        row.paste(im, (x, 18)); x += im.width + 10
    rows.append(row)
W = max(r.width for r in rows); H = sum(r.height for r in rows)
o = Image.new('RGB', (W, H), '#444'); y = 0
for r in rows:
    o.paste(r, (0, y)); y += r.height
o.save(out); print(out, o.size)
