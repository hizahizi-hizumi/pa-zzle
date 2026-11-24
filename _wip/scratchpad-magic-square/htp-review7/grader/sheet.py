import sys
from PIL import Image, ImageDraw
out=sys.argv[1]; scale=float(sys.argv[2]); cols=int(sys.argv[3]); files=sys.argv[4:]
ims=[Image.open(f) for f in files]
ims=[i.resize((int(i.width*scale),int(i.height*scale))) for i in ims]
w=max(i.width for i in ims); h=max(i.height for i in ims)
rows=(len(ims)+cols-1)//cols
sheet=Image.new('RGB',(cols*(w+12),rows*(h+30)),'#888')
d=ImageDraw.Draw(sheet)
for k,(i,f) in enumerate(zip(ims,files)):
    x=(k%cols)*(w+12); y=(k//cols)*(h+30)
    sheet.paste(i,(x,y+24)); d.text((x+2,y+4),f.split('/')[-1][:60],fill='white')
sheet.save(out); print(sheet.size)
