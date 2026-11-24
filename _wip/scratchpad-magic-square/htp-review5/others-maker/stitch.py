"""Stitch scroll segments into one image per tab: python3 -I stitch.py <segs.json>..."""
import json
import sys
from PIL import Image

STICKY = 44  # tab row height kept at the top of the scroller on phones


def stitch(meta_path):
    meta = json.load(open(meta_path))
    segs = meta["segs"]
    first = Image.open(segs[0]["file"])
    scale = first.width / meta["clip"]["width"]
    total_h = int(round((segs[-1]["scrollTop"]) * scale)) + first.height
    out = Image.new("RGB", (first.width, total_h), "white")
    sticky = STICKY if meta["clip"]["width"] < 600 else 0
    for i, seg in enumerate(segs):
        im = Image.open(seg["file"]).convert("RGB")
        y = int(round(seg["scrollTop"] * scale))
        if i == 0 or sticky == 0:
            out.paste(im, (0, y))
        else:
            cut = int(sticky * scale)
            out.paste(im.crop((0, cut, im.width, im.height)), (0, y + cut))
    if scale > 1:
        out = out.resize((int(out.width / scale), int(out.height / scale)), Image.LANCZOS)
    dst = meta_path.replace("-segs.json", "-full.png")
    out.save(dst)
    return dst


if __name__ == "__main__":
    for p in sys.argv[1:]:
        print(stitch(p))
