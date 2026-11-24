#!/bin/sh
# usage: do.sh '<json command or array>'
curl -s -X POST --noproxy 127.0.0.1 -d "$1" http://127.0.0.1:9377/
echo
