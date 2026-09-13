#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF_USAGE'
Usage:
  .github/workflows/scripts/run-chatgpt-quality.sh <offline-dependencies.tar.zst> [repository-root]
EOF_USAGE
}

fail() {
  printf 'chatgpt-quality: %s\n' "$*" >&2
  exit 1
}

[[ $# -ge 1 && $# -le 2 ]] || {
  usage >&2
  exit 2
}

archive="$(realpath "$1")"
repo_root="$(realpath "${2:-.}")"
[[ -f "$archive" ]] || fail "Artifact archive not found: $archive"
[[ -f "$repo_root/.bun-version" && -f "$repo_root/frontend/bun.lock" ]] || fail "Repository Snapshot is incomplete: $repo_root"

# shellcheck disable=SC1091
source "$repo_root/.github/actions/offline-dependencies/inputs.env"
expected_schema="$OFFLINE_DEPENDENCIES_SCHEMA"

actual_platform="$(uname -s | tr '[:upper:]' '[:lower:]')"
actual_arch="$(uname -m)"
actual_libc="$(getconf GNU_LIBC_VERSION 2>/dev/null | awk '{print $1}')"

[[ "$actual_platform" == "$PLATFORM" ]] || fail "platform $PLATFORM is required, got $actual_platform"
[[ "$actual_arch" == "$ARCH" ]] || fail "architecture $ARCH is required, got $actual_arch"
[[ "$actual_libc" == "$LIBC" ]] || fail "libc $LIBC is required, got ${actual_libc:-unknown}"

work_dir="$(mktemp -d)"
server_pid=""
cleanup() {
  if [[ -n "$server_pid" ]] && kill -0 "$server_pid" 2>/dev/null; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  if [[ -L "$repo_root/frontend/node_modules" ]]; then
    rm "$repo_root/frontend/node_modules"
  fi
  rm -rf "$work_dir"
}
trap cleanup EXIT

tar --zstd -xf "$archive" -C "$work_dir"
[[ -f "$work_dir/manifest.env" ]] || fail "manifest.env not found in Artifact"
[[ -x "$work_dir/runtime/bun" ]] || fail "Bun runtime not found in Artifact"
[[ -d "$work_dir/frontend/node_modules" ]] || fail "frontend node_modules not found in Artifact"

# shellcheck disable=SC1091
source "$work_dir/manifest.env"
[[ "$OFFLINE_DEPENDENCIES_SCHEMA" == "$expected_schema" ]] || fail "Artifact schema does not match Repository Snapshot"
expected_key="$(python3 "$repo_root/.github/actions/offline-dependencies/scripts/artifact_state.py" key --repo-root "$repo_root")"
[[ "$INPUT_KEY" == "$expected_key" ]] || fail "Artifact key does not match Repository Snapshot"

expected_bun_version="$(tr -d '[:space:]' < "$repo_root/.bun-version")"
actual_bun_version="$($work_dir/runtime/bun --version)"
[[ "$actual_bun_version" == "$expected_bun_version" ]] || fail "Artifact Bun version does not match Repository Snapshot"

if [[ -e "$repo_root/frontend/node_modules" || -L "$repo_root/frontend/node_modules" ]]; then
  fail "frontend/node_modules already exists: $repo_root/frontend/node_modules"
fi
ln -s "$work_dir/frontend/node_modules" "$repo_root/frontend/node_modules"

export PATH="$work_dir/runtime:$PATH"
export npm_config_registry=http://127.0.0.1:9
export NPM_CONFIG_REGISTRY=http://127.0.0.1:9
export BUN_CONFIG_REGISTRY=http://127.0.0.1:9

cd "$repo_root"
./scripts/verify.sh

server_log="$work_dir/dev-server.log"
PORT=3000 bun run --cwd frontend dev >"$server_log" 2>&1 &
server_pid=$!
server_ready=0
for _ in $(seq 1 40); do
  if curl --fail --silent --show-error http://127.0.0.1:3000/ >/dev/null 2>&1; then
    server_ready=1
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    cat "$server_log" >&2
    fail "Frontend development server exited before becoming ready"
  fi
  sleep 0.25
done

if (( server_ready == 0 )); then
  cat "$server_log" >&2
  fail "Frontend development server did not become ready"
fi

kill "$server_pid"
wait "$server_pid" 2>/dev/null || true
server_pid=""

printf 'chatgpt-quality: PASS input_key=%s\n' "$INPUT_KEY"
