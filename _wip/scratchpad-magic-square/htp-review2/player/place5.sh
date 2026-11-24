#!/bin/bash
# usage: place5.sh r c n [shotname]  -- 5x5 board coordinates (from screenshot), tray 7 columns
D=$(dirname "$0")
xs=(479 559 640 720 801)
ys=(152 232 313 394 474)
txs=(398 479 559 640 720 801 881)
tys=(609 657 705 756)
r=$1; c=$2; n=$3
i=$((n-1)); tr=$((i/7)); tc=$((i%7))
"$D/c.sh" "{\"op\":\"click\",\"x\":${xs[$c]},\"y\":${ys[$r]},\"waitAfter\":300}" >/dev/null
if [ -n "$4" ]; then
  "$D/c.sh" "{\"op\":\"click\",\"x\":${txs[$tc]},\"y\":${tys[$tr]},\"waitAfter\":600,\"shot\":\"$4\"}"
else
  "$D/c.sh" "{\"op\":\"click\",\"x\":${txs[$tc]},\"y\":${tys[$tr]},\"waitAfter\":400}"
fi
