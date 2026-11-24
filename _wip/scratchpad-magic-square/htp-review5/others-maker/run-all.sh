#!/bin/bash
cd "$(dirname "$0")"
xargs -P 2 -L 1 sh -c 'timeout 900 node capture.js "$0" "$1" "$2" > "logs/$2-$0-$1.out" 2>&1; echo "done $2 $0 $1 $?"' < jobs.txt
