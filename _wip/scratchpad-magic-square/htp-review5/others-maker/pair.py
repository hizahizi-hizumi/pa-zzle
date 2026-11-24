"""Side-by-side before|after images: python3 -I pair.py <out.png> <before.png> <after.png> [maxw]"""
import sys
from PIL import Image, ImageDraw


def pair(out, b, a, maxw=None):
    ims = []
    for p in (b, a):
        try:
            ims.append(Image.open(p).convert("RGB"))
        except FileNotFoundError:
            ims.append(Image.new("RGB", (200, 100), "#f0c"))
    if maxw:
        ims = [im.resize((int(maxw), int(im.height * maxw / im.width))) if im.width > maxw else im for im in ims]
    w = sum(im.width for im in ims) + 30
    h = max(im.height for im in ims) + 24
    o = Image.new("RGB", (w, h), "#777")
    d = ImageDraw.Draw(o)
    x = 10
    for lab, im in zip(("BEFORE", "AFTER"), ims):
        d.text((x, 4), lab, fill="white")
        o.paste(im, (x, 20))
        x += im.width + 10
    o.save(out)


if __name__ == "__main__":
    pair(sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]) if len(sys.argv) > 4 else None)
