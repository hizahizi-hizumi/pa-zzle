#!/usr/bin/env bash
# usage: solve-l1.sh <device> <leave-last: yes|no>
S=/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square
dev=$1
cell() { python3 -c "i=$1; print(round(95+(i%4)*66.7), round(175+(i//4)*66.7))"; }
val() { python3 -c "v=$1; print(round(30+((v-1)%8)*47.2), round(522+((v-1)//8)*48))"; }
for pair in 3:11 4:9 6:7 7:16 8:8 9:13 13:15 0:14; do
  c=${pair%%:*}; v=${pair##*:}
  $S/d.sh $dev tap $(cell $c) >/dev/null
  if [ "$c" = 0 ] && [ "$2" = yes ]; then exit 0; fi
  $S/d.sh $dev tap $(val $v) >/dev/null
done
