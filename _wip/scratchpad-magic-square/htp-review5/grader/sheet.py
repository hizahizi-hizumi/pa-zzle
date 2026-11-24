import sys, glob, os
from PIL import Image, ImageDraw
src, prefix, cols, scale = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4])
files = sorted(glob.glob(os.path.join(src, prefix + '*.png')))
per = int(sys.argv[5]) if len(sys.argv) > 5 else 12
for s in range(0, len(files), per):
    chunk = files[s:s+per]
    ims = [Image.open(f) for f in chunk]
    w, h = int(ims[0].width*scale), int(ims[0].height*scale)
    rows = (len(ims)+cols-1)//cols
    sheet = Image.new('RGB', (cols*(w+6), rows*(h+22)), 'white')
    d = ImageDraw.Draw(sheet)
    for i, (im, f) in enumerate(zip(ims, chunk)):
        x, y = (i%cols)*(w+6), (i//cols)*(h+22)
        sheet.paste(im.resize((w, h)), (x, y+20))
        d.text((x+2, y+2), os.path.basename(f), fill='red')
    out = os.path.join(src, f'sheet-{prefix}{s//per:02d}.png')
    sheet.save(out); print(out)
