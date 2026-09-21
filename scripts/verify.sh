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

run_check "Frontend Biome" bun run --cwd frontend check
run_check "Frontend TypeScript" bun run --cwd frontend typecheck
run_check "Semantic lint TypeScript" bun run --cwd frontend semantic-lint:typecheck
run_check "Semantic lint tests" bun run --cwd frontend semantic-lint:test
run_check "Semantic lint doctor" bun run --cwd frontend semantic-lint -- doctor
run_check "Semantic lint inspect" bun run --cwd frontend semantic-lint -- inspect vitest/arrange-outside-test src/records/storage.test.ts --plan-only
run_check "Frontend Vitest" bun run --cwd frontend test
run_check "Frontend build" bun run --cwd frontend build

if (( ${#failed_checks[@]} > 0 )); then
  printf '\nQuality verification failed:\n' >&2
  printf ' - %s\n' "${failed_checks[@]}" >&2
  exit 1
fi

printf '\nAll quality checks passed.\n'
