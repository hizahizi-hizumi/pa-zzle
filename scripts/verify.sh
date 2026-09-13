#!/usr/bin/env bash
set -uo pipefail

failed_checks=()

run_check() {
  local name="$1"
  shift

  printf '\n==> %s\n' "$name"
  if "$@"; then
    printf '<== PASS: %s\n' "$name"
  else
    local exit_code=$?
    printf '<== FAIL (%d): %s\n' "$exit_code" "$name" >&2
    failed_checks+=("$name")
  fi
}

run_check "Frontend Biome" bun --cwd frontend run check
run_check "Frontend TypeScript" bun --cwd frontend run typecheck
run_check "Frontend Vitest" bun --cwd frontend run test
run_check "Frontend build" bun --cwd frontend run build

if (( ${#failed_checks[@]} > 0 )); then
  printf '\nQuality verification failed:\n' >&2
  printf ' - %s\n' "${failed_checks[@]}" >&2
  exit 1
fi

printf '\nAll quality checks passed.\n'
