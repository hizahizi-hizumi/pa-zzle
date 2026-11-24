#!/bin/bash
cd "$(dirname "$0")"
xargs -P 2 -L 1 sh -c 'timeout 600 node "$0" "$1" "$2" "$3" "$4" "$5" "$6" "$7" >> "logs/followups.out" 2>&1; echo "done $0 $1 $2 $3 $4 $5 $6 $?"' < followups.txt
