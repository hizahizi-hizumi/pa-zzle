#!/bin/bash
# 使い方: c.sh '{"op":"click","x":1,"y":2}'
curl -s -X POST --data "$1" http://127.0.0.1:${PORT:-7391}/
echo
