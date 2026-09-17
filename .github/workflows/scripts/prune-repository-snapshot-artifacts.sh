#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 && $# -ne 4 ]]; then
  echo "Usage: $0 <main|pr-N> [<expected-sha> <snapshot-artifact-id> <bundle-artifact-id>]" >&2
  exit 2
fi

target="$1"
expected_sha="${2:-}"
snapshot_artifact_id="${3:-}"
bundle_artifact_id="${4:-}"

if [[ ! "$target" =~ ^(main|pr-[0-9]+)$ ]]; then
  echo "Unsupported Repository Snapshot target: $target" >&2
  exit 2
fi

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

if [[ -n "$expected_sha" ]]; then
  if [[ ! "$expected_sha" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Expected a 40-character commit SHA, got: $expected_sha" >&2
    exit 2
  fi
  if [[ ! "$snapshot_artifact_id" =~ ^[0-9]+$ || ! "$bundle_artifact_id" =~ ^[0-9]+$ ]]; then
    echo "Artifact IDs must be numeric" >&2
    exit 2
  fi

  if [[ "$target" == "main" ]]; then
    active_sha="$(gh api "/repos/${GITHUB_REPOSITORY}/branches/main" --jq '.commit.sha')"
  else
    pr_number="${target#pr-}"
    active_sha="$(gh api "/repos/${GITHUB_REPOSITORY}/pulls/${pr_number}" --jq '.head.sha')"
  fi

  if [[ "$active_sha" != "$expected_sha" ]]; then
    echo "Skip Repository Snapshot pruning because $target moved from $expected_sha to $active_sha"
    exit 0
  fi
fi

snapshot_pattern="^repository-snapshot-${target}-[0-9a-f]{40}\\.zip$"
bundle_pattern="^repository-bundle-${target}-[0-9a-f]{40}\\.bundle$"
environment_pattern="^repository-environment-${target}-[0-9a-f]{40}\\.json$"

delete_artifact() {
  local artifact_id="$1"
  local delete_output

  if delete_output="$(gh api --method DELETE "/repos/${GITHUB_REPOSITORY}/actions/artifacts/${artifact_id}" 2>&1)"; then
    return 0
  fi

  if [[ "$delete_output" == *"HTTP 404"* ]]; then
    return 0
  fi

  printf '%s\n' "$delete_output" >&2
  return 1
}

gh api --paginate "/repos/${GITHUB_REPOSITORY}/actions/artifacts?per_page=100" \
  --jq '.artifacts[] | [.id, .name] | @tsv' |
while IFS=$'\t' read -r artifact_id artifact_name; do
  if [[ ! "$artifact_name" =~ $snapshot_pattern && ! "$artifact_name" =~ $bundle_pattern && ! "$artifact_name" =~ $environment_pattern ]]; then
    continue
  fi

  if [[ "$artifact_id" == "$snapshot_artifact_id" || "$artifact_id" == "$bundle_artifact_id" ]]; then
    continue
  fi

  echo "Delete obsolete Repository Snapshot artifact: $artifact_name ($artifact_id)"
  delete_artifact "$artifact_id"
done
