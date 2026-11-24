#!/bin/bash
cd "$(dirname "$0")"
until grep -q ALLDONE run_all.log; do sleep 5; done
for gd in "water-sort sp" "water-sort pc" "takuzu sp" "takuzu pc" "minesweeper sp"; do
  set -- $gd
  timeout 400 node capture.js before $1 $2 > log-$1-$2-before.txt 2>&1 &
  timeout 400 node capture.js after $1 $2 > log-$1-$2-after.txt 2>&1 &
  wait
  echo "rerun $1 $2 done: $(tail -1 log-$1-$2-before.txt) / $(tail -1 log-$1-$2-after.txt)" >> run_all.log
done
echo RERUNDONE >> run_all.log
