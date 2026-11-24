"""送りながら撮った切れ目をタブ1枚につなぐ: python3 -I stitch.py <segs.json>..."""
import json
import sys

from PIL import Image


def stitch(meta_path):
    meta = json.load(open(meta_path))
    segs = meta["segs"]
    first = Image.open(segs[0]["file"])
    scale = first.width / meta["clip"]["width"]
    total_h = int(round(segs[-1]["scrollTop"] * scale)) + first.height
    out = Image.new("RGB", (first.width, total_h), "white")
    sticky = meta.get("sticky", 0)
    if sticky >= meta["clip"]["height"] * 0.5:
        sticky = 0  # PC: 帯は送る領域の外にある
    for i, seg in enumerate(segs):
        im = Image.open(seg["file"]).convert("RGB")
        y = int(round(seg["scrollTop"] * scale))
        if i == 0 or sticky <= 0:
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
