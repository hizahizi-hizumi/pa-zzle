#!/bin/bash
cd "$(dirname "$0")"
GAMES="takuzu water-sort minesweeper nanpure bridges parking-jam ice-floor-maze hitofude-puzzle slide-puzzle tsume-shogi reflection"
for g in $GAMES; do
  for d in sp pc; do
    timeout 400 node capture.js before $g $d > log-$g-$d-before.txt 2>&1 &
    timeout 400 node capture.js after $g $d > log-$g-$d-after.txt 2>&1 &
    wait
    echo "$g $d done: $(cat log-$g-$d-before.txt | tail -1) / $(cat log-$g-$d-after.txt | tail -1)"
  done
done
echo ALLDONE
