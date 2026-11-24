"""変更前と変更後を左右に並べる: python3 -I pair.py <出力> <左の画像> <右の画像> [<最大の高さ>]"""
import sys

from PIL import Image, ImageDraw


def pair(dst, left, right, max_h=None):
    a = Image.open(left).convert("RGB")
    b = Image.open(right).convert("RGB")
    gap = 24
    h = max(a.height, b.height)
    out = Image.new("RGB", (a.width + b.width + gap, h + 28), (200, 40, 40))
    out.paste(Image.new("RGB", (out.width, out.height), "white"), (0, 0))
    out.paste(a, (0, 28))
    out.paste(b, (a.width + gap, 28))
    d = ImageDraw.Draw(out)
    d.rectangle([a.width + 4, 0, a.width + gap - 4, out.height], fill=(180, 180, 180))
    d.text((6, 6), "before", fill=(0, 0, 0))
    d.text((a.width + gap + 6, 6), "after", fill=(0, 0, 0))
    if max_h and out.height > max_h:
        s = max_h / out.height
        out = out.resize((int(out.width * s), max_h), Image.LANCZOS)
    out.save(dst)
    return dst


if __name__ == "__main__":
    print(pair(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else None))
