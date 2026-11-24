#!/bin/bash
# usage: c.sh '<json>'
curl -s -X POST -d "$1" http://127.0.0.1:47391/
echo
