import sys
for line in open(sys.argv[1]):
    line=line.rstrip('\n')
    if line.startswith('   text:'):
        t=line; k=t.find('14 15 16 ')
        print('   msg:', t[k+9:] if k>=0 else t[:200])
    elif line.startswith('   sums:'):
        continue
    else:
        print(line)
