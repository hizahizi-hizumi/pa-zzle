import sys, os, glob, re
from PIL import Image, ImageDraw, ImageFont
D = os.path.dirname(os.path.abspath(__file__))
SH = os.path.join(D, 'shots')
OUT = os.path.join(D, 'cmp')
os.makedirs(OUT, exist_ok=True)
GAP = 24
MAXH = 1900
try:
    FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 14)
except Exception:
    FONT = ImageFont.load_default()

def load(p):
    return Image.open(p).convert('RGB') if p and os.path.exists(p) else None

def compose(pairs, name, scale=1.0):
    rows = []
    for label, l, r in pairs:
        L, R = load(l), load(r)
        if L is None and R is None: continue
        if scale != 1.0:
            L = L.resize((int(L.width*scale), int(L.height*scale))) if L else None
            R = R.resize((int(R.width*scale), int(R.height*scale))) if R else None
        w = max(L.width if L else 0, R.width if R else 0)
        h = max(L.height if L else 0, R.height if R else 0)
        rows.append((label, L, R, w, h))
    if not rows: return []
    W = max(x[3] for x in rows)
    pages, cur, curh = [], [], 0
    for row in rows:
        rh = row[4] + 22
        if cur and curh + rh > MAXH:
            pages.append(cur); cur, curh = [], 0
        cur.append(row); curh += rh
    if cur: pages.append(cur)
    outs = []
    for i, page in enumerate(pages):
        H = sum(r[4] + 22 for r in page)
        img = Image.new('RGB', (W*2 + GAP, H), (255, 0, 255))
        dr = ImageDraw.Draw(img)
        y = 0
        for label, L, R, w, h in page:
            dr.rectangle([0, y, W*2+GAP, y+21], fill=(40, 40, 40))
            dr.text((4, y+3), f'BEFORE  {label}', fill=(255, 255, 0), font=FONT)
            dr.text((W+GAP+4, y+3), f'AFTER  {label}', fill=(0, 255, 255), font=FONT)
            y += 22
            dr.rectangle([0, y, W*2+GAP, y+h], fill=(200, 200, 200))
            if L: img.paste(L, (0, y))
            if R: img.paste(R, (W+GAP, y))
            y += h
        p = os.path.join(OUT, f'{name}-{i+1}.png')
        img.save(p)
        outs.append(p)
    return outs

def run(game, dev):
    b = os.path.join(SH, game, dev, 'before'); a = os.path.join(SH, game, dev, 'after')
    names = sorted(set(os.path.basename(x) for x in glob.glob(b + '/*.png')) | set(os.path.basename(x) for x in glob.glob(a + '/*.png')))
    res = []
    # top views
    top = [n for n in names if re.match(r'(0\d|9\d)-', n)]
    res += compose([(n, os.path.join(b, n), os.path.join(a, n)) for n in top], f'{game}-{dev}-top', 0.75 if dev == 'pc' else 1.0)
    for t in range(3):
        secs = [n for n in names if n.startswith(f't{t}-s')]
        res += compose([(n, os.path.join(b, n), os.path.join(a, n)) for n in secs], f'{game}-{dev}-t{t}-sections')
        touch = [n for n in names if n.startswith(f't{t}-p')]
        res += compose([(n, os.path.join(b, n), os.path.join(a, n)) for n in touch], f'{game}-{dev}-t{t}-touched')
    return res

if __name__ == '__main__':
    for g in sys.argv[2:]:
        for p in run(g, sys.argv[1]):
            print(p)
