#!/bin/bash
# validate-input.sh [baseBranch]
# Default baseBranch: main

set -euo pipefail

BASE_BRANCH="${1:-main}"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "ERROR: Git管理下ではありません" >&2
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [ -z "$CURRENT_BRANCH" ]; then
  echo "ERROR: detached HEADでは実行できません" >&2
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$BASE_BRANCH"; then
  BASE_REF="$BASE_BRANCH"
elif git show-ref --verify --quiet "refs/remotes/origin/$BASE_BRANCH"; then
  BASE_REF="origin/$BASE_BRANCH"
else
  echo "ERROR: baseBranch '$BASE_BRANCH' がローカルにもoriginにも存在しません" >&2
  exit 1
fi

case "$CURRENT_BRANCH" in
  main|master|staging)
    if [ "$CURRENT_BRANCH" != "$BASE_BRANCH" ]; then
      echo "ERROR: 保護対象ブランチ '$CURRENT_BRANCH' 上の差分を別base '$BASE_BRANCH' へ持ち越しません" >&2
      exit 1
    fi
    IS_CREATE_BRANCH=true
    ;;
  *)
    if [ "$CURRENT_BRANCH" = "$BASE_BRANCH" ]; then
      IS_CREATE_BRANCH=true
    else
      IS_CREATE_BRANCH=false
    fi
    ;;
esac

echo "baseBranch=$BASE_BRANCH"
echo "baseRef=$BASE_REF"
echo "currentBranch=$CURRENT_BRANCH"
echo "isCreateBranch=$IS_CREATE_BRANCH"
