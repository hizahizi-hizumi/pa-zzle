#!/usr/bin/env bash
# usage: d.sh <iphone|pc> <op> [args...]
port=9331; [ "$1" = pc ] && port=9332; shift
exec node /home/user/pa-zzle/.claude/skills/share/playtest-driver.mjs send --port $port "$@"
