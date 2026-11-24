#!/bin/bash
# 版 8 の問題集を組む（L1・L2 は 500 ずつ、L3〜L5 は標本 100 ずつ）。2プロセス。
set -e
cd /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/supply8
D=/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work/docs/パズル/導入調査/魔方陣/調査コード
P="python3 -B $D/magic_square_supply.py"
s=$(date +%s)
$P pool --levels 1 2 --near 4 --unique-d4-answer4 --jobs 2 --max-visits 40000 --progress --cache cache.jsonl --out pool-v8-L12.json 2> pool-L12.log
echo "L12 $(( $(date +%s)-s ))s" >> run.log
$P pool --level-quota 3=100 4=100 5=100 --near 4 --unique-d4-answer4 --jobs 2 --max-visits 40000 --progress --cache cache.jsonl --out pool-v8.json 2> pool-all.log
echo "ALL $(( $(date +%s)-s ))s" >> run.log
