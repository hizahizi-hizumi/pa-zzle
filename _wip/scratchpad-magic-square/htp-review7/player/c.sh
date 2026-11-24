#!/bin/bash
# 使い方: c.sh '<json>'
curl -s -X POST --noproxy 127.0.0.1 http://127.0.0.1:47391/ -d "$1"
echo
