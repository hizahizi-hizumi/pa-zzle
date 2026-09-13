#!/usr/bin/env bash
set -euo pipefail

repo_root="${1:?repository root is required}"
expected_sha="${2:?expected commit SHA is required}"
input_key="${3:?input key is required}"

cd "$repo_root"
actual_sha="$(git rev-parse HEAD)"
if [[ "$actual_sha" != "$expected_sha" ]]; then
  printf 'offline-dependencies: checked out %s, expected %s\n' "$actual_sha" "$expected_sha" >&2
  exit 1
fi

# shellcheck disable=SC1091
source .github/actions/offline-dependencies/inputs.env

actual_platform="$(uname -s | tr '[:upper:]' '[:lower:]')"
actual_arch="$(uname -m)"
actual_libc="$(getconf GNU_LIBC_VERSION 2>/dev/null | awk '{print $1}')"
expected_bun_version="$(tr -d '[:space:]' < .bun-version)"
actual_bun_version="$(bun --version)"

[[ "$actual_platform" == "$PLATFORM" ]] || {
  printf 'offline-dependencies: platform %s is required, got %s\n' "$PLATFORM" "$actual_platform" >&2
  exit 1
}
[[ "$actual_arch" == "$ARCH" ]] || {
  printf 'offline-dependencies: architecture %s is required, got %s\n' "$ARCH" "$actual_arch" >&2
  exit 1
}
[[ "$actual_libc" == "$LIBC" ]] || {
  printf 'offline-dependencies: libc %s is required, got %s\n' "$LIBC" "${actual_libc:-unknown}" >&2
  exit 1
}
[[ "$actual_bun_version" == "$expected_bun_version" ]] || {
  printf 'offline-dependencies: Bun %s is required, got %s\n' "$expected_bun_version" "$actual_bun_version" >&2
  exit 1
}

stage="$RUNNER_TEMP/offline-dependencies-stage"
rm -rf "$stage" frontend/node_modules
mkdir -p "$stage/frontend" "$stage/runtime"

(
  cd frontend
  bun install --frozen-lockfile
)

rm -rf frontend/node_modules/bun frontend/node_modules/@oven
rm -f frontend/node_modules/.bin/bun frontend/node_modules/.bin/bunx
find frontend/node_modules -mindepth 1 -maxdepth 2 -type d -name '*linux-x64-musl*' -prune -exec rm -rf {} +
find frontend/node_modules -type l -lname '*linux-x64-musl*' -delete

mv frontend/node_modules "$stage/frontend/node_modules"
cp "$(command -v bun)" "$stage/runtime/bun"
chmod 0755 "$stage/runtime/bun"

cat > "$stage/manifest.env" <<EOF_MANIFEST
OFFLINE_DEPENDENCIES_SCHEMA=$OFFLINE_DEPENDENCIES_SCHEMA
INPUT_KEY=$input_key
EOF_MANIFEST

archive="offline-dependencies-${input_key}.tar.zst"
tar --zstd -cf "$archive" -C "$stage" .
printf 'offline-dependencies: archive=%s bytes=%s\n' "$archive" "$(stat -c '%s' "$archive")"
printf 'archive=%s\n' "$archive" >> "$GITHUB_OUTPUT"
