#!/bin/bash
# ブラウザは同時に2つまで
cd "$(dirname "$0")"
mkdir -p logs
xargs -P 2 -L 1 sh -c 'timeout 1200 node capture.js "$0" "$1" "$2" > "logs/$2-$0-$1.out" 2>&1; echo "done $2 $0 $1 $?"' < "${1:-jobs.txt}"
