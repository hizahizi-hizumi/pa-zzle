# usage: python3 pairs.py <game> <dev> <kind> ; kind = rules|operations|scoring|panels-ops
# writes cmp/<game>-<dev>-<kind>-N.png : rows of before|after pairs, chunked to max height
import sys, os, glob, re
from PIL import Image, ImageDraw
game, dev, kind = sys.argv[1:4]
base = f'shots/{game}/{dev}'
maxh = int(os.environ.get('MAXH', '2400'))
state = os.environ.get('STATE', 'c')
def files(v):
    if kind in ('rules', 'operations-p'):
        t = 'rules' if kind == 'rules' else 'operations'
        fs = glob.glob(f'{base}/{v}/{t}-p*-{state}.png')
        return sorted(fs, key=lambda f: int(re.search(r'-p(\d+)-', f).group(1)))
    fs = glob.glob(f'{base}/{v}/{kind}-sec*.png')
    return sorted(fs, key=lambda f: int(re.search(r'sec(\d+)', f).group(1)))
b, a = files('before'), files('after')
n = max(len(b), len(a))
rows = []
for i in range(n):
    ib = Image.open(b[i]).convert('RGB') if i < len(b) else Image.new('RGB', (100, 100), 'gray')
    ia = Image.open(a[i]).convert('RGB') if i < len(a) else Image.new('RGB', (100, 100), 'gray')
    rows.append((ib, ia))
chunks, cur, h = [], [], 0
for r in rows:
    rh = max(r[0].height, r[1].height) + 16
    if cur and h + rh > maxh:
        chunks.append(cur); cur, h = [], 0
    cur.append(r); h += rh
if cur: chunks.append(cur)
for ci, ch in enumerate(chunks):
    W = max(r[0].width for r in ch) + max(r[1].width for r in ch) + 16
    H = sum(max(r[0].height, r[1].height) + 16 for r in ch)
    m = Image.new('RGB', (W, H), (255, 0, 255))
    y = 0; bw = max(r[0].width for r in ch)
    for ib, ia in ch:
        m.paste(ib, (0, y)); m.paste(ia, (bw + 16, y)); y += max(ib.height, ia.height) + 16
    out = f'cmp/{game}-{dev}-{kind}{"-"+state if kind!="scoring" and kind!="operations" else ""}-{ci}.png'
    m.save(out); print(out, m.size)
