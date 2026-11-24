import re
base='/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/'
head=open(base+'report-head-14.md',encoding='utf-8').read().rstrip()+'\n'
commits=open(base+'report-commits-14.md',encoding='utf-8').read().rstrip()+'\n'
fix=open(base+'report-fix-14.md',encoding='utf-8').read().rstrip()+'\n'
check=open(base+'report-check-14.md',encoding='utf-8').read().rstrip()+'\n'
hist=open(base+'report-history.md',encoding='utf-8').read()
sections=re.split(r'(?m)^(?=## )',hist)
keep=[]
alt=None
for sec in sections:
    if not sec.strip():
        continue
    title=sec.splitlines()[0]
    if title.startswith('## 決めたこと'):
        continue
    if title.startswith('## 人間に残す別案'):
        alt=sec.replace('## 人間に残す別案（最終レビュー）','### 人間に残す別案（最終レビュー）',1).rstrip()+'\n'
        continue
    if title.startswith('## 3-3 で控えたゲーム'):
        sec=sec.replace(title,'## 3-3 で控えたゲームの撮影（カード 13 まで）',1)
    if title.startswith('## 5で確かめたこと'):
        sec=sec.replace(title,'## 5で確かめたこと（カード 13 まで）',1)
    keep.append(sec.rstrip()+'\n')
assert alt is not None
marker='### 5-2 のスクリーンショット'
i=head.index(marker)
head=head[:i]+alt+'\n'+head[i:]
out=head+'\n'+commits+'\n'+fix+'\n'+check+'\n'+'\n'.join(keep)
open(base+'design-puzzle-how-to-play-report.md','w',encoding='utf-8').write(out)
print(len(out.splitlines()))
