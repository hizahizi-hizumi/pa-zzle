#!/bin/bash
# restack.sh
# 原因の段のブランチを直したあと、その上の段を新しい先端へ積み直す。
#
# 既定は dry-run: 使い捨ての worktree で積み直しを試し、旧コミット ID・段ごとに載せ直すコミット・
# 衝突する段とファイルを出す。ローカルのブランチも origin も変えない。
# --execute: rerere を有効にし、--update-refs で上の段のブランチを積み直し、各段の先端で検証し、
# すべて通ったときだけ push --atomic --force-with-lease する。
#
# 使い方:
#   restack.sh [--execute [--continue] | --abort] [--remote <名前>] [--old-base <rev>] [--verify <コマンド>] \
#     [--record <ファイル>] <原因の段のブランチ> <上の段のブランチ>...
#   上の段のブランチは下の段から順に並べる。
#
# 前提:
#   - すべての段のローカルブランチがある。原因の段のブランチには直したコミットがある。
#   - <old-base>（既定は <remote>/<原因の段>。直す前の原因の段の先端）が、すぐ上の段の祖先である。
#   - 上の段のブランチは、どの worktree でも checkout していない（--update-refs が書き換えずに飛ばすため）。
#
# 衝突: rerere で解けない衝突で止まったら、出力された worktree で解いて git add し、
# 同じ引数に --continue を付けて再実行する。検証で落ちたときも、直してから --continue で検証と push をやり直せる。
# --abort: 途中の積み直しを捨て、段のブランチを積み直す前のコミットへ戻す。
# 出力の旧コミット ID は PR 本文に残す（ローカルの tag や reflog はコンテナと一緒に消える）。
#
# 終了コード: 0 成功（dry-run では衝突なし）、1 前提か検証の失敗、2 引数の誤り、3 衝突で停止。

set -euo pipefail

readonly DEFAULT_VERIFY_COMMAND='bun install --cwd frontend --frozen-lockfile && bun install --cwd tools/semantic-lint --frozen-lockfile && ./scripts/verify.sh'
readonly EXIT_FAILURE=1
readonly EXIT_USAGE=2
readonly EXIT_CONFLICT=3

usage() {
  sed -n '2,/^$/s/^# \{0,1\}//p' "$0" >&2
  exit "$EXIT_USAGE"
}

fail() {
  echo "ERROR: $*" >&2
  exit "$EXIT_FAILURE"
}

execute=false
resume=false
abort=false
remote=origin
old_base=""
verify_command="$DEFAULT_VERIFY_COMMAND"
record_file=""

while (($# > 0)); do
  case "$1" in
    --execute) execute=true ;;
    --continue) resume=true ;;
    --abort) abort=true ;;
    --remote) remote="${2:?}"; shift ;;
    --old-base) old_base="${2:?}"; shift ;;
    --verify) verify_command="${2:?}"; shift ;;
    --record) record_file="${2:?}"; shift ;;
    -h | --help) usage ;;
    --*) echo "ERROR: 不明なオプション: $1" >&2; usage ;;
    *) break ;;
  esac
  shift
done

(($# >= 2)) || usage
if $resume && ! $execute; then
  echo "ERROR: --continue は --execute と一緒に使う" >&2
  usage
fi
if $abort && $execute; then
  echo "ERROR: --abort は --execute と一緒に使わない" >&2
  usage
fi

readonly cause_branch="$1"
shift
readonly upper_branches=("$@")
readonly stack_branches=("$cause_branch" "${upper_branches[@]}")
readonly top_branch="${upper_branches[-1]}"

cd "$(git rev-parse --show-toplevel)"
# --continue で同じ状態を見つけられるよう、--execute の状態の置き場所は最上段の名前から決める。
if $execute || $abort; then
  state_dir="${TMPDIR:-/tmp}/restack-$(basename "$PWD")-${top_branch//\//-}"
else
  state_dir="$(mktemp -d)"
fi
readonly state_dir
readonly rebase_tree="$state_dir/tree"
readonly old_ids_file="$state_dir/old-ids.tsv"
readonly stack_file="$state_dir/stack"

sha_of() {
  git rev-parse --verify --quiet "$1^{commit}" || echo "なし"
}

short() {
  if [[ "$1" == "なし" ]]; then echo "$1"; else git rev-parse --short "$1"; fi
}

branches_checked_out_in_worktrees() {
  git worktree list --porcelain | sed -n 's|^branch refs/heads/||p'
}

# 段のコミットが、下から見て最初にそれを含む段に属するとして段の名前を返す。
stage_of_commit() {
  local commit="$1" branch old_sha
  while IFS=$'\t' read -r branch old_sha _; do
    [[ "$branch" == "$cause_branch" ]] && continue
    if git merge-base --is-ancestor "$commit" "$old_sha"; then
      echo "$branch"
      return
    fi
  done <"$old_ids_file"
  echo "（不明）"
}

check_preconditions() {
  local branch previous checked_out stray
  for branch in "${stack_branches[@]}"; do
    git rev-parse --verify --quiet "refs/heads/$branch" >/dev/null ||
      fail "ローカルブランチ $branch がない。git branch $branch $remote/$branch で作る"
  done
  git rev-parse --verify --quiet "$old_base^{commit}" >/dev/null ||
    fail "直す前の原因の段の先端 $old_base がない。git fetch するか --old-base で指定する"
  [[ "$(sha_of "$cause_branch")" != "$(sha_of "$old_base")" ]] ||
    fail "$cause_branch が $old_base から動いていない。原因の段を直してコミットしてから実行する"

  previous="$old_base"
  for branch in "${upper_branches[@]}"; do
    git merge-base --is-ancestor "$previous" "$branch" ||
      fail "$previous が $branch の祖先ではない。段の並び（下から順）と --old-base を確かめる"
    previous="$branch"
  done

  checked_out="$(branches_checked_out_in_worktrees)"
  for branch in "${upper_branches[@]}"; do
    if grep -qx -- "$branch" <<<"$checked_out"; then
      fail "$branch がほかの worktree で checkout されている（git worktree list）。その worktree を消すか --detach にしてから実行する"
    fi
  done

  # --update-refs は、積み直す範囲を指すローカルブランチをすべて書き換える。段でないブランチが巻き込まれないよう止める。
  stray="$(git for-each-ref --format='%(refname:short) %(objectname)' refs/heads |
    while read -r branch sha; do
      printf '%s\n' "${stack_branches[@]}" | grep -qx -- "$branch" && continue
      if git merge-base --is-ancestor "$old_base" "$sha" && git merge-base --is-ancestor "$sha" "$top_branch" &&
        [[ "$sha" != "$(sha_of "$old_base")" ]]; then
        echo "$branch"
      fi
    done)"
  [[ -z "$stray" ]] || fail "積み直す範囲を指す段でないローカルブランチがある（--update-refs で動いてしまう）: $(echo "$stray" | tr '\n' ' ')"
}

record_old_ids() {
  local branch
  : >"$old_ids_file"
  for branch in "${stack_branches[@]}"; do
    printf '%s\t%s\t%s\n' "$branch" "$(sha_of "refs/heads/$branch")" "$(sha_of "$remote/$branch")" >>"$old_ids_file"
  done
  printf '%s\n' "$old_base" "${stack_branches[@]}" >"$stack_file"
}

print_old_ids() {
  local branch local_sha remote_sha
  echo "## 旧コミット ID（積み直し前。PR 本文に残す）"
  echo "直す前の原因の段の先端: $(git rev-parse "$old_base")"
  echo "| ブランチ | ローカル | $remote |"
  echo "|---|---|---|"
  while IFS=$'\t' read -r branch local_sha remote_sha; do
    echo "| $branch | $local_sha | $remote_sha |"
  done <"$old_ids_file"
  if [[ -n "$record_file" ]]; then
    {
      echo "直す前の原因の段の先端: $(git rev-parse "$old_base")"
      cat "$old_ids_file"
    } >"$record_file"
  fi
  echo
}

print_plan() {
  local branch previous="$old_base"
  echo "## 載せ直すコミット（段ごと）"
  echo "$cause_branch: 新しい先端 $(short "$(sha_of "$cause_branch")")（直す前の先端 $(short "$(git rev-parse "$old_base")") に無いコミット $(git rev-list --count "$old_base..$cause_branch") 件）"
  for branch in "${upper_branches[@]}"; do
    echo "$branch: $(git rev-list --count "$previous..$branch") コミット"
    git log --oneline --no-decorate "$previous..$branch" | sed 's/^/  /'
    previous="$branch"
  done
  echo
}

unmerged_files() {
  git -C "$rebase_tree" diff --name-only --diff-filter=U
}

rebase_in_progress() {
  [[ -d "$(git -C "$rebase_tree" rev-parse --path-format=absolute --git-path rebase-merge)" ]]
}

# 衝突で止まるたびに、rerere が解いたものは続け、解けないものは段とファイルを出して止まる。
drive_rebase() {
  local stopped_commit
  while rebase_in_progress; do
    if [[ -n "$(unmerged_files)" ]]; then
      stopped_commit="$(git -C "$rebase_tree" rev-parse --verify --quiet REBASE_HEAD || echo "")"
      echo "## 衝突"
      echo "段: $(stage_of_commit "${stopped_commit:-HEAD}")"
      echo "コミット: $(git log -1 --oneline --no-decorate "${stopped_commit:-HEAD}")"
      echo "ファイル:"
      unmerged_files | sed 's/^/  /'
      return "$EXIT_CONFLICT"
    fi
    GIT_EDITOR=true git -C "$rebase_tree" -c rerere.enabled=true -c rerere.autoUpdate=true rebase --continue >/dev/null 2>&1 || true
  done
}

remove_dry_run_state() {
  git -C "$rebase_tree" rebase --abort >/dev/null 2>&1 || true
  git worktree remove --force "$rebase_tree" >/dev/null 2>&1 || true
  rm -rf "$state_dir"
}

dry_run() {
  local status=0
  record_old_ids
  print_old_ids
  print_plan

  git worktree add --quiet --detach "$rebase_tree" "$top_branch"
  git -C "$rebase_tree" -c rerere.enabled=true -c rerere.autoUpdate=true \
    rebase --onto "$cause_branch" "$old_base" >/dev/null 2>&1 || true
  drive_rebase || status=$?

  echo "## dry-run の結果"
  if ((status == EXIT_CONFLICT)); then
    echo "上の衝突は --execute でも起きる。--execute で止まったら、その段の文脈で解いて --continue する。"
  else
    echo "衝突なし（rerere で解けたものを含む）。--execute で積み直すと、各段で次を実行してから push する:"
    echo "  $verify_command"
    echo "push: git push --atomic --force-with-lease=<段>:<$remote の旧コミット> $remote <段>...（変わった段だけ）"
  fi
  return "$status"
}

verify_stages() {
  local branch verify_tree="$state_dir/verify" failed=()
  for branch in "${stack_branches[@]}"; do
    echo "==> 検証: $branch ($(short "$(sha_of "$branch")"))"
    git worktree remove --force "$verify_tree" >/dev/null 2>&1 || true
    git worktree add --quiet --detach "$verify_tree" "$branch"
    if (cd "$verify_tree" && bash -c "$verify_command") >"$state_dir/verify-${branch//\//-}.log" 2>&1; then
      echo "<== PASS: $branch"
    else
      echo "<== FAIL: $branch（ログ: $state_dir/verify-${branch//\//-}.log）"
      failed+=("$branch")
    fi
    git worktree remove --force "$verify_tree"
  done
  if ((${#failed[@]} > 0)); then
    echo "検証に落ちた段: ${failed[*]}。push していない。直してから --continue で検証と push をやり直す。"
    echo "積み直しを捨てるときは、同じ引数に --abort を付けて実行する。"
    return "$EXIT_FAILURE"
  fi
}

push_stages() {
  local branch local_old remote_old leases=() refspecs=()
  while IFS=$'\t' read -r branch local_old remote_old; do
    [[ "$(sha_of "refs/heads/$branch")" == "$remote_old" ]] && continue
    if [[ "$remote_old" == "なし" ]]; then
      leases+=("--force-with-lease=refs/heads/$branch:")
    else
      leases+=("--force-with-lease=refs/heads/$branch:$remote_old")
    fi
    refspecs+=("refs/heads/$branch:refs/heads/$branch")
  done <"$old_ids_file"
  if ((${#refspecs[@]} == 0)); then
    echo "push するものはない（$remote と同じ）"
    return
  fi
  if ! git push --atomic "${leases[@]}" "$remote" "${refspecs[@]}"; then
    echo "push が拒否された。どの段も push していない。$remote の段が積み直し前から動いていないかを git fetch で確かめ、取り込むなら --abort で戻してからやり直す。"
    return "$EXIT_FAILURE"
  fi
}

print_range_diff() {
  local old_top
  old_top="$(awk -F'\t' -v top="$top_branch" '$1 == top { print $2 }' "$old_ids_file")"
  echo "## 積み直しの対応（git range-diff。= は同じ変更、! は内容が変わったコミット）"
  git range-diff --no-color -s "$old_base..$old_top" "$cause_branch..$top_branch" || true
  echo
}

run_execute() {
  if $resume; then
    [[ -d "$state_dir" ]] || fail "続きの状態 $state_dir がない。--continue を付けずに実行する"
    diff -q <(printf '%s\n' "$old_base" "${stack_branches[@]}") "$stack_file" >/dev/null ||
      fail "前回と引数が違う（前回: $(tr '\n' ' ' <"$stack_file")）"
  else
    [[ ! -e "$state_dir" ]] || fail "前回の積み直しが残っている: $state_dir。続けるなら --continue、捨てるなら --abort を付けて同じ引数で実行する"
    check_preconditions
    mkdir -p "$state_dir"
    record_old_ids
    print_old_ids
    print_plan
    git config rerere.enabled true
    git config rerere.autoUpdate true
    git worktree add --quiet --detach "$rebase_tree" "$top_branch"
    git -C "$rebase_tree" rebase --update-refs --onto "$cause_branch" "$old_base" "$top_branch" >/dev/null 2>&1 || true
  fi

  if [[ -d "$rebase_tree" ]] && rebase_in_progress; then
    if ! drive_rebase; then
      echo "worktree: $rebase_tree"
      echo "その段の文脈で解いて git -C $rebase_tree add <ファイル> の後、同じ引数に --continue を付けて再実行する。"
      echo "捨てるときは同じ引数に --abort を付けて実行する。"
      return "$EXIT_CONFLICT"
    fi
  fi
  # 最上段をこの worktree で checkout したままだと、検証に落ちた後の直しや --abort でブランチを動かせない。
  git -C "$rebase_tree" switch --quiet --detach

  print_range_diff
  verify_stages
  push_stages
  print_old_ids
  git worktree remove --force "$rebase_tree"
  rm -rf "$state_dir"
  echo "積み直しと push が済んだ。上の旧コミット ID を各段の PR 本文に残す。"
}

run_abort() {
  local branch local_old
  [[ -f "$old_ids_file" ]] || fail "捨てる積み直しの状態 $state_dir がない"
  if [[ -d "$rebase_tree" ]]; then
    rebase_in_progress && git -C "$rebase_tree" rebase --abort
    git -C "$rebase_tree" switch --quiet --detach 2>/dev/null || true
  fi
  while IFS=$'\t' read -r branch local_old _; do
    [[ "$(sha_of "refs/heads/$branch")" == "$local_old" ]] && continue
    git branch -f "$branch" "$local_old"
    echo "$branch を $(short "$local_old") へ戻した"
  done <"$old_ids_file"
  git worktree remove --force "$rebase_tree" 2>/dev/null || true
  rm -rf "$state_dir"
}

if [[ -z "$old_base" ]]; then
  if ($resume || $abort) && [[ -f "$stack_file" ]]; then
    old_base="$(head -1 "$stack_file")"
  else
    old_base="$remote/$cause_branch"
  fi
fi
# origin へ push すると <remote>/<原因の段> が動くので、直す前の先端はコミット ID で持つ。
old_base="$(git rev-parse --verify --quiet "$old_base^{commit}" || echo "$old_base")"

if $abort; then
  run_abort
elif $execute; then
  run_execute
else
  trap remove_dry_run_state EXIT
  check_preconditions
  dry_run
fi
