import json, sys
from PIL import Image
for cfg in ["iphone", "pc", "w320"]:
    for entry in json.load(open(f"overlap-{cfg}.json")):
        im = Image.open(entry["file"]).convert("RGB")
        s = entry["scale"]
        out = []
        for m in entry["marks"]:
            cx = (m["x"] + m["w"] / 2) * s; cy = (m["y"] + m["h"] / 2) * s; r = min(m["w"], m["h"]) / 2 * s
            dark = 0
            for y in range(int(cy - r), int(cy + r) + 1):
                for x in range(int(cx - r), int(cx + r) + 1):
                    if (x - cx) ** 2 + (y - cy) ** 2 > r * r: continue
                    R, G, B = im.getpixel((x, y))
                    if 0.299 * R + 0.587 * G + 0.114 * B < 140: dark += 1
            out.append(f"{m['label']}={dark}")
        print(cfg, entry["heading"], f"mark {entry['marks'][0]['w']:.1f}px", " ".join(out))
