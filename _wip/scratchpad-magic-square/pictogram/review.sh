#!/usr/bin/env bash
# usage: review.sh <name> <svg...>  — 112px と 48px の比較表を撮る
S=/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square; P=$S/pictogram
name=$1; shift
for size in 112 48; do
  python3 /home/user/pa-zzle/.claude/skills/design-game-pictogram/scripts/make_review_sheet.py --output $P/$name-$size.html --size $size "$@" >/dev/null
  node $P/render-html.mjs $P/$name-$size.html $S/shots/05/$name-$size.png 1500
done
