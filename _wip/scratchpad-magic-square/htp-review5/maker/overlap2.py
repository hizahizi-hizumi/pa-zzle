import json
from PIL import Image
from collections import Counter
for cfg in ["iphone", "pc", "w320"]:
    for entry in json.load(open(f"overlap-{cfg}.json")):
        im = Image.open(entry["file"]).convert("RGB")
        s = entry["scale"]
        out = []
        for m in entry["marks"]:
            cx = (m["x"] + m["w"] / 2) * s; cy = (m["y"] + m["h"] / 2) * s; r = min(m["w"], m["h"]) / 2 * s
            px = []
            for y in range(int(cy - r), int(cy + r) + 1):
                for x in range(int(cx - r), int(cx + r) + 1):
                    if (x - cx) ** 2 + (y - cy) ** 2 > r * r: continue
                    px.append(im.getpixel((x, y)))
            bg = Counter(px).most_common(1)[0][0]
            diff = sum(1 for p in px if sum(abs(a - b) for a, b in zip(p, bg)) > 60)
            out.append(f"{m['label'].split(' ')[-1]}={diff}/{len(px)}")
        print(cfg, entry["heading"], " ".join(out))
