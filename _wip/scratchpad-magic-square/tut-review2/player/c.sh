#!/bin/sh
# 使い方: c.sh '<json>'
curl -s -X POST --data "$1" http://127.0.0.1:5399/
echo
