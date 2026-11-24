#!/bin/bash
set -e
cd /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/a4-4
P="python3 -I /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work/docs/パズル/導入調査/魔方陣/調査コード/magic_square_difficulty.py"
$P corpus --sizes 4 --tiers 1 2 3 --addback 0 1 2 --per 60 --jobs 3 --out h4.jsonl
$P corpus --sizes 5 --tiers 1 2 3 --addback 0 1 2 --per 60 --jobs 3 --out h5.jsonl
$P corpus --sizes 5 --tiers 2 3 --addback 12 --per 120 --jobs 3 --out q5.jsonl
$P corpus --sizes 6 --tiers 1 2 3 --addback 0 1 2 --per 40 --jobs 3 --out h6.jsonl
$P corpus --sizes 6 --tiers 2 3 --addback 12 --per 80 --jobs 3 --out q6.jsonl
echo DONE
