#!/bin/bash
# usage: ./c.sh '<json>'
curl -s -X POST --data "$1" http://127.0.0.1:7811/
