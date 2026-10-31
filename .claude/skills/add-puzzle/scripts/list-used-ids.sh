#!/bin/bash
# list-used-ids.sh
# origin のすべてのブランチで使われている SPEC 番号と候補 ID（PUZZLE-NNN）を集め、
# 全ブランチを通した次の番号と、origin/main に無い使用中の番号を標準出力へ書く。
# 実行前に `git fetch --all --prune` で origin のブランチを最新にしておく。

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

readonly MAIN_REF="origin/main"
readonly SPEC_DIRECTORY="docs/プロダクト/仕様/"
readonly CANDIDATE_LEDGER="docs/棚上げ/パズル候補.csv"
readonly SHOWN_BRANCHES=5

if ! git rev-parse --verify --quiet "$MAIN_REF" >/dev/null; then
  echo "ERROR: $MAIN_REF がありません。git fetch --all --prune を先に実行する" >&2
  exit 1
fi

remote_branches() {
  git for-each-ref --format='%(refname:short)' refs/remotes/origin |
    grep -v -x -e 'origin/HEAD' -e 'origin'
}

spec_ids() {
  git -c core.quotepath=false ls-tree -r --name-only "$1" -- "$SPEC_DIRECTORY" |
    grep -o 'SPEC-[0-9]\+\.md$' |
    sed 's/\.md$//' |
    sort -u
}

# 同じ ID を別の候補に振った衝突を見分けるため、名称も並べる。
candidate_rows() {
  git show "$1:$CANDIDATE_LEDGER" 2>/dev/null |
    grep '^PUZZLE-[0-9]\+,' |
    cut -d, -f1,3 |
    sort -u
}

entries_on_all_branches() {
  local lister="$1"
  for ref in $(remote_branches); do
    "$lister" "$ref" | sed "s|\$|	$ref|"
  done
}

report() {
  local label="$1" lister="$2" prefix="$3"
  local main_entries branch_entries largest_number
  main_entries="$("$lister" "$MAIN_REF")"
  branch_entries="$(entries_on_all_branches "$lister")"
  largest_number="$(cut -f1 <<<"$branch_entries" | cut -d, -f1 | grep -o '[0-9]\+$' | sort -n | tail -1)"

  echo "## $label"
  echo "$MAIN_REF の最大: $(cut -d, -f1 <<<"$main_entries" | sort | tail -1)"
  printf '全ブランチを通した次の番号: %s-%03d\n' "$prefix" "$((10#$largest_number + 1))"
  echo "$MAIN_REF に無い番号を使っているブランチ（番号[,名称] とブランチ。同じ番号で名称が違う行は衝突）:"
  awk -F'\t' -v shown_branches="$SHOWN_BRANCHES" '
    NR == FNR { split($0, main_fields, ","); on_main[main_fields[1]] = 1; next }
    {
      split($1, fields, ",")
      if (fields[1] in on_main) next
      count[$1]++
      if (count[$1] <= shown_branches) branches[$1] = branches[$1] " " $2
    }
    END {
      for (entry in count) {
        hidden = count[entry] - shown_branches
        print entry branches[entry] (hidden > 0 ? " ほか" hidden "本" : "")
      }
    }
  ' <(printf '%s\n' "$main_entries") <(printf '%s\n' "$branch_entries") | sort
  echo
}

report "SPEC" spec_ids "SPEC"
report "候補 ID（パズル候補.csv の ID と名称）" candidate_rows "PUZZLE"
