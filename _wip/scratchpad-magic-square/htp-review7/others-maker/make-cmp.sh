#!/bin/bash
# つないだタブの画像を作り、変更前と変更後を左右に並べる: ./make-cmp.sh <game> [dev...]
cd "$(dirname "$0")"
g=$1; shift
devs=${@:-phone w320 pc}
mkdir -p cmp
for d in $devs; do
  for v in before after; do
    ls shots/$g/$v-$d-tab-*-segs.json >/dev/null 2>&1 && python3 -I stitch.py shots/$g/$v-$d-tab-*-segs.json > /dev/null
  done
  for t in rules operations scoring; do
    if [ -f shots/$g/before-$d-tab-$t-full.png ] && [ -f shots/$g/after-$d-tab-$t-full.png ]; then
      python3 -I pair.py cmp/$g-$d-$t.png shots/$g/before-$d-tab-$t-full.png shots/$g/after-$d-tab-$t-full.png > /dev/null
    fi
  done
done
ls cmp/$g-* | tr '\n' ' '
