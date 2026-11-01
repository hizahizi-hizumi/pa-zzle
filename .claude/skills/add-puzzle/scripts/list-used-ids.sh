#!/bin/bash
# list-used-ids.sh
# origin のすべてのブランチ（origin/main を含む）から、SPEC 番号・候補 ID（PUZZLE-NNN）・ADR 番号の使用と予約を集め、
# 番号ごとに、次に使える番号・衝突・origin/main に無い使用と予約を標準出力へ書く。
#
# 使用: SPEC は仕様ディレクトリのファイル（場所とタイトル）、候補 ID は台帳の行（名称）、ADR は docs/adr のファイル（タイトル）。
# 予約: 導入調査の `*実装前提調査.md` の識別表の行（`| SPEC 番号 | SPEC-NNN |`、`| 候補 ID | PUZZLE-NNN |`）。
# 衝突: 同じ番号を、別の場所・タイトル・名称・パズルに使っているもの。
#   予約を持つブランチの中の使用は、その予約と同じものとして数え、ほかのブランチの同じ使用も同じものとして数える
#   （自分のスタックの台帳の行・SPEC と予約は衝突しない）。予約の行は使用の行より先に並ぶ（sort で reserve < use）。
#   origin/main の履歴にある版（後で名前やタイトルを変えたもの）は、ほかのブランチに残っていても数えない。
# 次に使える番号: origin/main・全ブランチ・予約のどれにも使われていない、最大の次の番号。
#
# 実行前に `git fetch --all --prune` で origin のブランチを最新にしておく。

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

readonly MAIN_REF="origin/main"
readonly SPEC_DIRECTORY="docs/プロダクト/仕様/"
readonly CANDIDATE_LEDGER="docs/棚上げ/パズル候補.csv"
readonly RESEARCH_DIRECTORY="docs/パズル/導入調査/"
readonly RESEARCH_DOCUMENT_SUFFIX="実装前提調査.md"
readonly ADR_DIRECTORY="docs/adr/"
readonly SHOWN_BRANCHES=5

if ! git rev-parse --verify --quiet "$MAIN_REF" >/dev/null; then
  echo "ERROR: $MAIN_REF がありません。git fetch --all --prune を先に実行する" >&2
  exit 1
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
readonly files_by_ref="$work_dir/files-by-ref.tsv"
readonly main_history_files="$work_dir/main-history-files.tsv"
readonly facts_by_file="$work_dir/facts-by-file.tsv"
readonly entries="$work_dir/entries.tsv"

remote_branches() {
  git for-each-ref --format='%(refname:short)' refs/remotes/origin |
    grep -v -x -e 'origin/HEAD' -e 'origin'
}

# 入力と出力: <blob>\t<パス>[\t...]。番号を持ちうるファイル（SPEC・台帳・実装前提調査・ADR）の行だけを通す。
keep_numbered_files() {
  awk -F'\t' -v ledger="$CANDIDATE_LEDGER" -v suffix="$RESEARCH_DOCUMENT_SUFFIX" '
    $2 ~ /\/SPEC-[0-9]+\.md$/ || $2 ~ /^docs\/adr\/ADR-[0-9]+-[^\/]*\.md$/ || $2 == ledger || substr($2, length($2) - length(suffix) + 1) == suffix'
}

# 出力: <blob>\t<パス>\t<ブランチ>
list_files_by_ref() {
  local ref
  for ref in $(remote_branches); do
    git -c core.quotepath=false ls-tree -r "$ref" -- "$SPEC_DIRECTORY" "$CANDIDATE_LEDGER" "$RESEARCH_DIRECTORY" "$ADR_DIRECTORY" |
      awk -F'\t' -v ref="$ref" '{ split($1, meta, " "); print meta[3] "\t" $2 "\t" ref }'
  done | keep_numbered_files
}

# 古いブランチに残る、origin/main で後に名前やタイトルを変えた版を、新しい使用と数えないために使う。
# 出力: <blob>\t<パス>
list_main_history_files() {
  git -c core.quotepath=false log "$MAIN_REF" --format= --raw --no-abbrev --no-renames -- \
    "$SPEC_DIRECTORY" "$CANDIDATE_LEDGER" "$RESEARCH_DIRECTORY" "$ADR_DIRECTORY" |
    awk -F'\t' '{ split($1, meta, " "); if (meta[4] !~ /^0+$/) print meta[4] "\t" $2 }' |
    keep_numbered_files | sort -u
}

# 出力: <種類 SPEC|PUZZLE|ADR>\t<番号>\t<use|reserve>\t<ラベル>
facts_of_file() {
  local blob="$1" path="$2"
  case "$path" in
    */SPEC-*.md)
      local number title
      number="$(grep -o 'SPEC-[0-9]\+' <<<"${path##*/}")"
      title="$(git cat-file blob "$blob" | sed -n 's/^# \(SPEC-[0-9]* *\)\{0,1\}//p' | head -1)"
      printf 'SPEC\t%s\tuse\t%s（%s）\n' "$number" "${path#docs/プロダクト/}" "$title"
      ;;
    "$ADR_DIRECTORY"ADR-*.md)
      local number title
      number="$(grep -o 'ADR-[0-9]\+' <<<"${path##*/}")"
      title="$(git cat-file blob "$blob" | sed -n 's/^# //p' | head -1)"
      printf 'ADR\t%s\tuse\t%s\n' "$number" "$title"
      ;;
    "$CANDIDATE_LEDGER")
      git cat-file blob "$blob" | awk -F, '/^PUZZLE-[0-9]+,/ { print "PUZZLE\t" $1 "\tuse\t台帳（" $3 "）" }'
      ;;
    *)
      local puzzle_name
      puzzle_name="$(basename "$(dirname "$path")")"
      git cat-file blob "$blob" |
        sed -n -E 's/^\| *(SPEC 番号|候補 ID) *\| *`?((SPEC|PUZZLE)-[0-9]+)`? *\|.*/\2/p' |
        while read -r number; do
          printf '%s\t%s\treserve\t識別表（%s）\n' "${number%%-*}" "$number" "$puzzle_name"
        done
      ;;
  esac
}

list_files_by_ref >"$files_by_ref"
list_main_history_files >"$main_history_files"

# 出力: <blob>\t<パス>\t<種類>\t<番号>\t<use|reserve>\t<ラベル>
cut -f1,2 "$files_by_ref" "$main_history_files" | sort -u |
  while IFS=$'\t' read -r blob path; do
    facts_of_file "$blob" "$path" | sed "s|^|$blob\t$path\t|"
  done >"$facts_by_file"

# 出力: <種類>\t<番号>\t<use|reserve>\t<ラベル>\t<ブランチ>
awk -F'\t' -v OFS='\t' -v main_ref="$MAIN_REF" '
  FILENAME == ARGV[1] { facts[$1, $2] = facts[$1, $2] $3 OFS $4 OFS $5 OFS $6 "\n"; next }
  FILENAME == ARGV[2] {
    count = split(facts[$1, $2], lines, "\n")
    for (i = 1; i < count; i++) known_on_main[lines[i]] = 1
    next
  }
  {
    count = split(facts[$1, $2], lines, "\n")
    for (i = 1; i < count; i++)
      if ($3 == main_ref || !(lines[i] in known_on_main)) print lines[i], $3
  }
' "$facts_by_file" "$main_history_files" "$files_by_ref" | LC_ALL=C sort -u >"$entries"

report() {
  local kind="$1" heading="$2"
  awk -F'\t' -v kind="$kind" -v heading="$heading" -v main_ref="$MAIN_REF" -v shown_branches="$SHOWN_BRANCHES" '
    function number_of(id) { sub(/^[A-Z]+-0*/, "", id); return id + 0 }
    $1 != kind { next }
    NR == FNR {
      if ($3 == "reserve") reserved_by[$2, $5] = $4
      else if (($2, $5) in reserved_by) same_as_reservation[$2, $4] = reserved_by[$2, $5]
      next
    }
    {
      id = $2
      if ((id, $5) in reserved_by) owner = reserved_by[id, $5]
      else if ((id, $4) in same_as_reservation) owner = same_as_reservation[id, $4]
      else owner = $4
      if (!((id, owner) in seen)) {
        seen[id, owner] = 1
        owners[id] = owners[id] SUBSEP owner
        owner_count[id]++
      }
      if ((id, owner, $5) in counted) next
      counted[id, owner, $5] = 1
      branch_count[id, owner]++
      if (branch_count[id, owner] <= shown_branches) branches[id, owner] = branches[id, owner] " " $5
      if ($5 == main_ref) on_main[id, owner] = 1
      if ($5 == main_ref && number_of(id) > main_largest) main_largest = number_of(id)
      if (number_of(id) > largest) largest = number_of(id)
    }
    function owner_line(id, owner,   hidden) {
      hidden = branch_count[id, owner] - shown_branches
      return "  " id " " owner ":" branches[id, owner] (hidden > 0 ? " ほか" hidden "本" : "")
    }
    END {
      print "## " heading
      digits = kind == "ADR" ? 4 : 3
      printf "%s の最大: %s-%0" digits "d\n", main_ref, kind, main_largest
      printf "次に使える番号（%s・全ブランチ・識別表の予約のどれとも重ならない）: %s-%0" digits "d\n", main_ref, kind, largest + 1
      print "衝突（同じ番号を別のものに使っている）:"
      collisions = 0
      for (id in owner_count) {
        if (owner_count[id] < 2) continue
        collisions++
        count = split(owners[id], list, SUBSEP)
        for (i = 2; i <= count; i++) print owner_line(id, list[i]) | "sort"
      }
      close("sort")
      if (collisions == 0) print "  なし"
      print main_ref " に無い使用と予約:"
      for (key in branch_count) {
        if (key in on_main) continue
        split(key, parts, SUBSEP)
        print owner_line(parts[1], parts[2]) | "sort"
      }
      close("sort")
      print ""
    }
  ' "$entries" "$entries"
}

report "SPEC" "SPEC"
report "PUZZLE" "候補 ID（台帳の名称と識別表の予約）"
report "ADR" "ADR"
