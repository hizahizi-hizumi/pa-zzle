#!/bin/bash
# v0 の後に、推奨の規則で組み直し（v1）、再現を確かめ、分析と期待値を書く
set -e
D=/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work/docs/パズル/導入調査/魔方陣/調査コード
S=/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/supply
cd "$S"
cat cache.jsonl cache-v1.jsonl > cache-final.jsonl
python3 -B "$D/magic_square_supply.py" pool --per-level 500 --l2-four 250 --near 4 --unique-d4-answer4 \
  --cache cache-final.jsonl --out pool-v1.json --jobs 4 --batch 32
python3 -B "$D/magic_square_supply.py" pool --per-level 500 --l2-four 250 --near 4 --unique-d4-answer4 \
  --cache cache-final.jsonl --out pool-v1b.json --jobs 1 --batch 5
python3 -c "
import json
a=json.load(open('pool-v1.json'))['levels']; b=json.load(open('pool-v1b.json'))['levels']
print('v1 levels identical between jobs=4/batch=32 and jobs=1/batch=5:', a==b)
v0=json.load(open('pool-v0.json'))['levels']
for L in ('3','4','5'):
    print('L'+L, 'same ids as v0:', sorted(a[L])==sorted(v0[L]), 'same order:', a[L]==v0[L])
"
python3 -B "$D/magic_square_supply.py" analyze --pool pool-v0.json --cache cache-final.jsonl > analyze-v0.md
python3 -B "$D/magic_square_supply.py" analyze --pool pool-v1.json --cache cache-final.jsonl --write-json pool-v1-product.json > analyze-v1.md
python3 -B "$D/magic_square_supply.py" examples --pool pool-v1.json --cache cache-final.jsonl > examples-v1.json
python3 -B "$D/magic_square_supply.py" expected --pool pool-v1.json --cache cache-final.jsonl --out "$D/magic_square_supply.expected.json"
echo all-done
