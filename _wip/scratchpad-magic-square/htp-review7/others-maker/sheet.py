"""画像を横に並べる: python3 -I sheet.py <出力> <最大の高さ> <画像...>"""
import sys
from PIL import Image, ImageDraw
dst, max_h, *files = sys.argv[1:]
ims = [Image.open(f).convert("RGB") for f in files]
h = max(i.height for i in ims) + 20
w = sum(i.width for i in ims) + 16 * (len(ims) - 1)
out = Image.new("RGB", (w, h), "white")
x = 0
d = ImageDraw.Draw(out)
for f, i in zip(files, ims):
    out.paste(i, (x, 20))
    d.text((x + 2, 4), f.split("/")[-1][:60], fill=(0, 0, 0))
    x += i.width + 16
    if x < w:
        d.rectangle([x - 12, 0, x - 4, h], fill=(180, 180, 180))
mh = int(max_h)
if out.height > mh:
    s = mh / out.height
    out = out.resize((int(out.width * s), mh), Image.LANCZOS)
out.save(dst)
print(dst)
