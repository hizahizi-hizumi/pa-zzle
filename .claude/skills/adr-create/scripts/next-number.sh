#!/bin/sh
printf '%s\n' docs/adr/ADR-[0-9][0-9][0-9][0-9]-*.md | sort | tail -n 1 | awk -F- '{printf "%04d\n", $2 + 1}'
