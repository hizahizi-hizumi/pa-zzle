#!/bin/bash
cd "$(dirname "$0")"
mkdir -p logs/fu
i=0
while IFS= read -r line; do
  i=$((i+1))
  printf '%s\0' "$i|$line"
done < followups.txt | xargs -0 -P 2 -I{} sh -c 'n=$(echo "{}" | cut -d"|" -f1); c=$(echo "{}" | cut -d"|" -f2-); timeout 600 $c > logs/fu/$n.out 2>&1; echo "fu-done $n $? $c"'
