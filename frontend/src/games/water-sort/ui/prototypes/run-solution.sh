#!/usr/bin/env bash
# ウォーターソート 難易度3 問題 nu5rm2hnt7 を始めから完成まで通す。
# 使い方: run-solution.sh <driverのポート> [試作の id]   （リポジトリのルートで実行する。試作の id を渡すと look=<id> を付けて開く）
set -euo pipefail
PORT="${1:-9301}"
LOOK="${2:-}"
ENTRY="/puzzles/water-sort/play/3?problem=nu5rm2hnt7${LOOK:+&look=$LOOK}"
D="node .claude/skills/share/playtest-driver.mjs send --port $PORT"
tapsel() { # セレクタの1つ目の要素の中心を打つ
  local line; line=$($D rect "$1" | grep '^rect 1 ')
  local cx cy; cx=$(sed -E 's/.* cx=([0-9.]+).*/\1/' <<<"$line"); cy=$(sed -E 's/.* cy=([0-9.]+).*/\1/' <<<"$line")
  $D tap "$cx" "$cy"
}
bottle() { tapsel "button[aria-label^=\"ボトル $1:\"]"; }
pour() { echo "# pour $1 -> $2"; bottle "$1"; bottle "$2"; }
$D goto "$ENTRY"
$D wait 1200
echo "# 誤り: ボトル1(上端 黄)をボトル2(上端 緑)へ"; bottle 1; bottle 2; $D wait 300
echo "# 選びを外す"; bottle 1
MOVES="6 7|4 7|6 8|6 7|1 6|4 1|3 4|3 6|3 8|5 3|5 8|5 7|2 4|2 1|2 3|1 2|4 1|3 4|5 8"
i=0
IFS='|' read -ra ARR <<<"$MOVES"
for m in "${ARR[@]}"; do
  i=$((i+1)); set -- $m
  if [ "$i" -eq "${#ARR[@]}" ]; then
    echo "# 最後の注ぎ $1 -> $2（完成の瞬間を撮る）"; bottle "$1"
    line=$($D rect "button[aria-label^=\"ボトル $2:\"]" | grep '^rect 1 ')
    $D frames 10 250 tap "$(sed -E 's/.* cx=([0-9.]+).*/\1/' <<<"$line")" "$(sed -E 's/.* cy=([0-9.]+).*/\1/' <<<"$line")"
    continue
  fi
  pour "$1" "$2"
  if [ "$i" -eq 3 ]; then echo "# 待った"; tapsel 'role=button[name="待った"]'; echo "# 打ち直し"; pour "$1" "$2"; fi
done
# 最後の注ぎは完成の瞬間を途中ごと撮る（最後の1手の注ぎ先を frames で打つ）
$D wait 2500
$D wait 3000
